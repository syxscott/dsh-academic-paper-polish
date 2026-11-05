// Lists files inside app.asar and optionally greps one of them.
//   node scripts/asar-ls.mjs <path-filter-regex> [--grep <pattern>] [--context <n>]
import { readFileSync } from 'node:fs';

const ASAR =
  process.env.DSH_ASAR ||
  'C:/Users/Administrator/AppData/Local/Programs/DeepSeek Harness/resources/app.asar';

const buffer = readFileSync(ASAR);
const headerSize = buffer.readUInt32LE(4);
const jsonLength = buffer.readUInt32LE(12);
const header = JSON.parse(buffer.subarray(16, 16 + jsonLength).toString('utf8'));
const base = 8 + headerSize;

const entries = [];
(function walk(node, prefix) {
  for (const [name, entry] of Object.entries(node || {})) {
    const path = prefix ? `${prefix}/${name}` : name;
    if (entry.files) walk(entry.files, path);
    else if (entry.size) entries.push({ path, offset: Number(entry.offset), size: entry.size });
  }
})(header.files, '');

const filter = new RegExp(process.argv[2] || '.');
const grepIndex = process.argv.indexOf('--grep');
const contextIndex = process.argv.indexOf('--context');
const pattern = grepIndex > -1 ? new RegExp(process.argv[grepIndex + 1], 'g') : null;
const context = contextIndex > -1 ? Number(process.argv[contextIndex + 1]) : 0;

const matched = entries.filter((entry) => filter.test(entry.path));
if (!pattern) {
  console.log(`${matched.length} entries`);
  for (const entry of matched.slice(0, 400)) console.log(`${entry.size}\t${entry.path}`);
  process.exit(0);
}

for (const entry of matched) {
  const text = buffer.subarray(base + entry.offset, base + entry.offset + entry.size).toString('utf8');
  const lines = text.split(/\r?\n/);
  let printed = 0;
  for (let i = 0; i < lines.length && printed < 200; i += 1) {
    pattern.lastIndex = 0;
    if (!pattern.test(lines[i])) continue;
    printed += 1;
    const start = Math.max(0, i - context);
    const end = Math.min(lines.length, i + context + 1);
    console.log(`--- ${entry.path}:${i + 1}`);
    for (let j = start; j < end; j += 1) console.log(`${j + 1}\t${lines[j].slice(0, 400)}`);
  }
  if (printed) console.log(`=== ${entry.path}: ${printed} matches`);
}
