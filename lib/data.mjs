// Machine-readable knowledge base for the host half of the plugin.
//
// Every file under `data/` is loaded independently: a missing or malformed
// file is skipped with one warning and the plugin keeps working with whatever
// loaded. The data set is static per install, so the result is cached after
// the first read.
//
// The data directory is resolved relative to THIS MODULE, never relative to
// `process.cwd()` — the plugin may be installed anywhere and started from
// anywhere.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Absolute path of the shipped knowledge base. */
export const DATA_DIR = fileURLToPath(new URL('../data/', import.meta.url));

/** The section vocabulary from data/SCHEMA.md — `rule.sections` only takes these. */
export const SECTION_VOCABULARY = Object.freeze([
  'title',
  'abstract',
  'keywords',
  'introduction',
  'literature',
  'methods',
  'geological-setting',
  'systematic',
  'results',
  'discussion',
  'conclusion',
  'acknowledgements',
  'references',
  'figures',
  'tables',
  'declarations',
  'cover-letter',
  'response',
  'review',
]);

/** The severity vocabulary from data/SCHEMA.md. */
export const SEVERITY_VOCABULARY = Object.freeze(['hard', 'soft', 'info']);

/** The eight deterministic check kinds from data/SCHEMA.md. */
export const CHECK_TYPES = Object.freeze([
  'manual',
  'forbidden',
  'required',
  'count',
  'wordCount',
  'numeric',
  'citationDensity',
  'sectionOrder',
]);

const warn = (message) => {
  console.warn(`[dsh-academic-paper-polish] ${message}`);
};

let cache = null;

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function readPluginVersion() {
  try {
    const file = fileURLToPath(new URL('../package.json', import.meta.url));
    const pkg = JSON.parse(readFileSync(file, 'utf8'));
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function asArray(value) {
  return Array.isArray(value) ? value.filter((entry) => entry && typeof entry === 'object') : [];
}

function loadRules() {
  const dir = join(DATA_DIR, 'rules');
  let names;
  try {
    names = readdirSync(dir)
      .filter((name) => name.endsWith('.json'))
      .sort();
  } catch (error) {
    warn(`data/rules is unreadable (${error.message}); no rules loaded`);
    return [];
  }
  const rules = [];
  for (const name of names) {
    const file = join(dir, name);
    let parsed;
    try {
      parsed = readJson(file);
    } catch (error) {
      warn(`skipped ${file}: ${error.message}`);
      continue;
    }
    const domain =
      typeof parsed?.domain === 'string' && parsed.domain.length > 0
        ? parsed.domain
        : name.replace(/\.json$/u, '');
    for (const rule of asArray(parsed?.rules)) {
      const sections = Array.isArray(rule.sections)
        ? rule.sections.filter((entry) => typeof entry === 'string')
        : [];
      rules.push({
        ...rule,
        domain,
        sections,
        // A rule may be scoped to specific target journals. An empty list
        // means "general" — it applies to every manuscript.
        journals: Array.isArray(rule.journals)
          ? rule.journals.filter((entry) => typeof entry === 'string')
          : [],
        severity: SEVERITY_VOCABULARY.includes(rule.severity) ? rule.severity : 'info',
        tags: Array.isArray(rule.tags) ? rule.tags.filter((entry) => typeof entry === 'string') : [],
        source: rule.source && typeof rule.source === 'object' ? rule.source : {},
      });
    }
  }
  return rules;
}

function loadJournals() {
  const file = join(DATA_DIR, 'journals.json');
  let parsed;
  try {
    parsed = readJson(file);
  } catch (error) {
    warn(`skipped ${file}: ${error.message}`);
    return [];
  }
  return asArray(parsed?.journals).map((journal) => ({
    ...journal,
    key: typeof journal.key === 'string' ? journal.key : String(journal.name ?? '').toLowerCase(),
    name: typeof journal.name === 'string' ? journal.name : String(journal.key ?? ''),
    field: Array.isArray(journal.field) ? journal.field : [],
    articleTypes: Array.isArray(journal.articleTypes) ? journal.articleTypes : [],
    structure: Array.isArray(journal.structure)
      ? journal.structure.filter((entry) => typeof entry === 'string')
      : [],
    rules: Array.isArray(journal.rules) ? journal.rules : [],
    limits: journal.limits && typeof journal.limits === 'object' ? journal.limits : {},
    source: journal.source && typeof journal.source === 'object' ? journal.source : {},
  }));
}

function loadSentences() {
  const file = join(DATA_DIR, 'sentences.json');
  let parsed;
  try {
    parsed = readJson(file);
  } catch (error) {
    warn(`skipped ${file}: ${error.message}`);
    return [];
  }
  return asArray(parsed?.patterns).map((pattern) => ({
    ...pattern,
    flags: typeof pattern.flags === 'string' ? pattern.flags : '',
    severity: SEVERITY_VOCABULARY.includes(pattern.severity) ? pattern.severity : 'info',
  }));
}

function loadChecklists() {
  const file = join(DATA_DIR, 'checklists.json');
  let parsed;
  try {
    parsed = readJson(file);
  } catch (error) {
    warn(`skipped ${file}: ${error.message}`);
    return [];
  }
  return asArray(parsed?.stages).map((stage) => ({
    ...stage,
    sections: Array.isArray(stage.sections) ? stage.sections : [],
    items: asArray(stage.items).map((item) => ({
      ...item,
      stageId: typeof stage.id === 'string' ? stage.id : '',
      ruleId: typeof item.ruleId === 'string' ? item.ruleId : '',
      tags: Array.isArray(item.tags) ? item.tags : [],
      severity: SEVERITY_VOCABULARY.includes(item.severity) ? item.severity : 'info',
    })),
  }));
}

function load() {
  if (cache !== null) return cache;
  cache = {
    rules: loadRules(),
    journals: loadJournals(),
    sentences: loadSentences(),
    checklists: loadChecklists(),
  };
  return cache;
}

/** Every rule of every domain, each carrying its `domain`. */
export function allRules() {
  return load().rules;
}

/** Every rule whose `sections` list contains `section`. */
export function rulesBySection(section) {
  const key = String(section ?? '');
  if (!key) return [];
  return allRules().filter((rule) => rule.sections.includes(key));
}

/** Every journal record. */
export function allJournals() {
  return load().journals;
}

/** Every de-AI sentence pattern. */
export function allSentences() {
  return load().sentences;
}

/** Every checklist stage (with its items). */
export function allChecklists() {
  return load().checklists;
}

/**
 * Every string one journal answers to: its key, its full name, its name
 * without the parenthetical, and the abbreviation inside it. The manual uses
 * the abbreviations everywhere ("PE", "APP", "PPP", "ES&T", "ESR", "JM",
 * "GCA"), so they must resolve to the same journal as the full name.
 */
export function journalAliases(journal) {
  const name = String(journal?.name ?? '').trim();
  const aliases = new Set();
  const push = (value) => {
    const text = String(value ?? '').trim().toLowerCase();
    if (text) aliases.add(text);
  };
  push(journal?.key);
  push(name);
  const parenthetical = /\(([^()]{1,24})\)\s*$/u.exec(name);
  if (parenthetical) {
    push(parenthetical[1]);
    push(name.slice(0, parenthetical.index).trim());
  }
  return [...aliases];
}

/**
 * Resolve one journal by key, full name, abbreviation or a case-insensitive
 * substring. Exact matches win over partial ones, so a query that could
 * match several journals resolves to the most exact one.
 */
export function findJournal(query) {
  const needle = String(query ?? '').trim().toLowerCase();
  if (!needle) return null;
  const journals = allJournals();
  const byKey = journals.find((journal) => String(journal.key).toLowerCase() === needle);
  if (byKey) return byKey;
  const byName = journals.find((journal) => String(journal.name).toLowerCase() === needle);
  if (byName) return byName;
  const byAlias = journals.find((journal) => journalAliases(journal).includes(needle));
  if (byAlias) return byAlias;
  return (
    journals.find((journal) => String(journal.key).toLowerCase().includes(needle)) ??
    journals.find((journal) => String(journal.name).toLowerCase().includes(needle)) ??
    journals.find((journal) => journalAliases(journal).some((alias) => alias.includes(needle))) ??
    null
  );
}

/** Every rule that is scoped to one journal key. */
export function journalRules(journalKey) {
  const key = String(journalKey ?? '').trim().toLowerCase();
  if (!key) return [];
  return allRules().filter((rule) =>
    (rule.journals ?? []).some((entry) => String(entry).toLowerCase() === key),
  );
}

/** How many rules are scoped to some journal — the "missing half" counter. */
export function journalScopedRuleCount() {
  return allRules().filter((rule) => (rule.journals ?? []).length > 0).length;
}

/** Counts, domains, section and severity vocabularies — the panel's filter source. */
export function meta() {
  const db = load();
  const discovered = new Set();
  for (const rule of db.rules) {
    for (const section of rule.sections) discovered.add(section);
  }
  const extra = [...discovered].filter((section) => !SECTION_VOCABULARY.includes(section)).sort();
  return {
    version: readPluginVersion(),
    counts: {
      rules: db.rules.length,
      journals: db.journals.length,
      sentences: db.sentences.length,
      checklists: db.checklists.length,
      // How many of the rules only apply to one target journal.
      journalScopedRules: db.rules.filter((rule) => (rule.journals ?? []).length > 0).length,
    },
    domains: [...new Set(db.rules.map((rule) => rule.domain))].sort(),
    sections: [...SECTION_VOCABULARY, ...extra],
    severities: [...SEVERITY_VOCABULARY],
  };
}
