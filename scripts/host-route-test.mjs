// Host-side test: mounts the plugin against a mock webServer and exercises the
// skill-index route handler end to end (no agent, no browser).
// Also exercises the capability layer: the five paper_* tools, the five
// paper-* commands, the always-on prompt section and the /api/* JSON routes.
// Finally it exercises the manuscript discovery + analysis routes against a
// temporary session directory (including a generated .docx fixture).
// Run: node scripts/host-route-test.mjs
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateRawSync } from 'node:zlib';

import { createToolDefinitions } from '../lib/tools.mjs';
import { createCommandDefinitions } from '../lib/commands.mjs';

const require_ = createRequire(import.meta.url);
const { apply } = require_('../index.js');

// The panel-activity beacon must never touch the developer's real profile:
// point the runtime writer at a temporary directory for this whole run.
const runtimeRoot = mkdtempSync(join(tmpdir(), 'dsh-academic-paper-polish-runtime-'));
process.env.DSH_ACADEMIC_PAPER_RUNTIME_DIR = runtimeRoot;

let failures = 0;
let assertions = 0;
const check = (name, condition, detail = '') => {
  assertions += 1;
  if (condition) console.log(`✓ ${name}`);
  else {
    failures += 1;
    console.log(`✗ ${name} ${detail}`);
  }
};

// ── mock webServer ────────────────────────────────────────────────
let registered = null;
let provider = null;
const mockRes = () => {
  const res = {
    statusCode: 0,
    headers: {},
    body: '',
    writeHead(status, headers = {}) {
      res.statusCode = status;
      res.headers = headers;
      return res;
    },
    end(chunk = '') {
      res.body += chunk;
      return res;
    },
  };
  return res;
};

const makeCtx = () => ({
  skills: {
    register: (skill) => {
      registered = skill;
      return () => {};
    },
    registerProvider: (factory) => {
      provider = factory({});
      return () => {};
    },
  },
  webServer: {
    register: (route) => {
      registered = route;
      return () => {};
    },
  },
  // The official trust fence: Host/Origin checks plus the browser session
  // cookie. The mock rejects a request that carries the untrusted marker.
  connection: {
    requestRejection: (req) =>
      req && req.headers && req.headers['x-untrusted'] === '1' ? 403 : undefined,
  },
  inject: (deps, cb) => {
    cb(ctx);
    return { dispose() {} };
  },
  effect: (fn) => fn(),
});

const ctx = makeCtx();
ctx.inject = (deps, cb) => {
  cb(ctx);
  return { dispose() {} };
};
apply(ctx, {});

// the skill provider is registered on ctx.skills
check('host registers the skill provider', Boolean(provider), provider ? '' : '(no provider)');
if (provider) {
  const candidates = await provider.list();
  check('provider lists one candidate', Array.isArray(candidates) && candidates.length === 1);
  const definition = await provider.get(candidates[0], {});
  check('definition carries content', typeof definition.content === 'string' && definition.content.length > 1000);
  check('definition carries a resource base', definition.resourceBase && definition.resourceBase.kind === 'directory');
  check('definition exposes the absolute resource path', String(definition.resourceBase.path).includes('academic-paper-polish'));
}

// the route is registered on the webServer row
let webRoute = null;
const ctx2 = makeCtx();
ctx2.webServer = {
  register: (route) => {
    webRoute = route;
    return () => {};
  },
};
ctx2.inject = (deps, cb) => {
  cb(ctx2);
  return { dispose() {} };
};
apply(ctx2, {});
check('webServer route registered', Boolean(webRoute), webRoute ? '' : '(no route)');

if (webRoute) {
  check('route kind is prefix', webRoute.kind === 'prefix', `got ${webRoute.kind}`);
  check('route path is the plugin namespace', webRoute.path === '/dsh-academic-paper-polish', `got ${webRoute.path}`);

  // The runtime matches a prefix route with
  //   pathname === prefix || pathname.startsWith(prefix + '/')
  // so a registered path with a trailing slash silently matches nothing.
  const matchPrefix = (prefix, pathname) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`);
  check(
    'the registered prefix actually matches the request path',
    matchPrefix(webRoute.path, '/dsh-academic-paper-polish/skill-index'),
    `prefix "${webRoute.path}" vs "/dsh-academic-paper-polish/skill-index"`,
  );
  check('the prefix does not end with a slash', !webRoute.path.endsWith('/'), webRoute.path);

  // GET on the index
  const res = mockRes();
  webRoute.handler({ method: 'GET', url: '/dsh-academic-paper-polish/skill-index' }, res);
  check('GET returns 200', res.statusCode === 200, `got ${res.statusCode}`);
  let index = null;
  try {
    index = JSON.parse(res.body);
  } catch (error) {
    check('response is valid JSON', false, error.message);
  }
  if (index) {
    check('response is valid JSON', true);
    check('index is non-empty', Array.isArray(index) && index.length > 0, `len ${index.length}`);
    const sample = index.find((entry) => entry.path === 'references/journal-constraints.md');
    check('includes a known reference file', Boolean(sample), sample ? '' : 'journal-constraints.md missing');
    if (sample) {
      check('entry has kind', typeof sample.kind === 'string' && sample.kind.length > 0);
      check('entry has title', typeof sample.title === 'string' && sample.title.length > 0);
      check('entry has keywords', Array.isArray(sample.keywords) && sample.keywords.length > 0, JSON.stringify(sample.keywords));
      check('entry has bytes', typeof sample.bytes === 'number' && sample.bytes > 0);
      check('entry has subtitle', typeof sample.subtitle === 'string' && sample.subtitle.length > 0);
    }
    const chinese = index.find((entry) => entry.path === 'prompts/02-introduction.md');
    check('chinese module indexed', Boolean(chinese));
    if (chinese) {
      const joined = [chinese.title, chinese.subtitle, ...(chinese.keywords || [])].join(' ');
      check('chinese keywords extracted', /[一-鿿]/.test(joined), joined.slice(0, 60));
      check('chinese module keywords are chinese terms', (chinese.keywords || []).some((k) => /[一-鿿]{2,}/.test(k)), JSON.stringify(chinese.keywords));
    }
    const english = index.find((entry) => entry.path === 'prompts-en/02-introduction.md');
    check('english module indexed separately', Boolean(english));
    if (english) {
      check('english module keeps english keywords', (english.keywords || []).some((k) => /^[A-Za-z]/.test(k)), JSON.stringify(english.keywords));
    }
  }

  // ── full-text search: ?q= scans the file bodies ───────────────────
  const search = (query) => {
    const res = mockRes();
    webRoute.handler(
      { method: 'GET', url: `/dsh-academic-paper-polish/skill-index?q=${encodeURIComponent(query)}` },
      res,
    );
    return { status: res.statusCode, body: res.body };
  };

  const zoo = search('ZooBank');
  check('search returns 200', zoo.status === 200, `got ${zoo.status}`);
  let zooHits = null;
  try {
    zooHits = JSON.parse(zoo.body);
  } catch (error) {
    check('search response is valid JSON', false, error.message);
  }
  if (zooHits) {
    check('search response is valid JSON', true);
    check('full-text term found in the file bodies', Array.isArray(zooHits) && zooHits.length > 0, `${zooHits.length} hits`);
    const withSnippet = (zooHits || []).filter((entry) => entry.snippet);
    check('hits carry a body snippet', withSnippet.length > 0, `${withSnippet.length} with snippets`);
    check(
      'snippet quotes the searched term',
      withSnippet.some((entry) => entry.snippet.toLowerCase().includes('zoobank')),
      withSnippet[0] ? withSnippet[0].snippet.slice(0, 80) : '(no snippet)',
    );
    check(
      'snippet carries a line number',
      withSnippet.every((entry) => typeof entry.line === 'number' && entry.line > 0),
    );
    check(
      'the taxonomy reference is among the hits',
      zooHits.some((entry) => entry.path === 'references/micropaleo-paper-patterns.md'),
      (zooHits || []).map((e) => e.path).join(', '),
    );
  }

  const chineseSearch = search('引文密度');
  let chineseHits = null;
  try {
    chineseHits = JSON.parse(chineseSearch.body);
  } catch {
    /* reported below */
  }
  check('chinese full-text term returns hits', Array.isArray(chineseHits) && chineseHits.length > 0, `${chineseHits && chineseHits.length} hits`);

  const emptySearch = search('zzzznotfound');
  let emptyHits = null;
  try {
    emptyHits = JSON.parse(emptySearch.body);
  } catch {
    /* reported below */
  }
  check('unmatched term returns an empty list', Array.isArray(emptyHits) && emptyHits.length === 0, `${emptyHits && emptyHits.length} hits`);

  const bigSearch = search('图');
  let bigHits = null;
  try {
    bigHits = JSON.parse(bigSearch.body);
  } catch {
    /* reported below */
  }
  check('search result list is capped at 40', Array.isArray(bigHits) && bigHits.length <= 40, `${bigHits && bigHits.length} hits`);

  // ── the trust fence rejects an untrusted request ─────────────────
  const resUntrusted = mockRes();
  webRoute.handler(
    { method: 'GET', url: '/dsh-academic-paper-polish/skill-index', headers: { 'x-untrusted': '1' } },
    resUntrusted,
  );
  check('an untrusted request is rejected', resUntrusted.statusCode === 403, `got ${resUntrusted.statusCode}`);

  // non-GET is rejected
  const res405 = mockRes();
  webRoute.handler({ method: 'POST', url: '/dsh-academic-paper-polish/skill-index' }, res405);
  check('POST rejected with 405', res405.statusCode === 405, `got ${res405.statusCode}`);

  // unknown path under the prefix is 404
  const res404 = mockRes();
  webRoute.handler({ method: 'GET', url: '/dsh-academic-paper-polish/other' }, res404);
  check('unknown path returns 404', res404.statusCode === 404, `got ${res404.statusCode}`);
}

// ══ the capability layer ═════════════════════════════════════════════
//
// Tools, commands and the always-on prompt section are registered through
// `ctx.inject`, so the mock context has to carry those services.

const makeCapabilityCtx = () => {
  const state = { tools: [], commands: [], sections: [] };
  const ctx = {
    skills: { registerProvider: () => () => {} },
    tools: {
      register: (definition) => {
        state.tools.push(definition);
        return () => {};
      },
    },
    commands: {
      register: (definition) => {
        state.commands.push(definition);
        return () => {};
      },
    },
    systemPrompt: {
      section: (section) => {
        state.sections.push(section);
        return () => {};
      },
    },
    webServer: { register: () => () => {} },
    inject: (deps, cb) => {
      cb(ctx);
      return { dispose() {} };
    },
    effect: (fn) => fn(),
    get: () => undefined,
  };
  return { ctx, state };
};

const capability = makeCapabilityCtx();
apply(capability.ctx, {});

check('six tools registered', capability.state.tools.length === 6, `${capability.state.tools.length}`);
const TOOL_NAMES = [
  'paper_check',
  'paper_rules',
  'paper_journals',
  'paper_outline',
  'paper_deai',
  'paper_analyze',
];
check(
  'tool names are exactly the paper_* set',
  TOOL_NAMES.every((name) => capability.state.tools.some((tool) => tool.name === name)) &&
    capability.state.tools.length === TOOL_NAMES.length,
  capability.state.tools.map((tool) => tool.name).join(', '),
);
for (const tool of capability.state.tools) {
  check(`tool ${tool.name} describes when to use it`, typeof tool.description === 'string' && /[一-鿿]/u.test(tool.description));
  check(`tool ${tool.name} declares a JSON schema`, tool.parameters?.type === 'object' && typeof tool.parameters?.properties === 'object');
  check(`tool ${tool.name} declares an output schema`, tool.output?.schema?.type === 'object');
  check(`tool ${tool.name} can render its result`, typeof tool.output?.render === 'function');
  check(`tool ${tool.name} can execute`, typeof tool.execute === 'function');
}

check('six commands registered', capability.state.commands.length === 6, `${capability.state.commands.length}`);
const COMMAND_NAMES = [
  'paper-check',
  'paper-rules',
  'paper-journals',
  'paper-outline',
  'paper-deai',
  'paper-analyze',
];
check(
  'command names are exactly the paper-* set',
  COMMAND_NAMES.every((name) => capability.state.commands.some((command) => command.name === name)) &&
    capability.state.commands.length === COMMAND_NAMES.length,
  capability.state.commands.map((command) => command.name).join(', '),
);
for (const command of capability.state.commands) {
  check(`command ${command.name} has a description`, typeof command.description === 'string' && command.description.length > 0);
  check(`command ${command.name} has an input hint`, typeof command.input?.hint === 'string' && command.input.hint.length > 0);
  check(`command ${command.name} has a handler`, typeof command.handler === 'function');
}
const commandByName = new Map(capability.state.commands.map((command) => [command.name, command]));
check(
  'paper-check accepts a file attachment',
  commandByName.get('paper-check')?.input?.attachments === true,
);
check(
  'paper-deai accepts a file attachment',
  commandByName.get('paper-deai')?.input?.attachments === true,
);
check(
  'paper-analyze accepts a file attachment',
  commandByName.get('paper-analyze')?.input?.attachments === true,
);
check(
  'command names carry no leading slash',
  capability.state.commands.every((command) => !command.name.startsWith('/')),
);

check('one prompt section registered', capability.state.sections.length === 1, `${capability.state.sections.length}`);
const section = capability.state.sections[0];
check('prompt section is named', section?.name === 'plugin:academic-paper-polish', section?.name);
check('prompt section lands after the tool sections', section?.order === 2950, String(section?.order));
check(
  'prompt section stays short enough for every request',
  // The section is injected into EVERY request, so it must stay tiny — but it
  // has to name all six tools, and the names alone cost ~120 characters.
  typeof section?.text === 'string' && section.text.length <= 150,
  `${section?.text?.length}`,
);
check(
  'prompt section names the tools instead of the manual',
  TOOL_NAMES.every((name) => section?.text?.includes(name)),
);
check(
  'prompt section does not paste the manual',
  typeof section?.text === 'string' && section.text.length < 400,
);

// ── the tools actually run ───────────────────────────────────────────
const toolByName = new Map(capability.state.tools.map((tool) => [tool.name, tool]));
const exec = { agent: undefined, signal: undefined };

const checkReport = await toolByName.get('paper_check').execute(
  { text: 'Abstract\n\nThis is the first time we delve into the problem.' },
  exec,
);
check('paper_check reports ok', checkReport?.ok === true, checkReport?.error);
check('paper_check returns violations', Array.isArray(checkReport?.violations));
check('paper_check returns advice', Array.isArray(checkReport?.advice));
check(
  'paper_check returns a summary',
  typeof checkReport?.summary?.total === 'number' && typeof checkReport?.summary?.pass === 'boolean',
);
const rendered = toolByName.get('paper_check').output.render({}, checkReport);
check(
  'paper_check renders a readable text block',
  Array.isArray(rendered) && rendered[0]?.type === 'text' && rendered[0].text.length > 0,
);

const missingFile = await toolByName.get('paper_check').execute({ path: 'no-such-file.md' }, exec);
check('paper_check reports an unreadable file without throwing', missingFile?.ok === false && typeof missingFile?.error === 'string');

const rulesReport = await toolByName.get('paper_rules').execute({ query: 'dpi' }, exec);
check('paper_rules returns rules and a total', Array.isArray(rulesReport?.rules) && typeof rulesReport?.total === 'number');
check('paper_rules caps its payload', rulesReport.rules.length <= 40, `${rulesReport.rules.length}`);

const journalsReport = await toolByName.get('paper_journals').execute({}, exec);
check('paper_journals returns a journal list', Array.isArray(journalsReport?.journals));
check('paper_journals caps its payload', journalsReport.journals.length <= 20, `${journalsReport.journals.length}`);

const outlineReport = await toolByName.get('paper_outline').execute({}, exec);
check('paper_outline returns a skeleton', Array.isArray(outlineReport?.sections));

const deaiReport = await toolByName.get('paper_deai').execute({ text: 'delve into' }, exec);
check('paper_deai returns hits and a score', Array.isArray(deaiReport?.hits) && deaiReport.score >= 0 && deaiReport.score <= 100);

// paper_analyze — the per-section manuscript analysis the panel uses.
const analyzeInline = await toolByName
  .get('paper_analyze')
  .execute(
    {
      text: 'Abstract\n\nThis delves into the fascinating world of radiolarians.\n\nIntroduction\n\nRadiolarians are fascinating.',
    },
    exec,
  );
check('paper_analyze analyses inline text', analyzeInline?.ok === true && Array.isArray(analyzeInline?.report));
check(
  'paper_analyze reports one entry per section',
  analyzeInline.report.length >= 2,
  `${analyzeInline.report.length} sections`,
);
check(
  'paper_analyze names the sections',
  analyzeInline.report.every((entry) => typeof entry.title === 'string' && entry.title.length > 0),
);
check('paper_analyze returns a de-AI score', analyzeInline?.deai?.score >= 0 && analyzeInline.deai.score <= 100);
check(
  'paper_analyze refuses an empty input',
  (await toolByName.get('paper_analyze').execute({}, exec))?.ok === false,
);
check(
  'paper_analyze reports a missing file without throwing',
  (await toolByName.get('paper_analyze').execute({ path: 'no-such-file.md' }, exec))?.ok === false,
);

// ── the commands actually run ────────────────────────────────────────
const invocation = { rawInput: '', agent: undefined, attachments: [], signal: undefined };
const rulesCommand = await commandByName.get('paper-rules').handler({ ...invocation, rawInput: 'dpi' });
check('paper-rules answers with a report', rulesCommand?.kind === 'success' && rulesCommand.text.length > 0);
const outlineCommand = await commandByName.get('paper-outline').handler({ ...invocation, rawInput: '' });
check('paper-outline answers with a skeleton', outlineCommand?.kind === 'success' && outlineCommand.text.length > 0);
const checkCommand = await commandByName.get('paper-check').handler({ ...invocation, rawInput: 'Abstract\n\nA short paragraph.' });
check('paper-check answers with a report', checkCommand?.kind === 'success' && checkCommand.text.length > 0);
const emptyCommand = await commandByName.get('paper-check').handler({ ...invocation, rawInput: '' });
check('paper-check without input reports an error, never a crash', emptyCommand?.kind === 'error' && typeof emptyCommand.text === 'string');
const deaiCommand = await commandByName.get('paper-deai').handler({ ...invocation, rawInput: 'delve into' });
check('paper-deai answers with a report', deaiCommand?.kind === 'success');
const analyzeCommand = await commandByName
  .get('paper-analyze')
  .handler({ ...invocation, rawInput: 'Abstract\n\nA short abstract.' });
check('paper-analyze answers with a per-section report', analyzeCommand?.kind === 'success' && analyzeCommand.text.length > 0);
check(
  'paper-analyze reports the section headings',
  analyzeCommand.text.includes('摘要') || analyzeCommand.text.includes('Abstract'),
  analyzeCommand.text.slice(0, 120),
);
const analyzeEmpty = await commandByName.get('paper-analyze').handler({ ...invocation, rawInput: '' });
check(
  'paper-analyze without input reports an error, never a crash',
  analyzeEmpty?.kind === 'error' && typeof analyzeEmpty.text === 'string',
);

// ══ the panel API ═════════════════════════════════════════════════════

const makeReq = (method, url, body, headers = {}) => {
  const listeners = {};
  const req = {
    method,
    url,
    headers,
    on(event, handler) {
      listeners[event] = listeners[event] ?? [];
      listeners[event].push(handler);
      return req;
    },
    destroy() {},
  };
  if (body !== undefined) {
    queueMicrotask(() => {
      for (const handler of listeners.data ?? []) handler(Buffer.from(body, 'utf8'));
      for (const handler of listeners.end ?? []) handler();
    });
  } else if (method !== 'GET' && method !== 'HEAD') {
    // a request without a body still ends its stream
    queueMicrotask(() => {
      for (const handler of listeners.end ?? []) handler();
    });
  }
  return req;
};

const apiGet = async (query = '') => {
  const res = mockRes();
  await webRoute.handler(
    makeReq('GET', `/dsh-academic-paper-polish/api${query}`, undefined, {}),
    res,
  );
  return { status: res.statusCode, headers: res.headers, body: res.body };
};

const apiPost = async (path, payload) => {
  const res = mockRes();
  await webRoute.handler(
    makeReq('POST', `/dsh-academic-paper-polish/api${path}`, JSON.stringify(payload), {}),
    res,
  );
  return { status: res.statusCode, headers: res.headers, body: res.body };
};

const apiRawPost = async (path, raw) => {
  const res = mockRes();
  await webRoute.handler(
    makeReq('POST', `/dsh-academic-paper-polish/api${path}`, raw, {}),
    res,
  );
  return { status: res.statusCode, headers: res.headers, body: res.body };
};

const jsonOf = (response) => {
  try {
    return JSON.parse(response.body);
  } catch {
    return null;
  }
};

const meta = await apiGet('/meta');
check('GET /api/meta returns 200', meta.status === 200, `got ${meta.status}`);
check(
  'GET /api/meta is JSON',
  meta.headers['content-type'] === 'application/json; charset=utf-8',
  meta.headers['content-type'],
);
check('GET /api/meta is not cached', meta.headers['cache-control'] === 'no-store');
const metaPayload = jsonOf(meta);
check('GET /api/meta carries a version', typeof metaPayload?.version === 'string');
check(
  'GET /api/meta carries the counts',
  typeof metaPayload?.counts?.rules === 'number' &&
    typeof metaPayload?.counts?.journals === 'number' &&
    typeof metaPayload?.counts?.sentences === 'number' &&
    typeof metaPayload?.counts?.checklists === 'number',
);
check('GET /api/meta lists the domains', Array.isArray(metaPayload?.domains));
check('GET /api/meta lists the sections', Array.isArray(metaPayload?.sections) && metaPayload.sections.includes('abstract'));
check(
  'GET /api/meta lists the severities',
  Array.isArray(metaPayload?.severities) && metaPayload.severities.includes('hard'),
);

const rules = await apiGet('/rules?query=dpi');
check('GET /api/rules returns 200', rules.status === 200, `got ${rules.status}`);
const rulesPayload = jsonOf(rules);
check('GET /api/rules returns rules and a total', Array.isArray(rulesPayload?.rules) && typeof rulesPayload?.total === 'number');
check('GET /api/rules caps the payload', rulesPayload.rules.length <= 200, `${rulesPayload.rules.length}`);
if (rulesPayload.rules.length > 0) {
  const rule = rulesPayload.rules[0];
  check('a rule carries the SCHEMA fields', typeof rule.id === 'string' && typeof rule.title === 'string' && Array.isArray(rule.sections) && typeof rule.source === 'object');
}

const journals = await apiGet('/journals');
check('GET /api/journals returns 200', journals.status === 200, `got ${journals.status}`);
const journalsPayload = jsonOf(journals);
check('GET /api/journals returns a journal list', Array.isArray(journalsPayload?.journals));
check('GET /api/journals caps the payload', journalsPayload.journals.length <= 50, `${journalsPayload.journals.length}`);

const sentences = await apiGet('/sentences');
check('GET /api/sentences returns 200', sentences.status === 200, `got ${sentences.status}`);
check('GET /api/sentences returns a pattern list', Array.isArray(jsonOf(sentences)?.patterns));

const checklists = await apiGet('/checklists');
check('GET /api/checklists returns 200', checklists.status === 200, `got ${checklists.status}`);
check('GET /api/checklists returns a stage list', Array.isArray(jsonOf(checklists)?.stages));

const checked = await apiPost('/check', { text: 'Abstract\n\nThis is the first time we delve into it.' });
check('POST /api/check returns 200', checked.status === 200, `got ${checked.status}`);
const checkedPayload = jsonOf(checked);
check('POST /api/check returns violations, advice and a summary', Array.isArray(checkedPayload?.violations) && Array.isArray(checkedPayload?.advice) && typeof checkedPayload?.summary === 'object');
check(
  'POST /api/check summarises the severity counts',
  typeof checkedPayload?.summary?.total === 'number' &&
    typeof checkedPayload?.summary?.hard === 'number' &&
    typeof checkedPayload?.summary?.soft === 'number' &&
    typeof checkedPayload?.summary?.info === 'number' &&
    typeof checkedPayload?.summary?.pass === 'boolean',
);
if (checkedPayload?.violations?.length > 0) {
  const violation = checkedPayload.violations[0];
  check(
    'a violation carries id, ruleId, title, severity, section and source',
    typeof violation.id === 'string' &&
      violation.ruleId === violation.id &&
      typeof violation.title === 'string' &&
      typeof violation.severity === 'string' &&
      typeof violation.section === 'string' &&
      typeof violation.source === 'object',
  );
}

const deai = await apiPost('/deai', { text: 'delve into' });
check('POST /api/deai returns 200', deai.status === 200, `got ${deai.status}`);
const deaiPayload = jsonOf(deai);
check('POST /api/deai returns hits and a score', Array.isArray(deaiPayload?.hits) && deaiPayload.score >= 0 && deaiPayload.score <= 100);

const outline = await apiPost('/outline', {});
check('POST /api/outline returns 200', outline.status === 200, `got ${outline.status}`);
check('POST /api/outline returns a skeleton', Array.isArray(jsonOf(outline)?.sections));

// unknown API path
const unknown = await apiGet('/does-not-exist');
check('an unknown API path returns 404', unknown.status === 404, `got ${unknown.status}`);
check('an unknown API path answers JSON', jsonOf(unknown)?.error === 'not-found');

// wrong method
const wrongMethod = await apiGet('/check');
check('GET on a POST route returns 405', wrongMethod.status === 405, `got ${wrongMethod.status}`);
check('the 405 names the allowed method', wrongMethod.headers.allow === 'POST', String(wrongMethod.headers.allow));
const wrongMethod2 = await apiPost('/meta', {});
check('POST on a GET route returns 405', wrongMethod2.status === 405, `got ${wrongMethod2.status}`);
check('the 405 names the allowed method', wrongMethod2.headers.allow === 'GET', String(wrongMethod2.headers.allow));

// malformed body
const malformed = await apiRawPost('/check', '{not json');
check('a malformed body returns 400', malformed.status === 400, `got ${malformed.status}`);
check('a malformed body answers JSON', jsonOf(malformed)?.error === 'bad-request');

// oversized body
const oversized = await apiRawPost('/check', 'x'.repeat(2 * 1024 * 1024 + 1024));
check('an oversized body returns 413', oversized.status === 413, `got ${oversized.status}`);

// the trust fence also covers the API routes
const untrustedApi = mockRes();
await webRoute.handler(
  makeReq('GET', '/dsh-academic-paper-polish/api/meta', undefined, { 'x-untrusted': '1' }),
  untrustedApi,
);
check('an untrusted API request is rejected', untrustedApi.statusCode === 403, `got ${untrustedApi.statusCode}`);

// a request without credentials is rejected by the host connection service
const makeApiCtx = (options = {}) => {
  const state = { route: null };
  const ctx = {
    skills: { registerProvider: () => () => {} },
    webServer: {
      register: (route) => {
        state.route = route;
        return () => {};
      },
    },
    connection:
      options.connection ?? {
        requestRejection: (req) =>
          req?.headers?.authorization ? undefined : 401,
      },
    inject: (deps, cb) => {
      cb(ctx);
      return { dispose() {} };
    },
    effect: (fn) => fn(),
  };
  if (options.agents !== undefined) ctx.agents = options.agents;
  if (options.sessionController !== undefined) ctx.sessionController = options.sessionController;
  apply(ctx, {});
  return state.route;
};

const unauthorizedRoute = makeApiCtx();
const unauthorized = mockRes();
await unauthorizedRoute.handler(
  makeReq('GET', '/dsh-academic-paper-polish/api/meta', undefined, {}),
  unauthorized,
);
check('an API request without credentials returns 401', unauthorized.statusCode === 401, `got ${unauthorized.statusCode}`);

// ══ POST /api/send ═════════════════════════════════════════════════════

const sendWith = async (payload, options = {}) => {
  const route = makeApiCtx(options);
  const res = mockRes();
  await route.handler(
    makeReq('POST', '/dsh-academic-paper-polish/api/send', JSON.stringify(payload), {
      authorization: 'Bearer test-token',
    }),
    res,
  );
  return { status: res.statusCode, body: res.body, payload: jsonOf(res) };
};

const emptySend = await sendWith({ text: '' }, { agents: { list: () => [], get: () => undefined } });
check('POST /api/send rejects empty text', emptySend.status === 400, `got ${emptySend.status}`);
check('POST /api/send names the error', emptySend.payload?.error === 'bad-request');

const longSend = await sendWith({ text: 'x'.repeat(20001) }, { agents: { list: () => [], get: () => undefined } });
check('POST /api/send rejects an oversized message', longSend.status === 400, `got ${longSend.status}`);

const noAgents = await sendWith({ text: 'hello' });
check('POST /api/send without the agents service returns 503', noAgents.status === 503, `got ${noAgents.status}`);
check('POST /api/send names the 503', noAgents.payload?.error === 'agents-unavailable');

const noLive = await sendWith({ text: 'hello' }, { agents: { list: () => [], get: () => undefined } });
check('POST /api/send without a live session returns 409', noLive.status === 409, `got ${noLive.status}`);
check('POST /api/send names the 409', noLive.payload?.error === 'no-live-session');

const received = [];
const fakeAgent = {
  id: 'session-42',
  session: { snapshotEvents: () => [{ type: 'user/message', time: 1700000000000 }] },
  followup: (message) => {
    received.push(message);
  },
};
const fakeAgents = {
  list: () => [fakeAgent],
  get: (id) => (id === 'session-42' ? fakeAgent : undefined),
};

const sent = await sendWith({ text: 'hello panel', sessionId: 'session-42' }, { agents: fakeAgents });
check('POST /api/send returns 200', sent.status === 200, `got ${sent.status}`);
check('POST /api/send reports ok', sent.payload?.ok === true);
check('POST /api/send reports the session', sent.payload?.sessionId === 'session-42', String(sent.payload?.sessionId));
check('POST /api/send reports the mode', sent.payload?.mode === 'followup');
check('POST /api/send reached the agent', received.length === 1, `${received.length}`);
if (received.length === 1) {
  const message = received[0];
  check('the message is a user message', message.role === 'user');
  check('the message carries a fresh id', typeof message.id === 'string' && message.id.length > 0);
  check('the message carries the text', message.content?.[0]?.type === 'text' && message.content[0].text === 'hello panel');
  check(
    'the message carries a custom source kind, not a human one',
    message.source?.kind === 'academic-paper-polish',
    JSON.stringify(message.source),
  );
  check('the message is frozen', Object.isFrozen(message));
}

// a cold session is resolved (or resumed) through the session controller
const coldAgents = { list: () => [], get: () => undefined };
const coldController = {
  resolveAgent: async (sessionId) => {
    coldResolved.push(sessionId);
    return { agent: fakeAgent };
  },
};
const coldResolved = [];
const cold = await sendWith(
  { text: 'cold hello', sessionId: 'session-cold' },
  { agents: coldAgents, sessionController: coldController },
);
check('POST /api/send resolves a cold session', cold.status === 200, `got ${cold.status}`);
check('POST /api/send asked the controller for the session', coldResolved[0] === 'session-cold');
check('POST /api/send delivered the cold message', received.length === 2, `${received.length}`);

// ── journal scoping: another journal's rules must never be reported ──
//
// S-55 ("PE 必须提供 plain language summary") is scoped to
// `palaeontologia-electronica`. It must only ever be reported for PE.

const scopedText =
  'Abstract\n\nThis abstract lacks the required non-specialist summary.\n\nIntroduction\n\nIntro.\n';

const esrReport = await toolByName.get('paper_check').execute(
  { text: scopedText, journal: 'earth-science-reviews' },
  exec,
);
check(
  'a journal-scoped rule of another journal is NOT reported',
  esrReport.violations.every((violation) => violation.id !== 'S-55'),
  esrReport.violations.filter((violation) => violation.id === 'S-55').length,
);
check(
  'the resolved journal key is reported',
  esrReport.summary.journalKey === 'earth-science-reviews',
  String(esrReport.summary.journalKey),
);
check(
  'the rules of other journals are counted as skipped',
  esrReport.summary.skippedJournalRules > 0,
  String(esrReport.summary.skippedJournalRules),
);

const peReport = await toolByName.get('paper_check').execute(
  { text: scopedText, journal: 'palaeontologia-electronica' },
  exec,
);
check(
  'the journal-scoped rule IS reported for its own journal',
  peReport.violations.some((violation) => violation.id === 'S-55'),
);
check(
  'the abbreviation resolves to the same journal',
  peReport.summary.journalKey === 'palaeontologia-electronica',
  String(peReport.summary.journalKey),
);

const peByAbbreviation = await toolByName.get('paper_check').execute(
  { text: scopedText, journal: 'PE' },
  exec,
);
check(
  'a journal abbreviation resolves to the same key',
  peByAbbreviation.summary.journalKey === 'palaeontologia-electronica',
  String(peByAbbreviation.summary.journalKey),
);
check(
  'the abbreviation reports the same journal-scoped rule',
  peByAbbreviation.violations.some((violation) => violation.id === 'S-55'),
);

const noJournalReport = await toolByName.get('paper_check').execute({ text: scopedText }, exec);
check(
  'without a target journal the journal-scoped rules are skipped',
  noJournalReport.summary.skippedJournalRules > 0,
  String(noJournalReport.summary.skippedJournalRules),
);
check(
  'without a target journal no journal-scoped rule is reported',
  noJournalReport.violations.every((violation) => violation.id !== 'S-55'),
);
check(
  'the rendered result says how many journal rules were skipped',
  toolByName
    .get('paper_check')
    .output.render({}, noJournalReport)[0].text.includes('跳过'),
);

const unknownJournalReport = await toolByName.get('paper_check').execute(
  { text: scopedText, journal: 'No Such Journal' },
  exec,
);
check(
  'an unknown journal is reported, not thrown',
  unknownJournalReport.ok === true && unknownJournalReport.summary.journalUnknown === true,
);
check(
  'an unknown journal still applies the general rules',
  unknownJournalReport.summary.checkedRules > 0,
  String(unknownJournalReport.summary.checkedRules),
);
check(
  'the rendered result names the unknown journal',
  toolByName
    .get('paper_check')
    .output.render({}, unknownJournalReport)[0].text.includes('未识别'),
);

// paper_rules: a journal adds that journal's own rules
const generalRules = await toolByName.get('paper_rules').execute({}, exec);
const journalRules = await toolByName.get('paper_rules').execute({ journal: 'paleobiology' }, exec);
check(
  'paper_rules with a journal returns more rules than without',
  journalRules.total > generalRules.total,
  `${generalRules.total} -> ${journalRules.total}`,
);
check(
  'paper_rules with a journal includes its journal-scoped rules',
  journalRules.rules.some((rule) => (rule.journals ?? []).includes('paleobiology')),
);
check(
  'paper_rules without a journal returns only general rules',
  generalRules.rules.every((rule) => (rule.journals ?? []).length === 0),
);
check(
  'paper_rules reports the resolved journal',
  journalRules.journalKey === 'paleobiology',
  String(journalRules.journalKey),
);

const rulesCommandWithJournal = await commandByName.get('paper-rules').handler({
  ...invocation,
  rawInput: 'journal=paleobiology',
});
check(
  'the paper-rules command accepts journal=',
  rulesCommandWithJournal?.kind === 'success' && rulesCommandWithJournal.text.includes('paleobiology'),
);

// ══ the manuscript routes ═════════════════════════════════════════════
//
// GET  /api/session/files — the papers of the session, with the auto-select
// POST /api/analyze      — the section-by-section analysis of one paper
//
// The fixtures live in a temporary directory that stands in for the working
// directory of a session.

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value;
  }
  return table;
})();

function crc32(buffer) {
  let value = 0xffffffff;
  for (let index = 0; index < buffer.length; index += 1) {
    value = CRC_TABLE[(value ^ buffer[index]) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

/** A minimal ZIP writer: stored (0) or deflated (8) entries. */
function buildZip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const file of files) {
    const nameBuffer = Buffer.from(file.name, 'utf8');
    const raw = Buffer.from(file.text, 'utf8');
    const method = file.method ?? 0;
    const data = method === 8 ? deflateRawSync(raw) : raw;
    const crc = crc32(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuffer, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuffer);
    offset += local.length + nameBuffer.length + data.length;
  }
  const centralBuffer = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, centralBuffer, end]);
}

/** A minimal .docx: one XML part with the paragraphs of the manuscript. */
function buildDocx(paragraphs) {
  const body = paragraphs
    .map((paragraph) => {
      const properties = paragraph.style
        ? `<w:pPr><w:pStyle w:val="${paragraph.style}"/></w:pPr>`
        : '';
      return `<w:p>${properties}<w:r><w:t xml:space="preserve">${paragraph.text}</w:t></w:r></w:p>`;
    })
    .join('');
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;
  return buildZip([
    { name: '[Content_Types].xml', text: '<?xml version="1.0"?><Types/>' },
    { name: '_rels/.rels', text: '<?xml version="1.0"?><Relationships/>' },
    // deflated on purpose: the reader must inflate it
    { name: 'word/document.xml', text: document, method: 8 },
    {
      name: 'docProps/core.xml',
      text: '<?xml version="1.0"?><cp:coreProperties xmlns:cp="c" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Test Manuscript</dc:title></cp:coreProperties>',
    },
  ]);
}

const DOCX_PARAGRAPHS = [
  { text: 'A new ammonite from the Qilian Basin, China' },
  { text: 'Abstract', style: 'Heading1' },
  {
    text: 'This study describes a new ammonite species from the Qilian Basin and reviews the stratigraphic context of the material. The record extends the known range of the genus by about two million years and refines the regional correlation of the lower Cenomanian beds.',
  },
  { text: 'Introduction', style: 'Heading1' },
  {
    text: 'Ammonites are index fossils for the Cretaceous of the Qilian Basin (Author et al., 2020). Their taxonomy has been revised repeatedly over the last decade, but the middle part of the sequence is still poorly constrained.',
  },
  { text: 'Materials and Methods', style: 'Heading1' },
  {
    text: 'The material was collected from three measured sections. All specimens are housed in the repository of the local institute of geology and every specimen carries its own locality and horizon data.',
  },
  { text: 'Results', style: 'Heading1' },
  {
    text: 'The new taxon is diagnosed by a distinctive whorl profile and a finely ornamented phragmocone. Nine specimens preserve the suture line and three of them expose the complete body chamber.',
  },
  { text: 'Discussion', style: 'Heading1' },
  {
    text: 'The new species is compared with the type material of the type species and with the material described previously. The differences in the rib density separate the new taxon from its closest neighbour.',
  },
  { text: 'Conclusion', style: 'Heading1' },
  {
    text: 'The new ammonite extends the stratigraphic range of the genus and refines the regional correlation. It also shows that the basin was open to the sea during the interval.',
  },
  { text: 'References', style: 'Heading1' },
  {
    text: 'Author, A. (2020). A revision of the ammonites of the region. Journal of Palaeontology, 44, 1-20. Author, B. (2021). New material from the basin. Palaeontology, 45, 22-31.',
  },
];

const MARKDOWN_MANUSCRIPT = [
  'A new ammonite from the Qilian Basin, China',
  '',
  '## Abstract',
  '',
  'This study describes a new ammonite species from the Qilian Basin. The record extends the known range of the genus by about two million years and refines the regional correlation of the lower Cenomanian beds of the region.',
  '',
  '## Introduction',
  '',
  'Ammonites are index fossils for the Cretaceous of the Qilian Basin (Author et al., 2020). Their taxonomy has been revised repeatedly over the last decade.',
  '',
  '## Results',
  '',
  'The new taxon is diagnosed by a distinctive whorl profile and a finely ornamented phragmocone.',
  '',
  '## References',
  '',
  'Author, A. (2020). A revision of the ammonites of the region. Journal of Palaeontology, 44, 1-20.',
].join('\n');

// ── the fixture directories ──────────────────────────────────────────
const workRoot = mkdtempSync(join(tmpdir(), 'paper-session-'));
const work = join(workRoot, 'work');
const workAmbiguous = join(workRoot, 'ambiguous');
const workPlain = join(workRoot, 'plain');
for (const dir of [work, workAmbiguous, workPlain]) mkdirSync(dir, { recursive: true });

writeFileSync(join(work, 'paper_v3.docx'), buildDocx(DOCX_PARAGRAPHS));
writeFileSync(join(work, 'old_draft.pdf'), 'not really a pdf, just a placeholder for the candidate list\n');
mkdirSync(join(work, 'node_modules', 'left-pad'), { recursive: true });
writeFileSync(join(work, 'node_modules', 'left-pad', 'readme.md'), '## Abstract\n\nA dependency, not a manuscript.\n');
mkdirSync(join(work, 'sub', 'deep', 'nested', 'deeper'), { recursive: true });
writeFileSync(join(work, 'sub', 'deep', 'nested', 'notes.md'), 'Some field notes about the sections.\n');
writeFileSync(join(work, 'sub', 'deep', 'nested', 'deeper', 'buried.md'), 'Too deep to be found.\n');
writeFileSync(join(workAmbiguous, 'paper_a.docx'), buildDocx(DOCX_PARAGRAPHS));
writeFileSync(join(workAmbiguous, 'paper_b.docx'), buildDocx(DOCX_PARAGRAPHS));
writeFileSync(join(workPlain, 'body.md'), MARKDOWN_MANUSCRIPT);

/** A live agent whose working directory is `cwd`. */
const agentFor = (cwd, id = 'session-42') => ({
  id,
  session: {
    header: { cwd },
    snapshotEvents: () => [{ type: 'user/message', time: 1700000000000 }],
  },
});

const openCtx = (options = {}) =>
  makeApiCtx({ ...options, connection: { requestRejection: () => undefined } });

const sessionGet = async (query, options = {}) => {
  const route = openCtx(options);
  const res = mockRes();
  await route.handler(
    makeReq('GET', `/dsh-academic-paper-polish/api/session/files${query}`, undefined, {}),
    res,
  );
  return { status: res.statusCode, body: res.body, payload: jsonOf(res) };
};

const sessionPost = async (path, payload, options = {}) => {
  const route = openCtx(options);
  const res = mockRes();
  await route.handler(
    makeReq('POST', `/dsh-academic-paper-polish/api${path}`, JSON.stringify(payload), {}),
    res,
  );
  return { status: res.statusCode, body: res.body, payload: jsonOf(res) };
};

// ── discovery ─────────────────────────────────────────────────────────

const noSession = await sessionGet('', { agents: { list: () => [], get: () => undefined } });
check('GET /api/session/files without a live session returns 409', noSession.status === 409, `got ${noSession.status}`);
check('GET /api/session/files names the 409', noSession.payload?.error === 'no-session', String(noSession.payload?.error));

const workAgent = agentFor(work);
const discovered = await sessionGet('?sessionId=session-42', {
  agents: { list: () => [workAgent], get: (id) => (id === 'session-42' ? workAgent : undefined) },
});
check('GET /api/session/files returns 200', discovered.status === 200, `got ${discovered.status}`);
check('GET /api/session/files echoes the session', discovered.payload?.sessionId === 'session-42', String(discovered.payload?.sessionId));
check('GET /api/session/files reports the working directory', String(discovered.payload?.cwd ?? '').endsWith('work'), String(discovered.payload?.cwd));
check('GET /api/session/files returns a candidate list', Array.isArray(discovered.payload?.files));
const candidates = discovered.payload?.files ?? [];
check('the candidate list is sorted by score', candidates.every((entry, index) => index === 0 || candidates[index - 1].score >= entry.score));
const top = candidates[0];
check('the best candidate is the docx', top?.name === 'paper_v3.docx', top?.name);
check('the best candidate carries a score', typeof top?.score === 'number' && top.score >= 140, String(top?.score));
check('the best candidate is a manuscript', top?.kind === 'manuscript', String(top?.kind));
check('the best candidate explains itself', Array.isArray(top?.reasons) && top.reasons.length > 0, JSON.stringify(top?.reasons));
check(
  'the reasons mention the file name',
  (top?.reasons ?? []).some((reason) => reason.includes('paper')),
  JSON.stringify(top?.reasons),
);
check(
  'the reasons mention the headings',
  (top?.reasons ?? []).some((reason) => reason.includes('Abstract')),
  JSON.stringify(top?.reasons),
);
check('the best candidate is auto-selected', discovered.payload?.best === top?.path, String(discovered.payload?.best));
check(
  'the winner beats the runner-up by the ambiguity factor',
  candidates.length < 2 || top.score >= 1.6 * candidates[1].score,
  `${top?.score} vs ${candidates[1]?.score}`,
);
check(
  'a candidate carries the metadata the panel shows',
  candidates.every(
    (entry) =>
      typeof entry.path === 'string' &&
      typeof entry.name === 'string' &&
      typeof entry.ext === 'string' &&
      typeof entry.bytes === 'number' &&
      typeof entry.mtime === 'string' &&
      ['manuscript', 'other'].includes(entry.kind),
  ),
);
check(
  'the skip list is honoured (node_modules is not walked)',
  candidates.every((entry) => !entry.path.includes('node_modules')),
  candidates.map((entry) => entry.path).join(', '),
);
check(
  'the depth limit is honoured (level 3 is read)',
  candidates.some((entry) => entry.path.endsWith('nested/notes.md')),
  candidates.map((entry) => entry.path).join(', '),
);
check(
  'the depth limit is honoured (level 4 is not read)',
  candidates.every((entry) => !entry.path.includes('buried.md')),
  candidates.map((entry) => entry.path).join(', '),
);
check(
  'a pdf is a candidate even though it cannot be extracted',
  candidates.some((entry) => entry.ext === '.pdf'),
  candidates.map((entry) => entry.ext).join(', '),
);

// without a session id the most recently active agent is used
const latest = await sessionGet('', {
  agents: { list: () => [workAgent], get: () => undefined },
});
check('GET /api/session/files falls back to the latest agent', latest.status === 200, `got ${latest.status}`);
check('the fallback reports the agent id', latest.payload?.sessionId === 'session-42', String(latest.payload?.sessionId));

// two candidates that score the same → the human has to choose
const ambiguousAgent = agentFor(workAmbiguous, 'session-77');
const ambiguous = await sessionGet('?sessionId=session-77', {
  agents: { list: () => [ambiguousAgent], get: (id) => (id === 'session-77' ? ambiguousAgent : undefined) },
});
check('an ambiguous session still returns 200', ambiguous.status === 200, `got ${ambiguous.status}`);
check('an ambiguous session lists both candidates', (ambiguous.payload?.files ?? []).length === 2, String((ambiguous.payload?.files ?? []).length));
check('an ambiguous session returns best: null', ambiguous.payload?.best === null, String(ambiguous.payload?.best));
check(
  'the ambiguous candidates really score the same',
  (ambiguous.payload?.files ?? []).length < 2 ||
    ambiguous.payload.files[0].score === ambiguous.payload.files[1].score,
  (ambiguous.payload?.files ?? []).map((entry) => entry.score).join(', '),
);

// a cold session is resolved through the session controller
const coldResolvedIds = [];
const coldSession = await sessionGet('?sessionId=session-cold', {
  agents: { list: () => [], get: () => undefined },
  sessionController: {
    resolveAgent: async (sessionId) => {
      coldResolvedIds.push(sessionId);
      return { agent: agentFor(work, 'session-cold') };
    },
  },
});
check('a cold session is resolved through the controller', coldSession.status === 200, `got ${coldSession.status}`);
check('the controller was asked for the session', coldResolvedIds[0] === 'session-cold', String(coldResolvedIds[0]));

// ── analysis ──────────────────────────────────────────────────────────

const plainAgent = agentFor(workPlain, 'session-plain');
const plainCtx = {
  agents: { list: () => [plainAgent], get: (id) => (id === 'session-plain' ? plainAgent : undefined) },
};

const noPath = await sessionPost('/analyze', {}, plainCtx);
check('POST /api/analyze without a path returns 400', noPath.status === 400, `got ${noPath.status}`);
check('POST /api/analyze names the 400', noPath.payload?.error === 'bad-request', String(noPath.payload?.error));

const missing = await sessionPost('/analyze', { path: 'no-such-file.docx' }, plainCtx);
check('POST /api/analyze with a missing file returns 404', missing.status === 404, `got ${missing.status}`);
check('POST /api/analyze names the 404', missing.payload?.error === 'file-not-found', String(missing.payload?.error));

const outside = await sessionPost(
  '/analyze',
  { path: join(workAmbiguous, 'paper_a.docx') },
  plainCtx,
);
check('POST /api/analyze outside the working directory returns 403', outside.status === 403, `got ${outside.status}`);
check('POST /api/analyze names the 403', outside.payload?.error === 'forbidden', String(outside.payload?.error));

const workCtx = {
  agents: { list: () => [workAgent], get: (id) => (id === 'session-42' ? workAgent : undefined) },
};

// a link that points out of the working directory is refused as well
try {
  symlinkSync(workAmbiguous, join(work, 'escape'), 'junction');
  const escaped = await sessionPost(
    '/analyze',
    { path: 'escape/paper_a.docx' },
    workCtx,
  );
  check('a link out of the working directory returns 403', escaped.status === 403, `got ${escaped.status}`);
  check('a link out of the working directory names the 403', escaped.payload?.error === 'forbidden', String(escaped.payload?.error));
} catch (error) {
  console.log(`· the symlink check was skipped (${error.code ?? error.message})`);
}

const pdf = await sessionPost('/analyze', { path: 'old_draft.pdf' }, workCtx);
check('POST /api/analyze with a pdf returns 415', pdf.status === 415, `got ${pdf.status}`);
check('POST /api/analyze names the 415', pdf.payload?.error === 'unsupported-format', String(pdf.payload?.error));
check(
  'the 415 tells the human what to do',
  String(pdf.payload?.message ?? '').includes('docx'),
  String(pdf.payload?.message),
);

writeFileSync(join(workPlain, 'unknown.xyz'), 'what is this\n');
const unknownFormat = await sessionPost('/analyze', { path: 'unknown.xyz' }, plainCtx);
check('POST /api/analyze with an unknown extension returns 415', unknownFormat.status === 415, `got ${unknownFormat.status}`);

// the plain-text manuscript
const analyzed = await sessionPost('/analyze', { path: 'body.md' }, plainCtx);
check('POST /api/analyze returns 200', analyzed.status === 200, `got ${analyzed.status} ${analyzed.body.slice(0, 200)}`);
const report = analyzed.payload?.report ?? [];
check('the report has one entry per section', report.length === 5, String(report.length));
check(
  'the report follows the canonical section order',
  report.map((entry) => entry.section).join(',') === 'title,abstract,introduction,results,references',
  report.map((entry) => entry.section).join(','),
);
check(
  'a report entry carries the section key, title and word count',
  report.every(
    (entry) =>
      typeof entry.section === 'string' &&
      typeof entry.title === 'string' &&
      typeof entry.words === 'number' &&
      entry.words > 0,
  ),
);
check(
  'a report entry carries its own summary',
  report.every(
    (entry) =>
      entry.summary &&
      typeof entry.summary.total === 'number' &&
      typeof entry.summary.hard === 'number' &&
      typeof entry.summary.soft === 'number' &&
      typeof entry.summary.info === 'number' &&
      typeof entry.summary.pass === 'boolean' &&
      typeof entry.summary.checkedRules === 'number' &&
      typeof entry.summary.manualRules === 'number' &&
      typeof entry.summary.skippedJournalRules === 'number' &&
      'journalKey' in entry.summary &&
      typeof entry.summary.journalUnknown === 'boolean',
  ),
);
check(
  'a report entry carries violations and advice',
  report.every((entry) => Array.isArray(entry.violations) && Array.isArray(entry.advice)),
);
check(
  'a violation carries the rule it comes from',
  report
    .flatMap((entry) => entry.violations)
    .every(
      (violation) =>
        typeof violation.id === 'string' &&
        typeof violation.ruleId === 'string' &&
        typeof violation.title === 'string' &&
        ['hard', 'soft', 'info'].includes(violation.severity) &&
        typeof violation.statement === 'string' &&
        typeof violation.fix === 'string' &&
        typeof violation.source === 'object',
    ),
);
check(
  'the file block describes the analysed file',
  analyzed.payload?.file?.name === 'body.md' &&
    analyzed.payload?.file?.format === 'md' &&
    typeof analyzed.payload?.file?.bytes === 'number' &&
    Array.isArray(analyzed.payload?.file?.sections),
);
check(
  'the file block lists the sections with their word counts',
  (analyzed.payload?.file?.sections ?? []).length === 5 &&
    analyzed.payload.file.sections.every(
      (entry) =>
        typeof entry.key === 'string' &&
        typeof entry.title === 'string' &&
        typeof entry.words === 'number',
    ),
);
check(
  'the top level summary counts the violations',
  typeof analyzed.payload?.summary?.total === 'number' &&
    analyzed.payload.summary.hard + analyzed.payload.summary.soft + analyzed.payload.summary.info ===
      analyzed.payload.summary.total &&
    analyzed.payload.summary.sections === report.length,
  JSON.stringify(analyzed.payload?.summary),
);
check(
  'the de-AI block carries a score and the hits',
  typeof analyzed.payload?.deai?.score === 'number' &&
    analyzed.payload.deai.score >= 0 &&
    analyzed.payload.deai.score <= 100 &&
    Array.isArray(analyzed.payload?.deai?.hits),
);

// with a target journal the journal specific rules apply
const withJournal = await sessionPost(
  '/analyze',
  { path: 'body.md', journal: 'paleobiology' },
  plainCtx,
);
check(
  'a known journal is resolved to its key',
  withJournal.payload?.report?.[0]?.summary?.journalKey === 'paleobiology',
  String(withJournal.payload?.report?.[0]?.summary?.journalKey),
);
check(
  'a known journal is not unknown',
  withJournal.payload?.report?.[0]?.summary?.journalUnknown === false,
);
const withAbbreviation = await sessionPost(
  '/analyze',
  { path: 'body.md', journal: 'PE' },
  plainCtx,
);
check(
  'a journal abbreviation resolves to the same key',
  withAbbreviation.payload?.report?.[0]?.summary?.journalKey === 'palaeontologia-electronica',
  String(withAbbreviation.payload?.report?.[0]?.summary?.journalKey),
);
const unknownJournal = await sessionPost(
  '/analyze',
  { path: 'body.md', journal: 'No Such Journal' },
  plainCtx,
);
check(
  'an unknown journal is reported, not thrown',
  unknownJournal.status === 200 && unknownJournal.payload?.report?.[0]?.summary?.journalUnknown === true,
  `${unknownJournal.status} ${JSON.stringify(unknownJournal.payload?.report?.[0]?.summary ?? {})}`,
);
check(
  'an unknown journal still applies the general rules',
  (unknownJournal.payload?.report ?? []).some((entry) => (entry.summary?.checkedRules ?? 0) > 0),
  JSON.stringify((unknownJournal.payload?.report ?? []).map((entry) => entry.summary?.checkedRules)),
);

// the .docx fixture
const docxReport = await sessionPost('/analyze', { path: 'paper_v3.docx' }, workCtx);
check('POST /api/analyze reads a docx', docxReport.status === 200, `got ${docxReport.status} ${docxReport.body.slice(0, 200)}`);
check('the docx file block reports the format', docxReport.payload?.file?.format === 'docx', String(docxReport.payload?.file?.format));
check(
  'the extracted headings become sections',
  ['abstract', 'introduction', 'methods', 'results', 'discussion', 'conclusion', 'references'].every(
    (key) => (docxReport.payload?.file?.sections ?? []).some((entry) => entry.key === key),
  ),
  JSON.stringify((docxReport.payload?.file?.sections ?? []).map((entry) => entry.key)),
);
check(
  'the docx report follows the canonical order too',
  (docxReport.payload?.report ?? [])
    .map((entry) => entry.section)
    .join(',')
    .includes('title,abstract,introduction,methods,results,discussion,conclusion,references'),
  (docxReport.payload?.report ?? []).map((entry) => entry.section).join(','),
);
check(
  'the docx body reaches the rule engine',
  (docxReport.payload?.report ?? []).some((entry) => entry.words > 10),
);

// a file without any recognisable heading
writeFileSync(join(workPlain, 'plain.txt'), 'Just one long paragraph of text without any heading at all in it.\n');
const headingless = await sessionPost('/analyze', { path: 'plain.txt' }, plainCtx);
check('a file without headings is still analysed', headingless.status === 200, `got ${headingless.status}`);
check(
  'a file without headings becomes one document entry',
  headingless.payload?.report?.length === 1 && headingless.payload.report[0].section === 'document',
  JSON.stringify((headingless.payload?.report ?? []).map((entry) => entry.section)),
);
check(
  'a file without headings reports no sections',
  Array.isArray(headingless.payload?.file?.sections) && headingless.payload.file.sections.length === 0,
);

// only one section may be asked for
const singleSection = await sessionPost(
  '/analyze',
  { path: 'body.md', section: 'abstract' },
  plainCtx,
);
check(
  'a single section can be asked for',
  singleSection.status === 200 && singleSection.payload?.report?.length === 1 &&
    singleSection.payload.report[0].section === 'abstract',
  JSON.stringify((singleSection.payload?.report ?? []).map((entry) => entry.section)),
);

// ══ the panel-activity beacon ════════════════════════════════════════
//
// The panel reports what it is doing; the host persists it to a file. The
// writer is redirected to a temporary directory (see the top of this file),
// so the developer's real profile is never touched.

const pingGet = async () => {
  const res = mockRes();
  await webRoute.handler(
    makeReq('GET', '/dsh-academic-paper-polish/api/ping', undefined, {}),
    res,
  );
  return { status: res.statusCode, headers: res.headers, body: res.body, payload: jsonOf(res) };
};

const pingPost = async (payload) => {
  const res = mockRes();
  await webRoute.handler(
    makeReq(
      'POST',
      '/dsh-academic-paper-polish/api/ping',
      payload === undefined ? undefined : JSON.stringify(payload),
      {},
    ),
    res,
  );
  return { status: res.statusCode, headers: res.headers, body: res.body, payload: jsonOf(res) };
};

const cleanPing = await pingGet();
check('GET /api/ping returns 200', cleanPing.status === 200, `got ${cleanPing.status}`);
check('GET /api/ping starts empty', Array.isArray(cleanPing.payload?.entries) && cleanPing.payload.entries.length === 0, JSON.stringify(cleanPing.payload?.entries));
check('GET /api/ping names the plugin', cleanPing.payload?.plugin === 'dsh-academic-paper-polish', String(cleanPing.payload?.plugin));
check('GET /api/ping reports the plugin version', typeof cleanPing.payload?.version === 'string' && cleanPing.payload.version.length > 0, String(cleanPing.payload?.version));
check(
  'GET /api/ping is JSON and not cached',
  cleanPing.headers['content-type'] === 'application/json; charset=utf-8' &&
    cleanPing.headers['cache-control'] === 'no-store',
);

const pinged = await pingPost({
  sessionId: 'session-abc',
  view: 'manuscripts',
  event: 'view',
  width: 1280,
});
check('POST /api/ping returns 200', pinged.status === 200, `got ${pinged.status}`);
check('POST /api/ping reports ok', pinged.payload?.ok === true);
check('POST /api/ping reports how many entries are stored', pinged.payload?.recorded === 1, String(pinged.payload?.recorded));

const afterPing = await pingGet();
check('the ping is readable back', afterPing.payload?.entries?.length === 1, String(afterPing.payload?.entries?.length));
const entry = afterPing.payload?.entries?.[0];
check('the entry carries an ISO timestamp', typeof entry?.at === 'string' && !Number.isNaN(Date.parse(entry.at)), String(entry?.at));
check('the entry carries the session id', entry?.sessionId === 'session-abc', String(entry?.sessionId));
check('the entry carries the view', entry?.view === 'manuscripts', String(entry?.view));
check('the entry carries the event', entry?.event === 'view', String(entry?.event));
check('the entry carries the width', entry?.width === 1280, String(entry?.width));
check('the entry drops the fields that were not sent', entry?.error === undefined);

// an error entry keeps a capped message
const errorPing = await pingPost({
  event: 'error',
  error: { message: 'x'.repeat(900), stack: 'y'.repeat(4000) },
});
check('an error ping is accepted', errorPing.status === 200 && errorPing.payload?.recorded === 2, String(errorPing.payload?.recorded));
const errorEntry = (await pingGet()).payload?.entries?.[1];
check('the error message is capped', errorEntry?.error?.message?.length === 500, String(errorEntry?.error?.message?.length));
check('the error stack is capped', errorEntry?.error?.stack?.length === 2000, String(errorEntry?.error?.stack?.length));

// an empty body is a valid ping
const emptyPing = await pingPost(undefined);
check('an empty body is a valid ping', emptyPing.status === 200 && emptyPing.payload?.recorded === 3, `got ${emptyPing.status} ${emptyPing.payload?.recorded}`);
check('an empty ping still stores an entry', (await pingGet()).payload?.entries?.length === 3);

// the 50-entry cap
for (let index = 0; index < 55; index += 1) {
  await pingPost({ event: 'view', view: `v-${index}` });
}
const capped = await pingGet();
check('the log keeps at most 50 entries', capped.payload?.entries?.length === 50, String(capped.payload?.entries?.length));
check(
  'the oldest entries fall off the front',
  // 3 entries existed before the loop, 55 more were added: the log keeps the
  // last 50, so the three early ones plus v-0 … v-4 fell off.
  capped.payload?.entries?.[0]?.view === 'v-5',
  String(capped.payload?.entries?.[0]?.view),
);
check(
  'the newest entry is last',
  capped.payload?.entries?.[49]?.view === 'v-54',
  String(capped.payload?.entries?.[49]?.view),
);

// a corrupt file on disk must not break the reader — and the writer recovers
writeFileSync(join(runtimeRoot, 'panel-activity.json'), '{ this is not json', 'utf8');
const corruptRead = await pingGet();
check('a corrupt log reads as empty', corruptRead.status === 200 && corruptRead.payload?.entries?.length === 0, `got ${corruptRead.status}`);
const recovered = await pingPost({ event: 'mount', view: 'after-corruption' });
check('a ping after a corrupt log still works', recovered.status === 200 && recovered.payload?.recorded === 1, `got ${recovered.status} ${recovered.payload?.recorded}`);
check(
  'the recovered log holds only the new entry',
  (await pingGet()).payload?.entries?.[0]?.view === 'after-corruption',
);

// the file is really written where the contract says
check(
  'the activity file lives in the runtime directory',
  existsSync(join(runtimeRoot, 'panel-activity.json')),
  runtimeRoot,
);

// the wrong method is still rejected
const pingPut = mockRes();
await webRoute.handler(
  makeReq('PUT', '/dsh-academic-paper-polish/api/ping', undefined, {}),
  pingPut,
);
check('PUT on /api/ping returns 405', pingPut.statusCode === 405, `got ${pingPut.statusCode}`);
check('the 405 names both allowed methods', pingPut.headers.allow === 'GET, POST', String(pingPut.headers.allow));

rmSync(runtimeRoot, { recursive: true, force: true });

rmSync(workRoot, { recursive: true, force: true });

if (failures > 0) {
  console.log(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log(`\nhost route verified — ${assertions} assertions`);