// Client half of dsh-academic-paper-polish.
//
// Renders a "论文助手" panel in the right sidebar (`sidebar.right.pane.tab`):
// journal hard-rule lookup, one-click module prompts, an interactive
// submission checklist, the semantic figure colour dictionary, and the eight
// cross-module hard rules.
//
// Data below is transcribed from the skill's own reference files
// (references/journal-constraints.md, references/checklist.md,
// references/figure-design-system.md, SKILL.md) so the panel stays in sync with
// the skill content shipped in `skill/`.
//
// Styling uses only `--dsw-alias-*` theme tokens, so the panel follows the
// host's light/dark theme. Plain React (no JSX) because the client module is
// loaded as plain JavaScript by the browser module loader.

window.__ModuleLoader__.load({
  id: 'dsh-academic-paper-polish',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useMemo, useRef } = React;

    // ── data ────────────────────────────────────────────────────────────

    const JOURNALS = [
      {
        id: 'gca',
        name: 'GCA',
        full: 'Geochimica et Cosmochimica Acta',
        meta: ['Elsevier', '地球化学 / 宇宙化学'],
        scope: '同位素地球化学与宇宙化学；强调示踪、机制与定量解释。',
        structure: 'Results 与 Discussion 必须分离，各自独立编号。Results 只给数据与观测、尽量简洁；Discussion 把新结果置于前人工作中，并给出更广的地学意义与启示（每小节末点出意义）',
        conclusion: '允许独立结论段',
        length: '—',
        front: [
          'Cover Letter 必推荐 3 位副主编（Associate Editors，名单取自 GCA editorial board 页）',
          '必备信息：通讯作者及邮箱 · 通信地址 · Keywords · Figures · Tables · Citations',
          '回避特定审稿人 / 编辑仅为建议（purely advisory），不具约束力',
        ],
        figure: [
          ['照片', '300 dpi'],
          ['线绘', '1000 dpi'],
          ['单栏宽', '<85 mm'],
          ['双栏宽', '<180 mm'],
          ['格式', 'TIFF / JPG'],
          ['体积', '单图 <10 MB · 全文 <50 MB'],
        ],
        submit: ['每图单独文件（Figure_1、Figure_2）', '图注置于图下，另交单独文件', '禁把多图合并成一张'],
        refs: 'Elsevier author-date；文末按第一作者字母序',
        redlines: ['不收纯方法学 / 技术 / 模型论文', '不收 regional case studies', '摘要语法错误 >6 处 → 编辑不读正文'],
        quotes: [
          '"to present studies of fundamental significance and broad relevance for understanding geochemical systems, mechanisms, and processes, and of interest to a broad and diverse audience of geochemists"',
          '"placing the new results in the context of published work"',
          '"broader geochemical significance and implications"',
          '"purely advisory"',
        ],
        ref: 'references/journal-constraints.md §GCA',
      },
      {
        id: 'est',
        name: 'ES&T',
        full: 'Environmental Science & Technology',
        meta: ['ACS（美国化学会）'],
        scope: '环境科学与技术；强调机理、测量方法与可推广的环境意义。',
        structure: 'Results 与 Discussion 合并为 Results and Discussion（Be complete but concise；avoid unsupported speculations；avoid long-winded discussion）',
        conclusion: '禁用独立结论段（"A separate conclusion is not to be used"）',
        length: 'Research Article ≤ 7,000 词',
        front: [
          '必填 Cover Letter（3–4 段）',
          'Article header 每句首字母大写（非全部单词）',
          '栏目制：必备 Abbreviations 与 Formulae and Equations 两个板块',
        ],
        figure: [
          ['照片', '300 dpi'],
          ['线绘', '1000 dpi'],
          ['单栏宽', '<85 mm'],
          ['双栏宽', '<180 mm'],
          ['格式', 'TIFF / JPG'],
        ],
        submit: ['每图单独文件', '图注置于图下 + 单独文件', '连续行号'],
        refs: 'ACS author-date',
        redlines: ['Results 与 Discussion 必须合并', '不得另设 Conclusion 段', '摘要语法错误 >6 处 → 编辑不读正文'],
        quotes: [
          '"A separate conclusion is not to be used"',
          '"Be complete but concise"',
          '"avoid unsupported speculations"',
          '"avoid long-winded discussion"',
        ],
        ref: 'references/journal-constraints.md §ES&T',
      },
      {
        id: 'ppp',
        name: 'PPP',
        full: 'Palaeogeography, Palaeoclimatology, Palaeoecology',
        meta: ['Elsevier', '古地理 / 古气候 / 古生态'],
        scope: '地质记录优先的古地理、古气候与古生态；强调定量重建与证据链。',
        structure: 'Abstract → Introduction → Geological setting → Materials and Methods → Results → Discussion → Conclusions',
        conclusion: '有独立结论段（推荐 1–2 段；原文上限：最多两段、总长 ≤30 行）',
        length: 'Articles 5,000–7,000 词（4–8 图）｜Reviews 8,000–10,000 词｜Short Communications 4,000 词（<3 图表）',
        front: [
          'Highlights <5 条，每条 85 个字符（含空格）',
          'Abstract 300 词，避免缩写与参考文献',
          'Keywords <6 个，避免与题目中的词重复',
          'Article header 每句首字母大写',
          'Graphical Abstract 可选（独立文件上传，最小 531×1328 px，缩至 5×13 cm 仍可读）',
        ],
        figure: [
          ['照片', '300 dpi'],
          ['位图线条图', '1000 dpi'],
          ['线条+照片混合', '500 dpi'],
          ['单栏宽', '<85 mm'],
          ['双栏宽', '<180 mm（设计尺寸 ≤180 × 230 mm）'],
          ['格式', 'TIFF / JPG（禁 GIF / BMP / PICT / WPG）'],
          ['体积', '单图 <10 MB · 合计 <50 MB'],
          ['panel 标签', '大写字母置每面板左上/左下，不加括号与框'],
        ],
        submit: [
          '连续行号（送审必查项，不每页重起）',
          '每图单独文件',
          '图注置于图下 + 单独文件',
          '正文首次提及处引用图，补充图用 Figure S1',
          '🔴 不允许 Plates（化石标本图像集一律按 Figure 提交）',
        ],
        refs: '正文作者-年份括注制（Smith, 2011 / Smith et al., 2003）；同作者同年正文与文献清单都用 a/b/c；文末排序：字母序 → 单作者按年 → 双作者按第二作者字母 → 多作者按年；正文与清单双向一致',
        redlines: [
          'Highlights 每条 ≤85 字符',
          'Abstract 不应出现引用',
          'Abstract / Conclusion 不应出现文献',
          'Introduction / Discussion 禁四级标题、禁切得过碎',
          'Maps 不得显示政治争议边界',
          '研究点位须给国际经纬度（≤10 个写正文，>10 个列表）',
          '近 50,000 年内用 cal. B.P.；>2500 Ma 用 "m.y."',
        ],
        quotes: [
          '"(Smith, 2011)"',
          '"(Smith et al., 2003)"',
          '"see Section 2.3.2"',
          '"Figure S1"',
          '"no more than 30 lines total"',
        ],
        ref: 'references/journal-constraints.md §格式与体裁规范',
      },
      {
        id: 'paleobiology',
        name: 'Paleobiology',
        full: 'Paleobiology（Cambridge，古生物 / 化石形态学，规则最细）',
        meta: ['Cambridge University Press', '化石形态学首选刊'],
        scope: '古生物与化石形态学；接受度高的是图件方法学与系统发育工作。',
        structure: 'Introduction → [Geological setting] → [Repository] → Systematic description → Discussion',
        conclusion: '—',
        length: 'Research Article 约 ≤20–25 印刷页（投稿上限 8,500 词 + 15 个图表）｜Review Article ca. 6,500–8,500 词 + 10–15 图表｜Methodological Advances 按 Research Article 提交',
        front: [
          '🔴 Non-technical Summary ≤300 词（在前）与 Abstract ≤300 词（各自独立成页、彼此空一行）',
          'Non-technical Summary 须让非专业读者读懂',
          'Keywords <6',
          '全稿 12 号 Times New Roman + 双倍行距 + 连续行号',
          'US Letter、四边 1 英寸、不用两端对齐、不在右边界断词',
          '稿件顺序：title page → abstract page → text → Acknowledgements → Competing Interests → Literature Cited → appendix → figure captions → table captions',
          '标题三级：Primary 居中加粗 / Secondary 加粗斜体 / Tertiary 加粗斜体 + 句点',
          'Boxes 可选，正文 ≤150 字',
          'running headers（LRH/RRH）≤50 字符全大写；标题仅首词与专有名词大写、结尾不加句号',
        ],
        figure: [
          ['送审图', '<40 兆像素（宽×高 <40,000,000 px）才能进 PDF proof'],
          ['终稿 照片', '600 dpi'],
          ['终稿 线绘', '1200 dpi（1-bit 黑白或 CMYK）'],
          ['终稿 组合图', '800 dpi'],
          ['终稿 半调', '600 dpi（8-bit 灰度或 CMYK）'],
          ['单栏宽', '9 cm'],
          ['双栏宽', '18 cm'],
          ['最大高', '24 cm'],
          ['字号下限', '8 pt（终版，无衬线、嵌入、不用粗体）'],
          ['线宽下限', '≥0.11 mm（0.3 pt）；突出线 0.75–1.0 pt'],
          ['矢量图', 'eps / pdf / ai，无 dpi 要求'],
          ['色彩避坑', '红 / 蓝·红 / 绿 / 蓝·绿 / 蓝·黄'],
        ],
        submit: [
          '🔴 图不得嵌入正文，所有图作为独立文件提交',
          '🔴 不用图注排位（no figure call outs）',
          '送审文件名含图号（Figure_1.tif）',
          '终稿命名如 Fig1_2col.tif',
          '图注须解释所有缩写与制图方法',
        ],
        refs: '作者-年份制且作者与年份间不加逗号（Darwin 1859）；三位及以上用首位作者 + et al.；不同作者用分号、同一作者多次用逗号；引文须给页码；作者名粗体、期刊名斜体不缩写、卷号粗体、Hanging Indent；🔴 最终稿不用 Cite-While-You-Write；🔴 SI 文献不计入主 Literature Cited',
        redlines: [
          '标本照片必须带比例尺（数值随比例尺或图注给出），不可用 ×40 等放大倍数代替（终版可能缩放）',
          'Ga/Ma/ka = 年代；Gyr/Myr/kyr = 跨度',
          'DOI 必须是最终 DOI（数据仓库 DOI 须在 proof 前激活）',
          'SI 文献不计入主 Literature Cited',
          '🔴 Competing Interests 所有作者必写（无则 "the author/authors declare none"）',
          'Author Contributions 参考 CRediT；数据与代码遵循 FAIR',
          '正文 (Fig. 2)、(Fig. 3A)，Table / Appendix 不缩写',
        ],
        quotes: [
          '"Research Articles present original, analytical results in any area of paleobiology. These should be timely, relevant, and of broad interest. Research Articles typically do not exceed about 20-25 printed pages. Submissions up to 8500 words and 15 figures and tables."',
          '"Methodological Advances describe new analytical methods that are broadly relevant to the field of paleobiology … should be presented within the context of an in-depth application to a specific paleobiological problem, and submitted as a Research Article."',
          '"All illustrative materials should be referred to in your manuscript text as "Figures". Tables and figures must be cited in the text, must be numbered consecutively in Arabic numerals, and captions must be provided in all cases."',
          '"the author/authors declare none"',
        ],
        ref: 'references/paleobiology-journal.md',
      },
      {
        id: 'app',
        name: 'APP',
        full: 'Acta Palaeontologica Polonica',
        meta: ['PAN（波兰科学院）', 'CC BY 开放获取', 'IF 1.8（2025 JCR）'],
        scope: '古生物全领域，偏好有普遍意义、可推广的研究。',
        structure: 'Introduction → Material and methods → Results / Systematic palaeontology → Discussion → Conclusions',
        conclusion: '有独立结论段（与讨论合并时须题为 "Concluding remarks"）',
        length: 'Articles 中等篇幅（≤100 排版页）｜Brief reports 2,000–3,000 词（约 12 个双倍行距页）｜Discussions 1,000–1,500 词｜Prefaces 500–1,500 词｜Monographs 50,000–75,000 词',
        front: [
          '结构化摘要 100–300 词（方法/结果/结论），新分类单元须在摘要给出名称',
          'Keywords 3–8 个（投稿系统主题 + 自拟 3–8 个）',
          'Cover Letter ≤300 词（一页 A4）',
          '建议推荐 3–5 位审稿人（须无利益冲突）',
        ],
        figure: [
          ['照片', '400 dpi，黑背景、边缘清晰'],
          ['线绘', '400 dpi TIFF（黑白位图）'],
          ['单栏宽', '89 mm'],
          ['双栏宽', '183 mm'],
          ['最大长', '237 mm'],
          ['字号', 'Calibri 8 pt'],
          ['线宽', '0.2 mm'],
          ['比例尺', '0.7 mm'],
          ['格式', 'CDR / AI / EPS（矢量优先）/ 分层 TIFF / PSD'],
        ],
        submit: [
          '图与表作为单独文件提交（投稿时标注位置）',
          '标注单独图层，并另交一份无标注版',
          '每图旁须留出插图注的空间',
          '标本照片用比例尺，不用放大倍数',
        ],
        refs: '作者-年份制；作者、年份、题名各以"句点 + 单空格"分隔；不缩写刊名',
        redlines: [
          '🔴 ZooBank 命名注册强制（植物新类群注册 IPNI）',
          '🔴 全稿 Times New Roman 12 pt + 双倍行距',
          '不两端对齐、不在右边界断词',
          '数据须存 Dryad / MorphoBank / GenBank（出版条件）',
          '无投稿费；10 排版页内免版面费，超出每页 EUR 22；彩图自 69(1) 起免费',
          'iThenticate 查重',
          '🔴 缅甸琥珀禁令：2017 年起收集的缅甸琥珀不予发表（2020-04-23 生效）',
          '所有图示与描述的化石须存于合适博物馆并给馆藏号',
        ],
        quotes: [
          '"Illustrations can be printed at two-column width (183 mm) or one-column width (89 mm), maximum length 237 mm, and should be designed accordingly."',
          '"Font: we recommend Calibri 8 pt., line thickness should be 0.2 mm, scale bars 0.7 mm"',
          '"line art images scanned or saved in bitmap-based programs as TIFF format (black and white bitmap) at a resolution of 400 dpi."',
          '"Provide a structured abstract of min 100, max 300 words summarizing methods, results, and conclusions of the study in terms accessible to the general reader."',
          '"the registration in ZooBank of nomenclatural acts published in APP is mandatory prior to online publication"',
          '"There are no obligatory page charges for papers up to 10 typesetted pages"',
          '"Concluding remarks"',
          '"Kowalski (1900) noted that..."',
        ],
        ref: '官方 Instructions for Authors（2024-01-03 复核）+ references/multi-journal-style-guides.md §六',
      },
      {
        id: 'pe',
        name: 'PE',
        full: 'Palaeontologia Electronica',
        meta: ['开放获取 · 最古老电子古生物刊', '无页限 · 无版面费'],
        scope: '古生物全领域；纯数字化发行、无版面费、无页限。',
        structure: 'title page → author page → abstract → translated abstracts（可选）→ plain language summary → 正文 → acknowledgements → references → 图/表/附录图注',
        conclusion: '—',
        length: '🔴 无页限',
        front: [
          'Abstract ≤250 词（大写标题、左对齐页顶），不含参考文献',
          '🔴 必须提供 plain language summary',
          'Keywords ≤6 个',
          '标题简短左对齐、仅首字母大写',
          '独立作者页（送审前移除）；每作者需传 72 ppi ≥300 px 照片与简介',
        ],
        figure: [
          ['分辨率', '300 ppi（首次 PDF 投稿可 150 ppi）'],
          ['单栏宽', '84 mm'],
          ['双栏宽', '175 mm'],
          ['字号', '≥8 pt'],
          ['色彩模式', '🔴 RGB，不用 CMYK'],
          ['照片格式', 'TIFF / PSD'],
          ['矢量格式', 'AI（Illustrator CS6）/ EPS'],
          ['图部件编号', '用字母 1A, 1B（非 1.1）'],
        ],
        submit: [
          '图 / 表 / 附录作为单独文件；单文件 ≤50 MB，总计 ≤200 MB',
          '全稿双倍行距（含摘要、正文、参考文献、图注）',
          '右边界不对齐；不用脚注',
          '🔴 文件名 ISO 9660：≤8 字符，仅小写 / 数字 / _ / .',
        ],
        refs: '作者-年份制',
        redlines: [
          '🔴 终稿图不得用 Word 或 PDF 提交',
          '🔴 提交前须打印所有图，彩色图也要印黑白检查灰度是否够区分',
          '线绘 / plot / sketch 背景白；照片背景白或黑（黑背景 RGB 0,0,0）',
          '标题层级：一级全大写居中 / 二级粗体左对齐 / 三级粗体 + 句点',
        ],
        quotes: [
          '"Figures should normally be created with widths equal to 175 mm or 84 mm at 300 ppi or higher (figures can be reproduced at 150 ppi for first PDF submission)."',
          '"The size of letters, numbers and symbols should be chosen with the printed size in mind (8 point type or larger)."',
          '"authors must ensure that the contrast between inscriptions and background is sufficient."',
          '"Figures, Tables, and Appendices must be numbered in the order they are cited in the text."',
          '"All material submitted to PE must meet the following electronic-submission requirements, which are based on ISO 9660 constraints for naming of files. Your file names may ONLY contain the following characters: 1. Lower case 2. Digits 0-9 3. The symbols underscore (_) or period (.). Your file names may _NOT_ contain any of the following: 1. More than 8 characters 2. File extensions longer than 3 characters 3. Spaces 4. Any other characters not listed above"',
        ],
        ref: 'references/multi-journal-style-guides.md §七（Contributor Instructions）',
      },
      {
        id: 'jm',
        name: 'JM',
        full: 'Journal of Micropalaeontology（Copernicus 平台）',
        meta: ['Copernicus 出版', '单栏 · 版心 177.0 mm'],
        scope: '微体古生物方法学：有孔虫 / 介形虫 / 钙质超微化石 + 自动化与统计。',
        structure: '章节标题必须编号（3 / 3.1 / 3.1.1，最多三级）；正文避免脚注；附录用大写字母编号（Appendix A），公式/图/表编号为 (A1)、Fig. B5、Table C6；稿件 1 栏（版心 177.0 mm，通栏图宽 175.0 mm）+ 行号 + 页码',
        conclusion: '—',
        length: '—',
        front: [
          '章节标题全部编号（introduction / results / discussions / summary）',
          'Data availability 段置于正文末尾、致谢之前',
          '使用过 AI 工具须在 Methods 或 Acknowledgements 说明',
        ],
        figure: [
          ['分辨率', '300 dpi'],
          ['最小图宽', '≥8 cm'],
          ['格式', 'PDF / PS / EPS / JPG / PNG / TIFF'],
          ['矢量优先', 'EPS 或 PDF，字体须嵌入'],
          ['单图体积', '≤5 MB'],
          ['全部文件', '≤30 MB（不含 SI）'],
          ['稿件版式', '1 栏；文件 ≤50 MB；连续行号'],
        ],
        submit: [
          '🔴 复合图必须合并成单文件',
          '🔴 图例必须画在图里，不能靠图注解释',
          '文件名 fig01 / fig02',
          '图与图注插入正文首次提及处（不置于文末）',
          'SI ≤50 MB',
        ],
        refs: '—',
        redlines: [
          '🔴 色觉无障碍：须用 Coblis 模拟器检查配色',
          '🔴 表格不得交 PDF / 图片文件',
          '地图须遵联合国地名规范，避免争议边界',
          '附录编号 Appendix A / B',
          '表格：Table 不缩写且随数字首字母大写、避免彩色单元格、横线仅在表头与表体上下',
          '日期格式 dd month yyyy；年份用 CE / BCE',
          '改字体要改原字体，而不是加文本框或额外图层',
        ],
        quotes: [
          '"Composite figures containing multiple panels should be collected into one file before submission."',
          '"A legend should clarify all symbols used and should appear in the figure itself, rather than verbal explanations in the captions"',
          '"Individual figures should not exceed 5 MB, and the overall size of all submitted files excluding supplements should not exceed 30 MB."',
          '"The width should not be less than 8 cm."',
          '"it is important that the colour schemes used in your maps and charts allow readers with colour vision deficiencies to correctly interpret your findings. Please check your figures using the Coblis – Color Blindness Simulator"',
        ],
        ref: 'references/multi-journal-style-guides.md §十（Copernicus 平台官方投稿说明）',
      },
      {
        id: 'palz',
        name: 'PalZ',
        full: 'Paläontologische Zeitschrift（Springer）',
        meta: ['Springer', 'ISSN 0031-0220 / 1867-6812', 'IF 1.5（2025）', 'single-blind 评审'],
        scope: '古生物全谱：Palaeozoology · Palaeobotany · Palaeoecology · Palaeogeography · Geobiology · 理论与方法。',
        structure: '三种体裁：Review Article / Research Paper / Short Communication',
        conclusion: '—',
        length: 'Review ≤40 印刷页（约 32,000 词）｜Research ≤20 印刷页（约 16,000 词）｜Short Communication ≤6 印刷页（约 4,800 词）',
        front: ['Abstract 150–250 词，不含未定义缩写与未指定引用', 'Covering letter 另需附本人近期该主题论文清单'],
        figure: [
          ['矢量', 'EPS（首选）'],
          ['半调', 'TIFF'],
          ['其他', 'MSOffice 文件亦可接受'],
          ['字体', '矢量图必须嵌入字体'],
          ['命名', 'Fig1.eps（"Fig" + 编号）'],
        ],
        submit: ['所有图件电子提交', '须注明绘制所用图形软件', '矢量图字体须嵌入'],
        refs: '作者-年份制；参考 APA 7 的作者数规则',
        redlines: [
          '🔴 分类单元名用粗体（与 APP / Paleobiology 的斜体相反）',
          '🔴 authority 后加逗号（正文引用不加逗号）',
          '🔴 同义名列表隔行 hanging indent，缩进行垂直对齐',
          '子标题斜体 + 句点；空行仅在属级与种级前后',
        ],
        quotes: [
          '"Paläontologische Zeitschrift publishes three different types of contributions, Review Articles, Research Papers, and Short Communications."',
          '"Review Articles are substantial papers, usually summarizing the state of research in some area or a specific topic or taxonomic group. These articles can be up to 40 printed pages long (approximately 32,000 words of text only or about 21,000 words plus figures [excluding figure captions])"',
          '"Research papers communicate important research findings on specific topics of all fields of palaeontology and related topics. They should usually not exceed 20 printed pages in length (approximately 16,000 words of text only or about 10,500 words plus figures)."',
          '"Short communications … are typically no more than 6 printed pages long (4,800 words of text only or approximately 3,000 words plus figures)."',
          '"Please provide an abstract of 150 to 250 words. The abstract should not contain any undefined abbreviations or unspecified references."',
          '"Cite references in the text by name and year in parentheses."',
          '"For vector graphics, the preferred format is EPS; for halftones, please use TIFF format."',
          '"Name your figure files with "Fig" and the figure number, e.g., Fig1.eps."',
        ],
        ref: 'references/multi-journal-style-guides.md §八（Springer Submission guidelines 官方原文）',
      },
      {
        id: 'micropaleontology',
        name: 'Micropaleontology',
        full: 'Micropaleontology（AIP）',
        meta: ['AIP（美国物理学会）', '微体古生物专业刊'],
        scope: '微体古生物：放射虫、有孔虫、介形虫、钙质超微化石。',
        structure: '—',
        conclusion: '—',
        length: '—',
        front: [],
        figure: [],
        submit: [],
        refs: '—',
        redlines: [
          '🔴 图件标签用 "TEXT-FIGURE" 而非 "Fig."',
          '地质图用黑白花纹 + 插图定位图 + 比例尺 + 指北针',
          '本领域 93% 的图为灰度（实测 376 张嵌入图），配色按灰度设计',
        ],
        quotes: [],
        ref: 'references/micropaleo-paper-patterns.md',
      },
      {
        id: 'esr',
        name: 'ESR',
        full: 'Earth-Science Reviews',
        meta: ['Elsevier', 'IF 11.3 · CiteScore 20.8', 'single anonymized · ≥2 名审稿人'],
        scope: '🔴 只发综述（review articles），覆盖地学全领域。',
        structure: '编号章节（1.1 / 1.1.1），摘要不计入编号',
        conclusion: '—',
        length: 'Review paper 无字数上限（>20,000 词须先与编辑沟通）｜Discussion / Reply ≤3,000 词',
        front: [
          '🔴 Abstract 必填 ≤250 词，须能独立成篇、避免引用与非常用缩写',
          '🔴 Keywords 必填 1–7 个',
          '🟡 Highlights 鼓励（3–5 条，每条 ≤85 字符），非必须',
          '🔴 投稿时须声明数据可用性',
          '🔴 投稿时须声明生成式 AI 使用情况',
        ],
        figure: [
          ['照片', '300 dpi（单栏 ≥1063 px / 整页 ≥2244 px）'],
          ['线绘位图', '1000 dpi（单栏 ≥3543 px / 整页 ≥7480 px）'],
          ['矢量', 'EPS / PDF，嵌入字体'],
          ['图表', 'XLS / XLSX'],
          ['标注图', 'PPT / PPTX，嵌入图 ≥300 dpi'],
        ],
        submit: [
          '每图单独文件，Figure_1 / Figure_2',
          '图注置于图下 + 单独文件，且必须在图外',
          '禁多图合并（除非本就是对比图）',
          'Word 单栏；双栏仅限 LaTeX',
          '连续行号；PDF 非源文件',
        ],
        refs: 'author-date；文末按第一作者字母序、同作者按时间；摘要中引用的文献须完整给出；数据集引用前加 [dataset] 并含 6 项',
        redlines: [
          '🔴 只发综述，常规研究论文不收',
          '🔴 文献计量研究不收（只能放 SI）',
          '🔴 只堆文献不整合 → 不接受',
          '实为研究论文 / 案例研究 → 转投专业刊',
          '生物 / 生态 / 土壤农业 / 地质工程 → 投别刊',
          '🔴 禁 AI 生成或修改代表原始观测数据的图像',
          '🔴 Invited Review Article 仅限已受邀才可选',
          'Discussion 须在原文发表后 6 个月内提交；Reply 须在接到通知后 1 个月内提交，双方各限 1 次',
          '常规研究论文只在 occasional special issue 收录',
        ],
        quotes: [
          '"Earth-Science Reviews publishes review articles dealing with all aspects of the Earth Sciences"',
          '"Earth-Science Reviews offers authors the rare opportunity to explore a particular subject without any limitation on the number of words used."',
          '"Review articles must integrate and advance existing knowledge and highlight new directions by synthesizing, evaluating and discussing previously published literature"',
          '"Bibliometric studies will not be considered."',
          '"You are required to provide a concise and factual abstract that does not exceed 250 words."',
          '"You are required to provide 1 to 7 keywords for indexing purposes."',
          '"You are encouraged to provide article highlights at submission. Highlights should consist of 3 to 5 bullet points, each a maximum of 85 characters, including spaces."',
          '"Submit files with .doc/.docx extensions for Word and .tex for LaTeX files. A PDF is not an acceptable source file."',
          '"Submit each image as a separate file using a logical naming convention for your files (for example, Figure_1, Figure_2 etc.)."',
          '"Reference list must be in alphabetic order by first author."',
        ],
        ref: 'references/multi-journal-style-guides.md §一（Elsevier 官方 guide，2026-11-01 复核）',
      },
    ];

    const MODULES = [
      { no: '01', icon: '📝', name: '摘要', file: 'prompts/01-abstract.md', hint: '把整篇压缩进 300 词' },
      { no: '02', icon: '🔭', name: '引言', file: 'prompts/02-introduction.md', hint: '倒金字塔 · 缺口 · 路线图' },
      { no: '03', icon: '📚', name: '文献综述', file: 'prompts/03-literature-review.md', hint: '让文献对话而非罗列' },
      { no: '04', icon: '🧪', name: '研究方法', file: 'prompts/04-methods.md', hint: '经得起同行复现' },
      { no: '05', icon: '📊', name: '结果', file: 'prompts/05-results.md', hint: '只讲发现了什么' },
      { no: '06', icon: '💡', name: '讨论', file: 'prompts/06-discussion.md', hint: '结果 ↔ 文献 ↔ 理论 ↔ 局限' },
      { no: '07', icon: '🎯', name: '结论', file: 'prompts/07-conclusion.md', hint: '升华但不引入新信息' },
      { no: '08', icon: '🤖', name: '去 AI 化', file: 'prompts/08-deai-polish.md', hint: '终稿通篇润色' },
      { no: '09', icon: '🎯', name: '选刊投稿', file: 'prompts/09-journal-submission.md', hint: '先定期刊再动笔' },
      { no: '10', icon: '💬', name: '审稿回复', file: 'prompts/10-reviewer-response.md', hint: '逐条答复的四要素' },
    ];

    const CHECKLIST = [
      {
        id: 'A',
        name: '写作前',
        items: [
          '我能回答 Why / What / What did you find / What does it mean',
          '已确定目标期刊（查过 Aims & Scope + 近期 3 篇作者指南）',
          '已确认该刊 Results 与 Discussion 是分离还是合并',
          '已确认该刊有无独立结论段',
          '所有图表已制作完成，配色统一',
          '已建文献库（Zotero / EndNote）',
        ],
      },
      {
        id: 'B',
        name: '题目 · 署名 · 摘要',
        items: [
          '题名准确、简洁、清楚',
          '核心内容的关键词放在题名开头',
          '题名长度 / 缩写 / 大小写符合该刊格式',
          '署名按实际贡献大小确定，每人都能对自己的论点 / 数据 / 结果答辩',
          '贡献很少者已放入致谢而非署名',
          '共同一作已注明 "These authors contributed equally to the work"',
          '地址：详细通讯地址 + 邮政编码；多地址按作者顺序上标标注',
          '出版时已调离 → 脚注 Present address',
          '兼聘 / 客座 → 同时标注实际单位与受聘单位，明确有效通讯地址',
          '摘要含 背景 / 科学问题 / 研究结果 / 研究意义 四部分',
          '摘要无引用、无图表、无缩写、无化学式 / 数学式 / 角标 / 希腊文',
          '摘要有 However / We found that / Based on we suggest that 等分层指示词',
          '摘要语法错误 ≤ 6 处（★硬红线）',
          '摘要未重复引言背景（结论不是引言的复述）',
        ],
      },
      {
        id: 'C',
        name: '引言',
        items: [
          '四大内容齐：研究背景 / 研究现状（引出问题）/ 问题剖析 / 目的与手段',
          '先大背景大意义，再逐渐聚焦，肯定前人贡献',
          '已充分引用与本文相关的重要文献（不充分 → 审稿人认为阅读不够）',
          '用 However 引出不足，而非直接批评前人',
          '避免点名批评："The deficiency of Wang\'s approach is…"',
          '避免 for the first time / 首次提出 / 首次发现 / 国际先进水平',
          '未故意制造悬念（读者没耐心读到结尾）',
          '结构为倒金字塔：由大到小收拢',
          '★ opening（提出的问题）与 resolution（给出的答案）对齐：开口 = 收口才 on target',
        ],
      },
      {
        id: 'D',
        name: '材料与方法',
        items: [
          '客观描述区域地质背景、气候背景、环境参数',
          '样品采样方法与样品数量',
          '实验方法、仪器检测条件、软件版本',
          '读者看完能知道如何开展、如何重现实验',
        ],
      },
      {
        id: 'E',
        name: '结果与讨论',
        items: [
          'Results 按产物 / 表征手段平行铺开',
          'Discussion 按机理收拢',
          '结果陈述能让人感觉出"关键影响因素是啥"',
          '讨论走完 6 步：引言空白 → 重述发现 → 解释并比较 → 局限性 → 未来启示 → 结论',
          '已说明局限性对结果的潜在影响',
          '已给出环境 / 地学意义（"知道了这些有什么用？"）',
          '结果与讨论的合并 / 分离方式符合目标期刊要求',
          'ES&T：结论并入 R&D，未另设 Conclusion 段',
        ],
      },
      {
        id: 'F',
        name: '结论',
        items: [
          '总结要点、突出亮点（创新点）',
          '指明理论意义 / 实际意义（implication）',
          '指明局限性与尚未解决的问题',
          '提出今后研究方向',
          '局限性用了 "First… Second… Further research should…" 句式',
          '以有力的一句收尾',
          '未重复引言背景',
          '未引入新论点或新证据',
          '未下数据不支持的结论',
        ],
      },
      {
        id: 'G',
        name: '参考文献',
        items: [
          '全面：背景 / 方法参考 / 支持证据 / 冲突证据 / 论据比较',
          '精选：近年文献，且已引 Science、Nature、Annual Reviews 系列',
          '尽量读了原文（尤其直接引用的数据）',
          '书写规范、逐条核对',
          '无五误区：知而不引 / 断章取义 / 引而不确 / 来源不实 / 盲目自引',
          '用文献管理器保证引文与参考文献一致',
          '综述：约 100 篇量级；近 5 年（最好 1–3 年）；尽量一次文献',
          '综述：未引用非公开发表文献、教材、专科书内容',
        ],
      },
      {
        id: 'H',
        name: '致谢',
        items: [
          '致谢了学术 / 科学问题上有帮助或启发的人员',
          '致谢了提供仪器、设备、实验材料、协作实验者',
          '致谢了外部基金资助，并附注项目号 / 合同书编号',
          '贡献很少但不宜署名者在致谢中体现',
        ],
      },
      {
        id: 'I',
        name: '投稿',
        items: [
          'ACCEPTANCE 十点：细节 / 复核 / 审视审稿意见 / 英语尽善尽美 / 呈现很重要 / 耐心修改 / 致谢帮助过你的人 / 新颖且未发表 / 批判性审视自己的稿件 / 遵守伦理',
          '已推荐 3-5 位审稿人（未找领域大牛）',
          'Cover Letter 说明为何适合该刊',
          'Cover Letter 披露潜在利益冲突',
          'GCA：已提供 3 位 Associate Editors 姓名',
          '上下标、字体大小、参考文献前后一致、格式统一',
          '已按审稿人 8 项关注点反向自查',
        ],
      },
      {
        id: 'J',
        name: '综述专项',
        items: [
          '题目收窄，定义了少量研究问题或假设',
          '已确定 take-home message',
          '已选定结构化原则（时间 / 方法 / 模型理论 / 正反对比 / 地理）',
          '小标题至少三级',
          '覆盖 Summary of major issues / Model and discussion / Perspective on future study',
          '引言占正文核心部分 10%-20%',
          '引言三段：Subject background → Problem → Motivation/justification',
          '文献加工四步：筛选 / 鉴别 / 分类 / 归纳',
          '用了问句式小标题（信息量高于"XX 研究现状"）',
          '有 1-2 张机制总览图替代大段文字',
          '遵循 18 步顺序：主体(11) → 结论(12) → 引言(13) → 摘要(14)',
          '查文献用了滚雪球法 + 检索工具，避免单一方法遗漏',
          '二次文献中的数据已回溯原文查证',
          '综述正文一气呵成，发现旁的问题用便签备注、未中断',
        ],
      },
      {
        id: 'K',
        name: '方法类（AI / 数据驱动）论文专项',
        items: [
          '[体裁] 已判定体裁：方法类（有独立 Results / Discussion）还是描述类（有 Systematic 段）',
          '[体裁] 方法类论文没有搭 Geological setting / Repository / Systematic 三件套',
          '[体裁] 方法类论文有独立 Results 段（实测 46%）',
          '[体裁] 方法类论文有独立 Discussion 段（实测 48%）',
          '[数据集] 数据来源写清（检索式 / 分类群名 + 下载日期）',
          '[数据集] 初样本 → 清洗规则 → 终样本 三段都有',
          '[数据集] 每类样本量进表（含占比列）',
          '[数据集] 标注方式写清（专业实务员 / 公开数据库）',
          '[数据集] 划分比例写清（跨验校验 / train-test split / 三分法）',
          '[数据集] 类别不平衡已显式承认，并说明用什么补偿',
          '[数据集] 数据量级已写出（本领域常见：几百至几万张图）',
          '[方法与环境] 架构已指名（+ 架构图）',
          '[方法与环境] 超参说法自洽（进表 / 写在正文）',
          '[方法与环境] 环境版本全写（Python / PyTorch / CUDA / GPU 型号）',
          '[方法与环境] 训练细节写清（batch / optimizer / epoch / 冻结策略）',
          '[方法与环境] 有基线对比（尽量写出多数类基线数字）',
          '[评估] 指标名写出了（accuracy / precision / recall / F1 / AUC）',
          '[评估] 类别不平衡时，已说明为何不以 accuracy 为主指标',
          '[评估] 混淆矩阵图注用固定句式（行=真值、列=预测、对角线=100%）',
          '[评估] 表注写了"最佳值加粗"声明',
          '[评估] 训练 / 推理时间与精度指标并列为列',
          '[局限] 局限落到对象本身（标本残缺 / 纹理破坏 / 类别不平衡）',
          '[局限] 局限不是"模型不够强"',
          '[局限] 结论里写了适用边界（什么情况不该用 AI）',
          '[局限] 讨论有独立 Threats to validity 或 Strengths+Limitations 段',
          '[声明] Data availability（实物标本在哪 + 数据集 DOI，两件都有）',
          '[声明] Code availability（GitHub + Zenodo DOI）',
          '[声明] Author contributions / Competing interest / Funding',
          '[声明] 声明块顺序与目标刊最近 3 篇一致',
        ],
      },
    ];

    const COLORS = [
      { hex: '#D30203', role: '人工 / 基准' },
      { hex: '#75489A', role: 'AI / 自动' },
      { hex: '#F6A100', role: '单一系列散点' },
      { hex: '#308E2C', role: '环境量验证' },
      { hex: '#093576', role: '拟合线 / 单色阶（→ #00509D）' },
    ];

    const RULES = [
      ['1', '引言 = 倒金字塔', '开口（提出的问题）必须与收口（给出的答案）对齐；开口 > 收口 = overpromising，收口 > 开口 = underpromising。'],
      ['2', '引文密度', 'Introduction 除问题句与过渡句外都要有引用；Results 几乎没有引用；Discussion 每段 5–8 句（topic + 3–4 句带引用 + 2–3 句自己数据）；Abstract / Conclusion 不应出现引用。'],
      ['3', '段落 5–8 句', '1–2 句话的段落是非常差的结构；换了对象主体就分段，一段集中讲清一个问题。'],
      ['4', '讨论六步', '引言空白 → 重述发现（用数据/图）→ 解释并与他人比较 → 表明局限性 → 以后研究的启示 → 结论。'],
      ['5', '结论含局限 + 未来', 'Despite its advantages… First… Second… Further research should focus on…'],
      ['6', '措辞分寸', '禁 for the first time / 首次提出 / 国际先进水平；禁点名批评前人，改用 However, the mechanism has not been fully understood.'],
      ['7', '参考文献五误区', '知而不引 · 断章取义 · 引而不确 · 来源不实 · 盲目自引；综述约 100 篇，优先近 5 年。'],
      ['8', '地质年代', 'Ga / Ma / ka = 年代（dates）；Gyr / Myr / kyr = 跨度（duration）；界线用 /，时间范围用 –。'],
    ];

    // ── i18n: route text through the client locale service when it is usable ──

    const NS = 'dsh-academic-paper-polish';
    /** This implementation's identity in the right-Sidebar tab system. */
    const TAB_ID = 'dsh-academic-paper-polish';
    /** The tab kind the right Sidebar opens for this page. */
    const TAB_KIND = 'academic-paper-polish';

    const DICT_ZH = {
      'panel.title': '论文助手',
      'panel.journal': '期刊',
      'panel.modules': '模块',
      'panel.checklist': '自查',
      'panel.colors': '配色',
      'panel.rules': '铁律',
      'panel.collapse': '收起',
      'panel.expand': '展开',
      'panel.reset': '重置',
      'panel.copy': '复制',
      'panel.copied': '已复制',
      'panel.inserted': '已插入输入框',
      'panel.failed': '复制失败',
      'panel.progress': '进度',
      'type.label': '论文助手',
      'guide.title': '论文助手',
      'guide.description': '期刊硬规则 · 写作模块 · 投稿自查清单',
    };

    const DICT_EN = {
      'panel.title': 'Paper assistant',
      'panel.journal': 'Journal',
      'panel.modules': 'Modules',
      'panel.checklist': 'Checklist',
      'panel.colors': 'Colours',
      'panel.rules': 'Rules',
      'panel.collapse': 'Collapse',
      'panel.expand': 'Expand',
      'panel.reset': 'Reset',
      'panel.copy': 'Copy',
      'panel.copied': 'Copied',
      'panel.inserted': 'Inserted into the composer',
      'panel.failed': 'Copy failed',
      'panel.progress': 'Progress',
      'type.label': 'Paper assistant',
      'guide.title': 'Paper assistant',
      'guide.description': 'Journal rules, writing modules, submission checklist',
    };

    /** Live translator; replaced by the locale service's binding when available. */
    let translate = (key) => DICT_ZH[key] || key;

    /** Live skill index fetched from the host's same-origin route (zero
     *  tokens); falls back to the bundled copy when the route is absent. */
    let liveIndex = null;
    let liveIndexState = 'bundled'; // 'bundled' | 'live' | 'failed' | 'unauthorized'
    const indexListeners = new Set();

    /** Classifies a failed route call: an auth rejection is a different
     *  problem from an unreachable route, and the panel says so. */
    const stateForError = (error) => {
      const status = error && error.status;
      return status === 401 || status === 403 ? 'unauthorized' : 'failed';
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
            liveIndexState = stateForError(error);
            for (const listener of indexListeners) listener();
          });
      } catch {
        liveIndexState = 'failed';
        for (const listener of indexListeners) listener();
      }
    }

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

    // ── helpers ─────────────────────────────────────────────────────────

    const STORAGE_KEY = 'dsh-academic-paper-polish.checklist.v1';

    function readChecked() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch {
        return {};
      }
    }

    function writeChecked(state) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        /* storage unavailable: the checklist still works for this session */
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

    // ── components ──────────────────────────────────────────────────────

    const ICONS = {
      abstract: [
        { t: 'rect', x: 5, y: 3, width: 10, height: 14, rx: 1.6 },
        { t: 'line', x1: 7.4, y1: 7, x2: 12.6, y2: 7 },
        { t: 'line', x1: 7.4, y1: 10, x2: 12.6, y2: 10 },
        { t: 'line', x1: 7.4, y1: 13, x2: 10.6, y2: 13 },
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
        { t: 'line', x1: 7, y1: 3, x2: 13, y2: 3 },
        { t: 'path', d: 'M8 3v4.6L4.7 14.1A1.7 1.7 0 006.2 16.8h7.6a1.7 1.7 0 001.5-2.7L12 7.6V3' },
        { t: 'line', x1: 6.3, y1: 12.2, x2: 13.7, y2: 12.2 },
      ],
      results: [
        { t: 'line', x1: 4, y1: 16.2, x2: 16.5, y2: 16.2 },
        { t: 'rect', x: 5.4, y: 10, width: 2.4, height: 6.2, rx: 0.6 },
        { t: 'rect', x: 9, y: 6.4, width: 2.4, height: 9.8, rx: 0.6 },
        { t: 'rect', x: 12.6, y: 12, width: 2.4, height: 4.2, rx: 0.6 },
      ],
      discussion: [
        { t: 'path', d: 'M3.6 4.4h9.2a1.8 1.8 0 011.8 1.8v3.6a1.8 1.8 0 01-1.8 1.8H8.4L4.4 15.2v-3.6h-.8a1.8 1.8 0 01-1.8-1.8V6.2a1.8 1.8 0 011.8-1.8z' },
        { t: 'path', d: 'M9.6 11.8h4.6a1.8 1.8 0 011.8 1.8v2.4l-3.4-2.4H9.6' },
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

    const MODULE_ICON = {
      '01': 'abstract',
      '02': 'intro',
      '03': 'review',
      '04': 'methods',
      '05': 'results',
      '06': 'discussion',
      '07': 'conclusion',
      '08': 'deai',
      '09': 'journal',
      '10': 'reply',
    };

    const VIEWS = [
      { id: 'journal', label: '期刊', icon: 'book' },
      { id: 'matrix', label: '对比', icon: 'grid' },
      { id: 'match', label: '匹配', icon: 'target' },
      { id: 'figure', label: '图件', icon: 'ruler' },
      { id: 'color', label: '配色', icon: 'palette' },
      { id: 'modules', label: '模块', icon: 'mark' },
      { id: 'checklist', label: '清单', icon: 'check' },
      { id: 'rules', label: '铁律', icon: 'reply' },
    ];

    /** Documented genre / requirement flags, used by the match view.
     *  Every entry is traceable to the skill's own reference files. */
    const MATCH = {
      gca: { genres: ['research'], taxonomy: 'ok', newTaxa: 'no', zoo: false, review: 'no', tags: ['方法学论文不收', '不收区域案例'] },
      est: { genres: ['research'], taxonomy: 'ok', newTaxa: 'no', zoo: false, review: 'no', tags: ['Results/Discussion 必须合并', '禁独立结论段'] },
      ppp: { genres: ['research', 'review'], taxonomy: 'ok', newTaxa: 'no', zoo: false, review: 'yes', tags: ['4–8 图', 'Highlights ≤85 字符'] },
      paleobiology: { genres: ['research', 'review', 'methods'], taxonomy: 'strong', newTaxa: 'yes', zoo: false, review: 'yes', dual: 'nts', tags: ['Non-technical Summary ≤300 词', '图不嵌入正文'] },
      app: { genres: ['research', 'brief', 'taxonomy'], taxonomy: 'strong', newTaxa: 'yes', zoo: true, review: 'no', tags: ['ZooBank 强制注册', '图件参数最精确', 'CC BY'] },
      pe: { genres: ['research', 'taxonomy'], taxonomy: 'strong', newTaxa: 'yes', zoo: false, review: 'no', dual: 'plain', tags: ['无页限无版面费', '必给通俗摘要'] },
      jm: { genres: ['methods', 'research'], taxonomy: 'weak', newTaxa: 'no', zoo: false, review: 'no', tags: ['方法学对口', '须过 Coblis 色觉检查'] },
      palz: { genres: ['research', 'review'], taxonomy: 'strong', newTaxa: 'yes', zoo: false, review: 'yes', tags: ['分类单元名粗体 + authority 加逗号', '三体裁'] },
      micropaleontology: { genres: ['research', 'taxonomy'], taxonomy: 'strong', newTaxa: 'yes', zoo: false, review: 'no', tags: ['TEXT-FIGURE 标签', '地质图用黑白花纹'] },
      esr: { genres: ['review'], taxonomy: 'no', newTaxa: 'no', zoo: false, review: 'only', tags: ['🔴 只发综述', '🔴 文献计量不收'] },
    };

    const GENRES = [
      { id: 'research', label: '研究论文' },
      { id: 'review', label: '综述' },
      { id: 'taxonomy', label: '系统分类 / 新种描述' },
      { id: 'methods', label: '方法学论文' },
    ];

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
`;

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

    // ── helpers: numbers, colour maths ────────────────────────────────

    function firstNumber(text) {
      if (!text) return null;
      const match = /(\d+(?:\.\d+)?)/.exec(String(text));
      return match ? Number(match[1]) : null;
    }

    function figureRow(journal, pattern) {
      const row = journal.figure.find(([label]) => pattern.test(label));
      return row ? row[1] : null;
    }

    function toMillimetres(text) {
      if (!text) return null;
      const value = firstNumber(text);
      if (value === null) return null;
      if (/cm/i.test(text)) return value * 10;
      return value;
    }

    function hexToRgb(hex) {
      const clean = String(hex).trim().replace('#', '');
      const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
      if (!/^[0-9a-f]{6}$/i.test(full)) return null;
      return {
        r: parseInt(full.slice(0, 2), 16),
        g: parseInt(full.slice(2, 4), 16),
        b: parseInt(full.slice(4, 6), 16),
      };
    }

    function relativeLuminance(rgb) {
      const channel = (value) => {
        const c = value / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
    }

    function contrastRatio(a, b) {
      const la = relativeLuminance(a);
      const lb = relativeLuminance(b);
      const light = Math.max(la, lb);
      const dark = Math.min(la, lb);
      return (light + 0.05) / (dark + 0.05);
    }

    /** Machado et al. (2009) CVD simulation matrices, severity 1. */
    const CVD_MATRIX = {
      protan: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
      deutan: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
      tritan: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
    };

    function simulateCvd(rgb, kind) {
      const m = CVD_MATRIX[kind];
      if (!m) return rgb;
      const { r, g, b } = rgb;
      const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
      return {
        r: clamp(m[0] * r + m[1] * g + m[2] * b),
        g: clamp(m[3] * r + m[4] * g + m[5] * b),
        b: clamp(m[6] * r + m[7] * g + m[8] * b),
      };
    }

    function rgbToHex(rgb) {
      const part = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
      return `#${part(rgb.r)}${part(rgb.g)}${part(rgb.b)}`.toUpperCase();
    }

    // ── persistent state ───────────────────────────────────────────────

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

    function Panel(props) {
      const t = translate;
      const [expanded, setExpanded] = useState(true);
      const [viewRaw, setView] = useState(readStore('view', 'journal'));
      const view = VIEWS.some((item) => item.id === viewRaw) ? viewRaw : 'journal';
      const [journalId, setJournalId] = useState(readStore('journal', 'paleobiology'));
      const [checked, setChecked] = useState(readChecked);
      const [openGroups, setOpenGroups] = useState({ A: true });
      const [dimId, setDimId] = useState('structure');
      const [indexRev, setIndexRev] = useState(0);

      useEffect(() => {
        const listener = () => setIndexRev((rev) => rev + 1);
        indexListeners.add(listener);
        return () => {
          indexListeners.delete(listener);
        };
      }, []);
      const [feedback, setFeedback] = useState(null);
      const [query, setQuery] = useState('');
      const [genres, setGenres] = useState(readStore('genres', []));
      const [needTaxa, setNeedTaxa] = useState(readStore('needTaxa', false));
      const [needDual, setNeedDual] = useState(readStore('needDual', false));
      const [paletteText, setPaletteText] = useState(readStore('palette', ''));
      const [fig, setFig] = useState(readStore('figure', { dpi: '600', width: '90', height: '120', size: '4' }));
      const [matrixCell, setMatrixCell] = useState(null);
      const timer = useRef(null);
      const searchRef = useRef(null);

      useEffect(
        () => () => {
          if (timer.current) window.clearTimeout(timer.current);
        },
        [],
      );

      useEffect(() => writeStore('view', view), [view]);
      useEffect(() => writeStore('journal', journalId), [journalId]);
      useEffect(() => writeStore('genres', genres), [genres]);
      useEffect(() => writeStore('needTaxa', needTaxa), [needTaxa]);
      useEffect(() => writeStore('needDual', needDual), [needDual]);
      useEffect(() => writeStore('palette', paletteText), [paletteText]);
      useEffect(() => writeStore('figure', fig), [fig]);

      // keyboard: 1-8 switch views, "/" focuses the search box
      useEffect(() => {
        const onKey = (event) => {
          const target = event.target;
          if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
            if (event.key !== 'Escape') return;
            target.blur();
            return;
          }
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
      }, []);

      const journal = useMemo(
        () => JOURNALS.find((item) => item.id === journalId) || JOURNALS[0],
        [journalId],
      );

      const total = useMemo(
        () => CHECKLIST.reduce((sum, group) => sum + group.items.length, 0),
        [],
      );
      const done = useMemo(
        () => Object.keys(checked).filter((key) => checked[key]).length,
        [checked],
      );

      const flash = (token, kind) => {
        setFeedback({ token, kind });
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setFeedback(null), 1800);
      };

      const feedbackLabel = (kind) => {
        if (kind === 'inserted') return t('panel.inserted');
        if (kind === 'failed') return t('panel.failed');
        return t('panel.copied');
      };

      const deliver = async (token, text) => {
        const actions = props.inputActions;
        try {
          if (actions && typeof actions.insertText === 'function') {
            const span =
              typeof actions.captureInsertion === 'function' ? actions.captureInsertion() : undefined;
            if (actions.insertText(text, span)) {
              flash(token, 'inserted');
              return;
            }
          }
        } catch {
          /* the editor refused the edit — fall back to the clipboard */
        }
        const ok = await copyToClipboard(text);
        flash(token, ok ? 'copied' : 'failed');
      };

      const copyHex = async (token, text) => {
        const ok = await copyToClipboard(text);
        flash(token, ok ? 'copied' : 'failed');
      };

      const modulePrompt = (item) =>
        `使用 academic-paper-polish 技能：读取 ${item.file}，按其中的规则帮我${item.hint}：`;

      const journalPrompt = () =>
        `我要投 ${journal.name}（${journal.full}）。请先按该刊的结构与格式硬约束给我建议：Results 与 Discussion ${journal.structure === '—' ? '按该刊惯例' : journal.structure}；结论段${journal.conclusion === '—' ? '按该刊惯例' : journal.conclusion}；篇幅${journal.length}。再读 ${journal.ref} 确认条款原文。`;

      const toggle = (groupId, index) => {
        const key = `${groupId}.${index}`;
        const next = { ...checked };
        if (next[key]) delete next[key];
        else next[key] = true;
        setChecked(next);
        writeChecked(next);
      };

      const reset = () => {
        setChecked({});
        writeChecked({});
      };

      const toggleGroup = (id) =>
        setOpenGroups((state) => {
          const next = { ...state };
          if (next[id]) delete next[id];
          else next[id] = true;
          return next;
        });

      const allOpen = CHECKLIST.every((group) => openGroups[group.id]);
      const toggleAll = () => {
        const next = {};
        if (!allOpen) for (const group of CHECKLIST) next[group.id] = true;
        setOpenGroups(next);
      };

      const toggleGenre = (id) =>
        setGenres((state) => (state.includes(id) ? state.filter((item) => item !== id) : [...state, id]));

      // ── derived data for the analysis views ──────────────────────────

      const matrix = useMemo(() => {
        const dims = [
          {
            id: 'structure',
            label: '结构',
            cell: (j) => ({
              value: j.structure.includes('必须分离')
                ? '分离'
                : j.structure.includes('合并')
                  ? '合并'
                  : j.structure === '—'
                    ? '—'
                    : '按刊惯例',
              tone: j.structure.includes('必须分离') ? 'warn' : j.structure.includes('合并') ? 'brand' : 'plain',
              detail: j.structure,
            }),
          },
          {
            id: 'conclusion',
            label: '结论段',
            cell: (j) => ({
              value: j.conclusion.includes('禁用') ? '禁用' : j.conclusion.includes('允许') ? '允许' : '—',
              tone: j.conclusion.includes('禁用') ? 'bad' : j.conclusion.includes('允许') ? 'ok' : 'plain',
              detail: j.conclusion,
            }),
          },
          {
            id: 'length',
            label: '篇幅',
            cell: (j) => ({
              value: j.length === '—' ? '—' : String(j.length).split('｜')[0].slice(0, 14),
              tone: 'plain',
              detail: j.length,
            }),
          },
          {
            id: 'abstract',
            label: '摘要',
            cell: (j) => {
              const line = j.front.find((item) => /abstract|摘要/i.test(item));
              const words = line ? firstNumber(line) : null;
              return {
                value: words ? `≤${words} 词` : line ? '见原文' : '—',
                tone: words && words <= 200 ? 'ok' : 'plain',
                detail: line || '未在档案中单列摘要条款',
              };
            },
          },
          {
            id: 'photo',
            label: '照片 dpi',
            cell: (j) => {
              const raw = figureRow(j, /照片|分辨率/) || '';
              const value = firstNumber(raw);
              return {
                value: value ? String(value) : '—',
                tone: value && value >= 600 ? 'ok' : value && value >= 300 ? 'warn' : value ? 'bad' : 'plain',
                detail: raw || '未单列',
              };
            },
          },
          {
            id: 'line',
            label: '线绘 dpi',
            cell: (j) => {
              const raw = figureRow(j, /线绘|线条图/) || '';
              const value = firstNumber(raw);
              return {
                value: value ? String(value) : '—',
                tone: value && value >= 1000 ? 'ok' : value && value >= 300 ? 'warn' : value ? 'bad' : 'plain',
                detail: raw || '未单列',
              };
            },
          },
          {
            id: 'width',
            label: '单/双栏宽',
            cell: (j) => {
              const single = toMillimetres(figureRow(j, /单栏/));
              const wide = toMillimetres(figureRow(j, /双栏/));
              return {
                value: single && wide ? `${single}/${wide}` : single ? String(single) : wide ? String(wide) : '—',
                tone: 'plain',
                detail: `单栏 ${figureRow(j, /单栏/) || '未单列'} ｜ 双栏 ${figureRow(j, /双栏/) || '未单列'}`,
              };
            },
          },
          {
            id: 'submit',
            label: '交稿方式',
            cell: (j) => ({
              value: j.submit.some((item) => /不得嵌入|不嵌入|不置于文末/.test(item))
                ? '不嵌入'
                : j.submit.some((item) => /合并成单文件/.test(item))
                  ? '合并单文件'
                  : j.submit.length > 0
                    ? '单独文件'
                    : '—',
              tone: j.submit.some((item) => /不得嵌入|不嵌入/.test(item)) ? 'warn' : 'plain',
              detail: j.submit.join('；') || '未单列',
            }),
          },
          {
            id: 'refs',
            label: '引用制式',
            cell: (j) => ({
              value: /author-date|作者-年份/.test(j.refs) ? 'author-date' : j.refs === '—' ? '—' : '见原文',
              tone: 'plain',
              detail: j.refs,
            }),
          },
          {
            id: 'scope',
            label: '收录边界',
            cell: (j) => ({
              value: j.redlines.length > 0 ? `${j.redlines.length} 条红线` : '未列',
              tone: j.redlines.length > 2 ? 'bad' : j.redlines.length > 0 ? 'warn' : 'plain',
              detail: j.redlines.join('；') || '未单列',
            }),
          },
        ];
        return dims;
      }, []);

      const ranked = useMemo(() => {
        const scored = JOURNALS.map((item) => {
          const rules = MATCH[item.id];
          if (!rules) return { id: item.id, name: item.name, score: 0, reasons: [], tags: [] };
          let score = 0;
          const reasons = [];
          for (const genre of genres) {
            if (rules.genres.includes(genre)) {
              score += 30;
              reasons.push(`体裁匹配：${GENRES.find((g) => g.id === genre).label}`);
            } else if (rules.review === 'only' || rules.genres.length === 1) {
              reasons.push(`不收该体裁（仅 ${rules.genres.join('/')}）`);
            }
          }
          if (needTaxa) {
            if (rules.taxonomy === 'strong') {
              score += 25;
              reasons.push('系统分类 / 新种描述友好');
            } else if (rules.taxonomy === 'ok') {
              score += 12;
            } else {
              reasons.push('不收分类学论文');
            }
            if (rules.zoo) {
              score += 10;
              reasons.push('ZooBank 强制注册流程成熟');
            }
          }
          if (needDual) {
            if (rules.dual) {
              score += 15;
              reasons.push(rules.dual === 'nts' ? '需 Non-technical Summary' : '需 plain language summary');
            } else {
              reasons.push('无双摘要要求');
            }
          }
          if (genres.length === 0 && !needTaxa && !needDual) score += 20;
          return { id: item.id, name: item.name, full: item.full, score, reasons, tags: rules.tags };
        });
        return scored.sort((a, b) => b.score - a.score);
      }, [genres, needTaxa, needDual]);

      const palette = useMemo(() => {
        const hexes = paletteText
          .split(/[\s,;、]+/)
          .map((token) => token.trim())
          .filter((token) => token.length > 0);
        const entries = [];
        for (const hex of hexes) {
          const rgb = hexToRgb(hex);
          if (!rgb) continue;
          const white = { r: 255, g: 255, b: 255 };
          const black = { r: 0, g: 0, b: 0 };
          const gray = Math.round(relativeLuminance(rgb) * 255);
          entries.push({
            hex: rgbToHex(rgb),
            rgb,
            onWhite: contrastRatio(rgb, white),
            onBlack: contrastRatio(rgb, black),
            gray,
            deutan: rgbToHex(simulateCvd(rgb, 'deutan')),
            protan: rgbToHex(simulateCvd(rgb, 'protan')),
            tritan: rgbToHex(simulateCvd(rgb, 'tritan')),
          });
        }
        const pairs = [];
        for (let i = 0; i < entries.length; i += 1) {
          for (let j = i + 1; j < entries.length; j += 1) {
            const delta = Math.abs(entries[i].gray - entries[j].gray);
            pairs.push({ a: entries[i].hex, b: entries[j].hex, delta, ok: delta >= 28 });
          }
        }
        return { entries, pairs };
      }, [paletteText]);

      const figureReport = useMemo(() => {
        const rules = [];
        const dpi = Number(fig.dpi);
        const width = Number(fig.width);
        const height = Number(fig.height);
        const size = Number(fig.size);
        const photoDpi = firstNumber(figureRow(journal, /照片|分辨率/) || '');
        const lineDpi = firstNumber(figureRow(journal, /线绘|线条图/) || '');
        const single = toMillimetres(figureRow(journal, /单栏/));
        const wide = toMillimetres(figureRow(journal, /双栏/));
        const maxHeight = toMillimetres(figureRow(journal, /最大高|最大长/));
        const minFont = firstNumber(figureRow(journal, /字号/) || '');
        const maxFile = firstNumber(figureRow(journal, /体积|单图体积/) || '');

        const push = (name, state, text, note) => rules.push({ name, state, text, note });

        if (photoDpi) {
          push(
            '照片分辨率',
            dpi >= photoDpi ? 'ok' : 'bad',
            `你的 ${dpi || '—'} dpi / 要求 ≥ ${photoDpi} dpi`,
            dpi >= photoDpi ? '达标' : `还差 ${Math.max(0, photoDpi - dpi)} dpi`,
          );
        }
        if (lineDpi) {
          push(
            '线绘分辨率',
            dpi >= lineDpi ? 'ok' : 'bad',
            `你的 ${dpi || '—'} dpi / 要求 ≥ ${lineDpi} dpi`,
            dpi >= lineDpi ? '达标' : `线绘比照片更严，差 ${Math.max(0, lineDpi - dpi)} dpi`,
          );
        }
        if (single && wide) {
          const ok = width <= single || width <= wide;
          push(
            '版面宽度',
            ok ? 'ok' : 'bad',
            `你的 ${width || '—'} mm / 单栏 ≤ ${single} mm，双栏 ≤ ${wide} mm`,
            ok ? '在允许宽度内' : '超出该刊版心，需缩图或改版式',
          );
        }
        if (maxHeight) {
          push(
            '图高上限',
            height && height <= maxHeight ? 'ok' : 'bad',
            `你的 ${height || '—'} mm / 上限 ${maxHeight} mm`,
            height && height <= maxHeight ? '达标' : '超高，需纵向排版',
          );
        }
        if (maxFile) {
          push(
            '单图体积',
            size && size <= maxFile ? 'ok' : 'warn',
            `你的 ${size || '—'} MB / 上限 ${maxFile} MB`,
            size && size <= maxFile ? '达标' : '超出，可能被要求重新导出',
          );
        }
        if (minFont) {
          push(
            '图内字号',
            'warn',
            `图内最小字号需 ≥ ${minFont} pt（按印刷尺寸）`,
            '这项要你自己量，量完回填到「模块」看规则',
          );
        }
        let redlineIndex = 0;
        for (const redline of journal.redlines) {
          if (/RGB|CMYK|比例尺|嵌入|合并|Plates|ZooBank|AI|放大倍数/.test(redline)) {
            redlineIndex += 1;
            push(`红线 ${redlineIndex}`, 'note', redline, '人工确认这条是否触发');
          }
        }
        return rules;
      }, [fig, journal]);

      /** Remote full-text hits (host route, `?q=`). `null` means "not
       *  available" — the panel then falls back to the local metadata filter. */
      const [remoteHits, setRemoteHits] = useState(null);
      const [remotePending, setRemotePending] = useState(false);

      useEffect(() => {
        const q = query.trim();
        if (!q || liveIndexState !== 'live') {
          setRemoteHits(null);
          setRemotePending(false);
          return undefined;
        }
        let cancelled = false;
        const timer = setTimeout(() => {
          setRemotePending(true);
          fetch(`/dsh-academic-paper-polish/skill-index?q=${encodeURIComponent(q)}`, {
            cache: 'no-store',
            credentials: 'same-origin',
          })
            .then((response) => {
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              return response.json();
            })
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
        }, 180);
        return () => {
          cancelled = true;
          clearTimeout(timer);
        };
      }, [query, liveIndexState, indexRev]);

      const searchResults = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        // The host route searched the file bodies, so its answer is final.
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
            return haystack.includes(q);
          })
          .slice(0, 40);
      }, [query, indexRev, remoteHits]);

      const structureBadge = journal.structure.includes('必须分离')
        ? 'R / D 分离'
        : journal.structure.includes('合并')
          ? 'R & D 合并'
          : '结构按刊惯例';

      const mark = (name, size) => h('span', { className: 'dapp-mark' }, h(Icon, { name, size: size || 16 }));

      const head = h(
        'div',
        { className: 'dapp-head' },
        mark('mark'),
        h(
          'div',
          { className: 'dapp-grow' },
          h('div', { className: 'dapp-title' }, t('panel.title')),
          h('div', { className: 'dapp-sub' }, `${journal.name} · ${t('panel.progress')} ${done}/${total}`),
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

      function renderBody() {
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
                title: `${item.label}（快捷键 ${index + 1}）`,
                onClick: () => setView(item.id),
              },
              item.label,
            ),
          ),
        );

        let content;
        if (view === 'journal') {
          const rows = (pairs) =>
            h(
              'div',
              { className: 'dapp-kv' },
              pairs.map(([k, v]) =>
                h(
                  React.Fragment,
                  { key: k },
                  h('span', { className: 'dapp-k' }, k),
                  h('span', { className: 'dapp-v' }, v),
                ),
              ),
            );
          const bullets = (items) =>
            h('ul', { className: 'dapp-list' }, items.map((item) => h('li', { key: item }, item)));
          const fold = (label, body, count) =>
            h(
              'details',
              { className: 'dapp-fold' },
              h(
                'summary',
                null,
                h(Icon, { name: 'chevron', size: 13, className: 'dapp-chevron' }),
                label,
                count ? h('span', { className: 'dapp-fold-count' }, count) : null,
              ),
              h('div', { className: 'dapp-fold-body' }, body),
            );
          const fact = (k, v, tone) =>
            h(
              'div',
              { className: 'dapp-fact' },
              h('div', { className: 'dapp-fact-k' }, k),
              h('div', { className: 'dapp-fact-v', 'data-tone': tone || undefined }, v),
            );

          const photoDpi = firstNumber(figureRow(journal, /照片|分辨率/) || '');
          const structureValue =
            journal.structure === '—'
              ? '按刊惯例'
              : journal.structure.includes('必须分离')
                ? '分离'
                : journal.structure.includes('合并')
                  ? '合并'
                  : '按刊惯例';
          const structureTone = journal.structure.includes('必须分离')
            ? 'warn'
            : journal.structure.includes('合并')
              ? 'accent'
              : null;
          const conclusionValue =
            journal.conclusion === '—'
              ? '—'
              : journal.conclusion.includes('禁用')
                ? '禁用'
                : journal.conclusion.includes('允许')
                  ? '允许'
                  : '按刊惯例';
          const conclusionTone = journal.conclusion.includes('禁用')
            ? 'bad'
            : journal.conclusion.includes('允许')
              ? 'ok'
              : null;

          content = h(
            'div',
            { className: 'dapp-view' },
            h(
              'select',
              {
                className: 'dapp-select',
                value: journalId,
                onChange: (event) => setJournalId(event.target.value),
              },
              JOURNALS.map((item) =>
                h('option', { key: item.id, value: item.id }, `${item.name} · ${item.full}`),
              ),
            ),
            h(
              'div',
              { className: 'dapp-card' },
              h(
                'div',
                { className: 'dapp-title-row' },
                h('span', { className: 'dapp-title-name' }, journal.name),
                h('span', { className: 'dapp-title-full' }, journal.full),
              ),
              h(
                'div',
                { className: 'dapp-badges' },
                journal.meta.map((item) => h('span', { key: item, className: 'dapp-badge' }, item)),
              ),
              h('div', { className: 'dapp-lead' }, journal.scope),
              h(
                'div',
                { className: 'dapp-facts' },
                fact('Results / Discussion', structureValue, structureTone),
                fact('结论段', conclusionValue, conclusionTone),
                fact(
                  '篇幅',
                  journal.length === '—'
                    ? '—'
                    : journal.length.split('｜')[0].length > 22
                      ? `${journal.length.split('｜')[0].slice(0, 22)}…`
                      : journal.length.split('｜')[0],
                  null,
                ),
                fact(
                  '照片 dpi',
                  photoDpi ? String(photoDpi) : '—',
                  photoDpi >= 600 ? 'ok' : photoDpi >= 300 ? 'warn' : null,
                ),
              ),
            ),
            journal.front.length > 0 ? fold('前置要素', bullets(journal.front), String(journal.front.length)) : null,
            journal.figure.length > 0 ? fold('图表规格', rows(journal.figure), String(journal.figure.length)) : null,
            journal.submit.length > 0 ? fold('交稿方式', bullets(journal.submit), String(journal.submit.length)) : null,
            journal.refs && journal.refs !== '—'
              ? fold('引用制式', h('div', { className: 'dapp-hint' }, journal.refs))
              : null,
            journal.redlines.length > 0
              ? fold('收录边界 / 红线', bullets(journal.redlines), String(journal.redlines.length))
              : null,
            journal.quotes.length > 0
              ? fold(
                  '官方原文',
                  h(
                    'div',
                    null,
                    journal.quotes.map((quote) => h('p', { key: quote, className: 'dapp-quote' }, quote)),
                  ),
                  String(journal.quotes.length),
                )
              : null,
            h(
              'button',
              {
                type: 'button',
                className: 'dapp-btn dapp-btn-primary dapp-btn-block',
                onClick: () => deliver('journal', journalPrompt()),
              },
              h(Icon, { name: 'copy', size: 13 }),
              feedback && feedback.token === 'journal'
                ? feedbackLabel(feedback.kind)
                : `插入「投 ${journal.name}」指令`,
            ),
          );
        } else if (view === 'matrix') {
          const dim = matrix.find((item) => item.id === dimId) || matrix[0];
          content = h(
            'div',
            { className: 'dapp-view' },
            h('div', { className: 'dapp-hint' }, '选一个维度，看 10 本刊在这一项上的差别；点任一行跳到该刊档案。'),
            h(
              'div',
              { className: 'dapp-dims' },
              matrix.map((item) =>
                h(
                  'button',
                  {
                    key: item.id,
                    type: 'button',
                    className: 'dapp-dim',
                    'data-on': item.id === dim.id ? 'true' : 'false',
                    onClick: () => setDimId(item.id),
                  },
                  item.label,
                ),
              ),
            ),
            h(
              'div',
              { className: 'dapp-compare' },
              JOURNALS.map((item) => {
                const value = dim.cell(item);
                return h(
                  'button',
                  {
                    key: item.id,
                    type: 'button',
                    className: 'dapp-compare-row',
                    onClick: () => {
                      setJournalId(item.id);
                      setView('journal');
                    },
                  },
                  h('span', { className: 'dapp-compare-name' }, item.name),
                  h(
                    'span',
                    { className: 'dapp-grow' },
                    h(
                      'span',
                      {
                        className: 'dapp-compare-value',
                        'data-tone': value.tone === 'plain' ? undefined : value.tone,
                      },
                      value.value,
                    ),
                    value.detail && value.detail !== value.value
                      ? h('span', { className: 'dapp-hint', style: { display: 'block', marginTop: '2px' } }, value.detail)
                      : null,
                  ),
                );
              }),
            ),
          );
        } else if (view === 'match') {
          const picked = genres.length > 0 || needTaxa || needDual;
          content = h(
            'div',
            { className: 'dapp-view' },
            h(
              'div',
              { className: 'dapp-card' },
              h('div', { className: 'dapp-label' }, '稿件体裁'),
              h(
                'div',
                { className: 'dapp-dims' },
                GENRES.map((genre) =>
                  h(
                    'button',
                    {
                      key: genre.id,
                      type: 'button',
                      className: 'dapp-dim',
                      'data-on': genres.includes(genre.id) ? 'true' : 'false',
                      onClick: () => toggleGenre(genre.id),
                    },
                    genre.label,
                  ),
                ),
              ),
              h(
                'div',
                { className: 'dapp-dims' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dapp-dim',
                    'data-on': needTaxa ? 'true' : 'false',
                    onClick: () => setNeedTaxa((value) => !value),
                  },
                  '含新分类单元',
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dapp-dim',
                    'data-on': needDual ? 'true' : 'false',
                    onClick: () => setNeedDual((value) => !value),
                  },
                  '需要双摘要',
                ),
              ),
              h(
                'div',
                { className: 'dapp-hint' },
                picked
                  ? '按各刊已归档的收录边界排序；分数只反映硬条款命中，不是主观印象。'
                  : '先选体裁或附加条件，排序才有意义。',
              ),
            ),
            h(
              'div',
              { className: 'dapp-compare' },
              ranked.map((entry) =>
                h(
                  'button',
                  {
                    key: entry.id,
                    type: 'button',
                    className: 'dapp-score',
                    style: { display: 'flex' },
                    onClick: () => {
                      setJournalId(entry.id);
                      setView('journal');
                    },
                  },
                  h('span', { className: 'dapp-score-num' }, picked ? String(entry.score) : '—'),
                  h(
                    'span',
                    { className: 'dapp-grow' },
                    h('span', { className: 'dapp-score-name', style: { display: 'block' } }, entry.name),
                    h(
                      'span',
                      { className: 'dapp-score-tags', style: { display: 'block' } },
                      entry.tags.join(' · '),
                    ),
                    entry.reasons.length > 0
                      ? h(
                          'span',
                          { className: 'dapp-score-tags', style: { display: 'block', marginTop: '3px' } },
                          entry.reasons.join('；'),
                        )
                      : null,
                    picked
                      ? h(
                          'span',
                          { className: 'dapp-score-bar', style: { display: 'block' } },
                          h('span', { style: { width: `${Math.min(100, entry.score)}%` } }),
                        )
                      : null,
                  ),
                ),
              ),
            ),
          );
        } else if (view === 'figure') {
          const field = (label, key, props) =>
            h(
              'div',
              { className: 'dapp-field' },
              h('span', null, label),
              h(
                'input',
                {
                  key,
                  type: 'number',
                  value: fig[key],
                  onChange: (event) => setFig({ ...fig, [key]: event.target.value }),
                  ...props,
                },
              ),
            );
          const okCount = figureReport.filter((rule) => rule.state === 'ok').length;
          const badCount = figureReport.filter((rule) => rule.state === 'bad').length;
          const noteCount = figureReport.filter((rule) => rule.state === 'note' || rule.state === 'warn').length;
          content = h(
            'div',
            { className: 'dapp-view' },
            h(
              'div',
              { className: 'dapp-card' },
              h(
                'div',
                { className: 'dapp-title-row' },
                h('span', { className: 'dapp-title-name', style: { fontSize: '13.5px' } }, journal.name),
                h('span', { className: 'dapp-title-full' }, '的图件硬参数'),
              ),
              field('照片 dpi', 'dpi', { min: '0', step: '50' }),
              field('宽度 mm', 'width', { min: '0' }),
              field('高度 mm', 'height', { min: '0' }),
              field('单图 MB', 'size', { min: '0', step: '0.5' }),
              h(
                'div',
                { className: 'dapp-badges' },
                h('span', { className: 'dapp-badge dapp-badge-ok' }, `达标 ${okCount}`),
                badCount > 0 ? h('span', { className: 'dapp-badge dapp-badge-bad' }, `超标 ${badCount}`) : null,
                noteCount > 0 ? h('span', { className: 'dapp-badge' }, `待人工 ${noteCount}`) : null,
              ),
            ),
            h(
              'div',
              { style: { display: 'grid', gap: '6px' } },
              figureReport.length > 0
                ? figureReport.map((rule) =>
                    h(
                      'div',
                      { key: rule.name, className: 'dapp-verdict', 'data-state': rule.state },
                      h('span', { className: 'dapp-verdict-dot' }),
                      h('span', { className: 'dapp-verdict-name' }, rule.name),
                      h(
                        'span',
                        { className: 'dapp-verdict-text' },
                        rule.text,
                        h('span', { className: 'dapp-verdict-note' }, rule.note),
                      ),
                    ),
                  )
                : h('div', { className: 'dapp-empty' }, '该刊档案里没有可自动检查的数值条款'),
            ),
          );
        } else if (view === 'color') {
          content = h(
            'div',
            { className: 'dapp-view', style: { display: 'grid', gap: '10px' } },
            h(
              'div',
              { className: 'dapp-search' },
              h(Icon, { name: 'search', size: 14 }),
              h('input', {
                type: 'text',
                value: paletteText,
                placeholder: '粘贴若干 HEX，例如 #D30203 #75489A #F6A100',
                onChange: (event) => setPaletteText(event.target.value),
              }),
            ),
            palette.entries.length > 0
              ? h(
                  'div',
                  { className: 'dapp-swatch-grid' },
                  palette.entries.map((entry) =>
                    h(
                      'div',
                      { key: entry.hex, className: 'dapp-swatch-card' },
                      h(
                        'div',
                        { className: 'dapp-swatch-strip' },
                        h('span', { style: { background: entry.hex } }),
                        h('span', { style: { background: entry.deutan } }),
                        h('span', { style: { background: entry.protan } }),
                        h('span', { style: { background: entry.tritan } }),
                      ),
                      h(
                        'div',
                        { className: 'dapp-swatch-meta' },
                        h('span', { className: 'dapp-hex' }, entry.hex),
                        h(
                          'span',
                          { className: 'dapp-role' },
                          `对比度 ${entry.onWhite.toFixed(1)}:1 / ${entry.onBlack.toFixed(1)}:1 · 灰度 ${entry.gray}`,
                        ),
                      ),
                    ),
                  ),
                )
              : h(
                  'div',
                  { className: 'dapp-empty' },
                  '输入 HEX 后，这里会给出对比度、灰度值与三种色觉障碍（deutan / protan / tritan）模拟。',
                ),
            palette.pairs.length > 0
              ? h(
                  'div',
                  { className: 'dapp-card' },
                  h('div', { className: 'dapp-label' }, '灰度可分辨性（两两配对）'),
                  h(
                    'div',
                    { style: { display: 'grid', gap: '5px' } },
                    palette.pairs.map((pair) =>
                      h(
                        'div',
                        { key: `${pair.a}-${pair.b}`, className: 'dapp-verdict', 'data-state': pair.ok ? 'ok' : 'bad' },
                        h('span', { className: 'dapp-verdict-dot' }),
                        h(
                          'span',
                          { className: 'dapp-verdict-name' },
                          `${pair.a} / ${pair.b}`,
                        ),
                        h(
                          'span',
                          { className: 'dapp-verdict-text' },
                          `灰度差 ${pair.delta}`,
                          h(
                            'span',
                            { className: 'dapp-verdict-note' },
                            pair.ok ? '灰度下仍可区分' : '灰度下几乎重合 —— 改用形状 / 纹理 / 标注区分',
                          ),
                        ),
                      ),
                    ),
                  ),
                )
              : null,
            h(
              'div',
              { className: 'dapp-card' },
              h('div', { className: 'dapp-label' }, '技能自带语义色字典'),
              h(
                'div',
                { className: 'dapp-chips' },
                COLORS.map((item) =>
                  h(
                    'button',
                    {
                      key: item.hex,
                      type: 'button',
                      className: 'dapp-chipbtn',
                      onClick: () => copyHex(item.hex, item.hex),
                    },
                    h('span', {
                      style: {
                        display: 'inline-block',
                        width: '10px',
                        height: '10px',
                        borderRadius: '3px',
                        background: item.hex,
                        marginRight: '5px',
                        verticalAlign: '-1px',
                      },
                    }),
                    `${item.hex} ${item.role}`,
                  ),
                ),
              ),
            ),
          );
        } else if (view === 'modules') {
          content = h(
            'div',
            { className: 'dapp-view', style: { display: 'grid', gap: '10px' } },
            h(
              'div',
              { className: 'dapp-search' },
              h(Icon, { name: 'search', size: 14 }),
              h('input', {
                ref: searchRef,
                type: 'text',
                value: query,
                placeholder: '搜模块与全部参考文件（按 / 聚焦）',
                onChange: (event) => setQuery(event.target.value),
              }),
            ),
            h(
              'div',
              { className: 'dapp-hint' },
              liveIndexState === 'live'
                ? remotePending && query.trim()
                  ? '🟢 实时索引：正在全文检索当前文件…'
                  : '🟢 实时索引：全文检索宿主路由读取的当前文件，不消耗任何 token。'
                : liveIndexState === 'unauthorized'
                  ? '🟠 宿主路由拒绝了本次请求（缺登录态），正在使用打包时的内置索引（仅标题级匹配）。'
                  : liveIndexState === 'failed'
                    ? '🟡 宿主路由不可达，正在使用打包时的内置索引（仅标题级匹配）。'
                    : null,
            ),
            query.trim()
              ? h(
                  'div',
                  { style: { display: 'grid', gap: '6px' } },
                  searchResults.length > 0
                    ? searchResults.map((entry) =>
                        h(
                          'button',
                          {
                            key: entry.path,
                            type: 'button',
                            className: 'dapp-file',
                            onClick: () =>
                              deliver(
                                entry.path,
                                `使用 academic-paper-polish 技能：读取 ${entry.path}，按其中的规则处理我的稿件。`,
                              ),
                          },
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
                                entry.keywords.map((word) =>
                                  h('span', { key: word, className: 'dapp-chip' }, word),
                                ),
                              )
                            : null,
                        ),
                      )
                    : h('div', { className: 'dapp-empty' }, `没有命中「${query.trim()}」`),
                )
              : h(
                  'div',
                  { className: 'dapp-mods' },
                  MODULES.map((item) =>
                    h(
                      'button',
                      {
                        key: item.no,
                        type: 'button',
                        className: 'dapp-mod',
                        title: item.hint,
                        'data-done': feedback && feedback.token === item.no ? 'true' : 'false',
                        onClick: () => deliver(item.no, modulePrompt(item)),
                      },
                      h(
                        'span',
                        { className: 'dapp-mod-icon' },
                        h(Icon, { name: MODULE_ICON[item.no] || 'mark', size: 15 }),
                      ),
                      h('span', { className: 'dapp-mod-name' }, item.name),
                      h('span', { className: 'dapp-mod-hint' }, item.hint),
                      h('span', { className: 'dapp-mod-no' }, item.no),
                      feedback && feedback.token === item.no
                        ? h('span', { className: 'dapp-mod-done' }, feedbackLabel(feedback.kind))
                        : null,
                    ),
                  ),
                ),
          );
        } else if (view === 'checklist') {
          content = h(
            'div',
            { className: 'dapp-view', style: { display: 'grid', gap: '10px' } },
            h(
              'div',
              { className: 'dapp-card' },
              h(
                'div',
                { className: 'dapp-check-head' },
                h('span', null, `${t('panel.progress')} ${done}/${total}`),
                h(
                  'span',
                  { className: 'dapp-track' },
                  h('span', {
                    className: 'dapp-fill',
                    style: { width: `${total === 0 ? 0 : Math.round((done / total) * 100)}%` },
                  }),
                ),
                h(
                  'button',
                  { type: 'button', className: 'dapp-btn dapp-btn-ghost', onClick: toggleAll },
                  allOpen ? '全部收起' : '全部展开',
                ),
                h(
                  'button',
                  { type: 'button', className: 'dapp-btn dapp-btn-ghost', onClick: reset },
                  t('panel.reset'),
                ),
              ),
            ),
            h(
              'div',
              { className: 'dapp-groups' },
              CHECKLIST.map((group) => {
                const groupDone = group.items.filter((_, index) => checked[`${group.id}.${index}`]).length;
                const open = Boolean(openGroups[group.id]);
                const pct = group.items.length === 0 ? 0 : Math.round((groupDone / group.items.length) * 100);
                return h(
                  'div',
                  { key: group.id, className: 'dapp-group', 'data-open': open ? 'true' : 'false' },
                  h(
                    'button',
                    { type: 'button', className: 'dapp-group-head', onClick: () => toggleGroup(group.id) },
                    h(Icon, { name: 'chevron', size: 13, className: 'dapp-chevron' }),
                    h('span', { className: 'dapp-group-key' }, group.id),
                    h('span', { className: 'dapp-group-name' }, group.name),
                    h('span', { className: 'dapp-group-count' }, `${groupDone}/${group.items.length}`),
                  ),
                  h(
                    'div',
                    { className: 'dapp-meter', style: { margin: '0 10px 8px' } },
                    h('span', {
                      style: {
                        width: `${pct}%`,
                        background: pct === 100 ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-brand-primary)',
                      },
                    }),
                  ),
                  open
                    ? h(
                        'div',
                        { className: 'dapp-items' },
                        group.items.map((text, index) => {
                          const key = `${group.id}.${index}`;
                          const on = Boolean(checked[key]);
                          return h(
                            'div',
                            {
                              key,
                              className: 'dapp-item',
                              'data-checked': on ? 'true' : 'false',
                              onClick: () => toggle(group.id, index),
                            },
                            h(
                              'span',
                              { className: 'dapp-box' },
                              h(Icon, { name: 'check', size: 11, strokeWidth: 2 }),
                            ),
                            h('span', { className: 'dapp-item-text' }, text),
                          );
                        }),
                      )
                    : null,
                );
              }),
            ),
          );
        } else {
          content = h(
            'div',
            { className: 'dapp-view', style: { display: 'grid', gap: '7px' } },
            RULES.map(([no, title, body]) =>
              h(
                'div',
                { key: no, className: 'dapp-rule' },
                h('span', { className: 'dapp-rule-no' }, no),
                h(
                  'div',
                  { className: 'dapp-grow' },
                  h('div', { className: 'dapp-rule-title' }, title),
                  h('div', { className: 'dapp-rule-body' }, body),
                ),
              ),
            ),
          );
        }

        return h('div', null, tabBar, h('div', { className: 'dapp-scroll' }, content));
      }

      return h(
        'div',
        {
          className: 'dapp',
          style: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 },
        },
        h('style', { dangerouslySetInnerHTML: { __html: CSS } }),
        head,
        expanded ? renderBody() : null,
      );
    }

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
