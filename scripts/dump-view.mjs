// Dumps the rendered HTML of one view for inspection.
//   node scripts/dump-view.mjs match
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const MODULES = 'file:///C:/Users/Administrator/.dsh/profiles/web/node_modules/';
const require_ = createRequire(`${MODULES}anchor.js`);
const React = require_('react');
const ReactDOMServer = require_('react-dom/server');

const view = process.argv[2] || 'journal';

const storage = new Map();
globalThis.window = {
  __ModuleLoader__: { load(def) { globalThis.__module = def; } },
  localStorage: {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, value),
  },
  addEventListener() {},
  removeEventListener() {},
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
};
globalThis.document = {
  createElement: () => ({ style: {}, setAttribute() {}, select() {} }),
  body: { appendChild() {}, removeChild() {} },
};

storage.set('dsh-academic-paper-polish.view', JSON.stringify(view));
new Function(readFileSync(new URL('../client.js', import.meta.url), 'utf8'))();
const plugin = globalThis.__module.factory((name) => {
  if (name === 'react') return React;
  throw new Error(`unknown module ${name}`);
});

const registrations = [];
const ctx = {
  locale: { register: () => () => {}, bind: () => (key) => key, getLocale: () => ({ id: 'zh' }) },
  slots: {
    inject(_n, cb) { cb(); },
    register(_def, Comp) { registrations.push(Comp); return () => {}; },
  },
  sidebarRightTabs: { register: () => () => {} },
  sidebarRight: { openTab: () => {} },
  effect(fn) { fn(); return () => {}; },
  inject(_deps, cb) { cb(ctx); },
};
plugin.apply(ctx);
const Component = registrations[registrations.length - 1];
const html = ReactDOMServer.renderToStaticMarkup(React.createElement(Component, { ctx, variant: 'sidebar' }));
const out = `preview/dump-${view}.html`;
writeFileSync(out, html, 'utf8');
console.log(`${out} (${html.length} chars)`);
for (const cls of ['dapp-dim', 'dapp-chipbtn', 'dapp-dims', 'dapp-dim{', 'dapp-view', 'dapp-score']) {
  console.log(`  ${cls}: ${(html.split(cls).length - 1)}`);
}
