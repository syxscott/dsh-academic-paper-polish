// Reports the code size of the bundle, split by layer.
//
//   node scripts/code-metrics.mjs
//
// "Code" is measured as logical lines: non-blank lines that are not pure
// comments. The skill content is counted separately — it is data the agent
// reads, not code the runtime executes.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname, sep } from 'node:path';

const root = process.cwd();

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function logicalLines(text) {
  let code = 0;
  let comment = 0;
  let blank = 0;
  let inBlock = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (inBlock) {
      comment += 1;
      if (line.includes('*/')) inBlock = false;
      continue;
    }
    if (line === '') {
      blank += 1;
      continue;
    }
    if (line.startsWith('/*')) {
      comment += 1;
      if (!line.includes('*/')) inBlock = true;
      continue;
    }
    if (line.startsWith('//') || line.startsWith('*')) {
      comment += 1;
      continue;
    }
    code += 1;
  }
  return { code, comment, blank, total: code + comment + blank };
}

const files = walk(root);
const groups = new Map([
  ['host', []],
  ['client', []],
  ['skill content', []],
  ['rule database', []],
  ['scripts', []],
  ['preview code', []],
  ['preview assets', []],
  ['meta', []],
]);

for (const file of files) {
  const rel = relative(root, file).split(sep).join('/');
  if (rel.startsWith('skill/')) groups.get('skill content').push(rel);
  else if (rel === 'index.js' || rel.startsWith('lib/')) groups.get('host').push(rel);
  else if (rel === 'client.js') groups.get('client').push(rel);
  else if (rel.startsWith('scripts/')) groups.get('scripts').push(rel);
  else if (rel.startsWith('data/')) groups.get('rule database').push(rel);
  else if (rel.startsWith('preview/')) {
    if (/\.(png|jpg|jpeg|gif|webp)$/i.test(rel)) groups.get('preview assets').push(rel);
    else groups.get('preview code').push(rel);
  } else groups.get('meta').push(rel);
}

const rows = [];
for (const [group, list] of groups) {
  let bytes = 0;
  let code = 0;
  let comment = 0;
  let blank = 0;
  for (const rel of list) {
    const full = join(root, rel);
    const size = statSync(full).size;
    bytes += size;
    if (/\.(png|jpg|jpeg|gif|webp|woff2?)$/i.test(rel)) continue; // binary asset
    const stats = logicalLines(readFileSync(full, 'utf8'));
    code += stats.code;
    comment += stats.comment;
    blank += stats.blank;
  }
  rows.push({ group, files: list.length, bytes, code, comment, blank });
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);

console.log('\n=== bundle code size ===\n');
console.log(pad('layer', 16), rpad('files', 6), rpad('bytes', 11), rpad('code', 8), rpad('comment', 9), rpad('blank', 7));
console.log('-'.repeat(62));
let total = { files: 0, bytes: 0, code: 0, comment: 0, blank: 0 };
for (const row of rows) {
  if (row.files === 0) continue;
  console.log(
    pad(row.group, 16),
    rpad(row.files, 6),
    rpad(kb(row.bytes), 11),
    rpad(row.code, 8),
    rpad(row.comment, 9),
    rpad(row.blank, 7),
  );
  total.files += row.files;
  total.bytes += row.bytes;
  total.code += row.code;
  total.comment += row.comment;
  total.blank += row.blank;
}
console.log('-'.repeat(62));
console.log(
  pad('total', 16),
  rpad(total.files, 6),
  rpad(kb(total.bytes), 11),
  rpad(total.code, 8),
  rpad(total.comment, 9),
  rpad(total.blank, 7),
);

console.log('\n=== runtime code (what ships and executes) ===\n');
const host = readFileSync(join(root, 'index.js'), 'utf8');
const client = readFileSync(join(root, 'client.js'), 'utf8');
const hostStats = logicalLines(host);
const clientStats = logicalLines(client);
const cssRules = (client.match(/^\.dapp[^\n]*$/gm) || []).length;

// The bundled fallback index is data, not code: it is the copy of
// skill-index.json that keeps the panel searchable without the host route.
const indexStart = client.indexOf('const SKILL_INDEX = [');
const indexEnd = indexStart === -1 ? -1 : client.indexOf('];', indexStart);
const embeddedIndexLines =
  indexStart === -1 ? 0 : client.slice(indexStart, indexEnd).split(/\r?\n/).length;

console.log(`host  index.js    ${hostStats.total} lines total / ${hostStats.code} code / ${kb(host.length)}`);
const libFiles = readdirSync(join(root, 'lib')).filter((f) => f.endsWith('.mjs'));
let libCode = 0;
let libTotal = 0;
let libBytes = 0;
for (const name of libFiles) {
  const text = readFileSync(join(root, 'lib', name), 'utf8');
  const stats = logicalLines(text);
  libCode += stats.code;
  libTotal += stats.total;
  libBytes += Buffer.byteLength(text);
}
console.log(`host  lib/         ${libFiles.length} modules / ${libTotal} lines total / ${libCode} code / ${kb(libBytes)}`);
console.log(`client client.js  ${clientStats.total} lines total / ${clientStats.code} code / ${kb(client.length)}`);
console.log(`  JS logic        ${clientStats.code - cssRules - embeddedIndexLines} lines`);
console.log(`  inline CSS      ${cssRules} lines`);
console.log(`  bundled index   ${embeddedIndexLines} lines (data: ${kb(indexEnd === -1 ? 0 : indexEnd - indexStart)})`);

const skillFiles = walk(join(root, 'skill'));
const skillBytes = skillFiles.reduce((sum, f) => sum + statSync(f).size, 0);
const skillWords = skillFiles.reduce(
  (sum, f) => sum + readFileSync(f, 'utf8').split(/\s+/).filter(Boolean).length,
  0,
);
console.log(`\n=== skill content (read by the agent, not executed) ===\n`);
console.log(`files: ${skillFiles.length}   bytes: ${kb(skillBytes)}   words: ${skillWords.toLocaleString('en-US')}`);

const ratio = (total.code / skillWords) * 100;
console.log(`\ncode words : ${total.code.toLocaleString('en-US')}`);
console.log(`skill words: ${skillWords.toLocaleString('en-US')}`);
console.log(`code is ${ratio.toFixed(1)}% of the shipped content volume`);
console.log('');
