// Screenshots one panel view, optionally with a simulated host failure.
//
//   node scripts/shot-one.mjs <view> <out.png> [--api=401|404|down] [--w=380] [--demo]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const CHROME =
  process.env.DSH_CHROME ||
  'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1252/chrome-win64/chrome.exe';
const PORT = Number(process.env.DSH_CDP_PORT || 9339);
const args = process.argv.slice(2);
const view = args[0] || 'rules';
const out = resolve(process.cwd(), args[1] || `preview/shot-${view}.png`);
const api = (args.find((a) => a.startsWith('--api=')) || '').slice(6);
const width = (args.find((a) => a.startsWith('--w=')) || '--w=380').slice(4);
const demo = args.includes('--demo');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profileDir = join(tmpdir(), `dsh-shot1-${Date.now()}`);
mkdirSync(profileDir, { recursive: true });

async function waitForTarget() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((item) => item.type === 'page' && item.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      /* not up */
    }
    await sleep(250);
  }
  throw new Error('no CDP page target');
}

function connect(url) {
  return new Promise((res, rej) => {
    const socket = new WebSocket(url);
    socket.addEventListener('open', () => res(socket));
    socket.addEventListener('error', rej);
  });
}

function rpc(socket, method, params = {}) {
  const id = rpc.nextId += 1;
  return new Promise((res, rej) => {
    const onMessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== id) return;
      socket.removeEventListener('message', onMessage);
      if (message.error) rej(new Error(`${method}: ${message.error.message}`));
      else res(message.result);
    };
    socket.addEventListener('message', onMessage);
    socket.send(JSON.stringify({ id, method, params }));
  });
}
rpc.nextId = 0;

const html = resolve(process.cwd(), 'preview', 'panel.html');
const fileUrl = `file:///${html.replace(/\\/g, '/')}`;
const query = `?view=${view}&w=${width}${demo ? '&demo=1' : ''}${api ? `&api=${api}` : ''}`;

const chrome = spawn(
  CHROME,
  [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profileDir}`,
    '--headless=new',
    '--no-first-run',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--window-size=1200,1200',
    'about:blank',
  ],
  { detached: true, stdio: 'ignore' },
);
chrome.unref();

try {
  const page = await waitForTarget();
  const socket = await connect(page.webSocketDebuggerUrl);
  await rpc(socket, 'Page.enable');
  await rpc(socket, 'Runtime.enable');
  await rpc(socket, 'Emulation.setDeviceMetricsOverride', {
    width: Number(width) + 40,
    height: 940,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await rpc(socket, 'Page.navigate', { url: `${fileUrl}${query}` });
  await sleep(1400);
  const shot = await rpc(socket, 'Page.captureScreenshot', { format: 'png' });
  writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log(`✓ ${out}`);
  socket.close();
} finally {
  try {
    await fetch(`http://127.0.0.1:${PORT}/json/close/x`);
  } catch {
    /* ignore */
  }
  try {
    rmSync(profileDir, { recursive: true, force: true, maxRetries: 3 });
  } catch {
    /* Chrome may still hold the profile; the temp dir is disposable */
  }
  process.exit(0);
}
