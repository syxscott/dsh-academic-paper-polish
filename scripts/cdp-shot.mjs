// Minimal CDP driver: launches the Playwright Chromium, opens the Harness Web
// GUI, optionally runs JS, and writes PNG screenshots so the panel can be
// inspected visually.
//
//   node scripts/cdp-shot.mjs <outPrefix> [url] [--wait=ms] [--eval=js] [--evalAfter=js]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME =
  process.env.DSH_CHROME ||
  'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1252/chrome-win64/chrome.exe';
const PORT = Number(process.env.DSH_CDP_PORT || 9333);
const profileDir = join(tmpdir(), `dsh-shot-${Date.now()}`);

const args = process.argv.slice(2);
const prefix = args[0] || 'shot';
const url = args.find((a) => /^https?:\/\//.test(a)) || 'http://127.0.0.1:8905';
const waitArg = args.find((a) => a.startsWith('--wait='));
const waitMs = waitArg ? Number(waitArg.slice(7)) : 4000;
const evalArg = args.find((a) => a.startsWith('--eval='));
const evalAfter = args.find((a) => a.startsWith('--evalAfter='));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function targets() {
  const response = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  return response.json();
}

async function waitForTarget() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const list = await targets();
      const page = list.find((item) => item.type === 'page' && item.webSocketDebuggerUrl);
      if (page) return page;
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

async function shoot(socket, name) {
  const result = await rpc(socket, 'Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const file = join(process.cwd(), `${name}.png`);
  writeFileSync(file, Buffer.from(result.data, 'base64'));
  console.log(`shot: ${file}`);
  return file;
}

async function run(socket, expression) {
  const result = await rpc(socket, 'Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    console.log(`eval error: ${result.exceptionDetails.text}`);
    return null;
  }
  return result.result.value;
}

mkdirSync(profileDir, { recursive: true });
const chrome = spawn(
  CHROME,
  [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profileDir}`,
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--window-size=1680,1050',
    url,
  ],
  { detached: true, stdio: 'ignore' },
);
chrome.unref();

try {
  const page = await waitForTarget();
  const socket = await connect(page.webSocketDebuggerUrl);
  await rpc(socket, 'Page.enable');
  await rpc(socket, 'Runtime.enable');
  await sleep(waitMs);

  console.log(`title: ${await run(socket, 'document.title')}`);
  console.log(`url: ${page.url}`);
  const probe = await run(
    socket,
    `JSON.stringify({
       hasComposer: !!document.querySelector('[data-composer], textarea'),
       bodyLen: document.body ? document.body.innerText.length : -1,
       head: document.body ? document.body.innerText.slice(0, 220) : ''
     })`,
  );
  console.log(`probe: ${probe}`);

  if (evalArg) {
    const value = await run(socket, evalArg.slice(7));
    console.log(`eval: ${JSON.stringify(value)}`);
    await sleep(1200);
  }
  if (evalAfter) {
    const value = await run(socket, evalAfter.slice(11));
    console.log(`evalAfter: ${JSON.stringify(value)}`);
    await sleep(1200);
  }

  await shoot(socket, prefix);
  socket.close();
} finally {
  try {
    await fetch(`http://127.0.0.1:${PORT}/json/close/${encodeURIComponent('x')}`);
  } catch {
    /* ignore */
  }
  process.exit(0);
}
