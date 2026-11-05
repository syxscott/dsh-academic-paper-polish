// Runs preview/interaction-test.html in headless Chromium over CDP and prints
// the assertion report.
//
//   node scripts/run-interaction-test.mjs
//
// The harness page is a plain file:// document, so a fresh --user-data-dir is
// required for every run: Chrome otherwise serves the cached client.js. The
// page signals completion through document.title ("DONE:<failures>"), which
// lets this driver wait deterministically instead of guessing a sleep time.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const page = join(root, 'preview', 'interaction-test.html');

const candidates = [
  process.env.DSH_CHROME,
  'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1252/chrome-win64/chrome.exe',
  'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1247/chrome-win64/chrome.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].filter(Boolean);

const chrome = candidates.find((p) => existsSync(p));
if (!chrome) {
  console.error('✗ no Chromium binary found. Set DSH_CHROME.');
  process.exit(2);
}

const PORT = Number(process.env.DSH_CDP_PORT || 9344);
const profileDir = mkdtempSync(join(tmpdir(), 'dsh-ix-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const child = spawn(
  chrome,
  [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profileDir}`,
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--allow-file-access-from-files',
    '--hide-scrollbars',
    '--window-size=420,900',
    pathToFileURL(page).href,
  ],
  { detached: true, stdio: 'ignore' },
);
child.unref();

async function listTargets() {
  const response = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  return response.json();
}

async function waitForTarget() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const list = await listTargets();
      const pageTarget = list.find((item) => item.type === 'page' && item.webSocketDebuggerUrl);
      if (pageTarget) return pageTarget;
    } catch {
      /* browser not up yet */
    }
    await sleep(250);
  }
  throw new Error('no CDP page target');
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.addEventListener('open', () => resolve(socket));
    socket.addEventListener('error', reject);
  });
}

function rpc(socket, method, params = {}) {
  const id = rpc.nextId += 1;
  return new Promise((resolve, reject) => {
    const onMessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== id) return;
      socket.removeEventListener('message', onMessage);
      if (message.error) reject(new Error(`${method}: ${message.error.message}`));
      else resolve(message.result);
    };
    socket.addEventListener('message', onMessage);
    socket.send(JSON.stringify({ id, method, params }));
  });
}
rpc.nextId = 0;

async function evaluate(socket, expression) {
  const result = await rpc(socket, 'Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    return { error: result.exceptionDetails.text };
  }
  return { value: result.result.value };
}

let exitCode = 1;
try {
  const pageTarget = await waitForTarget();
  const socket = await connect(pageTarget.webSocketDebuggerUrl);
  await rpc(socket, 'Page.enable');
  await rpc(socket, 'Runtime.enable');
  await rpc(socket, 'Log.enable');

  const logEntries = [];
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.method === 'Log.entryAdded') {
      const e = message.params.entry;
      logEntries.push(`[${e.source}/${e.level}] ${e.text}${e.url ? ` @ ${e.url}:${e.lineNumber}` : ''}`);
    }
    if (message.method === 'Runtime.exceptionThrown') {
      const d = message.params.exceptionDetails;
      logEntries.push(
        `[exception] ${d.text} ${d.url ? `@ ${d.url}:${d.lineNumber}:${d.columnNumber}` : ''} ${d.exception?.description || ''}`,
      );
    }
  });

  let title = '';
  await rpc(socket, 'Page.reload', { ignoreCache: true });
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await sleep(250);
    const probe = await evaluate(socket, 'document.title');
    title = (probe && probe.value) || '';
    if (title.startsWith('DONE:')) break;
  }

  if (!title.startsWith('DONE:')) {
    const errors = await evaluate(
      socket,
      'JSON.stringify({ errors: window.__errors || [], report: document.getElementById("report").textContent, hasDef: !!window.__definition })',
    );
    console.error('✗ the harness never finished.');
    console.error(errors.value || errors.error || '(no diagnostics)');
    if (logEntries.length) {
      console.error('--- browser log ---');
      logEntries.forEach((entry) => console.error(entry));
    }
    socket.close();
    exitCode = 1;
  } else {
    const report = await evaluate(socket, 'document.getElementById("report").textContent');
    console.log(report.value);
    const failed = (report.value || '').split('\n').filter((l) => l.startsWith('✗')).length;
    console.log(`\nfailures=${failed}`);
    exitCode = failed === 0 ? 0 : 1;
  }
} catch (error) {
  console.error(`✗ driver error: ${error && error.message}`);
} finally {
  try {
    rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {
    /* chrome may still hold the profile; the OS reclaims it later */
  }
  try {
    await fetch(`http://127.0.0.1:${PORT}/json/close/x`);
  } catch {
    /* ignore */
  }
  process.exit(exitCode);
}
