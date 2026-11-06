// The five slash commands.
//
// A command is a HUMAN affordance: it renders a compact Markdown report and
// never talks to the model. The commands reuse the very same runner
// functions as the tools and the panel API, so a number shown in the
// composer is the number the model would get.

import { readFileSync } from 'node:fs';

import {
  runPaperCheck,
  runPaperDeai,
  runPaperJournals,
  runPaperOutline,
  runPaperRules,
  resolvePath,
} from './tools.mjs';
import { runPaperAnalyze } from './tool-analyze.mjs';

const DOCUMENT_EXT = /\.(md|markdown|txt|text|tex|docx|doc|rtf|html?|rst|org|csv|json|ipynb)$/iu;

const SEVERITY_ICON = { hard: '🔴', soft: '🟡', info: '🔵' };

/** Extract one `key=value` option from a command's raw input. */
export function extractOption(raw, name) {
  const pattern = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s]+))`, 'iu');
  const match = pattern.exec(raw);
  if (!match) return { value: null, rest: raw };
  const value = match[1] ?? match[2] ?? match[3] ?? '';
  const before = raw.slice(0, match.index);
  const after = raw.slice(match.index + match[0].length);
  return { value: value.trim(), rest: `${before}${after}`.trim() };
}

/** The option names every command understands. */
const OPTION_NAMES = ['query', 'section', 'severity', 'journal', 'field', 'openAccess', 'maxApc'];

/**
 * Pull every `key=value` option out of a raw command input. Each option is
 * removed from the remainder, so the rest is the plain body or path.
 */
export function parseOptions(raw) {
  const options = {};
  let rest = String(raw ?? '');
  for (const name of OPTION_NAMES) {
    const extracted = extractOption(rest, name);
    if (extracted.value !== null) options[name] = extracted.value;
    rest = extracted.rest;
  }
  return { options, rest };
}

/** Does this raw input look like a file path rather than pasted prose? */
export function looksLikePath(value) {
  const text = String(value ?? '').trim();
  if (!text || text.includes('\n') || /\s/u.test(text)) return false;
  if (/[\u3400-\u4DBF\u4E00-\u9FFF]/u.test(text)) return false;
  if (DOCUMENT_EXT.test(text)) return true;
  return /^[A-Za-z]:[\\/]/u.test(text) || text.startsWith('/') || text.startsWith('./') || text.startsWith('../');
}

async function readAttachedText(invocation, getAttachments) {
  const blocks = Array.isArray(invocation?.attachments) ? invocation.attachments : [];
  const fileBlock = blocks.find((block) => block && block.type === 'file' && block.attachment);
  if (!fileBlock) return null;
  const service = typeof getAttachments === 'function' ? getAttachments() : undefined;
  if (!service) {
    return { error: '当前环境无法读取附件，请在命令后直接给出文件路径。' };
  }
  const ref = fileBlock.attachment;
  try {
    if (typeof service.readFileStream === 'function') {
      const chunks = [];
      for await (const chunk of service.readFileStream(ref, invocation.signal)) {
        chunks.push(Buffer.from(chunk));
      }
      return { text: Buffer.concat(chunks).toString('utf8') };
    }
    if (typeof service.readFile === 'function') {
      const out = await service.readFile(ref, invocation.signal);
      if (typeof out === 'string') return { text: out };
      if (out && typeof out.text === 'string') return { text: out.text };
      if (out && out.data) return { text: Buffer.from(out.data).toString('utf8') };
    }
    if (typeof service.fileHostPath === 'function') {
      const hostPath = service.fileHostPath(ref);
      if (hostPath) return { text: readFileSync(hostPath, 'utf8') };
    }
  } catch (error) {
    return { error: `读取附件失败：${error?.message ?? error}` };
  }
  return { error: '当前环境无法读取附件，请在命令后直接给出文件路径。' };
}

function table(headers, rows) {
  const lines = [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`];
  for (const row of rows) lines.push(`| ${row.join(' | ')} |`);
  return lines.join('\n');
}

function errorResult(text) {
  return { kind: 'error', text };
}

function success(text) {
  return { kind: 'success', text };
}

/**
 * Build the five command definitions.
 * @param {object} options
 * @param {(agent: unknown) => string} [options.resolveCwd]
 * @param {() => unknown} [options.getAttachments]  the host `attachments` service
 */
export function createCommandDefinitions(options = {}) {
  const resolveCwd =
    typeof options.resolveCwd === 'function' ? options.resolveCwd : () => process.cwd();
  const getAttachments = typeof options.getAttachments === 'function' ? options.getAttachments : () => undefined;
  const cwdFor = (invocation) => {
    try {
      const value = resolveCwd(invocation?.agent);
      return typeof value === 'string' && value.length > 0 ? value : process.cwd();
    } catch {
      return process.cwd();
    }
  };

  /** Read the text a command should work on: attachment → path → pasted text. */
  const resolveInput = async (invocation, raw) => {
    const attached = await readAttachedText(invocation, getAttachments);
    if (attached) return attached;
    if (looksLikePath(raw)) {
      const target = resolvePath(raw, cwdFor(invocation));
      try {
        return { text: readFileSync(target, 'utf8'), path: target };
      } catch (error) {
        return { error: `无法读取文件「${raw}」：${error?.message ?? error}` };
      }
    }
    if (raw.trim().length > 0) return { text: raw, path: null };
    return { error: '请在命令后给出文件路径，或直接粘贴正文。' };
  };

  return [
    {
      name: 'paper-check',
      description: '按 SCI 硬规则检查论文正文（可附文件或粘贴正文，支持 journal=期刊名）',
      input: {
        hint: 'path 或直接粘贴正文（可加 "journal=Palaeontology"）',
        attachments: true,
      },
      handler: async (invocation) => {
        const { options, rest } = parseOptions(String(invocation?.rawInput ?? '').trim());
        const source = await resolveInput(invocation, rest);
        if (source.error) return errorResult(source.error);
        const result = runPaperCheck(
          {
            text: source.text,
            section: options.section ?? undefined,
            journal: options.journal ?? undefined,
          },
          { cwd: cwdFor(invocation) },
        );
        if (!result.ok) return errorResult(result.error);
        const summary = result.summary;
        const lines = [
          `**paper-check** — 硬性 ${summary.hard} / 建议 ${summary.soft} / 提示 ${summary.info}（已评估 ${summary.checkedRules} 条规则，manual ${summary.manualRules} 条）`,
        ];
        if (summary.journalUnknown) {
          lines.push(`⚠️ 未识别的期刊名「${summary.journalQuery ?? ''}」，只应用了通用规则。`);
        } else if (summary.journalKey) {
          lines.push(
            `目标期刊：${summary.journalName ?? summary.journalKey}（${summary.journalKey}）——${summary.skippedJournalRules} 条其他期刊的专属规则未应用。`,
          );
        } else if (summary.skippedJournalRules > 0) {
          lines.push(`未指定目标期刊，跳过了 ${summary.skippedJournalRules} 条期刊专属规则；传 journal=<期刊> 可启用。`);
        }
        if (result.violations.length === 0) {
          lines.push('', '未发现确定性违规。');
        } else {
          lines.push(
            '',
            table(
              ['级别', '规则', '段落', '实测', '期望', '修改'],
              result.violations.map((violation) => [
                `${SEVERITY_ICON[violation.severity] ?? '🔵'} ${violation.severity}`,
                `\`${violation.id}\` ${violation.title}`,
                violation.section,
                violation.actual ?? '—',
                violation.expected ?? '—',
                violation.fix || '—',
              ]),
            ),
          );
        }
        if (result.advice.length > 0) {
          lines.push('', `**需人工确认（${result.advice.length} 条）**`);
          for (const entry of result.advice.slice(0, 20)) {
            lines.push(`- \`${entry.id}\` ${entry.title}：${entry.statement}`);
          }
        }
        if (result.truncated) lines.push('', '（结果已截断，可用 section= 缩小范围。）');
        return success(lines.join('\n'));
      },
    },
    {
      name: 'paper-rules',
      description: '检索 SCI 写作/图表/投稿规则库',
      input: { hint: '关键词，例如 "图件 dpi" 或 "摘要 字数"；可加 "journal=Paleobiology"' },
      handler: async (invocation) => {
        const { options, rest } = parseOptions(String(invocation?.rawInput ?? '').trim());
        const result = runPaperRules({
          query: options.query ?? rest,
          section: options.section ?? undefined,
          severity: options.severity ?? undefined,
          journal: options.journal ?? undefined,
        });
        if (result.rules.length === 0) return success('paper-rules：没有命中的规则。');
        const lines = [`**paper-rules** — 命中 ${result.total} 条，返回 ${result.rules.length} 条`];
        if (result.journalKey) {
          lines.push(`目标期刊：${result.journalName ?? result.journalKey}（${result.journalKey}）——已含该刊专属规则。`);
        } else if (result.journalUnknown) {
          lines.push('⚠️ 未识别的期刊名，只返回通用规则。');
        } else {
          lines.push('未指定目标期刊：只返回通用规则；传 journal=<期刊> 可追加该刊专属规则。');
        }
        lines.push(
          '',
          table(
            ['级别', '规则', '段落', '条款'],
            result.rules.map((rule) => [
              `${SEVERITY_ICON[rule.severity] ?? '🔵'} ${rule.severity}`,
              `\`${rule.id}\` ${rule.title}`,
              rule.sections.join('/'),
              rule.statement,
            ]),
          ),
        );
        return success(lines.join('\n'));
      },
    },
    {
      name: 'paper-journals',
      description: '按主题匹配投稿期刊并给出硬性上限',
      input: { hint: '主题，例如 "三叠纪 牙形石 系统分类"' },
      handler: async (invocation) => {
        const { options, rest } = parseOptions(String(invocation?.rawInput ?? '').trim());
        const result = runPaperJournals({
          query: options.query ?? rest,
          field: options.field ?? undefined,
          openAccess:
            options.openAccess === undefined
              ? undefined
              : /^(1|true|yes|是)$/iu.test(options.openAccess),
          maxApc: options.maxApc === undefined ? undefined : Number(options.maxApc),
        });
        if (result.journals.length === 0) return success('paper-journals：没有匹配的期刊。');
        const lines = [`**paper-journals** — 匹配 ${result.total} 本，返回 ${result.journals.length} 本`];
        lines.push(
          '',
          table(
            ['期刊', 'IF', 'OA', 'APC', '审稿', '领域'],
            result.journals.map((journal) => [
              `**${journal.name}**`,
              journal.impactFactor ?? '—',
              journal.openAccess ? '是' : '否',
              journal.apc ?? '—',
              journal.reviewDays ?? '—',
              (journal.field ?? []).join('、'),
            ]),
          ),
        );
        return success(lines.join('\n'));
      },
    },
    {
      name: 'paper-outline',
      description: '生成目标期刊的论文结构大纲或某段落的全部要求',
      input: { hint: '期刊名，可选 "section=abstract"' },
      handler: async (invocation) => {
        const { options, rest } = parseOptions(String(invocation?.rawInput ?? '').trim());
        const outline = runPaperOutline({
          journal: options.journal ?? rest,
          section: options.section ?? undefined,
        });
        if (outline.sections.length === 0) return success('paper-outline：没有可展示的结构。');
        const lines = [
          outline.journal
            ? `**${outline.journal.name}**（${outline.journal.key}）结构大纲`
            : '**通用 SCI 结构大纲**',
        ];
        lines.push(
          '',
          table(
            ['段落', '键', '要求'],
            outline.sections.map((entry) => [entry.title, entry.key, entry.requirement || '—']),
          ),
        );
        if (outline.limits && Object.keys(outline.limits).length > 0) {
          const limits = Object.entries(outline.limits)
            .map(([key, limit]) => `${key}=${limit}`)
            .join('，');
          lines.push('', `**期刊上限**：${limits}`);
        }
        if (outline.notes) lines.push('', `> ${outline.notes}`);
        return success(lines.join('\n'));
      },
    },
    {
      name: 'paper-deai',
      description: '扫描正文里的 AI 套话句式并给出去 AI 化改写建议',
      input: { hint: 'path 或直接粘贴正文', attachments: true },
      handler: async (invocation) => {
        const raw = String(invocation?.rawInput ?? '').trim();
        const source = await resolveInput(invocation, raw);
        if (source.error) return errorResult(source.error);
        const result = runPaperDeai({ text: source.text }, { cwd: cwdFor(invocation) });
        if (!result.ok) return errorResult(result.error);
        if (result.hits.length === 0) return success(`paper-deai：未发现 AI 套话句式，文风分 ${result.score}。`);
        const lines = [`**paper-deai** — 文风分 ${result.score}/100，命中 ${result.hits.length} 类套话`];
        lines.push(
          '',
          table(
            ['级别', '句式', '次数', '命中', '改法'],
            result.hits.map((hit) => [
              `${SEVERITY_ICON[hit.severity] ?? '🔵'} ${hit.severity}`,
              `\`${hit.id}\` ${hit.zh}${hit.en ? ` / ${hit.en}` : ''}`,
              hit.count,
              hit.matched,
              hit.suggestion ?? '—',
            ]),
          ),
        );
        return success(lines.join('\n'));
      },
    },
    {
      name: 'paper-analyze',
      description:
        '把一篇论文按段落拆开，逐段体检并给出针对性的修改意见（可附文件或粘贴正文，支持 journal=期刊名）',
      input: {
        hint: 'path 或直接粘贴正文（可加 "journal=Palaeontology"）',
        attachments: true,
      },
      handler: async (invocation) => {
        const { options, rest } = parseOptions(String(invocation?.rawInput ?? '').trim());
        const source = await resolveInput(invocation, rest);
        if (source.error) return errorResult(source.error);
        const result = runPaperAnalyze(
          {
            path: source.path ?? undefined,
            text: source.path ? undefined : source.text,
            journal: options.journal ?? undefined,
            section: options.section ?? undefined,
          },
          { cwd: cwdFor(invocation) },
        );
        if (!result.ok) return errorResult(result.error);
        const summary = result.summary ?? {};
        const lines = [
          `**paper-analyze** — ${result.file?.name ?? '正文'}：${summary.total ?? 0} 条（🔴 ${summary.hard ?? 0} / 🟡 ${summary.soft ?? 0} / 🔵 ${summary.info ?? 0}），共 ${summary.sections ?? 0} 段，去 AI 分 ${result.deai?.score ?? 100}`,
        ];
        if (summary.journalUnknown) {
          lines.push(`⚠️ 未识别的期刊名「${summary.journalQuery ?? ''}」，只应用了通用规则。`);
        } else if (summary.journalKey) {
          lines.push(
            `目标期刊：${summary.journalName ?? summary.journalKey}（${summary.journalKey}）——${summary.skippedJournalRules} 条其他期刊的专属规则未应用。`,
          );
        } else if (summary.skippedJournalRules > 0) {
          lines.push(`未指定目标期刊，跳过了 ${summary.skippedJournalRules} 条期刊专属规则；传 journal=<期刊> 可启用。`);
        }
        for (const entry of result.report ?? []) {
          lines.push('', `### ${entry.title}（${entry.words ?? 0} 词）`);
          const violations = entry.violations ?? [];
          if (violations.length === 0) {
            lines.push('未发现确定性违规。');
          } else {
            lines.push(
              '',
              table(
                ['级别', '规则', '实测', '期望', '修改', '出处'],
                violations.map((violation) => [
                  `${SEVERITY_ICON[violation.severity] ?? '🔵'} ${violation.severity}`,
                  `\`${violation.id}\` ${violation.title}`,
                  violation.actual ?? '—',
                  violation.expected ?? '—',
                  violation.fix ?? '—',
                  violation.source?.file
                    ? `${violation.source.file}:${violation.source.line ?? 0}`
                    : '—',
                ]),
              ),
            );
          }
          const advice = entry.advice ?? [];
          if (advice.length > 0) {
            lines.push('', `另有 ${advice.length} 条需人工确认的规则（manual，不可自动判定）：`);
            for (const item of advice.slice(0, 6)) {
              lines.push(`- 💡 \`${item.id}\` ${item.title}`);
            }
          }
        }
        const hits = result.deai?.hits ?? [];
        if (hits.length > 0) {
          lines.push('', `**去 AI 化** — ${hits.length} 类套话：`);
          lines.push(
            table(
              ['级别', '句式', '次数', '命中', '改法'],
              hits.slice(0, 10).map((hit) => [
                `${SEVERITY_ICON[hit.severity] ?? '🔵'} ${hit.severity}`,
                `\`${hit.id}\` ${hit.zh}${hit.en ? ` / ${hit.en}` : ''}`,
                hit.count ?? 1,
                hit.matched ?? '—',
                hit.suggestion ?? '—',
              ]),
            ),
          );
        }
        return success(lines.join('\n'));
      },
    },
  ];
}
