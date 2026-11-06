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

/** The severity ladder — one step down is used for a mixed finding. */
const SEVERITY_LADDER = ['hard', 'soft', 'info'];

/** One step softer: hard → soft, soft → info, info → info. */
function softenSeverity(severity) {
  const index = SEVERITY_LADDER.indexOf(severity);
  if (index < 0) return 'info';
  return SEVERITY_LADDER[Math.min(SEVERITY_LADDER.length - 1, index + 1)];
}

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

/**
 * The number a match carries: the rule's own capture group 1, or — when the
 * pattern has no capture group — the number inside the whole match.
 */
function numericValue(match) {
  const captured = match?.[1];
  if (typeof captured === 'string' && captured.trim().length > 0) {
    const value = Number(captured);
    if (Number.isFinite(value)) return value;
  }
  const found = String(match?.[0] ?? '').match(/-?\d+(?:\.\d+)?/u);
  if (found === null) return null;
  const value = Number(found[0]);
  return Number.isFinite(value) ? value : null;
}

/** Is the number the capture group holds a whole number? */
function boundaryOk(body, span) {
  const before = span[0] > 0 ? body[span[0] - 1] : '';
  const after = span[1] < body.length ? body[span[1]] : '';
  return !/[\d.]/u.test(before) && !/[\d.]/u.test(after);
}

/**
 * The numbers one match carries.
 *
 * A pattern with SEVERAL capture groups yields one candidate per group that
 * holds a number: a figure dimension is a PAIR of quantities ("180 mm ×
 * 230 mm", "9×6 cm", "1063×2244 px", "12 & 8 pt") and each of them has its
 * own limit. A pattern with a single group yields exactly that group — the
 * common case, unchanged.
 */
function groupNumbers(body, match) {
  const whole = String(match[0] ?? '');
  const groups = match.length - 1;
  const candidates = [];
  for (let group = 1; group <= groups; group += 1) {
    const captured = match[group];
    if (typeof captured !== 'string' || captured.trim().length === 0) continue;
    const value = Number(captured);
    if (!Number.isFinite(value)) continue;
    const span = match.indices?.[group];
    if (span && !boundaryOk(body, span)) continue;
    candidates.push({ value, group });
  }
  if (candidates.length > 0) return candidates;
  // No capture group holds a number: the whole match is the value.
  const value = numericValue(match);
  if (value === null) return [];
  const span = match.indices?.[1] ?? [match.index, match.index + whole.length];
  if (!boundaryOk(body, span)) return [];
  return [{ value, group: 0 }];
}

/**
 * Every number the rule's pattern matches in `body`.
 *
 * A match that starts or ends INSIDE a number is refused: the pattern
 * `(\d{1,2})\s*mm` would otherwise read "20" out of "220 mm". The rule
 * patterns carry the same guard as a lookaround (`(?<![\d.])` / `(?![\d.])`);
 * this one protects the checker against a sloppy pattern as well.
 */
function numericMatches(body, pattern, flags) {
  const base = typeof flags === 'string' ? flags : '';
  let source = base.includes('g') ? base : `${base}g`;
  if (!source.includes('d')) source += 'd';
  const re = compile(pattern, source);
  if (!re) return [];
  const found = [];
  let match = re.exec(body);
  while (match !== null) {
    const whole = String(match[0] ?? '');
    for (const candidate of groupNumbers(body, match)) {
      found.push({ value: candidate.value, text: whole, group: candidate.group });
    }
    if (match.index === re.lastIndex) re.lastIndex += 1;
    match = re.exec(body);
  }
  return found;
}

/** How far a value is outside the band (0 = inside). */
function bandDistance(value, min, max) {
  if (min !== null && value < min) return min - value;
  if (max !== null && value > max) return value - max;
  return 0;
}

/**
 * Run one non-manual check against one section body.
 * @returns {null | { matched?: string, actual?: number|string, expected?: string, violations?: object[] }}
 */
function runCheck(type, params, body, stats, rule) {
  switch (type) {
    case 'forbidden': {
      const patterns = Array.isArray(params.patterns) ? params.patterns : [];
      for (const pattern of patterns) {
        const re = compile(pattern, params.flags);
        if (!re) continue;
        const match = re.exec(body);
        if (match) {
          // How often the forbidden wording occurs: the panel says 「命中 3 次」
          // instead of a bare 「命中」.
          const global = compile(pattern, `${params.flags ?? ''}g`);
          const count = global ? (body.match(global)?.length ?? 1) : 1;
          const hit = clip(String(match[0]).trim(), 80);
          return {
            matched: hit,
            actual: `命中 ${count} 次`,
            expected: `不得出现「${clip(pattern, 80)}」`,
          };
        }
      }
      return null;
    }
    case 'required': {
      const patterns = Array.isArray(params.patterns) ? params.patterns : [];
      const missing = [];
      let total = 0;
      for (const pattern of patterns) {
        const re = compile(pattern, params.flags);
        if (!re) continue;
        total += 1;
        if (!re.test(body)) missing.push(pattern);
      }
      if (missing.length === 0) return null;
      const present = total - missing.length;
      // Every missing pattern stays its own finding; the count tells the
      // panel how much of the requirement is already there.
      return {
        violations: missing.map((pattern) => ({
          matched: clip(pattern, 120),
          actual: `${present}/${total} 项必需要素已出现`,
          expected: `必须出现：${clip(pattern, 120)}`,
        })),
      };
    }
    case 'count': {
      // `countMatches` compiles the pattern with the global flag, so EVERY
      // occurrence is counted — not just the first one.
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
      if (min === null && max === null) return null;
      // Every number the pattern matched — a pattern with two capture groups
      // contributes one number per group (a figure dimension is a pair).
      const matches = numericMatches(body, params.pattern, params.flags);
      if (matches.length === 0) return null;
      const judged = matches.map((entry) => ({
        ...entry,
        distance: bandDistance(entry.value, min, max),
      }));
      const out = judged.filter((entry) => entry.distance > 0);
      if (out.length === 0) return null;
      // The worst offender: the value FURTHEST outside the band.
      let worst = out[0];
      for (const entry of out) {
        if (entry.distance > worst.distance) worst = entry;
      }
      const values = out.map((entry) => entry.value).slice(0, 10);
      const expected = rangeText(min, max);
      const matched = clip(String(worst.text ?? '').trim(), 80);
      if (out.length === judged.length) {
        // EVERY match is out of band → the rule's own severity.
        return { actual: worst.value, matched, expected, values };
      }
      // MIXED: some values are inside the band → one step softer, and say so.
      return {
        actual: `${out.length} 个值超界：${values.join(' / ')}`,
        matched,
        expected,
        values,
        severity: softenSeverity(rule?.severity),
        note: `共匹配 ${judged.length} 处数值，其中 ${out.length} 处超出区间（其余在区间内），按部分超界降一级报告`,
      };
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
  // A check may soften its own severity (a mixed numeric finding is one
  // step below the rule) — the rule's own severity is the default.
  const severity = SEVERITIES.includes(detail?.severity)
    ? detail.severity
    : SEVERITIES.includes(rule.severity)
      ? rule.severity
      : 'info';
  const violation = {
    id: rule.id,
    ruleId: rule.id,
    title: rule.title ?? rule.id,
    severity,
    section,
    statement: clip(rule.statement ?? '', 400),
    fix: clip(rule.fix ?? '', 400),
    source: rule.source ?? {},
  };
  if (detail?.matched !== undefined) violation.matched = detail.matched;
  if (detail?.actual !== undefined) violation.actual = detail.actual;
  if (detail?.expected !== undefined) violation.expected = detail.expected;
  // The out-of-band values of a numeric rule (at most ten) and the note
  // that explains a mixed finding.
  if (detail?.values !== undefined) violation.values = detail.values;
  if (detail?.note !== undefined) violation.note = detail.note;
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
 * Execute a set of rules against the evaluated sections.
 *
 * A rule may be scoped to specific target journals (`rule.journals`). Such a
 * rule only applies when the target journal matches; with no target — or with
 * an unrecognised one — it is skipped and counted, never applied blindly.
 */
function runRules(rules, context) {
  const { source, sections, evaluated, byKey, requested, journalKey } = context;
  const violations = [];
  const advice = [];
  let checkedRules = 0;
  let manualRules = 0;
  let skippedJournalRules = 0;

  for (const rule of rules) {
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
      const failure = runCheck(type, params, target.body, stats, rule);
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

  return { violations, advice, checkedRules, manualRules, skippedJournalRules };
}

/** The counts of one rule run. */
function buildSummary(violations, counts, journalInfo) {
  const summary = {
    total: violations.length,
    hard: 0,
    soft: 0,
    info: 0,
    bySection: {},
    checkedRules: counts.checkedRules,
    manualRules: counts.manualRules,
    pass: true,
    // Journal scoping: how many journal-specific rules were NOT applied, the
    // resolved journal key, and whether the requested journal was unknown.
    skippedJournalRules: counts.skippedJournalRules,
    journalKey: journalInfo.journalKey,
    journalName: journalInfo.journal ? (journalInfo.journal.name ?? journalInfo.journal.key) : null,
    journalQuery: journalInfo.journalQuery || null,
    journalUnknown: journalInfo.journalUnknown,
  };
  for (const violation of violations) {
    const severity = SEVERITIES.includes(violation.severity) ? violation.severity : 'info';
    summary[severity] += 1;
    summary.bySection[violation.section] = (summary.bySection[violation.section] ?? 0) + 1;
  }
  summary.pass = summary.hard === 0;
  return summary;
}

/**
 * Execute the rule engine.
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

  const result = runRules(allRules(), {
    source,
    sections,
    byKey,
    evaluated,
    requested,
    journalKey,
  });

  const violations = [...result.violations];
  if (journal) applyJournalLimits(journal, source, sections, violations);

  const summary = buildSummary(violations, result, { journal, journalKey, journalQuery, journalUnknown });
  return { violations, advice: result.advice, summary, sections };
}

/**
 * Evaluate ONE rule against a text.
 *
 * The same code path as `checkText`, but with a rule that is handed in
 * instead of read from the database: the seam the focused test
 * (`scripts/checker-test.mjs`) uses to exercise the numeric semantics with
 * a rule of its own.
 *
 * @param {object} rule   a rule object (`id`, `severity`, `sections`, `check`)
 * @param {string} text   the text to evaluate
 * @param {object} [options]
 * @param {string} [options.section]  evaluate only this section
 * @returns {{ violations: object[], advice: object[], summary: object, sections: object[] }}
 */
export function checkRule(rule, text, options = {}) {
  const source = String(text ?? '');
  const requested = options.section ? String(options.section) : null;
  const sections = splitSections(source);
  const byKey = new Map(sections.map((section) => [section.key, section]));

  let evaluated;
  if (requested) {
    const found = byKey.get(requested);
    evaluated = [{ key: requested, body: found ? found.body : source }];
  } else {
    evaluated = sections.map((section) => ({ key: section.key, body: section.body }));
  }

  const result = runRules([rule], {
    source,
    sections,
    byKey,
    evaluated,
    requested,
    journalKey: null,
  });

  const summary = buildSummary(result.violations, result, {
    journal: null,
    journalKey: null,
    journalQuery: '',
    journalUnknown: false,
  });
  return { violations: result.violations, advice: result.advice, summary, sections };
}
