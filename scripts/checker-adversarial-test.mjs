// Adversarial probe for the rule engine: hostile rule shapes.
//   node scripts/checker-adversarial-test.mjs
//
// Every rule below is malformed in some way. The engine must answer, never
// throw, never hang, and never report a violation that is not supported by
// the text.
import { checkRule } from "../lib/checker.mjs";

const failures = [];
let checks = 0;

function check(ok, message) {
  checks += 1;
  if (!ok) failures.push(message);
}

const rule = (id, check_, extra = {}) => ({
  id,
  title: `probe ${id}`,
  severity: "hard",
  sections: ["abstract"],
  statement: "probe",
  fix: "probe",
  source: { file: "probe.md", line: 1 },
  check: check_,
  ...extra,
});

function probe(label, definition, text = "some text 123 mm", expect = {}) {
  let result;
  const started = Date.now();
  try {
    result = checkRule(definition, text, { section: "abstract" });
  } catch (error) {
    check(false, `${label} threw: ${error.message}`);
    return null;
  }
  const elapsed = Date.now() - started;
  check(elapsed < 1500, `${label} took ${elapsed}ms — too slow`);
  const violations = result?.violations ?? [];
  if (expect.count !== undefined) {
    check(
      violations.length === expect.count,
      `${label} reported ${violations.length} violations, expected ${expect.count}`,
    );
  }
  if (expect.actual !== undefined) {
    check(
      violations[0]?.actual === expect.actual,
      `${label} actual=${JSON.stringify(violations[0]?.actual)}, expected ${JSON.stringify(expect.actual)}`,
    );
  }
  return result;
}

// ── numeric ────────────────────────────────────────────────────────────
probe(
  "numeric without a capture group",
  rule("P01", { type: "numeric", params: { pattern: "\\d+", min: 0, max: 10 } }),
  "some text 123 mm",
  { count: 1, actual: 123 },
);
probe(
  "numeric with min greater than max",
  rule("P02", { type: "numeric", params: { pattern: "(\\d+)", min: 100, max: 10 } }),
  "some text 123 mm",
  { count: 1 },
);
probe(
  "numeric with a null min",
  rule("P03", { type: "numeric", params: { pattern: "(\\d+)", min: null, max: 10 } }),
  "some text 123 mm",
  { count: 1 },
);
probe(
  "numeric with a null max",
  rule("P04", { type: "numeric", params: { pattern: "(\\d+)", min: 10, max: null } }),
  "some text 123 mm",
  { count: 0 },
);
probe(
  "numeric with both bounds null",
  rule("P05", { type: "numeric", params: { pattern: "(\\d+)", min: null, max: null } }),
  "some text 123 mm",
  { count: 0 },
);
probe(
  "numeric with a zero-width pattern",
  rule("P06", { type: "numeric", params: { pattern: "(?=x)", min: 1, max: 2 } }),
  "some text",
  { count: 0 },
);
probe(
  "numeric with an empty pattern",
  rule("P07", { type: "numeric", params: { pattern: "", min: 1, max: 2 } }),
  "some text",
  { count: 0 },
);
probe(
  "numeric with an invalid pattern",
  rule("P08", { type: "numeric", params: { pattern: "([", min: 1, max: 2 } }),
  "some text",
  { count: 0 },
);
probe(
  "numeric with two groups, the second out of band",
  rule("P09", { type: "numeric", params: { pattern: "(\\d+)\\s*mm\\s*x\\s*(\\d+)\\s*mm", min: 0, max: 200 } }),
  "180 mm x 260 mm",
  { count: 1 },
);
probe(
  "numeric with two groups, both in band",
  rule("P10", { type: "numeric", params: { pattern: "(\\d+)\\s*mm\\s*x\\s*(\\d+)\\s*mm", min: 0, max: 300 } }),
  "180 mm x 260 mm",
  { count: 0 },
);

// ── the other types ────────────────────────────────────────────────────
probe(
  "count with min greater than max",
  rule("P11", { type: "count", params: { pattern: "x", min: 5, max: 1 } }),
  "xxx",
  { count: 1, actual: 3 },
);
probe(
  "count with an empty pattern list",
  rule("P12", { type: "count", params: { patterns: [] } }),
  "xxx",
  { count: 0 },
);
probe(
  "required with an empty pattern list",
  rule("P13", { type: "required", params: { patterns: [] } }),
  "xxx",
  { count: 0 },
);
probe(
  "forbidden with an empty pattern list",
  rule("P14", { type: "forbidden", params: { patterns: [] } }),
  "xxx",
  { count: 0 },
);
probe(
  "forbidden counts every occurrence",
  rule("P15", { type: "forbidden", params: { patterns: ["x"] } }),
  "xxx",
  { count: 1, actual: "命中 3 次" },
);
probe(
  "unknown check type",
  rule("P16", { type: "wat", params: {} }),
  "xxx",
  { count: 0 },
);
probe(
  "citation density on a text that is too short",
  rule("P17", { type: "citationDensity", params: { min: 1, max: 2 } }),
  "x",
  { count: 0 },
);
probe(
  "section order with a section that is absent",
  rule("P18", { type: "sectionOrder", params: { order: ["introduction", "results"] } }),
  "some text",
  { count: 1 },
);
probe(
  "word count with a null bound",
  rule("P19", { type: "wordCount", params: { min: null, max: 2 } }),
  "one two three four five",
  { count: 1 },
);

// ── report ──────────────────────────────────────────────────────────────
console.log(`\nchecker adversarial — ${checks} assertions`);
if (failures.length > 0) {
  console.log(`\n${failures.length} failure(s):`);
  for (const message of failures) console.log(`  ✗ ${message}`);
  process.exit(1);
}
console.log("all hostile rule shapes answered safely");
