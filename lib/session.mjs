// Session resolution and manuscript discovery.
//
// The panel knows the id of the session it lives in; the host turns that id
// into the session's working directory (cwd) and then looks for the
// manuscript inside it. Two rules are absolute:
//
//   1. nothing outside the resolved cwd is ever read, and
//   2. no directory is ever hard-coded — the cwd always comes from the
//      live session.
//
// The discovery walk is deliberately conservative: three levels deep, a skip
// list of build/tool directories, a size cap and a scan cap. The score is a
// sum of four independent signals (extension, file name, heading tokens in
// the head of the file, recency) so a single loud signal cannot decide the
// outcome on its own.

import { readdirSync, realpathSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';

import { readHeadText } from './docx.mjs';

/** Directory names that are never walked. */
export const SKIP_DIRECTORIES = Object.freeze([
  'node_modules',
  '.git',
  '.hg',
  '.svn',
  'dist',
  'build',
  '.next',
  '.cache',
  '.turbo',
  'coverage',
  '.venv',
  'venv',
  '__pycache__',
  '.idea',
  '.vscode',
  'target',
  'out',
  'bin',
  'obj',
  'preview',
  'skills',
]);

const SKIP_SET = new Set(SKIP_DIRECTORIES);

/** Candidate extensions and their weight. */
export const EXTENSION_WEIGHTS = Object.freeze({
  '.docx': 100,
  '.tex': 90,
  '.md': 70,
  '.rtf': 60,
  '.txt': 40,
  '.pdf': 30,
  '.odt': 25,
  '.doc': 20,
});

/** The score a candidate needs to count as a manuscript. */
export const MANUSCRIPT_SCORE = 140;

/** The winner must beat the runner-up by this factor, or the human chooses. */
export const AMBIGUITY_FACTOR = 1.6;

/** Files larger than this are not candidates (5 MB). */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** The walk stops after this many files (50 000). */
export const MAX_SCANNED = 50000;

/** How many directory levels below the cwd are walked (3). */
export const MAX_DEPTH = 3;

/** How many candidates are returned (50). */
export const MAX_CANDIDATES = 50;

/** How many bytes of the head of a file are read for the heading scan. */
export const HEAD_BYTES = 16 * 1024;

/** The file-name tokens that mark a manuscript. */
export const NAME_TOKENS = Object.freeze([
  'paper',
  'manuscript',
  'article',
  'draft',
  'thesis',
  'abstract',
  'handout',
  'cover',
  '投稿',
  '论文',
  '稿件',
  '稿子',
  '初稿',
  '全文',
]);

/**
 * The heading tokens of the content bonus. A token only counts when it
 * appears as a HEADING-ish line — the token starts the line (after a
 * markdown marker or a section number). `results` inside a sentence does
 * not count.
 */
export const HEADING_TOKENS = Object.freeze([
  { label: 'Abstract', re: /^abstract\b/iu },
  { label: '摘要', re: /^(摘要|内容摘要)/u },
  { label: 'Introduction', re: /^introduction\b/iu },
  { label: '引言', re: /^(引言|前言|绪论|研究背景)/u },
  { label: 'Methods', re: /^(methods?|materials?\s+(and|&)\s+methods?)\b/iu },
  { label: '材料与方法', re: /^(材料与方法|研究方法|实验方法|资料与方法)/u },
  { label: 'Methodology', re: /^methodology\b/iu },
  { label: 'Results', re: /^results?\b/iu },
  { label: '结果', re: /^(研究结果|结\s*果)/u },
  { label: 'Discussion', re: /^discussion\b/iu },
  { label: '讨论', re: /^(讨论|讨\s*论)/u },
  { label: 'Conclusion', re: /^conclusions?\b/iu },
  { label: '结论', re: /^(结论|结\s*论|结语)/u },
  { label: 'References', re: /^(references?|bibliography)\b/iu },
  { label: '参考文献', re: /^(参考文献|引用文献|文献表)/u },
]);

/** How the extension of a candidate is described to the human. */
const EXTENSION_REASONS = Object.freeze({
  '.docx': '扩展名 .docx 是论文正文格式',
  '.tex': '扩展名 .tex 是 LaTeX 论文源文件',
  '.md': '扩展名 .md 是文稿格式',
  '.rtf': '扩展名 .rtf 是文稿格式',
  '.txt': '扩展名 .txt 是纯文本文稿',
  '.pdf': '扩展名 .pdf 是投稿定稿格式',
  '.odt': '扩展名 .odt 是文稿格式',
  '.doc': '扩展名 .doc 是旧版 Word 稿件',
});

/** Build an error carrying the HTTP status the API must answer. */
export function httpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

/**
 * Resolve an optional host service from a context.
 *
 * The single implementation of this helper: `index.js` imports it from here
 * so the route handlers and the session resolution always look a service up
 * the same way.
 */
export function resolveService(scope, name) {
  if (!scope) return undefined;
  const direct = Reflect.get(scope, name);
  if (direct) return direct;
  if (typeof scope.get === 'function') {
    try {
      return scope.get(name);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** The most recently active live agent, by the newest session event. */
export function pickLatestAgent(agents) {
  let best = null;
  let bestTime = -Infinity;
  const list = typeof agents?.list === 'function' ? agents.list() : [];
  // `list()` is typed to return an array, but a broken or mocked service must
  // not take the whole route down: an unusable list simply means "no agent".
  const agents_ = Array.isArray(list) ? list : [];
  for (const agent of agents_) {
    if (!agent) continue;
    let time = -Infinity;
    try {
      const events = agent.session?.snapshotEvents?.();
      const stream = Array.isArray(events) ? events : [];
      for (const event of stream) {
        const type = event?.type;
        if (type !== 'turn/start' && type !== 'user/message') continue;
        const value = Number(event?.time);
        if (Number.isFinite(value) && value > time) time = value;
      }
    } catch {
      /* an agent without a readable session log is not a candidate */
    }
    if (time > bestTime) {
      bestTime = time;
      best = agent;
    }
  }
  return best;
}

/** The working directory of an agent, with the service as the fallback. */
function cwdOf(scope, agent) {
  try {
    const header = agent?.session?.header?.cwd;
    if (typeof header === 'string' && header.length > 0) return resolve(header);
  } catch {
    /* a cold agent may not expose its header */
  }
  const service = resolveService(scope, 'workingDirectory');
  try {
    if (agent && typeof service?.get === 'function') {
      const value = service.get(agent);
      if (typeof value === 'string' && value.length > 0) return resolve(value);
    }
    if (typeof service?.defaultDirectory === 'string' && service.defaultDirectory.length > 0) {
      return resolve(service.defaultDirectory);
    }
  } catch {
    /* fall through to the process cwd */
  }
  return resolve(process.cwd());
}

/**
 * Resolve the session a request belongs to and the directory it may read.
 *
 *   1. `sessionId` given → the live agent (`agents.get`) → `session.header.cwd`
 *   2. that agent is COLD → the session controller resolves (resumes) it
 *   3. no `sessionId` → the most recently active live agent
 *   4. nothing resolvable → `409 no-session`
 *
 * @param {object} scope   the plugin scope (hosts `agents`, `sessionController`)
 * @param {string} sessionId
 */
export async function resolveSession(scope, sessionId) {
  const requested = String(sessionId ?? '').trim();
  const agents = resolveService(scope, 'agents');
  let agent = null;

  if (requested) {
    if (agents && typeof agents.get === 'function') {
      try {
        agent = agents.get(requested) ?? null;
      } catch {
        agent = null;
      }
    }
    if (!agent) {
      // A session that is not resumed in this process is COLD: `agents.get`
      // returns undefined and does not resume it. The session controller
      // resolves (or resumes) it.
      const controller = resolveService(scope, 'sessionController');
      if (controller && typeof controller.resolveAgent === 'function') {
        let resolved = null;
        try {
          resolved = await controller.resolveAgent(requested);
        } catch (error) {
          throw httpError(
            409,
            'no-session',
            `会话 ${requested} 无法恢复：${error?.message ?? error}`,
          );
        }
        agent = resolved?.agent ?? resolved ?? null;
      }
    }
    if (!agent) throw httpError(409, 'no-session', `会话 ${requested} 不存在或无法恢复`);
  } else {
    agent = pickLatestAgent(agents);
    if (!agent) throw httpError(409, 'no-session', '没有可用的活动会话');
  }

  return {
    sessionId: requested || String(agent.id ?? ''),
    cwd: cwdOf(scope, agent),
    agent,
  };
}

/**
 * Reject a path that leaves the session's working directory.
 *
 * The check is lexical first (`..` is resolved away) and then symbolic: a
 * link inside the cwd that points outside of it is refused as well.
 *
 * @returns {string} the resolved absolute path
 */
export function assertInsideCwd(cwd, target) {
  const root = resolve(cwd);
  const full = resolve(target);
  if (!isInside(root, full)) {
    throw httpError(403, 'forbidden', `路径不在会话工作目录内：${full}`);
  }
  // The symbolic check is a second layer: it only runs when both paths can
  // be resolved, and it compares the two REAL paths with each other.
  try {
    const realRoot = realpathSync(root);
    const realFull = realpathSync(full);
    if (!isInside(realRoot, realFull)) {
      throw httpError(403, 'forbidden', `路径不在会话工作目录内：${full}`);
    }
  } catch (error) {
    if (error && error.status === 403) throw error;
    /* the file may not exist yet — the lexical check already passed */
  }
  return full;
}

function isInside(root, target) {
  const prefix = root.endsWith(sep) ? root : `${root}${sep}`;
  return target === root || target.startsWith(prefix);
}

/** A path in the JSON payload always uses forward slashes. */
export function toPosix(path) {
  return String(path ?? '').split(sep).join('/');
}

/* ── the scoring ──────────────────────────────────────────────────────── */

/** The heading form of a line: no markdown marker, no section number. */
function headingForm(line) {
  return String(line ?? '')
    .replace(/^\s*#{1,6}\s*/u, '')
    .replace(/^\s*(?:\d{1,3}(?:\.\d{1,3})*|[一二三四五六七八九十]+)\s*[.、．)）:：]\s*/u, '')
    .trim();
}

/** The heading tokens present in a text. */
export function headingTokens(text) {
  const found = [];
  const seen = new Set();
  for (const line of String(text ?? '').split(/\r?\n/u)) {
    const form = headingForm(line);
    if (form.length === 0) continue;
    for (const token of HEADING_TOKENS) {
      if (seen.has(token.label)) continue;
      if (token.re.test(form)) {
        seen.add(token.label);
        found.push(token);
      }
    }
  }
  return found;
}

/** The name token that matched, or null. */
function nameToken(name) {
  for (const token of NAME_TOKENS) {
    if (name.toLowerCase().includes(token.toLowerCase())) return token;
  }
  return null;
}

/**
 * Score one candidate. Four independent signals:
 *   extension weight · file name (+60) · heading tokens (+40 each, ≤ +120)
 *   · recency (0…20, linear over the last 90 days).
 */
export function scoreCandidate({ ext, name, mtimeMs, text }) {
  const reasons = [];
  let score = EXTENSION_WEIGHTS[ext] ?? 0;
  if (EXTENSION_REASONS[ext]) reasons.push(EXTENSION_REASONS[ext]);

  const token = nameToken(name);
  if (token) {
    score += 60;
    reasons.push(`文件名含 ${token}`);
  }

  const tokens = headingTokens(text);
  if (tokens.length > 0) {
    score += Math.min(120, tokens.length * 40);
    const labels = tokens.slice(0, 3).map((entry) => entry.label).join(' / ');
    reasons.push(`正文含 ${labels} 段落标题`);
  }

  const ageDays = (Date.now() - Number(mtimeMs ?? 0)) / 86400000;
  if (Number.isFinite(ageDays) && ageDays >= 0 && ageDays < 90) {
    const recency = Math.round(20 * (1 - ageDays / 90));
    if (recency > 0) {
      score += recency;
      const days = Math.max(0, Math.floor(ageDays));
      reasons.push(days <= 0 ? '今天修改过' : `最近 ${days} 天内修改`);
    }
  }

  return { score, reasons };
}

/* ── the walk ─────────────────────────────────────────────────────────── */

/**
 * Walk the cwd and score every candidate file.
 *
 * Depth: the files directly in the cwd are level 0, the files in `cwd/a` are
 * level 1 — three levels are read, the fourth is not.
 *
 * @returns {{ files: object[], best: string|null }}
 */
export function discoverManuscripts(cwd) {
  const root = resolve(cwd);
  const files = [];
  let scanned = 0;

  const walk = (dir, depth) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (scanned >= MAX_SCANNED) return;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (depth >= MAX_DEPTH) continue;
        if (SKIP_SET.has(entry.name)) continue;
        walk(full, depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;
      scanned += 1;
      const ext = extname(entry.name).toLowerCase();
      if (!(ext in EXTENSION_WEIGHTS)) continue;
      let stats;
      try {
        stats = statSync(full);
      } catch {
        continue;
      }
      if (!stats.isFile() || stats.size > MAX_FILE_BYTES) continue;

      const head = readHeadText(full, HEAD_BYTES);
      const { score, reasons } = scoreCandidate({
        ext,
        name: entry.name,
        mtimeMs: stats.mtimeMs,
        text: head,
      });
      files.push({
        path: toPosix(full),
        name: entry.name,
        ext,
        bytes: stats.size,
        mtime: new Date(stats.mtimeMs).toISOString(),
        score,
        kind: score >= MANUSCRIPT_SCORE ? 'manuscript' : 'other',
        reasons,
      });
    }
  };

  walk(root, 0);

  files.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  const top = files.slice(0, MAX_CANDIDATES);
  return { files: top, best: pickBest(top) };
}

/**
 * The auto-selected file: the top score, but only when it is clearly ahead
 * of the runner-up. Two close candidates → `null` → the human chooses.
 */
export function pickBest(files) {
  if (!Array.isArray(files) || files.length === 0) return null;
  const top = files[0];
  if (!top || top.score < MANUSCRIPT_SCORE) return null;
  const runnerUp = files[1];
  if (runnerUp && top.score < AMBIGUITY_FACTOR * runnerUp.score) return null;
  return top.path;
}
