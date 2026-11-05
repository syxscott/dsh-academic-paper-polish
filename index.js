// dsh-academic-paper-polish — DeepSeek Harness plugin that ships the
// `academic-paper-polish` Agent Skill (writing, polishing, journal matching,
// submission and reviewer response) into the Harness skill registry.
//
// Skill content is adapted from https://github.com/syxscott/academic-paper-polish
// (MIT). See NOTICE for attribution.
//
// The plugin follows the shipped `@deepseek-ai/dsh-skill-office` pattern: it
// registers a skill PROVIDER so the body is re-read on every load (editing
// `skill/**` needs no restart, only a fresh `skill` call).
//
// Named exports only — a `default` export would shadow `inject` / `name`.

import { readFile } from "node:fs/promises";
import { readFileSync, statSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { basename, extname, join, relative, sep } from "node:path";

import { createCommandDefinitions } from "./lib/commands.mjs";
import { allChecklists, allSentences, meta } from "./lib/data.mjs";
import {
  LIMITS,
  createToolDefinitions,
  resolvePath,
  runPaperCheck,
  runPaperDeai,
  runPaperJournals,
  runPaperOutline,
  runPaperRules,
} from "./lib/tools.mjs";
import {
  assertInsideCwd,
  discoverManuscripts,
  pickLatestAgent,
  resolveService,
  resolveSession,
  toPosix,
} from "./lib/session.mjs";
import { extractText, formatOf, isExtractable, unsupportedMessage } from "./lib/docx.mjs";
import { analyzeManuscript } from "./lib/analyze.mjs";

/** Cordis plugin identity. */
export const name = "skill-academic-paper-polish";

/** Only load while the skill registry exists. */
export const inject = ["skills"];

const SKILL_NAME = "academic-paper-polish";
const SKILL_DIRECTORY = "academic-paper-polish";
const PROVIDER_NAME = "dsh-academic-paper-polish";
const SKILL_MD = "SKILL.md";
const PLACEHOLDER = "{{SKILL_DIR}}";

const DEFAULT_DESCRIPTION =
  "学术论文写作、润色、选刊投稿与审稿回复全流程助手：10 个模块覆盖摘要、引言、文献综述、方法、结果、讨论、结论、去 AI 化、投稿选刊与审稿回复；内置地学 SCI 硬规则（期刊结构与引文密度、图表硬参数、图件设计体系、微体古生物与系统描述类论文规范）。";

/** The same-origin route prefix — no trailing slash, the runtime requires it. */
const ROUTE_PREFIX = "/dsh-academic-paper-polish";

/** Hard cap for a JSON request body (2 MB). */
const MAX_BODY_BYTES = 2 * 1024 * 1024;

/** Hard cap for the manuscript the analyzer reads (8 MB). */
const MAX_ANALYZE_BYTES = 8 * 1024 * 1024;

export function apply(ctx, config = {}) {
  const assetRoot = config.assetRoot ?? fileURLToPath(new URL("./skill/", import.meta.url));
  const directory = join(assetRoot, SKILL_DIRECTORY);
  const locator = join(directory, SKILL_MD);

  const description = readDescription(locator);
  const basePath = directory.split(sep).join("/");

  // Zero-token architecture: register a same-origin HTTP route so the panel
  // can refresh its search index without a single agent round-trip. The
  // webServer service is optional — headless profiles simply skip it.
  try {
    ctx.inject(["webServer", "connection"], (scope) => {
      // The official trust fence for a named route: Host/Origin checks plus
      // the browser session cookie. `connection` may be absent in a headless
      // composition — then the route simply serves without the fence.
      const connection =
        Reflect.get(scope, "connection") ||
        (typeof scope.get === "function" ? scope.get("connection") : undefined);
      scope.effect(
        () =>
          scope.webServer.register({
            kind: "prefix",
            // No trailing slash: the runtime matches a prefix route with
            // `pathname === prefix || pathname.startsWith(prefix + '/')`, so a
            // registered path ending in "/" can never match a request.
            path: "/dsh-academic-paper-polish",
            handler: async (req, res) => {
              try {
                if (connection) {
                  const rejection = connection.requestRejection(req);
                  if (rejection !== undefined) {
                    res.writeHead(rejection, { "content-type": "text/plain; charset=utf-8" });
                    res.end("unauthorized");
                    return;
                  }
                }
                // Node always sets url on server requests; String keeps that fact local.
                const requestUrl = new URL(String(req.url), "http://localhost");
                const pathname = requestUrl.pathname;
                const tail = pathname.startsWith(ROUTE_PREFIX)
                  ? pathname.slice(ROUTE_PREFIX.length)
                  : pathname;
                if (tail === "/skill-index" || tail.endsWith("/skill-index")) {
                  if (req.method !== "GET") {
                    res.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
                    res.end("method not allowed");
                    return;
                  }
                  // `?q=` turns the route into a full-text search over the files
                  // currently on disk. The scan happens here so the browser never
                  // has to download the ~600 KB corpus and no agent token is spent.
                  const query = (requestUrl.searchParams.get("q") || "").trim();
                  const index = buildSkillIndex(directory);
                  const payload = query ? searchIndex(index, directory, query) : index;
                  res.writeHead(200, {
                    "content-type": "application/json; charset=utf-8",
                    "cache-control": "no-store",
                  });
                  res.end(JSON.stringify(payload));
                  return;
                }
                // The panel API lives under the SAME prefix and behind the SAME
                // trust fence, so the browser and the tools always read one data
                // set. `credentials: 'same-origin'` sends the session cookie
                // automatically — no CORS headers are involved.
                if (tail === "/api" || tail.startsWith("/api/")) {
                  await handleApiRequest(req, res, tail, requestUrl, scope);
                  return;
                }
                res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
                res.end("not found");
              } catch (error) {
                res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
                res.end(String(error && error.message));
              }
            },
          }),
        "dsh-academic-paper-polish: skill-index route",
      );
    });
  } catch {
    /* webServer absent — the client falls back to the bundled index */
  }

  // ── the capability layer ────────────────────────────────────────────
  //
  // The skill alone is a manual the model may never read. These three
  // registrations turn it into capabilities the agent can CALL. Every one of
  // them is optional: a composition without `tools`, `commands` or
  // `systemPrompt` simply keeps the skill provider.

  // 1. Five model-facing tools: paper_check / paper_rules / paper_journals /
  //    paper_outline / paper_deai. Registered GLOBALLY — this is a capability
  //    plugin, not a per-agent one.
  try {
    ctx.inject(["tools"], (scope) => {
      if (!scope.tools || typeof scope.tools.register !== "function") return;
      const definitions = createToolDefinitions({
        resolveCwd: (agent) => resolveWorkingDirectory(scope, agent),
      });
      scope.effect(() => {
        const disposers = definitions.map((definition) => scope.tools.register(definition));
        return () => {
          for (const dispose of disposers) dispose();
        };
      }, "dsh-academic-paper-polish: paper_* tools");
    });
  } catch {
    /* tools absent — the skill provider still works */
  }

  // 2. Five slash commands the human can trigger from the composer.
  try {
    ctx.inject(["commands"], (scope) => {
      if (!scope.commands || typeof scope.commands.register !== "function") return;
      const definitions = createCommandDefinitions({
        resolveCwd: (agent) => resolveWorkingDirectory(scope, agent),
        getAttachments: () => resolveService(scope, "attachments"),
      });
      scope.effect(() => {
        const disposers = definitions.map((definition) => scope.commands.register(definition));
        return () => {
          for (const dispose of disposers) dispose();
        };
      }, "dsh-academic-paper-polish: paper-* commands");
    });
  } catch {
    /* commands absent — the tools still work */
  }

  // 3. One short always-on prompt section that tells the model these
  //    capabilities exist, so the plugin is used without the user asking.
  //    The text lives HERE and nowhere else: it is injected into EVERY model
  //    request, so it only announces the capabilities — the rules live in
  //    the tools and in the `academic-paper-polish` skill.
  try {
    ctx.inject(["systemPrompt"], (scope) => {
      if (!scope.systemPrompt || typeof scope.systemPrompt.section !== "function") return;
      scope.effect(
        () =>
          scope.systemPrompt.section({
            name: "plugin:academic-paper-polish",
            order: 2950,
            text:
              "paper_check 体检、paper_rules 查规则、paper_journals 选刊、paper_outline 拟结构、paper_deai 去AI化；写改稿请调用，勿凭记忆套规则。手册：academic-paper-polish 技能。",
          }),
        "dsh-academic-paper-polish: system prompt section",
      );
    });
  } catch {
    /* systemPrompt absent — the skill provider still works */
  }

  const candidates = [
    {
      name: SKILL_NAME,
      description,
      invocation: { modelInvocable: true, userInvocable: true },
      provider: PROVIDER_NAME,
      source: "bundled",
      rank: 250,
      resourceBase: { kind: "directory", path: basePath },
      metadata: {
        license: "MIT",
        upstream: "https://github.com/syxscott/academic-paper-polish",
      },
      locator,
    },
  ];

  const provider = {
    name: PROVIDER_NAME,
    list: () => Promise.resolve(candidates),
    async get(candidate, options = {}) {
      const { rank: _rank, locator: _locator, ...summary } = candidate;
      const raw = await readFile(candidate.locator, { encoding: "utf8", signal: options.signal });
      const { content } = parseSkill(raw, candidate.locator);
      return { ...summary, content: content.replaceAll(PLACEHOLDER, basePath) };
    },
  };

  ctx.skills.registerProvider(() => provider);
}

function readDescription(locator) {
  try {
    const raw = readFileSync(locator, "utf8");
    const { metadata } = parseSkill(raw, locator);
    const description = metadata.description;
    if (typeof description === "string" && description.length > 0) return description;
  } catch {
    // fall through to the built-in description
  }
  return DEFAULT_DESCRIPTION;
}

/**
 * Minimal YAML frontmatter reader: top-level scalars plus one level of
 * nested mapping. Avoids a YAML dependency inside a profile-installed bundle.
 */
function parseSkill(raw, locator) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(raw);
  if (match === null) {
    throw new Error(`skill-academic-paper-polish: ${locator} has no YAML frontmatter`);
  }
  return {
    metadata: parseFrontmatter(match[1]),
    content: raw.slice(match[0].length).trim(),
  };
}

function parseFrontmatter(text) {
  const result = {};
  let currentKey;
  let currentNested;
  for (const line of text.split(/\r?\n/u)) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    const indented = /^\s/.test(line);
    const pair = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line.trim());
    if (!indented && pair !== null) {
      currentKey = pair[1];
      currentNested = undefined;
      result[currentKey] = unquote(pair[2]);
      continue;
    }
    if (indented && currentKey !== undefined) {
      if (currentNested === undefined) {
        currentNested = {};
        result[currentKey] = currentNested;
      }
      if (pair !== null) currentNested[pair[1]] = unquote(pair[2]);
      continue;
    }
    if (currentKey !== undefined && !indented) {
      const previous = result[currentKey];
      if (typeof previous === "string") result[currentKey] = `${previous} ${line.trim()}`.trim();
    }
  }
  return result;
}

function unquote(value) {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

/**
 * Lists every markdown file of the skill directory, sorted by path.
 * Shared by the index builder and the full-text search so both walk the same
 * tree.
 */
function collectFiles(root) {
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return entry.name.endsWith(".md") ? [full] : [];
    });
  return walk(root).sort();
}

/**
 * Full-text search over the markdown files currently on disk.
 *
 * `index` carries the metadata (title, path, keywords) and is used for the
 * cheap matches; the file bodies are scanned line by line so a term that only
 * appears in prose — "ZooBank", a figure parameter, a journal rule — still
 * finds its file. The result is a small list of entries with a snippet, which
 * keeps the response payload in the kilobyte range instead of shipping the
 * whole corpus to the browser.
 */
function searchIndex(index, root, query) {
  const needle = query.toLowerCase();
  const files = new Map(
    collectFiles(root).map((file) => [relative(root, file).split(sep).join("/"), file]),
  );
  const hits = [];
  for (const entry of index) {
    const file = files.get(entry.path);
    if (!file) continue;
    let snippet = null;
    let lineNo = 0;
    try {
      const raw = readFileSync(file, "utf8");
      const lines = raw.split(/\r?\n/);
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (!line.toLowerCase().includes(needle)) continue;
        const clean = line
          .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
          .replace(/[*`>#]/g, "")
          .replace(/\s+/g, " ")
          .trim();
        if (!clean) continue;
        snippet = clean.length > 140 ? `${clean.slice(0, 140)}…` : clean;
        lineNo = i + 1;
        break;
      }
    } catch {
      /* unreadable file — fall back to the metadata match */
    }
    const meta = [entry.title, entry.subtitle, entry.path, ...(entry.keywords || []), ...(entry.headings || [])]
      .join(" ")
      .toLowerCase();
    if (!snippet && !meta.includes(needle)) continue;
    hits.push({ ...entry, snippet, line: snippet ? lineNo : 0 });
  }
  // Body matches first — they answer "where is this term written down".
  hits.sort((a, b) => Number(Boolean(b.snippet)) - Number(Boolean(a.snippet)));
  return hits.slice(0, 40);
}

/**
 * Builds the searchable skill index served over the same-origin route, so the
 * panel's search always reflects the files currently on disk. Mirrors
 * scripts/build-skill-index.mjs; kept dependency-free on purpose.
 */
function buildSkillIndex(root) {
  const SKIP = new Set([
    "的", "与", "和", "及", "或", "在", "对", "把", "被", "等", "中", "一", "不", "要", "是",
    "the", "and", "for", "with", "from", "that", "this", "are", "was", "were", "not", "you",
  ]);
  const CUT = /[的|是|与|和|及|在|对|把|被|要|不|最|须|必|以|可|用|中|后|前|时|条|项|个|次|其|该|此|由|从|为|或|但|而]/;

  const kindOf = (rel) => {
    if (rel === "SKILL.md") return "skill";
    if (rel.startsWith("prompts-en/")) return "prompt-en";
    if (rel.startsWith("prompts/")) return "prompt";
    if (rel.startsWith("references/")) return "reference";
    if (rel.startsWith("docs/")) return "doc";
    return "file";
  };

  const keywordsFor = (headings, intro) => {
    const counts = new Map();
    const consider = (text) => {
      for (const match of String(text).matchAll(/[「『"]([^」』"]{2,12})[」』"]/g)) {
        const word = match[1].trim();
        if (/^[一-鿿]{2,12}$/.test(word)) counts.set(word, (counts.get(word) || 0) + 4);
      }
      for (const raw of String(text).split(/[\s、，,：:（）()「」『』【】[\]/、。；;！!？?"]+/)) {
        const token = raw.replace(/[*`#]/g, "").trim();
        if (!token || SKIP.has(token.toLowerCase())) continue;
        if (/^[A-Za-z][A-Za-z0-9-]{2,}$/.test(token)) {
          counts.set(token, (counts.get(token) || 0) + 1);
          continue;
        }
        for (const piece of token.split(CUT)) {
          const word = piece.trim();
          if (word.length >= 2 && word.length <= 10 && /^[一-鿿]+$/.test(word)) {
            counts.set(word, (counts.get(word) || 0) + 2);
          }
        }
      }
    };
    for (const heading of headings) consider(heading);
    consider(intro.slice(0, 200));
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
      .slice(0, 8)
      .map(([word]) => word);
  };

  return collectFiles(root)
    .sort()
    .map((file) => {
      const rel = relative(root, file).split(sep).join("/");
      const raw = readFileSync(file, "utf8");
      const headings = [];
      let title = "";
      let intro = "";
      let inFence = false;
      for (const line of raw.split(/\r?\n/)) {
        if (/^\s*```/.test(line)) {
          inFence = !inFence;
          continue;
        }
        if (inFence) continue;
        const h1 = /^#\s+(.*)$/.exec(line);
        if (h1 && !title) {
          title = h1[1].trim();
          continue;
        }
        const hx = /^#{2,3}\s+(.*)$/.exec(line);
        if (hx && headings.length < 10) {
          const text = hx[1].replace(/[*`]/g, "").trim();
          if (text) headings.push(text.slice(0, 60));
          continue;
        }
        if (!intro && line.trim() && !/^[>|*-]/.test(line.trim()) && !/^#{1,6}\s/.test(line)) {
          intro = line.trim();
        }
      }
      const subtitleSource = String(intro)
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/[*`>#]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      return {
        path: rel,
        kind: kindOf(rel),
        title: title || rel.split("/").pop().replace(/\.md$/, ""),
        subtitle: subtitleSource.slice(0, 52) || headings.slice(0, 2).join(" · "),
        headings,
        keywords: keywordsFor(headings, intro),
        bytes: statSync(file).size,
      };
    });
}

// ── the panel API ─────────────────────────────────────────────────────
//
// Every route answers JSON and stays behind the `connection.requestRejection`
// fence that the prefix route already applies. GET routes read query
// parameters, POST routes read a JSON body (2 MB cap).

/** Build an error carrying the HTTP status the API must answer. */
function httpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

/** Recursively freeze a value — the mirror of the harness' `deepFreeze`. */
function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return Object.freeze(value);
}

/**
 * Mirrors `createUserMessage()` from @deepseek-ai/dsh-llm without taking the
 * dependency: `brandString` is a runtime no-op and `deepFreeze` is a freeze
 * over a structured clone. The id must be fresh — a duplicate message id is
 * rejected by the inbox.
 */
function createUserMessage(input) {
  return deepFreeze(structuredClone({ ...input, id: randomUUID(), role: "user" }));
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload ?? null);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(body);
}

/** Read the request body as UTF-8 with a hard size cap. */
function readBody(req) {
  return new Promise((resolvePromise, rejectPromise) => {
    if (!req || typeof req.on !== "function") {
      resolvePromise("");
      return;
    }
    const chunks = [];
    let size = 0;
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      rejectPromise(error);
    };
    req.on("data", (chunk) => {
      if (settled) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > MAX_BODY_BYTES) {
        try {
          req.destroy?.();
        } catch {
          /* the socket may already be gone */
        }
        fail(httpError(413, "payload-too-large", "请求体超过 2 MB 上限"));
        return;
      }
      chunks.push(buffer);
    });
    req.on("end", () => {
      if (settled) return;
      settled = true;
      resolvePromise(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", (error) => fail(error));
  });
}

async function readJsonBody(req) {
  const raw = await readBody(req);
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    throw httpError(400, "bad-request", "请求体不是合法的 JSON");
  }
}

/** The agent's effective working directory, or the process cwd. */
function resolveWorkingDirectory(scope, agent) {
  const service = resolveService(scope, "workingDirectory");
  if (!service) return process.cwd();
  try {
    if (agent && typeof service.get === "function") {
      const value = service.get(agent);
      if (typeof value === "string" && value.length > 0) return value;
    }
    if (typeof service.defaultDirectory === "string" && service.defaultDirectory.length > 0) {
      return service.defaultDirectory;
    }
  } catch {
    /* fall through to the process cwd */
  }
  return process.cwd();
}

/** The API route table. `GET` routes read the query, `POST` routes the body. */
const API_ROUTES = {
  "/api/meta": {
    method: "GET",
    handler: () => meta(),
  },
  "/api/rules": {
    method: "GET",
    handler: (params) =>
      runPaperRules({
        query: params.get("query") ?? params.get("q") ?? "",
        section: params.get("section") ?? undefined,
        severity: params.get("severity") ?? undefined,
        journal: params.get("journal") ?? undefined,
        limit: params.get("limit") ?? LIMITS.rulesMax,
      }),
  },
  "/api/journals": {
    method: "GET",
    handler: (params) =>
      runPaperJournals({
        query: params.get("query") ?? params.get("q") ?? "",
        field: params.get("field") ?? undefined,
        openAccess:
          params.get("openAccess") === null
            ? undefined
            : /^(1|true|yes)$/iu.test(params.get("openAccess")),
        maxApc: params.get("maxApc") === null ? undefined : Number(params.get("maxApc")),
        limit: params.get("limit") ?? LIMITS.journalsMax,
      }),
  },
  "/api/sentences": {
    method: "GET",
    handler: (params) => {
      const needle = (params.get("query") ?? params.get("q") ?? "").trim().toLowerCase();
      const patterns = allSentences().filter((pattern) => {
        if (!needle) return true;
        return [pattern.id, pattern.zh, pattern.en, pattern.category, pattern.why, pattern.suggestion]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(needle);
      });
      return {
        patterns: patterns.slice(0, LIMITS.sentences).map((pattern) => ({
          id: pattern.id ?? "",
          zh: pattern.zh ?? "",
          en: pattern.en ?? "",
          pattern: pattern.pattern ?? "",
          flags: pattern.flags ?? "",
          severity: pattern.severity ?? "info",
          category: pattern.category ?? null,
          why: pattern.why ?? null,
          suggestion: pattern.suggestion ?? null,
        })),
        total: patterns.length,
      };
    },
  },
  "/api/checklists": {
    method: "GET",
    handler: (params) => {
      const stage = (params.get("stage") ?? "").trim().toLowerCase();
      const stages = allChecklists().filter(
        (entry) => !stage || String(entry.id ?? "").toLowerCase() === stage,
      );
      return { stages: stages.slice(0, LIMITS.checklists), total: stages.length };
    },
  },
  "/api/check": {
    method: "POST",
    handler: (body) => {
      const text = typeof body.text === "string" ? body.text : "";
      if (!text.trim()) throw httpError(400, "bad-request", "需要 text");
      const result = runPaperCheck({
        text,
        section: typeof body.section === "string" ? body.section : undefined,
        journal: typeof body.journal === "string" ? body.journal : undefined,
      });
      return {
        violations: result.violations,
        advice: result.advice,
        summary: result.summary,
        truncated: result.truncated,
      };
    },
  },
  "/api/deai": {
    method: "POST",
    handler: (body) => {
      const text = typeof body.text === "string" ? body.text : "";
      if (!text.trim()) throw httpError(400, "bad-request", "需要 text");
      const result = runPaperDeai({ text });
      return { hits: result.hits, score: result.score, total: result.total };
    },
  },
  "/api/outline": {
    method: "POST",
    handler: (body) =>
      runPaperOutline({
        journal: typeof body.journal === "string" ? body.journal : undefined,
        section: typeof body.section === "string" ? body.section : undefined,
      }),
  },
  "/api/send": {
    method: "POST",
    handler: async (body, context) => {
      const text = typeof body.text === "string" ? body.text : "";
      if (!text.trim()) throw httpError(400, "bad-request", "消息不能为空");
      if (text.length > 20000) throw httpError(400, "bad-request", "消息超过 20000 字符上限");
      const agents = resolveService(context.scope, "agents");
      if (!agents) throw httpError(503, "agents-unavailable", "当前环境没有可用的 agents 服务");
      const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
      let agent = null;
      if (sessionId) {
        if (typeof agents.get === "function") agent = agents.get(sessionId);
        if (!agent) {
          // A session that is not resumed in this process is COLD: `agents.get`
          // returns undefined and does not resume it. The session controller
          // resolves (or resumes) it.
          const controller = resolveService(context.scope, "sessionController");
          if (controller && typeof controller.resolveAgent === "function") {
            try {
              const resolved = await controller.resolveAgent(sessionId);
              agent = resolved?.agent ?? resolved ?? undefined;
            } catch (error) {
              throw httpError(409, "no-live-session", `会话 ${sessionId} 无法恢复：${error?.message ?? error}`);
            }
          }
        }
      } else {
        agent = pickLatestAgent(agents);
      }
      if (!agent || typeof agent.followup !== "function") {
        throw httpError(409, "no-live-session", "没有可用的活动会话");
      }
      const message = createUserMessage({
        content: [{ type: "text", text }],
        // A custom source kind: the Web UI renders it as an inject / context
        // row with its provenance instead of a human chat bubble, and the goal
        // tools never treat a plugin-authored message as direct human input.
        source: { kind: "academic-paper-polish" },
      });
      try {
        // `followup` targets the next turn and wakes the driver: a new turn
        // when the agent is idle, the next turn when it is busy. `steer`
        // (inbox target `next-step`) would land inside the running turn —
        // deliberately not exposed here.
        await agent.followup(message);
      } catch (error) {
        throw httpError(500, "followup-failed", String(error?.message ?? error));
      }
      return { ok: true, sessionId: String(agent.id ?? sessionId), mode: "followup" };
    },
  },
  // The manuscript of the session: the files that could be the paper, the
  // one that was auto-selected and — when the choice is ambiguous — the
  // reason why the human has to choose.
  "/api/session/files": {
    method: "GET",
    handler: async (params, context) => {
      const sessionId = params.get("sessionId") ?? "";
      const resolved = await resolveSession(context.scope, sessionId);
      const discovery = discoverManuscripts(resolved.cwd);
      return {
        sessionId: resolved.sessionId,
        cwd: toPosix(resolved.cwd),
        files: discovery.files,
        best: discovery.best,
      };
    },
  },
  // The analysis of one manuscript, section by section.
  "/api/analyze": {
    method: "POST",
    handler: async (body, context) => {
      const rawPath = typeof body.path === "string" ? body.path.trim() : "";
      if (!rawPath) throw httpError(400, "bad-request", "需要 path");
      const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
      const resolved = await resolveSession(context.scope, sessionId);
      // Only files INSIDE the session's working directory may be read.
      const target = assertInsideCwd(resolved.cwd, resolvePath(rawPath, resolved.cwd));
      let stats;
      try {
        stats = statSync(target);
      } catch {
        throw httpError(404, "file-not-found", `找不到文件：${rawPath}`);
      }
      if (!stats.isFile()) throw httpError(400, "bad-request", "目标不是文件");
      if (stats.size > MAX_ANALYZE_BYTES) {
        throw httpError(413, "payload-too-large", "文件超过 8 MB 上限");
      }
      const format = formatOf(target);
      if (format === null) {
        throw httpError(415, "unsupported-format", `暂不支持的文件格式：${extname(target)}`);
      }
      if (!isExtractable(format)) {
        throw httpError(415, "unsupported-format", unsupportedMessage(format));
      }
      let extracted;
      try {
        extracted = extractText(target);
      } catch (error) {
        throw httpError(415, "unsupported-format", `无法读取正文：${error?.message ?? error}`);
      }
      return analyzeManuscript({
        text: extracted.text,
        format,
        path: toPosix(target),
        name: basename(target),
        bytes: stats.size,
        journal: typeof body.journal === "string" ? body.journal : undefined,
        section: typeof body.section === "string" ? body.section : undefined,
      });
    },
  },
};

/** Dispatch one API request. */
async function handleApiRequest(req, res, tail, requestUrl, scope) {
  const route = tail.replace(/\/+$/u, "") || "/api";
  const spec = API_ROUTES[route];
  if (!spec) {
    sendJson(res, 404, { error: "not-found", message: `未知接口 ${route}` });
    return;
  }
  const method = String(req.method ?? "GET").toUpperCase();
  if (method !== spec.method) {
    res.writeHead(405, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      allow: spec.method,
    });
    res.end(
      JSON.stringify({ error: "method-not-allowed", message: `${route} 只接受 ${spec.method}` }),
    );
    return;
  }
  try {
    const context = { scope, params: requestUrl.searchParams };
    const payload =
      spec.method === "POST"
        ? await spec.handler(await readJsonBody(req), context)
        : await spec.handler(requestUrl.searchParams, context);
    sendJson(res, 200, payload);
  } catch (error) {
    if (error && typeof error.status === "number") {
      sendJson(res, error.status, {
        error: error.code ?? "error",
        message: String(error.message ?? error),
      });
      return;
    }
    sendJson(res, 500, { error: "internal-error", message: String(error?.message ?? error) });
  }
}
