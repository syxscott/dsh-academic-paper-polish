# 数据契约（v3.0 能力层）

本目录存放**机器可读**的知识库。`skill/**` 是给人（和模型）读的散文手册，
`data/**` 是给工具读的规则库——两者同源，但 `data/**` 里的每一条都能被
`paper_*` 工具确定性执行。

宿主（host）加载这些 JSON，提供 5 个模型可调用的工具 + 5 个斜杠命令；
客户端（client）面板通过同源 HTTP 路由读同一份数据，面板和工具永远一致。

---

## 1. 通用约定

| 字段 | 类型 | 说明 |
|---|---|---|
| `version` | string | 语义化版本，如 `"1.0.0"` |
| `domain` | string | 规则域：`writing` / `figures` / `submission` |

**section 词表（`sections` 字段只能取这些值）**

```
title, abstract, keywords, introduction, literature, methods,
geological-setting, systematic, results, discussion, conclusion,
acknowledgements, references, figures, tables, declarations,
cover-letter, response, review
```

**severity 词表**

| 值 | 含义 | 工具输出色 |
|---|---|---|
| `hard` | 硬红线，违反即退稿/拒稿级 | 🔴 |
| `soft` | 强烈建议 | 🟡 |
| `info` | 提示/可选项 | 🔵 |

**source 字段**（每条规则必须带，用于面板跳转与出处引用）

```json
{ "file": "references/checklist.md", "line": 30 }
```

`file` 是相对 `skill/academic-paper-polish/` 的路径。

---

## 2. `data/rules/*.json`

文件名即 `domain`。每个文件：

```json
{
  "version": "1.0.0",
  "domain": "writing",
  "rules": [
    {
      "id": "W-ABS-01",
      "title": "摘要必须包含四个部分",
      "severity": "hard",
      "sections": ["abstract"],
      "statement": "摘要含背景 / 科学问题 / 研究结果 / 研究意义 四部分",
      "fix": "按 背景 → 科学问题 → 研究结果 → 研究意义 顺序重写摘要，每部分 1–2 句。",
      "check": { "type": "manual", "params": {} },
      "tags": ["abstract", "structure"],
      "source": { "file": "references/checklist.md", "line": 30 }
    }
  ]
}
```

### 期刊归属（可选字段 `journals`）

一条规则可能只属于某一本期刊 —— 「PE 必须提供 plain language summary」不是
Earth-Science Reviews 的要求。规则可以带一个可选的 `journals` 数组：

```json
{
  "id": "S-55",
  "title": "PE 必须提供 plain language summary",
  "severity": "hard",
  "sections": ["abstract"],
  "journals": ["palaeontologia-electronica"],
  "statement": "…",
  "fix": "…",
  "check": { "type": "required", "params": { "patterns": ["plain language summary"], "flags": "i" } },
  "tags": ["abstract", "pe", "lay-summary"],
  "source": { "file": "references/multi-journal-style-guides.md", "line": 659 }
}
```

- `journals` 的取值必须是 `data/journals.json` 里某本期刊的 **`key`**。
- **没有 `journals` 字段 = 通用规则**，对任何目标期刊都适用。
- 有 `journals` 字段 = **期刊专属规则**：只有在检查的目标期刊命中该 key 时才参与判定；
  未指定目标期刊时这类规则**不参与判定**（工具会报告跳过了多少条）。
- 同一本刊的多个规则可以共用一个 `journals` 数组；一条规则也可以同时属于多本刊。
- `scripts/tag-journal-rules.mjs` 负责回填该字段（幂等：已有 `journals` 的规则会被跳过）。

### `check` 的 8 种类型

`check.type` 必须是下列之一。`params` 里的 `pattern` 一律是 **JavaScript 正则
字符串**（不含 `/` 与 flag），`flags` 默认 `""`（大小写不敏感时写 `"i"`）。

| type | params | 判定 |
|---|---|---|
| `manual` | `{}` | 不可自动判定，仅作为可检索的指导条目 |
| `forbidden` | `{ "patterns": ["\\bfirst time\\b"], "flags": "i" }` | 任一命中 = 违规 |
| `required` | `{ "patterns": ["\\bBackground\\b"], "flags": "i" }` | 每个 pattern 至少命中一次，缺一个 = 违规 |
| `count` | `{ "pattern": "\\bhowever\\b", "min": 1, "max": 4, "flags": "i" }` | 命中次数须落在 `[min, max]` |
| `wordCount` | `{ "min": 150, "max": 300 }` | 被检段落字数（CJK 按字、拉丁按词）须落在 `[min, max]` |
| `numeric` | `{ "pattern": "dpi\\s*[:=]\\s*(\\d+)", "min": 300, "max": 1200, "flags": "i" }` | 捕获组数字须落在 `[min, max]` |
| `citationDensity` | `{ "min": 5, "max": 40 }` | 每千字引用数须落在 `[min, max]` |
| `sectionOrder` | `{ "order": ["introduction", "methods", "results", "discussion"] }` | 段落标题须存在且按给定顺序出现 |

**正则必须用 `\\` 转义**（JSON 字符串里反斜杠要写两次）。

**段落切分约定**（工具与检查器共用）：

- 英文段落标题：行首 `#{1,3} ` 或行首独占的 `Introduction` / `Abstract` 等
  （大小写不敏感，允许 `1. Introduction`、`1.1 Background`）。
- 中文段落标题：`摘要` `引言` `材料与方法` `结果` `讨论` `结论` `参考文献` 等。
- `check` 只作用于**当前被检段落**；`sections` 列出该规则适用的段落，
  工具只在该段落上评估这条规则。

---

## 3. `data/journals.json`

```json
{
  "version": "1.0.0",
  "journals": [
    {
      "key": "palaeontology",
      "name": "Palaeontology",
      "publisher": "Wiley",
      "issn": "0031-0239",
      "field": ["古生物", "系统分类"],
      "scope": "系统古生物学与演化",
      "impactFactor": 3.2,
      "reviewDays": 60,
      "apc": 3800,
      "openAccess": false,
      "articleTypes": ["research", "review"],
      "limits": {
        "abstractWords": 300,
        "titleWords": 20,
        "keywords": 6,
        "references": 60,
        "figures": 12,
        "tables": 8,
        "dpi": 600
      },
      "structure": [
        "Introduction",
        "Geological setting",
        "Materials and methods",
        "Systematic palaeontology",
        "Discussion",
        "Conclusions",
        "Acknowledgements",
        "References"
      ],
      "rules": ["期刊特有的硬性要求，逐条可读"],
      "notes": "注意事项、开放获取政策、审稿周期等",
      "source": { "file": "references/journal-constraints.md", "line": 42 }
    }
  ]
}
```

`limits` 的键固定为上表 8 个；缺项写 `null` 表示手册未规定。
`structure` 用**英文**官方段名（工具按序号/集合比对，不做大小写敏感之外的变换）。

---

## 4. `data/sentences.json`

去 AI 化句式库。

```json
{
  "version": "1.0.0",
  "patterns": [
    {
      "id": "DEAI-001",
      "zh": "深入探讨",
      "en": "delve into",
      "pattern": "\\bdelve\\s+into\\b",
      "flags": "i",
      "severity": "soft",
      "category": "空动词套话",
      "why": "delve 是低信息量动词，常出现在 AI 生成文本里。",
      "suggestion": "换成具体动作：比较 / 测得 / 分离 / 重构。"
    }
  ]
}
```

`pattern` 命中即视为该句式出现；工具按 `severity` 计入去 AI 化得分。

---

## 5. `data/checklists.json`

```json
{
  "version": "1.0.0",
  "stages": [
    {
      "id": "pre-submit",
      "title": "投稿前自查",
      "sections": ["title", "abstract", "introduction"],
      "items": [
        {
          "id": "B-01",
          "text": "摘要语法错误 ≤ 6 处",
          "severity": "hard",
          "ruleId": "W-ABS-04",
          "tags": ["abstract", "language"]
        }
      ]
    }
  ]
}
```

`ruleId` 可为空字符串（表示该条没有对应的可执行规则）。

---

## 6. 加载方约定

- 宿主用 `readFileSync` + `JSON.parse` 读取，**每个文件独立加载**，
  任一文件缺失或 JSON 非法时**只跳过该文件**并记录一条警告，不得让插件整体失败。
- 客户端不直接读这些文件，一律通过同源路由
  `/dsh-academic-paper-polish/*` 读取，宿主与客户端永远看到同一份数据。
