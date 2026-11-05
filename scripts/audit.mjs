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

if (failures > 0) {
  console.log(`\n${failures} audit failure(s)`);
  process.exit(1);
}
console.log('\nall audits passed');
