// Headless render test: loads client.js with the real React from the DSH
// profile and renders every view, so a crash surfaces with a stack trace.
// Run: node scripts/render-test.mjs
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const PROFILE_MODULES = 'file:///C:/Users/Administrator/.dsh/profiles/web/node_modules/';
const require_ = createRequire(PROFILE_MODULES + 'anchor.js');
const React = require_('react');
const ReactDOMServer = require_('react-dom/server');

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
globalThis.document = { createElement: () => ({ style: {}, setAttribute() {}, select() {} }), body: { appendChild() {}, removeChild() {} } };

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8');
new Function(source)();
const definition = globalThis.__module;
if (!definition) throw new Error('client.js did not call __ModuleLoader__.load');

const plugin = definition.factory((name) => {
  if (name === 'react') return React;
  throw new Error(`unknown browser module: ${name}`);
});

let registered = null;
const registrations = [];
const makeCtx = () => {
  const ctx = {
    locale: {
      register: () => () => {},
      bind: () => (key) => key,
      getLocale: () => ({ id: 'zh' }),
    },
    slots: {
      inject(_name, cb) { cb(); },
      register(def, Comp) {
        registered = { def, Comp };
        registrations.push(registered);
        return () => {};
      },
    },
    sidebarRightTabs: { register: () => () => {} },
    sidebarRight: { openTab: () => {} },
    effect(fn) { fn(); return () => {}; },
    inject(deps, cb) { cb(ctx); },
  };
  return ctx;
};

const ctx = makeCtx();
plugin.apply(ctx);
if (!registered) throw new Error('no slot registration captured');

// The panel lives in the right sidebar only: the composer dock must stay free.
const dockRegistrations = registrations.filter((item) => item.def.name === 'conversation.composer.dock');
if (dockRegistrations.length > 0) {
  console.log('✗ the panel is still registered in conversation.composer.dock');
  process.exit(1);
}
console.log('✓ no composer-dock registration (right sidebar only)');

const views = ['journal', 'matrix', 'match', 'figure', 'color', 'modules', 'checklist', 'rules'];
const slots = ['sidebar.right.pane.tab'];
let failures = 0;

for (const view of views) {
  storage.set('dsh-academic-paper-polish.view', JSON.stringify(view));
  for (const slot of slots) {
    try {
      // re-apply so the component picks up the stored view
      registrations.length = 0;
      plugin.apply(makeCtx());
      const entry = registrations.find((item) => item.def.name === slot);
      if (!entry) throw new Error(`no registration for ${slot}`);
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(entry.Comp, { inputActions: undefined, ctx }),
      );
      console.log(`✓ ${view.padEnd(9)} ${slot.padEnd(28)} ${html.length} chars`); if (process.env.DUMP_VIEW === view) fs.writeFileSync('preview/dump-'+view+'.html', html); if (process.env.DUMP_VIEW === view) console.log(html.slice(0, 2600));
    } catch (error) {
      failures += 1;
      console.log(`✗ ${view.padEnd(9)} ${slot.padEnd(28)} ${error && error.message}`);
      console.log(String(error && error.stack).split('\n').slice(0, 4).join('\n'));
    }
  }
}

process.exit(failures === 0 ? 0 : 1);
