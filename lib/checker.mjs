// The deterministic rule engine.
//
// `checkText` executes the machine-readable rules of `data/rules/*.json` — the
// eight `check.type` kinds of data/SCHEMA.md — plus the `limits` of a target
// journal. `manual` rules never fail automatically: they are reported in a
// separate `advice` list so the prose in the manual never disappears again.
//
// The engine is pure: same text + same options → same result, no I/O.

import { allRules, findJournal } from './data.mjs';
import { clip, countCitations, countWords, splitSections } from './text.mjs';

/** Human label for every journal limit key. */
const LIMIT_LABELS = {
  abstractWords: '摘要字数上限',
  titleWords: '标题词数上限',
  keywords: '关键词数量上限',
  references: '参考文献数量上限',
  figures: '图件数量上限',
  tables: '表格数量上限',
  dpi: '图片分辨率下限',
};

const SEVERITIES = ['hard', 'soft', 'info'];

function compile(pattern, flags) {
  if (typeof pattern !== 'string' || pattern.length === 0) return null;
  try {
    return new RegExp(pattern, typeof flags === 'string' ? flags : '');
  } catch {
    return null;
  }
}

function numberOr(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function rangeText(min, max) {
  if (min !== null && max !== null) return `${min}-${max}`;
  if (min !== null) return `≥ ${min}`;
  if (max !== null) return `≤ ${max}`;
  return '';
}

function countMatches(body, pattern, flags) {
  const base = typeof flags === 'string' ? flags : '';
  const re = compile(pattern, base.includes('g') ? base : `${base}g`);
  if (!re) return 0;
  return body.match(re)?.length ?? 0;
}

/** Every capture-group-1 number of `pattern` inside `body`. */
function captureNumbers(body, pattern, flags) {
  const base = typeof flags === 'string' ? flags : '';
  const re = compile(pattern, base.includes('g') ? base : `${base}g`);
  if (!re) return [];
  const found = [];
  let match = re.exec(body);
  while (match !== null) {
    const value = Number(match[1]);
    if (Number.isFinite(value)) found.push({ value, text: String(match[0]) });
    if (match.index === re.lastIndex) re.lastIndex += 1;
    match = re.exec(body);
  }
  return found;
}

/**
 * Run one non-manual check against one section body.
 * @returns {null | { matched?: string, actual?: number|string, expected?: string, violations?: object[] }}
 */
function runCheck(type, params, body, stats) {
  switch (type) {
    case 'forbidden': {
      const patterns = Array.isArray(params.patterns) ? params.patterns : [];
      for (const pattern of patterns) {
        const re = compile(pattern, params.flags);
        if (!re) continue;
        const match = re.exec(body);
        if (match) {
          const hit = clip(match[0], 160);
          return { matched: hit, actual: hit, expected: `不得出现「${clip(pattern, 80)}」` };
        }
      }
      return null;
    }
    case 'required': {
      const patterns = Array.isArray(params.patterns) ? params.patterns : [];
      const missing = [];
      for (const pattern of patterns) {
        const re = compile(pattern, params.flags);
        if (!re) continue;
        if (!re.test(body)) missing.push(pattern);
      }
      if (missing.length === 0) return null;
      return {
        violations: missing.map((pattern) => ({
          matched: clip(pattern, 120),
          expected: `必须出现：${clip(pattern, 120)}`,
        })),
      };
    }
    case 'count': {
      const count = countMatches(body, params.pattern, params.flags);
      const min = numberOr(params.min, null);
      const max = numberOr(params.max, null);
      if (min !== null && count < min) return { actual: count, expected: `≥ ${min} 次` };
      if (max !== null && count > max) return { actual: count, expected: `≤ ${max} 次` };
      return null;
    }
    case 'wordCount': {
      const min = numberOr(params.min, null);
      const max = numberOr(params.max, null);
      if (min !== null && stats.words < min) {
        return { actual: stats.words, expected: `≥ ${min} 词` };
      }
      if (max !== null && stats.words > max) {
        return { actual: stats.words, expected: `≤ ${max} 词` };
      }
      return null;
    }
    case 'numeric': {
      const min = numberOr(params.min, null);
      const max = numberOr(params.max, null);
      for (const entry of captureNumbers(body, params.pattern, params.flags)) {
        const below = min !== null && entry.value < min;
        const above = max !== null && entry.value > max;
        if (below || above) {
          return {
            actual: entry.value,
            matched: clip(entry.text, 160),
            expected: rangeText(min, max),
          };
        }
      }
      return null;
    }
    case 'citationDensity': {
      // Too short a paragraph cannot carry a meaningful density.
      if (stats.words < 30) return null;
      const density = (stats.citations / stats.words) * 1000;
      const min = numberOr(params.min, null);
      const max = numberOr(params.max, null);
      if (min !== null && density < min) {
        return { actual: round1(density), expected: `≥ ${min} 次/千字` };
      }
      if (max !== null && density > max) {
        return { actual: round1(density), expected: `≤ ${max} 次/千字` };
      }
      return null;
    }
    default:
      return null;
  }
}

/** Verify that the listed sections appear in the given order. */
function runSectionOrder(params, sections) {
  const order = Array.isArray(params.order) ? params.order.filter((k) => typeof k === 'string') : [];
  if (order.length === 0) return null;
  const seen = sections.map((section) => section.key);
  const positions = order.map((key) => seen.indexOf(key));
  const missing = order.filter((_, index) => positions[index] === -1);
  if (missing.length > 0) {
    return {
      actual: seen.join(' → ') || '(空文档)',
      expected: `应依次出现：${order.join(' → ')}`,
      matched: `缺少段落：${missing.join('、')}`,
    };
  }
  for (let index = 1; index < positions.length; index += 1) {
    if (positions[index] < positions[index - 1]) {
      return {
        actual: seen.join(' → '),
        expected: `应依次出现：${order.join(' → ')}`,
        matched: `${order[index - 1]} 出现在 ${order[index]} 之后`,
      };
    }
  }
  return null;
}

function makeViolation(rule, section, detail) {
  const violation = {
    id: rule.id,
    ruleId: rule.id,
    title: rule.title ?? rule.id,
    severity: SEVERITIES.includes(rule.severity) ? rule.severity : 'info',
    section,
    statement: clip(rule.statement ?? '', 400),
    fix: clip(rule.fix ?? '', 400),
    source: rule.source ?? {},
  };
  if (detail?.matched !== undefined) violation.matched = detail.matched;
  if (detail?.actual !== undefined) violation.actual = detail.actual;
  if (detail?.expected !== undefined) violation.expected = detail.expected;
  return violation;
}

function countKeywords(body) {
  return String(body ?? '')
    .split(/[;；,，、\n]+/u)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0).length;
}

function countReferences(body) {
  const markers = new Set();
  for (const match of String(body ?? '').matchAll(/\[(\d+(?:\s*[-–,]\s*\d+)*)\]/gu)) {
    for (const part of match[1].split(/[,–-]/u)) {
      const value = Number(part.trim());
      if (Number.isFinite(value)) markers.add(value);
    }
  }
  if (markers.size > 0) return markers.size;
  return String(body ?? '')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0).length;
}

function countLabelled(body, pattern) {
  const numbers = new Set();
  const re = compile(pattern, 'gi');
  if (!re) return 0;
  for (const match of String(body ?? '').matchAll(re)) {
    const value = Number(match[1]);
    if (Number.isFinite(value)) numbers.add(value);
  }
  return numbers.size;
}

/** Apply a journal's `limits` as extra hard checks. */
function applyJournalLimits(journal, source, sections, violations) {
  const limits = journal.limits ?? {};
  if (!limits || typeof limits !== 'object') return;
  const key = journal.key ?? journal.name ?? 'journal';
  const byKey = new Map(sections.map((section) => [section.key, section]));

  const push = (limit, section, actual, expected, fix) => {
    violations.push({
      id: `JOURNAL-${key}-${limit}`,
      ruleId: `JOURNAL-${key}-${limit}`,
      title: `${journal.name ?? key}：${LIMIT_LABELS[limit] ?? limit}`,
      severity: 'hard',
      section,
      statement: `${journal.name ?? key} 规定 ${LIMIT_LABELS[limit] ?? limit} = ${expected}。`,
      fix: fix ?? `按 ${journal.name ?? key} 的 ${LIMIT_LABELS[limit] ?? limit} 调整到 ${expected} 以内。`,
      source: journal.source ?? {},
      actual,
      expected,
    });
  };

  const abstractWords = numberOr(limits.abstractWords, null);
  if (abstractWords !== null) {
    const section = byKey.get('abstract');
    if (section) {
      const words = countWords(section.body);
      if (words > abstractWords) {
        push('abstractWords', 'abstract', words, `≤ ${abstractWords} 词`, '压缩摘要到期刊上限以内。');
      }
    }
  }

  const titleWords = numberOr(limits.titleWords, null);
  if (titleWords !== null) {
    const section = byKey.get('title');
    if (section) {
      const words = countWords(section.body);
      if (words > titleWords) {
        push('titleWords', 'title', words, `≤ ${titleWords} 词`, '缩短标题到期刊上限以内。');
      }
    }
  }

  const keywords = numberOr(limits.keywords, null);
  if (keywords !== null) {
    const section = byKey.get('keywords');
    if (section) {
      const count = countKeywords(section.body);
      if (count > keywords) {
        push('keywords', 'keywords', count, `≤ ${keywords} 个`, '删除多余关键词。');
      }
    }
  }

  const references = numberOr(limits.references, null);
  if (references !== null) {
    const section = byKey.get('references');
    if (section) {
      const count = countReferences(section.body);
      if (count > references) {
        push('references', 'references', count, `≤ ${references} 条`, '精简参考文献列表。');
      }
    }
  }

  const figures = numberOr(limits.figures, null);
  if (figures !== null) {
    const count = countLabelled(source, '(?:figure|fig\\.?|图)\\s*(\\d+)');
    if (count > figures) {
      push('figures', 'figures', count, `≤ ${figures} 幅`, '合并或移入补充材料以减少图件。');
    }
  }

  const tables = numberOr(limits.tables, null);
  if (tables !== null) {
    const count = countLabelled(source, '(?:table|tab\\.?|表)\\s*(\\d+)');
    if (count > tables) {
      push('tables', 'tables', count, `≤ ${tables} 个`, '合并或移入补充材料以减少表格。');
    }
  }

  const dpi = numberOr(limits.dpi, null);
  if (dpi !== null) {
    for (const match of String(source ?? '').matchAll(/(\d+(?:\.\d+)?)\s*dpi/giu)) {
      const value = Number(match[1]);
      if (Number.isFinite(value) && value < dpi) {
        push('dpi', 'figures', value, `≥ ${dpi} dpi`, '按期刊要求重新导出图片分辨率。');
        break;
      }
    }
  }
}

/** An empty summary — used when a tool call cannot run at all. */
export function emptySummary() {
  return {
    total: 0,
    hard: 0,
    soft: 0,
    info: 0,
    bySection: {},
    checkedRules: 0,
    manualRules: 0,
    pass: true,
    skippedJournalRules: 0,
    journalKey: null,
    journalName: null,
    journalQuery: null,
    journalUnknown: false,
  };
}

/**
 * Execute the rule engine.
 *
 * A rule may be scoped to specific target journals (`rule.journals`). Such a
 * rule only applies when the target journal matches; with no target — or with
 * an unrecognised one — it is skipped and counted, never applied blindly.
 *
 * @param {string} text             the manuscript text
 * @param {object} options
 * @param {string} [options.section]  evaluate only this section
 * @param {string} [options.journal]  add this journal's `limits` and rules
 * @returns {{ violations: object[], advice: object[], summary: object, sections: object[] }}
 */
export function checkText(text, options = {}) {
  const source = String(text ?? '');
  const requested = options.section ? String(options.section) : null;
  const sections = splitSections(source);
  const byKey = new Map(sections.map((section) => [section.key, section]));

  const violations = [];
  const advice = [];
  let checkedRules = 0;
  let manualRules = 0;
  let skippedJournalRules = 0;

  const journalQuery = options.journal ? String(options.journal).trim() : '';
  const journal = journalQuery ? findJournal(journalQuery) : null;
  const journalKey = journal ? String(journal.key) : null;
  const journalUnknown = journalQuery.length > 0 && journal === null;

  let evaluated;
  if (requested) {
    const found = byKey.get(requested);
    evaluated = [{ key: requested, body: found ? found.body : source }];
  } else {
    evaluated = sections.map((section) => ({ key: section.key, body: section.body }));
  }

  for (const rule of allRules()) {
    const scoped = Array.isArray(rule.journals) ? rule.journals : [];
    if (scoped.length > 0) {
      // Journal-scoped rule: it only applies to its own target.
      if (!journalKey || !scoped.includes(journalKey)) {
        skippedJournalRules += 1;
        continue;
      }
    }
    const check = rule.check ?? {};
    const type = typeof check.type === 'string' ? check.type : 'manual';
    const params = check.params ?? {};

    if (type === 'manual') {
      for (const target of evaluated) {
        if (!rule.sections.includes(target.key)) continue;
        manualRules += 1;
        advice.push({
          id: rule.id,
          ruleId: rule.id,
          title: rule.title ?? rule.id,
          severity: rule.severity ?? 'info',
          section: target.key,
          statement: clip(rule.statement ?? '', 400),
          fix: clip(rule.fix ?? '', 400),
          source: rule.source ?? {},
        });
      }
      continue;
    }

    if (type === 'sectionOrder') {
      const relevant =
        requested !== null
          ? rule.sections.includes(requested)
          : rule.sections.length === 0 || rule.sections.some((key) => byKey.has(key));
      if (!relevant) continue;
      checkedRules += 1;
      const failure = runSectionOrder(params, sections);
      if (failure) violations.push(makeViolation(rule, 'document', failure));
      continue;
    }

    for (const target of evaluated) {
      if (!rule.sections.includes(target.key)) continue;
      checkedRules += 1;
      const stats = { words: countWords(target.body), citations: countCitations(target.body) };
      const failure = runCheck(type, params, target.body, stats);
      if (!failure) continue;
      if (Array.isArray(failure.violations)) {
        for (const detail of failure.violations) {
          violations.push(makeViolation(rule, target.key, detail));
        }
      } else {
        violations.push(makeViolation(rule, target.key, failure));
      }
    }
  }

  if (journal) applyJournalLimits(journal, source, sections, violations);

  const summary = {
    total: violations.length,
    hard: 0,
    soft: 0,
    info: 0,
    bySection: {},
    checkedRules,
    manualRules,
    pass: true,
    // Journal scoping: how many journal-specific rules were NOT applied, the
    // resolved journal key, and whether the requested journal was unknown.
    skippedJournalRules,
    journalKey,
    journalName: journal ? (journal.name ?? journal.key) : null,
    journalQuery: journalQuery || null,
    journalUnknown,
  };
  for (const violation of violations) {
    const severity = SEVERITIES.includes(violation.severity) ? violation.severity : 'info';
    summary[severity] += 1;
    summary.bySection[violation.section] = (summary.bySection[violation.section] ?? 0) + 1;
  }
  summary.pass = summary.hard === 0;

  return { violations, advice, summary, sections };
}
