// Reads a manuscript file and analyses it section by section.
//
//   analyzeFile(target, { journal, section })
//
// The panel's 「稿件」 view and the `paper_analyze` tool both go through here,
// so the agent and the panel can never disagree about a manuscript.
//
// This module deliberately does NOT import `./tools.mjs` — `./analyze.mjs`
// already does (for the de-AI scan), and a cycle back into the tool registry
// would be fragile.
import { statSync } from "node:fs";
import { basename, extname } from "node:path";

import { analyzeManuscript } from "./analyze.mjs";
import { extractText, formatOf, isExtractable, unsupportedMessage } from "./docx.mjs";
import { httpError, toPosix } from "./session.mjs";

/** The largest manuscript the analyser will read. */
export const MAX_ANALYZE_BYTES = 8 * 1024 * 1024;

/**
 * Reads one file and returns its per-section analysis.
 *
 * @param {string} target          the absolute path of the file
 * @param {{journal?: string, section?: string}} [options]
 * @returns {object} the analysis (`file`, `report`, `deai`, `summary`)
 */
export function analyzeFile(target, options = {}) {
  let stats;
  try {
    stats = statSync(target);
  } catch {
    throw httpError(404, "file-not-found", `找不到文件：${target}`);
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
    journal: options.journal,
    section: options.section,
  });
}
