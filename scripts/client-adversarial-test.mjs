// Adversarial probe for the panel: hostile API answers.
//
//   node scripts/client-adversarial-test.mjs
//
// The panel reads six API routes. A host that answers with a shape the panel
// does not expect — an error object where a list was promised, a string where
// an array was promised, null — must degrade to an error state, never blank
// the slot and never throw.
//
// It renders every view with such an answer and fails if the console shows an
// error or the page throws.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const CHROME =
  process.env.DSH_CHROME ||
  "C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1252/chrome-win64/chrome.exe";
const PORT = Number(process.env.DSH_CDP_PORT || 9345);
const VIEWS = ["rules", "journals", "check", "deai", "checklist", "manual", "manuscript"];
const MODES = ["garbage", "401", "404", "down"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profileDir = mkdtempSync(join(tmpdir(), "dsh-client-adv-"));

async function waitForTarget() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error("no CDP page target");
}

function connect(url) {
  return new Promise((res, rej) => {
    const socket = new WebSocket(url);
    socket.addEventListener("open", () => res(socket));
    socket.addEventListener("error", rej);
  });
}

function rpc(socket, method, params = {}) {
  const id = rpc.nextId += 1;
  return new Promise((res, rej) => {
    const onMessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== id) return;
      socket.removeEventListener("message", onMessage);
      if (message.error) rej(new Error(`${method}: ${message.error.message}`));
      else res(message.result);
    };
    socket.addEventListener("message", onMessage);
    socket.send(JSON.stringify({ id, method, params }));
  });
}
rpc.nextId = 0;

const chrome = spawn(
  CHROME,
  [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profileDir}`,
    "--headless=new",
    "--no-first-run",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--window-size=1200,1200",
    "about:blank",
  ],
  { detached: true, stdio: "ignore" },
);
chrome.unref();

const failures = [];
let checks = 0;

try {
  const page = await waitForTarget();
  const socket = await connect(page.webSocketDebuggerUrl);
  await rpc(socket, "Page.enable");
  await rpc(socket, "Runtime.enable");
  await rpc(socket, "Log.enable");
  await rpc(socket, "Emulation.setDeviceMetricsOverride", {
    width: 460,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });

  const html = resolve(process.cwd(), "preview", "panel.html");
  const fileUrl = `file:///${html.replace(/\\/g, "/")}`;

  for (const mode of MODES) {
    for (const view of VIEWS) {
      const problems = [];
      const onEvent = (event) => {
        const message = event.params ?? {};
        if (message.entry?.level === "error") problems.push(`console: ${message.entry.text}`);
        if (message.entry?.source === "javascript") problems.push(`console: ${message.entry.text}`);
        if (message.exceptionDetails) {
          problems.push(
            `exception: ${message.exceptionDetails.exception?.description ?? message.exceptionDetails.text}`,
          );
        }
      };
      socket.addEventListener("message", onEvent);
      await rpc(socket, "Page.navigate", {
        url: `${fileUrl}?view=${view}&w=380&api=${mode}&demo=1`,
      });
      await sleep(1100);
      const mounted = await rpc(socket, "Runtime.evaluate", {
        expression: "JSON.stringify({ mounted: !!document.querySelector('.dapp'), tabs: document.querySelectorAll('.dapp-tab').length })",
        returnByValue: true,
      });
      socket.removeEventListener("message", onEvent);
      checks += 1;
      const state = JSON.parse(mounted.result?.value ?? "{}");
      if (!state.mounted) {
        failures.push(`${view} @ ${mode}: the panel did not mount`);
      } else if (state.tabs !== 7) {
        failures.push(`${view} @ ${mode}: ${state.tabs} tabs rendered, expected 7`);
      }
      for (const problem of problems) {
        failures.push(`${view} @ ${mode}: ${problem}`);
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
    /* Chrome may still hold it */
  }
}

console.log(`\nclient adversarial — ${checks} renders`);
if (failures.length > 0) {
  console.log(`\n${failures.length} failure(s):`);
  for (const failure of failures) console.log(`  ✗ ${failure}`);
  process.exit(1);
}
console.log("no view crashed on a hostile API answer");
process.exit(0);
