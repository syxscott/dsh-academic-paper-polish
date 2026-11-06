// The five model-facing tools.
//
// Each tool answers one question and returns a SLICED payload: the rule
// database is never dumped into a tool result. The plain `runPaper*` functions
// are shared by the tools, the slash commands and the panel API so the model
// and the browser always see the same numbers.

import { readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

import {
  SECTION_VOCABULARY,
  allJournals,
  allRules,
  allSentences,
  findJournal,
  meta,
} from './data.mjs';
import { checkText, emptySummary } from './checker.mjs';
import { extractText, formatOf, isExtractable, unsupportedMessage } from './docx.mjs';
import { buildOutline } from './outline.mjs';
import { clip } from './text.mjs';

/** Hard caps — a tool result must never carry the whole knowledge base. */
export const LIMITS = Object.freeze({
  rules: 40,
  rulesMax: 200,
  journals: 20,
  journalsMax: 50,
  checklists: 50,
  violations: 200,
  sentences: 200,
  hits: 200,
});

const SEVERITY_ICON = { hard: '🔴', soft: '🟡', info: '🔵' };
const SEVERITY_RANK = { hard: 0, soft: 1, info: 2 };

function compile(pattern, flags) {
  if (typeof pattern !== 'string' || pattern.length === 0) return null;
  try {
    return new RegExp(pattern, typeof flags === 'string' ? flags : '');
  } catch {
    return null;
  }
}

/** Resolve a user supplied path against the agent's working directory. */
export function resolvePath(rawPath, cwd) {
  const value = String(rawPath ?? '').trim();
  if (!value) return '';
  if (isAbsolute(value)) return value;
  const base = cwd && String(cwd).length > 0 ? String(cwd) : process.cwd();
  return resolve(join(base, value));
}

/**
 * Read the text of a tool call: an explicit `path` wins over `text`.
 * Never throws — an unreadable file becomes a readable error string.
 *
 * A `.docx` is a ZIP archive: reading it as UTF-8 would hand the rule engine
 * mojibake and produce nonsense findings, so it goes through the extractor.
 */
export function resolveTextSource(input = {}, options = {}) {
  const rawPath = typeof input.path === 'string' ? input.path.trim() : '';
  const rawText = typeof input.text === 'string' ? input.text : '';
  if (rawPath.length > 0) {
    const target = resolvePath(rawPath, options.cwd);
    const format = formatOf(target);
    if (format !== null && !isExtractable(format)) {
      return { error: `无法读取文件「${rawPath}」：${unsupportedMessage(format)}` };
    }
    try {
      if (format === 'docx') {
        return { text: extractText(target).text, path: target, format };
      }
      return { text: readFileSync(target, 'utf8'), path: target, format: format ?? 'text' };
    } catch (error) {
      return { error: `无法读取文件「${rawPath}」：${error.message}` };
    }
  }
  if (rawText.trim().length > 0) return { text: rawText, path: null };
  return { error: '需要提供 text（正文内容）或 path（文件路径）' };
}

/* ── shared runners ─────────────────────────────────────────────────── */

/** Run the deterministic rule engine over a text or a file. */
export function runPaperCheck(args = {}, options = {}) {
  const source = resolveTextSource(args, options);
  if (source.error) {
    return {
      ok: false,
      error: source.error,
      path: null,
      violations: [],
      advice: [],
      summary: emptySummary(),
      truncated: false,
    };
  }
  const result = checkText(source.text, {
    section: args.section ?? null,
    journal: args.journal ?? null,
  });
  const truncated =
    result.violations.length > LIMITS.violations || result.advice.length > LIMITS.violations;
  return {
    ok: true,
    error: null,
    path: source.path,
    violations: result.violations.slice(0, LIMITS.violations),
    advice: result.advice.slice(0, LIMITS.violations),
    summary: result.summary,
    truncated,
  };
}

/**
 * Slice the rule database by keyword, section and severity.
 *
 * Journal-scoped rules (`rule.journals`) are hidden unless a `journal` is
 * given: with no target they are meaningless, and applying another journal's
 * rules is worse than not reporting them at all.
 */
export function runPaperRules(args = {}) {
  const needle = String(args.query ?? '').trim().toLowerCase();
  const section = args.section ? String(args.section) : null;
  const severity = args.severity ? String(args.severity) : null;
  const requested = Number(args.limit);
  const limit = Number.isFinite(requested)
    ? Math.min(Math.max(1, Math.floor(requested)), LIMITS.rulesMax)
    : LIMITS.rules;

  const journalQuery = args.journal ? String(args.journal).trim() : '';
  const journal = journalQuery ? findJournal(journalQuery) : null;
  const journalKey = journal ? String(journal.key) : null;
  const journalUnknown = journalQuery.length > 0 && journal === null;

  const matched = allRules().filter((rule) => {
    const scoped = Array.isArray(rule.journals) ? rule.journals : [];
    if (scoped.length > 0 && (!journalKey || !scoped.includes(journalKey))) return false;
    if (section && !rule.sections.includes(section)) return false;
    if (severity && rule.severity !== severity) return false;
    if (needle.length === 0) return true;
    const haystack = [
      rule.id,
      rule.title,
      rule.statement,
      rule.fix,
      rule.domain,
      ...(rule.tags ?? []),
      ...(rule.sections ?? []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(needle);
  });

  matched.sort(
    (a, b) =>
      (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3) ||
      String(a.id).localeCompare(String(b.id)),
  );

  return {
    rules: matched.slice(0, limit).map((rule) => ({
      id: rule.id,
      title: rule.title ?? rule.id,
      severity: rule.severity ?? 'info',
      sections: rule.sections ?? [],
      statement: clip(rule.statement ?? '', 200),
      fix: clip(rule.fix ?? '', 240),
      tags: rule.tags ?? [],
      source: rule.source ?? {},
      domain: rule.domain,
      checkType: rule.check?.type ?? 'manual',
      journals: rule.journals ?? [],
    })),
    total: matched.length,
    journalKey,
    journalName: journal ? (journal.name ?? journal.key) : null,
    journalUnknown,
  };
}

function scoreSingle(journal, term) {
  const name = String(journal.name ?? '').toLowerCase();
  const key = String(journal.key ?? '').toLowerCase();
  const fields = (journal.field ?? []).map((entry) => String(entry).toLowerCase());
  const scope = String(journal.scope ?? '').toLowerCase();
  const publisher = String(journal.publisher ?? '').toLowerCase();
  const notes = String(journal.notes ?? '').toLowerCase();
  const rules = (journal.rules ?? []).map((entry) => String(entry).toLowerCase());
  if (name === term) return 100;
  if (key === term) return 95;
  if (name.includes(term)) return 80;
  if (fields.some((field) => field === term)) return 70;
  if (fields.some((field) => field.includes(term))) return 60;
  if (key.includes(term)) return 55;
  if (scope.includes(term)) return 45;
  if (publisher.includes(term)) return 35;
  if (rules.some((rule) => rule.includes(term))) return 30;
  if (notes.includes(term)) return 20;
  return 0;
}

function scoreJournal(journal, needle) {
  if (!needle) return 1;
  const direct = scoreSingle(journal, needle);
  if (direct > 0) return direct;
  const tokens = needle.split(/\s+/u).filter((token) => token.length > 1);
  if (tokens.length > 1) {
    let sum = 0;
    for (const token of tokens) {
      const score = scoreSingle(journal, token);
      if (score > 0) sum += Math.min(score, 50);
    }
    return sum > 0 ? Math.min(sum, 85) : 0;
  }
  return 0;
}

function journalView(journal) {
  return {
    key: journal.key ?? '',
    name: journal.name ?? '',
    publisher: journal.publisher ?? null,
    issn: journal.issn ?? null,
    field: journal.field ?? [],
    scope: journal.scope ?? null,
    impactFactor: journal.impactFactor ?? null,
    reviewDays: journal.reviewDays ?? null,
    apc: journal.apc ?? null,
    openAccess: Boolean(journal.openAccess),
    articleTypes: journal.articleTypes ?? [],
    limits: journal.limits ?? {},
    structure: journal.structure ?? [],
    rules: journal.rules ?? [],
    notes: journal.notes ?? null,
    source: journal.source ?? {},
  };
}

/** Rank the journal database against a topic. */
export function runPaperJournals(args = {}) {
  const needle = String(args.query ?? '').trim().toLowerCase();
  const field = args.field ? String(args.field).trim().toLowerCase() : null;
  const openAccess = typeof args.openAccess === 'boolean' ? args.openAccess : null;
  const maxApc = typeof args.maxApc === 'number' && Number.isFinite(args.maxApc) ? args.maxApc : null;
  const requested = Number(args.limit);
  const limit = Number.isFinite(requested)
    ? Math.min(Math.max(1, Math.floor(requested)), LIMITS.journalsMax)
    : LIMITS.journals;

  const scored = [];
  for (const journal of allJournals()) {
    if (field) {
      const fields = (journal.field ?? []).map((entry) => String(entry).toLowerCase());
      const hit = fields.some((entry) => entry.includes(field) || field.includes(entry));
      if (!hit) continue;
    }
    if (openAccess !== null && Boolean(journal.openAccess) !== openAccess) continue;
    if (maxApc !== null) {
      const apc = typeof journal.apc === 'number' ? journal.apc : null;
      if (apc === null || apc > maxApc) continue;
    }
    const score = scoreJournal(journal, needle);
    if (needle.length > 0 && score <= 0) continue;
    scored.push({ journal, score });
  }

  scored.sort(
    (a, b) => b.score - a.score || String(a.journal.name ?? '').localeCompare(String(b.journal.name ?? '')),
  );

  return {
    journals: scored.slice(0, limit).map((entry) => journalView(entry.journal)),
    total: scored.length,
  };
}

/** Build the manuscript outline for a journal or for one section. */
export function runPaperOutline(args = {}) {
  return buildOutline({ journal: args.journal ?? null, section: args.section ?? null });
}

/** Scan a text for de-AI sentence patterns and score it. */
export function runPaperDeai(args = {}, options = {}) {
  const source = resolveTextSource(args, options);
  if (source.error) {
    return { ok: false, error: source.error, path: null, hits: [], score: 100, total: 0 };
  }
  const text = source.text;
  const hits = [];
  let penalty = 0;
  for (const pattern of allSentences()) {
    const re = compile(pattern.pattern, pattern.flags);
    if (!re) continue;
    const global = compile(pattern.pattern, `${pattern.flags ?? ''}g`);
    if (!global) continue;
    const matches = [...text.matchAll(global)];
    if (matches.length === 0) continue;
    const weight = pattern.severity === 'hard' ? 12 : pattern.severity === 'soft' ? 6 : 2;
    penalty += weight * Math.min(matches.length, 3);
    const matched = clip(matches[0][0], 120);
    hits.push({
      id: pattern.id ?? '',
      zh: pattern.zh ?? '',
      en: pattern.en ?? '',
      severity: pattern.severity ?? 'info',
      category: pattern.category ?? null,
      why: pattern.why ?? null,
      suggestion: pattern.suggestion ?? null,
      matched,
      match: matched,
      count: matches.length,
    });
  }
  hits.sort(
    (a, b) =>
      (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3) || b.count - a.count,
  );
  const score = Math.max(0, Math.min(100, 100 - Math.round(penalty)));
  return {
    ok: true,
    error: null,
    path: source.path,
    hits: hits.slice(0, LIMITS.hits),
    score,
    total: hits.length,
  };
}

/* ── tool definitions ───────────────────────────────────────────────── */

const SECTION_ENUM = [...SECTION_VOCABULARY];

function text(value) {
  return { type: 'text', text: value };
}

/**
 * The journal note the model must see: which journal was applied, and how
 * many journal-specific rules were left out.
 */
function journalNote(summary) {
  if (!summary) return [];
  if (summary.journalUnknown) {
    return [
      `⚠️ 未识别的期刊名，只应用了通用规则；请用期刊全名或 key 重试（已知 ${summary.journalQuery ?? ''}）。`,
    ];
  }
  if (!summary.journalKey) {
    const skipped = summary.skippedJournalRules ?? 0;
    if (skipped > 0) {
      return [`未指定目标期刊，跳过了 ${skipped} 条期刊专属规则；传 journal=<期刊> 可启用。`];
    }
    return [];
  }
  return [
    `已应用目标期刊：${summary.journalName ?? summary.journalKey}（${summary.journalKey}）；${
      summary.skippedJournalRules ?? 0
    } 条其他期刊的专属规则未应用。`,
  ];
}

function violationLines(violation) {
  const icon = SEVERITY_ICON[violation.severity] ?? '🔵';
  const lines = [`- ${icon} \`${violation.id}\` ${violation.title}（${violation.section}）`];
  if (violation.actual !== undefined && violation.expected !== undefined) {
    lines.push(`  - 实测 ${violation.actual}；期望 ${violation.expected}`);
  } else if (violation.expected !== undefined) {
    lines.push(`  - 期望 ${violation.expected}`);
  }
  if (violation.matched) lines.push(`  - 命中 ${violation.matched}`);
  if (violation.fix) lines.push(`  - 修改 ${violation.fix}`);
  return lines;
}

/**
 * Build the five tool definitions.
 * @param {object} options
 * @param {(agent: unknown) => string} [options.resolveCwd]  the agent's working directory
 */
export function createToolDefinitions(options = {}) {
  const resolveCwd =
    typeof options.resolveCwd === 'function' ? options.resolveCwd : () => process.cwd();
  const cwdFor = (exec) => {
    try {
      const value = resolveCwd(exec?.agent);
      return typeof value === 'string' && value.length > 0 ? value : process.cwd();
    } catch {
      return process.cwd();
    }
  };

  return [
    {
      name: 'paper_check',
      description:
        'paper_check：按 SCI 硬规则体检论文正文（段落结构、字数、引用密度、图表参数、期刊上限）。写完某一节、投稿前自查、或用户要求“检查/合规/看看有没有硬伤”时调用；不要凭记忆复述规则，直接调用本工具拿逐条违规与改法。传 journal=<目标期刊> 可额外启用该刊专属规则，不传则只查通用规则。',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: '待检查的正文，可为整篇或单个段落。' },
          path: {
            type: 'string',
            description: '待检查的文稿文件路径；相对路径按当前工作目录解析。与 text 同时给出时以 path 为准。',
          },
          section: {
            type: 'string',
            enum: SECTION_ENUM,
            description: '只检查某一个段落（如 abstract、introduction）。省略则检查全文中出现的所有段落。',
          },
          journal: {
            type: 'string',
            description:
              '目标期刊名、key 或缩写（如 Palaeontology、PE、Nature）。用于附加该期刊的字数/图表/参考文献上限与该刊专属规则；省略则只应用通用规则。',
          },
        },
        additionalProperties: false,
      },
      output: {
        schema: {
          type: 'object',
          properties: {
            ok: { type: 'boolean', description: '是否成功执行。' },
            error: { type: 'string', description: '失败原因。' },
            violations: { type: 'array', items: { type: 'object' }, description: '确定性违规。' },
            advice: { type: 'array', items: { type: 'object' }, description: '需人工确认的 manual 规则。' },
            summary: { type: 'object', description: '计数汇总。' },
          },
          required: ['ok', 'violations', 'advice', 'summary'],
        },
        render(args, value) {
          if (!value?.ok) return [text(`paper_check 未能执行：${value?.error ?? '未知错误'}`)];
          const summary = value.summary ?? {};
          const violations = value.violations ?? [];
          const shown = violations.slice(0, 40);
          const lines = [
            `**paper_check** — 硬性 ${summary.hard ?? 0} / 建议 ${summary.soft ?? 0} / 提示 ${summary.info ?? 0}（已评估 ${summary.checkedRules ?? 0} 条规则）`,
          ];
          lines.push(...journalNote(summary));
          for (const violation of shown) lines.push(...violationLines(violation));
          if (violations.length > shown.length) {
            lines.push(`…还有 ${violations.length - shown.length} 条同类违规，用 section= 缩小范围再看。`);
          }
          const advice = value.advice ?? [];
          if (advice.length > 0) {
            lines.push('', `另有 ${advice.length} 条需要人工确认的规则（manual，不可自动判定）：`);
            for (const entry of advice.slice(0, 12)) {
              lines.push(`- 💡 \`${entry.id}\` ${entry.title}：${entry.statement}`);
            }
          }
          return [text(lines.join('\n'))];
        },
      },
      execute(args, exec) {
        return Promise.resolve(runPaperCheck(args ?? {}, { cwd: cwdFor(exec) }));
      },
      presentCall(args) {
        return { card: 'generic', title: 'paper_check', kind: 'other', rawInput: args };
      },
      presentResult(args, result) {
        return { card: 'generic', title: 'paper_check', content: result?.content };
      },
    },
    {
      name: 'paper_rules',
      description:
        'paper_rules：检索地学 SCI 写作/图表/投稿规则库。用户问“摘要多少字”“图件 dpi 要求”“引用密度”“某期刊有什么硬规矩”或需要引用具体条款时调用，返回规则原文、级别与出处。传 journal=<目标期刊> 可追加该刊专属规则。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '关键词，匹配标题、条款、标签与修改建议，如 “图件 dpi”。' },
          section: {
            type: 'string',
            enum: SECTION_ENUM,
            description: '限定段落，如 abstract、figures。',
          },
          severity: {
            type: 'string',
            enum: ['hard', 'soft', 'info'],
            description: '限定严重级别。',
          },
          journal: {
            type: 'string',
            description:
              '目标期刊名、key 或缩写（如 Paleobiology、PE、ESR）。给出时在通用规则之外追加该刊专属规则；省略时只返回通用规则。',
          },
          limit: { type: 'integer', description: '返回条数上限，默认 40，最多 200。' },
        },
        additionalProperties: false,
      },
      output: {
        schema: {
          type: 'object',
          properties: {
            rules: { type: 'array', items: { type: 'object' }, description: '命中的规则。' },
            total: { type: 'number', description: '命中总数（未截断）。' },
          },
          required: ['rules', 'total'],
        },
        render(args, value) {
          const rules = value?.rules ?? [];
          if (rules.length === 0) return [text('paper_rules：没有命中任何规则。')];
          const shown = rules.slice(0, 20);
          const lines = [`**paper_rules** — 命中 ${value.total ?? rules.length} 条，返回 ${rules.length} 条`];
          if (value.journalKey) {
            lines.push(
              `目标期刊：${value.journalName ?? value.journalKey}（${value.journalKey}）——已含该刊专属规则。`,
            );
          } else if (value.journalUnknown) {
            lines.push('⚠️ 未识别的期刊名，只返回通用规则。');
          } else {
            lines.push('未指定目标期刊：只返回通用规则；传 journal=<期刊> 可追加该刊专属规则。');
          }
          for (const rule of shown) {
            const icon = SEVERITY_ICON[rule.severity] ?? '🔵';
            lines.push(`- ${icon} \`${rule.id}\` ${rule.title}（${rule.sections.join('/')}）`);
            if (rule.statement) lines.push(`  - ${rule.statement}`);
            if (rule.fix) lines.push(`  - 改法：${rule.fix}`);
          }
          if (rules.length > shown.length) {
            lines.push(`…还有 ${rules.length - shown.length} 条，用 query= 收窄关键词。`);
          }
          return [text(lines.join('\n'))];
        },
      },
      execute(args) {
        return Promise.resolve(runPaperRules(args ?? {}));
      },
      presentCall(args) {
        return { card: 'generic', title: 'paper_rules', kind: 'other', rawInput: args };
      },
      presentResult(args, result) {
        return { card: 'generic', title: 'paper_rules', content: result?.content };
      },
    },
    {
      name: 'paper_journals',
      description:
        'paper_journals：按主题匹配投稿期刊（地学/古生物 SCI）。用户问“投哪个期刊”“有哪些同方向期刊”“APC 大概多少”“开放获取有哪些”时调用，返回按相关度排序的期刊、影响因子、审稿周期与硬性上限。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '主题关键词，如 “三叠纪 牙形石”。' },
          field: { type: 'string', description: '学科领域过滤，如 “古生物”。' },
          openAccess: { type: 'boolean', description: '只保留开放获取期刊（或只保留非开放获取）。' },
          maxApc: { type: 'number', description: '只保留 APC 不超过该值的期刊。' },
        },
        additionalProperties: false,
      },
      output: {
        schema: {
          type: 'object',
          properties: {
            journals: { type: 'array', items: { type: 'object' }, description: '排序后的期刊。' },
            total: { type: 'number', description: '命中总数。' },
          },
          required: ['journals'],
        },
        render(args, value) {
          const journals = value?.journals ?? [];
          if (journals.length === 0) return [text('paper_journals：没有匹配的期刊。')];
          const lines = [`**paper_journals** — 匹配 ${value.total ?? journals.length} 本，返回 ${journals.length} 本`];
          for (const journal of journals) {
            const apc = typeof journal.apc === 'number' ? `APC $${journal.apc}` : 'APC 未知';
            const oa = journal.openAccess ? 'OA' : '非OA';
            const if_ = typeof journal.impactFactor === 'number' ? `IF ${journal.impactFactor}` : 'IF 未知';
            lines.push(
              `- **${journal.name}**（${journal.key}）${if_} · ${oa} · ${apc}${
                journal.reviewDays ? ` · 审稿 ${journal.reviewDays} 天` : ''
              }`,
            );
            if (journal.scope) lines.push(`  - ${journal.scope}`);
            if (journal.field?.length) lines.push(`  - 领域：${journal.field.join('、')}`);
          }
          return [text(lines.join('\n'))];
        },
      },
      execute(args) {
        return Promise.resolve(runPaperJournals(args ?? {}));
      },
      presentCall(args) {
        return { card: 'generic', title: 'paper_journals', kind: 'other', rawInput: args };
      },
      presentResult(args, result) {
        return { card: 'generic', title: 'paper_journals', content: result?.content };
      },
    },
    {
      name: 'paper_outline',
      description:
        'paper_outline：生成论文结构大纲或某一章节的全部硬要求。开始写一篇论文、需要目标期刊的章节顺序，或问“摘要要写哪几块”“方法部分要放什么”时调用。',
      parameters: {
        type: 'object',
        properties: {
          journal: { type: 'string', description: '期刊名或 key，如 Palaeontology；省略则给通用 SCI 结构。' },
          section: {
            type: 'string',
            enum: SECTION_ENUM,
            description: '给出时返回该段落适用的全部规则，而不是章节骨架。',
          },
        },
        additionalProperties: false,
      },
      output: {
        schema: {
          type: 'object',
          properties: {
            journal: { type: 'object', description: '期刊档案；未识别时为 null。' },
            sections: { type: 'array', items: { type: 'object' }, description: '章节骨架或段落规则。' },
            limits: { type: 'object', description: '期刊硬性上限。' },
            notes: { type: 'string', description: '注意事项。' },
          },
          required: ['sections'],
        },
        render(args, value) {
          const sections = value?.sections ?? [];
          if (sections.length === 0) return [text('paper_outline：没有可展示的结构。')];
          const header = value.journal ? `**${value.journal.name}** 结构大纲` : '**通用 SCI 结构大纲**';
          const lines = [header];
          for (const section of sections) {
            lines.push(`- ${section.title}（${section.key}）`);
            if (section.requirement) lines.push(`  - 要求：${section.requirement}`);
          }
          if (value.limits && Object.keys(value.limits).length > 0) {
            const limits = Object.entries(value.limits)
              .map(([key, limit]) => `${key}=${limit}`)
              .join('，');
            lines.push(`- 期刊上限：${limits}`);
          }
          if (value.notes) lines.push(`- 注意：${value.notes}`);
          return [text(lines.join('\n'))];
        },
      },
      execute(args) {
        return Promise.resolve(runPaperOutline(args ?? {}));
      },
      presentCall(args) {
        return { card: 'generic', title: 'paper_outline', kind: 'other', rawInput: args };
      },
      presentResult(args, result) {
        return { card: 'generic', title: 'paper_outline', content: result?.content };
      },
    },
    {
      name: 'paper_deai',
      description:
        'paper_deai：扫描正文里的 AI 套话句式并给出去 AI 化改写建议。用户提到“去 AI 味”“像 AI 写的”“润色去机器味”，或交稿前想自检文风时调用，返回命中句式、原因与替换建议以及 0–100 的文风分。',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: '待扫描的正文。' },
          path: { type: 'string', description: '待扫描的文件路径；相对路径按当前工作目录解析。' },
        },
        additionalProperties: false,
      },
      output: {
        schema: {
          type: 'object',
          properties: {
            hits: { type: 'array', items: { type: 'object' }, description: '命中的套话句式。' },
            score: { type: 'number', description: '0–100 的文风分，100 为干净。' },
            total: { type: 'number', description: '命中的句式种类数。' },
          },
          required: ['hits', 'score'],
        },
        render(args, value) {
          const hits = value?.hits ?? [];
          if (!value?.ok) return [text(`paper_deai 未能执行：${value?.error ?? '未知错误'}`)];
          if (hits.length === 0) return [text(`paper_deai：未发现 AI 套话句式，文风分 ${value.score}。`)];
          const lines = [`**paper_deai** — 文风分 ${value.score}/100，命中 ${hits.length} 类套话`];
          for (const hit of hits) {
            const icon = SEVERITY_ICON[hit.severity] ?? '🔵';
            lines.push(
              `- ${icon} \`${hit.id}\` ${hit.zh}${hit.en ? ` / ${hit.en}` : ''}（${hit.count} 次）`,
            );
            if (hit.matched) lines.push(`  - 命中：${hit.matched}`);
            if (hit.why) lines.push(`  - 原因：${hit.why}`);
            if (hit.suggestion) lines.push(`  - 改法：${hit.suggestion}`);
          }
          return [text(lines.join('\n'))];
        },
      },
      execute(args, exec) {
        return Promise.resolve(runPaperDeai(args ?? {}, { cwd: cwdFor(exec) }));
      },
      presentCall(args) {
        return { card: 'generic', title: 'paper_deai', kind: 'other', rawInput: args };
      },
      presentResult(args, result) {
        return { card: 'generic', title: 'paper_deai', content: result?.content };
      },
    },
  ];
}

/** The meta payload shared by the tool layer and the panel API. */
export function metaPayload() {
  return meta();
}
