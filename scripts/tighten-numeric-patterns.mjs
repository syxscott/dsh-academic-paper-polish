// Tightens the `numeric` rule patterns.
//
//   node scripts/tighten-numeric-patterns.mjs           # dry run
//   node scripts/tighten-numeric-patterns.mjs --apply   # write
//
// Two defects are fixed:
//
// 1. NO DIGIT BOUNDARY. "220 mm" matched `(\d{1,2})\s*mm` as "20" (the regex
//    simply started one character later). Every capture group now refuses to
//    start or end inside a number.
//
// 2. NO UNIT DISAMBIGUATION. A figure spec states several sizes in the same
//    unit — "Line width: 0.05 pt. Font size: 6 pt." — and a bare `(\d+)\s*pt`
//    always grabs the first one, so the font-size rule was judged against the
//    line width. The rules below anchor the capture to the quantity the rule
//    is actually about.
//
// The `numeric` check reads the FIRST match, so an anchored pattern that does
// not appear simply yields no finding — which is the honest outcome when the
// text does not state that quantity.
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

// Rule id → the keyword that introduces the quantity the rule is about. The
// capture group moves to just after the keyword.
const ANCHORS = {
  "F-22": "(?:单栏|single[- ]?column)",
  "F-23": "(?:双栏|double[- ]?column|full[- ]?width|通栏)",
  "F-25": "(?:图宽|宽度|width)",
  "F-26": "(?:图宽|宽度|width)",
  "F-27": "(?:图宽|宽度|width)",
  "F-28": "(?:单栏|双栏|栏宽|width)",
  "F-30": "(?:最小图宽|图宽|width)",
  "F-31": "(?:版心|通栏|栏宽)",
  "F-36": "(?:字号|字体大小|font\\s*size)",
  "F-37": "(?:字号|数字文字|font\\s*size)",
  "F-38": "(?:字号|数字文字|font\\s*size)",
  "F-40": "(?:线宽|线条粗细|line\\s*width)",
  "F-41": "(?:线宽|线条宽|line\\s*width)",
  "F-42": "(?:线粗|线宽|line\\s*width)",
  "F-78": "(?:图注|caption)",
  "F-100": "(?:图宽|宽度|width)",
  "F-127": "(?:图内字号|字号|font)",
  "F-142": "(?:全稿|字号|font)",
};

/** Adds a digit boundary around every capturing group. */
function addBoundaries(pattern) {
  let out = "";
  let index = 0;
  while (index < pattern.length) {
    const char = pattern[index];
    if (char === "(" && pattern[index + 1] !== "?") {
      // Find the matching close paren of this capture group.
      let depth = 0;
      let end = index;
      for (; end < pattern.length; end += 1) {
        if (pattern[end] === "(") depth += 1;
        else if (pattern[end] === ")") {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      const group = pattern.slice(index, end + 1);
      out += `(?<![\\d.])${group}(?![\\d.])`;
      index = end + 1;
      continue;
    }
    out += char;
    index += 1;
  }
  return out;
}

/** Locates the first capturing group and returns its span. */
function firstCapture(pattern) {
  for (let index = 0; index < pattern.length; index += 1) {
    if (pattern[index] !== "(" || pattern[index + 1] === "?") continue;
    let depth = 0;
    for (let end = index; end < pattern.length; end += 1) {
      if (pattern[end] === "(") depth += 1;
      else if (pattern[end] === ")") {
        depth -= 1;
        if (depth === 0) return { start: index, end, text: pattern.slice(index, end + 1) };
      }
    }
  }
  return null;
}

/** Puts the capture group right after a keyword. */
function anchor(pattern, keyword) {
  const span = firstCapture(pattern);
  if (span === null) return null;
  const prefix = pattern.slice(0, span.start);
  const suffix = pattern.slice(span.end + 1);
  // A pattern that already carries its own keyword keeps it.
  if (prefix.length > 0) return null;
  return `${keyword}[^\\d]{0,15}${span.text}${suffix}`;
}

const changes = [];

for (const rel of FILES) {
  const path = join(ROOT, rel);
  const doc = JSON.parse(readFileSync(path, "utf8"));
  for (const rule of doc.rules ?? []) {
    if (rule.check?.type !== "numeric") continue;
    const original = rule.check.params.pattern;
    let next = original;
    const anchorWord = ANCHORS[rule.id];
    if (anchorWord !== undefined) {
      const anchored = anchor(original, anchorWord);
      if (anchored !== null) next = anchored;
    }
    next = addBoundaries(next);
    if (next === original) continue;
    try {
      // eslint-disable-next-line no-new
      new RegExp(next, rule.check.params.flags ?? "");
    } catch (error) {
      changes.push({ id: rule.id, from: original, to: next, skipped: `invalid regex: ${error.message}` });
      continue;
    }
    rule.check.params.pattern = next;
    changes.push({ id: rule.id, from: original, to: next });
  }
  if (APPLY) writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
}

console.log(`changed ${changes.length} numeric patterns`);
for (const change of changes) {
  console.log(`  ${change.id}`);
  console.log(`    - ${change.from}`);
  console.log(`    + ${change.to}${change.skipped ? `  (SKIPPED: ${change.skipped})` : ""}`);
}
if (!APPLY) console.log("\n(dry run — pass --apply to write)");
