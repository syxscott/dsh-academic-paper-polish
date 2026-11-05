#!/usr/bin/env node
/**
 * build-skill-index.mjs
 * ------------------------------------------------------------------
 * Builds a machine-searchable index of the markdown files inside the
 * academic-paper-polish skill package.
 *
 * Output: a plain JSON array (no wrapper object), pretty-printed with
 * 2-space indent, UTF-8 without BOM.
 *
 * Entry shape (fields exactly, in this order):
 *   path      POSIX-style relative path from the skill root
 *   kind      skill | prompt | prompt-en | reference | doc
 *   title     first H1 text (leading '#' stripped); filename fallback
 *   subtitle  one short line summarising the file (zh <= 40 chars, en <= 90)
 *   headings  up to 10 H2/H3 heading texts in document order (<= 60 chars)
 *   keywords  3-8 short topical keywords taken from the file's own wording
 *   bytes     file size in bytes
 *
 * Usage:
 *   node build-skill-index.mjs
 *   node build-skill-index.mjs --root <dir> --out <file>
 *   node build-skill-index.mjs --keywords=zh      # force Chinese keywords everywhere
 *   node build-skill-index.mjs --keywords=lang     # default: match each file's language
 *
 * The script is read-only with respect to the skill directory: it only
 * writes the index file.
 */

import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_ROOT = 'D:/文档/编程项目/agent闲聊/dsh-academic-paper-polish/skill/academic-paper-polish';
const DEFAULT_OUT = 'D:/文档/编程项目/agent闲聊/dsh-academic-paper-polish/skill-index.json';

/* ------------------------------------------------------------------ */
/* CLI                                                                  */
/* ------------------------------------------------------------------ */
const argv = process.argv.slice(2);
function arg(name, fallback) {
  const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const eq = hit.indexOf('=');
  return eq === -1 ? argv[argv.indexOf(hit) + 1] : hit.slice(eq + 1);
}
const ROOT = path.resolve(arg('root', DEFAULT_ROOT));
const OUT = path.resolve(arg('out', DEFAULT_OUT));
const KEYWORD_MODE = arg('keywords', 'lang'); // 'lang' | 'zh'

/* ------------------------------------------------------------------ */
/* Markdown parsing (fence + frontmatter aware)                          */
/* ------------------------------------------------------------------ */
const EMOJI_RE =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{20E3}\u{1F3FB}-\u{1F3FF}\u{2B1B}-\u{2B1C}\u{00A9}\u{00AE}]/gu;

function stripEmoji(s) {
  return s.replace(EMOJI_RE, '');
}

/** Remove markdown inline markers, keeping the visible text. */
function cleanInline(s) {
  return s
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(?<![*\w])\*([^*\n]+)\*(?!\w)/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<https?:\/\/[^>]+>/g, ' ')
    .replace(/<[^>\n]{1,80}>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Split a document into lines, marking which lines sit inside fenced
 * code blocks, and skip a leading YAML front-matter block.
 */
function scan(text) {
  const raw = text.split(/\r?\n/);
  const lines = [];
  let inFence = false;
  let fenceChar = null;

  let start = 0;
  if (raw.length && raw[0].trim() === '---') {
    let end = -1;
    for (let i = 1; i < raw.length; i++) {
      if (raw[i].trim() === '---' || raw[i].trim() === '...') { end = i; break; }
    }
    if (end !== -1) start = end + 1;
  }

  for (let i = start; i < raw.length; i++) {
    const line = raw[i];
    const fence = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fence) {
      if (!inFence) {
        inFence = true;
        fenceChar = fence[1][0];
      } else if (fence[1][0] === fenceChar) {
        inFence = false;
        fenceChar = null;
      }
      lines.push({ text: line, code: true, heading: null });
      continue;
    }
    if (inFence) {
      lines.push({ text: line, code: true, heading: null });
      continue;
    }
    const h = line.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
    lines.push({
      text: line,
      code: false,
      heading: h ? { level: h[1].length, text: h[2].trim() } : null,
    });
  }
  return { lines, raw };
}

/* ------------------------------------------------------------------ */
/* Language detection                                                   */
/* ------------------------------------------------------------------ */
function isCJK(s) {
  return /[\u3400-\u9FFF\uF900-\uFAFF]/.test(s);
}
function isEnglishDoc(rel) {
  return rel.startsWith('prompts-en/') || rel === 'docs/PROMPTS-EN.md';
}

/* ------------------------------------------------------------------ */
/* Title                                                                */
/* ------------------------------------------------------------------ */
function titleFromFilename(rel) {
  const base = path.basename(rel).replace(/\.md$/i, '');
  return base.replace(/[-_]+/g, ' ').trim();
}
function pickTitle(rel, headings) {
  const h1 = headings.find((h) => h.level === 1);
  if (h1) {
    const t = cleanInline(stripEmoji(h1.text)).trim();
    if (t) return t;
  }
  return titleFromFilename(rel);
}

/* ------------------------------------------------------------------ */
/* Lead paragraph + sentences                                           */
/* ------------------------------------------------------------------ */
const PROSE_SKIP_LINE = /^\s*([-*_]\s*){3,}$|^\s*\|.*\|\s*$|^\s*<!--|^\s*\[!\[|^\s*\[[^\]]+\]:/;

function leadParagraph(lines) {
  let block = [];
  const flush = () => {
    const joined = block.join(' ').trim();
    block = [];
    return joined;
  };
  for (const ln of lines) {
    if (ln.code) {
      const j = flush();
      if (j && countLetters(j) >= 8) return j;
      continue;
    }
    const t = ln.text;
    if (!t.trim()) {
      const j = flush();
      if (j && countLetters(j) >= 8) return j;
      continue;
    }
    if (ln.heading) {
      const j = flush();
      if (j && countLetters(j) >= 8) return j;
      continue;
    }
    if (PROSE_SKIP_LINE.test(t)) {
      const j = flush();
      if (j && countLetters(j) >= 8) return j;
      continue;
    }
    block.push(t.replace(/^\s*>\s?/, '').replace(/^\s*[-*+]\s+/, '').replace(/^\s*\d+[.)]\s+/, ''));
  }
  const j = flush();
  return j && countLetters(j) >= 8 ? j : '';
}

function countLetters(s) {
  const m = s.match(/[\u3400-\u9FFF\uF900-\uFAFFA-Za-z0-9]/g);
  return m ? m.length : 0;
}

function splitSentences(text) {
  const parts = text.split(/(?<=[。！？；!?])\s*|(?<=\.)\s+(?=[A-Z“"(])/);
  return parts.map((s) => s.trim()).filter(Boolean);
}

/** Sentences that are pointers or metadata rather than content. */
function skipSentence(s) {
  const low = s.toLowerCase();
  if (/\b[\w\u3400-\u9FFF-]+\.md\b/i.test(s)) return true;          // file pointer
  if (/https?:\/\//i.test(s)) return true;                            // URL
  if (/^[（(]?(来源|核验|核验时间|核验日期|复核|版本|更新时间|更新日期|来源：|核验：)/.test(s)) return true;
  if (/^how to use\b/i.test(low)) return true;                        // usage boilerplate
  if (/^(适用|用法|使用方法)[:：]/.test(s) === false && /^(🔴|🆕)/.test(s)) return true;
  return false;
}

function clampChars(s, max) {
  const arr = Array.from(s);
  return arr.length <= max ? s : arr.slice(0, max).join('');
}

/**
 * Compress a sentence to the budget, preferring a clause boundary
 * (。 > ， > ； > ： > 、 > space) over a hard cut.
 */
function compress(s, budget) {
  const arr = Array.from(s);
  if (arr.length <= budget) return s;
  const prio = ['。', '，', '；', '：', '、', ' '];
  let best = -1;
  for (let p = 0; p < prio.length; p++) {
    for (let i = Math.min(budget, arr.length - 1); i >= Math.floor(budget * 0.45); i--) {
      if (arr[i] === prio[p]) { best = i; break; }
    }
    if (best !== -1) break;
  }
  if (best === -1) best = budget - 1;
  return arr.slice(0, best + 1).join('').replace(/[，；：、\s]+$/, '');
}

function looksPathy(s) {
  return /\b[\w\u3400-\u9FFF-]+\.md\b/i.test(s) || /https?:\/\//i.test(s) || /\b\w+\/\w+/.test(s);
}

/* ------------------------------------------------------------------ */
/* Subtitle                                                             */
/* ------------------------------------------------------------------ */
function h2Summary(headings, budget) {
  const h2 = headings.filter((h) => h.level === 2).map((h) => cleanInline(stripEmoji(h.text)));
  const h3 = headings.filter((h) => h.level === 3).map((h) => cleanInline(stripEmoji(h.text)));
  const picked = [];
  for (const t of [...h2, ...h3]) {
    if (!t) continue;
    if (picked.length >= 2) break;
    picked.push(t);
  }
  const joined = picked.join('；');
  return compress(joined, budget);
}

function makeSubtitle(rel, lines, headings) {
  const zh = !isEnglishDoc(rel);
  const budget = zh ? 40 : 90;
  const minLen = zh ? 14 : 45;

  const lead = leadParagraph(lines);
  const cleaned = cleanInline(stripEmoji(lead));
  const sentences = splitSentences(cleaned).filter((s) => !skipSentence(s));

  let acc = '';
  for (const s of sentences) {
    const next = acc ? `${acc} ${s}` : s;
    if (looksPathy(next)) continue;
    acc = next;
    if (Array.from(acc).length >= minLen) break;
  }
  if (acc) {
    const cut = compress(acc, budget);
    if (Array.from(cut).length >= (zh ? 10 : 30) && !looksPathy(cut)) return cut;
  }
  return h2Summary(headings, budget);
}

/* ------------------------------------------------------------------ */
/* Headings field                                                       */
/* ------------------------------------------------------------------ */
function pickHeadings(headings) {
  const out = [];
  for (const h of headings) {
    if (h.level !== 2 && h.level !== 3) continue;
    const bare = cleanInline(stripEmoji(h.text)).trim();
    if (!bare) continue;
    // skip headings that are only punctuation / emoji / symbols
    if (!/[\u3400-\u9FFF\uF900-\uFAFFA-Za-z0-9]/.test(bare)) continue;
    const t = clampChars(h.text.trim(), 60);
    out.push(t);
    if (out.length >= 10) break;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Keyword lexicons (terms taken from the skill's own wording)          */
/* ------------------------------------------------------------------ */
const ZH_TERMS = [
  // writing modules
  '摘要', '关键词写法', '关键词尺度', '引言', '文献综述', '研究方法', '结果', '讨论', '结论',
  '局限性', '未来方向', '去AI化', 'AI高频词', '句式库', '投稿信', 'Cover Letter', '审稿回复',
  '大修', '小修', '返修', '投稿', '选刊', '期刊匹配', '期刊梯队', '收录边界', '期刊结构',
  '期刊对比', '目标期刊', '稿件结构', '期刊要求', '投稿状态', '录用概率', '送审流程',
  // hard rules / structure
  '硬规则', '铁律', '引文密度', '段落结构', '倒金字塔', '措辞分寸', '地质年代', '时间单位',
  '地层单位', '参考文献', '引用格式', '参考文献五误区', '章节链', '论文骨架', '自检', '自查清单',
  '检查清单', '倒三角', '摘要骨架', '标题写法', '时态', '语态', '结论形态', '讨论结构',
  // figures
  '图表硬参数', '图件参数', '分辨率', 'DPI', 'Word缩放', '页面设置', '字号', '字体', '版权',
  '构图', '配色', '语义色', '色阶', '发散色阶', '背景色', '图例', '色觉无障碍', '灰度',
  '色彩风格', '地图', '地质图', '剖面图', '图注', '图版', '比例尺', '放大倍数', '面板字母',
  '子图标号', '表注', '表格', '文件命名', '图序', '图件原型', '版式', '排版', '图件设计',
  '制图', '标本照相', '化石照片', 'SEM图', '素描图', '插图', '制图尺寸', '黄金比例',
  // palaeontology
  'ZooBank', 'IPNI', '分类学', '系统描述', '类群块', '命名格式', '新种描述', '属级修订',
  '放射虫', '微体古生物', '有孔虫', '古生物', '地学刊', '地学SCI', '中文刊', '英文刊',
  '中日文刊', '综述刊', '顶刊', '系统树', '化石形态学', '地层学',
  // journals
  'CVPR', 'Nature', 'PNAS', 'Earth-Science Reviews', 'Palaeoworld', 'Paleobiology',
  'Copernicus', '作者指南', '官方原文', '逐字原文', '横向对比', '期刊梯队',
  // declarations / modern blocks
  '数据可用性', '代码可用性', '作者贡献', '致谢', '利益冲突', '声明块', '声明顺序',
  '基金资助', '数据共享', '开源', '收录标准', '综述体', '综述口吻',
  // AI / method-class
  '数据集交代', '模型交代', '评估指标', '基线对比', '混淆矩阵', 'ROC', '特征空间', '架构图',
  '误差案例', '可解释性', '环境版本', '缺失值', '实验设计', '复现性', '公式定义', '样本量',
  '机器学习', '深度学习', '方法类论文', '描述类论文', '章节导航句', '贡献声明',
  // evidence / method
  '全文精读', '逐字精读', '语料', '分层抽样', '分母', '偏倚', '置信度', '结论强度',
  '回源校验', '机器统计', '覆盖章节', '样本缺陷', '适用边界',
  // literature search
  '检索工具', '检索策略', '素材库', '辨证思维', '文献计量', '查新', '提案模板',
  '课程作业', '谷歌学术', '知网',
  // writing craft
  '论文写作方法论', '学位论文', '评分表', '时间预算', '论文动机', '题目', '署名',
  '学术诚信', '语言润色', '常见错误', '术语', '缩写', '双语关键词', '公式',
  // tooling / meta
  '安装路径', '兼容性矩阵', '模块索引', '快速调用', '无需安装', '使用说明', '工具兼容',
  '复核', '目录', '模板', '要点', '原则', '误区', '维度',
];

const EN_TERMS = [
  'abstract', 'introduction', 'literature review', 'methods', 'results', 'discussion',
  'conclusion', 'de-AI polish', 'journal matching', 'submission', 'reviewer response',
  'citation density', 'figure hard limits', 'Word scaling rule', 'copyright', 'composition',
  'colour', 'specimen photography', 'dpi', 'cover letter', 'data availability',
  'code availability', 'author contributions', 'significance statement', 'colour-blind',
  'style guide', 'figure legend', 'scale bar', 'magnification', 'hard rules',
  'review dimensions', 'inverted pyramid', 'methodology', 'dataset', 'baseline',
  'limitations', 'future directions', 'section navigation', 'method-class papers',
  'checklist', 'installation', 'compatibility matrix', 'modules', 'schedule',
  'hard limits', 'AI assistance', 'tool compatibility', 'palaeontology', 'journal structure',
  'declaration blocks', 'author guidelines', 'self-check', 'common errors', 'word count',
  'review article', 'data collection', 'reproducibility', 'research design', 'palette',
  'greyscale', 'plate', 'figure panel', 'file naming', 'table caption', 'colour scale',
  'figure design', 'archetype', 'layout', 'typography', 'semantic colour', 'technical check',
  'submission pipeline', 'decision letter', 'major revision', 'minor revision',
  'abstract summary paragraph', 'title', 'tense and voice', 'section chain',
  'keywords', 'four-part structure', 'plagiarism', 'citation', 'editors', 'references',
  'paleobiology', 'micropaleontology', 'earth-science reviews', 'nature', 'pnas', 'cvpr',
];

/** English term -> Chinese term (for --keywords=zh). */
const EN2ZH = {
  abstract: '摘要', introduction: '引言', 'literature review': '文献综述', methods: '研究方法',
  results: '结果', discussion: '讨论', conclusion: '结论', 'de-AI polish': '去AI化',
  'journal matching': '期刊匹配', submission: '投稿', 'reviewer response': '审稿回复',
  'citation density': '引文密度', 'figure hard limits': '图表硬参数',
  'Word scaling rule': 'Word缩放', copyright: '版权', composition: '构图', colour: '配色',
  'specimen photography': '标本照相', dpi: 'DPI', 'cover letter': 'Cover Letter',
  'data availability': '数据可用性', 'code availability': '代码可用性',
  'author contributions': '作者贡献', 'significance statement': 'Significance Statement',
  'colour-blind': '色觉无障碍', 'style guide': 'Style Guide', 'figure legend': '图注',
  'scale bar': '比例尺', magnification: '放大倍数', 'hard rules': '硬规则',
  'review dimensions': '评审维度', 'inverted pyramid': '倒金字塔', methodology: '方法论',
  dataset: '数据集', baseline: '基线对比', limitations: '局限性',
  'future directions': '未来方向', 'section navigation': '章节导航句',
  'method-class papers': '方法类论文', checklist: '自查清单', installation: '安装路径',
  'compatibility matrix': '兼容性矩阵', modules: '模块索引', schedule: '时间预算',
  'hard limits': '硬规则', 'AI assistance': 'AI辅助', 'tool compatibility': '工具兼容',
  palaeontology: '古生物', 'journal structure': '期刊结构',
  'declaration blocks': '声明块', 'author guidelines': '作者指南', 'self-check': '自查',
  'common errors': '常见错误', 'word count': '篇幅', 'review article': '综述论文',
  'data collection': '数据采集', reproducibility: '复现性', 'research design': '实验设计',
  palette: '配色', greyscale: '灰度', plate: '图版', 'figure panel': '面板字母',
  'file naming': '文件命名', 'table caption': '表注', 'colour scale': '色阶',
  'figure design': '图件设计', archetype: '图件原型', layout: '版式', typography: '字体',
  'semantic colour': '语义色', 'technical check': '技术检查',
  'submission pipeline': '送审流程', 'decision letter': '审稿意见', 'major revision': '大修',
  'minor revision': '小修', 'abstract summary paragraph': '摘要骨架', title: '题目',
  'tense and voice': '时态语态', 'section chain': '章节链', keywords: '关键词',
  'four-part structure': '四段式', plagiarism: '学术诚信', citation: '引用格式',
  editors: '编辑', references: '参考文献', paleobiology: 'Paleobiology',
  micropaleontology: '微体古生物', 'earth-science reviews': 'Earth-Science Reviews',
  nature: 'Nature', pnas: 'PNAS', cvpr: 'CVPR', 'how to use': '使用方法',
};

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'your', 'are', 'was', 'were',
  'not', 'but', 'all', 'any', 'one', 'two', 'six', 'ten', 'its', 'has', 'have', 'had',
  'you', 'our', 'their', 'them', 'they', 'will', 'can', 'may', 'must', 'should', 'more',
  'less', 'very', 'each', 'other', 'into', 'than', 'then', 'also', 'only', 'same',
  'here', 'how', 'what', 'why', 'who', 'see', 'use', 'used', 'using', 'out', 'get',
  'set', 'new', 'old', 'own', 'same', 'such', 'both', 'many', 'much', 'most', 'some',
]);

function normalise(s) {
  return s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9\u3400-\u9FFF' -]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Count occurrences of a term in a text (ASCII terms need word boundaries). */
function countTerm(hay, term) {
  if (!term) return 0;
  if (/^[a-z0-9' -]+$/.test(term)) {
    const re = new RegExp(`(?<![a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z0-9])`, 'gi');
    const m = hay.match(re);
    return m ? m.length : 0;
  }
  let n = 0;
  let i = 0;
  for (;;) {
    const k = hay.indexOf(term, i);
    if (k === -1) break;
    n++;
    i = k + term.length;
  }
  return n;
}

function pickKeywords(rel, title, headings, body, english) {
  const headText = headings.join(' ');
  const hay = normalise(`${title} ${headText} ${body}`);
  const headHay = normalise(`${title} ${headText}`);

  const terms = english ? EN_TERMS : ZH_TERMS;
  const scored = [];
  for (const term of terms) {
    if (!term) continue;
    const len = Array.from(term).length;
    if (len < 2 || len > 8) continue;
    if (english && STOPWORDS.has(term)) continue;
    const inHead = countTerm(headHay, term);
    const inBody = countTerm(hay, term);
    if (inHead === 0 && inBody === 0) continue;
    // headings weigh much more than body prose
    const score = inHead * 8 + Math.min(inBody, 12) * 1;
    scored.push({ term, score, len });
  }
  scored.sort((a, b) => b.score - a.score || b.len - a.len || a.term.localeCompare(b.term));

  const chosen = [];
  for (const cand of scored) {
    if (chosen.length >= 8) break;
    const c = cand.term.toLowerCase();
    const clash = chosen.find((k) => {
      const kk = k.term.toLowerCase();
      return kk.includes(c) || c.includes(kk);
    });
    if (clash) continue;
    chosen.push(cand);
  }
  // guarantee at least 3 keywords
  if (chosen.length < 3) {
    for (const cand of scored) {
      if (chosen.length >= 3) break;
      if (!chosen.some((k) => k.term.toLowerCase() === cand.term.toLowerCase())) chosen.push(cand);
    }
  }

  let out = chosen.slice(0, 8).map((c) => c.term);
  if (!english && KEYWORD_MODE === 'lang' && isEnglishDoc(rel)) {
    // English file, Chinese mode -> translate through the corpus's own bilingual terms
    out = chosen.slice(0, 8).map((c) => EN2ZH[c.term.toLowerCase()] || c.term);
  }
  if (english && KEYWORD_MODE === 'zh') {
    out = chosen.slice(0, 8).map((c) => EN2ZH[c.term.toLowerCase()] || c.term);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Walk                                                                 */
/* ------------------------------------------------------------------ */
function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) acc.push(p);
  }
  return acc;
}

function kindOf(rel) {
  const seg = rel.split('/');
  if (seg.length === 1) return 'skill';
  const d = seg[0];
  if (d === 'prompts') return 'prompt';
  if (d === 'prompts-en') return 'prompt-en';
  if (d === 'references') return 'reference';
  if (d === 'docs') return 'doc';
  return 'doc';
}

const KIND_ORDER = { skill: 0, prompt: 1, 'prompt-en': 2, reference: 3, doc: 4 };

function main() {
  if (!fs.existsSync(ROOT)) {
    console.error(`root not found: ${ROOT}`);
    process.exit(1);
  }
  const files = walk(ROOT);
  const entries = files.map((abs) => {
    const rel = path.relative(ROOT, abs).split(path.sep).join('/');
    const buf = fs.readFileSync(abs);
    const text = buf.toString('utf8');
    const { lines } = scan(text);
    const headings = lines.filter((l) => l.heading).map((l) => l.heading);
    const title = pickTitle(rel, headings);
    const subtitle = makeSubtitle(rel, lines, headings);
    const picked = pickHeadings(headings);
    const body = lines.map((l) => (l.code ? '' : l.text)).join('\n');
    const english = isEnglishDoc(rel);
    const keywords = pickKeywords(rel, title, picked, body, english);
    return {
      path: rel,
      kind: kindOf(rel),
      title,
      subtitle,
      headings: picked,
      keywords,
      bytes: fs.statSync(abs).size,
    };
  });

  entries.sort((a, b) => {
    const ka = KIND_ORDER[a.kind] ?? 9;
    const kb = KIND_ORDER[b.kind] ?? 9;
    if (ka !== kb) return ka - kb;
    return a.path.localeCompare(b.path, 'en');
  });

  const json = JSON.stringify(entries, null, 2);
  fs.writeFileSync(OUT, json + '\n', { encoding: 'utf8' });

  const totalBytes = entries.reduce((s, e) => s + e.bytes, 0);
  console.log(`entries: ${entries.length}`);
  console.log(`total bytes: ${totalBytes}`);
  console.log(`written: ${OUT}`);
  if (process.argv.includes('--report')) {
    for (const e of entries) {
      console.log('\n--- ' + e.path + '  [' + e.kind + ']  ' + e.bytes + 'B');
      console.log('  title:    ' + e.title);
      console.log('  subtitle: ' + e.subtitle + '  (' + Array.from(e.subtitle).length + ' chars)');
      console.log('  keywords: ' + e.keywords.join(' / '));
      console.log('  headings: ' + e.headings.length);
    }
  }
}

main();
