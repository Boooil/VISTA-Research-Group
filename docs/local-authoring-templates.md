# 本地新建文章模板与规则

> 适用于：在本地创建文件夹、写好 Markdown 后直接 `git push`（适合带图片/公式的长文，比 CMS 后台更顺手）。
> push 后约 40-60 秒（Hugo 构建）网站可见；frontmatter 正确的话，CMS 后台也能抓取并继续编辑。

## 文件位置与命名

| 类型 | 路径 | 文件名 |
|:--|:--|:--|
| 论文著作 publication | `content/publication/<文件夹名>/` | `index.md` |
| 成果动态 post | `content/post/<文件夹名>/` | `index.md` |
| 科研项目 project | `content/project/<文件夹名>/` | `index.md` |
| 团队成员 author | `content/authors/<拼音>/` | `_index.md` ⚠️ 下划线开头 |

- 图片放**同目录**：`content/publication/<文件夹名>/featured.jpg`、插图同理。
- 文件夹名可随意，**建议直接用 slug**（如 `content/publication/trvp/`）。URL 只看 frontmatter 的 `slug` 字段，与文件夹名无关。

## 三条硬规则（不遵守会出问题）

1. **`slug` 必填且全站唯一**：小写字母/数字/连字符（`^[a-z0-9][a-z0-9-]*$`）。
   - 省略 → Hugo 回退用 title 生成 URL，中文标题会出怪 URL；两篇同 title 还会撞车互相覆盖。
2. **`content_type` 必填且正确**：`publication`/`post`/`project`/`author` 之一。
   - CMS 后台靠它过滤抓取，**缺了或写错，后台列表看不到这篇**。
3. **`date` 带时分秒，确保列表排序确定**：推荐格式 `2026-06-22T20:00:00+08:00`。
   - 纯日期（`2026-06-22`）等同于当天 00:00，同一天多篇文章时顺序不确定，容易排到后面。
   - 一天只发一篇时，纯日期也可以，无歧义。
   - 时区写 `+08:00`（北京时间），与 CMS 后台一致；`buildFuture: true` 继续兜底未来日期。

> `authors` 列表里写团队成员的**拼音**（如 `WangBoyu`）会自动显示中文名 + 头像 + 链接；外部作者直接写名字。

---

## 模板

### publication（论文著作）

```markdown
---
title: "论文标题"
slug: my-paper
content_type: publication
authors:
  - WangBoyu          # 团队成员用拼音，自动转中文名
  - Jane Doe          # 外部作者直接写名字
date: 2026-06-17T20:00:00+08:00
  - article-journal   # paper-conference/article-journal/patent/software/report/standard/book/thesis
publication: "电子学报"   # 发表期刊/会议，可选
abstract: "论文摘要……"
tags:
  - 3D Reconstruction
featured: false
links:                # 可选，外部链接按钮
  - name: PDF
    url: "https://example.com/paper.pdf"
image:                # 可选，封面图（放同目录）
  filename: featured.jpg
  caption: "图注"
cite: |               # 可选，BibTeX 引用（详情页 Cite 按钮点击复制；Hugo 构建据此生成 cite.bib）
  @article{key2026,
    title={...},
    author={...},
    year={2026}
  }
---

正文 Markdown。可用图片和公式：

![结果对比](./media/result.png)

行内公式 $E=mc^2$，块级公式：

$$
\mathcal{L} = \|x - \hat{x}\|^2 + \mathrm{KL}(q\|p)
$$
```

### post（成果动态）

```markdown
---
title: "动态标题"
slug: my-update
content_type: post
date: 2026-06-17T20:00:00+08:00
authors:
  - WangBoyu
summary: "列表页显示的简短摘要（1-3 句）"
tags: []
categories:
  - News
featured: false
image:                # 可选
  filename: cover.jpg
  caption: ""
---

正文 Markdown。
```

> 注：post 与 publication/project 一致——文件夹名 = slug = URL（如 `/post/my-update/`，不带日期前缀）。日期信息在 frontmatter `date:` 字段里，用于排序/显示。本地建文件夹名直接用 slug 即可。

### project（科研项目）

```markdown
---
title: "项目名称"
slug: my-project
content_type: project
subtitle: "副标题"      # 可选
date: 2026-06-17T20:00:00+08:00
summary: "项目摘要"
tags: []
categories: []
featured: false
links:                  # 可选
  - icon: github
    icon_pack: fab
    name: Code
    url: "https://github.com/..."
image:
  filename: featured.jpg
  caption: ""
---

项目正文 Markdown。
```

### author（团队成员）

文件：`content/authors/<拼音>/_index.md`（**不是** index.md）

```markdown
---
title: "中文姓名"
content_type: author
pinyin: "PinyinName"      # 首字母大写拼音，如 WangBoyu，作文件夹名与排序
role: "在读博士"           # 公开展示的身份/职称，可填写任意合适文本
avatar_filename: avatar.jpg   # 头像放同目录，正方形，可选
bio: "一句话简介"
interests:
  - 研究方向 1
  - 研究方向 2
social:
  - icon: envelope        # Font Awesome 图标名
    icon_pack: fas        # fas/fab/far/ai
    link: "mailto:you@example.com"
  - icon: github
    icon_pack: fab
    link: "https://github.com/yourname"
organizations:
  - name: VISTA Research Group
    url: ""
email: "you@example.com"
user_groups:              # 首页和团队列表的展示分组，可多选；不要求与 role 相同
  - 在读博士
---

可选的个人详细介绍 Markdown。
```

---

## 图片、文件与链接

- **图片**：`![alt](featured.jpg)` 或 `![alt](./media/x.png)`，相对路径。边缘渲染器会自动转成 GitHub Raw 绝对路径。
- **公式**：`$...$`（行内）、`$$...$$`（块级），前端 KaTeX/MathJax 渲染，原样写即可。
- **可下载文件**：把文件放同目录，用 HTML `<a>` 标签，**不要用 Markdown 链接语法**：

  ```html
  <a href="./script.user.js" download="script.user.js">下载代码</a>
  ```

  > ⚠️ `[下载](./file.user.js)` 这种写法会让浏览器**导航**到该 URL：`.user.js` 文件会被 Tampermonkey 扩展拦截并重定向到其安装页；`.sh`、`.bat` 等可执行类型也可能被浏览器拦截或直接运行。`download` 属性让浏览器直接触发保存对话框而不导航，规避所有此类拦截。

- **外部链接**：普通 Markdown 语法 `[文字](https://...)` 即可，不受上述限制。

## 与 CMS 后台的关系

- 本地 push 的文章，只要 `content_type` 正确，CMS 后台列表能抓取、能继续编辑。
- ⚠️ 若 frontmatter 里有 config 未定义的自定义字段，用 CMS 编辑保存时**可能丢弃**这些未知字段。想之后用 CMS 改的话，字段尽量对齐本模板。
- 本地 push 走整站 Hugo 构建（40-60s 后可见），不经过 CMS 的即时渲染 webhook —— 但新建本就走构建，无影响。

## 参考现有内容
- publication：`content/publication/TRVP/index.md`
- post：`content/post/Aizex-nav/index.md`（含文件下载示例）
- author：`content/authors/WangBoyu/_index.md`
