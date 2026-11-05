# Changelog

All notable changes to this project are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/); versions follow semver.

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
