# Changelog

All notable changes to this project are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/); versions follow semver.

## [3.2.1] - 2026-11-06

一次针对 v3.0.0 之后全部新代码的**敌意 bug 猎**。修了 7 个真 bug，并新增三套对抗性探针。

### Fixed
- 🔴 **`.docx` 被当 UTF-8 读**：`paper_check` / `paper_deai` 用 `readFileSync(path,'utf8')`
  读文件，`.docx` 是 ZIP 容器，于是规则引擎收到的是**乱码**，出来的结论全是噪声。
  现在走 docx 解包器；`.pdf` / `.doc` / `.odt` 给出可执行的提示（先用 office 技能转 docx），
  损坏的 `.docx` 报明确错误。斜杠命令的附件/路径分支改用同一个读取器。
- 🔴 **文件名带空格时斜杠命令把它当散文**：`looksLikePath` 原本见空格就否，
  于是 `my paper.md` 永远走不了路径分支。现在以扩展名 + 句子标点判断。
- 🔴 **切会话时旧结果落进新会话**：宿主读文件期间会话切换，旧会话的分析结果会写进新会话的面板。
  客户端记住发起时的 sessionId，回来时不一致就丢弃。
- 🔴 **卸载信标没真正用上 keepalive**：`pingBeacon(payload, true)` 的第二参是 options 对象，
  传 `true` 会让 `opts.keepalive` 变成 `undefined` → 页面卸载时请求可能被浏览器丢掉。
- 🔴 **F-146 与 APP 的 183 mm 版心冲突**：「制图宽度 ≤180 mm」把 APP 合法��� 183 mm 误报。
  改为 ≤183 mm（所有已知期刊里最宽的双栏），关键词收紧，severity 降为 soft。
- **`pickLatestAgent` 在 `agents.list()` 返回非数组时抛异常** —— 现在安全跳过。
- **`paper_analyze` 没有工作目录护栏**：面板路由用 `assertInsideCwd` 限制在会话目录内，
  工具却能读任意路径。现在两者一致。

### Added
- **`scripts/checker-adversarial-test.mjs`**（41 条）：把规则引擎按畸形规则打一遍 ——
  无捕获组、min > max、单侧 null 边界、零宽正则、空 pattern、非法正则、
  两个捕获组、count/required/forbidden 空列表、未知 check type。
- **`scripts/host-adversarial-test.mjs`**：敌意输入下的全 HTTP 面探针 ——
  畸形查询串、超大 body、目录、9 MB 文件、空文件、带空格的文件名、不是 zip 的 .docx。
- **`scripts/client-adversarial-test.mjs`**（28 次渲染）：7 个视图 × 4 种错误应答
  （乱码 / 401 / 404 / 不可达），要求面板**降级而不是崩溃**。

### Test
- 断言 693 → **762**（新增 checker-adversarial 41 · client-adversarial 28 ·
  host-route 295 → 301 · 其余不变）。

## [3.2.0] - 2026-11-06

### Added
- **`paper_analyze` 工具 + `/paper-analyze` 命令**：模型自己也能逐段审稿了。
  解析 `.docx`/`.tex`/`.md`/`.txt`/`.rtf`，切出摘要/引言/方法/结果/讨论/结论，
  对**每一段单独**跑规则库，返回该段各自的违规、修复建议与出处，外加整篇的去 AI 化得分。
  此前这条能力只有右栏面板能用，模型只能拿到「整篇一锅端」的结果。
  - 新增 `lib/manuscript.mjs`（读文件 + 解析 + 分析，面板路由与工具共用）、
    `lib/tool-analyze.mjs`（工具定义）。
  - 提示段改为 145 字符（原来 126），因为要点名六个工具。

### Fixed
- 🔴 **数值检查读错数**：`numeric` 规则原先只取正文里**第一个**正则匹配来判定，
  于是「字号下限 8 pt」拿到的是线宽 `0.05`、`线条粗细 0.25–0.5 mm」拿到的是 `220 mm` 里的 `20`。
  现在判定**全部**匹配：
  - 全部越界 → 报**最严重**的那个值，并带上命中的原文；
  - 一部分越界 → 降一级严重度（hard → soft）并说明「3 个值超界」；
  - `forbidden` / `required` 现在报**命中次数**，面板能显示「命中 3 次」。
- 🔴 **多捕获组只判第一个**：`180 mm × 230 mm` 这类**成对**的尺寸里，第二个数（高度）
  原本完全不参与判定 —— `180 mm × 260 mm` 会「通过」。现在每个含数字的捕获组都判一次，
  报最差的那个。
- 🔴 **「最小 531×1328 px」被当成上限**：`max` 现在允许为 `null`（该侧无界），
  于是更大的合法画布不再被误报，而低于最小值的仍会被抓出来。
- 🔴 **制图宽度上限形同虚设**：`F-24` 只判到 230 mm，宽度 220 mm 也能过。
  新增 `F-146`「制图设计尺寸宽度 ≤180 mm」。
- 🔴 **切会话后仍显示上一篇会话的稿件报告**：右栏槽位是 session scope，但内容可能跨会话存活。
  现在 `sessionId` 或会话目录一变就重置稿件视图的状态；没有会话 id 时主按钮禁用并说明原因，
  **绝不显示不属于当前会话的结果**。

### Added（可观测性）
- **面板活动信标**：面板把「挂载了 / 切到哪个视图 / 报了什么错 / 面板有多宽」告诉宿主，
  宿主写进 `<DSH_PROFILE_DIR>/.plugin-runtime/dsh-academic-paper-polish/panel-activity.json`
  （原子写、留最近 50 条）。
  官方 `references/verification.md` 明写「A screenshot of a mock page is not verification of the running plugin」
  且**禁止**为拿截图去找认证令牌 —— 本机没有 browser-use provider、Electron 也没开调试端口，
  所以这是**唯一**能在不碰登录态的前提下确认「真面板确实活着、没报错」的通道。
  新路由 `GET/POST /api/ping`；读它用 `node scripts/read-panel-activity.mjs`。
- 稿件视图新增「复制报告」（整篇分析导出 Markdown）与「整篇交给 Agent」（一次把全部段落送进会话）。

## [3.1.1] - 2026-11-06

### Added
- **面板活动信标**：面板把「挂载了 / 切到哪个视图 / 报了什么错 / 面板有多宽」告诉宿主，
  宿主写进 `<DSH_PROFILE_DIR>/.plugin-runtime/dsh-academic-paper-polish/panel-activity.json`
  （原子写，留最近 50 条）。
  官方 `references/verification.md` 明写「A screenshot of a mock page is not verification of the running plugin」
  且**禁止**为拿截图去找认证令牌 —— 本机没有 browser-use provider、Electron 也没开调试端口，
  所以这是**唯一**能在不碰登录态的前提下确认「真面板确实活着、没报错」的通道。
  新路由：`GET/POST /api/ping`。
- **整篇报告导出为 Markdown**：稿件视图的「复制报告」把按段落的体检结果拼成一份
  可直接粘贴的 Markdown（含条款、期望 vs 实际、修复建议、出处）。
- **整篇交给 Agent**：一次把整篇分析送进会话，而不是逐条发。

### Fixed
- 🔴 **数值检查读错数**：`numeric` 规则原先只取正文里**第一个**正则匹配来判定，
  于是「字号下限 8 pt」拿到的是线宽 `0.05`、`线条粗细 0.25–0.5 mm` 拿到的是 `220 mm` 里的 `20`。
  现在判定**全部**匹配：
  - 全部越界 → 报**最严重**的那个值，并带上命中的原文；
  - 一部分越界 → 降一级严重度（hard → soft）并说明「3 个值超界」；
  - `forbidden` / `required` 现在报**命中次数**，面板能显示「命中 3 次」。
- 🔴 **多捕获组只判第一个**：`180 mm × 230 mm` 这类**成对**的尺寸里，第二个数（高度）
  原本完全不参与判定 —— `180 mm × 260 mm` 会「通过」。现在每个含数字的捕获组都判一次，
  报最差的那个。
- 🔴 **「最小 531×1328 px」被当成上限**：`max` 现在允许为 `null`（该侧无界），
  于是更大的合法画布不再被误报，而低于最小值的仍会被抓出来。
- 🔴 **制图宽度上限形同虚设**：`F-24` 只判到 230 mm，宽度 220 mm 也能过。
  新增 `F-146`「制图设计尺寸宽度 ≤180 mm」。
- 🔴 **切会话后仍显示上一篇会话的稿件报告**：右栏槽位是 session scope，但内容可能跨会话存活。
  现在 `sessionId` 或会话目录一变就重置稿件视图的状态；没有会话 id 时主按钮禁用并说明原因，
  **绝不显示不属于当前会话的结果**。

## [3.1.0] - 2026-11-06

### Added
- **🔴 会话稿件分析**：面板新增「稿件」视图 —— 一键扫描**当前会话工作目录**，
  自动挑出论文正文文件（唯一明显赢家自动选；多个候选接近时**弹选择框**让用户选），
  解析后**按段落切分并逐段体检**，产出「摘要/引言/方法/结果/讨论/结论」各自的
  违规清单、修复建议、出处，以及整篇的去 AI 化得分。
  - `GET  /api/session/files?sessionId=` —— 会话工作目录内的论文候选与打分。
  - `POST /api/analyze { path, sessionId, journal? }` —— 分段报告。
  - `.docx` 由宿主自行解包（ZIP + `word/document.xml`），无新依赖；
    PDF / `.doc` / `.odt` 会被列出但标灰（需先用 office 技能转 docx）。
  - 「交给 Agent 深读」按钮把文件路径交给会话里的 Agent，由它逐段写修改意见。
- **面板 UI 按官方规范重做**（对齐官方 `Plugin Manager` 页面与 `practices.md`）：
  - **响应式改用 CSS container query**：面板根 `container-type: inline-size` +
    `@container`（断点 ≤380 / ≤420 / ≥600）。
    官方理由：右栏宽度 ≠ 视口宽度，**media query 在可拖拽右栏里必然失效**。
  - **零字面色**：全部 `--dsw-alias-*` 派生（`color-mix`），
    删掉 `#4176e6` / `#fff` 一类回退；圆角改用 `--dsw-radius-xs/sm/md`。
  - **官方状态范式**：骨架屏（`--dsw-alias-bg-skeleton` + `1lh` 行高 + 尊重
    `prefers-reduced-motion`）、`status` / `empty` / `failure` 三件套、
    统一焦点环、hover 只在 `@media (hover:hover)` 下生效。
  - **间距/字号刻度**对齐官方 Plugin Manager：2/4/6/8/10/12/14/16/20/24 ·
    10/11/11.5/12/12.5/13/13.5/14(+18/20)。
  - **实时 chip 标题**：注册 `sidebar.right.pane.tab.title`，并显式声明
    `priority: 'extension'`（与官方 sidebar-files 同一套路）。
- **`scripts/layout-probe.mjs`**：6 视图 × 5 宽度（320/380/460/560/900）的布局体检，
  检查横向溢出、文本溢出、被挤压的 chrome、被裁的首列、被吞的内容、命中区大小、
  文本框高度、网格行拉伸。**探针本身经过反向验证**（临时注入固定宽度后确实 exit 1）。
- **`scripts/measure-view.mjs`** / **`scripts/shot-one.mjs`**：定位布局问题用的
  盒模型测量与单视图截图（可模拟 401 / 404 / 网络不可达）。
- **`scripts/extract-host-css.mjs`**：从 `app.asar` 里抽出官方宿主页面的真实 CSS
  （`node scripts/extract-host-css.mjs plugin-manager preview/host-plugin-manager.css`），
  作为「抄宿主页面刻度」的参考。
- **`scripts/sync-skill-index.mjs`**：重新生成技能索引并同步进 `client.js`，
  消灭「在线索引」与「内置兜底索引」长期漂移的问题。

### Fixed
- 🔴 **标签栏被裁掉上半截**：`.dapp-head` / `.dapp-tabs` 是列 flex 子项，
  默认 `flex-shrink:1` 把行高压扁 → 三行 chrome 全部 `flex:0 0 auto`。
- 🔴 **期刊表第一列被 ellipsis 裁掉**：改为换行 + 去掉写死的 `min-width:520px`。
- 🔴 **表单标签列在 320px 下吃掉 1/3 宽度**：96px → 72px，≤420px 时标签上堆叠。
- 🔴 **`repeat(3,1fr)` 这类裸 `1fr`**：官方从不写裸 `1fr`，一律 `minmax(0,1fr)`；
  flex 子项补 `min-width:0`（官方 `min-width:0` + `overflow:hidden` + `text-overflow:ellipsis` 三件套）。
- 🔴 **`/` 快捷键聚焦到收起的 `details` 里的隐藏输入框**：聚焦前先展开，且每个视图只有一个「主」搜索框。
- **「发给会话」猜会话**：`/api/send` 原先在没给 `sessionId` 时取「最近活跃的 agent」，
  可能发到**错误的会话**。客户端现在一律带上 slot props 里的 `sessionId`。
- 清单组标题原来是**假按钮**（有 pointer 光标、无行为）→ 真 `<button aria-expanded>`。
- 清单项的严重度标记与速查/检查不一致 → 统一 `.dapp-sev` 胶囊。
- 「表格可横向滚动」提示写死 → 改用 ResizeObserver 实测溢出才显示。

### Test
- 断言 466 → **594**（audit 36 · eval-conformance 171 · host-route 248 · interaction 76 ·
  layout-probe 30 · 其余为渲染与冒烟）。
- `preview/` 现在明确只是**布局回归网**，**不是**运行中插件的验证
  （官方 `references/verification.md`：「A screenshot of a mock page is not verification of the running plugin」）。

## [3.0.1] - 2026-11-05

### Fixed
- 🔴 **面板网格行被拉高（检查 / 去AI / 手册 三个视图 UI 错乱）**：
  `.dapp-scroll` 是 `display:grid` 且 `flex:1 1 auto`，它唯一的 auto 行会被拉满整个容器高度；
  `.dapp-view` 又是 `display:grid`，于是它把多出来的空间**平均分给每一个 auto 行** ——
  搜索框被撑到 **277px** 高，段落下拉框与「目标期刊」之间被撑出 200px 的空洞，
  手册视图的提示行与结果行同样被撑开。
  修法：`.dapp-scroll` 与 `.dapp-view` 都加 `align-content:start`（外加
  `.dapp-scroll` 的 `grid-auto-rows:min-content`），行高回到内容高度，多余空间落到底部。
- 🔴 **手册视图默认是空的**：`manualResults` 在没有搜索词时直接 `return []`，
  所以「手册」标签页打开后一个文件都不显示，必须先输入才出内容。
  改为无查询时直接列出索引里的文件。
- 客户端内置的技能索引（离线兜底）与 `skill-index.json` 脱节：
  新增的 `references/AGENTS.md` 不在其中。新增 `scripts/sync-skill-index.mjs`
  重新生成索引并同步进 `client.js`，两者不再可能不一致（索引 38 → 39 条）。

### Added
- **`scripts/layout-probe.mjs`**：6 个视图 × 4 个宽度（320/380/460/560）的布局体检，
  检查横向溢出、越界元素，以及**网格行是否被拉伸**
  （`align-content` 必须是 `start`，否则就是这次这种 bug）。
- **`scripts/measure-view.mjs`**：打印单个视图的盒模型几何（定位布局问题用）。
- **`scripts/shoot-views.mjs`**：截图脚本跟随新视图 id 更新，`?demo=1` 会自动填正文并点检查，
  截出来的是**有结果的界面**而不是空输入框。

### Test
- 新增布局体检 24 组断言；其余 466 条不变。

## [3.0.0] - 2026-11-05

### Added
- **五个模型可调用的工具**（`ctx.tools.register`）：
  `paper_check`（逐条跑规则库，返回违规 + 出处 + 修复建议）·
  `paper_rules`（按关键词/段落/严重度/期刊切规则）·
  `paper_journals`（主题 → 期刊排序）·
  `paper_outline`（目标期刊段结构与篇幅上限）·
  `paper_deai`（去 AI 化扫描 + 0–100 得分）。
  描述均写明何时调用；输出有行数上限，规则库不回灌。
- **五个斜杠命令**（`ctx.commands.register`）：
  `/paper-check` `/paper-rules` `/paper-journals` `/paper-outline` `/paper-deai`。
  前两者可带文件附件。
- **一段常驻系统提示**（`ctx.systemPrompt.section`，order 2950，126 字符）：
  告诉模型有这些工具、写改稿请调用、别凭记忆套规则。
- **机器可读规则库** `data/`：**432 条规则**（329 通用 + 103 期刊专属）·
  **28 本期刊**结构化档案 · **103 条**去 AI 化句式 · **16 阶段 / 112 项**自查清单。
  291 条（67%）可自动判定，其余 141 条作为「无法自动判定但必须知道」的指导一并返回。
- **宿主 JSON API**（同源，零 token）：`api/meta` `api/rules` `api/journals`
  `api/sentences` `api/checklists` `api/check` `api/deai` `api/outline` `api/send`。
- **`POST /api/send`**：把内容注入**当前会话**的 inbox（`agent.followup`），
  冷会话走 `sessionController.resolveAgent`；消息带自定义来源标记
  `academic-paper-polish`（**不是** `user`），因此在 Web UI 里渲染成带出处的注入行，
  不会冒充人类发言，也不会让 goal 工具误以为那是真人输入。
- **`scripts/eval-conformance.mjs`**：用上游 `evals/evals.json`（26 用例）反查手册完整性
  —— 模块文件必须真的包含该模块的关键事实、相对链接必须可达、
  每个文件都必须从 `SKILL.md` 可达、数字事实必须能从 `data/` 取到。
- **`evals/evals.json`** 与 **`skill/academic-paper-polish/references/AGENTS.md`**：
  补进之前漏掉的上游仓库级资产（跨工具规则单一来源，含分章引文密度表）。
- **`scripts/tag-journal-rules.mjs`**（幂等）：给规则回填 `journals` 归属。
- **`scripts/tighten-numeric-patterns.mjs`**：给数值正则加数字边界与量纲关键词锚定。

### Changed
- **面板从 8 个只读视图改为 6 个 API 驱动视图**：
  速查（规则筛选 + 搜索 + 出处）· 期刊（可排序表 + 筛选 + 设为目标刊）·
  检查（实时体检 + 严重度汇总 + 违规卡）· 去AI（得分 + 命中卡 + 句式库）·
  清单（16 阶段 + 进度环 + 落盘）· 手册（原 markdown 浏览器）。
  面板内容**全部来自宿主 API**，不内嵌任何规则对象（审计有断言守着）。
- 面板新增「**发给会话**」：规则 / 违规 / 清单项一键注入当前会话。
- 错误态从 2 种扩到 3 种并互不混淆：`unauthorized`（401/403）·
  `notImplemented`（404/405）· `failed`（网络不可达）；面板 chrome 在任何状态下都在。
- 宿主半边拆成 `index.js` + `lib/`（data / text / checker / outline / tools / commands），
  零新增运行时依赖。
- `package.json`：`version` → 3.0.0，`files` 增加 `lib` 与 `data`，`exports` 增加 `./lib/*`。

### Fixed
- 🔴 **期刊专属规则串台**：121 条只属于某一本期刊的规则（「PE 必须提供 plain language
  summary」「Paleobiology 送审图 <40 兆像素」）此前对所有稿件生效 ——
  给 ES&T 稿件体检会报「PE 必须提供 plain language summary」。
  规则新增可选 `journals` 归属字段并已回填 103 条；检查时只应用目标期刊的专属规则，
  未指定期刊时跳过并在输出里说明跳过了多少条。
- 🔴 **数值检查读错数**：`(\d{1,2})\s*mm` 会把「220 mm」读成「20」（正则从中间一位开始匹配）；
  `(\d+)\s*pt` 会把线宽当字号。全部数值正则加数字边界 + 量纲关键词锚定。
- 🔴 **手册 7 处内容缺口 + 16 处失效链接**：
  `docs/PROMPTS-EN.md` 的 13 个链接指向的是上游仓库布局（`../skills/academic-paper-polish/…`），
  打包后全是死链；`prompts/01-abstract.md` 缺 Highlights 与「避免缩写」、
  `prompts/02-introduction.md` 缺「倒金字塔」与 topic sentence、
  `prompts/03-literature-review.md` 缺「18 步」、`prompts/06-discussion.md` 缺「6 步」、
  `references/figure-specs.md` 缺 Palaeontologia Electronica 整节、
  `references/micropaleo-paper-patterns.md` 缺 181 篇分层随机样本的口径说明。全部补齐。
- 渲染测试的视图清单仍是 v2 的 8 个旧 id（全部落到默认视图，等于没测）——改为新的 6 个。

### Removed
- 面板的 4 个纯本地视图（对比矩阵 / 选刊匹配 / 图件体检 / 配色体检）。
  对比与选刊由 `api/journals` + `paper_journals` 接管；
  图件体检由规则库的 145 条图件规则接管（81.4% 可自动判定，比原先只查 dpi/宽/高更全）；
  色觉模拟未重建。

### Test
- 断言总数 41 → **466**（audit 36 · eval-conformance 171 · host-route 183 · interaction 76）。
- 交互测试：保留 17 · 改写 5 · 删除 19（旧视图断言）· 新增 54。

## [2.4.0] - 2026-11-05

### Changed
- **面板只在会话右栏出现**：移除 `conversation.composer.dock` 槽位注册，
  输入框下方不再出现论文助手窄条（也不再有「⧉ 在右栏打开」按钮）。
  客户端随之简化：删掉 dock 专用分支（`variant` 判定、dock 头部、dock 样式）
  与 `sidebarRight` 服务依赖（`openSidebarTab` 已无用途）。
- 渲染测试新增断言：`conversation.composer.dock` **不得**出现本插件的注册；
  交互测试同样断言只注册 1 个（右栏）。

### Removed
- 未再使用的 `panel.openSidebar` 文案（中英）与 `.dapp-dock` 样式。

## [2.3.1] - 2026-11-05

### Fixed
- 路由补上官方信任栅栏（`connection.requestRejection`）：Host/Origin 检查 + 浏览器会话 cookie，
  与 `dsh-host-open-in-app` 等官方路由一致。无凭据的外部请求现在返回 **401**（此前裸奔）。
  面板的同源 fetch 会自动携带 `dsh-auth-*` 签名 cookie，不受影响。

### Added
- 客户端区分两种降级：🟠「宿主路由拒绝了本次请求（缺登录态）」与 🟡「宿主路由不可达」，
  不再把鉴权失败误报成网络不可用。
- 路由测试新增鉴权用例（不可信请求 → 403）。

## [2.3.0] - 2026-11-05

### Fixed
- 🔴 **宿主路由 404**：注册的前缀路径带了结尾斜杠（`/dsh-academic-paper-polish/`），
  而 webserver 的匹配规则是 `pathname === prefix || pathname.startsWith(prefix + '/')`，
  于是去比较 `startsWith('.../dsh-academic-paper-polish//')`，**任何请求都匹配不上**。
  改为无结尾斜杠后，实机 `GET /dsh-academic-paper-polish/skill-index` 返回 200 / 38 条。
  回归测试里新增了对运行时匹配规则的断言，避免再犯。
- 🔴 **搜索只覆盖标题级**：索引只存标题 / 副标题 / 关键词 / 小标题，正文从不被检索，
  于是 `ZooBank` 这类只写在正文里的术语搜不到，面板却宣称"搜全部参考文件"。
  宿主路由新增 `?q=` 全文检索（逐行扫描磁盘正文，返回命中行片段），
  客户端改为防抖远程检索 + 本地降级，命中卡片显示 `L<行号>` 片段。
- **预览台暗色从未真正渲染**：`build-preview-tokens.mjs` 只抽了第一段 `body{…}`，
  丢掉了 `body[data-ds-dark-theme]` 那份 alias 覆盖，8 张暗色截图与亮色逐字节相同。
  改用 `extract-theme-tokens.mjs` 从 app.asar 抽完整主题 CSS，暗色截图已与亮色区分。

### Added
- `scripts/run-interaction-test.mjs`：CDP 驱动的浏览器交互测试（40 条断言：点击 / 输入 /
  持久化 / 键盘快捷键 / 无控制台报错），含宿主路由桩。
- `scripts/code-metrics.mjs`：分层代码量统计。
- `scripts/check-inline-scripts.mjs`：预览台内联脚本语法检查。
- `scripts/extract-theme-tokens.mjs`：从 app.asar 抽真实主题 CSS（亮/暗两套 alias）。

### Changed
- 审计脚本增强：`fetch()` 面检查现在覆盖单引号 / 双引号 / 模板字符串三种写法；
  新增「CSS 变量必须已定义」检查（本次即靠它抓出两个不存在的 `--dapp-*` 变量）。
- 宿主索引构建抽成共享的 `collectFiles()`，`build-skill-index.mjs` 产出的
  `skill-index.json` 与宿主运行时输出逐字节一致。

## [2.2.0] - 2026-11-05

### Added
- 面板重构为 token 驱动的设计系统（`.dapp-*` 类名 + `--dsw-alias-*` 主题 token）。
- 8 个视图：期刊档案 / 对比矩阵 / 选刊匹配 / 图件体检 / 配色体检 / 模块 / 自查清单 / 铁律。
- 右栏 tab 类型 + 指南胶囊；输入框下方 `conversation.composer.dock` 入口。
- 宿主零 token 路由 `/dsh-academic-paper-polish/skill-index`，面板显示 🟢 实时索引 / 🟡 降级状态。
- 键盘快捷键 `1–8` / `/`；视图、选刊、匹配条件、配色、图件参数、勾选状态写入 localStorage。
- 视觉自验证管线（预览台 + 8 视图截图 + 16 组合渲染测试 + 静态审计）。

## [2.1.0] - 2026-11-05

### Fixed
- 🔴 Design-system CSS variables were never injected (regex anchor missed the
  opening `.dapp{`), so every `var(--dapp-*)` silently fell back to
  `currentColor` — borders invisible, accent colour missing. The panel now
  derives visible hairlines from the muted label colour and uses the real
  DSH accent token (`button-info-fill`, #4176e6) instead of the near-black
  `brand-primary`.
- `<style>` rendered as a string child was truncated in the live app
  (18 KB → 593 B). Injection now uses `dangerouslySetInnerHTML`.
- `.dapp button{font:inherit}` outranked every class rule (0,1,1 > 0,1,0)
  and reset all button font sizes; replaced with `font-family:inherit` plus
  explicit sizes per component.
- i18n binding returned the raw key when an entry was missing; now falls
  back to the built-in Chinese dictionary.
- Journal selector was lost in the v1.1 rewrite; restored at the top of the
  journal view.
- Duplicate `color` view branch crashed that tab; removed.

### Added
- Headless visual verification pipeline: `build-preview-tokens.mjs`
  (extracts the installed DSH's real theme tokens), `preview/panel.html`
  (standalone panel harness with real React UMD), `shoot-views.mjs`
  (screenshots all 8 views), `render-test.mjs` (16 combos of view × slot),
  `dump-view.mjs` (HTML inspection).
- `engines.dsh` compatibility declaration.

## [2.0.x] - 2026-11-05

### Added
- Eight views: journal fact sheets (10 journals, official verbatim quotes),
  comparison matrix, journal matching, figure check, palette check
  (WCAG contrast + three CVD simulations), module launcher + skill-wide
  search index (38 files), submission checklist (11 groups / 112 items,
  localStorage), eight hard rules.
- Right-sidebar tab type + guide entry; composer dock entry with
  open-in-sidebar button.
- Keyboard shortcuts (1-8, /), persisted view/journal/conditions.

## [1.x] - 2026-11-04

### Added
- Initial packaging of syxscott/academic-paper-polish as a DSH bundle:
  host skill provider (per-load disk read, absolute resource base),
  39 skill files, locale metadata, original icon.
- Workaround for the cross-drive pnpm symlink issue (junction on C:).
