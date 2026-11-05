// Measures the geometry of one panel view in the preview harness.
//
//   node scripts/measure-view.mjs <view> [--w=380] [--demo]
//
// Prints the box geometry of the view container and its children, plus the
// facts that decide the layout — the PANEL's width (the container the
// @container queries measure), the active breakpoint, the textarea heights
// and the widest text that does not fit — so a layout problem can be
// located instead of guessed at.
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const CHROME =
  process.env.DSH_CHROME ||
  'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1252/chrome-win64/chrome.exe';
const PORT = Number(process.env.DSH_CDP_PORT || 9343);
const args = process.argv.slice(2);
const view = args[0] || 'manual';
const width = (args.find((a) => a.startsWith('--w=')) || '--w=380').slice(4);
const demo = args.includes('--demo');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profileDir = join(tmpdir(), `dsh-measure-${Date.now()}`);
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

const PROBE = `JSON.stringify((() => {
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return {
      cls: String(el.className || el.tagName),
      h: Math.round(r.height),
      w: Math.round(r.width),
      display: s.display,
      flex: s.flex,
      alignContent: s.alignContent,
      alignItems: s.alignItems,
      gridRows: s.gridTemplateRows,
      gridColumns: s.gridTemplateColumns,
      overflowY: s.overflowY,
      minHeight: s.minHeight,
      flexGrow: s.flexGrow,
    };
  };
  const view = document.querySelector('.dapp-view');
  const body = document.querySelector('.dapp-body');
  const panel = document.querySelector('.dapp');
  const panelWidth = panel ? Math.round(panel.getBoundingClientRect().width) : 0;
  // the breakpoints the panel's own @container queries use
  const breakpoint = panelWidth <= 380 ? 'narrow (<=380)' : panelWidth < 600 ? 'medium (380-600)' : 'wide (>=600)';
  const overflowing = [];
  for (const el of panel ? panel.querySelectorAll('*') : []) {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') continue;
    if (s.overflowX === 'auto' || s.overflowX === 'scroll') continue;
    if (el.scrollWidth > el.clientWidth + 1) {
      overflowing.push({
        cls: String(el.className || el.tagName),
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        textOverflow: s.textOverflow,
      });
    }
  }
  return {
    panelWidth,
    breakpoint,
    body: box(body),
    bodyChildren: body ? [...body.children].map(box) : [],
    view: box(view),
    viewChildren: view ? [...view.children].map(box) : [],
    textareas: [...document.querySelectorAll('.dapp-textarea')].map((el) => ({
      h: Math.round(el.getBoundingClientRect().height),
      w: Math.round(el.getBoundingClientRect().width),
    })),
    overflowing: overflowing.slice(0, 10),
    panels: [...document.querySelectorAll('.dapp')].map(box),
  };
})())`;

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
    width: Number(width) + 60,
    height: 940,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const html = resolve(process.cwd(), 'preview', 'panel.html');
  const fileUrl = `file:///${html.replace(/\\/g, '/')}`;
  await rpc(socket, 'Page.navigate', {
    url: `${fileUrl}?view=${view}&w=${width}${demo ? '&demo=1' : ''}`,
  });
  await sleep(1300);
  const result = await rpc(socket, 'Runtime.evaluate', {
    expression: PROBE,
    returnByValue: true,
  });
  const value = result.result?.value;
  console.log(value ? JSON.stringify(JSON.parse(value), null, 1) : JSON.stringify(result));
  socket.close();
} finally {
  try {
    await fetch(`http://127.0.0.1:${PORT}/json/close/x`);
  } catch {
    /* ignore */
  }
  try {
    rmSync(profileDir, { recursive: true, force: true, maxRetries: 2 });
  } catch {
    /* Chrome may still hold it */
  }
  process.exit(0);
}
