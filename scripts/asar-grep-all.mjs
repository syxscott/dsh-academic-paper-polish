// Greps every file in app.asar for a pattern; prints path:line and the line.
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

const pathFilter = new RegExp(process.argv[2] || '.');
const pattern = new RegExp(process.argv[3] || '.');
const maxTotal = Number(process.argv[4] || 200);

let total = 0;
for (const entry of entries) {
  if (!pathFilter.test(entry.path)) continue;
  if (!/\.(js|mjs|cjs|ts|tsx)$/.test(entry.path)) continue;
  let text;
  try {
    text = buffer.subarray(base + entry.offset, base + entry.offset + entry.size).toString('utf8');
  } catch {
    continue;
  }
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    if (!pattern.test(lines[i])) continue;
    console.log(`${entry.path}:${i + 1}\t${lines[i].slice(0, 300)}`);
    total += 1;
    if (total >= maxTotal) {
      console.log(`=== stopped at ${maxTotal} matches`);
      process.exit(0);
    }
  }
}
console.log(`=== ${total} matches`);
