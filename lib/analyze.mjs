// Per-section analysis of one manuscript.
//
// The file is split into sections with the shared splitter (`lib/text.mjs`),
// every section is checked with the shared rule engine (`lib/checker.mjs`)
// and the whole document is scanned for AI-style sentences with the shared
// de-AI runner (`lib/tools.mjs`). Nothing here re-implements a rule.
//
// Two conventions worth knowing:
//
//   - The report order is the CANONICAL section order of data/SCHEMA.md,
//     not the order the headings appeared in. A heading whose key is not in
//     the vocabulary keeps its document order and is appended at the end.
//   - A violation the engine reports for the whole document (`section:
//     "document"`, e.g. a broken section order) is attached to the first
//     section whose check produced it, so it is never lost and never
//     duplicated.

import { SECTION_VOCABULARY } from './data.mjs';
import { checkText } from './checker.mjs';
import { countWords, splitSections } from './text.mjs';
import { runPaperDeai } from './tools.mjs';

/** The canonical order of the section vocabulary. */
const RANK = new Map(SECTION_VOCABULARY.map((key, index) => [key, index]));

/** The severities the summary counts. */
const SEVERITIES = ['hard', 'soft', 'info'];

/** `splitSections` invents a `title` section for the text before the first
 *  heading. Its label is the Chinese word — that is how the synthetic one is
 *  recognised from a real "Title" heading. */
function isSyntheticTitle(section) {
  return section.key === 'title' && section.title === '题目';
}

function hasText(section) {
  return String(section.body ?? '').trim().length > 0;
}

/** Canonical order first, unknown keys afterwards in document order. */
function orderSections(sections) {
  const known = [];
  const unknown = [];
  for (const section of sections) {
    if (RANK.has(section.key)) known.push(section);
    else unknown.push(section);
  }
  known.sort((a, b) => RANK.get(a.key) - RANK.get(b.key));
  return [...known, ...unknown];
}

/** Count the severities of a violation list into a summary. */
function summarize(violations, base = {}) {
  const summary = {
    total: violations.length,
    hard: 0,
    soft: 0,
    info: 0,
    checkedRules: base.checkedRules ?? 0,
    manualRules: base.manualRules ?? 0,
    skippedJournalRules: base.skippedJournalRules ?? 0,
    journalKey: base.journalKey ?? null,
    journalUnknown: Boolean(base.journalUnknown),
    pass: true,
  };
  for (const violation of violations) {
    const severity = SEVERITIES.includes(violation.severity) ? violation.severity : 'info';
    summary[severity] += 1;
  }
  summary.pass = summary.hard === 0;
  return summary;
}

/** The shape of one violation in the report. */
function toViolation(violation) {
  const view = {
    id: violation.id,
    ruleId: violation.ruleId ?? violation.id,
    title: violation.title ?? violation.id,
    severity: violation.severity ?? 'info',
    section: violation.section ?? 'document',
    statement: violation.statement ?? '',
    fix: violation.fix ?? '',
    source: violation.source ?? {},
  };
  if (violation.matched !== undefined) view.matched = violation.matched;
  if (violation.actual !== undefined) view.actual = violation.actual;
  if (violation.expected !== undefined) view.expected = violation.expected;
  return view;
}

/** The shape of one advice entry in the report. */
function toAdvice(entry) {
  return {
    id: entry.id,
    ruleId: entry.ruleId ?? entry.id,
    title: entry.title,
    severity: entry.severity ?? 'info',
    statement: entry.statement ?? '',
    fix: entry.fix ?? '',
    source: entry.source ?? {},
  };
}

/** The violations of one section (the document-wide ones are handled apart). */
function violationsOf(result, sectionKey) {
  return result.violations
    .filter((violation) => violation.section === sectionKey)
    .map(toViolation);
}

/** The advice entries of one section. */
function adviceOf(result, sectionKey) {
  return result.advice
    .filter((entry) => entry.section === sectionKey)
    .map(toAdvice);
}

/**
 * Analyse one manuscript.
 *
 * @param {object} options
 * @param {string} options.text      the extracted text of the file
 * @param {string} options.format    `docx` / `md` / `txt` / `tex` / `rtf`
 * @param {string} options.path      the absolute path of the file
 * @param {string} options.name      the file name
 * @param {number} options.bytes     the size of the file
 * @param {string} [options.journal]  the target journal (name, key or short form)
 * @param {string} [options.section]  only report this section
 */
export function analyzeManuscript(options = {}) {
  const {
    text = '',
    format = 'txt',
    path = '',
    name = '',
    bytes = 0,
    journal = null,
    section = null,
  } = options;
  const source = String(text ?? '');
  const journalQuery = journal ? String(journal).trim() : '';

  const sections = splitSections(source);
  const recognized = sections.filter(
    (entry) => RANK.has(entry.key) && !isSyntheticTitle(entry),
  );

  const report = [];
  const bases = [];
  const fileSections = [];

  if (recognized.length === 0) {
    // No recognisable heading at all: the whole text is one document and
    // it is analysed with the general rules.
    const result = checkText(source, { journal: journalQuery || null });
    const violations = result.violations.map(toViolation);
    report.push({
      section: 'document',
      title: '全文',
      words: countWords(source),
      summary: summarize(violations, result.summary),
      violations,
      advice: result.advice.map(toAdvice),
    });
    bases.push(result.summary);
  } else {
    const ordered = orderSections(sections.filter(hasText));
    for (const entry of ordered) {
      fileSections.push({
        key: entry.key,
        title: entry.title,
        words: countWords(entry.body),
      });
    }
    const wanted = section ? String(section).trim().toLowerCase() : '';
    const target = wanted
      ? ordered.filter(
          (entry) =>
            entry.key.toLowerCase() === wanted ||
            String(entry.title ?? '').trim().toLowerCase() === wanted,
        )
      : ordered;

    if (wanted && target.length === 0) {
      const error = new Error(`文稿中没有段落「${section}」`);
      error.status = 400;
      error.code = 'bad-request';
      throw error;
    }

    // The document-wide violations are collected once: the first section
    // whose check produced one owns it.
    const documentViolations = new Map();

    for (const entry of target) {
      // The FULL text is checked with `section` set: the rule engine then
      // sees the whole document (section order, journal limits) while only
      // evaluating the rules of this section.
      const result = checkText(source, {
        section: entry.key,
        journal: journalQuery || null,
      });
      const violations = violationsOf(result, entry.key);
      for (const violation of result.violations) {
        if (violation.section !== 'document') continue;
        if (documentViolations.has(violation.id)) continue;
        documentViolations.set(violation.id, { violation, owner: entry.key });
      }
      report.push({
        section: entry.key,
        title: entry.title,
        words: countWords(entry.body),
        summary: summarize(violations, result.summary),
        violations,
        advice: adviceOf(result, entry.key),
      });
      bases.push(result.summary);
    }

    // Attach the document-wide violations to their owner.
    for (const { violation, owner } of documentViolations.values()) {
      const index = report.findIndex((entry) => entry.section === owner);
      if (index < 0) continue;
      report[index].violations.push(toViolation({ ...violation, section: 'document' }));
      report[index].summary = summarize(report[index].violations, bases[index]);
    }
  }

  const allViolations = report.flatMap((entry) => entry.violations);
  const summary = {
    total: allViolations.length,
    hard: allViolations.filter((violation) => violation.severity === 'hard').length,
    soft: allViolations.filter((violation) => violation.severity === 'soft').length,
    info: allViolations.filter((violation) => violation.severity === 'info').length,
    sections: report.length,
  };

  const deaiRun = runPaperDeai({ text: source });
  const deai = {
    score: deaiRun.score ?? 100,
    total: deaiRun.total ?? 0,
    hits: (deaiRun.hits ?? []).map((hit) => ({
      id: hit.id ?? '',
      zh: hit.zh ?? '',
      en: hit.en ?? '',
      severity: hit.severity ?? 'info',
      category: hit.category ?? null,
      why: hit.why ?? null,
      suggestion: hit.suggestion ?? null,
      matched: hit.matched ?? '',
      count: hit.count ?? 0,
    })),
  };

  return {
    file: {
      path: String(path ?? ''),
      name: String(name ?? ''),
      bytes: Number(bytes ?? 0),
      format: String(format ?? ''),
      sections: fileSections,
    },
    report,
    deai,
    summary,
  };
}
