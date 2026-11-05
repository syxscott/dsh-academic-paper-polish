// Debug helper: find which frontend bundle carries a host module's CSS rules.
//
//   node scripts/find-host-css.mjs <module-substring>
import { readFileSync } from "node:fs";

const ASAR =
  process.env.DSH_ASAR ||
  "C:/Users/Administrator/AppData/Local/Programs/DeepSeek Harness/resources/app.asar";
const needle = process.argv[2] || "plugin-manager";

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

const module = entries.find((entry) => entry.path.includes(`dsh-client-ui-${needle}/lib/client.js`));
if (!module) {
  console.error(`✗ no module matched ${needle}`);
  process.exit(2);
}
const source = read(module);

// Every hashed class the module mentions: "Name": "Hash_prefix"
const classes = new Set();
for (const match of source.matchAll(/"([A-Za-z0-9_-]{6,})"\s*:\s*"([^"]+)"/g)) {
  const value = match[2];
  if (/^[A-Za-z0-9]{5,10}_[A-Za-z0-9_-]+$/.test(value)) classes.add(value);
}
console.log(`${needle}: ${classes.size} hashed class names`);
console.log("sample:", [...classes].slice(0, 8).join(", "));

const bundles = entries.filter((entry) => /\.css$/.test(entry.path));
for (const bundle of bundles) {
  const css = read(bundle);
  const hits = [...classes].filter((name) => css.includes(`.${name}`)).length;
  if (hits > 0) console.log(`  ${bundle.path}: ${hits}/${classes.size} classes present`);
}
