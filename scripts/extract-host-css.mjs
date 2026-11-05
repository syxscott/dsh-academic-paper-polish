// Extracts a host client module's real CSS out of app.asar.
//
//   node scripts/extract-host-css.mjs [module-substring] [outFile]
//
// The official guidance for a plugin panel is to "copy spacing, type sizes, and
// row patterns from an existing host page of the same kind". The Plugin
// Manager page is the reference for a management list in the same right
// sidebar.
//
// Two shapes exist in the shipped app:
//
//   1. a module whose CSS is a plain string literal in `lib/client.js`
//      (e.g. the theme module) — the string is the stylesheet;
//   2. a module built with CSS modules (e.g. the Plugin Manager) — `lib/client.js`
//      only maps `exportName -> hashedClassName`, and the actual rules live in
//      the frontend bundle `dsh-web-frontend/dist/assets/index-*.css`.
//
// This script handles both: it finds the hashed class names the module uses
// and lifts the matching rules out of the frontend bundle.
//
//   node scripts/extract-host-css.mjs plugin-manager preview/host-plugin-manager.css
//
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const ASAR =
  process.env.DSH_ASAR ||
  "C:/Users/Administrator/AppData/Local/Programs/DeepSeek Harness/resources/app.asar";
const needle = process.argv[2] || "plugin-manager";
const outFile = process.argv[3] || `preview/host-${needle}.css`;

const buffer = readFileSync(ASAR);
const headerSize = buffer.readUInt32LE(4);
const jsonLength = buffer.readUInt32LE(12);
const header = JSON.parse(buffer.subarray(16, 16 + jsonLength).toString("utf8"));
const base = 8 + headerSize;

const entries = [];
(function walk(node, prefix) {
  for (const [name, entry] of Object.entries(node || {})) {
    const path = prefix ? `${prefix}/${name}` : name;
    if (entry.files) walk(entry.files, path);
    else if (entry.size) entries.push({ path, offset: Number(entry.offset), size: entry.size });
  }
})(header.files, "");

const read = (entry) =>
  buffer.subarray(base + entry.offset, base + entry.offset + entry.size).toString("utf8");

// 1. the frontend bundle holds the real rules for every CSS-module class
const bundle = entries.find((entry) => /dsh-web-frontend\/dist\/assets\/index-.*\.css$/.test(entry.path));
if (!bundle) {
  console.error("✗ the frontend CSS bundle was not found in app.asar");
  process.exit(2);
}
const bundleCss = read(bundle);

// 2. the module's own JS names the hashed classes it uses
const modules = entries.filter(
  (entry) => entry.path.includes(`dsh-client-ui-${needle}/lib/client.js`) && entry.size > 50_000,
);
if (modules.length === 0) {
  console.error(`✗ no host client module matched "${needle}"`);
  process.exit(2);
}

const hashes = new Set();
let plainBlocks = [];
for (const entry of modules) {
  const source = read(entry);
  const literal = /var\s+(\w+_css_default)\s*=\s*("(?:[^"\\]|\\.)*")/g;
  let match;
  while ((match = literal.exec(source)) !== null) {
    try {
      plainBlocks.push({ name: match[1], css: JSON.parse(match[2]) });
    } catch {
      /* not a plain string literal */
    }
  }
  // CSS-module maps: "exportName": "HashedName"
  for (const map of source.matchAll(/["'](\w+)["']\s*:\s*["']([A-Za-z0-9_-]{4,})["']/g)) {
    const value = map[2];
    // hashed module class names look like `V7pFBG_actions` — a short hash prefix + a name
    if (/^[A-Za-z0-9]{4,8}_[A-Za-z0-9_-]+$/.test(value)) hashes.add(value);
  }
}

const out = [];
if (plainBlocks.length > 0) {
  for (const block of plainBlocks) out.push(`/* ${block.name} */\n${block.css}`);
  console.log(`✓ ${plainBlocks.length} inline css block(s) from ${modules[0].path}`);
} else {
  // The module's own bundle carries the CSS text for its hashed classes.
  const own = modules.map((entry) => read(entry)).join("\n");
  const candidates = own.match(/[^{}]{1,400}\{[^{}]{0,600}\}/g) ?? [];
  const selected = candidates.filter((rule) => {
    const selector = rule.slice(0, rule.indexOf("{"));
    if (!/[.#][A-Za-z0-9_-]+/.test(selector)) return false;
    if (!/:\s*[^;{}]+;/.test(rule)) return false; // has to look like a declaration block
    return [...hashes].some((hash) => selector.includes(`.${hash}`));
  });
  out.push(
    `/* ${needle}: ${selected.length} rules from ${modules[0].path} */`,
    ...selected.map((rule) => rule.trim()),
  );
  console.log(`✓ ${modules[0].path}`);
  console.log(`  ${hashes.size} hashed class names, ${selected.length} matching rules`);
  if (selected.length === 0) {
    const loose = candidates.filter((rule) => /:\s*[^;{}]+;/.test(rule));
    console.log(`  (${loose.length} declaration blocks total in the module)`);
  }
}

const css = `${out.join("\n")}\n`;
const target = resolve(process.cwd(), outFile);
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, css, "utf8");
console.log(`  → ${outFile} (${(css.length / 1024).toFixed(1)} KB)`);
