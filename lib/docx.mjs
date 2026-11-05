// Minimal document text extraction — Node built-ins only.
//
// The panel must be able to READ the manuscript the human picked, so this
// module turns a file into plain text:
//
//   - `.md` / `.txt` / `.tex`  → read as UTF-8
//   - `.rtf`                   → the control words are stripped (best effort)
//   - `.docx`                  → unzipped with `node:zlib`, `word/document.xml`
//                                is parsed into one line per paragraph
//   - `.pdf` / `.doc` / `.odt` → NOT readable here; the route answers
//                                `415 unsupported-format` for them.
//
// The docx reader is deliberately minimal: no dependency, no OOXML edge
// cases. It reads the ZIP central directory, inflates `word/document.xml`
// and turns every `<w:p>` into a line. A paragraph whose style is a heading
// is emitted as a markdown heading so the section splitter can see it.

import { closeSync, openSync, readFileSync, readSync } from 'node:fs';
import { extname } from 'node:path';
import { inflateRawSync } from 'node:zlib';

/** Extension → format name. */
const FORMATS = new Map([
  ['.docx', 'docx'],
  ['.markdown', 'md'],
  ['.md', 'md'],
  ['.txt', 'txt'],
  ['.tex', 'tex'],
  ['.rtf', 'rtf'],
  ['.pdf', 'pdf'],
  ['.doc', 'doc'],
  ['.odt', 'odt'],
]);

/** The formats whose text this module can extract. */
export const EXTRACTABLE_FORMATS = Object.freeze(['docx', 'md', 'txt', 'tex', 'rtf']);

/** The format name of a path, or null when the extension is unknown. */
export function formatOf(path) {
  const ext = extname(String(path ?? '')).toLowerCase();
  return FORMATS.get(ext) ?? null;
}

/** Can this module extract text from the format? */
export function isExtractable(format) {
  return EXTRACTABLE_FORMATS.includes(String(format ?? ''));
}

/** The message shown for a format that cannot be read here. */
export function unsupportedMessage(format) {
  switch (String(format ?? '')) {
    case 'pdf':
      return 'PDF 需要先用 office 技能转成 docx';
    case 'doc':
      return '旧版 .doc 需要先用 office 技能转成 docx';
    case 'odt':
      return '.odt 需要先用 office 技能转成 docx';
    default:
      return `暂不支持的文件格式：${format}`;
  }
}

/* ── RTF ──────────────────────────────────────────────────────────────── */

/**
 * Strip the RTF control words. Best effort by design: the goal is readable
 * text for the rule engine, not a faithful RTF renderer.
 */
export function stripRtf(source) {
  let text = String(source ?? '');
  // `{\*\generator ...}` and friends: drop the whole destination group.
  text = text.replace(/\{\\\*[\s\S]*?\}/gu, '');
  // `\'xx` hex escapes and `\uN?` unicode escapes.
  text = text.replace(/\\u(-?\d+)\s?\??/gu, (_, code) => {
    const value = Number(code);
    if (!Number.isFinite(value) || value < 0) return '';
    try {
      return String.fromCodePoint(value);
    } catch {
      return '';
    }
  });
  text = text.replace(/\\'([0-9a-fA-F]{2})/gu, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  // Paragraph and line breaks.
  text = text.replace(/\\par\b/gu, '\n');
  text = text.replace(/\\line\b/gu, '\n');
  text = text.replace(/\\tab\b/gu, '\t');
  // Every remaining control word (with its numeric parameter).
  text = text.replace(/\\[a-zA-Z]+-?\d*\s?/gu, '');
  // The group braces themselves.
  text = text.replace(/[{}]/gu, '');
  return text;
}

/* ── ZIP / docx ───────────────────────────────────────────────────────── */

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

/** Locate the End Of Central Directory record (the last 64 KB + 22 bytes). */
function findEndOfCentralDirectory(buffer) {
  const max = Math.min(buffer.length, 0xffff + 22);
  for (let offset = buffer.length - 22; offset >= buffer.length - max; offset -= 1) {
    if (offset < 0) break;
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) return offset;
  }
  return -1;
}

/** Read the central directory into a `name → entry` map. */
function readCentralDirectory(buffer) {
  const eocd = findEndOfCentralDirectory(buffer);
  if (eocd < 0) throw new Error('不是有效的 ZIP 文件（找不到中央目录）');
  const count = buffer.readUInt16LE(eocd + 10);
  const entries = new Map();
  let offset = buffer.readUInt32LE(eocd + 16);
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > buffer.length) break;
    if (buffer.readUInt32LE(offset) !== CENTRAL_SIGNATURE) break;
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    entries.set(name, { method, compressedSize, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** Read (and inflate) the bytes of one ZIP entry. */
function readEntry(buffer, entry) {
  const local = entry.localOffset;
  if (local + 30 > buffer.length || buffer.readUInt32LE(local) !== LOCAL_SIGNATURE) {
    throw new Error('ZIP 局部文件头损坏');
  }
  const nameLength = buffer.readUInt16LE(local + 26);
  const extraLength = buffer.readUInt16LE(local + 28);
  const start = local + 30 + nameLength + extraLength;
  const raw = buffer.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return raw;
  if (entry.method === 8) return inflateRawSync(raw);
  throw new Error(`不支持的 ZIP 压缩方式：${entry.method}`);
}

/** Unescape the five XML entities plus numeric references. */
export function unescapeXml(text) {
  return String(text ?? '')
    .replace(/&#x([0-9a-fA-F]+);/gu, (_, hex) => codePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/gu, (_, dec) => codePoint(parseInt(dec, 10)))
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'")
    .replace(/&amp;/gu, '&');
}

function codePoint(value) {
  if (!Number.isFinite(value) || value < 0 || value > 0x10ffff) return '';
  try {
    return String.fromCodePoint(value);
  } catch {
    return '';
  }
}

/** The visible text of one `<w:p>` element. */
function paragraphText(inner) {
  const pattern =
    /<w:tab\s*\/>|<w:br\s*\/>|<w:cr\s*\/>|<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:t(?:\s[^>]*)?\/>/gu;
  let output = '';
  let match;
  while ((match = pattern.exec(inner)) !== null) {
    if (match[1] !== undefined) {
      output += unescapeXml(match[1]);
    } else if (match[0].startsWith('<w:tab')) {
      output += '\t';
    } else if (match[0].startsWith('<w:br') || match[0].startsWith('<w:cr')) {
      output += '\n';
    }
  }
  return output;
}

/**
 * Is this paragraph style a heading?
 *
 * Word's built-in styles are named `Heading1`…`Heading9` (the style id) and
 * `heading 1`…`heading 9` (the style name). A file that renames its styles
 * is resolved through `word/styles.xml`, so the id may be anything.
 *
 * The `Title` style is NOT a heading: the document title must stay in the
 * title paragraph, not become a section of its own.
 */
function isHeadingStyle(value, styles) {
  const style = String(value ?? '').trim();
  if (style.length === 0) return false;
  const name = styles.get(style) ?? '';
  return (
    /^(heading|标题|berschrift|überschrift)\s*-?\d*$/iu.test(style) ||
    /^(heading|标题|berschrift|überschrift)\s*-?\d*$/iu.test(name)
  );
}

/** The style id → style name map of `word/styles.xml`. */
export function readStyles(xml) {
  const styles = new Map();
  const pattern = /<w:style\b[^>]*w:styleId="([^"]*)"[^>]*>([\s\S]*?)<\/w:style>/gu;
  let match;
  while ((match = pattern.exec(String(xml ?? ''))) !== null) {
    const name = /<w:name\b[^>]*w:val="([^"]*)"/iu.exec(match[2]);
    if (name) styles.set(match[1], name[1]);
  }
  return styles;
}

/**
 * Parse `word/document.xml` into one line per paragraph. A heading
 * paragraph is emitted as `## …` so `splitSections` can pick it up.
 */
export function paragraphsFromXml(xml, styles = new Map()) {
  const lines = [];
  const pattern = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/gu;
  let match;
  while ((match = pattern.exec(String(xml ?? ''))) !== null) {
    const inner = match[1];
    const style = /<w:pStyle[^>]*w:val="([^"]*)"/iu.exec(inner);
    const text = paragraphText(inner);
    if (style && isHeadingStyle(style[1], styles)) {
      const trimmed = text.trim();
      lines.push(trimmed ? `## ${trimmed}` : '');
      continue;
    }
    lines.push(text);
  }
  return lines.join('\n');
}

/** The document title from `docProps/core.xml`, when present. */
function readCoreTitle(xml) {
  const match = /<dc:title\b[^>]*>([\s\S]*?)<\/dc:title>/iu.exec(String(xml ?? ''));
  if (!match) return null;
  const title = unescapeXml(match[1]).trim();
  return title.length > 0 ? title : null;
}

/**
 * Extract the text of a `.docx` from its bytes.
 * @returns {{ text: string, title: string|null }}
 */
export function extractDocx(buffer) {
  const entries = readCentralDirectory(buffer);
  const document = entries.get('word/document.xml');
  if (!document) {
    throw new Error('不是有效的 docx：缺少 word/document.xml');
  }
  const xml = readEntry(buffer, document).toString('utf8');
  // The style names live in `word/styles.xml`: a file may use its own style
  // ids, and only the name tells a heading from a body paragraph.
  const styles = entries.has('word/styles.xml')
    ? readStyles(readEntry(buffer, entries.get('word/styles.xml')).toString('utf8'))
    : new Map();
  const core = entries.get('docProps/core.xml');
  const title = core ? readCoreTitle(readEntry(buffer, core).toString('utf8')) : null;
  return { text: paragraphsFromXml(xml, styles), title };
}

/* ── the file entry points ────────────────────────────────────────────── */

/**
 * Read the text of a document file.
 * @returns {{ format: string, text: string, title: string|null }}
 */
export function extractText(path) {
  const format = formatOf(path);
  if (format === null) throw new Error(`无法识别的文件格式：${path}`);
  if (format === 'docx') {
    const { text, title } = extractDocx(readFileSync(path));
    return { format, text, title };
  }
  const raw = readFileSync(path, 'utf8');
  return { format, text: format === 'rtf' ? stripRtf(raw) : raw, title: null };
}

/**
 * Read at most `maxBytes` of the head of a document — used by the scoring
 * pass, which must not read a whole manuscript to look for headings.
 */
export function readHeadText(path, maxBytes = 16 * 1024) {
  const format = formatOf(path);
  if (format === null) return '';
  if (format === 'docx') {
    try {
      return extractDocx(readFileSync(path)).text.slice(0, maxBytes);
    } catch {
      return '';
    }
  }
  let descriptor = null;
  try {
    descriptor = openSync(path, 'r');
    const buffer = Buffer.allocUnsafe(maxBytes);
    const read = readSync(descriptor, buffer, 0, maxBytes, 0);
    const head = buffer.toString('utf8', 0, read);
    return format === 'rtf' ? stripRtf(head) : head;
  } catch {
    return '';
  } finally {
    if (descriptor !== null) {
      try {
        closeSync(descriptor);
      } catch {
        /* the handle may already be gone */
      }
    }
  }
}
