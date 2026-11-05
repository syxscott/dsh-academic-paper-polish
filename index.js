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
import { fileURLToPath } from "node:url";
import { join, relative, sep } from "node:path";

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
            handler: (req, res) => {
              try {
                if (connection) {
                  const rejection = connection.requestRejection(req);
                  if (rejection !== undefined) {
                    res.writeHead(rejection, { "content-type": "text/plain; charset=utf-8" });
                    res.end("unauthorized");
                    return;
                  }
                }
                if (req.method !== "GET") {
                  res.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
                  res.end("method not allowed");
                  return;
                }
                // Node always sets url on server requests; String keeps that fact local.
                const requestUrl = new URL(String(req.url), "http://localhost");
                const pathname = requestUrl.pathname;
                if (!pathname.endsWith("skill-index")) {
                  res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
                  res.end("not found");
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
