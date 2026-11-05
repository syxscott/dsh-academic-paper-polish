// Manuscript outline builder.
//
// Two modes:
//   · a known journal  → its own `structure` (split on its own numbering),
//     its `limits` and its `rules`
//   · no journal       → a generic SCI skeleton derived from the rule DB
//
// A `section` argument switches to rule lookup: every rule that applies to
// that section is returned so the agent can read the requirements verbatim.

import { SECTION_VOCABULARY, allRules, findJournal, rulesBySection } from './data.mjs';
import { SECTION_TITLES, clip, sectionKeyFor } from './text.mjs';

/** Split a journal's own numbering off a structure entry. */
function splitStructure(structure) {
  const list = Array.isArray(structure) ? structure : String(structure ?? '').split(/\r?\n/u);
  return list
    .map((entry) => String(entry ?? '').trim())
    .filter((entry) => entry.length > 0)
    .map((entry, index) => {
      const numbered = /^(\d+(?:\.\d+)*)\s*[.)、．]?\s*(.+)$/u.exec(entry);
      if (numbered) return { number: numbered[1], title: numbered[2].trim(), index };
      return { number: String(index + 1), title: entry, index };
    });
}

/** The hard requirements of one section, as one readable string. */
function requirementFor(key) {
  const hard = rulesBySection(key).filter((rule) => rule.severity === 'hard');
  const pool = hard.length > 0 ? hard : rulesBySection(key);
  if (pool.length === 0) return '';
  return clip(
    pool
      .slice(0, 6)
      .map((rule) => rule.statement)
      .filter((statement) => typeof statement === 'string' && statement.length > 0)
      .join('；'),
    400,
  );
}

function genericSections() {
  const used = new Set();
  for (const rule of allRules()) {
    for (const section of rule.sections) used.add(section);
  }
  return SECTION_VOCABULARY.filter((key) => used.has(key)).map((key) => ({
    key,
    title: SECTION_TITLES[key] ?? key,
    requirement: requirementFor(key),
    source: {},
    severity: 'hard',
  }));
}

/**
 * Build the outline of a manuscript.
 * @param {object} options
 * @param {string} [options.journal]  journal name or key
 * @param {string} [options.section]  return the rules of this section instead
 */
export function buildOutline(options = {}) {
  const requestedJournal = options.journal ? findJournal(options.journal) : null;
  const section = options.section ? String(options.section) : null;

  if (section) {
    const rules = rulesBySection(section);
    return {
      journal: requestedJournal ?? null,
      section,
      sections: rules.map((rule) => ({
        key: rule.id,
        title: rule.title ?? rule.id,
        requirement: clip(rule.statement ?? '', 400),
        source: rule.source ?? {},
        severity: rule.severity ?? 'info',
      })),
      rules,
      limits: requestedJournal?.limits ?? null,
      notes: requestedJournal?.notes ?? '',
    };
  }

  if (requestedJournal) {
    const sections = splitStructure(requestedJournal.structure).map((entry) => {
      const key = sectionKeyFor(entry.title);
      return {
        key: key ?? `step-${entry.index + 1}`,
        title: entry.title,
        number: entry.number,
        requirement: key ? requirementFor(key) : '',
        source: requestedJournal.source ?? {},
        severity: 'hard',
      };
    });
    return {
      journal: requestedJournal,
      sections,
      rules: Array.isArray(requestedJournal.rules) ? requestedJournal.rules : [],
      limits: requestedJournal.limits ?? {},
      notes: requestedJournal.notes ?? '',
    };
  }

  return {
    journal: null,
    sections: genericSections(),
    rules: [],
    limits: null,
    notes: '未指定或未识别期刊：返回由规则库推导的通用 SCI 结构。',
  };
}
