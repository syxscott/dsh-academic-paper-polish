// Tags journal-scoped rules with the journals they actually apply to.
//
//   node scripts/tag-journal-rules.mjs           # dry run — prints the table
//   node scripts/tag-journal-rules.mjs --apply   # writes the files
//
// A rule that says "PE 必须提供 plain language summary" is a Palaeontologia
// Electronica rule. Without a journal scope the checker applies it to every
// manuscript, which is how a tool loses the reader's trust. This script reads
// the journal database, finds the journal each rule names, and writes an
// optional `journals` array on the rule.
//
// The rule shape is documented in data/SCHEMA.md.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const APPLY = process.argv.includes("--apply");

const FILES = [
  "data/rules/writing.json",
  "data/rules/figures.json",
  "data/rules/submission.json",
];

// A journal is matched by its full name or by its short form. The short forms
// are the abbreviations the manual itself uses; each one is matched on word
// boundaries so "PE" cannot fire inside "PERIOD" and "JM" cannot fire inside
// "JMPa".
const ALIASES = {
  "geochimica-et-cosmochimica-acta": ["Geochimica et Cosmochimica Acta", "GCA"],
  "environmental-science-and-technology": ["Environmental Science & Technology", "Environmental Science and Technology", "ES&T"],
  "water-research": ["Water Research"],
  "earth-science-reviews": ["Earth-Science Reviews", "Earth Science Reviews", "ESR"],
  "annual-review-of-earth-and-planetary-sciences": ["Annual Review of Earth and Planetary Sciences", "Annual Reviews of Earth and Planetary Sciences"],
  "national-science-review": ["National Science Review", "NSR"],
  "j-micropalaeontology": ["Journal of Micropalaeontology", "J. Micropalaeontology", "JM"],
  "palaeoworld": ["Palaeoworld"],
  "paleobiology": ["Paleobiology"],
  "acta-palaeontologica-polonica": ["Acta Palaeontologica Polonica", "APP"],
  "palaeontologia-electronica": ["Palaeontologia Electronica", "PE"],
  "pal-z": ["Paläontologische Zeitschrift", "Palaeontologische Zeitschrift", "PalZ"],
  "nature": ["Nature"],
  "pnas": ["PNAS", "Proceedings of the National Academy of Sciences"],
  "cvpr": ["CVPR", "ICCV", "3DV"],
  "revue-de-micropaleontologie": ["Revue de Micropaléontologie", "Revue de Micropaleontologie"],
  "marine-micropaleontology": ["Marine Micropaleontology"],
  "geobios": ["Geobios"],
  "comptes-rendus-palevol": ["Comptes Rendus Palevol"],
  "palaeogeography-palaeoclimatology-palaeoecology": ["Palaeogeography, Palaeoclimatology, Palaeoecology", "PPP"],
  "micropaleontology": ["Micropaleontology (SEPM)"],
  "palaeontology": ["Palaeontology (Palaeontological Association)"],
  "journal-of-vertebrate-paleontology": ["Journal of Vertebrate Paleontology", "JVP"],
  "journal-of-paleontology": ["Journal of Paleontology"],
  "palaeontological-research": ["Palaeontological Research"],
  "biological-reviews": ["Biological Reviews"],
  "chemical-reviews": ["Chemical Reviews"],
  "nature-reviews": ["Nature Reviews"],
};

// Publisher families are not journals — a rule about "Elsevier 系" spans many
// titles, so it stays general. Listing them here only suppresses a false hit.
const FAMILIES = [
  "Elsevier", "Copernicus", "Wiley", "Springer", "Cambridge", "Elsevier 系",
  "Wiley 系", "Springer Nature", "Taylor & Francis",
];

// Journal sources: a rule drawn from a journal guide file is very likely
// journal-scoped, which lets a mention of a common word ("Nature") count.
const JOURNAL_SOURCES = new Set([
  "references/multi-journal-style-guides.md",
  "references/paleobiology-journal.md",
]);

// A rule that comes from one journal's own guide belongs to that journal, even
// when the sentence names another one ("PE 同样要求…" inside the Paleobiology
// guide is both journals' requirement).
const SOURCE_IMPLIES = {
  "references/paleobiology-journal.md": "paleobiology",
};

// "一定要引 Science、Nature、Annual Reviews 系列" names journals as things to
// CITE. That is a general writing rule, not a requirement owned by Nature.
// A journal name introduced by a citation word does not own the requirement.
const CITATION_INTRO = /引|cite|citing|citation/i;

// Hand-set scopes for rules the heuristics cannot decide: a publisher family
// is named, so the rule may belong to one title of that family, and the
// sentence does not say which. Everything not listed here stays general.
const OVERRIDES = {
  "F-11": ["j-micropalaeontology"],
  "F-15": ["j-micropalaeontology"],
  "F-30": ["j-micropalaeontology"],
  "F-31": ["j-micropalaeontology"],
  "F-48": ["j-micropalaeontology"],
  "F-69": ["j-micropalaeontology"],
  "F-55": ["acta-palaeontologica-polonica"],
  "F-114": ["paleobiology"],
  "F-106": ["palaeoworld", "pnas"],
  "F-107": ["earth-science-reviews"],
};

function escape(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Matches a journal alias on word boundaries, longest alias first. */
function matchAlias(haystack, alias) {
  const pattern = new RegExp(`(^|[^A-Za-z0-9])${escape(alias)}([^A-Za-z0-9]|$)`);
  return pattern.test(haystack);
}

const journalKeys = new Set(Object.keys(ALIASES));
// How far into the statement a journal name may appear and still count as
// "this journal owns the requirement".
const LEADING_WINDOW = 40;
const aliasesByLength = Object.entries(ALIASES)
  .flatMap(([key, aliases]) => aliases.map((alias) => [alias, key]))
  .sort((a, b) => b[0].length - a[0].length);

const report = [];
const manual = [];
let scanned = 0;

for (const rel of FILES) {
  const path = join(ROOT, rel);
  const doc = JSON.parse(readFileSync(path, "utf8"));
  for (const rule of doc.rules ?? []) {
    scanned += 1;
    const title = String(rule.title ?? "");
    const statement = String(rule.statement ?? "");
    const haystack = `${title} ${statement}`;
    const sourceFile = rule.source?.file ?? "";

    // An explicit journal field always wins.
    if (rule.journals !== undefined) continue;

    const found = new Set();
    const leading = new Set();
    // The leading position is where a journal names ITSELF as the subject of
    // the requirement: "PE 必须提供 plain language summary", "Paleobiology：…".
    // A journal mentioned later in the sentence is usually a different thing —
    // "一定要引 Science、Nature、Annual Reviews 系列" is a general rule about
    // which journals to cite, not a requirement owned by Nature.
    const head = statement.replace(/^[\s>*\-#·•]+/, "");
    for (const [alias, key] of aliasesByLength) {
      if (key === "nature" && matchAlias(haystack, "Nature Reviews")) {
        found.delete("nature");
        found.add("nature-reviews");
        continue;
      }
      const pattern = new RegExp(`(^|[^A-Za-z0-9])${escape(alias)}([^A-Za-z0-9]|$)`, "g");
      const matches = [...haystack.matchAll(pattern)];
      if (matches.length === 0) continue;
      const first = matches[0];
      // A citation mention ("要引 Nature") is not ownership.
      const before = haystack.slice(Math.max(0, (first.index ?? 0) - 12), first.index ?? 0);
      if (CITATION_INTRO.test(before)) continue;
      found.add(key);
      const headPattern = new RegExp(`(^|[^A-Za-z0-9])${escape(alias)}([^A-Za-z0-9]|$)`, "g");
      const headMatch = [...head.matchAll(headPattern)][0];
      if (headMatch !== undefined && (headMatch.index ?? 999) <= LEADING_WINDOW) leading.add(key);
    }
    const implied = SOURCE_IMPLIES[sourceFile];
    if (implied !== undefined) found.add(implied);
    // "Micropaleontology" is a substring of "Journal of Micropalaeontology";
    // the longer alias already won, so drop the shorter one.
    if (found.has("j-micropalaeontology")) found.delete("micropaleontology");
    if (found.has("micropaleontology") && found.has("revue-de-micropaleontologie")) {
      found.delete("revue-de-micropaleontologie");
    }

    const familyHit = FAMILIES.some((family) => haystack.includes(family));

    if (found.size === 0) continue;

    // A publisher family means the requirement spans journals we cannot name
    // one-by-one; scoping it would silently drop it for half the journals.
    const override = OVERRIDES[rule.id];
    let owns;
    if (override !== undefined) {
      owns = override;
    } else if (familyHit) {
      manual.push({ id: rule.id, file: rel, title: rule.title, found: [...found], familyHit });
      continue;
    } else {
      // Scope only when the journal owns the requirement: the rule comes from
      // a journal guide, or the journal names itself at the head of the
      // sentence.
      owns = [...found].filter((key) => JOURNAL_SOURCES.has(sourceFile) || leading.has(key));
      if (owns.length === 0) {
        manual.push({ id: rule.id, file: rel, title: rule.title, found: [...found], familyHit });
        continue;
      }
    }
    rule.journals = owns;
    report.push({ id: rule.id, file: rel, key: owns.join(","), title: rule.title });
  }
  if (APPLY) writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
}

console.log(`scanned ${scanned} rules`);
console.log(`auto-tagged ${report.length}`);
console.log(`needs a human decision: ${manual.length}`);
console.log("");
console.log("── auto-tagged ──");
for (const row of report) console.log(`  ${row.id.padEnd(9)} ${row.key.padEnd(42)} ${row.title}`);
console.log("");
console.log("── needs a human decision ──");
for (const row of manual) {
  console.log(`  ${row.id.padEnd(9)} ${row.file.padEnd(28)} ${row.title}`);
  console.log(`            matched: ${row.found.join(", ") || "(none)"}${row.familyHit ? "  + publisher family" : ""}`);
}
if (!APPLY) console.log("\n(dry run — pass --apply to write)");
