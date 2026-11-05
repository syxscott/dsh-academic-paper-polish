// Extracts the theme CSS strings out of the real DSH theme module.
//
//   node scripts/extract-theme-tokens.mjs [outFile]
//
// app.asar stores its files uncompressed, so the theme module
// (dsh/node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js) is read
// directly. Its CSS lives in template literals; the light and the dark alias
// blocks are written to the output as one stylesheet, which is what the
// standalone preview harness needs to render like the running application.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const ASAR =
  process.env.DSH_ASAR ||
  'C:/Users/Administrator/AppData/Local/Programs/DeepSeek Harness/resources/app.asar';
const OUT = process.argv[2] || 'preview/tokens.css';
const MARK = '--dsw-alias-bg-base:';

if (!existsSync(ASAR)) {
  console.error(`✗ app.asar not found at ${ASAR}`);
  process.exit(2);
}

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

const target = entries.find(
  (entry) => entry.path.endsWith('dsh-client-ui-theme/lib/client.js') && entry.size > 10_000,
);
if (!target) {
  console.error('✗ the theme module was not found in app.asar.');
  process.exit(1);
}

const source = buffer
  .subarray(base + target.offset, base + target.offset + target.size)
  .toString('utf8');

// Collect the theme stylesheets: the theme module keeps them as JS string
// literals named `*_css_default`.
const blocks = [];
const literalPattern = /var\s+(\w+_css_default)\s*=\s*("(?:[^"\\]|\\.)*")/g;
let match;
while ((match = literalPattern.exec(source)) !== null) {
  try {
    blocks.push({ name: match[1], css: JSON.parse(match[2]) });
  } catch {
    /* not a plain string literal */
  }
}

if (blocks.length === 0) {
  console.error('✗ no theme CSS literal was found.');
  process.exit(1);
}

for (const block of blocks) {
  console.log(`  ${block.name}: ${block.css.length} bytes`);
}

const css = `${blocks.map((block) => `/* ${block.name} */\n${block.css}`).join('\n')}\n`;
writeFileSync(OUT, css, 'utf8');
console.log(`\n✓ wrote ${OUT} (${css.length} bytes) from ${target.path}`);

const lightIndex = css.indexOf(':root');
const darkIndex = css.indexOf('body[data-ds-dark-theme]');
console.log(`  light block at ${lightIndex}, dark block at ${darkIndex}`);
const read = (from) => {
  const slice = css.slice(from);
  const name = '--dsw-alias-bg-layer-1:';
  const found = new RegExp(`${name}\\s*:\\s*([^;}]+)`).exec(slice);
  return found ? found[1].trim() : '(not defined)';
};
console.log(`  light bg-layer-1: ${read(lightIndex)}`);
console.log(`  dark  bg-layer-1: ${read(darkIndex)}`);
