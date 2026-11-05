// Conformance harness for the skill corpus.
//
//   node scripts/eval-conformance.mjs
//
// Two things are checked, and they answer the complaint "手册中的内容还是不全的":
//
//   1. MANUAL COMPLETENESS — every case in `evals/evals.json` names a file the
//      agent is supposed to load (`expect.load`) and a set of facts that file
//      must state (`must_mention`). A fact that cannot be found anywhere in the
//      skill corpus is a hole in the manual.
//
//   2. TOOL COVERAGE — every numeric fact in `must_mention` should also be
//      reachable from the machine-readable rule base in `data/`, because that is
//      what the `paper_*` tools execute. Numeric facts that only live in prose
//      are reported as gaps, not failures.
//
// The file also verifies that every relative markdown link in the corpus
// resolves to a file that exists.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative, sep } from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SKILL_DIR = join(ROOT, "skill", "academic-paper-polish");
const EVALS = join(ROOT, "evals", "evals.json");
const DATA_DIR = join(ROOT, "data");

const failures = [];
const warnings = [];
let checks = 0;

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function check(ok, message) {
  checks += 1;
  if (!ok) fail(message);
  return ok;
}

function walk(dir, predicate) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, predicate));
    else if (predicate(full)) out.push(full);
  }
  return out.sort();
}

const files = walk(SKILL_DIR, (file) => file.endsWith(".md"));
const corpus = new Map();
for (const file of files) {
  corpus.set(relative(SKILL_DIR, file).split(sep).join("/"), readFileSync(file, "utf8"));
}
const corpusText = [...corpus.values()].join("\n");

// ── data/ corpus for tool coverage ──────────────────────────────────────────
const dataText = walk(DATA_DIR, (file) => file.endsWith(".json"))
  .map((file) => readFileSync(file, "utf8"))
  .join("\n")
  .replaceAll("\\", "");

// ── 1. manual completeness ───────────────────────────────────────────────────
let evals;
try {
  evals = JSON.parse(readFileSync(EVALS, "utf8"));
} catch (error) {
  console.error(`✗ cannot read ${EVALS}: ${error.message}`);
  process.exit(2);
}

const NEGATIONS = ["不要", "禁止", "避免", "不得", "切勿", "严禁", "不能", "不可", "不该", "不应", "勿", "别"];
// A forbidden behaviour may also appear because the manual *quotes and retracts*
// it ("早期版本声称…，该说法已作废"). Those contexts are guarded too.
const RETRACTED = ["更正", "声称", "旧", "误", "曾经", "作废", "不再", "而非", "错"];
const NUMERIC = /\d/;

let mentionFound = 0;
let mentionCorpusOnly = 0;
let numericCovered = 0;
let numericGap = 0;

for (const testCase of evals.cases ?? []) {
  const id = testCase.id ?? "(unnamed)";
  const expect = testCase.expect ?? {};
  const load = expect.load;

  if (!load) {
    fail(`${id}: eval case has no expect.load`);
    continue;
  }
  const body = corpus.get(load);
  if (body === undefined) {
    fail(`${id}: expect.load points at a missing file → ${load}`);
    continue;
  }
  check(true, `${id}: load target exists`);

  for (const phrase of expect.must_mention ?? []) {
    checks += 1;
    if (body.includes(phrase)) {
      mentionFound += 1;
    } else if (corpusText.includes(phrase)) {
      mentionFound += 1;
      mentionCorpusOnly += 1;
      warn(`${id}: "${phrase}" is in the corpus but NOT in ${load}`);
    } else {
      fail(`${id}: missing required content "${phrase}" (not found in ${load} or anywhere in the skill)`);
    }
    if (NUMERIC.test(phrase) && !phrase.includes(" ")) {
      if (dataText.includes(phrase)) numericCovered += 1;
      else {
        numericGap += 1;
        warn(`${id}: numeric fact "${phrase}" is not reachable from data/ (tools cannot check it)`);
      }
    }
  }

  for (const phrase of expect.must_not ?? []) {
    checks += 1;
    let index = body.indexOf(phrase);
    let unguarded = false;
    while (index !== -1) {
      const before = body.slice(Math.max(0, index - 24), index);
      if (!NEGATIONS.some((word) => before.includes(word)) && !RETRACTED.some((word) => before.includes(word))) {
        unguarded = true;
        break;
      }
      index = body.indexOf(phrase, index + 1);
    }
    if (unguarded) {
      fail(`${id}: forbidden behaviour "${phrase}" appears in ${load} without a negation guard`);
    }
  }
}

// ── 2. relative link integrity ──────────────────────────────────────────────
const LINK = /\[[^\]]*\]\(([^)]+)\)/g;
let linkCount = 0;
for (const [path, body] of corpus) {
  for (const match of body.matchAll(LINK)) {
    const target = match[1].trim();
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const clean = target.split("#")[0];
    if (!clean) continue;
    linkCount += 1;
    const resolved = join(SKILL_DIR, path, "..", clean);
    const present = (candidate) => {
      try {
        return statSync(candidate).isFile() || statSync(candidate).isDirectory();
      } catch {
        return false;
      }
    };
    let exists = present(resolved);
    if (!exists) {
      // `references/xxx.md` written relative to the skill root is also legal.
      exists = present(join(SKILL_DIR, clean));
    }
    if (!exists) fail(`broken link in ${path}: ${target}`);
  }
}

// ── 3. every corpus file must be reachable from SKILL.md ─────────────────────
const skillMd = corpus.get("SKILL.md") ?? "";
const orphans = [];
for (const path of corpus.keys()) {
  if (path === "SKILL.md") continue;
  const base = path.split("/").pop();
  if (skillMd.includes(base) || skillMd.includes(path)) continue;
  orphans.push(path);
}

// ── report ───────────────────────────────────────────────────────────────────
console.log("eval-conformance");
console.log(`  corpus files        : ${corpus.size}`);
console.log(`  eval cases          : ${(evals.cases ?? []).length}`);
console.log(`  must_mention found  : ${mentionFound} (${mentionCorpusOnly} only in the corpus, not in the loaded file)`);
console.log(`  numeric coverage    : ${numericCovered} covered by data/, ${numericGap} prose-only`);
console.log(`  relative links      : ${linkCount}`);
console.log(`  orphan files        : ${orphans.length}`);
console.log(`  assertions          : ${checks}`);

if (orphans.length > 0) {
  console.log("");
  console.log("  files not referenced from SKILL.md:");
  for (const path of orphans) console.log(`    - ${path}`);
}

if (warnings.length > 0) {
  console.log("");
  console.log(`  warnings (${warnings.length}):`);
  for (const message of warnings.slice(0, 40)) console.log(`    · ${message}`);
  if (warnings.length > 40) console.log(`    … ${warnings.length - 40} more`);
}

if (failures.length > 0) {
  console.log("");
  console.log(`  FAILURES (${failures.length}):`);
  for (const message of failures) console.log(`    ✗ ${message}`);
  console.log("");
  console.log(`✗ ${failures.length} failed / ${checks} assertions`);
  process.exit(1);
}

console.log("");
console.log(`✓ ${checks} assertions passed`);
