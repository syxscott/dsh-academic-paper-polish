// Host-side test: mounts the plugin against a mock webServer and exercises the
// skill-index route handler end to end (no agent, no browser).
// Run: node scripts/host-route-test.mjs
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require_ = createRequire(import.meta.url);
const { apply } = require_('../index.js');

let failures = 0;
const check = (name, condition, detail = '') => {
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

if (failures > 0) {
  console.log(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log('\nhost route verified');
