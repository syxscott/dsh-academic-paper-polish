// Client half of dsh-academic-paper-polish.
//
// The panel in the right sidebar (`sidebar.right.pane.tab`) is a capability
// dashboard, not a manual: it reads the host's machine-readable rule /
// journal / sentence / checklist data over the plugin's same-origin route
// and turns every answer into an action the agent can execute — a live
// compliance check, a de-AI scan, a submission checklist and a
// 「发送到会话」 bridge into the live conversation.
//
// Nothing is hardcoded here: every rule, journal, checklist item and
// violation comes from the host API. When that API is missing the panel says
// so (unauthorized / unreachable / not-implemented) instead of inventing
// content.
//
// Styling uses the host theme tokens (`--dsw-alias-*`) through the panel's
// own `--dapp-*` variables, so light and dark rendering follow the theme.
// Plain React (no JSX): the client module is loaded as plain JavaScript.

window.__ModuleLoader__.load({
  id: 'dsh-academic-paper-polish',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useLayoutEffect, useMemo, useRef } = React;

    // ── identity ─────────────────────────────────────────────────────────

    const NS = 'dsh-academic-paper-polish';
    const TAB_ID = 'dsh-academic-paper-polish';
    const TAB_KIND = 'academic-paper-polish';

    // ── locale ───────────────────────────────────────────────────────────

    const DICT_ZH = {
      'panel.title': '论文助手',
      'panel.rules': '速查',
      'panel.journals': '期刊',
      'panel.check': '检查',
      'panel.deai': '去AI',
      'panel.checklist': '清单',
      'panel.manual': '手册',
      'panel.manuscript': '稿件',
      'panel.collapse': '收起',
      'panel.expand': '展开',
      'panel.copy': '复制',
      'panel.copied': '已复制',
      'panel.send': '发给会话',
      'panel.sent': '已发送到当前会话（作为插件注入）',
      'panel.sendUnauthorized': '未授权：宿主拒绝了请求',
      'panel.sendMissing': '宿主尚未提供 /api/send，按钮暂不可用',
      'panel.sendNoSession': '当前没有活动会话，无法发送',
      'panel.sendNoChannel': '宿主未提供会话通道',
      'panel.sendFailed': '发送失败',
      'panel.progress': '进度',
      'type.label': '论文助手',
      'guide.title': '论文助手',
      'guide.description': '规则速查 · 选刊 · 实时合规检查 · 去 AI 化 · 投稿清单 · 稿件分析',
    };

    const DICT_EN = {
      'panel.title': 'Paper assistant',
      'panel.rules': 'Rules',
      'panel.journals': 'Journals',
      'panel.check': 'Check',
      'panel.deai': 'De-AI',
      'panel.checklist': 'Checklist',
      'panel.manual': 'Manual',
      'panel.manuscript': 'Manuscript',
      'panel.collapse': 'Collapse',
      'panel.expand': 'Expand',
      'panel.copy': 'Copy',
      'panel.copied': 'Copied',
      'panel.send': 'Send to chat',
      'panel.sent': 'Sent to the current conversation (as a plugin inject)',
      'panel.sendUnauthorized': 'Unauthorized: the host rejected the request',
      'panel.sendMissing': 'The host does not expose /api/send yet — the button is unavailable',
      'panel.sendNoSession': 'No live session — nothing can be sent',
      'panel.sendNoChannel': 'The host offers no conversation channel',
      'panel.sendFailed': 'Send failed',
      'panel.progress': 'Progress',
      'type.label': 'Paper assistant',
      'guide.title': 'Paper assistant',
      'guide.description': 'Rules, journals, live compliance check, de-AI scan, submission checklist, manuscript review',
    };

    /** Live translator; replaced by the locale service's binding when available. */
    let translate = (key) => DICT_ZH[key] || key;

    function registerLocale(ctx) {
      try {
        // The official client pattern: register inside an effect so the
        // disposer is owned by the plugin context and runs on unload.
        ctx.effect(() => ctx.locale.register(NS, { zh: DICT_ZH, en: DICT_EN }), 'dsh-academic-paper-polish: dictionaries');
      } catch {
        /* the locale service is optional — the local dictionary stays in use */
      }
      try {
        const bound = ctx.locale.bind(NS);
        translate = (key) => {
          try {
            const value = bound(key);
            // the locale service returns the key itself when it has no entry
            if (typeof value === 'string' && value.length > 0 && value !== key) return value;
          } catch {
            /* fall through to the local dictionary */
          }
          return DICT_ZH[key] || key;
        };
      } catch {
        translate = (key) => DICT_ZH[key] || key;
      }
    }

    // ── bundled skill index (the 手册 fallback) ──────────────────────────

    const SKILL_INDEX = [
  {
    "path": "SKILL.md",
    "kind": "skill",
    "title": "学术论文写作与润色全流程",
    "subtitle": "渐进披露：先读本文件建立框架 → 按用户意图只读需要的模块 →",
    "headings": [
      "何时使用",
      "🔴 铁律 0：先定期刊，再动笔",
      "模块索引",
      "快速调用",
      "🔴 八条硬规则（跨模块通用）",
      "1. 引言 = 倒金字塔，且 opening 必须与 resolution 对齐",
      "2. 引文密度（最易自查的一张表）",
      "3. 段落：5–8 句最合理",
      "4. 讨论必须走完六步（含\"局限性\"）",
      "5. 结论要含\"局限性 + 未来方向\""
    ],
    "keywords": [
      "局限性",
      "结论",
      "讨论",
      "引言",
      "倒金字塔",
      "引文密度",
      "硬规则",
      "模板"
    ],
    "bytes": 31274
  },
  {
    "path": "prompts/01-abstract.md",
    "kind": "prompt",
    "title": "模块 1 · 摘要润色（Abstract）",
    "subtitle": "适用：写完 / 改完正文后回头写摘要，或按目标期刊要求压缩摘要。",
    "headings": [
      "评审维度速查",
      "地学 / SCI 期刊补充约束"
    ],
    "keywords": [
      "摘要",
      "维度",
      "结果",
      "结论",
      "缩写",
      "方法类论文",
      "双语关键词",
      "参考文献"
    ],
    "bytes": 3346
  },
  {
    "path": "prompts/02-introduction.md",
    "kind": "prompt",
    "title": "模块 2 · 引言润色（Introduction）",
    "subtitle": "适用：建立研究动机、评述关键文献、引出缺口。",
    "headings": [
      "评审维度速查",
      "🔴 硬规则：opening 必须与 resolution 对齐",
      "🔴 引文密度要求",
      "🔴 措辞分寸",
      "引出不足的句式库"
    ],
    "keywords": [
      "引言",
      "措辞分寸",
      "引文密度",
      "句式库",
      "硬规则",
      "维度",
      "参考文献",
      "摘要"
    ],
    "bytes": 5747
  },
  {
    "path": "prompts/03-literature-review.md",
    "kind": "prompt",
    "title": "模块 3 · 文献综述润色（Literature Review）",
    "subtitle": "综述型论文的引言 = \"前编回顾 + 本编范围 + 双角色框架\"；",
    "headings": [
      "🔴 综述论文（Review Article）的结构",
      "三类文体对比",
      "引言三段结构（综述版）",
      "🔴 小标题的六种组织标准",
      "🔴 综述准备的 18 个步骤",
      "🔴 参考文献要求"
    ],
    "keywords": [
      "引言",
      "文献综述",
      "参考文献",
      "误区",
      "摘要",
      "收录标准",
      "学位论文",
      "综述口吻"
    ],
    "bytes": 6099
  },
  {
    "path": "prompts/04-methods.md",
    "kind": "prompt",
    "title": "模块 4 · 研究方法润色（Methods）",
    "subtitle": "本领域没有\"必须写满 Methods\"的规则",
    "headings": [
      "🔴 地学 / 实验科学补充",
      "四段式模式",
      "自查（缺任一项即不合格）",
      "常见错误",
      "引文密度",
      "数据与代码可用性声明（多数期刊要求）",
      "v2.16.1 - 数据集交代的三种主流写法（实测口径）"
    ],
    "keywords": [
      "代码可用性",
      "数据集交代",
      "常见错误",
      "期刊要求",
      "研究方法",
      "引文密度",
      "实验设计",
      "公式"
    ],
    "bytes": 4598
  },
  {
    "path": "prompts/05-results.md",
    "kind": "prompt",
    "title": "模块 5 · 结果润色（Results）",
    "subtitle": "适用：结果章节 + 图表规范检查。",
    "headings": [
      "🔴 Results vs Discussion 的组织差异",
      "期刊差异（动笔前必须确认）",
      "🔴 引文密度：Results 几乎没有参考文献",
      "🔴 图表硬参数（技术检查卡口）",
      "🔴🔴 Word 缩放铁律",
      "🔴 版权红线",
      "构图",
      "v2.16.1 - 方法类图件的真实频率（合并 8 分片 31 篇）"
    ],
    "keywords": [
      "结果",
      "构图",
      "图表硬参数",
      "参考文献",
      "引文密度",
      "版权",
      "铁律",
      "混淆矩阵"
    ],
    "bytes": 5657
  },
  {
    "path": "prompts/06-discussion.md",
    "kind": "prompt",
    "title": "模块 6 · 讨论润色（Discussion）",
    "subtitle": "适用：讨论章节。 核心：结果 ↔ 文献 ↔ 理论 ↔ 实践",
    "headings": [
      "🔴 讨论的六步框架（缺一不可）",
      "🔴 引文密度：Discussion 每段 5–8 句",
      "局限性 + 未来方向句式（可直接套用）",
      "讨论常用动词",
      "环境 / 地学意义（地学论文常见末节）",
      "v2.16.1 - 局限自陈的七种句式（实测，可直接套用）"
    ],
    "keywords": [
      "讨论",
      "局限性",
      "未来方向",
      "引文密度",
      "结论",
      "结果",
      "方法类论文",
      "参考文献"
    ],
    "bytes": 6168
  },
  {
    "path": "prompts/07-conclusion.md",
    "kind": "prompt",
    "title": "模块 7 · 结论润色（Conclusion）",
    "subtitle": "适用：结论章节。 核心：总结 + 亮点 + 局限性 + 未来方向，不引入新信息。",
    "headings": [
      "🔴 Do / Don't",
      "🔴 两条要点",
      "🔴 期刊差异：结论段可能不独立存在",
      "篇幅"
    ],
    "keywords": [
      "结论",
      "要点",
      "局限性",
      "方法类论文",
      "描述类论文",
      "目标期刊",
      "未来方向"
    ],
    "bytes": 3181
  },
  {
    "path": "prompts/08-deai-polish.md",
    "kind": "prompt",
    "title": "模块 8 · 降低 AI 率（终稿通篇润色）",
    "subtitle": "本领域摘要口径 = 现在时 95% + 被动 87% + \"we\" 仅",
    "headings": [
      "AI 高频词黑名单",
      "🔴 去 AI 化不能违反学术规范",
      "🔴 参考文献区不做去 AI 化",
      "⚠️ 判定标准"
    ],
    "keywords": [
      "参考文献",
      "结论",
      "目标期刊",
      "期刊要求",
      "时态",
      "语态",
      "摘要"
    ],
    "bytes": 3770
  },
  {
    "path": "prompts/09-journal-submission.md",
    "kind": "prompt",
    "title": "模块 9 · 期刊匹配与投稿（Journal Matching & Submission）",
    "subtitle": "图注前缀也是多语种的（Fig./Рис./Таблица/图/图版/Abb.）。",
    "headings": [
      "🔴 期刊结构硬约束速查",
      "🔴 ES&T 的 R&D 写法（原文要点）",
      "🔴 GCA 的 Results / Discussion 分工",
      "🔴 送审流程与\"格式即生死\"",
      "🔴 常用前置部分规范",
      "🔴 Cover Letter",
      "🔴 投稿后 6 个状态",
      "🔴 结局概率（提前知道期望值）",
      "v2.16.1 - 声明块的两种口径（机器层 vs 人工层）"
    ],
    "keywords": [
      "投稿",
      "声明块",
      "要点",
      "期刊结构",
      "期刊匹配",
      "送审流程",
      "比例尺",
      "结论"
    ],
    "bytes": 8084
  },
  {
    "path": "prompts/10-reviewer-response.md",
    "kind": "prompt",
    "title": "模块 10 · 审稿意见回复（Responding to Reviewers）",
    "subtitle": "适用：收到 Decision letter 后逐条回复。",
    "headings": [
      "🔴 回复四要素（范例）",
      "🔴 六条纪律（逐条检查）",
      "🔴 审稿人关注什么（反向自查 8 项）",
      "🔴 ELSEVIER「ACCEPTANCE」十点",
      "🔴 找审稿人的途径",
      "大修 vs 小修"
    ],
    "keywords": [
      "大修",
      "小修",
      "参考文献",
      "讨论",
      "返修",
      "结果",
      "结论"
    ],
    "bytes": 4752
  },
  {
    "path": "prompts-en/01-abstract.md",
    "kind": "prompt-en",
    "title": "Module 1 · Abstract Polish",
    "subtitle": "No other file in this repository is required.",
    "headings": [
      "Review dimensions",
      "Journal constraints to apply",
      "The four-part Nature summary paragraph",
      "v2.16.0 - Abstract in METHOD-CLASS papers"
    ],
    "keywords": [
      "abstract",
      "nature",
      "results",
      "pnas",
      "citation",
      "methods"
    ],
    "bytes": 4333
  },
  {
    "path": "prompts-en/02-introduction.md",
    "kind": "prompt-en",
    "title": "Module 2 · Introduction Polish",
    "subtitle": "Self-contained — no other file needed.",
    "headings": [
      "Review dimensions",
      "🔴 The hardest rule: opening must match resolution",
      "🔴 Citation density",
      "🔴 Wording discipline",
      "Sentence bank — signalling the gap",
      "Five ways to foreground your own contribution",
      "v2.16.0 - Introduction in METHOD-CLASS papers",
      "The four fixed steps",
      "Four shapes of the contribution statement",
      "Section-navigation sentences (common in method-class papers,"
    ],
    "keywords": [
      "citation",
      "methods",
      "results"
    ],
    "bytes": 6484
  },
  {
    "path": "prompts-en/03-literature-review.md",
    "kind": "prompt-en",
    "title": "Module 3 · Literature Review Polish",
    "subtitle": "Review article structure；Six ways to organise subheadings",
    "headings": [
      "Review article structure",
      "Three genres compared",
      "Three-part introduction (review version)",
      "Six ways to organise subheadings",
      "🔴 The 18-step review workflow",
      "🔴 Reference requirements",
      "🔴 *Earth-Science Reviews* scope note"
    ],
    "keywords": [
      "citation",
      "abstract",
      "methods",
      "title",
      "results",
      "layout"
    ],
    "bytes": 6174
  },
  {
    "path": "prompts-en/04-methods.md",
    "kind": "prompt-en",
    "title": "Module 4 · Methods Polish",
    "subtitle": "Earth-science / experimental-science additions；Citation density",
    "headings": [
      "Earth-science / experimental-science additions",
      "Four-part pattern",
      "Self-check (any omission is a fail)",
      "Common errors",
      "Citation density",
      "Data and code availability (required by most journals)",
      "v2.16.0 - Evidence-based additions for METHOD-CLASS (AI / da",
      "The six mandatory dataset items",
      "Data magnitudes in this field (state them, or the work looks",
      "Environment versions (most often omitted, most often asked f"
    ],
    "keywords": [
      "dataset",
      "methods",
      "citation",
      "results",
      "baseline",
      "pnas"
    ],
    "bytes": 7151
  },
  {
    "path": "prompts-en/05-results.md",
    "kind": "prompt-en",
    "title": "Module 5 · Results Polish",
    "subtitle": "Results vs Discussion: different axes；Citation density: Results carries almost none",
    "headings": [
      "🔴 Results vs Discussion: different axes",
      "Journal differences (confirm before drafting)",
      "🔴 Citation density: Results carries almost none",
      "🔴 Figure hard limits (the technical-check gate)",
      "🔴🔴 The Word scaling rule",
      "🔴 Copyright red lines",
      "Composition",
      "Colour",
      "Specimen photography (palaeontology-specific)",
      "Journal-specific dpi (same photo, different requirements)"
    ],
    "keywords": [
      "results",
      "dpi",
      "colour",
      "citation",
      "dataset",
      "title",
      "pnas"
    ],
    "bytes": 7950
  },
  {
    "path": "prompts-en/06-discussion.md",
    "kind": "prompt-en",
    "title": "Module 6 · Discussion Polish",
    "subtitle": "The six-step discussion (all six are mandatory)",
    "headings": [
      "🔴 The six-step discussion (all six are mandatory)",
      "🔴 Citation density: 5–8 sentences per paragraph",
      "Limitations + future directions (ready to use)",
      "Verbs by function",
      "Environmental / geological significance (common final subsec",
      "v2.16.0 - Discussion in METHOD-CLASS papers",
      "Three observed shapes",
      "Attribute errors to the fossils, not to the model",
      "v2.16.1 - Seven sentence patterns for stating limitations (m"
    ],
    "keywords": [
      "citation",
      "results",
      "methods"
    ],
    "bytes": 6979
  },
  {
    "path": "prompts-en/07-conclusion.md",
    "kind": "prompt-en",
    "title": "Module 7 · Conclusion Polish",
    "subtitle": "Do / Don't；Two things the conclusion must carry",
    "headings": [
      "🔴 Do / Don't",
      "🔴 Two things the conclusion must carry",
      "🔴 Journal difference: the conclusion section may not exist",
      "Length",
      "v2.16.0 - Conclusions in METHOD-CLASS papers",
      "A method-class conclusion must state its boundary of validit",
      "Skeletons are not interchangeable (descriptive vs method-cla"
    ],
    "keywords": [
      "results"
    ],
    "bytes": 4280
  },
  {
    "path": "prompts-en/08-deai-polish.md",
    "kind": "prompt-en",
    "title": "Module 8 · De-AI Polish (final whole-manuscript pass)",
    "subtitle": "Use only after Modules 1–7 are finalised. This is the last step and is applied to the",
    "headings": [
      "AI high-frequency word blacklist",
      "🔴 What de-AI polish must never do",
      "⚠️ Do not de-AI the reference list"
    ],
    "keywords": [
      "modules"
    ],
    "bytes": 3988
  },
  {
    "path": "prompts-en/09-journal-submission.md",
    "kind": "prompt-en",
    "title": "Module 9 · Journal Matching & Submission",
    "subtitle": "Pick the journal before you write. This determines every structural decision downstream.",
    "headings": [
      "🔴 Journal structural constraints",
      "Submission review pipeline",
      "Front-matter conventions",
      "Cover letter",
      "Post-submission states",
      "Outcome probabilities (know the expectations in advance)",
      "v2.16.0 - Declaration blocks: measured frequency and verbati",
      "Measured rates (denominators stated)",
      "Five observed Data availability formulations (verbatim)",
      "Three tiers of code release"
    ],
    "keywords": [
      "title",
      "abstract",
      "editors",
      "baseline",
      "keywords",
      "methods",
      "results",
      "pnas"
    ],
    "bytes": 10171
  },
  {
    "path": "prompts-en/10-reviewer-response.md",
    "kind": "prompt-en",
    "title": "Module 10 · Responding to Reviewers",
    "subtitle": "The four elements (worked example)；Six disciplines (check each)",
    "headings": [
      "🔴 The four elements (worked example)",
      "🔴 Six disciplines (check each)",
      "🔴 What reviewers check (reverse self-audit)",
      "Elsevier's \"ACCEPTANCE\" checklist",
      "Finding reviewers",
      "Major vs minor revision"
    ],
    "keywords": [
      "editors"
    ],
    "bytes": 4838
  },
  {
    "path": "references/AGENTS.md",
    "kind": "reference",
    "title": "AGENTS.md — Academic Paper Polish",
    "subtitle": "本文件是本仓库的跨工具规则单一来源（single source of",
    "headings": [
      "仓库结构",
      "AI 在本仓库中的工作方式",
      "何时加载哪个模块",
      "改稿时的默认行为",
      "🔴 不可违反的内容红线",
      "学术规范要点（AI 生成内容必须遵守）",
      "引文密度（最易出错）",
      "结构",
      "期刊差异（必须先确认目标期刊）",
      "措辞"
    ],
    "keywords": [
      "目标期刊",
      "引文密度",
      "结论",
      "要点",
      "引言",
      "语料",
      "硬规则",
      "摘要"
    ],
    "bytes": 19430
  },
  {
    "path": "references/ai-ml-paper-patterns.md",
    "kind": "reference",
    "title": "AI/ML 方法类地学论文的写作实证（v2.16.0 新增）",
    "subtitle": "本文件补上这个空白：把「AI 方法类地学论文实际怎么写」逐条取证。",
    "headings": [
      "一、阅读口径与分层（先说清楚能兑现什么）",
      "1.1 分层判据（机器执行，可复现）",
      "1.2 这批语料的三个已知缺陷（必须随结论一起声明）",
      "二、范式对照：描述类 vs 方法类（机器统计，同口径）",
      "三、声明块：现代地学/古生物论文必写的六块",
      "3.1 出现频率（分母 = 该层篇数）",
      "3.2 Data availability 的五种实际写法（逐字原文）",
      "3.3 Code availability 的实际写法",
      "四、数据集、模型与评估：方法类论文的实际写法",
      "4.1 数据集怎么交代（必备六件）"
    ],
    "keywords": [
      "方法类论文",
      "声明块",
      "结论",
      "语料",
      "逐字原文",
      "分母",
      "古生物",
      "描述类论文"
    ],
    "bytes": 52362
  },
  {
    "path": "references/checklist.md",
    "kind": "reference",
    "title": "投稿前自查清单（打印 / 逐项过版）",
    "subtitle": "A. 写作前（不满足则不要动笔）；B. 题目 · 署名 · 摘要",
    "headings": [
      "A. 写作前（不满足则不要动笔）",
      "B. 题目 · 署名 · 摘要",
      "C. 引言",
      "D. 材料与方法",
      "E. 结果与讨论",
      "F. 结论",
      "G. 参考文献",
      "H. 致谢",
      "I. 投稿",
      "J. 综述专项"
    ],
    "keywords": [
      "投稿",
      "参考文献",
      "自查清单",
      "结果",
      "结论",
      "署名",
      "讨论",
      "题目"
    ],
    "bytes": 8433
  },
  {
    "path": "references/color-system.md",
    "kind": "reference",
    "title": "配色系统与视觉编码（Color System & Visual Encoding）",
    "subtitle": "本文件给的是配色决策逻辑 —— 面对一张新图",
    "headings": [
      "🔴 铁律：配色是语义系统，不是审美选择",
      "一、🔴 第一原则：色相必须在全图可追溯",
      "「对照冷色 / 处理暖色」是常见约定，不是规则",
      "多组时的分配原则",
      "阴性对照 / 无效组：用「空心」而非第三种颜色",
      "二、色相选择的具体锚点（可直接抄）",
      "2.1 两组对比（最常用）",
      "2.2 三组及以上（遗传学三态）",
      "2.3 四组（干预矩阵）",
      "三、🔴 一个通道只能承载一个变量"
    ],
    "keywords": [
      "配色",
      "原则",
      "色阶",
      "铁律",
      "图例",
      "顶刊",
      "背景色",
      "灰度"
    ],
    "bytes": 16673
  },
  {
    "path": "references/figure-conventions-evidence.md",
    "kind": "reference",
    "title": "图件制图实证（v2.15.0 新增）",
    "subtitle": "本文件的证据来自「实际打开渲染出的 PNG 看图」，不是只看图注文字。",
    "headings": [
      "一、核心结论：制图惯例按「刊」分，不存在全领域统一规则",
      "1.1 比例尺 vs 放大倍数（最强的按刊分界）",
      "1.2 图注前缀的多语种词汇表（实测 4035 条图注）",
      "1.3 图注位置分两派（按刊）",
      "1.4 图例（Legend）放哪：三选一，按刊分",
      "1.5 中文刊的图注格式（固定七要素）",
      "1.6 中文对比表用「√」标记共同种",
      "二、子图标号体系（逐字实测）",
      "三、图版（Plate）说明的四种制式",
      "3.1 罗马数字图版号 + 放大倍数（Geologica Carpathica / QJGS / 成都地矿所刊）"
    ],
    "keywords": [
      "图注",
      "图版",
      "放大倍数",
      "比例尺",
      "制图",
      "中文刊",
      "结论",
      "图例"
    ],
    "bytes": 9562
  },
  {
    "path": "references/figure-design-system.md",
    "kind": "reference",
    "title": "图件设计体系（Figure Design System）",
    "subtitle": "本文件给的是第三层、也是最常被跳过的一层",
    "headings": [
      "零、为什么以这篇为蓝本",
      "🔖 蓝本原文锚点（verbatim，逐句引用）",
      "一、🔴 铁律：图序即论证顺序",
      "14 张图的骨架（可复用到任何一篇论文）",
      "二、五种图件原型（archetype）",
      "A. 流程图（Fig 1、Fig 14）",
      "B. 图像对照版（Fig 2、Fig 3、Fig 5）",
      "C. 性能矩阵（Fig 4）",
      "D. 成对比较面板（Fig 6、Fig 9、Fig 10a、Fig 11）",
      "E. 回归与排序图（Fig 7、Fig 8、Fig 10b、Fig 12、Fig 13）"
    ],
    "keywords": [
      "铁律",
      "图注",
      "图件设计",
      "图件原型",
      "图序",
      "色阶",
      "图例",
      "语义色"
    ],
    "bytes": 20351
  },
  {
    "path": "references/figure-specs.md",
    "kind": "reference",
    "title": "图表硬参数速查",
    "subtitle": "图表与排版的可直接执行硬参数。",
    "headings": [
      "一、图件硬参数",
      "Copernicus / J. Micropalaeontology 口径（🔴 与上表不同）",
      "Palaeontologia Electronica 口径（🔴 与上表不同）",
      "图内规范细节（PPP 原文，v2 补）",
      "少数情况",
      "二、🔴 Word 缩放铁律（最易犯错）",
      "三、页面设置",
      "四、制图尺寸与字号",
      "五、构图原则",
      "黄金比例（三分之二原则）"
    ],
    "keywords": [
      "原则",
      "构图",
      "图注",
      "铁律",
      "字号",
      "图表硬参数",
      "黄金比例",
      "页面设置"
    ],
    "bytes": 9666
  },
  {
    "path": "references/fulltext-reading-evidence.md",
    "kind": "reference",
    "title": "全文逐字精读实证（v2.15.0 新增）",
    "subtitle": "本文件的每一条结论都来自「逐字读完整个正文文件」，不是关键词命中率",
    "headings": [
      "一、阅读口径与可兑现范围（先说清楚）",
      "二、章节链实测：没有统一模板",
      "2.1 完整 IMRaD + 声明块（高标准地学刊）",
      "2.2 分类学体系论文（无 Discussion、无 Methods）",
      "2.3 短篇发现报告（3–10 页，无独立 Discussion）",
      "2.4 区域生物地层学（无独立 Methods，方法只有一句）",
      "2.5 系统描述类（讨论不在 Discussion 段）",
      "三、中间部分（Methods / Results）的真实写法",
      "3.1 Methods 的三种详略档次",
      "3.2 Results 的两条硬要求"
    ],
    "keywords": [
      "模板",
      "讨论",
      "章节链",
      "系统描述",
      "分类学",
      "声明块",
      "逐字精读",
      "地层学"
    ],
    "bytes": 47991
  },
  {
    "path": "references/journal-constraints.md",
    "kind": "reference",
    "title": "期刊结构硬约束速查",
    "subtitle": "写作前必须先确定目标期刊 —— 结构要求因刊而异，这是硬约束不是建议。",
    "headings": [
      "对照表",
      "J. Micropalaeontology（JM）/ Copernicus 平台口径",
      "图件硬参数",
      "🔴 两条平台独有条款",
      "GCA 的 Results / Discussion 要求（GCA 原文要点）",
      "ES&T 的 Results and Discussion 要求（GCA 原文要点）",
      "定刊时的四查",
      "GCA Cover Letter 硬性要求",
      "常用配图配色（可直接抄）",
      "图件要求（送审 vs 终稿**完全不同**）"
    ],
    "keywords": [
      "要点",
      "配色",
      "期刊结构",
      "参考文献",
      "古生物",
      "结论",
      "摘要",
      "缩写"
    ],
    "bytes": 19388
  },
  {
    "path": "references/literature-search.md",
    "kind": "reference",
    "title": "文献检索与素材积累实操",
    "subtitle": "来自文献检索部分(2025-09-08) +",
    "headings": [
      "一、检索工具清单",
      "关键词查询的四种变体（ P19–21，v2 补具体查询串）",
      "二、🔴 关键词的尺度选择（ P25，最容易做错的一步）",
      "三、检索策略实例（ P29，可直接复用）",
      "四、🔴 困难文献的获取途径（ P23）",
      "五、自动追踪最新文献（ P24）",
      "六、★ 三个核心积累方法（ P30–32）",
      "1. 积累自己的素材库",
      "2. 积累自己的写作技巧参考库（ P31，v2 补具体形式）",
      "3. 辨证思维训练（ P35，v2 补批注全文示例）"
    ],
    "keywords": [
      "辨证思维",
      "检索策略",
      "检索工具",
      "素材库",
      "谷歌学术",
      "模板",
      "知网",
      "课程作业"
    ],
    "bytes": 8444
  },
  {
    "path": "references/micropaleo-paper-patterns.md",
    "kind": "reference",
    "title": "微体古生物 / 放射虫论文的写作与制图模式",
    "subtitle": "本文件讲第三件事：这个领域（微体古生物 / 放射虫）的论文实际长什么样 ——",
    "headings": [
      "一、🔴 四种主题的论文骨架",
      "🔴 A 类（系统描述）的关键结构特征",
      "二、🔴 图件范式：Fig. 制 vs 图版（Plate）制",
      "2.1 图注前缀的实际分布（1139 条图注，逐字统计）",
      "2.2 面板字母体系（语料原句逐字）",
      "2.3 🔴 图注里的来源声明（本领域特有）",
      "三、🔴 色彩风格：灰度优先，形状承担分组",
      "3.1 彩色出现在哪里",
      "3.2 彩色系统树的三个可抄细节（Biard et al. 2022, *Environ Microbiol*）",
      "四、🔴 地图与地质图：灰度花纹 + 插图 + 比例尺"
    ],
    "keywords": [
      "图注",
      "灰度",
      "系统描述",
      "图版",
      "语料",
      "放射虫",
      "比例尺",
      "微体古生物"
    ],
    "bytes": 62437
  },
  {
    "path": "references/multi-journal-style-guides.md",
    "kind": "reference",
    "title": "多期刊官方 Style Guide 汇总（地学 / 古生物 / CV）",
    "subtitle": "ESR / Nature / PNAS / CVPR / Palaeoworld",
    "headings": [
      "目录",
      "1.1 收录边界（🔴 最容易被 desk-reject 的地方）",
      "1.2 文章类型与字数（🔴 官方体裁口径）",
      "1.3 前置要素（🔴 Abstract 必填 / Highlights 是\"鼓励\"不是\"必须\"）",
      "1.4 文件格式与行号",
      "1.5 结构",
      "1.6 图表（🔴 官方原表，逐字照录）",
      "1.7 其他",
      "1.8 🔴 参考文献（官方原文，author-date 制）",
      "2.1 Article 篇幅（🔴 按\"印刷页\"算，不按字数）"
    ],
    "keywords": [
      "参考文献",
      "官方原文",
      "古生物",
      "收录边界",
      "复核",
      "目录",
      "缩写",
      "投稿"
    ],
    "bytes": 81736
  },
  {
    "path": "references/paleobiology-journal.md",
    "kind": "reference",
    "title": "Paleobiology 期刊投稿规范（图件 + 文体）",
    "subtitle": "一、图件规范（Electronic Figure Guidelines）",
    "headings": [
      "一、图件规范（Electronic Figure Guidelines）",
      "1.1 两套要求：送审 vs 出版",
      "1.2 图件尺寸（Cambridge 生产规范）",
      "1.3 🔴 DPI 硬性要求（按图件类型分）",
      "1.4 🔴 大图拆分（Split Figures）",
      "1.5 🔴 大文件压缩",
      "1.6 🔴 标本照相要求（★ 化石形态学论文直接适用）",
      "1.7 图内标注、字体、色彩",
      "1.8 🔴 色彩避坑",
      "1.9 🔴 图注（Caption）"
    ],
    "keywords": [
      "图注",
      "字体",
      "缩写",
      "化石形态学",
      "标本照相",
      "投稿",
      "比例尺",
      "表格"
    ],
    "bytes": 21564
  },
  {
    "path": "references/sentence-bank.md",
    "kind": "reference",
    "title": "句式库",
    "subtitle": "全部来自本技能方法库。 按用途分组，可直接套用。",
    "headings": [
      "一、引言：引出研究不足（用 However 引导）",
      "强调自己研究重要性的 5 种切入",
      "二、引言：措辞正反例",
      "三、摘要：分层指示词",
      "四、讨论：常用动词",
      "五、结论：局限性与未来方向（★可直接套用）",
      "六、研究展望：用问句作小标题",
      "七、综述引言：三段式",
      "八、回复审稿人：四要素范式",
      "九、编辑拒稿话术（识别用，不必回复）"
    ],
    "keywords": [
      "引言",
      "讨论",
      "未来方向",
      "局限性",
      "句式库",
      "结论",
      "摘要",
      "结果"
    ],
    "bytes": 8380
  },
  {
    "path": "references/格式硬参数与文献检索实操.md",
    "kind": "reference",
    "title": "格式硬参数与文献检索实操",
    "subtitle": "地学 SCI 投稿的格式硬参数、引文密度、送审流程与时间预算；",
    "headings": [
      "〇、★ Guide for Authors 的三种入口★",
      "一、体裁与篇幅",
      "必备信息",
      "其他事项",
      "★ Submission checklist",
      "二、文章结构与分级",
      "标题分级",
      "前置部分（顺序固定）",
      "正文结构（★地学标准骨架）",
      "★ Graphical Abstract"
    ],
    "keywords": [
      "参考文献",
      "学位论文",
      "图注",
      "配色",
      "版式",
      "文献综述",
      "放射虫",
      "分辨率"
    ],
    "bytes": 38761
  },
  {
    "path": "references/论文写作方法论骨架.md",
    "kind": "reference",
    "title": "论文写作方法论骨架",
    "subtitle": "面向地学 SCI 论文与学位论文的写作与投稿方法论。",
    "headings": [
      "一、总纲：论文写作前的四项准备",
      "1.3 制图要求",
      "1.4 实例对照：读刊的 Aims & Scope 与稿约",
      "二、写作姿态",
      "三、SCI 论文结构",
      "四、题目",
      "五、署名",
      "六、摘要",
      "七、引言★核心",
      "7.1 四大内容"
    ],
    "keywords": [
      "引言",
      "摘要",
      "题目",
      "署名",
      "结果",
      "结论",
      "讨论",
      "论文写作方法论"
    ],
    "bytes": 40053
  },
  {
    "path": "docs/COMPATIBILITY.md",
    "kind": "doc",
    "title": "AI 工具兼容性矩阵",
    "subtitle": "各工具随时可能改默认值，尤其开关类。",
    "headings": [
      "一、结论先行",
      "二、兼容性矩阵",
      "三、安装路径",
      "作为 Skill（推荐：获得完整的 10 模块 + 渐进披露）",
      "作为项目规则（仓库级）",
      "直接当 Prompt 用（零安装）",
      "四、Claude Code 的版本差异（重要）",
      "Claude Code 规则未加载的排查",
      "五、Codex 的 32 KiB 限制",
      "5.5 英文用户（English users）"
    ],
    "keywords": [
      "兼容性矩阵",
      "结论",
      "目录",
      "安装路径",
      "工具兼容",
      "硬规则",
      "表格"
    ],
    "bytes": 7253
  },
  {
    "path": "docs/PROMPTS-EN.md",
    "kind": "doc",
    "title": "Academic Paper Polish — English",
    "subtitle": "This is the English entry point.",
    "headings": [
      "How to use (no installation required)",
      "The 10 modules",
      "What this repository is",
      "The eight hard rules",
      "1. Pick the journal before you write",
      "2. Inverted pyramid, and opening must match resolution",
      "3. Citation density",
      "4. Paragraphs: 5–8 sentences",
      "5. The six-step discussion",
      "6. Conclusions must carry limitations + future directions"
    ],
    "keywords": [
      "citation",
      "modules",
      "dpi",
      "results",
      "abstract",
      "methods",
      "schedule",
      "pnas"
    ],
    "bytes": 10010
  }
];

    // ── icons ────────────────────────────────────────────────────────────

    const ICONS = {
      abstract: [
        { t: 'rect', x: 5, y: 3, width: 10, height: 14, rx: 1.6 },
        { t: 'line', x1: 7.4, y1: 7, x2: 12.6, y2: 7 },
        { t: 'line', x1: 7.4, y1: 10.5, x2: 12.6, y2: 10.5 },
        { t: 'line', x1: 7.4, y1: 14, x2: 10.6, y2: 14 },
      ],
      intro: [
        { t: 'circle', cx: 14.6, cy: 10, r: 3 },
        { t: 'line', x1: 3, y1: 10, x2: 9, y2: 10 },
        { t: 'path', d: 'M6.6 7.4 9 10 6.6 12.6' },
      ],
      review: [
        { t: 'rect', x: 4, y: 3.6, width: 12, height: 3, rx: 1 },
        { t: 'rect', x: 4, y: 8.2, width: 12, height: 3, rx: 1 },
        { t: 'rect', x: 4, y: 12.8, width: 7.5, height: 3, rx: 1 },
      ],
      methods: [
        { t: 'line', x1: 4, y1: 3, x2: 13, y2: 3 },
        { t: 'path', d: 'M8 3v4.6L4.7 14.1A1.7 1.7 0 006.2 16.8h7.6a1.7 1.7 0 001.5-2.7L12 7.6V3' },
        { t: 'line', x1: 6.3, y1: 12.2, x2: 13.7, y2: 12.2 },
      ],
      results: [
        { t: 'line', x1: 4, y1: 16.2, x2: 16.5, y2: 16.2 },
        { t: 'rect', x: 5.4, y1: 10, width: 2.4, height: 6.2, rx: 0.6 },
        { t: 'rect', x: 9, y1: 6.4, width: 2.4, height: 9.8, rx: 0.6 },
        { t: 'rect', x: 12.6, y1: 12, width: 2.6, height: 4.2, rx: 0.6 },
      ],
      discussion: [
        { t: 'path', d: 'M3.6 4.4h9.2a1.8 1.8 0 011.8 1.8v3.6a1.8 1.8 0 01-1.8 1.8H8.4L4.4 15.2v-3.6h-.8a1.8 1.8 0 01-1.8-1.8V6.2a1.8 1.8 0 011.8-1.8z' },
        { t: 'path', d: 'M9.6 11.8h4.6a1.8 1.8 0 011.8 1.8v2.4l-3.4-2.4h-4.6a1.8 1.8 0 00-1.8 1.8v2.4l-3.4-2.4z' },
      ],
      conclusion: [
        { t: 'circle', cx: 10, cy: 10, r: 7 },
        { t: 'path', d: 'M6.6 10.2 8.9 12.5 13.4 8' },
      ],
      deai: [
        { t: 'path', d: 'M8.2 2.8l1.3 3.4 3.4 1.3-3.4 1.3-1.3 3.4-1.3-3.4-3.4-1.3 3.4-1.3z' },
        { t: 'path', d: 'M14.6 11.2l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z' },
      ],
      journal: [
        { t: 'rect', x: 3.4, y: 4, width: 9.6, height: 12, rx: 1.6 },
        { t: 'line', x1: 6.2, y1: 8, x2: 10.2, y2: 8 },
        { t: 'path', d: 'M8.6 13.4h8M14.2 11l2.4 2.4-2.4 2.4' },
      ],
      reply: [
        { t: 'path', d: 'M3.6 4.2h12.8v8.4h-6.6L5 16v-3.4H3.6z' },
        { t: 'path', d: 'M6.8 8.6h6M6.8 8.6l2.2-2.2M6.8 8.6l2.2 2.2' },
      ],
      mark: [
        { t: 'rect', x: 3.6, y: 2.6, width: 9.6, height: 12.4, rx: 1.6 },
        { t: 'line', x1: 6, y1: 6.4, x2: 10.8, y2: 6.4 },
        { t: 'line', x1: 6, y1: 9.4, x2: 10.8, y2: 9.4 },
        { t: 'path', d: 'M9.6 14.2 15.4 8.4l2 2-5.8 5.8-2.6.6z' },
      ],
      chevron: [{ t: 'path', d: 'M8 5l5 5-5 5' }],
      check: [{ t: 'path', d: 'M4.5 10.4 8 13.9l7.5-8' }],
      copy: [
        { t: 'rect', x: 7, y: 7, width: 9, height: 9, rx: 1.6 },
        { t: 'path', d: 'M13 5.5H5.2A1.2 1.2 0 004 6.7V14' },
      ],
      send: [
        { t: 'path', d: 'M3.4 10 16.6 4l-3 12.4-3.4-4.6L3.4 10z' },
        { t: 'line', x1: 10.2, y1: 11.8, x2: 16.6, y2: 4 },
      ],
      expand: [{ t: 'path', d: 'M5 9l5 5 5-5' }],
      external: [{ t: 'path', d: 'M4 9.6 10 16l6-6M9 16H4V4h12v5' }],
      search: [
        { t: 'circle', cx: 8.6, cy: 8.6, r: 5.6 },
        { t: 'line', x1: 12.8, y1: 12.8, x2: 16.5, y2: 16.5 },
      ],
      grid: [
        { t: 'rect', x: 3.4, y: 3.4, width: 5.4, height: 5.4, rx: 1 },
        { t: 'rect', x: 11.2, y: 3.4, width: 5.4, height: 5.4, rx: 1 },
        { t: 'rect', x: 3.4, y: 11.2, width: 5.4, height: 5.4, rx: 1 },
        { t: 'rect', x: 11.2, y: 11.2, width: 5.4, height: 5.4, rx: 1 },
      ],
      target: [
        { t: 'circle', cx: 10, cy: 10, r: 7 },
        { t: 'circle', cx: 10, cy: 10, r: 3.2 },
      ],
      ruler: [
        { t: 'rect', x: 2.6, y: 7, width: 14.8, height: 6, rx: 1.4 },
        { t: 'line', x1: 6.4, y1: 7, x2: 6.4, y2: 10 },
        { t: 'line', x1: 10, y1: 7, x2: 10, y2: 9.4 },
        { t: 'line', x1: 13.6, y1: 7, x2: 13.6, y2: 10 },
      ],
      palette: [
        { t: 'path', d: 'M10 2.6a7.4 7.4 0 000 14.8c1 0 1.6-.6 1.6-1.4 0-.5-.2-.8-.5-1.1-.3-.3-.5-.6-.5-1 0-.8.6-1.4 1.5-1.4h1.4A4 4 0 0017.4 8c0-3-3.3-5.4-7.4-5.4z' },
        { t: 'circle', cx: 6.6, cy: 9, r: 1 },
        { t: 'circle', cx: 9, cy: 6.2, r: 1 },
        { t: 'circle', cx: 12.4, cy: 6.8, r: 1 },
      ],
      book: [
        { t: 'path', d: 'M3.6 4.4h5a2.4 2.4 0 012.4 2.4v9a1.8 1.8 0 00-1.8-1.8H3.6z' },
        { t: 'path', d: 'M16.4 4.4h-5A2.4 2.4 0 009 6.8v9a1.8 1.8 0 011.8-1.8h5.6z' },
      ],
      close: [{ t: 'path', d: 'M5.5 5.5 14.5 14.5M14.5 5.5 5.5 14.5' }],
      doc: [
        { t: 'rect', x: 4.2, y: 2.8, width: 11.6, height: 14.4, rx: 1.6 },
        { t: 'line', x1: 7, y1: 6.6, x2: 13, y2: 6.6 },
        { t: 'line', x1: 7, y1: 10, x2: 13, y2: 10 },
        { t: 'line', x1: 7, y1: 13.4, x2: 10.4, y2: 13.4 },
      ],
    };

    function Icon(props) {
      const size = props.size || 16;
      const parts = ICONS[props.name] || [];
      return h(
        'svg',
        {
          viewBox: '0 0 20 20',
          width: size,
          height: size,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: props.strokeWidth || 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          className: props.className,
          'aria-hidden': true,
        },
        parts.map((part, index) => {
          const { t, ...rest } = part;
          return h(t, { ...rest, key: index });
        }),
      );
    }

    /** Original artwork for the guide entry (no host primitive is imported). */
    function GuideIcon(props) {
      const size = props && props.size ? props.size : 24;
      return h(
        'svg',
        {
          viewBox: '0 0 24 24',
          width: size,
          height: size,
          'aria-hidden': true,
          style: { color: 'inherit' },
        },
        h('rect', {
          x: 3.5,
          y: 2.5,
          width: 12,
          height: 16,
          rx: 1.6,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.6,
        }),
        h('line', { x1: 6.5, y1: 7, x2: 12.5, y2: 7, stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' }),
        h('line', { x1: 6.5, y1: 10.5, x2: 12.5, y2: 10.5, stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' }),
        h('line', { x1: 6.5, y1: 14, x2: 10.5, y2: 14, stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' }),
        h('path', {
          d: 'M13.5 17.2 L20 10.8 L21.6 12.4 L15.1 18.8 L13 19.3 Z',
          fill: 'currentColor',
          opacity: 0.85,
        }),
      );
    }

    // ── views ────────────────────────────────────────────────────────────

    // The 稿件 view is LAST on purpose: the number-key shortcut follows the
    // array order, and the six existing views must keep their keys.
    const VIEWS = [
      { id: 'rules', label: '速查', icon: 'reply' },
      { id: 'journals', label: '期刊', icon: 'book' },
      { id: 'check', label: '检查', icon: 'check' },
      { id: 'deai', label: '去AI', icon: 'deai' },
      { id: 'checklist', label: '清单', icon: 'mark' },
      { id: 'manual', label: '手册', icon: 'search' },
      { id: 'manuscript', label: '稿件', icon: 'doc' },
    ];

    const SEVERITIES = [
      { id: 'hard', label: '🔴 hard', tone: 'bad' },
      { id: 'soft', label: '🟡 soft', tone: 'warn' },
      { id: 'info', label: '🔵 info', tone: 'info' },
    ];

    const DOMAIN_LABELS = {
      writing: '写作 writing',
      figures: '图表 figures',
      submission: '投稿 submission',
    };

    const SEVERITY_TONE = { hard: 'bad', soft: 'warn', info: 'info' };
    const SEVERITY_ICON = { hard: '🔴', soft: '🟡', info: '🔵' };
    const SEVERITY_TEXT = { hard: '硬性', soft: '建议', info: '提示' };

    /** Section vocabulary — mirrors data/SCHEMA.md. Used for the auto-detect
     *  dropdown when the host has not published /api/meta yet. */
    const SECTIONS = [
      { id: 'title', label: '题目 title' },
      { id: 'abstract', label: '摘要 abstract' },
      { id: 'keywords', label: '关键词 keywords' },
      { id: 'introduction', label: '引言 introduction' },
      { id: 'literature', label: '文献综述 literature' },
      { id: 'methods', label: '方法 methods' },
      { id: 'geological-setting', label: '地质背景 geological-setting' },
      { id: 'systematic', label: '系统描述 systematic' },
      { id: 'results', label: '结果 results' },
      { id: 'discussion', label: '讨论 discussion' },
      { id: 'conclusion', label: '结论 conclusion' },
      { id: 'acknowledgements', label: '致谢 acknowledgements' },
      { id: 'references', label: '参考文献 references' },
      { id: 'figures', label: '图件 figures' },
      { id: 'tables', label: '表格 tables' },
      { id: 'declarations', label: '声明 declarations' },
      { id: 'cover-letter', label: '投稿信 cover-letter' },
      { id: 'response', label: '审稿回复 response' },
      { id: 'review', label: '综述 review' },
    ];

    /** Ordered section probes — the first hit wins, so the more specific
     *  labels must come first. */
    const SECTION_PROBES = [
      { id: 'abstract', words: ['abstract', '摘要'] },
      { id: 'cover-letter', words: ['cover letter', '投稿信'] },
      { id: 'response', words: ['response to reviewer', 'response to reviewers', '审稿回复'] },
      { id: 'geological-setting', words: ['geological setting', 'geological background', '地质背景'] },
      { id: 'systematic', words: ['systematic palaeontology', 'systematic description', '系统描述', '系统分类'] },
      { id: 'acknowledgements', words: ['acknowledgement', 'acknowledgment', '致谢'] },
      { id: 'declarations', words: ['competing interest', 'declaration of', '利益冲突', '声明'] },
      { id: 'references', words: ['reference', '参考文献'] },
      { id: 'introduction', words: ['introduction', '引言', '绪论'] },
      { id: 'literature', words: ['literature review', 'related work', '文献综述'] },
      { id: 'methods', words: ['materials and methods', 'method', '方法'] },
      { id: 'results', words: ['result', '结果'] },
      { id: 'discussion', words: ['discussion', '讨论'] },
      { id: 'conclusion', words: ['conclusion', '结论'] },
      { id: 'figures', words: ['figure', '图件', '图注'] },
      { id: 'tables', words: ['table', '表格'] },
      { id: 'keywords', words: ['keyword', '关键词'] },
      { id: 'review', words: ['review', '综述'] },
    ];

    // ── the sidebar chip's live title ────────────────────────────────────
    // The chip title is rendered by the host OUTSIDE this component's tree,
    // so the panel's live state reaches it through a tiny module-level
    // channel — the same pattern the manual's live index uses.
    let chipNote = '';
    const chipListeners = new Set();

    function setChipNote(text) {
      if (text === chipNote) return;
      chipNote = text;
      for (const listener of chipListeners) listener();
    }

    /** The sidebar chip's title: 「论文助手」 plus the panel's live count. */
    function PanelTitle() {
      const [, bump] = useState(0);
      useEffect(() => {
        const listener = () => bump((value) => value + 1);
        chipListeners.add(listener);
        return () => {
          chipListeners.delete(listener);
        };
      }, []);
      return h(
        'span',
        { className: 'dapp-chip-title' },
        translate('type.label'),
        chipNote ? h('span', { className: 'dapp-chip-note' }, chipNote) : null,
      );
    }

    // ── the live skill index (手册) ──────────────────────────────────────

    /** Live skill index fetched from the host's same-origin route (zero
     *  tokens); falls back to the bundled copy when the route is absent. */
    let liveIndex = null;
    // 'bundled' | 'live' | 'failed' | 'unauthorized' | 'notImplemented'
    let liveIndexState = 'bundled';
    const indexListeners = new Set();

    /** Classifies a failed route call: an auth rejection, a missing route and
     *  an unreachable host are three different problems, and the panel says
     *  which one it hit. */
    const statusForError = (error) => {
      const status = error && error.status;
      if (status === 401 || status === 403) return 'unauthorized';
      if (status === 404 || status === 405) return 'notImplemented';
      return 'failed';
    };

    function refreshLiveIndex() {
      try {
        fetch('/dsh-academic-paper-polish/skill-index', {
          cache: 'no-store',
          credentials: 'same-origin',
        })
          .then((response) => {
            if (!response.ok) {
              const error = new Error(`HTTP ${response.status}`);
              error.status = response.status;
              throw error;
            }
            return response.json();
          })
          .then((index) => {
            if (Array.isArray(index) && index.length > 0) {
              liveIndex = index;
              liveIndexState = 'live';
              for (const listener of indexListeners) listener();
            }
          })
          .catch((error) => {
            liveIndexState = statusForError(error);
            for (const listener of indexListeners) listener();
          });
      } catch {
        liveIndexState = 'failed';
        for (const listener of indexListeners) listener();
      }
    }

    // ── helpers ─────────────────────────────────────────────────────────

    const STORE_PREFIX = 'dsh-academic-paper-polish.';

    function readStore(key, fallback) {
      try {
        const raw = window.localStorage.getItem(STORE_PREFIX + key);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        return parsed === null || parsed === undefined ? fallback : parsed;
      } catch {
        return fallback;
      }
    }

    function writeStore(key, value) {
      try {
        window.localStorage.setItem(STORE_PREFIX + key, JSON.stringify(value));
      } catch {
        /* storage unavailable */
      }
    }

    async function copyToClipboard(text) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch {
        /* fall through to the legacy path */
      }
      try {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(area);
        return ok;
      } catch {
        return false;
      }
    }

    /** Query-string builder — empty values are dropped so the host route
     *  never sees `?section=`. */
    function qs(params) {
      const parts = [];
      for (const key of Object.keys(params)) {
        const value = params[key];
        if (value === undefined || value === null || value === '') continue;
        parts.push(`${key}=${encodeURIComponent(String(value))}`);
      }
      return parts.length > 0 ? `?${parts.join('&')}` : '';
    }

    /** Reads a JSON body and turns a non-2xx answer into a typed error. */
    async function readJson(response) {
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }
      return response.json();
    }

    /** First defined number among the candidates. */
    function num(...values) {
      for (const value of values) {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
      }
      return 0;
    }

    /** First non-empty string (or finite number) among the candidates. */
    function str(...values) {
      for (const value of values) {
        if (typeof value === 'string' && value.trim().length > 0) return value;
        if (typeof value === 'number' && Number.isFinite(value)) return String(value);
      }
      return '';
    }

    /** Prose helper: the first non-empty candidate, with the markdown
     *  emphasis the rule database carries removed. */
    function prose(...values) {
      return plain(str(...values));
    }

    /** Strips the markdown emphasis the rule database carries (`**bold**`,
     *  `` `code` ``) so a card reads as prose. */
    function plain(text) {
      return String(text || '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/(^|\s)\*([^*\n]+)\*/g, '$1$2');
    }

    /** Detects the section of a pasted paragraph from its heading. */
    function detectSection(text) {
      const head = String(text || '')
        .split(/\n/)
        .slice(0, 8)
        .join('\n')
        .toLowerCase();
      for (const probe of SECTION_PROBES) {
        for (const word of probe.words) {
          if (head.includes(word.toLowerCase())) return probe.id;
        }
      }
      return '';
    }

    /** `references/checklist.md:30` — the rule's provenance. */
    function sourceLabel(source) {
      if (!source) return '';
      if (typeof source === 'string') return source;
      const file = str(source.file, source.path, source.ref);
      if (!file) return '';
      const line = source.line || source.lineNo || source.row;
      return line ? `${file}:${line}` : file;
    }

    // ── the manuscript view ─────────────────────────────────────────────

    /** The formats the host can LIST but not read: the route answers
     *  `415 unsupported-format` for them. */
    const UNSUPPORTED_EXTENSIONS = Object.freeze({
      '.pdf': 'PDF 需要先用 office 技能转成 docx',
      '.doc': '旧版 .doc 需要先用 office 技能转成 docx',
      '.odt': '.odt 需要先用 office 技能转成 docx',
    });

    /** What the host's scanner looks for — the empty state says it out loud. */
    const SCAN_HINTS = Object.freeze([
      '扩展名 .docx .tex .md .rtf .txt .pdf .odt .doc',
      '文件名含 paper / manuscript / article / draft / thesis / 论文 / 稿件 / 初稿',
      '正文含 Abstract / 摘要 / Introduction / 引言 / Methods / 方法 / Results / 结果 / Discussion / 讨论 / Conclusion / 结论 标题',
      '最近 90 天内修改过的文件得分更高',
    ]);

    /** The section label of a report entry — the title always wins over the
     *  raw vocabulary key ('document' = a file without recognisable headings). */
    function sectionTitle(entry) {
      return str(entry && entry.title, entry && entry.section, '段落');
    }

    /** The host's own Modal primitive is a Harness package, and the client
     *  half may not load one. Its BEHAVIOUR is copied instead (see the Modal
     *  component): `react-dom` is a platform seed word, so the portal itself
     *  is available. The require is lazy: a panel that never opens a dialog
     *  must not pull the module in. */
    let reactDomModule = null;
    function reactDom() {
      if (reactDomModule === null) {
        try {
          reactDomModule = require('react-dom');
        } catch {
          reactDomModule = false;
        }
      }
      return reactDomModule || null;
    }

    /** How many dialogs are open — the panel's global shortcuts stand down
     *  while a dialog owns the keyboard. */
    let modalDepth = 0;

    /** The working directory of the session the panel lives in.
     *
     *  The slot hands the panel `sessionId` and the host's own `useSessions`
     *  hook; the hook is the ONLY sanctioned way to read a session's folder
     *  (the Harness' Files tab does exactly this). A panel without a session
     *  (the offline preview) gets `undefined` instead of a guess. */
    function useSessionCwd(props) {
      const sessionId = typeof props.sessionId === 'string' ? props.sessionId : '';
      const useSessions = props.useSessions;
      const selector = useMemo(
        () => (sessions) => {
          if (!sessionId) return undefined;
          const byId = sessions && sessions.byId;
          if (!byId) return undefined;
          const entry = byId[sessionId];
          return entry ? entry.cwd : undefined;
        },
        [sessionId],
      );
      // The hook slot must be filled on EVERY render, in the same order: the
      // fallback keeps the hook count stable when the host offers no hook.
      const [fallback] = useState(undefined);
      return typeof useSessions === 'function' ? useSessions(selector) : fallback;
    }

    // ── reactive helpers ────────────────────────────────────────────────

    /** Loads a resource and exposes the panel's five states:
     *  'loading' | 'ok' | 'unauthorized' | 'notImplemented' | 'failed'. */
    function useResource(loader, deps) {
      const [state, setState] = useState({ status: 'loading', data: null, error: null });
      useEffect(() => {
        let cancelled = false;
        setState((prev) => (prev.status === 'loading' ? prev : { status: 'loading', data: null, error: null }));
        Promise.resolve()
          .then(loader)
          .then((data) => {
            if (!cancelled) setState({ status: 'ok', data, error: null });
          })
          .catch((error) => {
            if (!cancelled) setState({ status: statusForError(error), data: null, error });
          });
        return () => {
          cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, deps);
      return state;
    }

    /** Debounces a value — every search box settles before it hits the host. */
    function useDebounced(value, delay) {
      const [debounced, setDebounced] = useState(value);
      useEffect(() => {
        const timer = window.setTimeout(() => setDebounced(value), delay);
        return () => window.clearTimeout(timer);
      }, [value, delay]);
      return debounced;
    }

    // ── panel chrome ────────────────────────────────────────────────────

    function SeverityBadge(props) {
      const severity = String(props.severity || 'info');
      const tone = SEVERITY_TONE[severity] || 'info';
      return h(
        'span',
        {
          className: 'dapp-sev',
          'data-tone': tone,
          title: `${SEVERITY_TEXT[severity] || severity} · ${severity}`,
        },
        `${SEVERITY_ICON[severity] || '🔵'} ${severity}`,
      );
    }

    /** The three failure modes the panel can hit, spelled out so the user
     *  knows whether to log in, to wait, or to update the plugin. */
    function StateNotice(props) {
      const status = props.status;
      const map = {
        unauthorized: {
          tone: 'bad',
          icon: 'close',
          title: '未授权：宿主拒绝了请求',
          body: '面板请求缺少登录态（HTTP 401）。请在 DeepSeek Harness 里重新登录后刷新。',
        },
        notImplemented: {
          tone: 'warn',
          icon: 'grid',
          title: '宿主尚未提供该接口',
          body: '这个能力（HTTP 404）还没有在宿主侧上线：面板不会伪造内容，等接口上线后自动可用。',
        },
        failed: {
          tone: 'warn',
          icon: 'close',
          title: '宿主路由不可达',
          body: '请求没有拿到响应。宿主进程可能正在重启，或该插件没有启用。',
        },
      };
      const info = map[status] || map.failed;
      return h(
        'div',
        { className: 'dapp-state', 'data-tone': info.tone },
        h(
          'div',
          { className: 'dapp-state-head' },
          h('span', { className: 'dapp-state-mark' }, h(Icon, { name: info.icon, size: 15 })),
          h('span', { className: 'dapp-state-title' }, info.title),
        ),
        h('div', { className: 'dapp-state-body' }, info.body),
        props.detail ? h('div', { className: 'dapp-rid' }, props.detail) : null,
      );
    }

    /** A quiet section label — the six views share one rhythm. */
    function SectionHead(props) {
      return h(
        'div',
        { className: 'dapp-sechead' },
        h('span', { className: 'dapp-sechead-label' }, props.label),
        props.meta ? h('span', { className: 'dapp-sechead-meta' }, props.meta) : null,
      );
    }

    /** The empty state says what to do next — never a bare 「暂无数据」. */
    function EmptyState(props) {
      return h(
        'div',
        { className: 'dapp-empty' },
        h('span', { className: 'dapp-empty-mark' }, h(Icon, { name: props.icon || 'search', size: 15 })),
        h('span', { className: 'dapp-empty-title' }, props.title),
        props.hint ? h('span', { className: 'dapp-empty-hint' }, props.hint) : null,
      );
    }

    /** Loading placeholder — the host's skeleton bars on the real line height. */
    function Skeleton(props) {
      const widths = ['76%', '92%', '58%'];
      return h(
        'div',
        { className: 'dapp-skel', role: 'status', 'aria-label': props.label || '加载中' },
        widths.slice(0, props.rows || 3).map((width, index) =>
          h(
            'div',
            { key: index, className: 'dapp-skel-text' },
            h('span', { className: 'dapp-skel-bar', style: { width } }),
          ),
        ),
      );
    }

    function ProgressRing(props) {
      const ratio = Math.max(0, Math.min(1, props.ratio || 0));
      const radius = 11;
      const circumference = 2 * Math.PI * radius;
      return h(
        'div',
        { className: 'dapp-ringp' },
        h(
          'svg',
          { width: 28, height: 28, viewBox: '0 0 28 28', 'aria-hidden': true },
          h('circle', {
            cx: 14,
            cy: 14,
            r: radius,
            fill: 'none',
            stroke: 'var(--dapp-line-strong)',
            strokeWidth: 3,
          }),
          h('circle', {
            cx: 14,
            cy: 14,
            r: radius,
            fill: 'none',
            stroke: 'var(--dapp-accent)',
            strokeWidth: 3,
            strokeLinecap: 'round',
            strokeDasharray: circumference,
            strokeDashoffset: circumference * (1 - ratio),
            transform: 'rotate(-90 14 14)',
          }),
        ),
        h('span', { className: 'dapp-ringp-label' }, props.label),
      );
    }

    // ── the modal layer ─────────────────────────────────────────────────
    //
    // The Harness ships a `Modal` primitive, but it lives in a Harness client
    // package — and the client half of a plugin may not load one. Its
    // BEHAVIOUR is copied instead (the reference implementation is kept in
    // preview/host-reference/Modal.tsx + useModalLayer.ts):
    //
    //   · the dialog is portaled to `document.body`,
    //   · the focus is trapped inside it while it is open,
    //   · Escape closes it (the topmost layer owns the key),
    //   · the focus returns to the control that opened it,
    //   · a click on the backdrop closes it,
    //   · `role="dialog"` + `aria-modal="true"` + an accessible name,
    //   · the body scroll is locked while it is open.

    const FOCUSABLE =
      'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]';

    /** Give the open dialog the keyboard: Escape closes it, Tab stays in it,
     *  and the focus goes back to the trigger when it closes.
     *
     *  `restoreRef` is the control that opened the dialog. It is not always
     *  the element that had the focus: a button that is disabled while the
     *  panel works loses the focus, so the dialog restores to the trigger
     *  itself instead of to whatever the browser picked. */
    function useModalLayer(dialogRef, open, onClose, restoreRef) {
      const closeRef = useRef(onClose);
      const pendingRestore = useRef(null);
      closeRef.current = onClose;
      useLayoutEffect(() => {
        const element = dialogRef.current;
        const pending = pendingRestore.current;
        pendingRestore.current = undefined;
        // The focus belongs to the control that opened the dialog again — but
        // only while it is still inside the dialog, so a deliberate focus
        // change by the panel is not undone.
        if (
          !open &&
          pending &&
          pending.isConnected &&
          element &&
          element.contains(element.ownerDocument.activeElement) &&
          !pending.closest('[inert], [hidden]')
        ) {
          try {
            pending.focus({ preventScroll: true });
          } catch {
            /* the trigger cannot take the focus */
          }
        }
        if (!open || !element) return undefined;
        const doc = element.ownerDocument;
        const trigger = restoreRef && restoreRef.current;
        const previous =
          trigger instanceof HTMLElement && trigger.isConnected ? trigger : doc.activeElement;
        const initial =
          element.querySelector('[data-modal-autofocus]') || element.querySelector(FOCUSABLE) || element;
        if (!element.contains(doc.activeElement)) {
          try {
            initial.focus({ preventScroll: true });
          } catch {
            /* the element cannot take the focus */
          }
        }
        const onKeyDown = (event) => {
          if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return;
          if (event.key === 'Escape' && !event.shiftKey) {
            event.preventDefault();
            if (!event.repeat) closeRef.current();
            return;
          }
          if (event.key !== 'Tab') return;
          const items = [...element.querySelectorAll(FOCUSABLE)].filter(
            (item) => !item.closest('[inert], [hidden]'),
          );
          if (items.length === 0) {
            event.preventDefault();
            element.focus();
            return;
          }
          const first = items[0];
          const last = items[items.length - 1];
          const active = doc.activeElement;
          if (event.shiftKey) {
            if (active === first || !element.contains(active)) {
              event.preventDefault();
              last.focus();
            }
          } else if (active === last || !element.contains(active)) {
            event.preventDefault();
            first.focus();
          }
        };
        doc.addEventListener('keydown', onKeyDown);
        return () => {
          doc.removeEventListener('keydown', onKeyDown);
          // The focus returns to the control that opened the dialog. This
          // happens while the dialog is being torn down, so the browser never
          // drops the focus to the document body.
          const target = previous instanceof HTMLElement && previous.isConnected ? previous : null;
          if (target) {
            pendingRestore.current = target;
            try {
              target.focus({ preventScroll: true });
            } catch {
              /* the trigger is gone */
            }
          }
        };
      }, [dialogRef, open]);
    }

    function Modal(props) {
      const dialogRef = useRef(null);
      useModalLayer(dialogRef, props.open, props.onClose, props.restoreRef);

      // The panel's own shortcuts stand down while a dialog owns the keys.
      useEffect(() => {
        if (!props.open) return undefined;
        modalDepth += 1;
        return () => {
          modalDepth = Math.max(0, modalDepth - 1);
        };
      }, [props.open]);

      // The body must not scroll behind the dialog.
      useEffect(() => {
        if (!props.open) return undefined;
        const body = document.body;
        if (!body) return undefined;
        const previous = body.style.overflow;
        body.style.overflow = 'hidden';
        return () => {
          body.style.overflow = previous;
        };
      }, [props.open]);

      if (!props.open) return null;

      const tree = h(
        'div',
        { className: 'dapp-modal-host', role: 'presentation' },
        h('div', { className: 'dapp-modal-mask', 'aria-hidden': 'true', onClick: props.onClose }),
        h(
          'div',
          {
            ref: dialogRef,
            tabIndex: -1,
            className: 'dapp-modal-dialog',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': props.title,
            onKeyDown: props.onKeyDown,
          },
          h(
            'div',
            { className: 'dapp-modal-head' },
            h('h2', { className: 'dapp-modal-title' }, props.title),
            h(
              'button',
              {
                type: 'button',
                className: 'dapp-modal-close',
                'aria-label': '关闭',
                onClick: props.onClose,
              },
              h(Icon, { name: 'close', size: 13 }),
            ),
          ),
          props.description ? h('p', { className: 'dapp-modal-desc' }, props.description) : null,
          h('div', { className: 'dapp-modal-body' }, props.children),
          props.footer ? h('div', { className: 'dapp-modal-foot' }, props.footer) : null,
        ),
      );

      const dom = reactDom();
      if (dom && typeof dom.createPortal === 'function' && typeof document !== 'undefined' && document.body) {
        return dom.createPortal(tree, document.body);
      }
      return tree;
    }

    /** `3.0 KB` — the size of a candidate file. */
    function formatBytes(bytes) {
      const value = Number(bytes);
      if (!Number.isFinite(value) || value <= 0) return '0 B';
      if (value < 1024) return `${value} B`;
      if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
      return `${(value / (1024 * 1024)).toFixed(1)} MB`;
    }

    /** `2026-11-06 09:12` — the modification time of a candidate file. */
    function formatStamp(value) {
      if (!value) return '';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      const pad = (number) => String(number).padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    /** Why a candidate cannot be analysed (the host answers 415 for it). */
    function unsupportedReason(file) {
      const ext = String((file && file.ext) || '').toLowerCase();
      if (!ext) return '';
      return UNSUPPORTED_EXTENSIONS[ext] || '';
    }

    /** The file chooser of the 稿件 view: the host found several equally
     *  likely manuscripts, so the human picks one. */
    function FilePicker(props) {
      const files = Array.isArray(props.files) ? props.files : [];
      const index = props.index;
      const onKeyDown = (event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          const next =
            event.key === 'ArrowDown'
              ? Math.min(files.length - 1, index + 1)
              : Math.max(0, index - 1);
          props.onMove(next);
          return;
        }
        if (event.key === 'Home') {
          event.preventDefault();
          props.onMove(0);
          return;
        }
        if (event.key === 'End') {
          event.preventDefault();
          props.onMove(files.length - 1);
          return;
        }
        if (event.key !== 'Enter') return;
        const file = files[index];
        if (!file || unsupportedReason(file)) return;
        event.preventDefault();
        props.onPick(file);
      };
      return h(
        'div',
        { className: 'dapp-picker' },
        h(
          'div',
          {
            className: 'dapp-picker-list',
            role: 'listbox',
            'aria-label': '候选稿件',
            tabIndex: 0,
            'data-modal-autofocus': true,
            onKeyDown,
          },
          files.map((file, position) => {
            const blocked = unsupportedReason(file);
            const reasons = Array.isArray(file.reasons) ? file.reasons : [];
            return h(
              'button',
              {
                key: str(file.path, file.name, `f${position}`),
                type: 'button',
                role: 'option',
                'aria-selected': position === index ? 'true' : 'false',
                'aria-disabled': blocked ? 'true' : 'false',
                className: 'dapp-picker-row',
                'data-on': position === index ? 'true' : 'false',
                'data-blocked': blocked ? 'true' : 'false',
                disabled: Boolean(blocked),
                onClick: () => props.onPick(file),
                onMouseEnter: () => props.onMove(position),
              },
              h(
                'span',
                { className: 'dapp-picker-top' },
                h('span', { className: 'dapp-picker-name' }, str(file.name, file.path)),
                h('span', { className: 'dapp-picker-score', 'data-kind': str(file.kind) }, String(num(file.score))),
              ),
              h(
                'span',
                { className: 'dapp-picker-meta' },
                `${str(file.ext, '—')} · ${formatBytes(file.bytes)} · ${formatStamp(file.mtime) || '—'}`,
              ),
              reasons.length > 0
                ? h('span', { className: 'dapp-picker-reasons' }, reasons.join(' · '))
                : null,
              blocked
                ? h('span', { className: 'dapp-picker-blocked' }, `需先转换为 docx · ${blocked}`)
                : null,
            );
          }),
        ),
        h('div', { className: 'dapp-picker-hint' }, '↑/↓ 选择 · Enter 分析 · Esc 关闭'),
      );
    }

    // ── the shared finding components ───────────────────────────────────
    //
    // The 速查 / 检查 / 去AI / 稿件 views show the SAME findings, so they
    // share ONE set of components: a violation card looks the same wherever
    // it appears, and the 稿件 view never grows a parallel style.

    /** The verdict bar with the hard / soft / info counters. */
    function SummaryBar(props) {
      const count = num(props.count);
      const passed = Boolean(props.passed);
      const cell = (tone, value, label) =>
        h(
          'div',
          { className: 'dapp-summary-cell' },
          h('div', { className: 'dapp-summary-num', 'data-tone': tone }, String(value)),
          h('div', { className: 'dapp-summary-k' }, label),
        );
      return h(
        'div',
        { className: 'dapp-card' },
        h(
          'div',
          { className: 'dapp-verdictbar', 'data-state': passed ? 'ok' : 'bad' },
          h('span', { className: 'dapp-verdict-dot' }),
          h('span', { className: 'dapp-grow' }, passed ? '✓ 未发现违规' : `✗ 发现 ${count} 条违规`),
        ),
        h(
          'div',
          { className: 'dapp-summary' },
          cell('bad', num(props.hard), '🔴 hard'),
          cell('warn', num(props.soft), '🟡 soft'),
          cell('info', num(props.info), '🔵 info'),
        ),
      );
    }

    /** The text of one finding — what 「复制」 puts on the clipboard and what
     *  「发给会话」 hands to the agent. */
    function violationText(violation) {
      const lines = [];
      const id = str(violation.ruleId, violation.id);
      lines.push(id ? `【${id}】${prose(violation.title, violation.ruleTitle)}` : prose(violation.title));
      const expected = prose(violation.expected, violation.expect);
      const actual = prose(violation.actual, violation.observed);
      if (expected) lines.push(`期望：${expected}`);
      if (actual) lines.push(`实际：${actual}`);
      const matched = prose(violation.matched);
      if (matched) lines.push(`命中：${matched}`);
      const detail = prose(violation.detail, violation.message);
      if (detail) lines.push(detail);
      const fix = prose(violation.fix, violation.suggestion);
      if (fix) lines.push(`修复建议：${fix}`);
      const location = sourceLabel(violation.source);
      if (location) lines.push(`出处：${location}`);
      return lines.filter(Boolean).join('\n');
    }

    /** One violation: the severity badge, the rule, what was expected and
     *  what was found, the fix and the provenance. */
    function ViolationCard(props) {
      const violation = props.violation || {};
      const location = sourceLabel(violation.source);
      const statement = prose(violation.statement);
      const expected = prose(violation.expected, violation.expect);
      const actual = prose(violation.actual, violation.observed);
      const matched = prose(violation.matched);
      const detail = prose(violation.detail, violation.message);
      const fix = prose(violation.fix, violation.suggestion);
      return h(
        'div',
        { className: 'dapp-card' },
        h(
          'div',
          { className: 'dapp-card-title' },
          h(SeverityBadge, { severity: str(violation.severity, 'hard') }),
          h('span', { className: 'dapp-grow dapp-wrap' }, str(violation.title, violation.ruleTitle, violation.id)),
        ),
        h('div', { className: 'dapp-rid' }, str(violation.ruleId, violation.id)),
        statement ? h('div', { className: 'dapp-rule-body dapp-wrap' }, statement) : null,
        expected
          ? h('div', { className: 'dapp-rule-body dapp-wrap' }, h('b', null, '期望：'), expected)
          : null,
        actual ? h('div', { className: 'dapp-rule-body dapp-wrap' }, h('b', null, '实际：'), actual) : null,
        matched
          ? h(
              'div',
              { className: 'dapp-rule-body dapp-wrap' },
              h('b', null, '命中：'),
              h('span', { className: 'dapp-match' }, matched),
            )
          : null,
        detail ? h('div', { className: 'dapp-rule-body dapp-wrap' }, detail) : null,
        fix
          ? h('div', { className: 'dapp-fix dapp-wrap' }, h('b', null, '修复建议：'), fix)
          : null,
        location ? h('div', { className: 'dapp-src' }, location) : null,
        h(
          'div',
          { className: 'dapp-actions' },
          h(
            'button',
            {
              type: 'button',
              className: 'dapp-btn',
              onClick: () => props.onCopy(violationText(violation)),
            },
            h(Icon, { name: 'copy', size: 12 }),
            translate('panel.copy'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dapp-btn dapp-btn-primary',
              disabled: props.sending,
              onClick: () => props.onSend(violationText(violation)),
            },
            h(Icon, { name: 'send', size: 12 }),
            translate('panel.send'),
          ),
        ),
      );
    }

    /** The advice entries — the manual rules that never fail a manuscript but
     *  still deserve a mention. */
    function AdviceCard(props) {
      const advice = Array.isArray(props.advice) ? props.advice : [];
      return h(
        'div',
        { className: 'dapp-card' },
        h(SectionHead, { label: '建议 advice', meta: `${advice.length} 条` }),
        h(
          'ul',
          { className: 'dapp-list' },
          advice.map((item, index) =>
            typeof item === 'string'
              ? h('li', { key: index }, item)
              : h(
                  'li',
                  { key: index },
                  h(
                    'div',
                    { className: 'dapp-rule-body dapp-wrap' },
                    str(item.title, item.text, item.message),
                  ),
                  item.ruleId || item.id
                    ? h('div', { className: 'dapp-rid' }, str(item.ruleId, item.id))
                    : null,
                  item.statement
                    ? h('div', { className: 'dapp-rule-body dapp-wrap' }, prose(item.statement))
                    : null,
                  item.fix
                    ? h(
                        'div',
                        { className: 'dapp-fix dapp-wrap' },
                        h('b', null, '修复建议：'),
                        prose(item.fix, item.suggestion),
                      )
                    : null,
                  sourceLabel(item.source)
                    ? h('div', { className: 'dapp-src' }, sourceLabel(item.source))
                    : null,
                ),
          ),
        ),
      );
    }

    /** The de-AI score: 0–100, the higher the cleaner. */
    function ScoreCard(props) {
      const score = typeof props.score === 'number' ? props.score : null;
      const hits = Array.isArray(props.hits) ? props.hits : [];
      return h(
        'div',
        { className: 'dapp-card' },
        h(
          'div',
          { className: 'dapp-card-title' },
          h('span', { className: 'dapp-grow' }, props.label || '去 AI 化得分'),
          h(
            'span',
            {
              className: 'dapp-score-big',
              'data-tone': score === null ? 'info' : score >= 80 ? 'ok' : score >= 50 ? 'warn' : 'bad',
            },
            score === null ? '—' : String(score),
          ),
        ),
        h(
          'div',
          { className: 'dapp-meter' },
          h('span', {
            style: {
              width: `${Math.max(0, Math.min(100, score === null ? 0 : score))}%`,
              background:
                score === null
                  ? 'var(--dapp-faint)'
                  : score >= 80
                    ? 'var(--dapp-ok)'
                    : score >= 50
                      ? 'var(--dapp-warn)'
                      : 'var(--dapp-bad)',
            },
          }),
        ),
        h('div', { className: 'dapp-hintline' }, `命中 ${hits.length} 处 AI 句式（满分 100，越高越干净）`),
      );
    }

    /** One AI-style sentence the scanner found. */
    function HitCard(props) {
      const hit = props.hit || {};
      const suggestion = str(hit.suggestion, hit.replacement, hit.fix);
      return h(
        'div',
        { className: 'dapp-card' },
        h(
          'div',
          { className: 'dapp-card-title' },
          h(SeverityBadge, { severity: str(hit.severity, 'soft') }),
          h('span', { className: 'dapp-grow dapp-wrap' }, prose(hit.category, hit.type, 'AI 句式')),
        ),
        h('div', { className: 'dapp-match' }, prose(hit.matched, hit.match, hit.text, hit.zh, hit.en, hit.pattern)),
        typeof hit.count === 'number' && hit.count > 1
          ? h('div', { className: 'dapp-rid' }, `出现 ${hit.count} 次`)
          : null,
        hit.why ? h('div', { className: 'dapp-rule-body dapp-wrap' }, `为什么：${prose(hit.why, hit.reason)}`) : null,
        suggestion
          ? h(
              'div',
              { className: 'dapp-fix dapp-wrap' },
              h('b', null, '建议替换：'),
              prose(suggestion),
            )
          : null,
        h(
          'div',
          { className: 'dapp-actions' },
          h(
            'button',
            {
              type: 'button',
              className: 'dapp-btn',
              onClick: () => props.onCopy(suggestion),
            },
            h(Icon, { name: 'copy', size: 12 }),
            translate('panel.copy'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dapp-btn dapp-btn-primary',
              disabled: props.sending,
              onClick: () => props.onSend(props.sendText(hit)),
            },
            h(Icon, { name: 'send', size: 12 }),
            translate('panel.send'),
          ),
        ),
      );
    }

    // ── the panel ───────────────────────────────────────────────────────

    function Panel(props) {
      const t = translate;

      // The session this panel lives in. The slot hands the id over; the
      // panel never guesses one — every session-scoped call carries it, so a
      // message can never land in a neighbouring conversation.
      const sessionId = typeof props.sessionId === 'string' ? props.sessionId : '';
      const sessionCwd = useSessionCwd(props);

      const [expanded, setExpanded] = useState(true);
      const [viewRaw, setView] = useState(readStore('view', 'rules'));
      const view = VIEWS.some((item) => item.id === viewRaw) ? viewRaw : 'rules';

      // 速查
      const [rulesQuery, setRulesQuery] = useState('');
      const [rulesSection, setRulesSection] = useState('');
      const [rulesSeverity, setRulesSeverity] = useState('');
      const [rulesDomain, setRulesDomain] = useState('');

      // 期刊
      const [journalsQuery, setJournalsQuery] = useState('');
      const [journalField, setJournalField] = useState('');
      const [journalOpenOnly, setJournalOpenOnly] = useState(false);
      const [journalMaxApc, setJournalMaxApc] = useState('');
      const [journalSort, setJournalSort] = useState({ key: 'impactFactor', dir: -1 });
      const [openJournal, setOpenJournal] = useState('');

      // 检查
      const [checkText, setCheckText] = useState('');
      const [checkSection, setCheckSection] = useState('');
      const [checkTouched, setCheckTouched] = useState(false);

      // 去 AI
      const [deaiText, setDeaiText] = useState('');
      const [sentencesQuery, setSentencesQuery] = useState('');

      // 清单
      const [stageId, setStageId] = useState('');
      const [collapsed, setCollapsed] = useState({});

      // 稿件 — the manuscript of THIS session.
      const [scanState, setScanState] = useState({ status: 'idle', data: null, error: null });
      const [scanPending, setScanPending] = useState(false);
      const [analyzeState, setAnalyzeState] = useState({ status: 'idle', data: null, error: null });
      const [analyzePending, setAnalyzePending] = useState(false);
      const [pickerOpen, setPickerOpen] = useState(false);
      const [pickerIndex, setPickerIndex] = useState(0);
      const [activeSection, setActiveSection] = useState('');

      // shared
      const [journalKey, setJournalKey] = useState(readStore('journal', ''));
      const [checked, setChecked] = useState(readStore('checklist', {}));
      const [toast, setToast] = useState(null);
      const [sending, setSending] = useState(false);

      const searchRef = useRef(null);
      const toastTimer = useRef(null);
      const debounceTimer = useRef(null);
      const tableRef = useRef(null);
      const [tableScrolls, setTableScrolls] = useState(false);
      // The control that opens the file picker — the dialog gives the focus
      // back to it when it closes.
      const scanTriggerRef = useRef(null);

      useEffect(
        () => () => {
          if (toastTimer.current) window.clearTimeout(toastTimer.current);
          if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
        },
        [],
      );

      useEffect(() => writeStore('view', view), [view]);
      useEffect(() => writeStore('journal', journalKey), [journalKey]);
      useEffect(() => writeStore('checklist', checked), [checked]);

      // ── toast ─────────────────────────────────────────────────────────
      const flash = (text, kind) => {
        setToast({ text, kind: kind || 'info' });
        if (toastTimer.current) window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(null), 2600);
      };

      // ── resources ─────────────────────────────────────────────────────
      const metaState = useResource(
        () =>
          fetch('/dsh-academic-paper-polish/api/meta', { cache: 'no-store', credentials: 'same-origin' })
            .then(readJson)
            .catch((error) => {
              throw error;
            }),
        [],
      );

      const rulesQueryDebounced = useDebounced(rulesQuery, 250);
      const rulesState = useResource(
        () =>
          fetch(
            '/dsh-academic-paper-polish/api/rules' +
              qs({
                query: rulesQueryDebounced.trim(),
                section: rulesSection,
                severity: rulesSeverity,
              }),
            { cache: 'no-store', credentials: 'same-origin' },
          )
            .then(readJson)
            .catch((error) => {
              throw error;
            }),
        [rulesQueryDebounced, rulesSection, rulesSeverity],
      );

      const journalsQueryDebounced = useDebounced(journalsQuery, 250);
      const journalsState = useResource(
        () =>
          fetch(
            '/dsh-academic-paper-polish/api/journals' +
              qs({
                query: journalsQueryDebounced.trim(),
                field: journalField,
                openAccess: journalOpenOnly ? 'true' : '',
                maxApc: journalMaxApc,
              }),
            { cache: 'no-store', credentials: 'same-origin' },
          )
            .then(readJson)
            .catch((error) => {
              throw error;
            }),
        [journalsQueryDebounced, journalField, journalOpenOnly, journalMaxApc],
      );

      // The unfiltered list feeds the 领域 chips and the 目标期刊 selector.
      const journalsAllState = useResource(
        () =>
          fetch('/dsh-academic-paper-polish/api/journals', { cache: 'no-store', credentials: 'same-origin' })
            .then(readJson)
            .catch((error) => {
              throw error;
            }),
        [],
      );

      const checklistState = useResource(
        () =>
          fetch('/dsh-academic-paper-polish/api/checklists', { cache: 'no-store', credentials: 'same-origin' })
            .then(readJson)
            .catch((error) => {
              throw error;
            }),
        [],
      );

      const sentencesQueryDebounced = useDebounced(sentencesQuery, 250);
      const sentencesState = useResource(
        () => {
          // The sentence bank only matters for the 去AI view — do not spend a
          // request on it while another tab is open.
          if (view !== 'deai') return Promise.resolve({ patterns: [] });
          return fetch('/dsh-academic-paper-polish/api/sentences' + qs({ query: sentencesQueryDebounced.trim() }), {
            cache: 'no-store',
            credentials: 'same-origin',
          })
            .then(readJson)
            .catch((error) => {
              throw error;
            });
        },
        [sentencesQueryDebounced, view === 'deai'],
      );

      // 手册 — the remote full-text search over the skill files.
      const [indexRev, setIndexRev] = useState(0);
      const [manualQuery, setManualQuery] = useState('');
      const [remoteHits, setRemoteHits] = useState(null);
      const [remotePending, setRemotePending] = useState(false);

      useEffect(() => {
        const listener = () => setIndexRev((rev) => rev + 1);
        indexListeners.add(listener);
        return () => {
          indexListeners.delete(listener);
        };
      }, []);

      useEffect(() => {
        const needle = manualQuery.trim();
        if (!needle || liveIndexState !== 'live') {
          setRemoteHits(null);
          setRemotePending(false);
          return undefined;
        }
        let cancelled = false;
        const timer = window.setTimeout(() => {
          setRemotePending(true);
          fetch(`/dsh-academic-paper-polish/skill-index?q=${encodeURIComponent(needle)}`, {
            cache: 'no-store',
            credentials: 'same-origin',
          })
            .then(readJson)
            .then((list) => {
              if (cancelled) return;
              setRemoteHits(Array.isArray(list) ? list : []);
              setRemotePending(false);
            })
            .catch(() => {
              if (cancelled) return;
              setRemoteHits(null);
              setRemotePending(false);
            });
        }, 250);
        return () => {
          cancelled = true;
          window.clearTimeout(timer);
        };
      }, [manualQuery, liveIndexState, indexRev]);

      const manualResults = useMemo(() => {
        const needle = manualQuery.trim().toLowerCase();
        // No query means "show the corpus": the manual browser must list the
        // files, not sit empty until the user types.
        if (!needle) return (liveIndex || SKILL_INDEX).slice(0, 40);
        if (remoteHits) return remoteHits.slice(0, 40);
        const index = liveIndex || SKILL_INDEX;
        return index
          .filter((entry) => {
            const haystack = [
              entry.title,
              entry.subtitle,
              entry.path,
              (entry.keywords || []).join(' '),
              (entry.headings || []).join(' '),
            ]
              .join(' ')
              .toLowerCase();
            return haystack.includes(needle);
          })
          .slice(0, 40);
      }, [manualQuery, indexRev, remoteHits]);

      // ── derived data ──────────────────────────────────────────────────

      const meta = metaState.data || {};
      const sectionOptions = useMemo(() => {
        const fromHost = Array.isArray(meta.sections) ? meta.sections : [];
        if (fromHost.length > 0) {
          return fromHost.map((id) => {
            const known = SECTIONS.find((item) => item.id === id);
            return known ? known : { id, label: id };
          });
        }
        return SECTIONS;
      }, [meta.sections]);

      const domainOptions = useMemo(() => {
        const fromHost = Array.isArray(meta.domains) ? meta.domains : [];
        if (fromHost.length > 0) {
          return fromHost.map((id) => ({ id, label: DOMAIN_LABELS[id] || id }));
        }
        return Object.keys(DOMAIN_LABELS).map((id) => ({ id, label: DOMAIN_LABELS[id] }));
      }, [meta.domains]);

      const rules = useMemo(() => {
        const payload = rulesState.data;
        if (!payload) return [];
        const list = Array.isArray(payload.rules) ? payload.rules : [];
        // The host filters by query / section / severity; the category chip is
        // applied here so the panel never sends a parameter the route ignores.
        if (!rulesDomain) return list;
        return list.filter((rule) => str(rule.domain) === rulesDomain);
      }, [rulesState.data, rulesDomain]);

      const journalsAll = useMemo(() => {
        const payload = journalsAllState.data;
        if (!payload) return [];
        return Array.isArray(payload.journals) ? payload.journals : [];
      }, [journalsAllState.data]);

      const journals = useMemo(() => {
        const payload = journalsState.data;
        if (!payload) return [];
        const list = Array.isArray(payload.journals) ? payload.journals : [];
        const key = journalSort.key;
        const dir = journalSort.dir;
        return [...list].sort((a, b) => {
          const left = sortValue(a, key);
          const right = sortValue(b, key);
          if (left === right) return 0;
          return (left < right ? -1 : 1) * dir;
        });
      }, [journalsState.data, journalSort]);

      const fieldOptions = useMemo(() => {
        const fields = new Set();
        for (const journal of journalsAll) {
          for (const field of journal.field || []) fields.add(field);
        }
        return [...fields];
      }, [journalsAll]);

      // The journal table scrolls sideways only when the sidebar is too
      // narrow for it — the hint follows the real overflow, not a guess.
      useEffect(() => {
        const node = tableRef.current;
        if (!node || typeof ResizeObserver === 'undefined') return undefined;
        const update = () => setTableScrolls(node.scrollWidth > node.clientWidth + 1);
        update();
        const observer = new ResizeObserver(update);
        observer.observe(node);
        return () => observer.disconnect();
      }, [view, journals.length]);

      const stages = useMemo(() => {
        const payload = checklistState.data;
        if (!payload) return [];
        return Array.isArray(payload.stages) ? payload.stages : [];
      }, [checklistState.data]);

      const visibleStages = useMemo(
        () => (stageId ? stages.filter((stage) => stage.id === stageId) : stages),
        [stages, stageId],
      );

      const checklistItems = useMemo(() => {
        const items = [];
        for (const stage of stages) {
          for (const item of stage.items || []) {
            items.push({ ...item, stageId: stage.id, stageTitle: stage.title });
          }
        }
        return items;
      }, [stages]);

      const doneCount = useMemo(
        () => checklistItems.filter((item) => checked[`${item.stageId}:${item.id}`]).length,
        [checklistItems, checked],
      );

      // The sidebar chip shows how much of the submission checklist is still
      // open — the count lives outside this tree, so it goes through the
      // module-level channel.
      useEffect(() => {
        if (checklistState.status !== 'ok') return;
        const pending = checklistItems.length - doneCount;
        setChipNote(pending > 0 ? `${pending} 项待办` : '');
      }, [checklistState.status, checklistItems.length, doneCount]);

      const detected = useMemo(() => detectSection(checkText), [checkText]);
      useEffect(() => {
        if (!checkTouched) setCheckSection(detected);
      }, [detected, checkTouched]);

      const targetJournal = useMemo(
        () => journalsAll.find((journal) => journal.key === journalKey) || null,
        [journalsAll, journalKey],
      );

      // ── actions ───────────────────────────────────────────────────────

      /** The conversation package exposes `inputActions` as a standard prop.
       *  When the slot hands it over, the text lands in the composer — the
       *  client-side half of 「发送到会话」. */
      const insertIntoComposer = (text) => {
        try {
          const actions = props.inputActions;
          if (!actions || typeof actions.insertText !== 'function') return false;
          const span = typeof actions.captureInsertion === 'function' ? actions.captureInsertion() : undefined;
          return Boolean(actions.insertText(text, span));
        } catch {
          return false;
        }
      };

      /** Hand a text to THIS session.
       *
       *  The host's /api/send falls back to "the most recently active agent"
       *  when the body carries no session id — that can post into a
       *  neighbouring conversation. The panel therefore ALWAYS sends the id
       *  of the session it lives in, and refuses to send at all when it has
       *  none (the composer is the only honest target left in that case). */
      const sendToSession = async (text) => {
        if (sending) return false;
        if (!sessionId) {
          const inserted = insertIntoComposer(text);
          if (inserted) {
            flash('已插入输入框（当前面板未绑定会话）', 'ok');
            return true;
          }
          flash(t('panel.sendNoSession'), 'warn');
          return false;
        }
        setSending(true);
        try {
          const response = await fetch('/dsh-academic-paper-polish/api/send', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text, sessionId }),
          });
          await readJson(response);
          setSending(false);
          // The host queues the text as a plugin-authored message (its source
          // marker is not "user"), so the harness renders it as an inject row.
          flash(t('panel.sent'), 'ok');
          return true;
        } catch (error) {
          setSending(false);
          const status = statusForError(error);
          if (status === 'unauthorized') {
            flash(t('panel.sendUnauthorized'), 'bad');
            return false;
          }
          if (status === 'notImplemented') {
            // The host has no conversation-injection route (yet). Fall back to
            // the composer standard prop, and only then give up.
            const inserted = insertIntoComposer(text);
            if (inserted) {
              flash('已插入输入框（宿主未提供 /api/send）', 'ok');
              return true;
            }
            flash(t('panel.sendMissing'), 'warn');
            return false;
          }
          const code = error && error.status;
          if (code === 409) {
            flash(t('panel.sendNoSession'), 'warn');
            return false;
          }
          if (code === 503) {
            flash(t('panel.sendNoChannel'), 'warn');
            return false;
          }
          flash(`${t('panel.sendFailed')}：${(error && error.message) || '未知错误'}`, 'bad');
          return false;
        }
      };

      const copyText = async (text) => {
        const ok = await copyToClipboard(text);
        flash(ok ? t('panel.copied') : '复制失败', ok ? 'ok' : 'bad');
      };

      // ── the manuscript of this session ────────────────────────────────

      /** The candidates the host found in the session's working directory. */
      const scanFiles = useMemo(() => {
        const payload = scanState.data;
        if (!payload) return [];
        return Array.isArray(payload.files) ? payload.files : [];
      }, [scanState.data]);

      /** The working directory the HOST resolved for the session. */
      const hostCwd = str(scanState.data && scanState.data.cwd);

      /** Analyse one manuscript of this session. */
      const runAnalyze = async (path) => {
        const target = str(path);
        if (!target) return false;
        if (!sessionId) {
          flash('未绑定会话：无法分析', 'warn');
          return false;
        }
        setAnalyzePending(true);
        setAnalyzeState({ status: 'loading', data: null, error: null });
        try {
          const response = await fetch('/dsh-academic-paper-polish/api/analyze', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              path: target,
              sessionId,
              journal: journalKey || undefined,
            }),
          });
          const data = await readJson(response);
          setAnalyzeState({ status: 'ok', data, error: null });
          setActiveSection('');
          return true;
        } catch (error) {
          setAnalyzeState({ status: statusForError(error), data: null, error });
          return false;
        } finally {
          setAnalyzePending(false);
        }
      };

      /** Scan the session's folder and pick the manuscript.
       *
       *  The host applies the "one clear winner" rule itself: `best` is the
       *  auto-selected file (score ≥ 140 and ≥ 1.6× the runner-up). When it
       *  stays empty the human chooses — the picker opens. */
      const scanSession = async () => {
        if (!sessionId) {
          flash('未绑定会话：无法扫描', 'warn');
          return;
        }
        setScanPending(true);
        setScanState({ status: 'loading', data: null, error: null });
        try {
          const response = await fetch(
            '/dsh-academic-paper-polish/api/session/files' + qs({ sessionId }),
            { cache: 'no-store', credentials: 'same-origin' },
          );
          const data = await readJson(response);
          setScanState({ status: 'ok', data, error: null });
          // The scan is over — the analysis that may follow is its own work.
          setScanPending(false);
          const files = Array.isArray(data.files) ? data.files : [];
          const best = typeof data.best === 'string' ? data.best : '';
          if (best) {
            await runAnalyze(best);
            return;
          }
          if (files.length > 0) {
            setPickerIndex(0);
            setPickerOpen(true);
          }
        } catch (error) {
          setScanState({ status: statusForError(error), data: null, error });
        } finally {
          setScanPending(false);
        }
      };

      /** The human picked one of the candidates. */
      const pickFile = (file) => {
        if (!file || unsupportedReason(file)) return;
        setPickerOpen(false);
        runAnalyze(str(file.path));
      };

      /** Hand the manuscript to the agent for a deep read. */
      const handToAgent = () => {
        const data = analyzeState.data || {};
        const file = data.file || {};
        const path = str(file.path);
        if (!path) {
          flash('还没有可交给智能体的稿件', 'warn');
          return;
        }
        const journal = journalKey
          ? str((targetJournal && targetJournal.name) || journalKey)
          : '';
        const instruction =
          `请读取 ${path}${journal ? `（${journal}）` : ''}，逐段（摘要/引言/方法/结果/讨论/结论）审阅：` +
          '先用 paper_check 按段落跑一遍，再用 paper_rules 查每段适用的硬规则，' +
          '给出按段落组织的修改意见，每条注明规则 id 与出处。';
        sendToSession(instruction);
      };

      const toggleChecked = (key) => {
        setChecked((state) => {
          const next = { ...state };
          if (next[key]) delete next[key];
          else next[key] = true;
          return next;
        });
      };

      // ── keyboard ──────────────────────────────────────────────────────
      useEffect(() => {
        const onKey = (event) => {
          // A dialog owns the keyboard while it is open.
          if (modalDepth > 0) return;
          const target = event.target;
          const inField =
            target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');
          if (event.key === 'Escape') {
            if (inField && target.dataset && target.dataset.search) {
              const setter = searchSetters[target.dataset.search];
              if (setter) setter('');
            }
            if (inField) target.blur();
            return;
          }
          if (inField) return;
          if (event.key === '/' && searchRef.current) {
            event.preventDefault();
            const node = searchRef.current;
            // a search box inside a closed <details> cannot take the focus:
            // open the fold first, then focus the field.
            const details = node.closest ? node.closest('details') : null;
            if (details && !details.open) details.open = true;
            node.focus();
            return;
          }
          const index = Number(event.key);
          if (Number.isInteger(index) && index >= 1 && index <= VIEWS.length) {
            setView(VIEWS[index - 1].id);
          }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      const searchSetters = {
        rules: () => setRulesQuery(''),
        journals: () => setJournalsQuery(''),
        manual: () => setManualQuery(''),
        sentences: () => setSentencesQuery(''),
      };

      // ── header ────────────────────────────────────────────────────────
      const viewLabel = (VIEWS.find((item) => item.id === view) || {}).label || '';
      const targetLabel = targetJournal ? `目标：${targetJournal.name}` : '未设目标期刊';
      const head = h(
        'div',
        { className: 'dapp-head' },
        h('div', { className: 'dapp-mark' }, h(Icon, { name: 'mark', size: 15 })),
        h(
          'div',
          { className: 'dapp-grow' },
          h('div', { className: 'dapp-title' }, t('panel.title')),
          h('div', { className: 'dapp-sub', title: `${viewLabel} · ${targetLabel}` }, `${viewLabel} · ${targetLabel}`),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'dapp-icon-btn',
            'aria-expanded': expanded ? 'true' : 'false',
            title: expanded ? t('panel.collapse') : t('panel.expand'),
            onClick: () => setExpanded((value) => !value),
          },
          h(Icon, { name: 'expand', size: 15 }),
        ),
      );

      // ── views ─────────────────────────────────────────────────────────

      function searchBox(key, value, setter, placeholder, primary) {
        return h(
          'div',
          { className: 'dapp-search' },
          h(Icon, { name: 'search', size: 14 }),
          h('input', {
            ref: primary ? searchRef : null,
            type: 'text',
            value,
            placeholder,
            'data-search': key,
            'aria-label': placeholder,
            onChange: (event) => setter(event.target.value),
          }),
          value
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'dapp-search-clear',
                  title: '清空搜索',
                  'aria-label': '清空搜索',
                  onClick: () => setter(''),
                },
                h(Icon, { name: 'close', size: 11 }),
              )
            : null,
        );
      }

      function chipRow(options, active, setter, kind, scroll) {
        return h(
          'div',
          { className: scroll ? 'dapp-chiprow dapp-chiprow-scroll' : 'dapp-chiprow' },
          h(
            'button',
            {
              type: 'button',
              className: 'dapp-chipbtn',
              'data-kind': kind,
              // "全部" is only the active choice while no filter is set.
              'data-on': active ? 'false' : 'true',
              onClick: () => setter(''),
            },
            '全部',
          ),
          options.map((option) =>
            h(
              'button',
              {
                key: option.id,
                type: 'button',
                className: 'dapp-chipbtn',
                'data-kind': kind,
                'data-on': active === option.id ? 'true' : 'false',
                onClick: () => setter(active === option.id ? '' : option.id),
              },
              option.label,
            ),
          ),
        );
      }

      function ruleText(rule) {
        const lines = [];
        const id = str(rule.id, rule.ruleId);
        if (id) lines.push(`【${id}】${prose(rule.title) || ''}`);
        else lines.push(prose(rule.title));
        const statement = prose(rule.statement, rule.body, rule.text);
        if (statement) lines.push(`规则：${statement}`);
        const fix = prose(rule.fix, rule.suggestion);
        if (fix) lines.push(`修复建议：${fix}`);
        const location = sourceLabel(rule.source);
        if (location) lines.push(`出处：${location}`);
        return lines.join('\n');
      }

      function renderRuleCard(rule) {
        const severity = str(rule.severity, 'info');
        const location = sourceLabel(rule.source);
        const statement = prose(rule.statement, rule.body, rule.text);
        const fix = prose(rule.fix, rule.suggestion);
        const sections = Array.isArray(rule.sections) ? rule.sections : [];
        return h(
          'div',
          { key: str(rule.id, rule.ruleId), className: 'dapp-card', 'data-sev': severity },
          h(
            'div',
            { className: 'dapp-card-title' },
            h(SeverityBadge, { severity }),
            h('span', { className: 'dapp-grow dapp-wrap' }, prose(rule.title, rule.id)),
          ),
          h('div', { className: 'dapp-rid' }, str(rule.id, rule.ruleId)),
          statement ? h('div', { className: 'dapp-rule-body dapp-wrap' }, statement) : null,
          fix ? h('div', { className: 'dapp-fix dapp-wrap' }, h('b', null, '修复建议：'), fix) : null,
          location ? h('div', { className: 'dapp-src' }, location) : null,
          sections.length > 0
            ? h(
                'div',
                { className: 'dapp-chiprow' },
                sections.map((section) => h('span', { key: section, className: 'dapp-badge' }, section)),
              )
            : null,
          h(
            'div',
            { className: 'dapp-actions' },
            h(
              'button',
              { type: 'button', className: 'dapp-btn', onClick: () => copyText(ruleText(rule)) },
              h(Icon, { name: 'copy', size: 12 }),
              t('panel.copy'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dapp-btn dapp-btn-primary',
                disabled: sending,
                onClick: () => sendToSession(ruleText(rule)),
              },
              h(Icon, { name: 'send', size: 12 }),
              t('panel.send'),
            ),
          ),
        );
      }

      function renderRules() {
        const state = rulesState;
        const filters = [
          rulesSection ? `段落「${rulesSection}」` : null,
          rulesSeverity ? `严重度「${rulesSeverity}」` : null,
          rulesDomain ? `分类「${rulesDomain}」` : null,
        ].filter(Boolean);
        const total = state.data && typeof state.data.total === 'number' ? state.data.total : rules.length;
        return h(
          'div',
          { className: 'dapp-view dapp-cols' },
          h(
            'div',
            { className: 'dapp-span' },
            h(
              'div',
              { className: 'dapp-toolbar' },
              searchBox('rules', rulesQuery, setRulesQuery, '搜规则标题 / 条款 / 修复建议（按 / 聚焦）', true),
              h(
                'div',
                { className: 'dapp-fgroup' },
                h('div', { className: 'dapp-label' }, '分类'),
                chipRow(domainOptions, rulesDomain, setRulesDomain, 'domain'),
              ),
              h(
                'div',
                { className: 'dapp-fgroup' },
                h('div', { className: 'dapp-label' }, '段落'),
                chipRow(sectionOptions, rulesSection, setRulesSection, 'section', true),
              ),
              h(
                'div',
                { className: 'dapp-fgroup' },
                h('div', { className: 'dapp-label' }, '严重度'),
                chipRow(SEVERITIES, rulesSeverity, setRulesSeverity, 'severity'),
              ),
            ),
          ),
          state.status === 'loading'
            ? h('div', { className: 'dapp-span' }, h(Skeleton, { label: '正在读取规则库' }))
            : null,
          state.status !== 'loading' && state.status !== 'ok'
            ? h('div', { className: 'dapp-span' }, h(StateNotice, { status: state.status, detail: state.error && state.error.message }))
            : null,
          state.status === 'ok' && rules.length === 0
            ? h(
                'div',
                { className: 'dapp-span' },
                h(EmptyState, {
                  icon: 'search',
                  title: '暂无匹配规则',
                  hint:
                    filters.length > 0
                      ? `试着放宽：清除 ${filters.join('、')}，或换一个关键词。`
                      : '换一个关键词，或清空搜索框。',
                }),
              )
            : null,
          state.status === 'ok' && rules.length > 0
            ? h(
                'div',
                { className: 'dapp-span' },
                h(SectionHead, { label: '命中规则', meta: `${rules.length} / ${total} 条` }),
              )
            : null,
          rules.map((rule) => renderRuleCard(rule)),
        );
      }

      function sortValue(journal, key) {
        const raw = journal[key];
        if (typeof raw === 'number') return raw;
        if (typeof raw === 'string') return raw;
        return -Infinity;
      }

      function renderJournalRow(journal) {
        const cells = [
          { key: 'name', label: '期刊', render: (item) => str(item.name, item.key) },
          { key: 'publisher', label: '出版社', render: (item) => str(item.publisher) || '—' },
          {
            key: 'impactFactor',
            label: 'IF',
            render: (item) => (typeof item.impactFactor === 'number' ? item.impactFactor.toFixed(1) : '—'),
          },
          {
            key: 'openAccess',
            label: 'OA',
            render: (item) => (item.openAccess ? '✓' : '—'),
          },
          {
            key: 'reviewDays',
            label: '审稿',
            render: (item) => (typeof item.reviewDays === 'number' ? `${item.reviewDays} 天` : '—'),
          },
          { key: 'apc', label: 'APC', render: (item) => (item.apc === null || item.apc === undefined ? '—' : String(item.apc)) },
          {
            key: 'structure',
            label: '段结构',
            render: (item) => (Array.isArray(item.structure) ? item.structure.slice(0, 3).join(' → ') : '—'),
          },
        ];
        return h(
          'tr',
          {
            key: str(journal.key, journal.name),
            'data-key': str(journal.key, journal.name),
            'data-on': journal.key === journalKey ? 'true' : 'false',
            onClick: () => setOpenJournal(str(journal.key, journal.name)),
          },
          cells.map((cell) =>
            h(
              'td',
              { key: cell.key, 'data-sort': cell.key },
              cell.render(journal),
            ),
          ),
        );
      }

      function renderJournalDetail(journal) {
        const limits = journal.limits || {};
        const limitKeys = Object.keys(limits);
        const structure = Array.isArray(journal.structure) ? journal.structure : [];
        const rulesOfJournal = Array.isArray(journal.rules) ? journal.rules : [];
        const location = sourceLabel(journal.source);
        const isTarget = journal.key === journalKey;
        return h(
          'div',
          { className: 'dapp-view' },
          h(
            'div',
            { className: 'dapp-actions' },
            h(
              'button',
              { type: 'button', className: 'dapp-btn dapp-btn-ghost', onClick: () => setOpenJournal('') },
              '← 返回列表',
            ),
            h(
              'button',
              {
                type: 'button',
                className: isTarget ? 'dapp-btn' : 'dapp-btn dapp-btn-primary',
                onClick: () => {
                  setJournalKey(str(journal.key));
                  writeStore('journal', str(journal.key));
                  flash(`已设为目标期刊：${str(journal.name, journal.key)}`, 'ok');
                },
              },
              isTarget ? '✓ 目标期刊' : '设为目标期刊',
            ),
          ),
          h(
            'div',
            { className: 'dapp-card' },
            h('div', { className: 'dapp-card-title' }, str(journal.name, journal.key)),
            h('div', { className: 'dapp-rid' }, str(journal.publisher), journal.issn ? ` · ${journal.issn}` : ''),
            h('div', { className: 'dapp-rule-body dapp-wrap' }, prose(journal.scope)),
            h(
              'div',
              { className: 'dapp-facts' },
              [
                ['IF', typeof journal.impactFactor === 'number' ? journal.impactFactor.toFixed(1) : '—'],
                ['APC', journal.apc === null || journal.apc === undefined ? '—' : String(journal.apc)],
                ['审稿', typeof journal.reviewDays === 'number' ? `${journal.reviewDays} 天` : '—'],
                ['OA', journal.openAccess ? '是' : '否'],
              ].map(([k, v]) =>
                h(
                  'div',
                  { key: k, className: 'dapp-fact' },
                  h('div', { className: 'dapp-fact-k' }, k),
                  h('div', { className: 'dapp-fact-v' }, v),
                ),
              ),
            ),
          ),
          h(
            'div',
            { className: 'dapp-card' },
            h(SectionHead, { label: '硬性参数 limits' }),
            limitKeys.length > 0
              ? h(
                  'dl',
                  { className: 'dapp-kv' },
                  limitKeys.map((key) => [
                    h('dt', { key: `k-${key}` }, key),
                    h(
                      'dd',
                      { key: `v-${key}` },
                      limits[key] === null || limits[key] === undefined ? '—' : String(limits[key]),
                    ),
                  ]),
                )
              : h('div', { className: 'dapp-hint' }, '宿主没有给出该刊的硬性参数。'),
          ),
          h(
            'div',
            { className: 'dapp-card' },
            h(SectionHead, { label: '段结构 structure' }),
            structure.length > 0
              ? h('ol', { className: 'dapp-list' }, structure.map((item) => h('li', { key: item }, item)))
              : h('div', { className: 'dapp-hint' }, '宿主没有给出该刊的段结构。'),
          ),
          h(
            'div',
            { className: 'dapp-card' },
            h(SectionHead, { label: '该刊要求 rules' }),
            rulesOfJournal.length > 0
              ? h(
                  'ul',
                  { className: 'dapp-list dapp-list-warn' },
                  rulesOfJournal.map((item, index) => h('li', { key: `${index}-${item}` }, prose(item))),
                )
              : h('div', { className: 'dapp-hint' }, '宿主没有给出该刊的专属要求。'),
          ),
          location ? h('div', { className: 'dapp-src' }, location) : null,
          h(
            'div',
            { className: 'dapp-actions' },
            h(
              'button',
              {
                type: 'button',
                className: 'dapp-btn',
                onClick: () =>
                  copyText(
                    `目标期刊：${str(journal.name, journal.key)}\n段结构：${structure.join(' → ')}\n要求：\n- ${rulesOfJournal.join('\n- ')}`,
                  ),
              },
              h(Icon, { name: 'copy', size: 12 }),
              t('panel.copy'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dapp-btn dapp-btn-primary',
                disabled: sending,
                onClick: () =>
                  sendToSession(
                    `我要投 ${str(journal.name, journal.key)}。请按该刊的硬性约束检查我的稿件：段结构 ${structure.join(' → ')}；参数 ${JSON.stringify(limits)}；专属要求：${rulesOfJournal.join('；')}。`,
                  ),
              },
              h(Icon, { name: 'send', size: 12 }),
              t('panel.send'),
            ),
          ),
        );
      }

      function renderJournals() {
        const state = journalsState;
        const open = journalsAll.find((journal) => str(journal.key) === openJournal) || null;
        if (open) return renderJournalDetail(open);
        const columns = [
          { key: 'name', label: '期刊' },
          { key: 'publisher', label: '出版社' },
          { key: 'impactFactor', label: 'IF' },
          { key: 'openAccess', label: 'OA' },
          { key: 'reviewDays', label: '审稿' },
          { key: 'apc', label: 'APC' },
          { key: 'structure', label: '段结构' },
        ];
        return h(
          'div',
          { className: 'dapp-view' },
          h(
            'div',
            { className: 'dapp-toolbar' },
            searchBox('journals', journalsQuery, setJournalsQuery, '搜期刊名 / 出版社 / ISSN（按 / 聚焦）', true),
            h(
              'div',
              { className: 'dapp-fgroup' },
              h('div', { className: 'dapp-label' }, '筛选'),
              h(
                'div',
                { className: 'dapp-chiprow' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dapp-chipbtn',
                    'data-on': journalOpenOnly ? 'true' : 'false',
                    onClick: () => setJournalOpenOnly((value) => !value),
                  },
                  '仅开放获取',
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dapp-chipbtn',
                    'data-on': journalMaxApc ? 'true' : 'false',
                    onClick: () => setJournalMaxApc(journalMaxApc ? '' : '3000'),
                  },
                  'APC ≤ 3000',
                ),
              ),
            ),
            fieldOptions.length > 0
              ? h(
                  'div',
                  { className: 'dapp-fgroup' },
                  h('div', { className: 'dapp-label' }, '领域'),
                  h(
                    'div',
                    { className: 'dapp-chiprow dapp-chiprow-scroll' },
                    fieldOptions.map((field) =>
                      h(
                        'button',
                        {
                          key: field,
                          type: 'button',
                          className: 'dapp-chipbtn',
                          'data-on': journalField === field ? 'true' : 'false',
                          onClick: () => setJournalField(journalField === field ? '' : field),
                        },
                        field,
                      ),
                    ),
                  ),
                )
              : null,
          ),
          state.status === 'loading' ? h(Skeleton, { label: '正在读取期刊库' }) : null,
          state.status !== 'loading' && state.status !== 'ok'
            ? h(StateNotice, { status: state.status, detail: state.error && state.error.message })
            : null,
          state.status === 'ok' && journals.length === 0
            ? h(EmptyState, {
                icon: 'book',
                title: '暂无匹配期刊',
                hint: '试着放宽：关闭「仅开放获取」、取消 APC 上限，或清空搜索框。',
              })
            : null,
          state.status === 'ok' && journals.length > 0
            ? h(SectionHead, { label: '期刊列表', meta: `${journals.length} 本 · 点行看详情` })
            : null,
          state.status === 'ok' && journals.length > 0
            ? h(
                'div',
                { className: 'dapp-tablewrap', ref: tableRef },
                h(
                  'table',
                  { className: 'dapp-jtable' },
                  h(
                    'thead',
                    null,
                    h(
                      'tr',
                      null,
                      columns.map((column) =>
                        h(
                          'th',
                          {
                            key: column.key,
                            onClick: () =>
                              setJournalSort((state_) =>
                                state_.key === column.key ? { key: column.key, dir: -state_.dir } : { key: column.key, dir: -1 },
                              ),
                          },
                          column.label,
                          journalSort.key === column.key ? (journalSort.dir < 0 ? ' ↓' : ' ↑') : '',
                        ),
                      ),
                    ),
                  ),
                  h('tbody', null, journals.map(renderJournalRow)),
                ),
              )
            : null,
          state.status === 'ok' && journals.length > 0 && tableScrolls
            ? h('div', { className: 'dapp-hintline' }, '表格可横向滚动查看全部列')
            : null,
        );
      }

      function renderCheck() {
        const state = checkState;
        const data = state.data || {};
        const violations = Array.isArray(data.violations) ? data.violations : [];
        const advice = Array.isArray(data.advice) ? data.advice : [];
        const summary = data.summary || {};
        const hard = num(summary.hard, summary.hardCount, summary.errors, summary.error);
        const soft = num(summary.soft, summary.softCount, summary.warnings, summary.warning);
        const info = num(summary.info, summary.infoCount, summary.hints, summary.hint);
        const total = num(summary.total, summary.count, violations.length);
        const passed =
          typeof summary.pass === 'boolean'
            ? summary.pass
            : typeof summary.passed === 'boolean'
              ? summary.passed
              : violations.length === 0;
        return h(
          'div',
          { className: 'dapp-view dapp-cols' },
          h(
            'div',
            { className: 'dapp-span' },
            h(
              'div',
              { className: 'dapp-card' },
              h(SectionHead, { label: '待检段落' }),
              h('textarea', {
                className: 'dapp-textarea',
                value: checkText,
                'aria-label': '待检段落',
                placeholder: '粘贴要检查的段落（标题 + 正文）…',
                onChange: (event) => setCheckText(event.target.value),
              }),
              h(
                'div',
                { className: 'dapp-field' },
                h('span', { className: 'dapp-k' }, '段落'),
                h(
                  'select',
                  {
                    className: 'dapp-select',
                    'aria-label': '段落',
                    value: checkSection,
                    onChange: (event) => {
                      setCheckTouched(true);
                      setCheckSection(event.target.value);
                    },
                  },
                  h('option', { value: '' }, detected ? `自动（${detected}）` : '自动'),
                  sectionOptions.map((section) =>
                    h('option', { key: section.id, value: section.id }, section.label),
                  ),
                ),
              ),
              h(
                'div',
                { className: 'dapp-field' },
                h('span', { className: 'dapp-k' }, '目标期刊'),
                h(
                  'select',
                  {
                    className: 'dapp-select',
                    'aria-label': '目标期刊',
                    value: journalKey,
                    onChange: (event) => {
                      setJournalKey(event.target.value);
                      writeStore('journal', event.target.value);
                    },
                  },
                  h('option', { value: '' }, '不限'),
                  journalsAll.map((journal) =>
                    h('option', { key: str(journal.key), value: str(journal.key) }, str(journal.name, journal.key)),
                  ),
                ),
              ),
              h(
                'div',
                { className: 'dapp-actions' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dapp-btn dapp-btn-primary',
                    disabled: checkPending || !checkText.trim(),
                    onClick: runCheck,
                  },
                  checkPending ? '检查中…' : '开始检查',
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dapp-btn',
                    onClick: () => {
                      setCheckText('');
                      setCheckTouched(false);
                      setCheckState({ status: 'idle', data: null, error: null });
                    },
                  },
                  '清空',
                ),
              ),
            ),
          ),
          state.status === 'unauthorized' ||
          state.status === 'notImplemented' ||
          state.status === 'failed'
            ? h('div', { className: 'dapp-span' }, h(StateNotice, { status: state.status, detail: state.error && state.error.message }))
            : null,
          state.status === 'ok'
            ? h(
                'div',
                { className: 'dapp-span' },
                h(SectionHead, { label: '检查结果', meta: total > 0 ? `共 ${total} 项检查` : '' }),
                h(SummaryBar, {
                  passed,
                  count: violations.length,
                  hard,
                  soft,
                  info,
                }),
              )
            : null,
          state.status === 'ok' && violations.length === 0
            ? h(
                'div',
                { className: 'dapp-span' },
                h(EmptyState, {
                  icon: 'check',
                  title: '没有发现违规',
                  hint: `这一段通过了全部 ${total} 项检查。`,
                }),
              )
            : null,
          violations.map((violation, index) =>
            h(ViolationCard, {
              key: `${str(violation.ruleId, violation.id, `v${index}`)}#${index}`,
              violation,
              sending,
              onCopy: copyText,
              onSend: sendToSession,
            }),
          ),
          state.status === 'ok' && advice.length > 0
            ? h('div', { className: 'dapp-span' }, h(AdviceCard, { advice }))
            : null,
        );
      }

      function renderDeai() {
        const state = deaiState;
        const data = state.data || {};
        const hits = Array.isArray(data.hits) ? data.hits : [];
        const score = typeof data.score === 'number' ? data.score : null;
        const patterns = sentencesState.data && Array.isArray(sentencesState.data.patterns)
          ? sentencesState.data.patterns
          : [];
        const suggestions = hits
          .map((hit) => str(hit.suggestion, hit.replacement, hit.fix))
          .filter(Boolean);
        return h(
          'div',
          { className: 'dapp-view dapp-cols' },
          h(
            'div',
            { className: 'dapp-span' },
            h(
              'div',
              { className: 'dapp-card' },
              h(SectionHead, { label: '待扫描文本' }),
              h('textarea', {
                className: 'dapp-textarea',
                value: deaiText,
                'aria-label': '待扫描文本',
                placeholder: '粘贴要扫描 AI 腔的段落…',
                onChange: (event) => setDeaiText(event.target.value),
              }),
              h(
                'div',
                { className: 'dapp-actions' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dapp-btn dapp-btn-primary',
                    disabled: deaiPending || !deaiText.trim(),
                    onClick: runDeai,
                  },
                  deaiPending ? '扫描中…' : '开始扫描',
                ),
                suggestions.length > 0
                  ? h(
                      'button',
                      {
                        type: 'button',
                        className: 'dapp-btn',
                        onClick: () => copyText(suggestions.map((item, index) => `${index + 1}. ${item}`).join('\n')),
                      },
                      h(Icon, { name: 'copy', size: 12 }),
                      '复制全部建议',
                    )
                  : null,
              ),
            ),
          ),
          state.status === 'unauthorized' ||
          state.status === 'notImplemented' ||
          state.status === 'failed'
            ? h('div', { className: 'dapp-span' }, h(StateNotice, { status: state.status, detail: state.error && state.error.message }))
            : null,
          state.status === 'ok'
            ? h(
                'div',
                { className: 'dapp-span' },
                h(SectionHead, { label: '扫描结果', meta: hits.length > 0 ? `${hits.length} 处命中` : '' }),
                h(ScoreCard, { score, hits }),
              )
            : null,
          state.status === 'ok' && hits.length === 0
            ? h(
                'div',
                { className: 'dapp-span' },
                h(EmptyState, {
                  icon: 'deai',
                  title: '没有命中 AI 句式',
                  hint: '这段文字没有明显的模板句式；继续检查措辞与引用规范。',
                }),
              )
            : null,
          hits.map((hit, index) =>
            h(HitCard, {
              key: str(hit.id, `h${index}`),
              hit,
              sending,
              onCopy: copyText,
              onSend: sendToSession,
              sendText: (item) =>
                `请改写下面这句 AI 腔表达：${str(item.match, item.text)}\n原因：${str(item.why, item.reason)}\n建议：${str(item.suggestion, item.replacement)}`,
            }),
          ),
          h(
            'details',
            { className: 'dapp-span dapp-fold' },
            h(
              'summary',
              null,
              h(Icon, { name: 'chevron', size: 13, className: 'dapp-chevron' }),
              '句式库',
              h('span', { className: 'dapp-fold-count' }, String(patterns.length)),
            ),
            h(
              'div',
              { className: 'dapp-fold-body' },
              searchBox('sentences', sentencesQuery, setSentencesQuery, '搜句式（按 / 聚焦）', true),
              sentencesState.status === 'loading'
                ? h(Skeleton, { label: '正在读取句式库', rows: 2 })
                : null,
              sentencesState.status !== 'loading' && sentencesState.status !== 'ok'
                ? h(StateNotice, { status: sentencesState.status })
                : null,
              sentencesState.status === 'ok' && patterns.length === 0
                ? h(EmptyState, { icon: 'search', title: '句式库为空', hint: '宿主没有返回任何句式。' })
                : null,
              patterns.map((pattern, index) =>
                h(
                  'div',
                  { key: str(pattern.id, `p${index}`), className: 'dapp-pattern' },
                  h(
                    'div',
                    { className: 'dapp-grow' },
                    h('div', { className: 'dapp-pattern-title' }, prose(pattern.zh, pattern.en)),
                    h('div', { className: 'dapp-pattern-body' }, prose(pattern.why, pattern.category)),
                  ),
                ),
              ),
            ),
          ),
        );
      }

      function renderChecklist() {
        const state = checklistState;
        const totalItems = checklistItems.length;
        const ratio = totalItems > 0 ? doneCount / totalItems : 0;
        return h(
          'div',
          { className: 'dapp-view' },
          h(
            'div',
            { className: 'dapp-span' },
            h(
              'div',
              { className: 'dapp-card' },
              h(
                'div',
                { className: 'dapp-check-head' },
                h(ProgressRing, { ratio, label: `${Math.round(ratio * 100)}%` }),
                h('span', { className: 'dapp-grow' }, `${t('panel.progress')} ${doneCount}/${totalItems}`),
                h(
                  'div',
                  { className: 'dapp-track' },
                  h('span', { className: 'dapp-fill', style: { width: `${Math.round(ratio * 100)}%` } }),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dapp-icon-btn',
                    title: '清空勾选',
                    'aria-label': '清空勾选',
                    onClick: () => setChecked({}),
                  },
                  h(Icon, { name: 'close', size: 13 }),
                ),
              ),
            ),
          ),
          state.status === 'loading' ? h(Skeleton, { label: '正在读取投稿清单' }) : null,
          state.status !== 'loading' && state.status !== 'ok'
            ? h(StateNotice, { status: state.status, detail: state.error && state.error.message })
            : null,
          state.status === 'ok' && stages.length === 0
            ? h(
                'div',
                { className: 'dapp-span' },
                h(EmptyState, { icon: 'mark', title: '宿主没有提供清单', hint: '清单接口为空：确认宿主插件已启用并重启宿主。' }),
              )
            : null,
          stages.length > 0
            ? h(
                'div',
                { className: 'dapp-span' },
                h(SectionHead, { label: '阶段', meta: `${stages.length} 个` }),
                h(
                  'div',
                  { className: 'dapp-chiprow dapp-chiprow-scroll' },
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dapp-chipbtn',
                      'data-on': stageId ? 'false' : 'true',
                      onClick: () => setStageId(''),
                    },
                    '全部',
                  ),
                  stages.map((stage) => {
                    const stageItems = (stage.items || []).filter(
                      (item) => checked[`${stage.id}:${item.id}`],
                    ).length;
                    return h(
                      'button',
                      {
                        key: stage.id,
                        type: 'button',
                        className: 'dapp-chipbtn',
                        'data-on': stageId === stage.id ? 'true' : 'false',
                        onClick: () => setStageId(stageId === stage.id ? '' : stage.id),
                      },
                      `${str(stage.title, stage.id)} ${stageItems}/${(stage.items || []).length}`,
                    );
                  }),
                ),
              )
            : null,
          visibleStages.map((stage) => {
            const stageOpen = !collapsed[stage.id];
            const done = (stage.items || []).filter((item) => checked[`${stage.id}:${item.id}`]).length;
            return h(
              'div',
              { key: stage.id, className: 'dapp-group', 'data-open': stageOpen ? 'true' : 'false' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'dapp-group-head',
                  'aria-expanded': stageOpen ? 'true' : 'false',
                  onClick: () => setCollapsed((prev) => ({ ...prev, [stage.id]: stageOpen })),
                },
                h(Icon, { name: 'chevron', size: 13, className: 'dapp-chevron' }),
                h('span', { className: 'dapp-group-name' }, str(stage.title, stage.id)),
                h('span', { className: 'dapp-group-count' }, `${done}/${(stage.items || []).length}`),
              ),
              stageOpen
                ? h(
                    'div',
                    { className: 'dapp-items' },
                    (stage.items || []).map((item) => {
                      const key = `${stage.id}:${item.id}`;
                      const on = Boolean(checked[key]);
                      return h(
                        'div',
                        { key, className: 'dapp-item', 'data-checked': on ? 'true' : 'false' },
                        h(
                          'button',
                          {
                            type: 'button',
                            className: 'dapp-box',
                            'aria-label': str(item.text),
                            'aria-pressed': on ? 'true' : 'false',
                            onClick: () => toggleChecked(key),
                          },
                          h(Icon, { name: 'check', size: 11, strokeWidth: 2 }),
                        ),
                        h(
                          'div',
                          { className: 'dapp-grow' },
                          h('div', { className: 'dapp-item-text dapp-wrap' }, prose(item.text)),
                          item.severity
                            ? h(
                                'div',
                                { className: 'dapp-item-meta' },
                                h(SeverityBadge, { severity: item.severity }),
                                item.ruleId ? h('span', { className: 'dapp-rid' }, str(item.ruleId)) : null,
                              )
                            : null,
                        ),
                        h(
                          'button',
                          {
                            type: 'button',
                            className: 'dapp-icon-btn',
                            title: t('panel.send'),
                            'aria-label': `${t('panel.send')}：${str(item.text)}`,
                            disabled: sending,
                            onClick: () =>
                              sendToSession(
                                `投稿清单（${str(stage.title, stage.id)}）待办：${str(item.text)}${
                                  item.ruleId ? `（规则 ${item.ruleId}）` : ''
                                }`,
                              ),
                          },
                          h(Icon, { name: 'send', size: 13 }),
                        ),
                      );
                    }),
                  )
                : null,
            );
          }),
        );
      }

      // ── 稿件 ──────────────────────────────────────────────────────────

      function renderManuscript() {
        const data = analyzeState.data || {};
        const report = Array.isArray(data.report) ? data.report : [];
        const file = data.file || {};
        const deai = data.deai || {};
        const hits = Array.isArray(deai.hits) ? deai.hits : [];
        const score = typeof deai.score === 'number' ? deai.score : null;
        const summary = data.summary || {};
        const hard = num(summary.hard);
        const soft = num(summary.soft);
        const info = num(summary.info);
        const total = num(
          summary.total,
          report.reduce((sum, entry) => sum + (Array.isArray(entry.violations) ? entry.violations.length : 0), 0),
        );
        const activeKey = activeSection || (report[0] ? str(report[0].section) : '');
        const active = report.find((entry) => str(entry.section) === activeKey) || report[0] || null;
        const activeViolations = active && Array.isArray(active.violations) ? active.violations : [];
        const activeAdvice = active && Array.isArray(active.advice) ? active.advice : [];
        const cwdText = str(sessionCwd);
        const analyseStatus = analyzeState.status;
        const analyseError = analyzeState.error;
        const unsupported = analyseStatus === 'failed' && analyseError && analyseError.status === 415;

        return h(
          'div',
          { className: 'dapp-view' },
          // ── the header block: the session's folder and the one button
          h(
            'div',
            { className: 'dapp-span' },
            h(
              'div',
              { className: 'dapp-card' },
              h(SectionHead, { label: '会话工作目录', meta: sessionId ? sessionId : '未绑定会话' }),
              h(
                'div',
                { className: 'dapp-path' },
                h(Icon, { name: 'doc', size: 14 }),
                h(
                  'span',
                  { className: 'dapp-path-text', title: cwdText },
                  cwdText || '（宿主没有给出这个会话的目录）',
                ),
                cwdText
                  ? h(
                      'button',
                      {
                        type: 'button',
                        className: 'dapp-icon-btn',
                        title: '复制路径',
                        'aria-label': '复制路径',
                        onClick: () => copyText(cwdText),
                      },
                      h(Icon, { name: 'copy', size: 13 }),
                    )
                  : null,
              ),
              hostCwd && cwdText && hostCwd !== cwdText
                ? h(
                    'div',
                    { className: 'dapp-warnline' },
                    `宿主为这个会话解析出的目录是 ${hostCwd}，与面板看到的不一致。`,
                  )
                : null,
              hostCwd && !cwdText
                ? h('div', { className: 'dapp-hintline' }, `宿主解析的目录：${hostCwd}`)
                : null,
              h(
                'div',
                { className: 'dapp-field' },
                h('span', { className: 'dapp-k' }, '目标期刊'),
                h(
                  'select',
                  {
                    className: 'dapp-select',
                    'aria-label': '目标期刊',
                    value: journalKey,
                    onChange: (event) => {
                      const next = event.target.value;
                      setJournalKey(next);
                      writeStore('journal', next);
                      // The journal decides which rules apply — a changed
                      // target means the manuscript is checked again.
                      const current = str((analyzeState.data || {}).file && analyzeState.data.file.path);
                      if (current) runAnalyze(current);
                    },
                  },
                  h('option', { value: '' }, '不限'),
                  journalsAll.map((journal) =>
                    h('option', { key: str(journal.key), value: str(journal.key) }, str(journal.name, journal.key)),
                  ),
                ),
              ),
              h(
                'div',
                { className: 'dapp-actions' },
                h(
                  'button',
                  {
                    ref: scanTriggerRef,
                    type: 'button',
                    className: 'dapp-btn dapp-btn-primary',
                    disabled: scanPending || analyzePending || !sessionId,
                    onClick: scanSession,
                  },
                  scanPending ? '扫描中…' : '分析会话论文',
                ),
                scanState.status === 'ok'
                  ? h(
                      'button',
                      {
                        type: 'button',
                        className: 'dapp-btn',
                        disabled: scanPending,
                        onClick: scanSession,
                      },
                      '重新扫描',
                    )
                  : null,
              ),
              !sessionId
                ? h(
                    'div',
                    { className: 'dapp-hint' },
                    '未绑定会话：面板拿不到会话 id，不会去猜一个会话目录。请在右侧栏的会话里打开本面板。',
                  )
                : null,
            ),
          ),
          // ── the failure modes of the scan
          scanState.status === 'unauthorized' ||
          scanState.status === 'notImplemented' ||
          scanState.status === 'failed'
            ? h(
                'div',
                { className: 'dapp-span' },
                h(StateNotice, { status: scanState.status, detail: scanState.error && scanState.error.message }),
              )
            : null,
          scanState.status === 'failed' && scanState.error && scanState.error.status === 409
            ? h(
                'div',
                { className: 'dapp-span' },
                h(
                  'div',
                  { className: 'dapp-state', 'data-tone': 'warn' },
                  h(
                    'div',
                    { className: 'dapp-state-head' },
                    h('span', { className: 'dapp-state-mark' }, h(Icon, { name: 'close', size: 15 })),
                    h('span', { className: 'dapp-state-title' }, '宿主无法解析这个会话'),
                  ),
                  h('div', { className: 'dapp-state-body' }, '会话 id 没有对应的活动会话，宿主不能读它的目录。'),
                ),
              )
            : null,
          scanState.status === 'loading'
            ? h('div', { className: 'dapp-span' }, h(Skeleton, { label: '正在扫描会话目录' }))
            : null,
          // ── the empty folder
          scanState.status === 'ok' && scanFiles.length === 0
            ? h(
                'div',
                { className: 'dapp-span' },
                h(EmptyState, {
                  icon: 'doc',
                  title: '会话目录里没有候选稿件',
                  hint: '扫描器只在会话的工作目录里找论文（最多三层深）。',
                }),
                h(
                  'div',
                  { className: 'dapp-card' },
                  h(SectionHead, { label: '扫描器找什么' }),
                  h(
                    'ul',
                    { className: 'dapp-list' },
                    SCAN_HINTS.map((hint, index) => h('li', { key: index }, hint)),
                  ),
                ),
                h(
                  'div',
                  { className: 'dapp-actions' },
                  h(
                    'button',
                    { type: 'button', className: 'dapp-btn', onClick: scanSession },
                    '重新扫描',
                  ),
                ),
              )
            : null,
          // ── the report
          analyseStatus === 'loading'
            ? h('div', { className: 'dapp-span' }, h(Skeleton, { label: '正在分析稿件', rows: 4 }))
            : null,
          unsupported
            ? h(
                'div',
                { className: 'dapp-span' },
                h(
                  'div',
                  { className: 'dapp-state', 'data-tone': 'warn' },
                  h(
                    'div',
                    { className: 'dapp-state-head' },
                    h('span', { className: 'dapp-state-mark' }, h(Icon, { name: 'close', size: 15 })),
                    h('span', { className: 'dapp-state-title' }, '这个格式还不能直接分析'),
                  ),
                  h(
                    'div',
                    { className: 'dapp-state-body' },
                    'PDF / 旧版 .doc / .odt 需要先用 office 技能转成 docx，宿主才能读出正文。',
                  ),
                  h('div', { className: 'dapp-rid' }, `HTTP 415 · ${str(analyseError.message)}`),
                ),
              )
            : null,
          analyseStatus === 'unauthorized' || analyseStatus === 'notImplemented' || analyseStatus === 'failed'
            ? h(
                'div',
                { className: 'dapp-span' },
                h(StateNotice, { status: analyseStatus, detail: analyseError && analyseError.message }),
              )
            : null,
          analyseStatus === 'ok'
            ? h(
                'div',
                { className: 'dapp-span' },
                // the analysed file
                h(
                  'div',
                  { className: 'dapp-card' },
                  h(
                    SectionHead,
                    {
                      label: '稿件',
                      meta: `${str(file.name, '未命名')} · ${str(file.format, '—')} · ${formatBytes(file.bytes)}`,
                    },
                  ),
                  h('div', { className: 'dapp-file-path' }, str(file.path)),
                  h(
                    'div',
                    { className: 'dapp-actions' },
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'dapp-btn dapp-btn-primary',
                        disabled: sending || !sessionId,
                        onClick: handToAgent,
                      },
                      h(Icon, { name: 'send', size: 12 }),
                      '交给 Agent 深读',
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'dapp-btn',
                        onClick: () => copyText(str(file.path)),
                      },
                      h(Icon, { name: 'copy', size: 12 }),
                      '复制路径',
                    ),
                  ),
                ),
                // the verdict
                h(SummaryBar, { passed: hard === 0, count: total, hard, soft, info }),
                // the section navigator
                h(SectionHead, { label: '按段落', meta: `${report.length} 段` }),
                h(
                  'div',
                  { className: 'dapp-chiprow dapp-chiprow-scroll' },
                  report.map((entry, index) => {
                    const key = str(entry.section, `s${index}`);
                    const violations = Array.isArray(entry.violations) ? entry.violations : [];
                    const hardCount = violations.filter(
                      (violation) => str(violation.severity) === 'hard',
                    ).length;
                    return h(
                      'button',
                      {
                        key,
                        type: 'button',
                        className: 'dapp-chipbtn dapp-chip-sec',
                        'data-on': key === activeKey ? 'true' : 'false',
                        title: `${sectionTitle(entry)} · ${num(entry.words)} 词 · ${violations.length} 条问题`,
                        onClick: () => setActiveSection(key),
                      },
                      h('span', { className: 'dapp-chip-sec-title' }, sectionTitle(entry)),
                      h('span', { className: 'dapp-chip-sec-words' }, `${num(entry.words)} 词`),
                      hardCount > 0
                        ? h(
                            'span',
                            { className: 'dapp-chip-sec-hard', title: `${hardCount} 条硬性问题` },
                            h('span', { className: 'dapp-dot', 'data-tone': 'bad' }),
                            String(hardCount),
                          )
                        : null,
                    );
                  }),
                ),
                // the findings of the selected section
                active
                  ? h(
                      SectionHead,
                      {
                        label: sectionTitle(active),
                        meta: `${num(active.words)} 词 · ${activeViolations.length} 条问题 · ${activeAdvice.length} 条建议`,
                      },
                    )
                  : null,
                activeViolations.map((violation, index) =>
                  h(ViolationCard, {
                    key: `${str(violation.ruleId, violation.id, `v${index}`)}#${index}`,
                    violation,
                    sending,
                    onCopy: copyText,
                    onSend: sendToSession,
                  }),
                ),
                activeViolations.length === 0 && active
                  ? h(
                      'div',
                      { className: 'dapp-span' },
                      h(EmptyState, {
                        icon: 'check',
                        title: '这一段没有发现问题',
                        hint: '规则库里的自动检查全部通过；下面的建议仍值得一读。',
                      }),
                    )
                  : null,
                activeAdvice.length > 0 ? h(AdviceCard, { advice: activeAdvice }) : null,
                // the de-AI card
                h(SectionHead, { label: '去 AI 化', meta: hits.length > 0 ? `${hits.length} 处命中` : '' }),
                h(ScoreCard, { score, hits }),
                hits.map((hit, index) =>
                  h(HitCard, {
                    key: str(hit.id, `h${index}`),
                    hit,
                    sending,
                    onCopy: copyText,
                    onSend: sendToSession,
                    sendText: (item) =>
                      `请改写下面这句 AI 腔表达：${str(item.matched, item.match, item.text)}\n原因：${str(item.why, item.reason)}\n建议：${str(item.suggestion, item.replacement)}`,
                  }),
                ),
              )
            : null,
        );
      }

      function renderManual() {
        const stateNote =
          liveIndexState === 'live'
            ? remotePending && manualQuery.trim()
              ? '正在全文检索当前文件…'
              : '实时索引：全文检索宿主路由读取的当前文件，不消耗任何 token。'
            : liveIndexState === 'unauthorized'
              ? '宿主路由拒绝了本次请求（缺登录态），正在使用打包时的内置索引（仅标题级匹配）。'
              : liveIndexState === 'notImplemented'
                ? '宿主没有提供 skill-index 路由，正在使用打包时的内置索引（仅标题级匹配）。'
                : '宿主路由不可达，正在使用打包时的内置索引（仅标题级匹配）。';
        return h(
          'div',
          { className: 'dapp-view' },
          h(
            'div',
            { className: 'dapp-span' },
            h(SectionHead, { label: '检索' }),
            searchBox('manual', manualQuery, setManualQuery, '全文检索手册文件（按 / 聚焦）', true),
            h(
              'div',
              { className: 'dapp-status', 'data-tone': liveIndexState === 'live' ? 'ok' : 'warn' },
              h('span', { className: 'dapp-status-dot' }),
              h('span', null, stateNote),
            ),
          ),
          manualQuery.trim() && manualResults.length === 0
            ? h(
                'div',
                { className: 'dapp-span' },
                h(EmptyState, {
                  icon: 'search',
                  title: '没有命中任何文件',
                  hint: '换一个关键词，或清空搜索框；文件名也可以直接搜。',
                }),
              )
            : null,
          manualResults.length > 0
            ? h(
                'div',
                { className: 'dapp-span' },
                h(SectionHead, { label: '文件', meta: `${manualResults.length} 个` }),
              )
            : null,
          manualResults.map((entry) =>
            h(
              'div',
              { key: entry.path, className: 'dapp-file' },
              h(
                'div',
                { className: 'dapp-file-top' },
                h('span', { className: 'dapp-badge', 'data-kind': entry.kind }, entry.kind),
                h('span', { className: 'dapp-file-title' }, entry.title),
              ),
              h('div', { className: 'dapp-file-path' }, entry.path),
              h('div', { className: 'dapp-file-sub' }, entry.subtitle),
              entry.snippet
                ? h(
                    'div',
                    { className: 'dapp-file-snip' },
                    h('span', { className: 'dapp-file-snip-no' }, `L${entry.line || 0}`),
                    entry.snippet,
                  )
                : null,
              (entry.keywords || []).length > 0
                ? h(
                    'div',
                    { className: 'dapp-chips' },
                    entry.keywords.slice(0, 8).map((word) => h('span', { key: word, className: 'dapp-badge' }, word)),
                    entry.keywords.length > 8
                      ? h('span', { className: 'dapp-badge' }, `+${entry.keywords.length - 8}`)
                      : null,
                  )
                : null,
              h(
                'div',
                { className: 'dapp-actions' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dapp-btn',
                    onClick: () => copyText(`使用 academic-paper-polish 技能：读取 ${entry.path}，按其中的规则处理我的稿件。`),
                  },
                  h(Icon, { name: 'copy', size: 12 }),
                  t('panel.copy'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dapp-btn dapp-btn-primary',
                    disabled: sending,
                    onClick: () =>
                      sendToSession(`使用 academic-paper-polish 技能：读取 ${entry.path}，按其中的规则处理我的稿件。`),
                  },
                  h(Icon, { name: 'send', size: 12 }),
                  t('panel.send'),
                ),
              ),
            ),
          ),
          manualQuery.trim() ? null : h('div', { className: 'dapp-span dapp-hint' }, '输入关键词即可全文检索技能手册；点「发给会话」把文件交给智能体。'),
        );
      }

      // ── check / de-AI actions ─────────────────────────────────────────

      const [checkState, setCheckState] = useState({ status: 'idle', data: null, error: null });
      const [checkPending, setCheckPending] = useState(false);
      const [deaiState, setDeaiState] = useState({ status: 'idle', data: null, error: null });
      const [deaiPending, setDeaiPending] = useState(false);

      async function runCheck() {
        setCheckPending(true);
        setCheckState({ status: 'loading', data: null, error: null });
        try {
          const response = await fetch('/dsh-academic-paper-polish/api/check', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              text: checkText,
              section: checkSection || detected || undefined,
              journal: journalKey || undefined,
            }),
          });
          const data = await readJson(response);
          setCheckState({ status: 'ok', data, error: null });
        } catch (error) {
          setCheckState({ status: statusForError(error), data: null, error });
        } finally {
          setCheckPending(false);
        }
      }

      async function runDeai() {
        setDeaiPending(true);
        setDeaiState({ status: 'loading', data: null, error: null });
        try {
          const response = await fetch('/dsh-academic-paper-polish/api/deai', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text: deaiText }),
          });
          const data = await readJson(response);
          setDeaiState({ status: 'ok', data, error: null });
        } catch (error) {
          setDeaiState({ status: statusForError(error), data: null, error });
        } finally {
          setDeaiPending(false);
        }
      }

      // ── assembly ──────────────────────────────────────────────────────

      const tabBar = h(
        'div',
        { className: 'dapp-tabs' },
        VIEWS.map((item, index) =>
          h(
            'button',
            {
              key: item.id,
              type: 'button',
              className: 'dapp-tab',
              'data-active': view === item.id ? 'true' : 'false',
              'data-view': item.id,
              title: `${item.label}（快捷键 ${index + 1}）`,
              onClick: () => setView(item.id),
            },
            item.label,
          ),
        ),
      );

      let content;
      if (view === 'rules') content = renderRules();
      else if (view === 'journals') content = renderJournals();
      else if (view === 'check') content = renderCheck();
      else if (view === 'deai') content = renderDeai();
      else if (view === 'checklist') content = renderChecklist();
      else if (view === 'manuscript') content = renderManuscript();
      else content = renderManual();

      const toastNode = toast
        ? h('div', { className: 'dapp-toast', 'data-tone': toast.kind }, toast.text)
        : null;

      // The file chooser: the host found several equally likely manuscripts,
      // so the human picks one. The dialog is portaled to the document body.
      const pickerNode = pickerOpen
        ? h(
            Modal,
            {
              open: true,
              onClose: () => setPickerOpen(false),
              restoreRef: scanTriggerRef,
              title: '选择要分析的稿件',
              description: `会话目录里有 ${scanFiles.length} 个候选文件，宿主无法确定哪一个是论文。`,
              footer: [
                h(
                  'button',
                  {
                    key: 'rescan',
                    type: 'button',
                    className: 'dapp-btn',
                    onClick: () => {
                      setPickerOpen(false);
                      scanSession();
                    },
                  },
                  '重新扫描',
                ),
                h(
                  'button',
                  {
                    key: 'cancel',
                    type: 'button',
                    className: 'dapp-btn dapp-btn-primary',
                    onClick: () => setPickerOpen(false),
                  },
                  '取消',
                ),
              ],
            },
            h(FilePicker, {
              files: scanFiles,
              index: pickerIndex,
              onMove: setPickerIndex,
              onPick: pickFile,
            }),
          )
        : null;

      return h(
        'div',
        {
          className: 'dapp',
          style: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 },
        },
        h('style', { dangerouslySetInnerHTML: { __html: CSS } }),
        head,
        expanded
          ? h(
              'div',
              { className: 'dapp-body' },
              tabBar,
              h('div', { className: 'dapp-scroll' }, content),
            )
          : null,
        toastNode,
        pickerNode,
      );
    }

    // ── styles ──────────────────────────────────────────────────────────

    const CSS = `
/* ══ tokens ══════════════════════════════════════════════════════════════
   One scale, taken from the host's own Plugin Manager page and its right
   sidebar: type 10 / 11 / 11.5 / 12 / 12.5 / 13 / 13.5 / 14 / 18 / 20 px,
   spacing 2 / 4 / 6 / 8 / 10 / 12 / 14 / 16 / 20 / 24 px, radius 4 px and
   999 px (pill). Every colour comes from a --dsw-alias-* theme token, so
   the panel follows the host theme in light and dark mode.
   ══════════════════════════════════════════════════════════════════════ */
/* The token block is shared by the panel and by the portaled dialog: the
   dialog lives in the document body, outside the panel's own root, so it
   needs the same scale. */
.dapp,.dapp-modal-host{
  /* colour — theme tokens only, no literal colours */
  --dapp-accent: var(--dsw-alias-state-business-primary);
  --dapp-on-accent: var(--dsw-alias-label-primary-foreground);
  --dapp-accent-soft: color-mix(in srgb, var(--dapp-accent) 10%, transparent);
  --dapp-accent-line: color-mix(in srgb, var(--dapp-accent) 36%, transparent);
  --dapp-surface: var(--dsw-alias-bg-layer-1);
  --dapp-surface-2: var(--dsw-alias-bg-layer-2);
  --dapp-surface-3: var(--dsw-alias-bg-layer-3);
  --dapp-hover: var(--dsw-alias-interactive-bg-hover);
  --dapp-line: var(--dsw-alias-border-l3);
  --dapp-line-soft: var(--dsw-alias-border-l2);
  --dapp-line-strong: var(--dsw-alias-border-l4);
  --dapp-text: var(--dsw-alias-label-primary);
  --dapp-muted: var(--dsw-alias-label-secondary);
  --dapp-faint: var(--dsw-alias-label-tertiary);
  --dapp-ok: var(--dsw-alias-state-success-primary);
  --dapp-warn: var(--dsw-alias-state-warn-primary);
  --dapp-bad: var(--dsw-alias-state-error-primary);
  --dapp-info: var(--dsw-alias-link);
  --dapp-ok-soft: color-mix(in srgb, var(--dapp-ok) 10%, transparent);
  --dapp-warn-soft: var(--dsw-alias-state-warn-tertiary);
  --dapp-bad-soft: color-mix(in srgb, var(--dapp-bad) 10%, transparent);
  --dapp-info-soft: color-mix(in srgb, var(--dapp-info) 10%, transparent);
  --dapp-skeleton: var(--dsw-alias-bg-skeleton);
  /* type scale */
  --dapp-t-tag: 10px;
  --dapp-t-cap: 11px;
  --dapp-t-id: 11.5px;
  --dapp-t-meta: 12px;
  --dapp-t-ctl: 12.5px;
  --dapp-t-body: 13px;
  --dapp-t-item: 13.5px;
  --dapp-t-head: 14px;
  --dapp-t-stat: 18px;
  --dapp-t-hero: 20px;
  /* spacing scale */
  --dapp-s1: 2px;
  --dapp-s2: 4px;
  --dapp-s3: 6px;
  --dapp-s4: 8px;
  --dapp-s5: 10px;
  --dapp-s6: 12px;
  --dapp-s7: 14px;
  --dapp-s8: 16px;
  --dapp-s9: 20px;
  --dapp-s10: 24px;
  /* radius — the host's own radius tokens */
  --dapp-r-xs: var(--dsw-radius-xs);
  --dapp-r: var(--dsw-radius-sm);
  --dapp-r-lg: var(--dsw-radius-md);
  --dapp-r-pill: 999px;
  /* elevation — floating surfaces only */
  --dapp-elev: var(--dsw-elevation-prominent);
}
.dapp{
  /* the panel is a resizable track: the layout must react to the PANEL
     width, never to the viewport width — that is what a container query is
     for (the host's own pages do exactly this). */
  container-type: inline-size;
  container-name: dapp;
  min-width: 0;
  background: var(--dsw-alias-bg-base);
  font-family: inherit;
  color: var(--dapp-text);
}
.dapp-modal-host{font-family:inherit;color:var(--dapp-text)}
.dapp *,.dapp *::before,.dapp *::after{box-sizing:border-box}
.dapp button{font-family:inherit;color:inherit}
.dapp-grow{flex:1 1 auto;min-width:0}
.dapp-wrap{overflow-wrap:anywhere}
.dapp :focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-alias-state-business-primary);outline-offset:2px}
.dapp :focus:not(:focus-visible){outline:none}
.dapp-modal-host *,.dapp-modal-host *::before,.dapp-modal-host *::after{box-sizing:border-box}
.dapp-modal-host button{font-family:inherit;color:inherit}
.dapp-modal-host :focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-alias-state-business-primary);outline-offset:2px}
.dapp-modal-host :focus:not(:focus-visible){outline:none}
/* hover only where a pointer really is — a sticky hover on touch is a bug */
@media (hover:hover){
  .dapp-btn:hover{background:var(--dapp-hover)}
  .dapp-btn-primary:hover{background:color-mix(in srgb,var(--dapp-accent) 16%,transparent)}
  .dapp-btn-ghost:hover{color:var(--dapp-text);background:var(--dapp-hover)}
  .dapp-icon-btn:hover{background:var(--dapp-hover);color:var(--dapp-text)}
  .dapp-tab:hover{color:var(--dapp-text)}
  .dapp-chipbtn:hover{color:var(--dapp-text);background:var(--dapp-hover)}
  .dapp-item:hover{background:var(--dapp-hover)}
  .dapp-group-head:hover{background:var(--dapp-surface-3)}
  .dapp-fold>summary:hover{background:var(--dapp-hover)}
  .dapp-jtable tbody tr:hover{background:var(--dapp-hover)}
  .dapp-search-clear:hover{background:var(--dapp-surface-3);color:var(--dapp-text)}
}
/* a coarse pointer zooms the page when a field is focused below 16px */
@media (pointer:coarse){
  .dapp input,.dapp textarea,.dapp select{font-size:16px}
}

/* ── the sidebar chip's title ────────────────────────────────────────────
   These two rules live OUTSIDE the .dapp root (the host renders the chip),
   so they cannot use the panel's own custom properties — the values are the
   same scale, written out. */
.dapp-chip-title{display:inline-flex;align-items:center;gap:6px;font-size:13px;line-height:20px}
.dapp-chip-note{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}

/* ── header ─────────────────────────────────────────────────────────── */
.dapp-head{display:flex;align-items:center;gap:var(--dapp-s5);padding:var(--dapp-s5) var(--dapp-s6);border-bottom:.5px solid var(--dapp-line);background:var(--dapp-surface);flex:0 0 auto;min-width:0}
.dapp-mark{display:grid;place-items:center;width:26px;height:26px;border-radius:var(--dapp-r);color:var(--dapp-accent);background:var(--dapp-accent-soft);flex:0 0 auto}
.dapp-title{font-size:var(--dapp-t-item);font-weight:500;line-height:20px;letter-spacing:.01em}
.dapp-sub{font-size:var(--dapp-t-cap);color:var(--dapp-faint);line-height:16px;margin-top:var(--dapp-s1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dapp-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:6px;border-radius:var(--dapp-r);border:0;background:transparent;color:var(--dapp-muted);cursor:pointer;flex:0 0 auto;transition:background .13s ease,color .13s ease}
.dapp-icon-btn[disabled]{opacity:.5;cursor:default}

/* ── tabs ───────────────────────────────────────────────────────────── */
.dapp-tabs{display:flex;gap:var(--dapp-s1);padding:0 var(--dapp-s4);border-bottom:.5px solid var(--dapp-line);background:var(--dapp-surface);overflow-x:auto;scrollbar-width:none;flex:0 0 auto}
.dapp-tabs::-webkit-scrollbar{display:none}
.dapp-tab{position:relative;flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;height:32px;padding:0 var(--dapp-s3);font-size:var(--dapp-t-body);line-height:20px;border:0;background:transparent;color:var(--dapp-muted);cursor:pointer;white-space:nowrap;transition:color .13s ease}
.dapp-tab[data-active=true]{color:var(--dapp-accent);font-weight:500}
.dapp-tab[data-active=true]:after{content:'';position:absolute;left:var(--dapp-s2);right:var(--dapp-s2);bottom:-1px;height:2px;border-radius:var(--dapp-r-pill);background:var(--dapp-accent)}

/* ── body + scroll viewport ─────────────────────────────────────────── */
.dapp-body{display:flex;flex-direction:column;flex:1 1 auto;min-height:0;min-width:0}
.dapp-scroll{padding:var(--dapp-s5) var(--dapp-s6) var(--dapp-s8);display:grid;gap:var(--dapp-s5);align-content:start;grid-auto-rows:min-content;overflow-y:auto;overflow-x:hidden;flex:1 1 auto;min-height:0;min-width:0}
.dapp-scroll::-webkit-scrollbar{width:9px}
.dapp-scroll::-webkit-scrollbar-thumb{background:var(--dapp-line-strong);border-radius:var(--dapp-r-pill);border:2px solid transparent;background-clip:content-box}
.dapp-scroll::-webkit-scrollbar-thumb:hover{background:var(--dapp-muted);background-clip:content-box}

/* ── the view grid ──────────────────────────────────────────────────── */
/* align-content:start is load-bearing: a grid whose container is taller
   than its content distributes the leftover space to every auto-sized row, so
   a search box becomes 270px tall and the gaps between rows blow up. The
   rows must stay at their content height and the leftover space must collect
   at the bottom. */
.dapp-view{display:grid;gap:var(--dapp-s5);align-content:start;grid-template-columns:minmax(0,1fr);animation:dapp-in .18s ease both}
@keyframes dapp-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.dapp-span{grid-column:1/-1}
/* the panel is a resizable track: the breakpoints below are the PANEL's
   width, never the viewport's. 380 = the narrowest usable sidebar,
   460 = comfortable, 600 = wide enough for two columns. */
@container dapp (max-width:380px){
  .dapp-scroll{padding:var(--dapp-s4) var(--dapp-s4) var(--dapp-s7)}
  .dapp-card{padding:var(--dapp-s5);gap:var(--dapp-s3)}
  .dapp-head{padding:var(--dapp-s4) var(--dapp-s4)}
  .dapp-tabs{padding:0 var(--dapp-s3)}
  .dapp-tab{padding:0 var(--dapp-s2)}
  .dapp-facts{grid-template-columns:repeat(auto-fill,minmax(72px,1fr))}
  .dapp-summary{grid-template-columns:repeat(3,minmax(0,1fr))}
}
@container dapp (min-width:600px){
  .dapp-cols{grid-template-columns:repeat(2,minmax(0,1fr));align-items:start}
  .dapp-scroll{padding:var(--dapp-s6) var(--dapp-s7) var(--dapp-s9)}
  .dapp-card{padding:var(--dapp-s7)}
  .dapp-facts{grid-template-columns:repeat(auto-fill,minmax(96px,1fr))}
}
/* ── cards ──────────────────────────────────────────────────────────── */
.dapp-card{border:.5px solid var(--dapp-line);border-radius:var(--dapp-r);background:var(--dapp-surface);padding:var(--dapp-s6);display:grid;gap:var(--dapp-s4);min-width:0}
.dapp-card-title{display:flex;align-items:flex-start;gap:var(--dapp-s3);font-size:var(--dapp-t-head);font-weight:500;line-height:20px;min-width:0}
.dapp-card-title .dapp-grow{line-height:20px}

/* ── section head — one quiet label for the six views ───────────────── */
.dapp-sechead{display:flex;align-items:baseline;gap:var(--dapp-s3);min-width:0}
.dapp-sechead-label{font-size:var(--dapp-t-tag);font-weight:600;letter-spacing:.08em;color:var(--dapp-faint);white-space:nowrap}
.dapp-sechead-meta{margin-left:auto;font-size:var(--dapp-t-cap);color:var(--dapp-muted);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}

/* ── severity chip — one treatment in every view ────────────────────── */
.dapp-sev{display:inline-flex;align-items:center;gap:var(--dapp-s2);font-size:var(--dapp-t-tag);line-height:16px;height:18px;padding:0 7px;border-radius:var(--dapp-r-pill);border:.5px solid var(--dapp-line-strong);color:var(--dapp-muted);white-space:nowrap;flex:0 0 auto}
.dapp-sev[data-tone=bad]{color:var(--dapp-bad);border-color:color-mix(in srgb,var(--dapp-bad) 40%,transparent);background:var(--dapp-bad-soft)}
.dapp-sev[data-tone=warn]{color:var(--dapp-warn);border-color:color-mix(in srgb,var(--dapp-warn) 40%,transparent);background:var(--dapp-warn-soft)}
.dapp-sev[data-tone=info]{color:var(--dapp-info);border-color:color-mix(in srgb,var(--dapp-info) 40%,transparent);background:var(--dapp-info-soft)}

/* ── text ───────────────────────────────────────────────────────────── */
.dapp-rid{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:var(--dapp-t-id);color:var(--dapp-faint);overflow-wrap:anywhere;line-height:16px}
.dapp-rule-body{font-size:var(--dapp-t-body);line-height:20px;color:var(--dapp-text)}
.dapp-rule-body b{font-weight:600}
.dapp-fix{font-size:var(--dapp-t-body);line-height:20px;border-left:2px solid var(--dapp-accent-line);padding:0 0 0 var(--dapp-s4);color:var(--dapp-text)}
.dapp-src{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:var(--dapp-t-id);color:var(--dapp-faint);overflow-wrap:anywhere;line-height:16px}
.dapp-hint{font-size:var(--dapp-t-meta);line-height:18px;color:var(--dapp-muted);overflow-wrap:anywhere}
.dapp-hintline{font-size:var(--dapp-t-cap);line-height:16px;color:var(--dapp-faint);font-variant-numeric:tabular-nums}
.dapp-list{margin:0;padding-left:var(--dapp-s7);font-size:var(--dapp-t-body);line-height:20px;color:var(--dapp-muted)}
.dapp-list li{margin:var(--dapp-s2) 0}
.dapp-list-warn li{color:var(--dapp-text)}

/* ── badges ─────────────────────────────────────────────────────────── */
.dapp-badge{display:inline-flex;align-items:center;gap:var(--dapp-s2);font-size:var(--dapp-t-tag);line-height:16px;height:18px;padding:0 7px;border-radius:var(--dapp-r-pill);border:.5px solid var(--dapp-line-strong);color:var(--dapp-muted);white-space:nowrap}
.dapp-badge[data-kind=skill]{color:var(--dapp-accent);border-color:var(--dapp-accent-line);background:var(--dapp-accent-soft)}
.dapp-badge[data-kind=prompt]{color:var(--dapp-info);border-color:color-mix(in srgb,var(--dapp-info) 40%,transparent);background:var(--dapp-info-soft)}
.dapp-badge[data-kind=prompt-en]{color:var(--dapp-muted);background:var(--dapp-surface-2)}
.dapp-badge[data-kind=reference]{color:var(--dapp-warn);border-color:color-mix(in srgb,var(--dapp-warn) 40%,transparent);background:var(--dapp-warn-soft)}

/* ── buttons ────────────────────────────────────────────────────────── */
.dapp-btn{display:inline-flex;align-items:center;justify-content:center;gap:var(--dapp-s2);height:26px;padding:0 var(--dapp-s4);font-size:var(--dapp-t-ctl);line-height:20px;border-radius:var(--dapp-r);border:.5px solid var(--dapp-line-strong);background:var(--dapp-surface);color:var(--dapp-text);cursor:pointer;white-space:nowrap;transition:background .13s ease,border-color .13s ease,color .13s ease}
.dapp-btn:active{transform:scale(.985)}
.dapp-btn-primary{border-color:var(--dapp-accent);color:var(--dapp-accent);background:var(--dapp-accent-soft)}
.dapp-btn-ghost{border-color:transparent;background:transparent;color:var(--dapp-muted)}
.dapp-btn[disabled]{opacity:.5;cursor:default}
.dapp-actions{display:flex;gap:var(--dapp-s3);flex-wrap:wrap;align-items:center;min-width:0}
.dapp-search-clear{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;padding:0;border:0;border-radius:var(--dapp-r-pill);background:var(--dapp-surface-2);color:var(--dapp-muted);cursor:pointer;flex:0 0 auto;transition:background .13s ease,color .13s ease}
/* ── forms ──────────────────────────────────────────────────────────── */
.dapp-label{font-size:var(--dapp-t-tag);font-weight:600;letter-spacing:.08em;color:var(--dapp-faint)}
.dapp-k{font-size:var(--dapp-t-meta);color:var(--dapp-muted)}
.dapp-field{display:grid;grid-template-columns:72px minmax(0,1fr);gap:var(--dapp-s4);align-items:center;min-width:0}
.dapp-select{font:inherit;font-size:var(--dapp-t-ctl);line-height:20px;height:30px;padding:0 var(--dapp-s3);border-radius:var(--dapp-r);border:.5px solid var(--dapp-line-strong);background:var(--dapp-surface-3);color:var(--dapp-text);width:100%;min-width:0;cursor:pointer;transition:border-color .13s ease}
.dapp-textarea{width:100%;min-height:120px;height:clamp(120px,20vh,240px);max-height:320px;resize:vertical;font:inherit;font-size:var(--dapp-t-ctl);line-height:20px;padding:var(--dapp-s4);border-radius:var(--dapp-r);border:.5px solid var(--dapp-line-strong);background:var(--dapp-surface-3);color:var(--dapp-text)}
.dapp-textarea:focus{outline:none;border-color:var(--dapp-accent);box-shadow:0 0 0 2px var(--dapp-accent-soft)}
/* a narrow sidebar cannot afford a 72px label column next to the field */
@container dapp (max-width:420px){
  .dapp-field{grid-template-columns:minmax(0,1fr);gap:var(--dapp-s2)}
}

/* ── checklist ──────────────────────────────────────────────────────── */
.dapp-check-head{display:flex;align-items:center;gap:var(--dapp-s4);font-size:var(--dapp-t-meta);color:var(--dapp-muted);min-width:0}
.dapp-track{flex:1 1 auto;min-width:40px;height:6px;border-radius:var(--dapp-r-pill);background:var(--dapp-surface-3);overflow:hidden}
.dapp-fill{display:block;height:100%;background:var(--dapp-accent);transition:width .25s cubic-bezier(.4,0,.2,1)}
.dapp-group{border:.5px solid var(--dapp-line);border-radius:var(--dapp-r);background:var(--dapp-surface);overflow:hidden;min-width:0}
.dapp-group-head{display:flex;align-items:center;gap:var(--dapp-s3);width:100%;padding:var(--dapp-s3) var(--dapp-s4);background:var(--dapp-surface-2);border:0;border-bottom:.5px solid var(--dapp-line-soft);font:inherit;font-size:var(--dapp-t-head);font-weight:500;line-height:20px;color:var(--dapp-text);text-align:left;cursor:pointer;transition:background .13s ease}
.dapp-group-name{flex:1 1 auto;min-width:0;font-size:var(--dapp-t-head);font-weight:500;line-height:20px;overflow-wrap:anywhere}
.dapp-group-count{font-size:var(--dapp-t-cap);color:var(--dapp-muted);font-variant-numeric:tabular-nums;flex:0 0 auto}
.dapp-chevron{color:var(--dapp-faint);transition:transform .16s ease;flex:0 0 auto}
.dapp-items{padding:var(--dapp-s1) var(--dapp-s3) var(--dapp-s3)}
.dapp-item{display:flex;gap:var(--dapp-s3);align-items:flex-start;padding:var(--dapp-s3) var(--dapp-s2);border-radius:var(--dapp-r);font-size:var(--dapp-t-body);line-height:20px;transition:background .13s ease;min-width:0}
.dapp-box{flex:0 0 auto;width:16px;height:16px;margin-top:2px;padding:0;border-radius:var(--dapp-r-xs);border:1.5px solid var(--dapp-line-strong);background:transparent;display:grid;place-items:center;color:transparent;cursor:pointer;transition:background .13s ease,border-color .13s ease,color .13s ease}
.dapp-item[data-checked=true] .dapp-box{border-color:var(--dapp-accent);background:var(--dapp-accent-soft);color:var(--dapp-accent)}
.dapp-item[data-checked=true] .dapp-item-text{text-decoration:line-through;color:var(--dapp-faint)}
.dapp-item-text{min-width:0;overflow-wrap:anywhere}
.dapp-item-meta{display:flex;align-items:center;gap:var(--dapp-s2);flex-wrap:wrap;margin-top:var(--dapp-s2)}
.dapp-status{display:flex;align-items:flex-start;gap:var(--dapp-s3);margin:0;font-size:var(--dapp-t-body);line-height:20px;color:var(--dapp-faint)}
.dapp-status-dot{width:6px;height:6px;border-radius:var(--dapp-r-pill);flex:0 0 auto;margin-top:7px;background:var(--dapp-muted)}
.dapp-status[data-tone=ok] .dapp-status-dot{background:var(--dapp-ok)}
.dapp-status[data-tone=warn] .dapp-status-dot{background:var(--dapp-warn)}
.dapp-ringp{position:relative;width:32px;height:32px;flex:0 0 auto}
.dapp-ringp-label{position:absolute;inset:0;display:grid;place-items:center;font-size:var(--dapp-t-tag);font-weight:500;font-variant-numeric:tabular-nums;color:var(--dapp-muted)}
/* ── search ─────────────────────────────────────────────────────────── */
.dapp-search{display:flex;align-items:center;gap:var(--dapp-s3);padding:0 var(--dapp-s4);height:32px;border-radius:var(--dapp-r);border:.5px solid var(--dapp-line-strong);background:var(--dapp-surface);color:var(--dapp-faint);transition:border-color .13s ease,box-shadow .13s ease;min-width:0}
.dapp-search:focus-within{border-color:var(--dapp-accent);box-shadow:0 0 0 2px var(--dapp-accent-soft)}
.dapp-search input{flex:1 1 auto;min-width:0;height:30px;font:inherit;font-size:var(--dapp-t-ctl);border:0;outline:none;background:transparent;color:var(--dapp-text)}
.dapp-search input::placeholder{color:var(--dapp-faint)}

/* ── chips ──────────────────────────────────────────────────────────── */
.dapp-chiprow{display:flex;flex-wrap:wrap;gap:var(--dapp-s3);min-width:0}
.dapp-chiprow-scroll{flex-wrap:nowrap;overflow-x:auto;padding-bottom:var(--dapp-s1);scrollbar-width:none}
.dapp-chiprow-scroll::-webkit-scrollbar{display:none}
.dapp-chiprow-scroll>*{flex:0 0 auto}
.dapp-chipbtn{display:inline-flex;align-items:center;gap:var(--dapp-s2);height:26px;padding:0 var(--dapp-s5);font-size:var(--dapp-t-ctl);line-height:20px;border-radius:var(--dapp-r-pill);border:.5px solid var(--dapp-line-strong);background:transparent;color:var(--dapp-muted);cursor:pointer;white-space:nowrap;transition:background .13s ease,border-color .13s ease,color .13s ease}
.dapp-chipbtn[data-on=true]{border-color:var(--dapp-accent);color:var(--dapp-accent);background:var(--dapp-accent-soft);font-weight:500}

/* ── toolbar ────────────────────────────────────────────────────────── */
.dapp-toolbar{display:grid;gap:var(--dapp-s4);min-width:0}
.dapp-fgroup{display:grid;gap:var(--dapp-s3);min-width:0}

/* ── manual ─────────────────────────────────────────────────────────── */
.dapp-file{display:grid;gap:var(--dapp-s2);padding:var(--dapp-s5);border-bottom:.5px solid var(--dapp-line-soft);min-width:0}
.dapp-file:last-child{border-bottom:0}
.dapp-file-top{display:flex;align-items:flex-start;gap:var(--dapp-s3);min-width:0}
.dapp-file-title{font-size:var(--dapp-t-item);font-weight:500;line-height:20px;min-width:0;overflow-wrap:anywhere}
.dapp-file-path{font-size:var(--dapp-t-id);color:var(--dapp-faint);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere;line-height:16px}
.dapp-file-sub{font-size:var(--dapp-t-meta);color:var(--dapp-muted);line-height:18px;overflow-wrap:anywhere}
.dapp-file-snip{margin-top:var(--dapp-s2);font-size:var(--dapp-t-meta);line-height:18px;color:var(--dapp-text);background:var(--dapp-surface-2);border-left:2px solid var(--dapp-accent-line);border-radius:0 var(--dapp-r) var(--dapp-r) 0;padding:var(--dapp-s3) var(--dapp-s4);overflow-wrap:anywhere}
.dapp-file-snip-no{margin-right:var(--dapp-s3);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:var(--dapp-t-id);color:var(--dapp-faint)}
.dapp-chips{display:flex;flex-wrap:wrap;gap:var(--dapp-s3)}

/* ── empty state ────────────────────────────────────────────────────── */
.dapp-empty{display:grid;gap:var(--dapp-s3);justify-items:center;text-align:center;padding:var(--dapp-s9) var(--dapp-s6);border:.5px dashed var(--dapp-line-strong);border-radius:var(--dapp-r);background:var(--dapp-surface);color:var(--dapp-muted);min-width:0}
.dapp-empty-mark{display:grid;place-items:center;width:28px;height:28px;border-radius:var(--dapp-r-pill);background:var(--dapp-surface-2);color:var(--dapp-muted)}
.dapp-empty-title{font-size:var(--dapp-t-body);font-weight:500;color:var(--dapp-text)}
.dapp-empty-hint{font-size:var(--dapp-t-meta);line-height:18px;max-width:30em}

/* ── pattern row (句式库) ───────────────────────────────────────────── */
.dapp-pattern{display:flex;gap:var(--dapp-s4);align-items:flex-start;padding:var(--dapp-s4) 0;border-bottom:.5px solid var(--dapp-line-soft);min-width:0}
.dapp-pattern:last-child{border-bottom:0}
.dapp-pattern-title{font-size:var(--dapp-t-ctl);font-weight:500;line-height:18px}
.dapp-pattern-body{font-size:var(--dapp-t-meta);color:var(--dapp-muted);line-height:18px;margin-top:var(--dapp-s1)}
/* ── de-AI score ────────────────────────────────────────────────────── */
.dapp-meter{height:6px;border-radius:var(--dapp-r-pill);background:var(--dapp-surface-3);overflow:hidden}
.dapp-meter span{display:block;height:100%;border-radius:var(--dapp-r-pill);transition:width .3s cubic-bezier(.4,0,.2,1)}
.dapp-score-big{font-size:var(--dapp-t-hero);font-weight:600;font-variant-numeric:tabular-nums;line-height:24px}
.dapp-score-big[data-tone=ok]{color:var(--dapp-ok)}
.dapp-score-big[data-tone=warn]{color:var(--dapp-warn)}
.dapp-score-big[data-tone=bad]{color:var(--dapp-bad)}
.dapp-match{justify-self:start;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:var(--dapp-t-id);background:var(--dapp-surface-2);border-radius:var(--dapp-r-xs);padding:var(--dapp-s1) var(--dapp-s3);display:inline-block;max-width:100%;overflow-wrap:anywhere}
@media (prefers-reduced-motion:reduce){.dapp-view{animation:none}.dapp-fill,.dapp-meter span{transition:none}}

/* ── journal detail ─────────────────────────────────────────────────── */
.dapp-facts{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:.5px;background:var(--dapp-line-soft);border:.5px solid var(--dapp-line-soft);border-radius:var(--dapp-r);overflow:hidden}
.dapp-fact{background:var(--dapp-surface);padding:var(--dapp-s4);display:grid;gap:var(--dapp-s1);min-width:0}
.dapp-fact-k{font-size:var(--dapp-t-tag);color:var(--dapp-faint)}
.dapp-fact-v{font-size:var(--dapp-t-ctl);font-weight:600;line-height:18px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.dapp-kv{display:grid;grid-template-columns:minmax(72px,36%) minmax(0,1fr);gap:var(--dapp-s3) var(--dapp-s4);font-size:var(--dapp-t-body);line-height:20px}
.dapp-kv dt{color:var(--dapp-muted);overflow-wrap:anywhere}
.dapp-kv dd{margin:0;overflow-wrap:anywhere}

/* ── fold (句式库) ──────────────────────────────────────────────────── */
.dapp-fold{border:.5px solid var(--dapp-line);border-radius:var(--dapp-r);background:var(--dapp-surface);overflow:hidden;min-width:0}
.dapp-fold>summary{display:flex;align-items:center;gap:var(--dapp-s3);list-style:none;cursor:pointer;padding:var(--dapp-s4) var(--dapp-s5);font-size:var(--dapp-t-head);font-weight:500;line-height:20px;transition:background .13s ease}
.dapp-fold>summary::-webkit-details-marker{display:none}
.dapp-fold-body{padding:var(--dapp-s3) var(--dapp-s5) var(--dapp-s5);border-top:.5px solid var(--dapp-line-soft);display:grid;gap:var(--dapp-s4)}
.dapp-fold-count{margin-left:auto;font-size:var(--dapp-t-cap);font-weight:400;color:var(--dapp-faint);font-variant-numeric:tabular-nums}
.dapp-fold[open] .dapp-chevron{transform:rotate(90deg)}


/* ── capability dashboard ───────────────────────────────────────────── */
.dapp-scroll>*{min-width:0}
.dapp-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--dapp-s3)}
.dapp-summary-cell{border:.5px solid var(--dapp-line);border-radius:var(--dapp-r);padding:var(--dapp-s4);background:var(--dapp-surface);display:grid;gap:var(--dapp-s1);min-width:0}
.dapp-summary-num{font-size:var(--dapp-t-stat);font-weight:600;line-height:24px;font-variant-numeric:tabular-nums}
.dapp-summary-num[data-tone=bad]{color:var(--dapp-bad)}
.dapp-summary-num[data-tone=warn]{color:var(--dapp-warn)}
.dapp-summary-num[data-tone=info]{color:var(--dapp-info)}
.dapp-summary-k{font-size:var(--dapp-t-tag);color:var(--dapp-faint);white-space:nowrap}
.dapp-verdictbar{display:flex;align-items:center;gap:var(--dapp-s3);padding:var(--dapp-s4) var(--dapp-s5);border-radius:var(--dapp-r);border:.5px solid var(--dapp-line);background:var(--dapp-surface-2);font-size:var(--dapp-t-body);font-weight:500;line-height:20px}
.dapp-verdictbar[data-state=ok]{border-color:color-mix(in srgb,var(--dapp-ok) 40%,transparent)}
.dapp-verdictbar[data-state=bad]{border-color:color-mix(in srgb,var(--dapp-bad) 40%,transparent)}
.dapp-verdict-dot{width:7px;height:7px;border-radius:var(--dapp-r-pill);flex:0 0 auto;background:var(--dapp-muted)}
.dapp-verdictbar[data-state=ok] .dapp-verdict-dot{background:var(--dapp-ok)}
.dapp-verdictbar[data-state=bad] .dapp-verdict-dot{background:var(--dapp-bad)}
.dapp-verdictbar .dapp-grow{min-width:0}

/* ── journal table ──────────────────────────────────────────────────── */
/* The table scrolls horizontally inside .dapp-tablewrap — the columns stay
   reachable at every width, and the FIRST column (the journal name) wraps
   instead of being clipped. */
.dapp-tablewrap{width:100%;max-width:100%;overflow-x:auto;border:.5px solid var(--dapp-line);border-radius:var(--dapp-r);background:var(--dapp-surface)}
.dapp-jtable{width:100%;min-width:100%;border-collapse:separate;border-spacing:0;font-size:var(--dapp-t-body)}
.dapp-jtable th,.dapp-jtable td{padding:var(--dapp-s3) var(--dapp-s4);text-align:left;border-bottom:.5px solid var(--dapp-line-soft);vertical-align:top}
.dapp-jtable td{white-space:nowrap;font-variant-numeric:tabular-nums}
.dapp-jtable th:first-child,.dapp-jtable td:first-child{white-space:normal;min-width:140px;font-weight:500;color:var(--dapp-text)}
.dapp-jtable td[data-sort=publisher]{white-space:normal;max-width:160px}
.dapp-jtable td[data-sort=structure]{white-space:normal;max-width:200px}
.dapp-jtable thead th{position:sticky;top:0;background:var(--dapp-surface);z-index:1;font-size:var(--dapp-t-cap);color:var(--dapp-muted);font-weight:600;cursor:pointer;user-select:none;white-space:nowrap}
.dapp-jtable tbody tr{cursor:pointer;transition:background .13s ease}
.dapp-jtable tbody tr[data-on=true]{background:var(--dapp-accent-soft)}
.dapp-jtable tbody tr:last-child td{border-bottom:0}

/* ── the modal layer ────────────────────────────────────────────────── */
/* The behaviour is the Harness' own Modal primitive (the reference copy is
   kept in preview/host-reference/Modal.tsx + useModalLayer.ts): portaled to
   the document body, the focus trapped while it is open, Escape closes it,
   the focus returns to the trigger, a backdrop click closes it,
   role="dialog" + aria-modal + an accessible name, the body scroll locked. */
.dapp-modal-host{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:var(--dapp-s10);pointer-events:auto}
.dapp-modal-mask{position:absolute;inset:0;background:var(--dsw-alias-bg-mask-1);backdrop-filter:var(--dsw-mask-blur)}
.dapp-modal-dialog{position:relative;z-index:1;display:flex;flex-direction:column;gap:var(--dapp-s6);width:min(560px,100%);max-width:100%;min-width:0;max-height:100%;border:.5px solid var(--dapp-line);border-radius:var(--dapp-r-lg);background:var(--dapp-surface-2);box-shadow:var(--dapp-elev);overflow:hidden}
.dapp-modal-head{display:flex;align-items:center;justify-content:space-between;gap:var(--dapp-s4);padding:var(--dapp-s6) var(--dapp-s6) 0}
.dapp-modal-title{margin:0;font-size:var(--dapp-t-head);font-weight:500;line-height:20px;overflow-wrap:anywhere}
.dapp-modal-close{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:6px;border-radius:var(--dapp-r);border:0;background:transparent;color:var(--dapp-muted);cursor:pointer;transition:background .13s ease,color .13s ease}
.dapp-modal-desc{margin:0;padding:0 var(--dapp-s6);font-size:var(--dapp-t-meta);line-height:18px;color:var(--dapp-muted);overflow-wrap:anywhere}
.dapp-modal-body{display:flex;flex-direction:column;gap:var(--dapp-s4);min-width:0;padding:var(--dapp-s6);overflow-y:auto}
.dapp-modal-foot{display:flex;align-items:center;justify-content:flex-end;gap:var(--dapp-s4);padding:0 var(--dapp-s6) var(--dapp-s6)}
@media (hover:hover){
  .dapp-modal-close:hover{background:var(--dapp-hover);color:var(--dapp-text)}
  .dapp-picker-row:hover{background:var(--dapp-hover)}
  .dapp-picker-row[data-on=true]:hover{background:var(--dapp-accent-soft)}
}

/* ── the file picker ─────────────────────────────────────────────────── */
.dapp-picker{display:grid;gap:var(--dapp-s4);min-width:0}
.dapp-picker-list{display:grid;gap:var(--dapp-s3);min-width:0;max-height:min(52vh,420px);overflow-y:auto;overflow-x:hidden;padding:var(--dapp-s1)}
.dapp-picker-row{display:grid;gap:var(--dapp-s2);width:100%;padding:var(--dapp-s5);border:.5px solid var(--dapp-line);border-radius:var(--dapp-r);background:var(--dapp-surface);text-align:left;cursor:pointer;transition:background .13s ease,border-color .13s ease;min-width:0}
.dapp-picker-row[data-on=true]{border-color:var(--dapp-accent);background:var(--dapp-accent-soft)}
.dapp-picker-row[data-blocked=true]{opacity:.65;cursor:not-allowed}
.dapp-picker-top{display:flex;align-items:center;gap:var(--dapp-s3);min-width:0}
.dapp-picker-name{flex:1 1 auto;min-width:0;font-size:var(--dapp-t-item);font-weight:500;line-height:20px;overflow-wrap:anywhere}
.dapp-picker-score{flex:0 0 auto;display:inline-flex;align-items:center;height:18px;padding:0 7px;font-size:var(--dapp-t-tag);line-height:16px;font-variant-numeric:tabular-nums;color:var(--dapp-faint);border:.5px solid var(--dapp-line-strong);border-radius:var(--dapp-r-pill)}
.dapp-picker-score[data-kind=manuscript]{color:var(--dapp-accent);border-color:var(--dapp-accent-line);background:var(--dapp-accent-soft)}
.dapp-picker-meta{font-size:var(--dapp-t-id);line-height:16px;color:var(--dapp-faint);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.dapp-picker-reasons{font-size:var(--dapp-t-meta);line-height:18px;color:var(--dapp-muted);overflow-wrap:anywhere}
.dapp-picker-blocked{font-size:var(--dapp-t-cap);line-height:16px;color:var(--dapp-warn);overflow-wrap:anywhere}
.dapp-picker-hint{font-size:var(--dapp-t-cap);line-height:16px;color:var(--dapp-faint);text-align:center}

/* ── the manuscript view ─────────────────────────────────────────────── */
.dapp-path{display:flex;align-items:center;gap:var(--dapp-s3);min-width:0;color:var(--dapp-muted)}
.dapp-path-text{flex:1 1 auto;min-width:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:var(--dapp-t-id);line-height:16px;color:var(--dapp-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dapp-warnline{font-size:var(--dapp-t-cap);line-height:16px;color:var(--dapp-warn);overflow-wrap:anywhere}
.dapp-chip-sec{gap:var(--dapp-s3)}
.dapp-chip-sec-title{font-weight:500}
.dapp-chip-sec-words{font-size:var(--dapp-t-cap);color:var(--dapp-faint);font-variant-numeric:tabular-nums}
.dapp-chip-sec-hard{display:inline-flex;align-items:center;gap:var(--dapp-s2);font-size:var(--dapp-t-cap);line-height:16px;color:var(--dapp-bad);font-variant-numeric:tabular-nums}
.dapp-dot{width:6px;height:6px;border-radius:var(--dapp-r-pill);background:var(--dapp-muted);flex:0 0 auto}
.dapp-dot[data-tone=bad]{background:var(--dapp-bad)}
.dapp-dot[data-tone=warn]{background:var(--dapp-warn)}
.dapp-dot[data-tone=info]{background:var(--dapp-info)}

/* ── loading / error ────────────────────────────────────────────────── */
/* the host's loading visual: a skeleton bar on the real line height */
.dapp-skel{display:grid;gap:var(--dapp-s4);padding:var(--dapp-s6);border:.5px solid var(--dapp-line);border-radius:var(--dapp-r);background:var(--dapp-surface)}
.dapp-skel-text{display:flex;flex-direction:column;height:1lh}
.dapp-skel-bar{width:100%;height:12px;border-radius:var(--dapp-r-xs);background:var(--dapp-skeleton);animation:dapp-skeleton 2s cubic-bezier(.36,0,.64,1) infinite}
@keyframes dapp-skeleton{0%,100%{opacity:.6}50%{opacity:1}}
.dapp-state{display:grid;gap:var(--dapp-s3);padding:var(--dapp-s5) var(--dapp-s6);border:.5px solid var(--dapp-line);border-left:2px solid var(--dapp-line-strong);border-radius:var(--dapp-r);background:var(--dapp-surface);font-size:var(--dapp-t-body);line-height:20px;color:var(--dapp-muted);min-width:0}
.dapp-state[data-tone=bad]{border-left-color:var(--dapp-bad)}
.dapp-state[data-tone=warn]{border-left-color:var(--dapp-warn)}
.dapp-state-head{display:flex;align-items:center;gap:var(--dapp-s3);min-width:0}
.dapp-state-title{font-size:var(--dapp-t-ctl);font-weight:600;color:var(--dapp-text)}
.dapp-state-mark{display:grid;place-items:center;flex:0 0 auto;color:var(--dapp-muted)}
.dapp-state[data-tone=bad] .dapp-state-mark{color:var(--dapp-bad)}
.dapp-state[data-tone=warn] .dapp-state-mark{color:var(--dapp-warn)}
.dapp-state-body{overflow-wrap:anywhere}

/* ── toast ──────────────────────────────────────────────────────────── */
.dapp-toast{flex:0 0 auto;padding:var(--dapp-s3) var(--dapp-s5);border-radius:var(--dapp-r);font-size:var(--dapp-t-body);line-height:20px;border:.5px solid var(--dapp-line-strong);background:var(--dapp-surface-2);color:var(--dapp-text);box-shadow:var(--dapp-elev)}
.dapp-toast[data-tone=bad]{border-color:color-mix(in srgb,var(--dapp-bad) 50%,transparent)}
.dapp-toast[data-tone=warn]{border-color:color-mix(in srgb,var(--dapp-warn) 50%,transparent)}
.dapp-toast[data-tone=ok]{border-color:color-mix(in srgb,var(--dapp-ok) 50%,transparent)}

@media (prefers-reduced-motion:reduce){
  .dapp-view{animation:none}
  .dapp-fill,.dapp-meter span{transition:none}
  .dapp-skel-bar{animation:none}
  .dapp-btn:active{transform:none}
  .dapp-chevron{transition:none}
  .dapp-jtable tbody tr{transition:none}
}
`;

    // ── registration ────────────────────────────────────────────────────

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        registerLocale(ctx);
        refreshLiveIndex();

        // The right Sidebar: a tab type, a guide entry, and the page body.
        // `ctx.inject` hands the callback a CHILD scope that owns the named
        // services — the outer context does not have them, so every use goes
        // through `scope`.
        try {
          ctx.inject(['sidebarRightTabs'], (scope) => {
            scope.effect(
              () =>
                scope.sidebarRightTabs.register({
                  id: TAB_ID,
                  kind: TAB_KIND,
                  priority: 'extension',
                  title: () => translate('type.label'),
                  guide: [
                    {
                      id: 'assistant',
                      order: 40,
                      title: () => translate('guide.title'),
                      description: () => translate('guide.description'),
                      icon: GuideIcon,
                    },
                  ],
                }),
              'dsh-academic-paper-polish: right sidebar tab type',
            );

            // The chip's live title. The host renders it outside this
            // component's tree, so it is a second registration under the
            // same key — exactly what the host's own sidebar-files package
            // does. It is registered FIRST so that the tab BODY stays the
            // last registration under this key.
            try {
              scope.slots.inject('sidebar.right.pane.tab.title', () =>
                scope.slots.register(
                  {
                    name: 'sidebar.right.pane.tab.title',
                    key: TAB_ID,
                  },
                  PanelTitle,
                ),
              );
            } catch {
              /* the host does not offer the title slot — the chip keeps the tab title */
            }

            scope.slots.inject('sidebar.right.pane.tab', () =>
              scope.slots.register(
                {
                  name: 'sidebar.right.pane.tab',
                  key: TAB_ID,
                  locale: NS,
                },
                (props) => h(Panel, { ...props, ctx: scope }),
              ),
            );
          });
        } catch {
          /* the right-Sidebar package is absent — the panel stays unregistered */
        }
      },
    };
  },
});
