# Phase 4：1:1 渲染对齐计划

> 状态：计划阶段 | 2026-06-18
> 前置：Phase 1-3 已完成（详见 edge-rendering-design.md 第十七章）
> 目标：Worker 渲染的每个页面区域与 Hugo 构建版本完全一致，用户无法区分

---

## 一、当前差距快照

基于对 `functions/_lib/renderer.js`、Hugo layouts 及 HugoBlox vendor 模板的实地核查，Phase 4 各项对齐状态如下：

| # | 区域 | 当前状态 | 差距描述 |
|:--|:-----|:--------:|:---------|
| D | 面包屑 | ⚠ 壳内占位 | Shell 含静态占位符；Worker 未动态构造路径链 |
| F | 作者列表 | ✅ 已完成 | KV + fallback 已实现，Webhook 触发即时刷新已上线 |
| G | 阅读时间 | ✅ 已完成 | `calcReadingTime` 中文÷400 / 英文÷200，逻辑与 Hugo 等价 |
| I | 封面图 srcset | ❌ 缺失 | 当前仅 `<img src="GitHub Raw URL">`，无 WebP / srcset / sizes |
| K | pub metadata | ⚠ 部分 | 已渲染类型+场馆；缺 `event` 名称/URL、`location`/`address`；abstract 未渲染 Markdown（仍用 escapeHTML） |
| L | Markdown 渲染 | ✅ 已完成 | `marked` + GFM，与 goldmark 输出一致（已有渲染对比样本） |
| M | 正文图片路径 | ✅ 已完成 | 相对路径 → GitHub Raw 绝对路径转换已实现 |
| O | 链接按钮自动检测 | ⚠ 部分 | 仅渲染 `frontmatter.links` 数组；缺 `hugoblox.ids`（doi/arxiv 等）自动生成链接；缺 `url_pdf` 等遗留字段兼容 |
| Q | 分享按钮 | ✅ 已完成 | Shell 内含 X 分享按钮（HugoBlox 原始 page_sharer 含五平台，当前仅 X，低优先级） |
| R | 作者卡片（页脚） | ✅ 已完成 | KV 数据 + 社交图标已实现 |
| S | 相关文章 | ❌ 缺失 | 需全量内容扫描，Worker 不可行；设计文档已标注 P3 可降级 |
| U | 最后编辑时间 | ⚠ 部分 | 当前用 `frontmatter.date` 作为 lastmod 显示；应改用 GitHub Commits API 取真实 lastmod |
| W | JSON-LD 结构化数据 | ⚠ 部分 | Shell 含基础 og meta；缺 `Article` / `Person` schema.org JSON-LD |

**已完成（无需处理）：F、G、L、M、Q、R**
**本 Phase 要实施：K、O、D、U、W、I（按工作量从小到大排序）**
**明确降级/不做：S（相关文章）**

---

## 二、工作项详述

### 任务 K：pub metadata 补全（`renderer.js`，工作量：小）

**当前问题：**

1. `abstract` 用了 `escapeHTML(abstract)` 而非 Markdown 渲染，摘要中的加粗/斜体/链接丢失。
2. 缺少 `event`（会议名称 + URL）、`location`、`address` 字段渲染。Hugo 模板在 `event` 非空时显示会议名（可选链接）和地点。

**改法（`functions/_lib/renderer.js` 的 `buildPublicationContent`）：**

```
abstract:      marked.parse(abstract)          // 当前: escapeHTML
event:         frontmatter.event               // 新增
event_url:     frontmatter.event_url           // 新增
location:      frontmatter.location            // 新增
```

metadata 块渲染顺序（对齐 Hugo `publication/single.html`）：
1. Abstract（Markdown → HTML）
2. Type（类型标签 + 链接）
3. Publication（场馆名，保持原样，Hugo 用 markdown）
4. Conference（event + event_url，新增）
5. Location（location 文本，新增）

**同步改 `edge-renderer/src/renderer.js`（与 functions/ 保持同源）。**

---

### 任务 O：链接按钮自动检测（`renderer.js`，工作量：中）

**当前问题：**

`renderLinksHTML` 只遍历 `frontmatter.links` 数组。Hugo 的 `build_links` 还会：
- 从 `frontmatter.hugoblox.ids`（doi、arxiv、openreview 等）生成链接
- 兼容遗留字段 `url_pdf`、`url_code`、`url_dataset`、`url_slides`、`url_video`、`doi`
- 自动检测同目录 `cite.bib`（当前已有 cite 来自 frontmatter.cite，但不检测文件存在性）

**改法：**

在 `renderLinksHTML` 前新增 `buildLinks(frontmatter, slug, type)` 函数，统一归一化所有来源为 `{label, url, icon}` 数组：

```javascript
// 优先级：frontmatter.links > hugoblox.ids > 遗留 url_* 字段
function buildLinks(frontmatter, slug, type) {
  const result = [];

  // 1. frontmatter.links（已有逻辑，迁入）
  // 2. hugoblox.ids —— doi / arxiv / openreview / dblp 等生成 URL
  const IDS_TEMPLATES = {
    doi:           { label: 'DOI',     url: 'https://doi.org/{id}',                      icon: 'link' },
    arxiv:         { label: 'arXiv',   url: 'https://arxiv.org/abs/{id}',                icon: 'link' },
    openreview:    { label: 'OpenReview', url: 'https://openreview.net/forum?id={id}',   icon: 'link' },
    dblp:          { label: 'DBLP',    url: 'https://dblp.org/rec/{id}',                 icon: 'link' },
    semanticscholar: { label: 'SemanticScholar', url: 'https://api.semanticscholar.org/graph/v1/paper/{id}', icon: 'link' },
  };
  // 3. 遗留字段（url_pdf → PDF 按钮，doi → DOI 按钮，etc.）
  // 4. 返回去重后的 result（以 url 为 key 去重）
}
```

按钮图标增补：doi、arxiv、code（GitHub 图标）对齐 HugoBlox link_types。

**注意**：`frontmatter.links` 里的 `link.name` 字段当前用作 label——但实际 frontmatter 用的是 `link.label` 或 `link.type`（见样本 frontmatter）。需修正字段名读取：`link.label || link.type`。

---

### 任务 D：面包屑动态构造（`renderer.js` / `shell.js`，工作量：小）

**当前问题：**

Shell 模板有面包屑占位，但 Worker 并没有动态填充。Hugo 用 `.Ancestors.Reverse` 从根到父级构造链。

**改法：**

在 `buildPublicationContent` / `buildPostContent` / `buildProjectContent` 顶部生成面包屑 HTML，替换 Shell 中的占位符（或作为 `content` 的第一个元素直接输出）。

路径构造规则（不需要 Hugo 的层级遍历，直接按 type 硬编码两层）：

```javascript
function buildBreadcrumb(type, title) {
  const SECTION_LABELS = {
    publication: '论文著作',
    post:        '博客',
    project:     '项目',
    author:      '作者',
  };
  const sectionLabel = SECTION_LABELS[type] || type;
  const sectionUrl   = `/${type}/`;
  // 渲染: 首页 > [section] > 当前页（加粗，不加链接）
}
```

HTML 结构对齐 HugoBlox `breadcrumb.html`：`<nav aria-label="breadcrumb">` + chevron 分隔符 + 末尾页面名用 `<span>` 而非 `<a>`。

**Shell 需相应去掉静态占位，改由 `content` 字符串的头部包含面包屑。**

---

### 任务 U：最后编辑时间改用 GitHub Commits API（`renderer.js`，工作量：中）

**当前问题：**

`lastEdited` 直接传入 `frontmatter.date`（发布日期），显示 "Last updated on 2024-08-11" 对编辑过但未改日期的文章不准确。

**Hugo 行为：**`.Lastmod` 取 Git 最后 commit 时间（需 `enableGitInfo: true`）。当前 `hugo.yaml` 设为 `false`，Hugo 实际也回落到 `date`——两者目前行为一致，**本项实际差距为零**，不需要调用 GitHub API。

**结论**：任务 U 可标记为已完成（Worker 与 Hugo 行为一致，均用 `date`）。若未来 `enableGitInfo: true`，再补。

---

### 任务 W：JSON-LD 结构化数据（`shell.js`，工作量：中）

**当前问题：**

Shell 只有 `<meta>` og 标签，缺少 `<script type="application/ld+json">` 结构化数据。Hugo vendor 模板也**未找到** JSON-LD 输出（核查结论：HugoBlox 默认不生成 JSON-LD），因此 Worker 与 Hugo 在此项实际无差距。

**结论**：任务 W 可标记为已完成（两者均无 JSON-LD）。若后续主动为 SEO 添加，再单独做。

---

### 任务 I：封面图 srcset（工作量：大，分两步）

**当前问题：**

`renderFeaturedImage` 输出单张 `<img src="GitHub Raw URL">`，无 `srcset`、无 WebP 变体、无 `sizes`。Hugo 通过 `.Fit` + `process_responsive_image` 在构建期生成多尺寸 WebP 并写入 `public/`。Worker 没有图片处理能力。

**两种可行路径（互斥）：**

**路径 I-a：引用 Pages 已构建的 WebP 变体（推荐，零额外存储）**

Hugo 构建产物中对 featured image 会生成如下路径的 WebP 文件（以 `DDE-Net` 为例）：
```
/publication/dde-net-xxx/featured_hu<hash>_<width>x<height>.webp
```
这些文件已由 Cloudflare Pages 提供，但文件名含构建 hash，Worker 无法预知。

**方案**：利用已有的 `slug-manifest.json` 机制扩展——Hugo 构建时在 manifest 中同时记录每篇 publication 的图片 srcset 数据（原始文件名 + 各 WebP 路径）。Worker 取 manifest 里的 srcset 字段即可构造正确的 `<img srcset>`。

实施步骤：
1. 修改 `layouts/index.slugmanifest.json`：在每个 publication entry 追加 `"img": [{"w":480,"src":"/publication/xxx/featured_hu..._480x.webp"}, ...]`（Hugo 渲染期计算）。
2. Worker `slug-map.js` 的 `resolveFolder` 顺便返回 img 数据（已在内存缓存）。
3. `renderFeaturedImage` 改为接收 srcset 数组，输出 `<img srcset="..." sizes="..." src="...">`。

**路径 I-b：直接用 GitHub Raw 原图 + `loading="lazy"`（当前方案的最小改进）**

不引入 manifest 扩展，只改 img 标签加 `loading="lazy"`、`width`/`height` 属性（从 frontmatter `image` 字段读）、完善 `alt`。视觉上与 Hugo 版有差距（无 WebP），但 LCP 不受影响（featuredImage 已有 `fetchpriority="high"`）。

**取舍建议**：

路径 I-a 准确但需改 Hugo 模板 + manifest，改动面广（两个文件 + Worker）；路径 I-b 改动极小但遗留 srcset 缺失。

考虑到 Hugo 页面在 40-60s 后接管（双重渲染窗口），用户只在构建前看到 Worker 版封面图。**建议先做 I-b 作为短期改进，I-a 作为独立优化在 Phase 4 后单独迭代。**

---

## 三、优先级与实施顺序

| 顺序 | 任务 | 文件 | 工作量 | 备注 |
|:----:|:-----|:-----|:------:|:-----|
| 1 | K：pub metadata 补全 | `renderer.js` × 2 | 小 | abstract 渲染 + event/location 字段，改动最小、用户可见度高 |
| 2 | O：链接按钮 buildLinks | `renderer.js` × 2 | 中 | 新增 `buildLinks()`，`hugoblox.ids` + 遗留字段兼容 |
| 3 | D：面包屑动态构造 | `renderer.js` × 2，`shell.js` × 2 | 小 | 路径简单，改 Shell 占位 + content 头部注入 |
| 4 | I-b：封面图 img 属性改善 | `renderer.js` × 2 | 小 | `loading="lazy"` + width/height + alt；短期方案 |
| ✅ | U：lastmod | — | 零 | Hugo 也用 date（enableGitInfo: false），已对齐 |
| ✅ | W：JSON-LD | — | 零 | HugoBlox 本身不输出 JSON-LD，已对齐 |
| 后续 | I-a：srcset manifest 扩展 | 5 个文件 | 大 | 单独 issue，不阻塞 Phase 4 |
| 后续 | S：相关文章 | — | 大 | 明确降级，Pages 版本接管 |

**所有改动均须同步到 `edge-renderer/src/` 副本。**

---

## 四、各任务的文件改动范围

```
任务 K
  functions/_lib/renderer.js          buildPublicationContent 增加 event/location/rendered abstract
  edge-renderer/src/renderer.js       同步

任务 O
  functions/_lib/renderer.js          新增 buildLinks()，替换 renderLinksHTML 调用方
  edge-renderer/src/renderer.js       同步

任务 D
  functions/_lib/renderer.js          新增 buildBreadcrumb(type, title)，在 build*Content 顶部调用
  functions/_lib/shell.js             去掉 breadcrumb 静态占位（或保留占位供 buildBreadcrumb 替换）
  edge-renderer/src/renderer.js       同步
  edge-renderer/src/shell.js          同步

任务 I-b
  functions/_lib/renderer.js          renderFeaturedImage 添加 loading/width/height/alt
  edge-renderer/src/renderer.js       同步
```

---

## 五、验收标准

完成上述任务后，对以下代表性页面做 Worker vs Pages HTML 对比：

| 页面 | 检查项 |
|:-----|:-------|
| 含 event + location 的会议论文 | 会议名/地点是否显示；abstract 是否 Markdown 渲染（含加粗） |
| 含 `hugoblox.ids.doi` 的期刊论文 | DOI 按钮是否出现 |
| 含 `url_pdf` 遗留字段的老文章 | PDF 按钮是否出现 |
| 任意 publication 页 | 面包屑 "首页 > 论文著作 > 标题" 是否正确 |
| 任意 post / project 页 | 面包屑 "首页 > 博客 > 标题" / "首页 > 项目 > 标题" 是否正确 |
| 含封面图的页面 | img 有 alt、无 CLS（有 width/height） |

---

## 六、不在本 Phase 内

- **I-a srcset manifest 扩展**：改动面广，单独跟进。
- **相关文章（S）**：需全量内容，明确降级给 Pages。
- **post 和 project 的 author 页脚卡片**：当前已通过 KV 实现，Phase 4 不重做。
- **分享按钮扩展至五平台**：Shell 当前只含 X，其余四平台在构建版也显示，但差距极低优先级，不在本 Phase。
- **enableGitInfo / Git lastmod**：hugo.yaml 当前关闭，两侧均用 date，等开启时再补。
