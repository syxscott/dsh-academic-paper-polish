// Reads the panel-activity beacon the live GUI writes.
//
//   node scripts/read-panel-activity.mjs
//
// The panel tells the host what it is doing (mount / view / error / unmount,
// the session id, the panel's own width), and the host persists it to
// <DSH_PROFILE_DIR>/.plugin-runtime/dsh-academic-paper-polish/panel-activity.json.
//
// This is the only channel that can confirm the REAL panel in the REAL GUI
// without touching the login cookie — the official guidance forbids fetching
// an auth token to take a screenshot.
//
//   DSH_ACADEMIC_PAPER_RUNTIME_DIR overrides the location.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

function runtimeDir() {
  const override = process.env.DSH_ACADEMIC_PAPER_RUNTIME_DIR;
  if (override) return override;
  const profile = process.env.DSH_PROFILE_DIR;
  if (profile) return join(profile, ".plugin-runtime", "dsh-academic-paper-polish");
  return join(ROOT, ".runtime");
}

const dir = runtimeDir();
const file = join(dir, "panel-activity.json");

if (!existsSync(file)) {
  console.log(`no beacon yet — nothing at ${file}`);
  console.log("");
  console.log("That means the browser has not loaded the panel client bundle since the");
  console.log("plugin was reloaded. Refresh the Harness page (Ctrl+Shift+R) and try again.");
  process.exit(0);
}

let entries = [];
try {
  const parsed = JSON.parse(readFileSync(file, "utf8"));
  entries = Array.isArray(parsed) ? parsed : (parsed.entries ?? []);
} catch (error) {
  console.log(`the beacon file is unreadable (${error.message}) — the host rewrites it on the next ping`);
  process.exit(1);
}

console.log(`beacon: ${file}`);
console.log(`entries: ${entries.length}`);
console.log("");

const widths = new Set();
const views = new Set();
let errors = 0;
for (const entry of entries) {
  const at = String(entry.at ?? "").slice(11, 19);
  const bits = [at, (entry.event ?? "").padEnd(8)];
  if (entry.view) bits.push(`view=${entry.view}`);
  if (entry.sessionId) bits.push(`session=${entry.sessionId}`);
  if (entry.width) {
    widths.add(entry.width);
    bits.push(`panel=${entry.width}px`);
  }
  if (entry.viewportWidth) bits.push(`viewport=${entry.viewportWidth}px`);
  console.log(`  ${bits.join("  ")}`);
  if (entry.event === "error" || entry.error) {
    errors += 1;
    console.log(`      ⚠ ${entry.error?.message ?? entry.error}`);
    if (entry.error?.stack) {
      console.log(
        String(entry.error.stack)
          .split("\n")
          .slice(0, 4)
          .map((line) => `        ${line}`)
          .join("\n"),
      );
    }
  }
}

console.log("");
console.log(`views seen : ${[...views].join(", ") || "(none)"}`);
console.log(`panel widths: ${[...widths].sort((a, b) => a - b).join(", ") || "(none)"} px`);
console.log(`errors      : ${errors}`);
if (errors > 0) process.exit(2);
