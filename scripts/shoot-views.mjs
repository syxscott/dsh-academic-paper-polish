// Screenshots every panel view with headless Chrome so the design can be
// inspected as an image instead of guessed at.
//
//   node scripts/shoot-views.mjs [dark] [--width=380] [--sweep]
//
// The preview harness is a LAYOUT REGRESSION NET, not a verification of the
// running plugin: the real panel is rendered by the Harness with the real
// theme tokens and the real host API.
//
//   --sweep   also writes preview/v3-width-<view>-<w>.png for the two most
//             complex views at 320 / 560 / 900 px — the sidebar track is
//             resizable, so the responsiveness has to be visible.
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const CHROME =
  process.env.DSH_CHROME ||
  'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1252/chrome-win64/chrome.exe';
const views = ['rules', 'journals', 'check', 'deai', 'checklist', 'manual', 'manuscript'];
const dark = process.argv.includes('dark');
const sweep = process.argv.includes('--sweep');
const widthArg = process.argv.find((arg) => arg.startsWith('--width='));
const defaultWidth = widthArg ? Number(widthArg.slice(8)) : 380;
// --api=401|404|down reproduces the three host failure modes, so the
// unauthorized / not-implemented / unreachable states can be inspected too.
const apiArg = process.argv.find((arg) => arg.startsWith('--api='));
const api = apiArg ? apiArg.slice(6) : '';
const HEIGHT = 940;
const outDir = resolve(process.cwd(), 'preview');
mkdirSync(outDir, { recursive: true });

const html = join(outDir, 'panel.html');
const url = `file:///${html.replace(/\\/g, '/')}`;

// The check, de-AI and manuscript views need a click to show their results,
// so they are driven with ?demo=1.
const DEMO = new Set(['check', 'deai', 'manuscript']);

// the views whose layout is hardest to eyeball
const SWEEP_VIEWS = ['check', 'journals', 'manuscript'];
const SWEEP_WIDTHS = [320, 560, 900];

function shoot({ view, width, out, demo, extra }) {
  const profile = join(outDir, `.profile-${view}-${width}-${dark ? 'dark' : 'light'}`);
  // A stale profile would serve a CACHED client.js — the profile name is
  // deterministic, so the directory is cleared before the run as well.
  rmSync(profile, { recursive: true, force: true });
  const query = `?view=${view}&w=${width}${demo ? '&demo=1' : ''}${dark ? '&dark=1' : ''}${api ? `&api=${api}` : ''}${extra ? `&${extra}` : ''}`;
  try {
    execFileSync(
      CHROME,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--hide-scrollbars',
        '--force-device-scale-factor=1',
        '--disable-application-cache',
        `--user-data-dir=${profile}`,
        `--window-size=${width},${HEIGHT}`,
        '--virtual-time-budget=4000',
        `--screenshot=${out}`,
        `${url}${query}`,
      ],
      { stdio: 'pipe', timeout: 60000 },
    );
    const size = statSync(out).size;
    console.log(`${view.padEnd(9)} @${String(width).padStart(3)} → ${out} (${(size / 1024).toFixed(0)} KB)`);
  } catch (error) {
    console.log(`${view.padEnd(9)} @${width} FAILED: ${String(error.message).slice(0, 200)}`);
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }
}

for (const view of views) {
  const suffix = `${dark ? '-dark' : ''}${api ? `-state-${api}` : ''}`;
  shoot({
    view,
    width: defaultWidth,
    demo: DEMO.has(view),
    out: join(outDir, `v3-${view}${suffix}.png`),
  });
}

// The file picker of the 稿件 view: the host found two equally likely
// manuscripts, so the human has to choose one.
//
// The dialog is portaled to the DOCUMENT BODY, so it is centred in the whole
// browser window — not in the sidebar. Chrome on Windows refuses a window
// narrower than 500px, so the shot uses that width: a narrower one would
// crop the dialog instead of the sidebar.
shoot({
  view: 'manuscript',
  width: 500,
  demo: true,
  extra: 'fixture=ambiguous',
  out: join(outDir, `v3-manuscript-picker${dark ? '-dark' : ''}${api ? `-state-${api}` : ''}.png`),
});

// The two states of the 稿件 view that are not a report: a folder without a
// candidate manuscript, and a panel without a session.
shoot({
  view: 'manuscript',
  width: defaultWidth,
  demo: true,
  extra: 'fixture=empty',
  out: join(outDir, `v3-manuscript-empty${dark ? '-dark' : ''}${api ? `-state-${api}` : ''}.png`),
});
shoot({
  view: 'manuscript',
  width: defaultWidth,
  demo: false,
  extra: 'nosession=1',
  out: join(outDir, `v3-manuscript-nosession${dark ? '-dark' : ''}${api ? `-state-${api}` : ''}.png`),
});

if (sweep) {
  for (const view of SWEEP_VIEWS) {
    for (const width of SWEEP_WIDTHS) {
      shoot({
        view,
        width,
        demo: DEMO.has(view),
        out: join(outDir, `v3-width-${view}-${width}${dark ? '-dark' : ''}.png`),
      });
    }
  }
}
