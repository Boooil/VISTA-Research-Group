# cite.bib 上传 + Cite 复制到剪贴板

> 状态:第一步(CMS 上传 + 边缘渲染版 Cite 复制)已实现 | 2026-06-17
> 第二步(Hugo 静态页 Cite 复制)待后续

## 背景

publication 详情页有 Cite 按钮。原行为:`<a href="/publication/<slug>/cite.bib" target=_blank>` —— 新标签打开 bib 文件。cite.bib 此前需本地手动创建并 push。

两个需求:
1. CMS 新建 publication 时能上传 cite.bib。
2. Cite 按钮改为"点击复制 BibTeX 到剪贴板"(学术站习惯,便于粘进文献管理器)。

## 方案要点

### 1. CMS 上传 cite.bib(`static/admin/config.yml`)
publication 加 `cite_file` file 字段,**字段级** `media_folder: ""` / `public_folder: ""`:
- 上传的 `cite.bib` 落进 `content/publication/<slug>/cite.bib`(page bundle 内),保留原名。
- 字段级隔离:不影响封面图(仍走全局 `static/uploads`)。
- 约定:用户须先填 slug 再上传,且文件名为 `cite.bib`(Decap 不强制改名,靠 hint + 约定)。

### 2. 边缘渲染版 Cite 复制(`functions/_lib/renderer.js` + edge-renderer 同源)
- `renderPublication` 顺带 `fetchMarkdown(content/publication/<folder>/cite.bib)` 取 bib 文本。
- 有 bib → `renderLinksHTML` 调 `citeCopyButton(bib)`:渲染自包含组件——bib 原文内联进 `<script type="text/bibtex" class="hb-cite-data">`,按钮 `onclick` 读取该元素文本并 `navigator.clipboard.writeText`,带"已复制 ✓"反馈。无 bib → 不显示 Cite。
- **无 fetch、无 404**:bib 已内联在页面;新文章秒级窗口期也能复制(cite.bib 已 push,边缘 fetch 秒级拿到)。
- bib 内联防破坏:用 `<script type="text/bibtex">`(不执行、不需转义正文),仅把 `</script>` 转义为 `<\/script>`。

## 为什么这样设计

- **上传文件而非粘贴文本**:bib 含 `{}`、换行,粘贴进 frontmatter 经 YAML 转义易损;上传保留原始字节。
- **约定文件名 cite.bib**:化解 Decap "file widget 保留原名、无法强制重命名"的限制 —— 既然约定上传名为 cite.bib,保留原名正中下怀,渲染器硬编码链接命中。
- **内联复制而非 fetch**:避免新文章构建前 fetch cite.bib 404;且复制比"打开文件"更符合引用习惯。
- **不存 frontmatter 由构建生成**:保持 cite.bib 仍是独立文件(Hugo/Pages 链路无侵入,现有 7 篇不动)。

## 现状与待办

- ✅ CMS 上传、边缘渲染版 Cite 复制已实现并测试(`edge-renderer/test/cite-copy-test.js`)。
- ⬜ **第二步**:Hugo 静态页 Cite 仍是主题 `page_links_div.html` 的"打开文件"行为。改复制需先实测主题是否自动出 Cite 链接,再定覆盖/抑制策略(避免影响 PDF/DOI 等其他链接)。在此之前,静态页(构建完成后)与边缘版行为暂不一致。

## 验证
- CMS(部署 + 硬刷 /admin/):新建 publication → 先填 slug → 上传 cite.bib → 保存 → GitHub `content/publication/<slug>/cite.bib` 就位。
- 边缘版:新文章详情页点 Cite → 复制成功(`cite-copy-test.js` 覆盖:内联/无 bib 不显示/转义)。
- 现有 7 篇 cite.bib、Hugo、Pages 链路不受影响。
