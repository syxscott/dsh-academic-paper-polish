// Extracts the inline <script> blocks from preview/interaction-test.html and
// syntax-checks each one, so a stray brace is reported with its source line.
//
//   node scripts/check-inline-scripts.mjs
import { readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const file = join(resolve(here, '..'), 'preview', 'interaction-test.html');
const html = readFileSync(file, 'utf8');

const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
let bad = 0;
blocks.forEach((block, index) => {
  const source = block[1];
  try {
    new vm.Script(source, { filename: `inline-${index}.js` });
    console.log(`✓ inline script #${index} parses (${source.split('\n').length} lines)`);
  } catch (error) {
    bad += 1;
    console.log(`✗ inline script #${index}: ${error.message}`);
    const stack = String(error.stack || '').split('\n');
    const located = stack.find((l) => /inline-\d+\.js:\d+/.test(l)) || '';
    const line = Number(located.match(/inline-\d+\.js:(\d+)/)?.[1] || 0);
    if (line) {
      const lines = source.split('\n');
      for (let i = Math.max(0, line - 4); i < Math.min(lines.length, line + 3); i += 1) {
        console.log(`   ${String(i + 1).padStart(4)} ${i + 1 === line ? '>' : ' '} ${lines[i]}`);
      }
    }
  }
});
process.exit(bad === 0 ? 0 : 1);
