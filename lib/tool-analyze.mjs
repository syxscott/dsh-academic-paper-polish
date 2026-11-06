// The `paper_analyze` tool — per-section analysis of a manuscript.
//
// It is a separate module (not part of `tools.mjs`) because
// `./analyze.mjs` already imports `./tools.mjs` for the de-AI scan; keeping
// the manuscript reader out of that file avoids an import cycle.
//
// The plain `runPaperAnalyze` function is shared by the tool, the
// `/paper-analyze` command and the panel API, so the agent and the browser
// always see the same numbers.

import { isAbsolute, join, resolve } from 'node:path';

import { analyzeManuscript } from './analyze.mjs';
import { analyzeFile } from './manuscript.mjs';
import { assertInsideCwd } from './session.mjs';
import { resolvePath } from './tools.mjs';

/** Hard caps — one tool result must never carry a whole manuscript. */
export const ANALYZE_LIMITS = Object.freeze({
  violationsPerSection: 12,
  sections: 24,
  advicePerSection: 6,
  hits: 20,
});

const SEVERITY_ICON = { hard: '🔴', soft: '🟡', info: '🔵' };

function text(value) {
  return { type: 'text', text: String(value) };
}

/**
 * Analyses a manuscript and returns a sliced, per-section report.
 *
 * @param {{path?: string, text?: string, journal?: string, section?: string}} [args]
 * @param {{cwd?: string}} [options]
 */
export function runPaperAnalyze(args = {}, options = {}) {
  const cwd = typeof options.cwd === 'string' && options.cwd ? options.cwd : process.cwd();
  const rawPath = String(args.path ?? '').trim();
  const body = String(args.text ?? '');

  let analysis;
  try {
    if (rawPath) {
      const target = isAbsolute(rawPath) ? rawPath : resolve(cwd, rawPath);
      // The panel route may only read inside the session's working directory;
      // the tool must not be a way around that.
      assertInsideCwd(cwd, target);
      analysis = analyzeFile(target, { journal: args.journal, section: args.section });
    } else if (body.trim()) {
      analysis = analyzeManuscript({
        text: body,
        format: 'txt',
        path: '',
        name: '(inline text)',
        bytes: body.length,
        journal: args.journal,
        section: args.section,
      });
    } else {
      return {
        ok: false,
        error: '需要 path 或 text 之一',
        file: null,
        report: [],
        deai: { score: 100, hits: [], total: 0 },
        summary: { total: 0, hard: 0, soft: 0, info: 0, sections: 0 },
      };
    }
  } catch (error) {
    return {
      ok: false,
      error: String(error?.message ?? error),
      status: typeof error?.status === 'number' ? error.status : undefined,
      file: null,
      report: [],
      deai: { score: 100, hits: [], total: 0 },
      summary: { total: 0, hard: 0, soft: 0, info: 0, sections: 0 },
    };
  }

  const report = [];
  for (const entry of analysis.report ?? []) {
    const violations = (entry.violations ?? []).slice(0, ANALYZE_LIMITS.violationsPerSection);
    const advice = (entry.advice ?? []).slice(0, ANALYZE_LIMITS.advicePerSection);
    report.push({
      section: entry.section,
      title: entry.title,
      words: entry.words,
      summary: entry.summary,
      violations,
      advice,
      truncated: (entry.violations ?? []).length > violations.length,
    });
    if (report.length >= ANALYZE_LIMITS.sections) break;
  }

  const deai = analysis.deai ?? { score: 100, hits: [], total: 0 };
  return {
    ok: true,
    file: analysis.file ?? null,
    report,
    deai: { score: deai.score, total: deai.total, hits: (deai.hits ?? []).slice(0, ANALYZE_LIMITS.hits) },
    summary: analysis.summary ?? { total: 0, hard: 0, soft: 0, info: 0, sections: 0 },
  };
}

/** The model-facing tool definition. */
export function createAnalyzeToolDefinitions(options = {}) {
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
      name: 'paper_analyze',
      description:
        'paper_analyze：把一篇论文按段落拆开，逐段体检并给出针对性的修改意见。用户给了论文文件路径（.docx/.tex/.md/.txt/.rtf）并说“帮我看看这篇稿子”“逐段审一下”“给修改意见”时调用；它先切出摘要/引言/方法/结果/讨论/结论，再对每段单独跑硬规则，返回每段各自的违规、修复建议与出处，外加整篇的去 AI 化得分。传 journal=<目标期刊> 可启用该刊专属规则。',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description:
              '论文文件路径（.docx/.tex/.md/.txt/.rtf）；相对路径按当前工作目录解析。与 text 同时给出时以 path 为准。',
          },
          text: {
            type: 'string',
            description: '直接给出的论文正文；没有文件时用它代替。',
          },
          journal: {
            type: 'string',
            description:
              '目标期刊名、key 或缩写（如 Palaeontology、PE、Nature）。用于附加该期刊的字数/图表上限与专属规则；省略则只应用通用规则。',
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
            file: { type: 'object', description: '被分析的稿件信息（路径 / 格式 / 各段字数）。' },
            report: { type: 'array', items: { type: 'object' }, description: '逐段的体检结果。' },
            deai: { type: 'object', description: '整篇的去 AI 化得分与命中。' },
            summary: { type: 'object', description: '计数汇总。' },
          },
          required: ['ok', 'report', 'deai', 'summary'],
        },
        render(args, value) {
          if (!value?.ok) return [text(`paper_analyze 未能执行：${value?.error ?? '未知错误'}`)];
          const summary = value.summary ?? {};
          const file = value.file ?? {};
          const lines = [
            `**paper_analyze** — ${file.name ?? '正文'}：${summary.total ?? 0} 条（🔴 ${summary.hard ?? 0} / 🟡 ${summary.soft ?? 0} / 🔵 ${summary.info ?? 0}），共 ${summary.sections ?? 0} 段，去 AI 分 ${value.deai?.score ?? 100}`,
          ];
          if (summary.skippedJournalRules > 0) {
            lines.push(
              `未指定目标期刊，跳过了 ${summary.skippedJournalRules} 条期刊专属规则；传 journal=<期刊> 可启用。`,
            );
          }
          for (const entry of value.report ?? []) {
            lines.push('', `### ${entry.title}（${entry.words ?? 0} 词）`);
            const violations = entry.violations ?? [];
            if (violations.length === 0) {
              lines.push('- ✅ 未发现硬性违规');
            } else {
              for (const violation of violations) {
                const icon = SEVERITY_ICON[violation.severity] ?? '🔵';
                lines.push(`- ${icon} \`${violation.id}\` ${violation.title}`);
                if (violation.expected) {
                  lines.push(
                    `  - 期望：${violation.expected}${violation.actual !== undefined ? `　实际：${violation.actual}` : ''}`,
                  );
                }
                if (violation.fix) lines.push(`  - 修复建议：${violation.fix}`);
                if (violation.source?.file) {
                  lines.push(`  - 出处：${violation.source.file}:${violation.source.line ?? 0}`);
                }
              }
              if (entry.truncated) lines.push(`  - …本段还有更多同类违规`);
            }
            const advice = entry.advice ?? [];
            if (advice.length > 0) {
              lines.push(`  - 💡 另有 ${advice.length} 条需人工确认的规则：`);
              for (const item of advice.slice(0, 4)) {
                lines.push(`    - \`${item.id}\` ${item.title}`);
              }
            }
          }
          const hits = value.deai?.hits ?? [];
          if (hits.length > 0) {
            lines.push('', `**去 AI 化** — ${hits.length} 类套话：`);
            for (const hit of hits.slice(0, 8)) {
              lines.push(`- ${SEVERITY_ICON[hit.severity] ?? '🔵'} ${hit.zh}（${hit.count ?? 1} 次）— ${hit.suggestion ?? ''}`);
            }
          }
          return [text(lines.join('\n'))];
        },
      },
      execute(args, exec) {
        return Promise.resolve(runPaperAnalyze(args ?? {}, { cwd: cwdFor(exec) }));
      },
      presentCall(args) {
        return { card: 'generic', title: 'paper_analyze', kind: 'other', rawInput: args };
      },
      presentResult(args, result) {
        return { card: 'generic', title: 'paper_analyze', content: result?.content };
      },
    },
  ];
}
