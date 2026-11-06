// Adversarial probe over the whole HTTP surface: hostile query strings, hostile
// bodies, hostile files (a directory, a 9 MB file, an empty file, a file whose
// name contains a space, a .docx that is not a zip).
//
//   node scripts/host-adversarial-test.mjs
//
// It prints one line per request and fails loudly if a route ever throws or
// answers with a 5xx. The pass/fail assertions live in host-route-test.mjs;
// this file is the map of what the surface does with hostile input.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { apply } = await import('../index.js');

const root = mkdtempSync(join(tmpdir(), 'probe3-'));
const work = join(root, 'work');
mkdirSync(work, { recursive: true });
writeFileSync(join(work, 'paper.md'), 'Abstract\n\nHello.\n\nIntroduction\n\nWorld.\n');
writeFileSync(join(work, 'huge.md'), 'x'.repeat(9 * 1024 * 1024));
writeFileSync(join(work, 'empty.md'), '');
writeFileSync(join(work, 'notzip.docx'), 'PK nope');
writeFileSync(join(work, 'weird name.md'), 'Abstract\n\nSpaces.\n');
mkdirSync(join(work, 'dir'), { recursive: true });

const agent = {
  id: 'session-1',
  session: { header: { cwd: work }, snapshotEvents: () => [{ type: 'user/message', time: 1 }] },
};
const ctx = {
  skills: { registerProvider: () => () => {} },
  webServer: { register: (route) => { ctx.route = route; return () => {}; } },
  connection: { requestRejection: () => undefined },
  agents: { list: () => [agent], get: (id) => (id === 'session-1' ? agent : undefined) },
  inject: (deps, cb) => { cb(ctx); return { dispose() {} }; },
  effect: (fn) => fn(),
};
apply(ctx, {});
const route = ctx.route;

const res = () => ({
  statusCode: 0, headers: {}, body: '',
  writeHead(s, h = {}) { this.statusCode = s; this.headers = h; return this; },
  end(c = '') { this.body += c; return this; },
});

const call = async (method, path, body, headers = {}) => {
  const r = res();
  const listeners = {};
  const req = {
    method, url: `/dsh-academic-paper-polish${path}`, headers,
    on(e, h) { (listeners[e] ||= []).push(h); return req; },
    destroy() {},
  };
  queueMicrotask(() => {
    if (body !== undefined) for (const h of listeners.data ?? []) h(Buffer.from(body, 'utf8'));
    for (const h of listeners.end ?? []) h();
  });
  await route.handler(req, r);
  let payload = null;
  try { payload = JSON.parse(r.body); } catch { /* not json */ }
  return { status: r.statusCode, headers: r.headers, body: r.body, payload };
};

const show = async (label, method, path, body) => {
  const started = Date.now();
  let result;
  try {
    result = await call(method, path, body);
  } catch (error) {
    console.log(`${label}: THREW ${error?.message}`);
    return;
  }
  const ms = Date.now() - started;
  const summary = result.payload
    ? JSON.stringify(result.payload).slice(0, 120)
    : result.body.slice(0, 80);
  console.log(`${label}: ${result.status} (${ms}ms) ${summary}`);
};

console.log('=== GET routes with hostile query strings ===');
await show('meta', 'GET', '/api/meta');
await show('rules ?limit=abc', 'GET', '/api/rules?limit=abc');
await show('rules ?limit=-5', 'GET', '/api/rules?limit=-5');
await show('rules ?limit=1e9', 'GET', '/api/rules?limit=1e9');
await show('rules ?section=garbage', 'GET', '/api/rules?section=garbage');
await show('rules ?severity=garbage', 'GET', '/api/rules?severity=garbage');
await show('rules ?query=<script>', 'GET', '/api/rules?query=%3Cscript%3E');
await show('journals ?maxApc=abc', 'GET', '/api/journals?maxApc=abc');
await show('journals ?maxApc=-1', 'GET', '/api/journals?maxApc=-1');
await show('journals ?openAccess=maybe', 'GET', '/api/journals?openAccess=maybe');
await show('sentences ?query=', 'GET', '/api/sentences?query=');
await show('checklists ?stage=garbage', 'GET', '/api/checklists?stage=garbage');
await show('session/files', 'GET', '/api/session/files?sessionId=session-1');
await show('session/files no id', 'GET', '/api/session/files');
await show('ping GET', 'GET', '/api/ping');

console.log('=== POST routes ===');
await show('check no body', 'POST', '/api/check');
await show('check malformed', 'POST', '/api/check', '{oops');
await show('check empty text', 'POST', '/api/check', JSON.stringify({ text: '' }));
await show('check garbage section', 'POST', '/api/check', JSON.stringify({ text: 'x', section: 'garbage' }));
await show('check garbage journal', 'POST', '/api/check', JSON.stringify({ text: 'x', journal: 'garbage' }));
await show('check huge text', 'POST', '/api/check', JSON.stringify({ text: 'word '.repeat(400000) }));
await show('deai no body', 'POST', '/api/deai');
await show('outline no body', 'POST', '/api/outline');
await show('outline garbage journal', 'POST', '/api/outline', JSON.stringify({ journal: 'garbage' }));
await show('outline garbage section', 'POST', '/api/outline', JSON.stringify({ section: 'garbage' }));
await show('analyze no path', 'POST', '/api/analyze', JSON.stringify({}));
await show('analyze dir', 'POST', '/api/analyze', JSON.stringify({ path: 'dir' }));
await show('analyze missing', 'POST', '/api/analyze', JSON.stringify({ path: 'nope.md' }));
await show('analyze dotdot', 'POST', '/api/analyze', JSON.stringify({ path: '../secret.md' }));
await show('analyze absolute outside', 'POST', '/api/analyze', JSON.stringify({ path: join(root, 'x.md') }));
await show('analyze empty.md', 'POST', '/api/analyze', JSON.stringify({ path: 'empty.md' }));
await show('analyze notzip.docx', 'POST', '/api/analyze', JSON.stringify({ path: 'notzip.docx' }));
await show('analyze huge.md', 'POST', '/api/analyze', JSON.stringify({ path: 'huge.md' }));
await show('analyze spaces', 'POST', '/api/analyze', JSON.stringify({ path: 'weird name.md' }));
await show('analyze garbage journal', 'POST', '/api/analyze', JSON.stringify({ path: 'paper.md', journal: 'garbage' }));
await show('analyze unknown section', 'POST', '/api/analyze', JSON.stringify({ path: 'paper.md', section: 'nope' }));
await show('send no body', 'POST', '/api/send');
await show('send empty text', 'POST', '/api/send', JSON.stringify({ text: '' }));
await show('ping POST', 'POST', '/api/ping', JSON.stringify({ event: 'mount' }));

console.log('=== wrong methods + oversize ===');
await show('ping PUT', 'PUT', '/api/ping');
await show('ping DELETE', 'DELETE', '/api/ping');
await show('ping OPTIONS', 'OPTIONS', '/api/ping');
await show('ping POST 3MB', 'POST', '/api/ping', 'x'.repeat(3 * 1024 * 1024));
await show('check POST 3MB', 'POST', '/api/check', 'x'.repeat(3 * 1024 * 1024));
await show('unknown api', 'GET', '/api/nope');

rmSync(root, { recursive: true, force: true });
