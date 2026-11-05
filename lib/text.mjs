// Text utilities shared by the rule engine, the tools and the commands.
//
// Section splitting follows the convention of data/SCHEMA.md: an English or
// Chinese heading, optionally numbered (`1. ` / `1.1 ` / `一、`), on its own
// line. Word counting is CJK aware: CJK characters count individually and
// Latin runs count as words.

/** CJK ranges: Chinese, Japanese kana, plus compatibility ideographs. */
const CJK = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u3040-\u30FF]/gu;

/** Heading vocabulary → SCHEMA.md section key. Order matters: first match wins. */
const HEADINGS = [
  { key: 'title', re: /^(paper\s+)?title$/iu },
  { key: 'abstract', re: /^abstract$/iu },
  { key: 'keywords', re: /^(key\s*words|keywords)$/iu },
  { key: 'introduction', re: /^(introduction|background)$/iu },
  { key: 'literature', re: /^(literature\s+review|related\s+work|prior\s+work|state\s+of\s+the\s+art)$/iu },
  {
    key: 'methods',
    re: /^(materials?\s+and\s+methods?|methods?|methodology|experimental(\s+materials?\s+and\s+)?methods?|study\s+design|data\s+and\s+methods?)$/iu,
  },
  { key: 'geological-setting', re: /^(geological?\s+(setting|background|context)|stratigraphy)$/iu },
  {
    key: 'systematic',
    re: /^(systematic\s+(palaeontology|paleontology|description|taxonomy)|systematics|taxonomy|classification)$/iu,
  },
  { key: 'results', re: /^(results?|findings)$/iu },
  { key: 'discussion', re: /^(discussion|results?\s+and\s+discussion)$/iu },
  { key: 'conclusion', re: /^(conclusions?|concluding\s+remarks)$/iu },
  { key: 'acknowledgements', re: /^(acknowledgements?|acknowledgments?)$/iu },
  { key: 'references', re: /^(references?|bibliography|literature\s+cited)$/iu },
  { key: 'figures', re: /^(figures?|figure\s+captions?|figure\s+legends?|plate\s+captions?)$/iu },
  { key: 'tables', re: /^(tables?|table\s+captions?)$/iu },
  {
    key: 'declarations',
    re: /^(declarations?|author\s+contributions?|competing\s+interests?|conflict\s+of\s+interest|data\s+availability|ethics?(\s+statement)?|funding)$/iu,
  },
  { key: 'cover-letter', re: /^(cover\s+letter|letter\s+to\s+(the\s+)?editor)$/iu },
  {
    key: 'response',
    re: /^(response\s+to\s+reviewers?|reply\s+to\s+reviewers?|rebuttal|point-by-point\s+response)$/iu,
  },
  { key: 'review', re: /^(review|review\s+report)$/iu },
  { key: 'abstract', re: /^(摘要|内容摘要|摘 要)$/u },
  { key: 'keywords', re: /^(关键词|关键字|关 键 词)$/u },
  { key: 'introduction', re: /^(引言|前言|绪论|研究背景|问题的提出)$/u },
  { key: 'literature', re: /^(文献综述|相关工作|研究现状|文献回顾)$/u },
  { key: 'methods', re: /^(材料与方法|研究方法|实验方法|资料与方法|方 法)$/u },
  { key: 'geological-setting', re: /^(地质背景|区域地质|地层|地质资料|区域背景)$/u },
  { key: 'systematic', re: /^(系统古生物|系统分类|系统描述|分类描述|古生物系统学|系统学)$/u },
  { key: 'results', re: /^(研究结果|结 果)$/u },
  { key: 'discussion', re: /^(讨 论|讨论与结论)$/u },
  { key: 'conclusion', re: /^(结 论|结语|结论与展望)$/u },
  { key: 'acknowledgements', re: /^(致 谢|致谢|感谢)$/u },
  { key: 'references', re: /^(参考文献|引用文献|文献表)$/u },
  { key: 'figures', re: /^(图注|图件说明|图表说明|图版说明|插图说明|图 件 说 明)$/u },
  { key: 'tables', re: /^(表注|表格说明|附表说明|表 格 说 明)$/u },
  { key: 'declarations', re: /^(声明|作者贡献|数据可用性|利益冲突|伦理声明|基金资助|致谢与声明)$/u },
  { key: 'cover-letter', re: /^(投稿附信|附信|致编辑信|投稿信)$/u },
  { key: 'review', re: /^(审稿意见|评审意见|审稿报告|评审报告)$/u },
  { key: 'response', re: /^(审稿回复|答复审稿人|审稿人回复|逐条回复)$/u },
];

/** Human labels for the section vocabulary (used by the outline and the panel). */
export const SECTION_TITLES = Object.freeze({
  title: '题目',
  abstract: '摘要',
  keywords: '关键词',
  introduction: '引言',
  literature: '文献综述',
  methods: '材料与方法',
  'geological-setting': '地质背景',
  systematic: '系统描述',
  results: '结果',
  discussion: '讨论',
  conclusion: '结论',
  acknowledgements: '致谢',
  references: '参考文献',
  figures: '图件与图注',
  tables: '表格',
  declarations: '声明',
  'cover-letter': '投稿附信',
  response: '审稿回复',
  review: '评审意见',
});

/** Remove a leading section number: `1. `, `1.1 `, `三、`, `第三章`, `IV.`. */
export function stripNumbering(raw) {
  return String(raw ?? '')
    .replace(/^\s*第\s*[一二三四五六七八九十百]+\s*[章节節]\s*[：:]?\s*/u, '')
    .replace(
      /^\s*(?:\d{1,3}(?:\.\d{1,3})*|[IVXLC]{1,5}|[一二三四五六七八九十]+)\s*[.)、．:：]\s*/u,
      '',
    )
    .replace(/^\s*(?:\d{1,3}(?:\.\d{1,3})*)\s+(?=\S)/u, '')
    .trim();
}

function slugify(raw) {
  return String(raw ?? '')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 48);
}

/** Map one heading title to its SCHEMA.md section key, or null when unknown. */
export function sectionKeyFor(title) {
  const cleaned = stripNumbering(title);
  if (!cleaned) return null;
  for (const entry of HEADINGS) {
    if (entry.re.test(cleaned)) return entry.key;
  }
  return null;
}

function headingOf(line) {
  const trimmed = String(line ?? '').trim();
  if (!trimmed || trimmed.length > 90) return null;
  const markdown = /^#{1,6}\s+(.+)$/u.exec(trimmed);
  const raw = markdown ? markdown[1].trim() : trimmed;
  const key = sectionKeyFor(raw);
  if (key) return { key, title: stripNumbering(raw) };
  if (markdown) {
    const title = stripNumbering(raw);
    const slug = slugify(title);
    return slug ? { key: slug, title } : null;
  }
  return null;
}

/**
 * Split a manuscript into ordered sections.
 * @returns {{ key: string, title: string, body: string }[]}
 */
export function splitSections(text) {
  const source = String(text ?? '');
  const lines = source.split(/\r?\n/u);
  const sections = [];
  let current = null;
  for (const line of lines) {
    const heading = headingOf(line);
    if (heading) {
      current = { key: heading.key, title: heading.title, body: [] };
      sections.push(current);
      continue;
    }
    if (current === null) {
      current = { key: 'title', title: '题目', body: [] };
      sections.push(current);
    }
    current.body.push(line);
  }
  if (sections.length === 0) sections.push({ key: 'title', title: '题目', body: [] });
  return sections.map((section) => ({
    key: section.key,
    title: section.title,
    body: section.body.join('\n').trim(),
  }));
}

/** CJK-aware word count: CJK characters count one by one, Latin runs as words. */
export function countWords(text) {
  const source = String(text ?? '');
  if (!source) return 0;
  const cjk = source.match(CJK)?.length ?? 0;
  const latin = source
    .replace(CJK, ' ')
    .split(/[^\p{Letter}\p{Number}]+/u)
    .filter((token) => token.length > 0).length;
  return cjk + latin;
}

/**
 * Count in-text citation markers:
 *   [1], [1-3], [2, 5]      numeric brackets
 *   (Author et al., 2020)   parenthetical
 *   Author et al. (2020)    narrative
 */
const CITATION =
  /\[[0-9]+(?:\s*[-–,]\s*[0-9]+)*\]|\([^()]{0,80}?(?:19|20)\d{2}[a-z]?[^()]{0,20}?\)|\b[\p{Lu}][\p{L}'’\-]*(?:\s+[\p{Lu}][\p{L}'’\-]*){0,3}(?:\s+et\s+al\.?)?\s*\((?:19|20)\d{2}[a-z]?\)/gu;

/** Count in-text citation markers. */
export function countCitations(text) {
  const source = String(text ?? '');
  if (!source) return 0;
  return source.match(CITATION)?.length ?? 0;
}

/** Guess which section a blob of text belongs to. */
export function detectSection(text) {
  const source = String(text ?? '').trim();
  if (!source) return 'title';
  const sections = splitSections(source);
  if (sections.length > 1) return sections[0].key;
  const head = source.slice(0, 400).toLowerCase();
  const scores = new Map();
  for (const entry of HEADINGS) {
    const probe = entry.re.source.replace(/[\\^$*+?()[\]{}|]/gu, ' ');
    const words = probe
      .split(/\s+/u)
      .map((word) => word.trim())
      .filter((word) => word.length > 1 && /[\p{Letter}]/u.test(word));
    if (words.length === 0) continue;
    let score = 0;
    for (const word of words) {
      if (head.includes(word.toLowerCase())) score += 1;
    }
    if (score > 0) scores.set(entry.key, (scores.get(entry.key) ?? 0) + score);
  }
  let best = null;
  let bestScore = 0;
  for (const [key, score] of scores) {
    if (score > bestScore) {
      best = key;
      bestScore = score;
    }
  }
  return best ?? 'title';
}

/** Truncate a string for a compact result payload. */
export function clip(value, max = 200) {
  const text = String(value ?? '');
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}
