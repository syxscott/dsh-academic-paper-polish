// Layout probe: the panel's layout regression net.
//
//   node scripts/layout-probe.mjs [width...]
//
// The right sidebar is a RESIZABLE track (roughly 320px → 900px, and it can
// go fullscreen), so the panel has to hold at EVERY width. This probe
// renders every view at several widths and reports, per view and width:
//
//   - page-level horizontal scroll,
//   - elements whose box reaches past the panel's right edge,
//   - text that is wider than its own box and is NOT in a deliberate
//     horizontal scroller and does NOT end in an ellipsis (the classic
//     "long path pushes the layout" bug),
//   - grids whose rows would stretch (a grid inside a growing flex column
//     hands the leftover height to every auto-sized row — that is how the
//     手册 search box once became 277px tall),
//   - content that is cut off with no way to scroll to it,
//   - chrome rows (header, tab bar) that a flex squeeze has clipped,
//   - the journal table's FIRST column, which must never be clipped,
//   - textareas that collapsed or ballooned,
//   - hit targets that shrank below a usable size.
//
// It is the regression net for "the panel looks broken at some width".
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const CHROME =
  process.env.DSH_CHROME ||
  'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1252/chrome-win64/chrome.exe';
const PORT = Number(process.env.DSH_CDP_PORT || 9337);
const VIEWS = ['rules', 'journals', 'check', 'deai', 'checklist', 'manual', 'manuscript'];
const DEMO = new Set(['check', 'deai', 'manuscript']);
const widths = process.argv.slice(2).map(Number).filter(Boolean);
const SIZES = widths.length > 0 ? widths : [320, 380, 460, 560, 900];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profileDir = join(tmpdir(), `dsh-layout-${Date.now()}`);
mkdirSync(profileDir, { recursive: true });

async function waitForTarget() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((item) => item.type === 'page' && item.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      /* not up yet */
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

const PROBE = `(() => {
  const frame = document.querySelector('#frame');
  const panel = document.querySelector('.dapp') || frame;
  const frameRect = frame.getBoundingClientRect();
  const out = {
    pageOverflow: 0,
    overflowing: [],
    escaping: [],
    stretched: [],
    textOverflow: [],
    clipped: [],
    squeezed: [],
    clippedFirst: [],
    badTextarea: [],
    smallTargets: [],
  };
  out.pageOverflow = Math.max(0, document.documentElement.scrollWidth - window.innerWidth);
  const describe = (el) => {
    const cls = (el.className && typeof el.className === 'string') ? el.className : '';
    const text = (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 60);
    return el.tagName.toLowerCase() + (cls ? '.' + cls.split(/\\s+/).slice(0, 3).join('.') : '') + ' — ' + text;
  };
  // An element may be wider than the panel when one of its ancestors is a
  // deliberate horizontal scroller that really overflows (the journal table,
  // the chip rows, the tab bar). The panel's own viewport (.dapp-scroll) is
  // NOT such an excuse: content that does not fit there is a defect.
  const scrollerOf = (el) => {
    for (let p = el.parentElement; p && p !== panel; p = p.parentElement) {
      if (p.classList && p.classList.contains('dapp-scroll')) continue;
      const ps = getComputedStyle(p);
      if ((ps.overflowX === 'auto' || ps.overflowX === 'scroll') && p.scrollWidth > p.clientWidth + 1) return p;
    }
    return null;
  };
  // A grid whose container is taller than its content hands the leftover
  // space to every auto-sized row: a search box becomes 270px tall and the
  // gaps between rows blow up. The rows must stay at their content height,
  // which means align-content:start on the growing flex column AND on the
  // view grid.
  for (const el of panel.querySelectorAll('*')) {
    const style = getComputedStyle(el);
    if (style.display !== 'grid') continue;
    const parent = el.parentElement;
    const ps = parent ? getComputedStyle(parent) : null;
    const growsInColumn = ps && ps.display === 'flex' && ps.flexDirection === 'column' && Number(style.flexGrow) > 0;
    const known = el.classList && el.classList.contains('dapp-view');
    if (!growsInColumn && !known) continue;
    if (style.alignContent !== 'start') {
      out.stretched.push({ el: describe(el), alignContent: style.alignContent });
    }
  }
  for (const el of panel.querySelectorAll('*')) {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    const inScroller = !!scrollerOf(el);
    // an element that scrolls horizontally itself (the journal table, the
    // chip rows, the tab bar) is allowed to be wider than its box — that is
    // what the scroller is for.
    const selfScrolls = style.overflowX === 'auto' || style.overflowX === 'scroll';
    const rect = el.getBoundingClientRect();
    if (!inScroller) {
      if (rect.width > 0 && (rect.right > frameRect.right + 1 || rect.left < frameRect.left - 1)) {
        out.escaping.push({ el: describe(el), right: Math.round(rect.right), limit: Math.round(frameRect.right) });
      }
      // text that is wider than its own box: it must wrap, or end in an
      // ellipsis — otherwise it pushes the layout
      if (!selfScrolls && el.scrollWidth > el.clientWidth + 1 && style.textOverflow !== 'ellipsis') {
        out.textOverflow.push({ el: describe(el), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth });
      }
    }
    // content cut off with no way to see it
    if ((style.overflowY === 'hidden' || style.overflowY === 'clip') && el.scrollHeight > el.clientHeight + 1) {
      out.clipped.push({ el: describe(el), scrollHeight: el.scrollHeight, clientHeight: el.clientHeight });
    }
  }
  // the chrome rows must not be squeezed by a flex shrink
  for (const selector of ['.dapp-head', '.dapp-tabs']) {
    for (const el of document.querySelectorAll(selector)) {
      if (el.scrollHeight > el.clientHeight + 1) {
        out.squeezed.push({ el: describe(el), scrollHeight: el.scrollHeight, clientHeight: el.clientHeight });
      }
    }
  }
  // the journal table's first column must never be clipped
  for (const cell of document.querySelectorAll('.dapp-jtable tbody td:first-child')) {
    if (cell.scrollWidth > cell.clientWidth + 1) {
      out.clippedFirst.push({ el: describe(cell), scrollWidth: cell.scrollWidth, clientWidth: cell.clientWidth });
    }
  }
  // a textarea must stay usable: never collapse, never balloon
  for (const el of document.querySelectorAll('.dapp-textarea')) {
    const height = el.getBoundingClientRect().height;
    if (height < 100 || height > 420) {
      out.badTextarea.push({ el: describe(el), height: Math.round(height) });
    }
  }
  // hit targets stay usable
  for (const el of panel.querySelectorAll('.dapp-btn, .dapp-chipbtn')) {
    const rect = el.getBoundingClientRect();
    if (rect.height > 0 && rect.height < 24) {
      out.smallTargets.push({ el: describe(el), height: Math.round(rect.height) });
    }
  }
  for (const key of Object.keys(out)) {
    if (Array.isArray(out[key])) out[key] = out[key].slice(0, 8);
  }
  return JSON.stringify(out);
})()`;

let failures = 0;
try {
  const page = await waitForTarget();
  const socket = await connect(page.webSocketDebuggerUrl);
  await rpc(socket, 'Page.enable');
  await rpc(socket, 'Runtime.enable');

  for (const width of SIZES) {
    await rpc(socket, 'Emulation.setDeviceMetricsOverride', {
      width: 1200,
      height: 1200,
      deviceScaleFactor: 1,
      mobile: false,
    });
    for (const view of VIEWS) {
      const query = `?view=${view}${DEMO.has(view) ? '&demo=1' : ''}&w=${width}`;
      await rpc(socket, 'Page.navigate', { url: `${fileUrl}${query}` });
      await sleep(900);
      const result = await rpc(socket, 'Runtime.evaluate', {
        expression: PROBE,
        returnByValue: true,
        awaitPromise: true,
      });
      const raw = result.result?.value;
      if (raw === undefined) {
        console.log(`✗ ${view.padEnd(10)} @${width}  probe failed: ${JSON.stringify(result.exceptionDetails ?? {}).slice(0, 120)}`);
        failures += 1;
        continue;
      }
      const report = JSON.parse(raw);
      const problems =
        report.pageOverflow +
        report.escaping.length +
        report.textOverflow.length +
        report.stretched.length +
        report.clipped.length +
        report.squeezed.length +
        report.clippedFirst.length +
        report.badTextarea.length +
        report.smallTargets.length;
      if (problems === 0) {
        console.log(`✓ ${view.padEnd(10)} @${String(width).padStart(4)}  clean`);
        continue;
      }
      failures += 1;
      console.log(`✗ ${view.padEnd(10)} @${String(width).padStart(4)}  pageOverflow=${report.pageOverflow}`);
      for (const item of report.stretched) {
        console.log(`      stretched rows  align-content=${item.alignContent}  ${item.el}`);
      }
      for (const item of report.textOverflow) {
        console.log(`      text overflow ${item.scrollWidth}>${item.clientWidth}  ${item.el}`);
      }
      for (const item of report.escaping) {
        console.log(`      escapes  right=${item.right} limit=${item.limit}  ${item.el}`);
      }
      for (const item of report.clipped) {
        console.log(`      clipped  ${item.scrollHeight}>${item.clientHeight}  ${item.el}`);
      }
      for (const item of report.squeezed) {
        console.log(`      squeezed chrome  ${item.scrollHeight}>${item.clientHeight}  ${item.el}`);
      }
      for (const item of report.clippedFirst) {
        console.log(`      clipped first column  ${item.scrollWidth}>${item.clientWidth}  ${item.el}`);
      }
      for (const item of report.badTextarea) {
        console.log(`      textarea height=${item.height}  ${item.el}`);
      }
      for (const item of report.smallTargets) {
        console.log(`      small hit target h=${item.height}  ${item.el}`);
      }
    }
  }
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
  process.exit(failures > 0 ? 1 : 0);
}
