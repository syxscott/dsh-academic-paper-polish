// Screenshots every panel view with headless Chrome so the design can be
// inspected as an image instead of guessed at.
//   node scripts/shoot-views.mjs [dark]
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const CHROME =
  process.env.DSH_CHROME ||
  'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1252/chrome-win64/chrome.exe';
const views = ['rules', 'journals', 'check', 'deai', 'checklist', 'manual'];
const dark = process.argv.includes('dark');
const outDir = resolve(process.cwd(), 'preview');
mkdirSync(outDir, { recursive: true });

const html = join(outDir, 'panel.html');
const url = `file:///${html.replace(/\\/g, '/')}`;

// The check and de-AI views need a click to show their results, so they are
// driven with ?demo=1.
const DEMO = new Set(['check', 'deai']);

for (const view of views) {
  const out = join(outDir, `v3-${view}${dark ? '-dark' : ''}.png`);
  const query = `?view=${view}${DEMO.has(view) ? '&demo=1' : ''}${dark ? '&dark=1' : ''}`;
  // a fresh profile per run: file:// resources are otherwise served from cache
  const profile = join(outDir, `.profile-${view}-${dark ? 'dark' : 'light'}`);
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
        '--window-size=380,940',
        '--virtual-time-budget=4000',
        `--screenshot=${out}`,
        `${url}${query}`,
      ],
      { stdio: 'pipe', timeout: 60000 },
    );
    const size = statSync(out).size;
    console.log(`${view.padEnd(9)} → ${out} (${(size / 1024).toFixed(0)} KB)`);
  } catch (error) {
    console.log(`${view.padEnd(9)} FAILED: ${String(error.message).slice(0, 200)}`);
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }
}
