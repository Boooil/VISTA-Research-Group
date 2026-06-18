# cite.bib 输入 + Cite 复制到剪贴板

> 状态:CMS 输入(粘贴/导入)+ 边缘渲染版 Cite 复制 + cite.bib 构建生成 已实现 | 2026-06-18
> 第二步(Hugo 静态页 Cite 改复制)待后续

## 背景

publication 详情页 Cite 按钮。需求:① CMS 能添加 bib(粘贴文本 **或** 导入 .bib 文件);② Cite 按钮点击复制 BibTeX 到剪贴板(原为新标签打开文件)。

## 最终方案:bib 存 frontmatter `cite` 字段(单一数据源)

最初尝试"上传 cite.bib 文件",但用户要的是"粘贴文本 + 导入文件二合一"。改为:**bib 内容统一存进 frontmatter `cite` 字段**,cite.bib 文件由 Hugo 构建生成。

**保真已验证**:真实 cite.bib(含 `{}`/`@`/URL/长 abstract)存进 frontmatter 块标量 `|` → 解析器读回完全一致。

### 实现
1. **CMS 自定义 widget**(`static/admin/bibtex-widget.js`,`index.html` 引入):textarea 粘贴框 + "导入 .bib 文件"按钮(`FileReader` 读文件内容填进框)。两种输入都存 frontmatter `cite`。config.yml publication 的 `cite` 字段 `widget: bibtex`。
2. **边缘渲染版 Cite 复制**(`functions/_lib/renderer.js` + edge 同源):bib 来源 `frontmatter.cite`;有则 `citeCopyButton` 渲染自包含复制组件(bib 内联 `<script type="text/bibtex">`,onclick `navigator.clipboard.writeText` + "已复制 ✓"),无则不显示。无 fetch、无 404。bib 内联仅转义 `</script>`。
3. **Hugo 生成 cite.bib**(供静态页下载 + 兼容旧链接):
   - `config/_default/hugo.yaml`:加 `BIBTEX` outputFormat(mediaType `application/x-bibtex`,baseName `cite`,suffix `bib`)。
   - `content/publication/_index.md` 的 `cascade.outputs: [HTML, BIBTEX]`——**注意:site-config 的 cascade.outputs 对叶子页不可靠(实测不生成),必须放在 section `_index.md` 的 cascade 里才生效**。
   - `layouts/publication/single.bib` + `list.bib`:输出 `.Params.cite`(list.bib 因 cascade 含 section 自身而需要,section 无 cite 输出空,消除"no layout for bibtex"警告)。
4. **迁移现有 7 篇**:各自 cite.bib 内容读进 frontmatter `cite: |`,删除独立 cite.bib(改由构建生成)。注意 patent2 是 CRLF 换行,迁移时统一转 LF。

## 为什么这样设计
- **单一数据源(frontmatter)**:渲染器/Hugo 都只认 `frontmatter.cite`,无双源分支;粘贴/导入统一为填同一个 textarea。
- **上传 vs 粘贴**:导入 .bib 用 FileReader 读内容填框,本质仍是文本入 frontmatter,不碰 Decap 文件名/路径限制。
- **cite.bib 仍由构建生成**:静态页(主题 page_links_div)的 Cite 链接仍指向该文件,需保留;URL 不变。

## 现状与第二步
- ✅ CMS 粘贴/导入、边缘版 Cite 复制、cite.bib 构建生成,均已实现并测试。
- ✅ **第二步(已完成)**:Hugo 静态页 Cite 也改为复制。关键发现:HugoBlox 主题**原生支持** cite 复制(`page_links.html` 对 bibtex 渲染 `.js-cite-clipboard` 按钮 + `hb-citation.js` 点击 fetch data-filename 复制,JS 无条件打包)。但主题靠 `.Resources.GetMatch "cite.bib"` 检测**资源文件**,而本方案 cite.bib 是 BIBTEX output(非 resource)→ 主题检测不到。解决:补主题同款 `.js-cite-clipboard` 按钮(`data-filename` 指向生成的 cite.bib URL),复用主题 JS,不覆盖 build_links(避免影响 PDF/DOI)。
- **详情页 + 列表页都要补**(主题检测失效同时影响两处):
  - 详情页:`layouts/publication/single.html` 调共享 partial。
  - 列表页:覆盖 citation 视图 `layouts/partials/views/citation.html`,补按钮;**独立于 `has_attachments`**(否则只有 cite、无 PDF/DOI 的论文整个链接区被跳过)。
  - 共享按钮 partial:`layouts/partials/views/citation--cite-button.html`(单一来源,两处复用,行为一致)。
- 边缘版与静态版(详情页 + 列表页)Cite 行为全部一致:点击复制。

## 验证
- bib 保真:解析器离线验证 + 构建生成的 7 篇 cite.bib 与原文内容一致(仅末尾换行差异,无实质)。
- 边缘版:`cite-copy-test`(frontmatter 源:内联/无 cite 不显示/`</script>` 转义)通过;全套 8 测试通过。
- CMS(部署 + 硬刷 /admin/):粘贴 bib / 导入 .bib → textarea 填入 → 保存 → frontmatter `cite` 正确 → 详情页 Cite 点击复制。

