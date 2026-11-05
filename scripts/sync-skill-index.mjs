// Regenerates the skill index and re-embeds it into the client half.
//
//   node scripts/sync-skill-index.mjs
//
// The panel has two index sources: the live host route (`GET /skill-index`,
// which reads the files on disk) and the copy baked into `client.js` (the
// offline fallback for a profile without a web server). When the two drift,
// the manual browser shows a different file list depending on whether the
// host route is reachable — which looks like a broken panel.
//
// This script regenerates `skill-index.json` and splices the same array into
// `client.js`, so the two can never disagree.
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

// 1. regenerate the index from the files on disk
execFileSync(process.execPath, [join(ROOT, "scripts", "build-skill-index.mjs")], {
  cwd: ROOT,
  stdio: "inherit",
});

const index = JSON.parse(readFileSync(join(ROOT, "skill-index.json"), "utf8"));

// 2. splice the same array into the client half
const clientPath = join(ROOT, "client.js");
const client = readFileSync(clientPath, "utf8");
const marker = "const SKILL_INDEX = [";
const start = client.indexOf(marker);
if (start === -1) throw new Error("client.js has no SKILL_INDEX block");

const arrayStart = start + marker.length - 1;
let depth = 0;
let end = -1;
for (let index_ = arrayStart; index_ < client.length; index_ += 1) {
  const char = client[index_];
  if (char === "[") depth += 1;
  else if (char === "]") {
    depth -= 1;
    if (depth === 0) {
      end = index_ + 1;
      break;
    }
  }
}
if (end === -1) throw new Error("client.js SKILL_INDEX block is not closed");

const literal = `const SKILL_INDEX = ${JSON.stringify(index, null, 2)}`;
const next = `${client.slice(0, start)}${literal}${client.slice(end)}`;
if (next === client) {
  console.log("✓ client.js already carries the current index");
} else {
  writeFileSync(clientPath, next, "utf8");
  console.log(`✓ embedded ${index.length} index entries into client.js`);
}

const hasAgents = index.some((entry) => String(entry.path).includes("AGENTS"));
console.log(`  skill-index.json: ${index.length} entries · AGENTS.md present: ${hasAgents}`);
