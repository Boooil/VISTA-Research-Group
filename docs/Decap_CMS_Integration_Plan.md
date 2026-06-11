# Decap CMS 集成实施方案

> **状态**：Plan · 待评审  
> **日期**：2026-06-11  
> **目标**：为 VISTA 研究组网站配置完整的可视化后台编辑系统，方便非技术人员维护网站内容。

---

## 目录

- [1. 背景与目标](#1-背景与目标)
- [2. Decap CMS 架构概述](#2-decap-cms-架构概述)
- [3. 当前网站内容模型分析](#3-当前网站内容模型分析)
- [4. 实施步骤](#4-实施步骤)
  - [Phase 1: 基础设施搭建](#phase-1-基础设施搭建)
  - [Phase 2: 集合 (Collections) 配置](#phase-2-集合-collections-配置)
  - [Phase 3: 认证与权限](#phase-3-认证与权限)
  - [Phase 4: 预览模板](#phase-4-预览模板)
  - [Phase 5: 编辑工作流 (可选)](#phase-5-编辑工作流-可选)
  - [Phase 6: 测试与文档](#phase-6-测试与文档)
- [5. 风险与注意事项](#5-风险与注意事项)
- [6. 备选方案对比](#6-备选方案对比)
- [7. 后续扩展可能性](#7-后续扩展可能性)

---

## 1. 背景与目标

### 1.1 现状

VISTA 研究组网站基于 **Hugo** + **HugoBlox Academic** 构建，部署在 **Netlify**。所有内容通过 `content/` 目录下的 Markdown 文件维护：

| 内容类型 | 目录 | 数量 | 复杂度 |
|----------|------|------|--------|
| 首页 | `content/_index.md` | 1 | ⭐⭐⭐ (多 Block 组装) |
| 成果动态 (Post) | `content/post/` | 3 | ⭐⭐ |
| 科研项目 (Project) | `content/project/` | 0 (模板就绪) | ⭐⭐ |
| 论文著作 (Publication) | `content/publication/` | 5+ | ⭐⭐⭐ (引用信息多) |
| 团队成员 (Author) | `content/authors/` | 5 | ⭐⭐ (社交链接等) |
| 研究方向 | `content/research/_index.md` | 1 | ⭐ |
| 资源下载 | `content/resources/_index.md` | 1 | ⭐ |
| 关于我们 | `content/about/_index.md` | 1 | ⭐ |

当前维护方式：直接用代码编辑器编辑 Markdown + YAML front matter，对非技术人员有一定门槛。

### 1.2 目标

- **可视化编辑** — 通过 Web UI 编辑所有内容，无需接触代码
- **表单化录入** — 每种内容类型有对应的表单，字段有提示和校验
- **媒体管理** — 支持图片上传、预览、拖拽排序
- **版本控制** — 每次修改自动生成 Git commit，可追溯、可回滚
- **非技术人员友好** — 团队成员无需了解 Markdown / YAML / Git 即可维护内容

---

## 2. Decap CMS 架构概述

### 2.1 工作原理

```
┌──────────────────────────────────────────────────┐
│                   Content Editor                  │
│  (Browser: https://vista-website.com/admin/)     │
└──────────────────┬───────────────────────────────┘
                   │ SPA (React)
                   ▼
┌──────────────────────────────────────────────────┐
│              Decap CMS (JS App)                   │
│  - config.yml 定义内容模型                         │
│  - 表单渲染 + Markdown 编辑器                      │
│  - 预览面板                                       │
└──────────────────┬───────────────────────────────┘
                   │ Git Gateway API
                   ▼
┌──────────────────────────────────────────────────┐
│            Netlify Identity + Git Gateway          │
│  - 用户认证 (Invite / OAuth)                       │
│  - 将编辑操作转为 Git commit                        │
└──────────────────┬───────────────────────────────┘
                   │ commit & push
                   ▼
┌──────────────────────────────────────────────────┐
│              Git Repository (GitHub)               │
│  content/ 目录下的 Markdown 文件被更新              │
└──────────────────┬───────────────────────────────┘
                   │ webhook
                   ▼
┌──────────────────────────────────────────────────┐
│              Netlify Build & Deploy                │
│  hugo --minify → 生成静态站点 → CDN 分发            │
└──────────────────────────────────────────────────┘
```

### 2.2 关键组件

| 组件 | 说明 | 存放位置 |
|------|------|----------|
| `admin/index.html` | CMS 入口 HTML，加载 Decap CMS JS | `static/admin/index.html` |
| `admin/config.yml` | 内容模型定义 (Collections, Fields, Widgets) | `static/admin/config.yml` |
| Netlify Identity | 用户认证服务 | Netlify Dashboard 配置 |
| Git Gateway | 将 CMS 操作转为 Git API 调用 | Netlify Dashboard 启用 |

### 2.3 认证流程

```
编辑者 → 访问 /admin/ → Decap CMS 加载
  → 点击 "Login with Netlify Identity"
  → Netlify Identity 弹窗 (支持邮箱邀请 / GitHub OAuth)
  → 认证成功 → 获取 Git Gateway token
  → CMS 通过 Git Gateway API 读写 Git 仓库
```

---

## 3. 当前网站内容模型分析

### 3.1 内容组织结构

每个内容项都是一个**目录**，目录内包含 `index.md` 和可选的附件（图片、bib 文件等）：

```
content/
├── post/
│   └── 2026-06-10-Claude-Fable5/
│       ├── index.md          ← 正文 + front matter
│       └── featured.jpg      ← 封面图
├── project/
│   └── some-project/
│       ├── index.md
│       └── featured.jpg
├── publication/
│   └── DDE-Net/
│       ├── index.md
│       └── cite.bib
├── authors/
│   └── WangBoyu/
│       ├── _index.md          ← 注意：作者用 _index.md
│       └── avatar.jpg
└── _index.md                  ← 首页
```

> **关键发现**：Post / Project / Publication 使用 `index.md`，Author 使用 `_index.md`。Decap CMS 的 `folder` collection 支持自定义文件模板，可通过 `path: "{{slug}}/index"` 或 `path: "{{slug}}/_index"` 适配。

### 3.2 各内容类型的 Front Matter Schema

#### Post (成果动态)

```yaml
title: string          # 标题
date: datetime         # 发布日期 (YYYY-MM-DD)
authors: string[]      # 作者 ID 列表 (对应 authors/ 目录名)
summary: string        # 摘要
tags: string[]         # 标签
categories: string[]   # 分类
featured: boolean      # 是否精选
image:                 # 封面图 (可选)
  filename: string     #   图片文件名
  caption: string      #   图片说明
# --- body: markdown ---
```

#### Project (科研项目)

```yaml
title: string          # 项目名称
subtitle: string       # 副标题
date: datetime         # 日期
summary: string        # 摘要
tags: string[]         # 标签
categories: string[]   # 分类
featured: boolean      # 是否精选
image:                 # 封面图
  filename: string
  caption: string
links:                 # 外部链接列表
  - icon: string       #   Font Awesome 图标名
    icon_pack: string  #   fas/fab/ai
    name: string       #   链接显示名
    url: string        #   链接地址
# --- body: markdown ---
```

#### Publication (论文著作)

```yaml
title: string                    # 论文标题
authors: string[]                # 作者列表
date: datetime                   # 发表日期
publication_types: string[]      # 类型: paper-conference/article-journal/patent/...
publication: string              # 发表期刊/会议名称
abstract: string                 # 摘要
tags: string[]                   # 标签
featured: boolean                # 是否精选
links:                           # 外部链接
  - name: string
    url: string
# --- body: markdown ---
# --- cite.bib: 单独文件 ---
```

#### Author (团队成员)

```yaml
title: string               # 姓名
pinyin: string              # 拼音排序键 (全小写)
role: string                # 角色: Group Lead / Core Researcher / 在读博士 / 在读硕士 / 研究员
avatar_filename: string     # 头像文件名
bio: string                 # 简介
interests: string[]         # 研究方向
social:                     # 社交链接
  - icon: string
    icon_pack: string
    link: string
organizations:              # 所属机构
  - name: string
    url: string
email: string               # 邮箱
user_groups: string[]       # 所属分组 (用于首页团队展示筛选)
education:                  # 教育经历 (当前未使用但字段存在)
# --- body: markdown (个人详细介绍) ---
```

#### 首页 (`content/_index.md`)

```yaml
title: string
type: "landing"
sections:                   # HugoBlox Block 数组
  - block: string           #   块类型: hero / features / collection / team-showcase
    id: string              #   HTML ID
    content: object         #   块内容 (各 block 不同)
    design: object          #   设计参数
```

> **注意**：首页使用 HugoBlox Block Builder，结构复杂且高度灵活。Decap CMS 对这类嵌套动态结构的编辑支持有限。建议首页保持代码编辑，或仅为常见修改（如 Hero 标题、背景色）提供简化表单。

#### 单页 (`_index.md` for Research / Resources / About)

```yaml
title: string
subtitle: string (可选)
summary: string (可选)
type: "widget_page"
# --- body: markdown ---
```

---

## 4. 实施步骤

### Phase 1: 基础设施搭建

**预计耗时**：30 分钟  
**交付物**：CMS 可访问、认证可用

#### 1.1 创建 CMS 入口文件

文件：`static/admin/index.html`

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>VISTA CMS — 内容管理</title>
  <style>
    /* 自定义登录页品牌样式（可选） */
  </style>
</head>
<body>
  <script src="https://unpkg.com/decap-cms@^3.0.0/dist/decap-cms.js"></script>
  <!-- 自定义预览脚本（Phase 4 添加） -->
</body>
</html>
```

#### 1.2 Netlify Identity 配置

1. 进入 Netlify Dashboard → 选择 VISTA 站点
2. **Identity** → Enable Identity
3. **Registration** → 选择 "Invite only"（推荐，安全性更高）
4. **External providers** → 可选启用 GitHub OAuth
5. **Git Gateway** → Enable Git Gateway

#### 1.3 邀请编辑者

在 Netlify Identity 面板中：
- 通过邮箱邀请团队成员
- 受邀者收到邀请邮件 → 点击设置密码 → 获得 CMS 访问权限

#### 1.4 添加 Identity Widget (可选)

在网站中集成 Netlify Identity 的 JS widget，这样用户可以在 `/admin/` 页面获得更流畅的登录体验。在 `static/admin/index.html` 中添加：

```html
<script src="https://identity.netlify.com/v1/netlify-identity-widget.js"></script>
```

---

### Phase 2: 集合 (Collections) 配置

**预计耗时**：2–3 小时  
**交付物**：所有内容类型可通过 CMS 表单编辑  
**核心文件**：`static/admin/config.yml`

#### 2.1 顶层配置

```yaml
backend:
  name: git-gateway
  branch: main
  repo: vista-research-group/vista-research-group.github.io
  # 注意：repo 使用 GitHub 路径（不含 github.com 前缀）

media_folder: "static/uploads"
public_folder: "/uploads"
# 说明：上传的图片存入 static/uploads/，构建后映射为 /uploads/

locale: "zh_Hans"
# 界面中文化

site_url: "https://boooil.github.io/VISTA-Research-Group/"
display_url: "https://boooil.github.io/VISTA-Research-Group/"
# 用于预览链接

slug:
  encoding: "ascii"
  clean_accents: true
  sanitize_replacement: "-"
```

#### 2.2 Collections 详细定义

##### Collection 1: 成果动态 (Post)

```yaml
collections:
  - name: "post"
    label: "成果动态"
    label_singular: "成果动态"
    folder: "content/post"
    path: "{{year}}-{{month}}-{{day}}-{{slug}}/index"
    create: true
    slug: "{{slug}}"
    summary: "{{year}}-{{month}}-{{day}} — {{title}}"
    editor:
      preview: true
    fields:
      - label: "标题"
        name: "title"
        widget: "string"
        hint: "文章标题，显示在列表页和详情页顶部"
      - label: "发布日期"
        name: "date"
        widget: "datetime"
        date_format: "YYYY-MM-DD"
        time_format: false
        default: "{{now}}"
      - label: "作者"
        name: "authors"
        widget: "relation"
        collection: "authors"
        value_field: "{{slug}}"
        search_fields: ["title"]
        display_fields: ["title"]
        multiple: true
        min: 1
        hint: "选择文章作者（需先在「团队成员」中创建）"
      - label: "摘要"
        name: "summary"
        widget: "text"
        hint: "显示在文章列表页的简短摘要（1-3 句话）"
      - label: "标签"
        name: "tags"
        widget: "list"
        default: []
        hint: "用于文章分类和关联推荐"
      - label: "分类"
        name: "categories"
        widget: "list"
        default: []
        hint: '如 "News", "Research Update", "Publication"'
      - label: "精选"
        name: "featured"
        widget: "boolean"
        default: false
        hint: "开启后将在首页重点展示"
      - label: "封面图"
        name: "image"
        widget: "object"
        collapsed: true
        required: false
        fields:
          - label: "图片文件"
            name: "filename"
            widget: "image"
            required: false
            hint: "推荐尺寸 1200×630px"
          - label: "图片说明"
            name: "caption"
            widget: "string"
            required: false
      - label: "正文"
        name: "body"
        widget: "markdown"
        hint: "文章正文，支持标准 Markdown 格式"
```

##### Collection 2: 科研项目 (Project)

```yaml
  - name: "project"
    label: "科研项目"
    label_singular: "科研项目"
    folder: "content/project"
    path: "{{slug}}/index"
    create: true
    slug: "{{slug}}"
    editor:
      preview: true
    fields:
      - label: "项目名称"
        name: "title"
        widget: "string"
      - label: "副标题"
        name: "subtitle"
        widget: "string"
        required: false
      - label: "日期"
        name: "date"
        widget: "datetime"
        date_format: "YYYY-MM-DD"
        time_format: false
      - label: "摘要"
        name: "summary"
        widget: "text"
      - label: "标签"
        name: "tags"
        widget: "list"
        default: []
      - label: "分类"
        name: "categories"
        widget: "list"
        default: []
      - label: "精选"
        name: "featured"
        widget: "boolean"
        default: false
      - label: "封面图"
        name: "image"
        widget: "object"
        collapsed: true
        required: false
        fields:
          - label: "图片文件"
            name: "filename"
            widget: "image"
            required: false
          - label: "图片说明"
            name: "caption"
            widget: "string"
            required: false
      - label: "外部链接"
        name: "links"
        widget: "list"
        label_singular: "链接"
        required: false
        summary: "{{name}}: {{url}}"
        fields:
          - label: "图标名"
            name: "icon"
            widget: "string"
            hint: "Font Awesome 图标名，如 file, github, paper"
          - label: "图标包"
            name: "icon_pack"
            widget: "select"
            options: ["fas", "fab", "far", "ai"]
            default: "fas"
          - label: "链接名称"
            name: "name"
            widget: "string"
          - label: "链接地址"
            name: "url"
            widget: "string"
      - label: "正文"
        name: "body"
        widget: "markdown"
        required: false
```

##### Collection 3: 论文著作 (Publication)

```yaml
  - name: "publication"
    label: "论文著作"
    label_singular: "论文著作"
    folder: "content/publication"
    path: "{{slug}}/index"
    create: true
    slug: "{{slug}}"
    editor:
      preview: true
    fields:
      - label: "论文标题"
        name: "title"
        widget: "string"
      - label: "作者"
        name: "authors"
        widget: "relation"
        collection: "authors"
        value_field: "{{slug}}"
        search_fields: ["title"]
        display_fields: ["title"]
        multiple: true
        min: 1
        hint: "选择论文作者"
      - label: "发表日期"
        name: "date"
        widget: "datetime"
        date_format: "YYYY-MM-DD"
        time_format: false
      - label: "出版物类型"
        name: "publication_types"
        widget: "select"
        multiple: true
        options:
          - label: "会议论文"
            value: "paper-conference"
          - label: "期刊论文"
            value: "article-journal"
          - label: "专利"
            value: "patent"
          - label: "软件著作权"
            value: "software"
          - label: "技术报告"
            value: "report"
          - label: "标准规范"
            value: "standard"
          - label: "专著"
            value: "book"
          - label: "学位论文"
            value: "thesis"
      - label: "发表期刊/会议"
        name: "publication"
        widget: "string"
        hint: "如 'IEEE VIS 2026' 或 '计算机学报'"
      - label: "摘要"
        name: "abstract"
        widget: "text"
      - label: "标签"
        name: "tags"
        widget: "list"
        default: []
      - label: "精选"
        name: "featured"
        widget: "boolean"
        default: false
      - label: "外部链接"
        name: "links"
        widget: "list"
        label_singular: "链接"
        required: false
        summary: "{{name}}: {{url}}"
        fields:
          - label: "名称"
            name: "name"
            widget: "string"
          - label: "地址"
            name: "url"
            widget: "string"
      - label: "正文"
        name: "body"
        widget: "markdown"
        required: false
        hint: "论文附加说明（可选）"
    # 注意：cite.bib 文件目前无法通过 CMS 直接编辑，建议保持手动维护
    # 因为它需要 LaTeX 转义和精确的 BibTeX 格式
```

##### Collection 4: 团队成员 (Author)

```yaml
  - name: "authors"
    label: "团队成员"
    label_singular: "团队成员"
    folder: "content/authors"
    path: "{{slug}}/_index"
    create: true
    slug: "{{slug}}"
    # slug 即为作者 ID，建议用姓名拼音，如 wangboyu
    identifier_field: "pinyin"
    editor:
      preview: true
    fields:
      - label: "姓名"
        name: "title"
        widget: "string"
        hint: "中文姓名，如「王博宇」"
      - label: "拼音排序键"
        name: "pinyin"
        widget: "string"
        hint: "全小写无空格拼音，如 wangboyu。用于团队成员列表排序"
        pattern: ["^[a-z]+$", "必须为全小写字母，无空格"]
      - label: "角色/身份"
        name: "role"
        widget: "select"
        options:
          - "Group Lead"
          - "Core Researcher"
          - "在读博士"
          - "在读硕士"
          - "研究员"
        hint: "选择在团队中的角色"
      - label: "头像"
        name: "avatar_filename"
        widget: "image"
        hint: "推荐正方形照片，如 400×400px"
      - label: "个人简介"
        name: "bio"
        widget: "text"
        required: false
        hint: "1-2 句话简短介绍"
      - label: "研究方向"
        name: "interests"
        widget: "list"
        required: false
        hint: "如「3D Reconstruction」「AI」"
      - label: "社交链接"
        name: "social"
        widget: "list"
        required: false
        label_singular: "社交账号"
        summary: "{{icon}}: {{link}}"
        fields:
          - label: "图标名"
            name: "icon"
            widget: "string"
            hint: "Font Awesome 图标名"
          - label: "图标包"
            name: "icon_pack"
            widget: "select"
            options: ["fas", "fab", "far", "ai"]
            default: "fas"
          - label: "链接地址"
            name: "link"
            widget: "string"
      - label: "所属机构"
        name: "organizations"
        widget: "list"
        required: false
        label_singular: "机构"
        summary: "{{name}}"
        fields:
          - label: "机构名称"
            name: "name"
            widget: "string"
          - label: "机构链接"
            name: "url"
            widget: "string"
            required: false
      - label: "邮箱"
        name: "email"
        widget: "string"
        required: false
      - label: "所属分组"
        name: "user_groups"
        widget: "select"
        multiple: true
        options:
          - "Group Lead"
          - "Core Researcher"
          - "在读博士"
          - "在读硕士"
          - "研究员"
        hint: "用于首页团队展示的分组筛选"
      - label: "个人详细介绍"
        name: "body"
        widget: "markdown"
        required: false
        hint: "可选的详细个人介绍（显示在作者详情页）"
```

##### Collection 5: 页面 (Pages — Research / Resources / About)

```yaml
  - name: "pages"
    label: "独立页面"
    label_singular: "页面"
    files:
      - label: "研究方向"
        name: "research"
        file: "content/research/_index.md"
        fields:
          - label: "页面标题"
            name: "title"
            widget: "string"
            default: "Research"
          - label: "副标题"
            name: "subtitle"
            widget: "string"
            required: false
          - label: "摘要"
            name: "summary"
            widget: "text"
            required: false
          - label: "页面内容"
            name: "body"
            widget: "markdown"
            required: false
      - label: "资源下载"
        name: "resources"
        file: "content/resources/_index.md"
        fields:
          - label: "页面标题"
            name: "title"
            widget: "string"
            default: "Resources"
          - label: "副标题"
            name: "subtitle"
            widget: "string"
            required: false
          - label: "摘要"
            name: "summary"
            widget: "text"
            required: false
          - label: "页面内容"
            name: "body"
            widget: "markdown"
            required: false
      - label: "关于我们"
        name: "about"
        file: "content/about/_index.md"
        fields:
          - label: "页面标题"
            name: "title"
            widget: "string"
            default: "About"
          - label: "副标题"
            name: "subtitle"
            widget: "string"
            required: false
          - label: "摘要"
            name: "summary"
            widget: "text"
            required: false
          - label: "页面内容"
            name: "body"
            widget: "markdown"
            required: false
```

##### Collection 6: 首页配置 (Homepage)

```yaml
  - name: "homepage"
    label: "首页设置"
    files:
      - label: "首页配置"
        name: "home"
        file: "content/_index.md"
        fields:
          - label: "页面标题"
            name: "title"
            widget: "string"
            default: "VISTA Research Group"
          - label: "Hero 标题"
            name: "hero_title"
            widget: "string"
            default: "VISTA Research Group"
            hint: "首页大标题"
          - label: "Hero 描述文字"
            name: "hero_text"
            widget: "text"
            hint: "首页 Hero 区域的描述文字，支持 Markdown"
          - label: "Hero 背景色"
            name: "hero_bg_color"
            widget: "color"
            default: "#1e3a8a"
            hint: "Hero 区域纯色背景（当不设置渐变和图片时生效）"
          - label: "Research Highlights 标题"
            name: "features_title"
            widget: "string"
            default: "Research Highlights"
          - label: "Research Highlights 副标题"
            name: "features_subtitle"
            widget: "string"
            default: "研究方向"
          - label: "Featured Projects 标题"
            name: "projects_title"
            widget: "string"
            default: "Featured Projects"
          - label: "Featured Projects 副标题"
            name: "projects_subtitle"
            widget: "string"
            default: "重点成果"
          - label: "Latest Updates 标题"
            name: "posts_title"
            widget: "string"
            default: "Latest Updates"
          - label: "Latest Updates 副标题"
            name: "posts_subtitle"
            widget: "string"
            default: "动态"
          - label: "Recent Publications 标题"
            name: "publications_title"
            widget: "string"
            default: "Recent Publications"
          - label: "Recent Publications 副标题"
            name: "publications_subtitle"
            widget: "string"
            default: "论文著作"
          - label: "Team 标题"
            name: "team_title"
            widget: "string"
            default: "Meet the Team"
          - label: "Team 副标题"
            name: "team_subtitle"
            widget: "string"
            default: "团队成员"
```

> **⚠️ 重要说明**：首页使用 HugoBlox Block Builder，其 `sections` 是高度动态的 YAML 数组。Decap CMS 的 `file` collection 无法优雅地编辑这种嵌套列表结构。**建议**：
> - 方案 A (推荐)：首页保持代码编辑，CMS 仅管理内容项 (post/project/publication/authors/pages)
> - 方案 B (部分 CMS)：为 Hero block 的常见修改项（标题、背景色、描述文字）提供简化表单，其余部分代码编辑
> - 方案 C (全面 CMS)：使用 Decap CMS 的 `list` widget + `object` widget 完整建模 sections 结构（配置复杂，维护成本高，不推荐）

#### 2.3 Widget 选型总结

| 需求 | Widget | 说明 |
|------|--------|------|
| 单行文本 | `string` | 标题、名称等 |
| 多行文本 | `text` | 摘要、简介 |
| Markdown | `markdown` | 正文内容 |
| 日期时间 | `datetime` | 发布日期 |
| 开关 | `boolean` | featured 等 |
| 单选 | `select` | role, publication_types 等 |
| 文本列表 | `list` (默认 string) | tags, interests |
| 结构化列表 | `list` + `object` fields | links, social |
| 嵌套对象 | `object` | image |
| 图片上传 | `image` | featured.jpg, avatar.jpg |
| 关联选择 | `relation` | 选择已有作者 |
| 颜色选择 | `color` | 背景色 |

---

### Phase 3: 认证与权限

**预计耗时**：30 分钟  
**交付物**：编辑者可通过邀请链接登录 CMS

#### 3.1 Netlify Identity 配置步骤

1. 登录 [Netlify Dashboard](https://app.netlify.com) → 选择站点
2. 进入 **Identity** 标签页 → 点击 **Enable Identity**
3. 配置注册方式：
   - **Invite only**（推荐）：仅受邀者可访问
   - **Open**：任何人可注册（不推荐，内容安全考虑）
4. 进入 **Settings and usage** → **Git Gateway** → **Enable Git Gateway**
5. 在 **Identity** → **Invite users** 中邀请团队成员

#### 3.2 权限模型

Decap CMS + Netlify Identity 默认只有一个角色：**编辑者 (Editor)**。所有被邀请的用户拥有相同权限（创建、编辑、删除、发布）。

Netlify Identity 本身不提供细粒度角色控制。如需更细粒度的权限（如：初级编辑者只能编辑 Post，高级编辑者可以管理所有内容），需要：
- 使用 **Netlify Roles** (Beta 功能，需申请)
- 或使用 **Decap CMS 的 Editorial Workflow** 实现审核流程

#### 3.3 安全注意事项

- CMS 后台位于 `/admin/`，不需要在 `robots.txt` 中额外处理
- Netlify 的 `netlify.toml` 中已有 `/admin/*` 的 redirect 规则，保留即可
- Git Gateway 的 commit 会以编辑者的 Netlify Identity 身份提交，commit 信息包含作者邮箱

---

### Phase 4: 预览模板

**预计耗时**：1–2 小时  
**交付物**：编辑时可实时预览内容效果

Decap CMS 支持自定义预览模板，通过 React 组件在编辑面板中渲染预览。

#### 4.1 预览脚本架构

在 `static/admin/` 下创建预览组件：

```
static/admin/
├── index.html
├── config.yml
├── preview-templates.js    # 预览模板注册
└── preview-styles.css      # 预览样式（可选）
```

#### 4.2 预览模板示例

`preview-templates.js` 结构：

```javascript
// Post 预览模板
CMS.registerPreviewTemplate('post', createPreview(`
  <article style="max-width:800px;margin:0 auto;padding:2rem">
    <h1>{{ title }}</h1>
    <time>{{ date }}</time>
    <p class="summary">{{ summary }}</p>
    <div class="tags">{{ tags }}</div>
    <hr>
    <div class="content">{{ body }}</div>
  </article>
`));

// Author 预览模板
CMS.registerPreviewTemplate('authors', createPreview(`
  <div style="display:flex;gap:2rem;padding:2rem">
    <img src="{{ avatar_filename }}" style="width:150px;border-radius:50%">
    <div>
      <h1>{{ title }}</h1>
      <p class="role">{{ role }}</p>
      <p>{{ bio }}</p>
      <div class="interests">{{ interests }}</div>
      <div class="social">{{ social }}</div>
    </div>
  </div>
`));
```

> **权衡**：预览模板需要手动维护以匹配实际 Hugo 渲染效果。对于本项目的规模和团队情况，建议 **Phase 4 标记为可选**——先上线基础编辑功能，后续按需添加预览。

---

### Phase 5: 编辑工作流 (可选)

**预计耗时**：1 小时  
**交付物**：内容修改需审核后才能发布

Decap CMS 支持 **Editorial Workflow**（编辑工作流），在 `config.yml` 中启用：

```yaml
publish_mode: editorial_workflow
```

#### 工作流状态

```
Draft → In Review → Ready → Published
  ↑        ↓          ↓
  └── 修改后回到 Draft ──┘
```

| 状态 | 说明 |
|------|------|
| Draft | 编辑者创建/修改，保存为草稿 |
| In Review | 提交审核 |
| Ready | 审核通过，待发布 |
| Published | 发布到生产环境（合并到 main 分支） |

#### 适用场景判断

| 场景 | 是否需要工作流 |
|------|:---:|
| 单人维护 | ❌ 不需要 |
| 多人协作，内容需审核 | ✅ 建议启用 |
| 内容安全要求高 | ✅ 建议启用 |
| 追求快速发布 | ❌ 会增加发布延迟 |

对于 VISTA 研究组，如果仅 1-2 人维护内容，可跳过此阶段。

---

### Phase 6: 测试与文档

**预计耗时**：1 小时  
**交付物**：验证清单 + 用户手册

#### 6.1 测试清单

- [ ] 访问 `/admin/` → 显示登录页
- [ ] 使用 Netlify Identity 账号登录成功
- [ ] 创建新 Post → 填写所有字段 → 保存 → Git 仓库收到 commit
- [ ] 编辑已有 Post → 修改 → 保存 → 内容更新
- [ ] 上传图片 → 自动存入 `static/uploads/` → Markdown 中引用路径正确
- [ ] 创建新 Author → 头像上传正常
- [ ] Post 中通过 Relation widget 选择已有 Author
- [ ] 编辑 Publication → publication_types 下拉选项正确
- [ ] 编辑 Research / Resources / About 页面 → 内容保存正常
- [ ] Netlify 自动构建 → 部署成功 → 网站内容更新
- [ ] 移动端访问 CMS 后台 → 响应式布局正常

#### 6.2 用户手册内容

生成一份简明的 CMS 操作手册（`docs/CMS_User_Guide.md`），包含：

1. 如何登录 CMS
2. 各内容类型的编辑方法
3. 图片上传与引用
4. Markdown 基础语法速查
5. 常见问题 FAQ

---

## 5. 风险与注意事项

### 5.1 技术风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Decap CMS 版本更新导致 breaking change | 中 | 使用固定版本号 CDN (`@^3.0.0`)，在升级前测试 |
| Netlify Identity 服务中断 | 低 | CMS 不可用期间，可通过直接编辑 Git 文件应急 |
| Git Gateway commit 冲突 | 低 | 同一内容避免多人同时编辑 |
| `relation` widget 性能 | 低 | 当前作者数 < 10，性能无影响；大量作者时考虑 lazy load |
| HugoBlox Block Builder 兼容性 | 中 | 首页 sections 结构复杂，CMS 仅提供简化编辑或保持代码编辑 |

### 5.2 内容安全风险

> ⚠️ **参见 README.md 中的「内容安全与公开发布注意事项」。CMS 不会改变内容安全要求，编辑者仍需遵循相同的内容发布规范。**

- 所有通过 CMS 发布的内容同样会公开在互联网上
- CMS 不具备内容审查功能——需要人工审核
- 如果启用 Editorial Workflow，可以作为一道审核关卡

### 5.3 Netlify Build 资源消耗

- 每次 CMS 保存会触发一次 Git commit → Netlify auto-deploy
- Netlify 免费计划每月 300 分钟构建时间
- 高频编辑可能消耗较多构建配额
- **建议**：配置 Netlify 构建通知，监控配额使用情况

### 5.4 CMS 与现有文件结构兼容性

- Author 使用 `_index.md`（非 `index.md`），已在 `path` 配置中区分处理
- Publication 的 `cite.bib` 文件无法通过 CMS 编辑，需手动维护
- Post 的目录名包含日期前缀 (`YYYY-MM-DD-slug`)，已通过 `path` 模板实现
- 首页 `_index.md` 的 sections 结构复杂，建议保持代码编辑

---

## 6. 备选方案对比

### 方案 A：Decap CMS + Netlify Identity（本方案 · 推荐）

| 维度 | 评价 |
|------|------|
| **部署复杂度** | ⭐⭐ (需配置 Netlify Identity) |
| **日常使用** | ⭐⭐⭐⭐⭐ (纯 Web UI) |
| **费用** | 免费 (Netlify 免费层完全够用) |
| **与现有架构集成** | ⭐⭐⭐⭐ (Git Gateway 直接写 Git) |
| **中文支持** | ⭐⭐⭐ (界面可设中文，但部分提示仍为英文) |
| **灵活性** | ⭐⭐⭐ (适合固定结构内容，不适合高度动态的页面) |

### 方案 B：Tina CMS

| 维度 | 评价 |
|------|------|
| **部署复杂度** | ⭐⭐⭐ (需额外 Tina Cloud 账号) |
| **日常使用** | ⭐⭐⭐⭐ (可视化编辑 + 实时预览) |
| **费用** | 免费层 2 用户 / 2 项目 |
| **与 Hugo 集成** | ⭐⭐⭐⭐ (官方支持 Hugo) |

### 方案 C：CloudCannon

| 维度 | 评价 |
|------|------|
| **部署复杂度** | ⭐ (只需关联 Git 仓库) |
| **日常使用** | ⭐⭐⭐⭐⭐ (最佳 Hugo 编辑体验) |
| **费用** | $45/月 (Team plan)，无永久免费层 |
| **与 Hugo 集成** | ⭐⭐⭐⭐⭐ (原生 Hugo 支持) |

### 方案 D：纯 Git 编辑 + GitHub Web UI（现状）

| 维度 | 评价 |
|------|------|
| **部署复杂度** | ⭐ (无需额外配置) |
| **日常使用** | ⭐⭐ (需了解 Git/Markdown) |
| **费用** | 免费 |
| **学习成本** | 需要培训 Markdown + Git 基础 |

> **结论**：对于 VISTA 研究组的规模和使用场景，**Decap CMS** 是最佳平衡点——免费、与现有 Netlify 部署无缝集成、学习成本适中。

---

## 7. 后续扩展可能性

1. **自定义 Widget** — 为特殊字段开发自定义输入组件（如 BibTeX 引用编辑器）
2. **多语言编辑** — 利用 Decap CMS 的 `locale` 功能支持中英双语内容管理
3. **媒体库增强** — 集成 Cloudinary 等媒体管理服务，支持图片裁剪/压缩
4. **内容 AI 辅助** — 集成 AI 工具帮助生成摘要、标签推荐
5. **定时发布** — 结合 Editorial Workflow 实现定时内容发布
6. **Webhook 通知** — 内容发布后自动推送通知到团队 IM（如企业微信）

---

## 附录 A：关键文件清单

实施本方案需要新增/修改的文件：

| 文件 | 操作 | 说明 |
|------|------|------|
| `static/admin/index.html` | **新增** | CMS 入口 |
| `static/admin/config.yml` | **新增** | 内容模型配置（核心） |
| `static/admin/preview-templates.js` | **新增** (可选) | 预览模板 |
| `static/admin/preview-styles.css` | **新增** (可选) | 预览样式 |
| `netlify.toml` | 无需修改 | 已有 `/admin/*` redirect |
| Netlify Dashboard | **配置** | Identity + Git Gateway 启用 |

## 附录 B：参考链接

- [Decap CMS 官方文档](https://decapcms.org/docs/)
- [Decap CMS Collection Types](https://decapcms.org/docs/collection-types/)
- [Decap CMS Widgets](https://decapcms.org/docs/widgets/)
- [Netlify Identity 文档](https://docs.netlify.com/visitor-access/identity/)
- [Netlify Git Gateway](https://docs.netlify.com/visitor-access/git-gateway/)
- [HugoBlox 文档](https://docs.hugoblox.com/)

---

> 📅 最后更新：2026-06-11  
> ✍️ 作者：VISTA Research Group + Claude  
> 📋 状态：待评审 — 请确认实施方案后进入开发阶段
