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
    const { useState, useEffect, useMemo, useRef } = React;

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
      'guide.description': '规则速查 · 选刊 · 实时合规检查 · 去 AI 化 · 投稿清单',
    };

    const DICT_EN = {
      'panel.title': 'Paper assistant',
      'panel.rules': 'Rules',
      'panel.journals': 'Journals',
      'panel.check': 'Check',
      'panel.deai': 'De-AI',
      'panel.checklist': 'Checklist',
      'panel.manual': 'Manual',
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
      'guide.description': 'Rules, journals, live compliance check, de-AI scan, submission checklist',
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
[
  {
    "path": "SKILL.md",
    "kind": "skill",
    "title": "学术论文写作与润色全流程",
    "subtitle": "name: academic-paper-polish",
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
      "先定期刊",
      "模块索引",
      "跨模块通",
      "倒金字塔",
      "引文密度",
      "走完六步",
      "未来方向"
    ],
    "bytes": 30879
  },
  {
    "path": "docs/COMPATIBILITY.md",
    "kind": "doc",
    "title": "AI 工具兼容性矩阵",
    "subtitle": "本仓库采用双轨适配：",
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
      "Claude",
      "兼容性矩阵",
      "规则未加载",
      "结论先行",
      "安装路径",
      "获得完整",
      "渐进披露",
      "Code"
    ],
    "bytes": 7253
  },
  {
    "path": "docs/PROMPTS-EN.md",
    "kind": "doc",
    "title": "Academic Paper Polish — English",
    "subtitle": "1. Open the module you need in skills/academic-paper-polish/prompts-en/",
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
      "academic-paper-polish",
      "prompts-en",
      "skills",
      "must",
      "installation",
      "Conclusions",
      "limitations",
      "repository"
    ],
    "bytes": 10387
  },
  {
    "path": "prompts-en/01-abstract.md",
    "kind": "prompt-en",
    "title": "Module 1 · Abstract Polish",
    "subtitle": "1. 2–3 sentences of basic-level introduction to the field",
    "headings": [
      "Review dimensions",
      "Journal constraints to apply",
      "The four-part Nature summary paragraph",
      "v2.16.0 - Abstract in METHOD-CLASS papers"
    ],
    "keywords": [
      "METHOD-CLASS",
      "introduction",
      "constraints",
      "basic-level",
      "dimensions",
      "four-part",
      "paragraph",
      "sentences"
    ],
    "bytes": 4333
  },
  {
    "path": "prompts-en/02-introduction.md",
    "kind": "prompt-en",
    "title": "Module 2 · Introduction Polish",
    "subtitle": "The most common failure of an introduction is not poor writing — it is a mismatch between the question posed a",
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
      "contribution",
      "papers",
      "common",
      "Section-navigation",
      "Introduction",
      "METHOD-CLASS",
      "method-class",
      "introduction"
    ],
    "bytes": 6484
  },
  {
    "path": "prompts-en/03-literature-review.md",
    "kind": "prompt-en",
    "title": "Module 3 · Literature Review Polish",
    "subtitle": "A review is not a longer research paper. It has its own skeleton:",
    "headings": [
      "Review article structure",
      "Three genres compared",
      "Three-part introduction (review version)",
      "Six ways to organise subheadings",
      "🔴 The 18-step review workflow",
      "🔴 Reference requirements",
      "🔴 Earth-Science Reviews scope note"
    ],
    "keywords": [
      "review",
      "Earth-Science",
      "introduction",
      "requirements",
      "subheadings",
      "Three-part",
      "structure",
      "Reference"
    ],
    "bytes": 6174
  },
  {
    "path": "prompts-en/04-methods.md",
    "kind": "prompt-en",
    "title": "Module 4 · Methods Polish",
    "subtitle": "1. Objective description of the regional geological setting, climatic background, environmental parameters",
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
      "most",
      "additions",
      "often",
      "Data",
      "experimental-science",
      "Evidence-based",
      "Earth-science",
      "environmental"
    ],
    "bytes": 7151
  },
  {
    "path": "prompts-en/05-results.md",
    "kind": "prompt-en",
    "title": "Module 5 · Results Polish",
    "subtitle": "The same body of results is reorganised along different axes in the two sections:",
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
      "different",
      "Results",
      "axes",
      "same",
      "palaeontology-specific",
      "Journal-specific",
      "technical-check",
      "requirements"
    ],
    "bytes": 7950
  },
  {
    "path": "prompts-en/06-discussion.md",
    "kind": "prompt-en",
    "title": "Module 6 · Discussion Polish",
    "subtitle": "1. First — measurable only at −0.4 V vs SHE for EAC and 0.7 V vs SHE for EDC, constrained by the lack of suita",
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
      "SHE",
      "Environmental",
      "significance",
      "METHOD-CLASS",
      "Limitations",
      "limitations",
      "constrained",
      "discussion"
    ],
    "bytes": 6979
  },
  {
    "path": "prompts-en/07-conclusion.md",
    "kind": "prompt-en",
    "title": "Module 7 · Conclusion Polish",
    "subtitle": "1. Summary and highlight — the significance of the work at a high level; foreground the innovation",
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
      "conclusion",
      "must",
      "interchangeable",
      "METHOD-CLASS",
      "method-class",
      "significance",
      "Conclusions",
      "descriptive"
    ],
    "bytes": 4280
  },
  {
    "path": "prompts-en/08-deai-polish.md",
    "kind": "prompt-en",
    "title": "Module 8 · De-AI Polish (final whole-manuscript pass)",
    "subtitle": "Some journals (certain Elsevier titles, for example) require a declaration of AI use. If AI-assisted polishing",
    "headings": [
      "AI high-frequency word blacklist",
      "🔴 What de-AI polish must never do",
      "⚠️ Do not de-AI the reference list"
    ],
    "keywords": [
      "de-AI",
      "Acknowledgements",
      "high-frequency",
      "declaration",
      "AI-assisted",
      "blacklist",
      "reference",
      "polishing"
    ],
    "bytes": 3988
  },
  {
    "path": "prompts-en/09-journal-submission.md",
    "kind": "prompt-en",
    "title": "Module 9 · Journal Matching & Submission",
    "subtitle": "1. A cover letter is mandatory for every submission",
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
      "letter",
      "Post-submission",
      "probabilities",
      "Front-matter",
      "expectations",
      "denominators",
      "availability",
      "formulations"
    ],
    "bytes": 10171
  },
  {
    "path": "prompts-en/10-reviewer-response.md",
    "kind": "prompt-en",
    "title": "Module 10 · Responding to Reviewers",
    "subtitle": "Reviewer: \"N2 purging may not remove all O2; please provide post-treatment dissolved oxygen data.\"",
    "headings": [
      "🔴 The four elements (worked example)",
      "🔴 Six disciplines (check each)",
      "🔴 What reviewers check (reverse self-audit)",
      "Elsevier's \"ACCEPTANCE\" checklist",
      "Finding reviewers",
      "Major vs minor revision"
    ],
    "keywords": [
      "reviewers",
      "check",
      "post-treatment",
      "disciplines",
      "self-audit",
      "ACCEPTANCE",
      "checklist",
      "dissolved"
    ],
    "bytes": 4838
  },
  {
    "path": "prompts/01-abstract.md",
    "kind": "prompt",
    "title": "模块 1 · 摘要润色（Abstract）",
    "subtitle": "详见 ../references/journal-constraints.md。",
    "headings": [
      "评审维度速查",
      "地学 / SCI 期刊补充约束"
    ],
    "keywords": [
      "评审维度速查",
      "期刊补充约束",
      "地学",
      "详见",
      "references",
      "SCI"
    ],
    "bytes": 3000
  },
  {
    "path": "prompts/02-introduction.md",
    "kind": "prompt",
    "title": "模块 2 · 引言润色（Introduction）",
    "subtitle": "引言最大的失败不是写得不好，而是提出的问题与给出的答案对不上。",
    "headings": [
      "评审维度速查",
      "🔴 硬规则：opening 必须与 resolution 对齐",
      "🔴 引文密度要求",
      "🔴 措辞分寸",
      "引出不足的句式库"
    ],
    "keywords": [
      "评审维度速查",
      "引文密度",
      "措辞分寸",
      "硬规则",
      "句式库",
      "引出",
      "引言",
      "失败"
    ],
    "bytes": 5184
  },
  {
    "path": "prompts/03-literature-review.md",
    "kind": "prompt",
    "title": "模块 3 · 文献综述润色（Literature Review）",
    "subtitle": "与研究论文不同，综述有自己的骨架：",
    "headings": [
      "🔴 综述论文（Review Article）的结构",
      "三类文体对比",
      "引言三段式（综述版）",
      "🔴 小标题的六种组织标准",
      "🔴 综述准备的 18 个步骤",
      "🔴 参考文献要求"
    ],
    "keywords": [
      "六种组织标准",
      "引言三段式",
      "综述有自己",
      "综述论文",
      "三类文体",
      "综述准备",
      "参考文献",
      "研究论文"
    ],
    "bytes": 5862
  },
  {
    "path": "prompts/04-methods.md",
    "kind": "prompt",
    "title": "模块 4 · 研究方法润色（Methods）",
    "subtitle": "1. 客观描述区域地质背景、气候背景、环境参数",
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
      "客观描述区域地质背景",
      "实验科学补充",
      "三种主流写法",
      "四段式模式",
      "数据集交代",
      "常见错误",
      "引文密度",
      "多数期刊"
    ],
    "bytes": 4598
  },
  {
    "path": "prompts/05-results.md",
    "kind": "prompt",
    "title": "模块 5 · 结果润色（Results）",
    "subtitle": "同一批结果，在两部分用不同坐标系重组：",
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
      "几乎没有参考文献",
      "Results",
      "技术检查卡口",
      "同坐标系重组",
      "图表硬参数",
      "方法类图件",
      "同一批结果",
      "组织差异"
    ],
    "bytes": 5657
  },
  {
    "path": "prompts/06-discussion.md",
    "kind": "prompt",
    "title": "模块 6 · 讨论润色（Discussion）",
    "subtitle": "1. First — 只能在 −0.4 V vs SHE 测 EAC、0.7 V vs SHE 测 ED",
    "headings": [
      "🔴 讨论的六步框架（缺一不可）",
      "🔴 引文密度：Discussion 每段 5–8 句",
      "局限性 + 未来方向句式（可直接套用）",
      "讨论常用动词",
      "环境 / 地学意义（地学论文常见末节）",
      "v2.16.1 - 局限自陈的七种句式（实测，可直接套用）"
    ],
    "keywords": [
      "直接套",
      "地学论文常见末节",
      "未来方向句式",
      "六步框架",
      "引文密度",
      "地学意义",
      "局限自陈",
      "七种句式"
    ],
    "bytes": 6089
  },
  {
    "path": "prompts/07-conclusion.md",
    "kind": "prompt",
    "title": "模块 7 · 结论润色（Conclusion）",
    "subtitle": "1. 总结要点、突出亮点 —— 从大的层面总结研究意义；突出创新点",
    "headings": [
      "🔴 Do / Don't",
      "🔴 两条要点",
      "🔴 期刊差异：结论段可能不独立存在",
      "篇幅"
    ],
    "keywords": [
      "层面总结研究意义",
      "突出创新点",
      "期刊差异",
      "突出亮点",
      "结论段",
      "独立存",
      "篇幅",
      "总结"
    ],
    "bytes": 3181
  },
  {
    "path": "prompts/08-deai-polish.md",
    "kind": "prompt",
    "title": "模块 8 · 降低 AI 率（终稿通篇润色）",
    "subtitle": "参考文献是机器可读的规范条目，不要改写、不要换格式、不要调整顺序（除非换投期刊）。去 AI 化只针对正文",
    "headings": [
      "AI 高频词黑名单",
      "🔴 去 AI 化不能违反学术规范",
      "🔴 参考文献区不做去 AI 化",
      "⚠️ 判定标准"
    ],
    "keywords": [
      "能违反学术规范",
      "高频词黑名单",
      "除非换投期刊",
      "参考文献区",
      "判定标准",
      "参考文献",
      "调整顺序",
      "换格式"
    ],
    "bytes": 3770
  },
  {
    "path": "prompts/09-journal-submission.md",
    "kind": "prompt",
    "title": "模块 9 · 期刊匹配与投稿（Journal Matching & Submission）",
    "subtitle": "1. 所有稿件必须附 Cover Letter",
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
      "格式即生死",
      "期刊结构硬约束速查",
      "Letter",
      "置部分规范",
      "Cover",
      "知道期望值",
      "送审流程",
      "结局概率"
    ],
    "bytes": 8084
  },
  {
    "path": "prompts/10-reviewer-response.md",
    "kind": "prompt",
    "title": "模块 10 · 审稿意见回复（Responding to Reviewers）",
    "subtitle": "审稿人质疑：\"N2 吹扫可能除不掉全部 O2，建议提供处理后溶解氧数据。\"",
    "headings": [
      "🔴 回复四要素（范例）",
      "🔴 六条纪律（逐条检查）",
      "🔴 审稿人关注什么（反向自查 8 项）",
      "🔴 ELSEVIER「ACCEPTANCE」十点",
      "🔴 找审稿人的途径",
      "大修 vs 小修"
    ],
    "keywords": [
      "审稿人关注什么",
      "建议提供处理",
      "审稿人质疑",
      "溶解氧数据",
      "反向自查",
      "找审稿人",
      "回复四",
      "掉全部"
    ],
    "bytes": 4752
  },
  {
    "path": "references/ai-ml-paper-patterns.md",
    "kind": "reference",
    "title": "AI/ML 方法类地学论文的写作实证（v2.16.0 新增）",
    "subtitle": "按「论文自己的研究对象是不是化石/微体化石」+「有没有用 AI/ML 方法」两轴分层：",
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
      "实际写法",
      "availability",
      "先说清楚能兑现什么",
      "随结论一起声明",
      "数据集怎么交代",
      "五种实际写法",
      "古生物论文",
      "方法类论文"
    ],
    "bytes": 52362
  },
  {
    "path": "references/checklist.md",
    "kind": "reference",
    "title": "投稿前自查清单（打印 / 逐项过版）",
    "subtitle": "来源：本技能方法库",
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
      "本技能方法库",
      "参考文献",
      "满足则",
      "综述专",
      "写作",
      "动笔",
      "题目",
      "署名"
    ],
    "bytes": 8433
  },
  {
    "path": "references/color-system.md",
    "kind": "reference",
    "title": "配色系统与视觉编码（Color System & Visual Encoding）",
    "subtitle": "最常见的错误：把配色当成\"好看不好看\"。",
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
      "空心",
      "好看不好看",
      "好看",
      "通道只能承载一",
      "非第三种颜色",
      "遗传学三态",
      "语义系统",
      "审美选择"
    ],
    "bytes": 16673
  },
  {
    "path": "references/figure-conventions-evidence.md",
    "kind": "reference",
    "title": "图件制图实证（v2.15.0 新增）",
    "subtitle": "→ 同一篇论文内部可能两制并存（如 QSR 正文插图用 ×N、图版用比例尺条），因此规则必须写成「本文的",
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
      "图版",
      "本领域用什么制",
      "放大倍数",
      "比例尺",
      "什么制",
      "图注",
      "全领域统一规则",
      "图注位置分两派"
    ],
    "bytes": 9562
  },
  {
    "path": "references/figure-design-system.md",
    "kind": "reference",
    "title": "图件设计体系（Figure Design System）",
    "subtitle": "🔴 判据：这篇论文的图不需要看图注就能读懂颜色 —— 因为同一篇里",
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
      "Fig",
      "看图注就能读懂颜色",
      "图序即论证顺序",
      "到任何一篇论文",
      "蓝本原文锚点",
      "五种图件原型",
      "性能矩阵",
      "比较面板"
    ],
    "bytes": 20351
  },
  {
    "path": "references/figure-specs.md",
    "kind": "reference",
    "title": "图表硬参数速查",
    "subtitle": "横版满版（极少见）。",
    "headings": [
      "一、图件硬参数",
      "Copernicus / J. Micropalaeontology 口径（🔴 与上表不同）",
      "图内规范细节（PPP 原文，v2 补）",
      "少数情况",
      "二、🔴 Word 缩放铁律（最易犯错）",
      "三、页面设置",
      "四、制图尺寸与字号",
      "五、构图原则",
      "黄金比例（三分之二原则）",
      "对称 vs 不对称"
    ],
    "keywords": [
      "图内规范细节",
      "三分之二原则",
      "图件硬参数",
      "少数情况",
      "缩放铁律",
      "页面设置",
      "制图尺寸",
      "构图原则"
    ],
    "bytes": 8356
  },
  {
    "path": "references/fulltext-reading-evidence.md",
    "kind": "reference",
    "title": "全文逐字精读实证（v2.15.0 新增）",
    "subtitle": "该口径作废。原因有二：(1) 旧抽取器用 dict 存章节，遇同名标题会覆盖前一段正文；",
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
      "Methods",
      "无独立",
      "Discussion",
      "遇同名标题会覆盖",
      "分类学体系论文",
      "区域生物地层学",
      "Results",
      "没有统一模板"
    ],
    "bytes": 47991
  },
  {
    "path": "references/journal-constraints.md",
    "kind": "reference",
    "title": "期刊结构硬约束速查",
    "subtitle": "图注不许再靠 \"the dashed line means …\" 定义符号",
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
      "图件要求（送审 vs 终稿完全不同）"
    ],
    "keywords": [
      "GCA",
      "原文",
      "Discussion",
      "Results",
      "图件硬参数",
      "平台口径",
      "平台独有",
      "配图配色"
    ],
    "bytes": 19388
  },
  {
    "path": "references/literature-search.md",
    "kind": "reference",
    "title": "文献检索与素材积累实操",
    "subtitle": "1. 关键词查询 —— 中英文各查一遍",
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
      "关键词查询",
      "积累自己",
      "写作技巧参考库",
      "补批注全文示例",
      "检索工具清单",
      "补具体查询串",
      "检索策略实例",
      "核心积累方法"
    ],
    "bytes": 8444
  },
  {
    "path": "references/micropaleo-paper-patterns.md",
    "kind": "reference",
    "title": "微体古生物 / 放射虫论文的写作与制图模式",
    "subtitle": "按语料实际写法，微体古生物论文分成四类，骨架互不相同。把综述稿写成系统描述稿，",
    "headings": [
      "一、🔴 四种主题的论文骨架",
      "🔴 A 类（系统描述）的关键结构特征",
      "二、🔴 图件范式：Fig. 制 vs 图版（Plate）制",
      "2.1 图注前缀的实际分布（1139 条图注，逐字统计）",
      "2.2 面板字母体系（语料原句逐字）",
      "2.3 🔴 图注里的来源声明（本领域特有）",
      "三、🔴 色彩风格：灰度优先，形状承担分组",
      "3.1 彩色出现在哪里",
      "3.2 彩色系统树的三个可抄细节（Biard et al. 2022, Environ Microbiol）",
      "四、🔴 地图与地质图：灰度花纹 + 插图 + 比例尺"
    ],
    "keywords": [
      "图注",
      "综述稿写成系统描述稿",
      "按语料实际写法",
      "关键结构特征",
      "面板字母体系",
      "语料原句逐字",
      "形状承担分组",
      "本领域特有"
    ],
    "bytes": 61439
  },
  {
    "path": "references/multi-journal-style-guides.md",
    "kind": "reference",
    "title": "多期刊官方 Style Guide 汇总（地学 / 古生物 / CV）",
    "subtitle": "⚠️ v2.8.0 修正：官方页全文没有出现 \"paragraph\" 一词（本次逐字核对结果）——",
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
      "印刷页",
      "鼓励",
      "必须",
      "官方页全文没有出现",
      "官方体裁口径",
      "收录边界",
      "文章类型",
      "文件格式"
    ],
    "bytes": 81736
  },
  {
    "path": "references/paleobiology-journal.md",
    "kind": "reference",
    "title": "Paleobiology 期刊投稿规范（图件 + 文体）",
    "subtitle": "图可拆成两个或多个文件，分别在不同页出版（如把大图拆成两半，各按双栏宽出版）。",
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
      "化石形态学论文直接适",
      "各按双栏宽出版",
      "按图件类型分",
      "大图拆成两半",
      "大文件压缩",
      "图件规范",
      "图件尺寸",
      "生产规范"
    ],
    "bytes": 21564
  },
  {
    "path": "references/sentence-bank.md",
    "kind": "reference",
    "title": "句式库",
    "subtitle": "1. First — 只能在 −0.4 V vs SHE 测 EAC、0.7 V vs SHE 测 ED",
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
      "强调自己研究重",
      "问句作小标题",
      "编辑拒稿话术",
      "措辞正反例",
      "分层指示词",
      "回复审稿人",
      "引出研究"
    ],
    "bytes": 8380
  },
  {
    "path": "references/格式硬参数与文献检索实操.md",
    "kind": "reference",
    "title": "格式硬参数与文献检索实操",
    "subtitle": "以 PPP（Palaeogeography, Palaeoclimatology, Palaeoecol",
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
      "作者指南藏",
      "文章结构",
      "标题分级",
      "顺序固定",
      "正文结构",
      "备信息",
      "置部分",
      "限篇幅"
    ],
    "bytes": 38761
  },
  {
    "path": "references/论文写作方法论骨架.md",
    "kind": "reference",
    "title": "论文写作方法论骨架",
    "subtitle": "作者必须能回答 4 个问题：",
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
      "论文写作",
      "写作姿态",
      "论文结构",
      "四大内容",
      "能回答",
      "总纲",
      "准备",
      "制图"
    ],
    "bytes": 40053
  }
]
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

    const VIEWS = [
      { id: 'rules', label: '速查', icon: 'reply' },
      { id: 'journals', label: '期刊', icon: 'book' },
      { id: 'check', label: '检查', icon: 'check' },
      { id: 'deai', label: '去AI', icon: 'deai' },
      { id: 'checklist', label: '清单', icon: 'mark' },
      { id: 'manual', label: '手册', icon: 'search' },
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
        { className: 'dapp-sev', 'data-tone': tone },
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
          title: '未授权：宿主拒绝了请求',
          body: '面板请求缺少登录态（HTTP 401）。请在 DeepSeek Harness 里重新登录后刷新。',
        },
        notImplemented: {
          tone: 'warn',
          title: '宿主尚未提供该接口',
          body: '这个能力（HTTP 404）还没有在宿主侧上线：面板不会伪造内容，等接口上线后自动可用。',
        },
        failed: {
          tone: 'warn',
          title: '宿主路由不可达',
          body: '请求没有拿到响应。宿主进程可能正在重启，或该插件没有启用。',
        },
      };
      const info = map[status] || map.failed;
      return h(
        'div',
        { className: 'dapp-state', 'data-tone': info.tone },
        h('div', { className: 'dapp-state-title' }, info.title),
        h('div', null, info.body),
        props.detail ? h('div', { className: 'dapp-rid' }, props.detail) : null,
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

    // ── the panel ───────────────────────────────────────────────────────

    function Panel(props) {
      const t = translate;

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

      // shared
      const [journalKey, setJournalKey] = useState(readStore('journal', ''));
      const [checked, setChecked] = useState(readStore('checklist', {}));
      const [toast, setToast] = useState(null);
      const [sending, setSending] = useState(false);

      const searchRef = useRef(null);
      const toastTimer = useRef(null);
      const debounceTimer = useRef(null);

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
        if (!needle) return [];
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

      const sendToSession = async (text) => {
        if (sending) return false;
        setSending(true);
        try {
          const response = await fetch('/dsh-academic-paper-polish/api/send', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text }),
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
            searchRef.current.focus();
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
      const head = h(
        'div',
        { className: 'dapp-head' },
        h('div', { className: 'dapp-mark' }, h(Icon, { name: 'mark', size: 16 })),
        h(
          'div',
          { className: 'dapp-grow' },
          h('div', { className: 'dapp-title' }, t('panel.title')),
          h(
            'div',
            { className: 'dapp-sub' },
            `${VIEWS.find((item) => item.id === view)?.label || ''} · ${
              targetJournal ? `目标：${targetJournal.name}` : '未设目标期刊'
            }`,
          ),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'dapp-icon-btn',
            title: expanded ? t('panel.collapse') : t('panel.expand'),
            onClick: () => setExpanded((value) => !value),
          },
          h(Icon, { name: 'expand', size: 15 }),
        ),
      );

      // ── views ─────────────────────────────────────────────────────────

      function searchBox(key, value, setter, placeholder) {
        return h(
          'div',
          { className: 'dapp-search' },
          h(Icon, { name: 'search', size: 14 }),
          h('input', {
            ref: searchRef,
            type: 'text',
            value,
            placeholder,
            'data-search': key,
            onChange: (event) => setter(event.target.value),
          }),
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
          { className: 'dapp-card', 'data-sev': severity },
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
        return h(
          'div',
          { className: 'dapp-view', style: { display: 'grid', gap: '10px' } },
          h(
            'div',
            { className: 'dapp-toolbar' },
            searchBox('rules', rulesQuery, setRulesQuery, '搜规则标题 / 条款 / 修复建议（按 / 聚焦）'),
            h('div', { className: 'dapp-label' }, '分类'),
            chipRow(domainOptions, rulesDomain, setRulesDomain, 'domain'),
            h('div', { className: 'dapp-label' }, '段落'),
            chipRow(sectionOptions, rulesSection, setRulesSection, 'section', true),
            h('div', { className: 'dapp-label' }, '严重度'),
            chipRow(SEVERITIES, rulesSeverity, setRulesSeverity, 'severity'),
          ),
          state.status === 'loading'
            ? h('div', { className: 'dapp-loading' }, '正在读取规则库…')
            : null,
          state.status !== 'loading' && state.status !== 'ok'
            ? h(StateNotice, { status: state.status, detail: state.error && state.error.message })
            : null,
          state.status === 'ok' && rules.length === 0
            ? h(
                'div',
                { className: 'dapp-empty' },
                h('div', null, '暂无匹配规则'),
                h(
                  'div',
                  { className: 'dapp-hint' },
                  filters.length > 0
                    ? `试着放宽：清除 ${filters.join('、')}，或换一个关键词。`
                    : '换一个关键词，或清空搜索框。',
                ),
              )
            : null,
          state.status === 'ok' && rules.length > 0
            ? h(
                'div',
                { className: 'dapp-hintline' },
                `命中 ${rules.length} 条${state.data && typeof state.data.total === 'number' ? ` / 共 ${state.data.total} 条` : ''}`,
              )
            : null,
          rules.map((rule) => h('div', { key: str(rule.id, rule.ruleId) }, renderRuleCard(rule))),
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
          { className: 'dapp-view', style: { display: 'grid', gap: '10px' } },
          h(
            'div',
            { className: 'dapp-actions' },
            h(
              'button',
              { type: 'button', className: 'dapp-btn', onClick: () => setOpenJournal('') },
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
            h('div', { className: 'dapp-label' }, '硬性参数 limits'),
            limitKeys.length > 0
              ? h(
                  'div',
                  { className: 'dapp-facts' },
                  limitKeys.map((key) =>
                    h(
                      'div',
                      { key, className: 'dapp-fact' },
                      h('div', { className: 'dapp-fact-k' }, key),
                      h(
                        'div',
                        { className: 'dapp-fact-v' },
                        limits[key] === null || limits[key] === undefined ? '—' : String(limits[key]),
                      ),
                    ),
                  ),
                )
              : h('div', { className: 'dapp-hint' }, '宿主没有给出该刊的硬性参数。'),
          ),
          h(
            'div',
            { className: 'dapp-card' },
            h('div', { className: 'dapp-label' }, '段结构 structure'),
            structure.length > 0
              ? h('ol', { className: 'dapp-list' }, structure.map((item) => h('li', { key: item }, item)))
              : h('div', { className: 'dapp-hint' }, '宿主没有给出该刊的段结构。'),
          ),
          h(
            'div',
            { className: 'dapp-card' },
            h('div', { className: 'dapp-label' }, '该刊要求 rules'),
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
          { className: 'dapp-view', style: { display: 'grid', gap: '10px' } },
          h(
            'div',
            { className: 'dapp-toolbar' },
            searchBox('journals', journalsQuery, setJournalsQuery, '搜期刊名 / 出版社 / ISSN（按 / 聚焦）'),
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
            fieldOptions.length > 0
              ? h(
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
                )
              : null,
          ),
          state.status === 'loading' ? h('div', { className: 'dapp-loading' }, '正在读取期刊库…') : null,
          state.status !== 'loading' && state.status !== 'ok'
            ? h(StateNotice, { status: state.status, detail: state.error && state.error.message })
            : null,
          state.status === 'ok' && journals.length === 0
            ? h(
                'div',
                { className: 'dapp-empty' },
                h('div', null, '暂无匹配期刊'),
                h('div', { className: 'dapp-hint' }, '试着放宽：关闭「仅开放获取」、取消 APC 上限，或清空搜索框。'),
              )
            : null,
          state.status === 'ok' && journals.length > 0
            ? h(
                'div',
                { className: 'dapp-tablewrap' },
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
          state.status === 'ok' && journals.length > 0
            ? h('div', { className: 'dapp-hintline' }, `共 ${journals.length} 本期刊 · 点行看详情 · 表格可横向滚动`)
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
          { className: 'dapp-view', style: { display: 'grid', gap: '10px' } },
          h(
            'div',
            { className: 'dapp-card' },
            h('div', { className: 'dapp-label' }, '待检段落'),
            h('textarea', {
              className: 'dapp-textarea',
              value: checkText,
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
          state.status === 'unauthorized' ||
          state.status === 'notImplemented' ||
          state.status === 'failed'
            ? h(StateNotice, { status: state.status, detail: state.error && state.error.message })
            : null,
          state.status === 'ok'
            ? h(
                'div',
                { className: 'dapp-card' },
                h(
                  'div',
                  { className: 'dapp-verdictbar', 'data-state': passed ? 'ok' : 'bad' },
                  h('span', { className: 'dapp-verdict-dot' }),
                  h(
                    'span',
                    { className: 'dapp-grow' },
                    passed ? '✓ 未发现违规' : `✗ 发现 ${violations.length} 条违规`,
                  ),
                  h('span', { className: 'dapp-hintline' }, `共 ${total} 项检查`),
                ),
                h(
                  'div',
                  { className: 'dapp-summary' },
                  h(
                    'div',
                    { className: 'dapp-summary-cell' },
                    h('div', { className: 'dapp-summary-num', 'data-tone': 'bad' }, String(hard)),
                    h('div', { className: 'dapp-summary-k' }, '🔴 hard'),
                  ),
                  h(
                    'div',
                    { className: 'dapp-summary-cell' },
                    h('div', { className: 'dapp-summary-num', 'data-tone': 'warn' }, String(soft)),
                    h('div', { className: 'dapp-summary-k' }, '🟡 soft'),
                  ),
                  h(
                    'div',
                    { className: 'dapp-summary-cell' },
                    h('div', { className: 'dapp-summary-num', 'data-tone': 'info' }, String(info)),
                    h('div', { className: 'dapp-summary-k' }, '🔵 info'),
                  ),
                ),
              )
            : null,
          state.status === 'ok' && violations.length === 0
            ? h('div', { className: 'dapp-empty' }, '没有发现违规。')
            : null,
          violations.map((violation, index) =>
            h(
              'div',
              { key: str(violation.ruleId, violation.id, `v${index}`), className: 'dapp-card' },
              h(
                'div',
                { className: 'dapp-card-title' },
                h(SeverityBadge, { severity: str(violation.severity, 'hard') }),
                h('span', { className: 'dapp-grow dapp-wrap' }, str(violation.title, violation.ruleTitle, violation.id)),
              ),
              h('div', { className: 'dapp-rid' }, str(violation.ruleId, violation.id)),
              violation.statement
                ? h('div', { className: 'dapp-rule-body dapp-wrap' }, prose(violation.statement))
                : null,
              violation.expected || violation.expect
                ? h(
                    'div',
                    { className: 'dapp-rule-body dapp-wrap' },
                    h('b', null, '期望：'),
                    prose(violation.expected, violation.expect),
                  )
                : null,
              violation.actual || violation.observed
                ? h(
                    'div',
                    { className: 'dapp-rule-body dapp-wrap' },
                    h('b', null, '实际：'),
                    prose(violation.actual, violation.observed),
                  )
                : null,
              violation.matched
                ? h(
                    'div',
                    { className: 'dapp-rule-body dapp-wrap' },
                    h('b', null, '命中：'),
                    h('span', { className: 'dapp-match' }, prose(violation.matched)),
                  )
                : null,
              violation.detail || violation.message
                ? h('div', { className: 'dapp-rule-body dapp-wrap' }, prose(violation.detail, violation.message))
                : null,
              violation.fix || violation.suggestion
                ? h(
                    'div',
                    { className: 'dapp-fix dapp-wrap' },
                    h('b', null, '修复建议：'),
                    prose(violation.fix, violation.suggestion),
                  )
                : null,
              sourceLabel(violation.source) ? h('div', { className: 'dapp-src' }, sourceLabel(violation.source)) : null,
              h(
                'div',
                { className: 'dapp-actions' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dapp-btn',
                    onClick: () => copyText(violationText(violation)),
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
                    onClick: () => sendToSession(violationText(violation)),
                  },
                  h(Icon, { name: 'send', size: 12 }),
                  t('panel.send'),
                ),
              ),
            ),
          ),
          state.status === 'ok' && advice.length > 0
            ? h(
                'div',
                { className: 'dapp-card' },
                h('div', { className: 'dapp-label' }, '建议 advice'),
                h(
                  'ul',
                  { className: 'dapp-list' },
                  advice.map((item, index) =>
                    h('li', { key: index }, typeof item === 'string' ? item : str(item.text, item.title, item.message)),
                  ),
                ),
              )
            : null,
        );
      }

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
          { className: 'dapp-view', style: { display: 'grid', gap: '10px' } },
          h(
            'div',
            { className: 'dapp-card' },
            h('div', { className: 'dapp-label' }, '待扫描文本'),
            h('textarea', {
              className: 'dapp-textarea',
              value: deaiText,
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
          state.status === 'unauthorized' ||
          state.status === 'notImplemented' ||
          state.status === 'failed'
            ? h(StateNotice, { status: state.status, detail: state.error && state.error.message })
            : null,
          state.status === 'ok'
            ? h(
                'div',
                { className: 'dapp-card' },
                h(
                  'div',
                  { className: 'dapp-card-title' },
                  h('span', { className: 'dapp-grow' }, '去 AI 化得分'),
                  h('span', { className: 'dapp-score-big', 'data-tone': score >= 80 ? 'ok' : score >= 50 ? 'warn' : 'bad' }, score === null ? '—' : String(score)),
                ),
                h(
                  'div',
                  { className: 'dapp-meter' },
                  h('span', {
                    style: {
                      width: `${Math.max(0, Math.min(100, score === null ? 0 : score))}%`,
                      background:
                        score === null
                          ? 'var(--dapp-muted)'
                          : score >= 80
                            ? 'var(--dapp-ok)'
                            : score >= 50
                              ? 'var(--dapp-warn)'
                              : 'var(--dapp-bad)',
                    },
                  }),
                ),
                h('div', { className: 'dapp-hintline' }, `命中 ${hits.length} 处 AI 句式（满分 100，越高越干净）`),
              )
            : null,
          state.status === 'ok' && hits.length === 0
            ? h('div', { className: 'dapp-empty' }, '没有命中 AI 句式。')
            : null,
          hits.map((hit, index) =>
            h(
              'div',
              { key: str(hit.id, `h${index}`), className: 'dapp-card' },
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
              hit.suggestion || hit.replacement
                ? h(
                    'div',
                    { className: 'dapp-fix dapp-wrap' },
                    h('b', null, '建议替换：'),
                    prose(hit.suggestion, hit.replacement, hit.fix),
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
                    onClick: () => copyText(str(hit.suggestion, hit.replacement, hit.fix)),
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
                        `请改写下面这句 AI 腔表达：${str(hit.match, hit.text)}\n原因：${str(hit.why, hit.reason)}\n建议：${str(hit.suggestion, hit.replacement)}`,
                      ),
                  },
                  h(Icon, { name: 'send', size: 12 }),
                  t('panel.send'),
                ),
              ),
            ),
          ),
          h(
            'details',
            { className: 'dapp-fold' },
            h(
              'summary',
              null,
              h(Icon, { name: 'chevron', size: 13, className: 'dapp-chevron' }),
              '句式库',
              h('span', { className: 'dapp-fold-count' }, String(patterns.length)),
            ),
            h(
              'div',
              { className: 'dapp-fold-body', style: { display: 'grid', gap: '7px' } },
              searchBox('sentences', sentencesQuery, setSentencesQuery, '搜句式（按 / 聚焦）'),
              sentencesState.status === 'loading'
                ? h('div', { className: 'dapp-loading' }, '正在读取句式库…')
                : null,
              sentencesState.status !== 'loading' && sentencesState.status !== 'ok'
                ? h(StateNotice, { status: sentencesState.status })
                : null,
              patterns.map((pattern, index) =>
                h(
                  'div',
                  { key: str(pattern.id, `p${index}`), className: 'dapp-rule' },
                  h(
                    'div',
                    { className: 'dapp-grow' },
                    h('div', { className: 'dapp-rule-title' }, prose(pattern.zh, pattern.en)),
                    h('div', { className: 'dapp-rule-body' }, prose(pattern.why, pattern.category)),
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
          { className: 'dapp-view', style: { display: 'grid', gap: '10px' } },
          h(
            'div',
            { className: 'dapp-card' },
            h(
              'div',
              { className: 'dapp-check-head' },
              h(ProgressRing, { ratio, label: `${Math.round(ratio * 100)}%` }),
              h('span', { className: 'dapp-grow' }, `${t('panel.progress')} ${doneCount}/${totalItems}`),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dapp-icon-btn',
                  title: '清空勾选',
                  onClick: () => setChecked({}),
                },
                h(Icon, { name: 'close', size: 13 }),
              ),
            ),
            h(
              'div',
              { className: 'dapp-track' },
              h('span', { className: 'dapp-fill', style: { width: `${Math.round(ratio * 100)}%` } }),
            ),
          ),
          state.status === 'loading' ? h('div', { className: 'dapp-loading' }, '正在读取投稿清单…') : null,
          state.status !== 'loading' && state.status !== 'ok'
            ? h(StateNotice, { status: state.status, detail: state.error && state.error.message })
            : null,
          state.status === 'ok' && stages.length === 0
            ? h('div', { className: 'dapp-empty' }, '宿主没有提供清单。')
            : null,
          stages.length > 0
            ? h(
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
              )
            : null,
          visibleStages.map((stage) =>
            h(
              'div',
              { key: stage.id, className: 'dapp-group', 'data-open': 'true' },
              h(
                'div',
                { className: 'dapp-group-head' },
                h('span', { className: 'dapp-group-key' }, h(Icon, { name: 'check', size: 11 })),
                h('span', { className: 'dapp-group-name' }, str(stage.title, stage.id)),
                h(
                  'span',
                  { className: 'dapp-group-count' },
                  `${(stage.items || []).filter((item) => checked[`${stage.id}:${item.id}`]).length}/${
                    (stage.items || []).length
                  }`,
                ),
              ),
              h(
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
                            { className: 'dapp-rid' },
                            `${SEVERITY_ICON[item.severity] || '🔵'} ${SEVERITY_TEXT[item.severity] || item.severity}${
                              item.ruleId ? ` · ${item.ruleId}` : ''
                            }`,
                          )
                        : null,
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'dapp-icon-btn',
                        title: t('panel.send'),
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
              ),
            ),
          ),
        );
      }

      function renderManual() {
        return h(
          'div',
          { className: 'dapp-view', style: { display: 'grid', gap: '10px' } },
          searchBox('manual', manualQuery, setManualQuery, '全文检索手册文件（按 / 聚焦）'),
          h(
            'div',
            { className: 'dapp-hint' },
            liveIndexState === 'live'
              ? remotePending && manualQuery.trim()
                ? '🟢 实时索引：正在全文检索当前文件…'
                : '🟢 实时索引：全文检索宿主路由读取的当前文件，不消耗任何 token。'
              : liveIndexState === 'unauthorized'
                ? '🟠 宿主路由拒绝了本次请求（缺登录态），正在使用打包时的内置索引（仅标题级匹配）。'
                : liveIndexState === 'notImplemented'
                  ? '🟡 宿主没有提供 skill-index 路由，正在使用打包时的内置索引（仅标题级匹配）。'
                  : '🟡 宿主路由不可达，正在使用打包时的内置索引（仅标题级匹配）。',
          ),
          manualQuery.trim() && manualResults.length === 0
            ? h('div', { className: 'dapp-empty' }, '没有命中任何文件。')
            : null,
          manualResults.map((entry) =>
            h(
              'div',
              { key: entry.path, className: 'dapp-file' },
              h(
                'div',
                { className: 'dapp-file-top' },
                h('span', { className: 'dapp-badge' }, entry.kind),
                h('span', { style: { fontWeight: 600, fontSize: '12px' } }, entry.title),
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
                    entry.keywords.map((word) => h('span', { key: word, className: 'dapp-badge' }, word)),
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
          manualQuery.trim() ? null : h('div', { className: 'dapp-hint' }, '输入关键词即可全文检索技能手册；点「发给会话」把文件交给智能体。'),
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
      else content = renderManual();

      const toastNode = toast
        ? h('div', { className: 'dapp-toast', 'data-tone': toast.kind }, toast.text)
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
      );
    }

    // ── styles ──────────────────────────────────────────────────────────

    const CSS = `
.dapp{
  --dapp-accent: var(--dsw-alias-button-info-fill, #4176e6);
    --dapp-accent-hover: var(--dsw-alias-button-info-hover, #7aaaff);
    --dapp-accent-soft: color-mix(in srgb, var(--dapp-accent) 10%, transparent);
    --dapp-accent-line: color-mix(in srgb, var(--dapp-accent) 38%, transparent);
    --dapp-surface: var(--dsw-alias-bg-layer-1, #fff);
    --dapp-surface-2: var(--dsw-alias-bg-overlay, #e9ecf2);
    --dapp-line: color-mix(in srgb, var(--dsw-alias-label-secondary, #61666b) 18%, transparent);
    --dapp-line-strong: color-mix(in srgb, var(--dsw-alias-label-secondary, #61666b) 34%, transparent);
    --dapp-text: var(--dsw-alias-label-primary, #0f1115);
    --dapp-muted: var(--dsw-alias-label-secondary, #61666b);
    --dapp-ok: var(--dsw-alias-state-success-primary, #22c55e);
    --dapp-warn: var(--dsw-alias-state-warn-primary, #f59e0b);
    --dapp-bad: var(--dsw-alias-state-error-primary, #ec1313);
    --dapp-ok-soft: color-mix(in srgb, var(--dapp-ok) 12%, transparent);
    --dapp-warn-soft: color-mix(in srgb, var(--dapp-warn) 14%, transparent);
    --dapp-bad-soft: color-mix(in srgb, var(--dapp-bad) 12%, transparent);
    --dapp-r: 10px;
  --dapp-r:10px;font-family:inherit;color:var(--dapp-text)}
.dapp *,.dapp *::before,.dapp *::after{box-sizing:border-box}
.dapp button{font-family:inherit;color:inherit}
.dapp-head{display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid var(--dapp-line)}
.dapp-mark{display:grid;place-items:center;width:28px;height:28px;border-radius:9px;color:var(--dapp-accent);background:color-mix(in srgb,var(--dapp-accent) 14%,transparent);flex:0 0 auto}
.dapp-title{font-size:13px;font-weight:600;line-height:1.25;letter-spacing:.01em}
.dapp-sub{font-size:11px;color:var(--dapp-muted);margin-top:1px}
.dapp-grow{flex:1 1 auto;min-width:0}
.dapp-btn{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;line-height:1;padding:6px 10px;border-radius:8px;border:1px solid var(--dapp-line-strong);background:transparent;color:var(--dapp-text);cursor:pointer;transition:background .13s ease,border-color .13s ease,transform .08s ease}
.dapp-btn:hover{background:var(--dapp-surface-2)}
.dapp-btn:active{transform:scale(.985)}
.dapp-btn:focus-visible{outline:2px solid var(--dapp-accent);outline-offset:2px}
.dapp-btn-primary{border-color:var(--dapp-accent);color:var(--dapp-accent)}
.dapp-btn-primary:hover{background:color-mix(in srgb,var(--dapp-accent) 12%,transparent)}
.dapp-btn-ghost{border-color:transparent;color:var(--dapp-muted)}
.dapp-btn-ghost:hover{color:var(--dapp-text);background:var(--dapp-surface-2)}
.dapp-icon-btn{display:grid;place-items:center;font-size:12px;width:26px;height:26px;border-radius:7px;border:1px solid transparent;background:transparent;color:var(--dapp-muted);cursor:pointer;transition:background .13s ease,color .13s ease}
.dapp-icon-btn:hover{background:var(--dapp-surface-2);color:var(--dapp-text)}
.dapp-icon-btn:focus-visible{outline:2px solid var(--dapp-accent);outline-offset:2px}
.dapp-tabs{display:flex;gap:3px;padding:8px 10px;border-bottom:1px solid var(--dapp-line);overflow-x:auto;scrollbar-width:none}
.dapp-tabs::-webkit-scrollbar{display:none}
.dapp-tab{flex:0 0 auto;display:inline-flex;align-items:center;gap:5px;font-size:12px;padding:5px 8px;border-radius:7px;border:1px solid transparent;background:transparent;color:var(--dapp-muted);cursor:pointer;transition:color .13s ease,background .13s ease,border-color .13s ease}
.dapp-tab:hover{color:var(--dapp-text);background:var(--dapp-surface-2)}
.dapp-tab[data-active=true]{color:var(--dapp-text);background:var(--dapp-surface-2);border-color:var(--dapp-line);font-weight:600}
.dapp-tab:focus-visible{outline:2px solid var(--dapp-accent);outline-offset:1px}
.dapp-tab-key{font-size:9px;opacity:.55;font-variant-numeric:tabular-nums}
.dapp-scroll{padding:10px 12px 14px;display:grid;gap:10px;overflow-y:auto;flex:1 1 auto;min-height:0}
.dapp-body{display:flex;flex-direction:column;flex:1 1 auto;min-height:0;min-width:0}
.dapp-scroll::-webkit-scrollbar{width:9px}
.dapp-scroll::-webkit-scrollbar-thumb{background:var(--dapp-line-strong);border-radius:5px;border:2px solid transparent;background-clip:content-box}
.dapp-scroll::-webkit-scrollbar-thumb:hover{background:var(--dapp-muted);background-clip:content-box}
.dapp-view{animation:dapp-in .18s ease both}
@keyframes dapp-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.dapp-card{border:1px solid var(--dapp-line);border-radius:var(--dapp-r);background:var(--dapp-surface);padding:11px 12px;display:grid;gap:9px}
.dapp-card-title{font-size:12.5px;font-weight:600;display:flex;align-items:center;gap:7px}
.dapp-label{font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:var(--dapp-muted)}
.dapp-kv{display:grid;grid-template-columns:88px 1fr;gap:6px 10px;font-size:12px;line-height:1.5}
.dapp-k{color:var(--dapp-muted)}
.dapp-v{min-width:0;word-break:break-word}
.dapp-badges{display:flex;flex-wrap:wrap;gap:5px}
.dapp-badge{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;padding:2px 8px;border-radius:999px;border:1px solid var(--dapp-line-strong);color:var(--dapp-muted);white-space:nowrap}
.dapp-badge-brand{color:var(--dapp-accent);border-color:color-mix(in srgb,var(--dapp-accent) 42%,transparent);background:color-mix(in srgb,var(--dapp-accent) 10%,transparent)}
.dapp-badge-warn{color:var(--dapp-warn);border-color:color-mix(in srgb,var(--dapp-warn) 42%,transparent);background:color-mix(in srgb,var(--dapp-warn) 10%,transparent)}
.dapp-badge-ok{color:var(--dapp-ok);border-color:color-mix(in srgb,var(--dapp-ok) 42%,transparent);background:color-mix(in srgb,var(--dapp-ok) 10%,transparent)}
.dapp-note{border-left:2px solid var(--dapp-warn);padding:2px 0 2px 10px;font-size:11.5px;line-height:1.55}
.dapp-list{margin:0;padding-left:16px;font-size:11.5px;line-height:1.65;color:var(--dapp-muted)}
.dapp-list li{margin:3px 0}
.dapp-list-warn li{color:var(--dapp-text)}
.dapp-quote{margin:0 0 8px;padding-left:10px;border-left:2px solid var(--dapp-line-strong);font-size:11px;line-height:1.6;color:var(--dapp-muted)}
.dapp-quote:last-child{margin-bottom:0}
.dapp-scope{font-size:11.5px;line-height:1.6;color:var(--dapp-muted)}
.dapp-select{font:inherit;font-size:12px;line-height:1.4;padding:7px 9px;border-radius:8px;border:1px solid var(--dapp-line-strong);background:var(--dapp-surface);color:var(--dapp-text);width:100%;cursor:pointer;transition:border-color .13s ease}
.dapp-select:hover{border-color:var(--dapp-accent)}
.dapp-select:focus-visible{outline:2px solid var(--dapp-accent);outline-offset:2px}
.dapp-mods{display:grid;grid-template-columns:repeat(auto-fill,minmax(152px,1fr));gap:8px}
.dapp-mod{display:grid;font-size:12px;grid-template-columns:auto 1fr auto;grid-template-rows:auto auto;gap:2px 9px;align-items:center;text-align:left;padding:9px 10px;border-radius:var(--dapp-r);border:1px solid var(--dapp-line);background:var(--dapp-surface);cursor:pointer;transition:border-color .13s ease,background .13s ease,transform .08s ease}
.dapp-mod:hover{border-color:var(--dapp-line-strong);background:var(--dapp-surface-2)}
.dapp-mod:active{transform:scale(.99)}
.dapp-mod:focus-visible{outline:2px solid var(--dapp-accent);outline-offset:2px}
.dapp-mod[data-done=true]{border-color:color-mix(in srgb,var(--dapp-ok) 55%,transparent)}
.dapp-mod-icon{grid-row:1/3;display:grid;place-items:center;width:28px;height:28px;border-radius:9px;color:var(--dapp-accent);background:color-mix(in srgb,var(--dapp-accent) 12%,transparent)}
.dapp-mod-name{font-size:12.5px;font-weight:600;line-height:1.25}
.dapp-mod-hint{font-size:10.5px;color:var(--dapp-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dapp-mod-no{grid-row:1/3;font-size:10px;color:var(--dapp-muted);font-variant-numeric:tabular-nums}
.dapp-mod-done{grid-column:2/4;font-size:10px;color:var(--dapp-ok)}
.dapp-check-head{display:flex;align-items:center;gap:9px;font-size:11px;color:var(--dapp-muted)}
.dapp-track{flex:1 1 auto;height:5px;border-radius:3px;background:color-mix(in srgb,var(--dapp-muted) 18%,transparent);overflow:hidden}
.dapp-fill{display:block;height:100%;background:var(--dapp-accent);transition:width .25s cubic-bezier(.4,0,.2,1)}
.dapp-groups{display:grid;gap:6px}
.dapp-group{border:1px solid var(--dapp-line);border-radius:var(--dapp-r);overflow:hidden;background:var(--dapp-surface)}
.dapp-group-head{display:flex;align-items:center;gap:9px;width:100%;font-size:12.5px;padding:8px 10px;background:transparent;border:0;cursor:pointer;text-align:left;transition:background .13s ease}
.dapp-group-head:hover{background:var(--dapp-surface-2)}
.dapp-group-head:focus-visible{outline:2px solid var(--dapp-accent);outline-offset:-2px}
.dapp-group-key{display:grid;place-items:center;width:20px;height:20px;border-radius:6px;font-size:11px;font-weight:700;color:var(--dapp-accent);background:color-mix(in srgb,var(--dapp-accent) 12%,transparent);flex:0 0 auto}
.dapp-group-name{font-size:12.5px;font-weight:600;line-height:1.25}
.dapp-group-count{font-size:10.5px;color:var(--dapp-muted);font-variant-numeric:tabular-nums;margin-left:auto}
.dapp-chevron{color:var(--dapp-muted);transition:transform .16s ease;flex:0 0 auto}
.dapp-group[data-open=true] .dapp-chevron{transform:rotate(90deg)}
.dapp-items{display:grid;gap:1px;padding:3px 8px 9px}
.dapp-item{display:flex;gap:8px;align-items:flex-start;padding:4px 5px;border-radius:6px;cursor:pointer;font-size:11.5px;line-height:1.5;transition:background .13s ease}
.dapp-item:hover{background:var(--dapp-surface-2)}
.dapp-box{flex:0 0 auto;width:15px;height:15px;margin-top:2px;border-radius:4px;border:1.5px solid color-mix(in srgb,var(--dapp-muted) 55%,transparent);display:grid;place-items:center;color:transparent;transition:background .13s ease,border-color .13s ease,color .13s ease}
.dapp-item[data-checked=true] .dapp-box{background:var(--dapp-accent);border-color:var(--dapp-accent);color:#fff}
.dapp-item[data-checked=true] .dapp-item-text{text-decoration:line-through;color:var(--dapp-muted)}
.dapp-ring{position:relative;width:26px;height:26px;flex:0 0 auto}
.dapp-ring svg{transform:rotate(-90deg)}
.dapp-ring-label{position:absolute;inset:0;display:grid;place-items:center;font-size:8.5px;font-variant-numeric:tabular-nums;color:var(--dapp-muted)}
.dapp-matrix{width:100%;border-collapse:separate;border-spacing:0;font-size:11px}
.dapp-matrix th,.dapp-matrix td{padding:6px 7px;text-align:left;border-bottom:1px solid var(--dapp-line);vertical-align:top}
.dapp-matrix thead th{position:sticky;top:0;background:var(--dapp-surface);z-index:1;font-size:10px;color:var(--dapp-muted);font-weight:600;letter-spacing:.03em}
.dapp-matrix tbody tr{transition:background .13s ease}
.dapp-matrix tbody tr:hover{background:var(--dapp-surface-2)}
.dapp-cell{display:block;width:100%;text-align:left;border:1px solid transparent;border-radius:6px;padding:3px 5px;background:transparent;cursor:pointer;font-size:11px;line-height:1.4;transition:border-color .13s ease,background .13s ease}
.dapp-cell:hover{border-color:var(--dapp-line-strong);background:var(--dapp-surface-2)}
.dapp-cell[data-tone=ok]{color:var(--dapp-ok)}
.dapp-cell[data-tone=warn]{color:var(--dapp-warn)}
.dapp-cell[data-tone=bad]{color:var(--dapp-bad)}
.dapp-cell[data-tone=brand]{color:var(--dapp-accent)}
.dapp-journal-cell{font-weight:600;font-size:11.5px;cursor:pointer}
.dapp-search{display:flex;align-items:center;gap:7px;padding:7px 9px;border-radius:9px;border:1px solid var(--dapp-line-strong);background:var(--dapp-surface);transition:border-color .13s ease}
.dapp-search:focus-within{border-color:var(--dapp-accent)}
.dapp-search input{flex:1 1 auto;min-width:0;font:inherit;font-size:12px;border:0;outline:none;background:transparent;color:var(--dapp-text)}
.dapp-search input::placeholder{color:var(--dapp-muted)}
.dapp-file{display:grid;gap:2px;font-size:12px;padding:8px 10px;border-radius:9px;border:1px solid var(--dapp-line);background:var(--dapp-surface);cursor:pointer;text-align:left;transition:border-color .13s ease,background .13s ease}
.dapp-file:hover{border-color:var(--dapp-line-strong);background:var(--dapp-surface-2)}
.dapp-file-top{display:flex;align-items:center;gap:7px}
.dapp-file-path{font-size:10px;color:var(--dapp-muted);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.dapp-file-sub{font-size:11px;color:var(--dapp-muted);line-height:1.5}
.dapp-file-snip{margin-top:4px;font-size:11px;line-height:1.5;color:var(--dapp-text);opacity:.85;background:var(--dapp-surface-2);border-left:2px solid var(--dapp-accent-line);border-radius:0 6px 6px 0;padding:4px 8px;word-break:break-word}
.dapp-file-snip-no{margin-right:6px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;color:var(--dapp-muted);opacity:.8}
.dapp-empty{padding:18px 12px;text-align:center;font-size:11.5px;color:var(--dapp-muted)}
.dapp-chips{display:flex;flex-wrap:wrap;gap:6px}
.dapp-chipbtn{font-size:11.5px;padding:5px 10px;border-radius:999px;border:1px solid var(--dapp-line-strong);background:transparent;color:var(--dapp-muted);cursor:pointer;transition:all .13s ease}
.dapp-chipbtn:hover{border-color:var(--dapp-line-strong);color:var(--dapp-text);background:var(--dapp-surface-2)}
.dapp-chipbtn[data-on=true]{border-color:var(--dapp-accent);color:var(--dapp-accent);background:color-mix(in srgb,var(--dapp-accent) 12%,transparent);font-weight:600}
.dapp-field{display:grid;grid-template-columns:96px 1fr;gap:8px;align-items:center}
.dapp-field input,.dapp-field select{font:inherit;font-size:12px;padding:6px 8px;border-radius:7px;border:1px solid var(--dapp-line-strong);background:var(--dapp-surface);color:var(--dapp-text);width:100%}
.dapp-field input:focus,.dapp-field select:focus{outline:none;border-color:var(--dapp-accent)}
.dapp-verdict{display:flex;gap:8px;align-items:flex-start;padding:7px 9px;border-radius:8px;border:1px solid var(--dapp-line);background:var(--dapp-surface);font-size:11.5px;line-height:1.5}
.dapp-verdict[data-state=ok]{border-color:color-mix(in srgb,var(--dapp-ok) 40%,transparent)}
.dapp-verdict[data-state=bad]{border-color:color-mix(in srgb,var(--dapp-bad) 45%,transparent)}
.dapp-verdict[data-state=warn]{border-color:color-mix(in srgb,var(--dapp-warn) 45%,transparent)}
.dapp-verdict-dot{width:7px;height:7px;border-radius:999px;margin-top:5px;flex:0 0 auto;background:var(--dapp-muted)}
.dapp-verdict[data-state=ok] .dapp-verdict-dot{background:var(--dapp-ok)}
.dapp-verdict[data-state=bad] .dapp-verdict-dot{background:var(--dapp-bad)}
.dapp-verdict[data-state=warn] .dapp-verdict-dot{background:var(--dapp-warn)}
.dapp-verdict-name{flex:0 0 84px;color:var(--dapp-muted)}
.dapp-verdict-text{flex:1 1 auto;min-width:0}
.dapp-verdict-note{display:block;color:var(--dapp-muted);font-size:10.5px;margin-top:2px}
.dapp-swatch-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px}
.dapp-swatch-card{border:1px solid var(--dapp-line);border-radius:9px;overflow:hidden;background:var(--dapp-surface);display:grid}
.dapp-swatch-strip{display:flex;height:34px}
.dapp-swatch-strip span{flex:1 1 0}
.dapp-swatch-meta{padding:6px 8px;display:grid;gap:2px}
.dapp-hex{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px}
.dapp-role{font-size:10px;color:var(--dapp-muted)}
.dapp-rule{display:flex;gap:10px;align-items:flex-start;padding:9px 11px;border-radius:var(--dapp-r);border:1px solid var(--dapp-line);background:var(--dapp-surface)}
.dapp-rule-no{flex:0 0 auto;display:grid;place-items:center;width:20px;height:20px;border-radius:999px;font-size:10.5px;font-weight:700;color:var(--dapp-accent);border:1px solid color-mix(in srgb,var(--dapp-accent) 40%,transparent)}
.dapp-rule-title{font-size:12.5px;font-weight:600}
.dapp-rule-body{font-size:11.5px;color:var(--dapp-muted);line-height:1.55;margin-top:3px}
.dapp-hint{font-size:11px;color:var(--dapp-muted);line-height:1.55}
.dapp-hint b{color:var(--dapp-text);font-weight:600}
.dapp-meter{height:5px;border-radius:3px;background:color-mix(in srgb,var(--dapp-muted) 18%,transparent);overflow:hidden}
.dapp-meter span{display:block;height:100%;border-radius:3px;transition:width .3s cubic-bezier(.4,0,.2,1)}
.dapp-score{display:flex;align-items:center;gap:10px;font-size:12px;text-align:left;padding:9px 10px;border-radius:var(--dapp-r);border:1px solid var(--dapp-line);background:var(--dapp-surface);cursor:pointer;transition:border-color .13s ease,background .13s ease}
.dapp-score:hover{border-color:var(--dapp-accent);background:var(--dapp-surface-2)}
.dapp-score-name{font-size:12.5px;font-weight:600}
.dapp-score-tags{font-size:10.5px;color:var(--dapp-muted);margin-top:2px}
.dapp-score-bar{height:5px;border-radius:3px;background:var(--dapp-surface-2);overflow:hidden;margin-top:6px}
.dapp-score-bar span{display:block;height:100%;background:var(--dapp-accent);transition:width .3s cubic-bezier(.4,0,.2,1)}
@media (prefers-reduced-motion:reduce){.dapp-view{animation:none}.dapp-fill,.dapp-meter span,.dapp-score-bar span{transition:none}}

/* ── fact sheet ─────────────────────────────── */
.dapp-title-row{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.dapp-title-name{font-size:16px;font-weight:700;letter-spacing:.01em}
.dapp-title-full{font-size:11.5px;color:var(--dapp-muted)}
.dapp-lead{font-size:12.5px;line-height:1.65}
.dapp-facts{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--dapp-line);border:1px solid var(--dapp-line);border-radius:10px;overflow:hidden}
.dapp-fact{background:var(--dapp-surface);padding:8px 10px;display:grid;gap:2px}
.dapp-fact-k{font-size:10px;color:var(--dapp-muted)}
.dapp-fact-v{font-size:12.5px;font-weight:600;line-height:1.35}
.dapp-fact-v[data-tone=ok]{color:var(--dapp-ok)}
.dapp-fact-v[data-tone=warn]{color:var(--dapp-warn)}
.dapp-fact-v[data-tone=bad]{color:var(--dapp-bad)}
.dapp-fact-v[data-tone=accent]{color:var(--dapp-accent)}
.dapp-fold{border:1px solid var(--dapp-line);border-radius:10px;background:var(--dapp-surface);overflow:hidden}
.dapp-fold>summary{display:flex;align-items:center;gap:7px;list-style:none;cursor:pointer;padding:9px 10px;font-size:12px;font-weight:600;transition:background .13s ease}
.dapp-fold>summary::-webkit-details-marker{display:none}
.dapp-fold>summary:hover{background:var(--dapp-surface-2)}
.dapp-fold>summary:focus-visible{outline:2px solid var(--dapp-accent);outline-offset:-2px}
.dapp-fold-body{padding:3px 10px 10px;border-top:1px solid var(--dapp-line)}
.dapp-fold-count{margin-left:auto;font-size:10.5px;font-weight:500;color:var(--dapp-muted)}
.dapp-fold[open] .dapp-chevron{transform:rotate(90deg)}
.dapp-dims{display:flex;flex-wrap:wrap;gap:5px}
.dapp-dim{font-size:11.5px;padding:4px 10px;border-radius:999px;border:1px solid var(--dapp-line-strong);background:var(--dapp-surface);color:var(--dapp-muted);cursor:pointer;transition:all .13s ease}
.dapp-dim:hover{color:var(--dapp-text);background:var(--dapp-surface-2)}
.dapp-dim[data-on=true]{color:var(--dapp-accent);border-color:var(--dapp-accent-line);background:var(--dapp-accent-soft);font-weight:600}
.dapp-compare{display:grid;gap:6px}
.dapp-compare-row{display:grid;font-size:12px;grid-template-columns:74px 1fr;gap:10px;align-items:start;padding:9px 10px;border-radius:10px;border:1px solid var(--dapp-line);background:var(--dapp-surface);cursor:pointer;text-align:left;transition:border-color .13s ease,background .13s ease}
.dapp-compare-row:hover{border-color:var(--dapp-accent-line);background:var(--dapp-accent-soft)}
.dapp-compare-name{font-size:12.5px;font-weight:650}
.dapp-compare-value{font-size:12px;line-height:1.5}
.dapp-compare-value[data-tone=ok]{color:var(--dapp-ok)}
.dapp-compare-value[data-tone=warn]{color:var(--dapp-warn)}
.dapp-compare-value[data-tone=bad]{color:var(--dapp-bad)}
.dapp-compare-value[data-tone=accent]{color:var(--dapp-accent)}
.dapp-badge-accent{color:var(--dapp-accent);border-color:var(--dapp-accent-line);background:var(--dapp-accent-soft)}
.dapp-mods{grid-template-columns:1fr 1fr}
.dapp-kv{grid-template-columns:84px 1fr;font-size:12px}


/* ── capability dashboard ─────────────────────────────── */
.dapp{--dapp-info:var(--dsw-alias-state-info-primary,#3b82f6);--dapp-info-soft:color-mix(in srgb,var(--dapp-info) 12%,transparent)}
.dapp-scroll>*{min-width:0}
.dapp-wrap{overflow-wrap:anywhere;word-break:break-word}
.dapp-toolbar{display:grid;gap:7px}
.dapp-chiprow{display:flex;flex-wrap:wrap;gap:5px}
.dapp-chiprow-scroll{flex-wrap:nowrap;overflow-x:auto;padding-bottom:3px;scrollbar-width:none}
.dapp-chiprow-scroll::-webkit-scrollbar{display:none}
.dapp-chiprow-scroll>*{flex:0 0 auto}
.dapp-label+.dapp-chiprow{margin-top:-2px}
.dapp-hintline{font-size:10.5px;color:var(--dapp-muted);line-height:1.5}
.dapp-sev{display:inline-flex;align-items:center;gap:4px;font-size:10px;padding:2px 7px;border-radius:999px;border:1px solid var(--dapp-line-strong);white-space:nowrap;flex:0 0 auto}
.dapp-sev[data-tone=bad]{color:var(--dapp-bad);border-color:color-mix(in srgb,var(--dapp-bad) 45%,transparent);background:var(--dapp-bad-soft)}
.dapp-sev[data-tone=warn]{color:var(--dapp-warn);border-color:color-mix(in srgb,var(--dapp-warn) 45%,transparent);background:var(--dapp-warn-soft)}
.dapp-sev[data-tone=info]{color:var(--dapp-info);border-color:color-mix(in srgb,var(--dapp-info) 45%,transparent);background:var(--dapp-info-soft)}
.dapp-rid{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;color:var(--dapp-muted);word-break:break-all}
.dapp-fix{font-size:11.5px;line-height:1.55;border-left:2px solid var(--dapp-accent-line);padding:2px 0 2px 8px;color:var(--dapp-text)}
.dapp-src{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;color:var(--dapp-muted);word-break:break-all}
.dapp-actions{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.dapp-btn[disabled]{opacity:.55;cursor:default}
.dapp-icon-btn[disabled]{opacity:.55;cursor:default}
.dapp-tablewrap{width:100%;max-width:100%;overflow-x:auto;border:1px solid var(--dapp-line);border-radius:var(--dapp-r);background:var(--dapp-surface)}
.dapp-jtable{width:100%;min-width:520px;border-collapse:separate;border-spacing:0;font-size:11px}
.dapp-jtable th,.dapp-jtable td{padding:6px 8px;text-align:left;border-bottom:1px solid var(--dapp-line);white-space:nowrap}
.dapp-jtable th:first-child,.dapp-jtable td:first-child{max-width:158px;overflow:hidden;text-overflow:ellipsis}
.dapp-jtable thead th{position:sticky;top:0;background:var(--dapp-surface);z-index:1;font-size:10px;color:var(--dapp-muted);font-weight:600;cursor:pointer;user-select:none}
.dapp-jtable tbody tr{cursor:pointer;transition:background .13s ease}
.dapp-jtable tbody tr:hover{background:var(--dapp-surface-2)}
.dapp-jtable tbody tr[data-on=true]{background:var(--dapp-accent-soft)}
.dapp-textarea{width:100%;min-height:150px;resize:vertical;font:inherit;font-size:12px;line-height:1.6;padding:8px 9px;border-radius:9px;border:1px solid var(--dapp-line-strong);background:var(--dapp-surface);color:var(--dapp-text)}
.dapp-textarea:focus{outline:none;border-color:var(--dapp-accent)}
.dapp-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.dapp-summary-cell{border:1px solid var(--dapp-line);border-radius:9px;padding:7px 9px;background:var(--dapp-surface);display:grid;gap:2px}
.dapp-summary-num{font-size:17px;font-weight:700;font-variant-numeric:tabular-nums}
.dapp-summary-num[data-tone=bad]{color:var(--dapp-bad)}
.dapp-summary-num[data-tone=warn]{color:var(--dapp-warn)}
.dapp-summary-num[data-tone=info]{color:var(--dapp-info)}
.dapp-summary-k{font-size:10px;color:var(--dapp-muted)}
.dapp-verdictbar{display:flex;gap:8px;align-items:center;padding:8px 10px;border-radius:9px;border:1px solid var(--dapp-line);background:var(--dapp-surface);font-size:12px}
.dapp-verdictbar[data-state=ok]{border-color:color-mix(in srgb,var(--dapp-ok) 45%,transparent)}
.dapp-verdictbar[data-state=bad]{border-color:color-mix(in srgb,var(--dapp-bad) 45%,transparent)}
.dapp-verdictbar .dapp-grow{min-width:0}
.dapp-state{border:1px solid var(--dapp-line);border-radius:var(--dapp-r);background:var(--dapp-surface);padding:10px 11px;font-size:11.5px;line-height:1.6;color:var(--dapp-muted);display:grid;gap:5px}
.dapp-state[data-tone=bad]{border-color:color-mix(in srgb,var(--dapp-bad) 45%,transparent)}
.dapp-state[data-tone=warn]{border-color:color-mix(in srgb,var(--dapp-warn) 45%,transparent)}
.dapp-state-title{font-size:12px;font-weight:600;color:var(--dapp-text)}
.dapp-loading{font-size:11.5px;color:var(--dapp-muted);padding:4px 2px}
.dapp-ringp{position:relative;width:28px;height:28px;flex:0 0 auto}
.dapp-ringp-label{position:absolute;inset:0;display:grid;place-items:center;font-size:8.5px;font-variant-numeric:tabular-nums;color:var(--dapp-muted)}
.dapp-score-big{font-size:30px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1}
.dapp-score-big[data-tone=ok]{color:var(--dapp-ok)}
.dapp-score-big[data-tone=warn]{color:var(--dapp-warn)}
.dapp-score-big[data-tone=bad]{color:var(--dapp-bad)}
.dapp-match{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;background:var(--dapp-surface-2);border-radius:5px;padding:2px 6px;display:inline-block;word-break:break-word}
.dapp-toast{flex:0 0 auto;padding:7px 10px;border-radius:9px;font-size:11.5px;line-height:1.5;border:1px solid var(--dapp-line-strong);background:var(--dapp-surface-2);color:var(--dapp-text)}
.dapp-toast[data-tone=bad]{border-color:color-mix(in srgb,var(--dapp-bad) 50%,transparent)}
.dapp-toast[data-tone=warn]{border-color:color-mix(in srgb,var(--dapp-warn) 50%,transparent)}
.dapp-toast[data-tone=ok]{border-color:color-mix(in srgb,var(--dapp-ok) 50%,transparent)}
.dapp-group[data-open=true] .dapp-box{align-self:flex-start}
.dapp .dapp-box{color:transparent}
@media (prefers-reduced-motion:reduce){.dapp-jtable tbody tr{transition:none}}
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
