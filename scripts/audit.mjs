// CI-style static audits for the plugin, following the ecosystem pattern of
// invariant scans instead of test frameworks. Exits non-zero on any violation.
// Run: node scripts/audit.mjs
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

let failures = 0;
const fail = (message) => {
  failures += 1;
  console.log(`✗ ${message}`);
};
const ok = (message) => console.log(`✓ ${message}`);

const client = readFileSync('client.js', 'utf8');
const host = readFileSync('index.js', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

// 1. syntax gate on both halves
for (const file of ['client.js', 'index.js']) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    ok(`syntax ${file}`);
  } catch (error) {
    fail(`syntax ${file}: ${String(error.stderr).slice(0, 200)}`);
  }
}

// 2. localStorage keys: every written key must also be read
const writes = [...client.matchAll(/write(?:Store|Checked)\(\s*'([^']+)'|localStorage\.(?:setItem|removeItem)\('[^']+'\s*\+\s*([^),]+)|localStorage\.(?:setItem|removeItem)\('([^']+)'/g)].map((m) => m[1] || m[3] || (m[2] ? `<dynamic:${m[2].trim()}>` : null)).filter(Boolean);
const reads = [...client.matchAll(/read(?:Store|Checked)\(\s*'([^']+)'|localStorage\.getItem\('[^']+'\s*\+\s*([^),]+)|localStorage\.getItem\('([^']+)'/g)].map((m) => m[1] || m[3] || (m[2] ? `<dynamic:${m[2].trim()}>` : null)).filter(Boolean);
const dead = writes.filter((key) => !reads.includes(key) && !key.includes('view'));
if (dead.length > 0) fail(`dead localStorage keys (written, never read): ${dead.join(', ')}`);
else ok(`localStorage keys coherent (${writes.length} written / ${reads.length} read)`);

// 3. dangerouslySetInnerHTML allowlist: only the panel CSS injection
const htmlInjections = [...client.matchAll(/dangerouslySetInnerHTML/g)].length;
if (htmlInjections !== 1) fail(`dangerouslySetInnerHTML count is ${htmlInjections}, allowlist expects exactly 1 (the panel CSS <style>)`);
else ok('innerHTML surface within allowlist (1: panel CSS only)');

// 4. z-index invariant: the panel must never fight host chrome
const zIndexUses = [...client.matchAll(/z-index\s*:\s*(\d+)/g)].map((m) => Number(m[1]));
const tooHigh = zIndexUses.filter((v) => v > 10);
if (tooHigh.length > 0) fail(`z-index above 10 (${tooHigh.join(', ')}) — floating above host chrome is forbidden`);
else ok(zIndexUses.length ? `z-index contained (${zIndexUses.join(', ')} — in-container layering only)` : 'no z-index anywhere');

// 5. no external URLs: no CDN, no telemetry
//    `http://localhost` is only a URL-parsing base (the official DSH routes use
//    it) — it never performs a request, so it is allowlisted.
const LOCAL_BASES = new Set(['http://localhost', 'http://local']);
const externalUrls = [
  ...client.matchAll(/https?:\/\/[a-z0-9.-]+/gi),
  ...host.matchAll(/https?:\/\/[a-z0-9.-]+/gi),
]
  .map((m) => m[0])
  .filter((url) => !url.includes('github.com')) // attributions in comments are fine
  .filter((url) => !LOCAL_BASES.has(url));
if (externalUrls.length > 0) fail(`external URLs reachable from runtime code: ${externalUrls.join(', ')}`);
else ok('no external network calls in runtime code');

// 6. fetch surface allowlist: client may only talk to this plugin's route.
//    All three quote styles are matched — a template literal must not be able
//    to slip a foreign origin past this check.
const fetches = [...client.matchAll(/fetch\(\s*(['"`])([^'"`]+)\1/g)].map((m) => m[2]);
const badFetches = fetches.filter((url) => !url.startsWith('/dsh-academic-paper-polish/'));
if (badFetches.length > 0) fail(`fetch() targets outside the plugin route: ${badFetches.join(', ')}`);
else ok(`fetch surface scoped to the plugin route (${fetches.length} call site[s])`);

// 6b. every CSS custom property used by the panel must be defined by the panel
const definedVars = new Set([...client.matchAll(/(--dapp-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
const usedVars = new Set([
  ...[...client.matchAll(/var\(\s*(--dapp-[a-z0-9-]+)/g)].map((m) => m[1]),
  ...[...client.matchAll(/color-mix\([^)]*var\(\s*(--dapp-[a-z0-9-]+)/g)].map((m) => m[1]),
]);
const missingVars = [...usedVars].filter((name) => !definedVars.has(name));
if (missingVars.length > 0) fail(`CSS variables used but never defined: ${missingVars.join(', ')}`);
else ok(`CSS variables all defined (${usedVars.size} used / ${definedVars.size} defined)`);

// 7. manifest sanity: semver-ish version, engines.dsh declared, files whitelist covers runtime
if (!/^\d+\.\d+\.\d+$/.test(pkg.version)) fail(`package version "${pkg.version}" is not plain semver`);
else ok(`version ${pkg.version}`);
if (!pkg.engines || !pkg.engines.dsh) fail('engines.dsh not declared');
else ok(`engines.dsh ${pkg.engines.dsh}`);
for (const entry of ['index.js', 'client.js', 'cordis.patch.yml', 'skill']) {
  if (!pkg.files.includes(entry) && !pkg.files.some((f) => f === entry)) fail(`files whitelist missing "${entry}"`);
}
ok('files whitelist checked');

// 8. skill SKILL.md must still carry the DSH adapter placeholder section
const skill = readFileSync('skill/academic-paper-polish/SKILL.md', 'utf8');
if (!skill.includes('{{SKILL_DIR}}') && !skill.includes('resourceBase')) {
  // the shipped copy keeps the placeholder; the installed .agents copy has it resolved
  fail('skill SKILL.md lost the {{SKILL_DIR}} adapter');
} else ok('skill adapter section present');

// 9. Harness interaction conformance (rules from the official
//    cordis-plugin-development skill: references/host-plugin.md,
//    references/ui-plugin.md, references/practices.md).
//
// 9a. the client module id must equal the package name (the module loader
//     keys the factory by it and the boot graph by it).
const moduleId = /window\.__ModuleLoader__\.load\(\{\s*id:\s*'([^']+)'/.exec(client);
if (!moduleId) fail('client.js does not register through window.__ModuleLoader__.load');
else if (moduleId[1] !== pkg.name) fail(`client module id "${moduleId[1]}" != package name "${pkg.name}"`);
else ok(`client module id matches the package name (${pkg.name})`);

// 9b. require() in the client half may only name platform seed words — the
//     module table has no npm resolution for a third-party bundle.
const SEED_WORDS = new Set([
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client',
  '@deepseek-ai/cordis', 'zod', '@tanstack/react-virtual',
  '@deepseek-ai/dsh-client-store', '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives', '@deepseek-ai/dsh-client-ui-dockkit',
]);
const required = [...client.matchAll(/\brequire\(\s*'([^']+)'/g)].map((m) => m[1]);
const badRequires = required.filter((spec) => !SEED_WORDS.has(spec) && !spec.startsWith('./'));
if (badRequires.length > 0) fail(`require() of a non-seed module: ${badRequires.join(', ')}`);
else ok(`client require() uses platform seed words only (${required.length} call site[s])`);

// 9c. the official rule forbids loading Harness Client packages as modules.
if (/dsh-client-ui-primitives/.test(client)) {
  fail('the client half imports @deepseek-ai/dsh-client-ui-primitives (forbidden by the official guidance)');
} else ok('no Harness Client package imported as a module');

// 9d. locale registration must sit inside ctx.effect so its disposer is
//     owned by the plugin context.
const localeIndex = client.indexOf('ctx.locale.register');
if (localeIndex >= 0) {
  const window = client.slice(Math.max(0, localeIndex - 220), localeIndex);
  if (!/ctx\.effect\(/.test(window)) fail('ctx.locale.register is not wrapped in ctx.effect (the disposer would be dropped)');
  else ok('locale registration is owned by ctx.effect');
}

// 9e. a plugin must not mount a second application or embed an iframe.
//     A body-append is allowed only in the clipboard-fallback shape: a
//     hidden <textarea> attached and removed synchronously inside one
//     function (the document.execCommand('copy') legacy path).
const bodyAppends = [...client.matchAll(/document\.body\.appendChild\((\w+)\)/g)];
const clipboardPattern = bodyAppends.length > 0
  && bodyAppends.every((m) => client.includes(`document.body.removeChild(${m[1]})`))
  && /execCommand\('copy'\)/.test(client);
if (bodyAppends.length > 0 && !clipboardPattern) fail('the client half appends to document.body outside the clipboard fallback');
else if (bodyAppends.length > 0) ok('document.body append is the clipboard fallback only (attached + removed in one call)');
else ok('no document.body append');
if (/<iframe/i.test(client)) fail('the client half embeds an iframe (no theme/locale inheritance)');
else ok('no iframe embedding');

// 9f. the route prefix must match the runtime rule: no trailing slash.
const routePath = /path:\s*"([^"]+)"/.exec(host);
if (!routePath) fail('no host route path found');
else if (routePath[1].endsWith('/')) fail(`host route path "${routePath[1]}" ends with "/" and can never match`);
else ok(`host route prefix matches the runtime rule ("${routePath[1]}")`);

// ── 10. v3.0 capability layer ───────────────────────────────────────────────
// The plugin must expose capabilities the agent can CALL, not only prose it
// can read: five model-facing tools, five slash commands, one always-on
// prompt section, and one JSON API that the client panel reads.
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const libFiles = existsSync('lib') ? readdirSync('lib').filter((f) => f.endsWith('.mjs')) : [];
const libSource = libFiles.map((f) => readFileSync(join('lib', f), 'utf8')).join('\n');
const hostAll = `${host}\n${libSource}`;

const TOOLS = ['paper_check', 'paper_rules', 'paper_journals', 'paper_outline', 'paper_deai'];
const COMMANDS = ['paper-check', 'paper-rules', 'paper-journals', 'paper-outline', 'paper-deai'];
const API_ROUTES = [
  '/api/meta', '/api/rules', '/api/journals', '/api/checklists', '/api/sentences',
  '/api/check', '/api/deai', '/api/outline', '/api/send',
];

if (libFiles.length === 0) fail('lib/ is missing — the host capability layer has no modules');
else ok(`host capability modules present (${libFiles.length}: ${libFiles.join(', ')})`);

// 10a. the tools must be registered with the harness tool registry.
if (!/\btools\s*\.\s*register\s*\(/.test(hostAll)) fail('the host never calls ctx.tools.register — the agent has no tools to call');
else ok('ctx.tools.register is called');
const missingTools = TOOLS.filter((t) => !hostAll.includes(`'${t}'`) && !hostAll.includes(`"${t}"`));
if (missingTools.length > 0) fail(`model-facing tools not declared: ${missingTools.join(', ')}`);
else ok(`all ${TOOLS.length} paper_* tools declared`);

// 10b. every tool must carry a description (that is how the model discovers it).
const toolDescriptions = [...hostAll.matchAll(/description:\s*(['"`])((?:\\.|(?!\1).)*)\1/g)].map((m) => m[2]);
const toolNamesFound = TOOLS.filter((t) => toolDescriptions.some((d) => d.includes(t)));
if (toolNamesFound.length !== TOOLS.length) {
  fail(`tool descriptions do not mention every tool (missing: ${TOOLS.filter((t) => !toolNamesFound.includes(t)).join(', ')})`);
} else ok('every tool is named in its own description (discoverable)');

// 10c. slash commands.
if (!/\bcommands\s*\.\s*register\s*\(/.test(hostAll)) fail('the host never calls ctx.commands.register — no human entry point');
else ok('ctx.commands.register is called');
const missingCommands = COMMANDS.filter((c) => !hostAll.includes(`'${c}'`) && !hostAll.includes(`"${c}"`));
if (missingCommands.length > 0) fail(`slash commands not declared: ${missingCommands.join(', ')}`);
else ok(`all ${COMMANDS.length} slash commands declared`);

// 10d. the always-on prompt section: this is the glue that makes the plugin
//      get used without the user asking for it.
const sectionAt = hostAll.indexOf('systemPrompt.section');
if (sectionAt < 0) fail('the host never registers a system prompt section — the agent will not know the capabilities exist');
else {
  const window = hostAll.slice(sectionAt, sectionAt + 900);
  const quoted = [...window.matchAll(/(['"`])((?:\\.|(?!\1).){40,})\1/g)].map((m) => m[2]);
  const sectionText = quoted.join('\n');
  const named = TOOLS.filter((t) => sectionText.includes(t));
  if (named.length !== TOOLS.length) {
    fail(`the prompt section does not name every tool (missing: ${TOOLS.filter((t) => !named.includes(t)).join(', ')})`);
  } else ok('the prompt section names all five tools');
  if (sectionText.length > 600) fail(`the prompt section is ${sectionText.length} chars — it is injected into EVERY request, keep it under 600`);
  else ok(`prompt section stays short (${sectionText.length} chars)`);
}

// 10e. the JSON API the client panel reads.
const missingRoutes = API_ROUTES.filter((r) => !hostAll.includes(r));
if (missingRoutes.length > 0) fail(`panel API routes missing: ${missingRoutes.join(', ')}`);
else ok(`all ${API_ROUTES.length} panel API routes present`);

// 10f. the runtime data must ship with the bundle.
for (const entry of ['data', 'lib']) {
  if (!pkg.files.includes(entry)) fail(`files whitelist missing "${entry}"`);
}
ok('files whitelist covers data/ and lib/');

// 10g. the rule database must be loadable and internally consistent.
const DATA_DIR = 'data';
const RULE_FILES = ['rules/writing.json', 'rules/figures.json', 'rules/submission.json'];
const CHECK_TYPES = new Set([
  'manual', 'forbidden', 'required', 'count', 'wordCount', 'numeric', 'citationDensity', 'sectionOrder',
]);
const seenRuleIds = new Set();
let ruleTotal = 0;
for (const rel of RULE_FILES) {
  const file = join(DATA_DIR, rel);
  if (!existsSync(file)) {
    fail(`rule database file missing: ${file}`);
    continue;
  }
  let doc;
  try {
    doc = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`rule database ${file} is not valid JSON: ${error.message}`);
    continue;
  }
  for (const rule of doc.rules ?? []) {
    ruleTotal += 1;
    if (seenRuleIds.has(rule.id)) fail(`duplicate rule id "${rule.id}"`);
    seenRuleIds.add(rule.id);
    if (!CHECK_TYPES.has(rule.check?.type)) fail(`rule "${rule.id}" has unknown check.type "${rule.check?.type}"`);
    if (!rule.source?.file || typeof rule.source?.line !== 'number') fail(`rule "${rule.id}" has no verifiable source`);
    if (!rule.sections?.length) fail(`rule "${rule.id}" applies to no section`);
  }
}
ok(`rule database consistent (${ruleTotal} rules across ${RULE_FILES.length} files)`);

// 10g2. a journal-scoped rule must name a journal that exists.
const JOURNAL_KEYS = new Set(
  (JSON.parse(readFileSync(join(DATA_DIR, 'journals.json'), 'utf8')).journals ?? []).map((j) => j.key),
);
let scopedRules = 0;
for (const rel of RULE_FILES) {
  const file = join(DATA_DIR, rel);
  if (!existsSync(file)) continue;
  let doc;
  try {
    doc = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    continue;
  }
  for (const rule of doc.rules ?? []) {
    if (rule.journals === undefined) continue;
    scopedRules += 1;
    if (!Array.isArray(rule.journals) || rule.journals.length === 0) {
      fail(`rule "${rule.id}" has an empty journals array`);
      continue;
    }
    for (const key of rule.journals) {
      if (!JOURNAL_KEYS.has(key)) fail(`rule "${rule.id}" names an unknown journal key "${key}"`);
    }
  }
}
if (scopedRules === 0) fail('no rule carries a journals scope — journal-specific rules would fire for every manuscript');
else ok(`journal scoping consistent (${scopedRules} journal-scoped rules)`);

for (const rel of ['journals.json', 'sentences.json', 'checklists.json']) {
  const file = join(DATA_DIR, rel);
  if (!existsSync(file)) {
    fail(`data file missing: ${file}`);
    continue;
  }
  try {
    JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`data file ${file} is not valid JSON: ${error.message}`);
  }
}
ok('journal / sentence / checklist databases parse');

// 10h. the client half must read the rule corpus from the API, never embed it.
if (!/\/dsh-academic-paper-polish\/api\//.test(client)) fail('the client never calls the host API — the panel would have to hardcode the rule base');
else ok('the client reads its content from the host API');
if (/["']severity["']\s*:/.test(client)) fail('the client embeds rule objects (severity literals) — rule data must come from the API');
else ok('the client embeds no rule objects');

// 10i. a panel-authored message must carry a custom source kind, never
//      `kind: "user"`. The harness treats a `user/message` with
//      `source.kind === "user"` as DIRECT HUMAN INPUT, and `dsh-tool-goal`
//      grants the goal tools complete/blocked authority over those — a
//      plugin must not be able to close a human's goal.
if (!/academic-paper-polish/.test(libSource)) {
  fail('the host never marks a panel-authored message with a custom source kind');
} else ok('panel-authored messages carry a custom source kind');
if (/kind\s*:\s*["']user["']/.test(libSource)) {
  fail('the host sends a panel-authored message with source.kind "user" — it would be treated as direct human input');
} else ok('the host never sends panel messages as source.kind "user"');

if (failures > 0) {
  console.log(`\n${failures} audit failure(s)`);
  process.exit(1);
}
console.log('\nall audits passed');
