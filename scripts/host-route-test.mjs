// Host-side test: mounts the plugin against a mock webServer and exercises the
// skill-index route handler end to end (no agent, no browser).
// Also exercises the capability layer: the five paper_* tools, the five
// paper-* commands, the always-on prompt section and the /api/* JSON routes.
// Run: node scripts/host-route-test.mjs
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { createToolDefinitions } from '../lib/tools.mjs';
import { createCommandDefinitions } from '../lib/commands.mjs';

const require_ = createRequire(import.meta.url);
const { apply } = require_('../index.js');

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

check('five tools registered', capability.state.tools.length === 5, `${capability.state.tools.length}`);
const TOOL_NAMES = ['paper_check', 'paper_rules', 'paper_journals', 'paper_outline', 'paper_deai'];
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

check('five commands registered', capability.state.commands.length === 5, `${capability.state.commands.length}`);
const COMMAND_NAMES = ['paper-check', 'paper-rules', 'paper-journals', 'paper-outline', 'paper-deai'];
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
  'command names carry no leading slash',
  capability.state.commands.every((command) => !command.name.startsWith('/')),
);

check('one prompt section registered', capability.state.sections.length === 1, `${capability.state.sections.length}`);
const section = capability.state.sections[0];
check('prompt section is named', section?.name === 'plugin:academic-paper-polish', section?.name);
check('prompt section lands after the tool sections', section?.order === 2950, String(section?.order));
check(
  'prompt section stays short enough for every request',
  typeof section?.text === 'string' && section.text.length <= 130,
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

if (failures > 0) {
  console.log(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log(`\nhost route verified — ${assertions} assertions`);