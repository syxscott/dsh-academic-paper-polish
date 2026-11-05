// Extracts files from app.asar into a local folder for reading.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

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
const outDir = process.argv[3] || 'D:/tmp/dsh-extract';

let n = 0;
for (const entry of entries) {
  if (!filter.test(entry.path)) continue;
  const text = buffer.subarray(base + entry.offset, base + entry.offset + entry.size);
  const out = join(outDir, entry.path);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, text);
  n += 1;
}
console.log(`extracted ${n} files to ${outDir}`);
