// Generates the REAL host answers for the preview harness:
//   preview/fixtures/responses.js
//
// The payloads are produced by the plugin's own host modules
// (lib/session.mjs → discoverManuscripts, lib/analyze.mjs → analyzeManuscript)
// over the fixture manuscripts under preview/fixtures/. Nothing here is mocked.
//
//   node "C:/Users/Administrator/AppData/Local/Temp/dsh-fixture-gen.mjs"
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const PLUGIN = resolve('D:/文档/编程项目/agent闲聊/dsh-academic-paper-polish');
const load = async (rel) => import(pathToFileURL(join(PLUGIN, rel)).href);
const { discoverManuscripts, toPosix } = await load('lib/session.mjs');
const { analyzeManuscript } = await load('lib/analyze.mjs');
const { extractText, formatOf } = await load('lib/docx.mjs');

const fixtures = ['single', 'ambiguous', 'empty'];
const out = { generatedBy: 'lib/session.mjs + lib/analyze.mjs over preview/fixtures/', journal: 'palaeontology', fixtures: {} };
const analyses = {};
const byName = new Map();

for (const name of fixtures) {
  const cwd = join(PLUGIN, 'preview', 'fixtures', name);
  const discovery = discoverManuscripts(cwd);
  const map = {};
  for (const file of discovery.files) {
    const format = formatOf(file.path);
    if (!format || !['docx', 'md', 'txt', 'tex', 'rtf'].includes(format)) continue;
    let id = byName.get(file.name);
    if (id === undefined) {
      const extracted = extractText(file.path);
      id = `a${byName.size + 1}`;
      byName.set(file.name, id);
      analyses[id] = analyzeManuscript({
        text: extracted.text,
        format,
        path: toPosix(file.path),
        name: file.name,
        bytes: file.bytes,
        journal: out.journal,
      });
    }
    map[toPosix(file.path)] = id;
  }
  out.fixtures[name] = {
    cwd: toPosix(cwd),
    files: { sessionId: 'preview-session', cwd: toPosix(cwd), files: discovery.files, best: discovery.best },
    map,
  };
  console.log(`── ${name} ── cwd=${toPosix(cwd)}`);
  console.log(`   best=${discovery.best}`);
  for (const file of discovery.files) {
    console.log(`   ${String(file.score).padStart(4)}  ${file.kind.padEnd(10)} ${file.name}`);
  }
  for (const [path, id] of Object.entries(map)) {
    const analysis = analyses[id];
    console.log(
      `   analysis ${id} ${path.split('/').pop()}: ${analysis.report.length} sections, ` +
        `${analysis.summary.total} violations (h${analysis.summary.hard}/s${analysis.summary.soft}/i${analysis.summary.info}), ` +
        `deai ${analysis.deai.score}`,
    );
    for (const entry of analysis.report) {
      console.log(
        `      · ${entry.section.padEnd(14)} ${String(entry.words).padStart(5)}w  ` +
          `${entry.violations.length}v / ${entry.advice.length}a  ${entry.title}`,
      );
    }
  }
}

out.analyses = analyses;
const banner = `// GENERATED FILE — do not edit by hand.
//
// The REAL answers of the plugin's host modules for the fixture manuscripts
// under preview/fixtures/. Regenerate with:
//
//   node "C:/Users/Administrator/AppData/Local/Temp/dsh-fixture-gen.mjs"
//
// (the generator lives outside the repository on purpose: the plugin's write
// scopes keep scripts/ owned by the lead).
`;
const json = JSON.stringify(out);
writeFileSync(join(PLUGIN, 'preview', 'fixtures', 'responses.js'), `${banner}window.__PREVIEW_MANUSCRIPT__ = ${json};\n`, 'utf8');
console.log(`\nwritten preview/fixtures/responses.js (${(json.length / 1024).toFixed(0)} KB)`);

