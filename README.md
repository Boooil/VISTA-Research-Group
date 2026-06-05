# VISTA Research Group Website

**VISTA** (Visualization, Intelligence, Simulation & Tactical Analysis) — 维势研究组

基于 [Hugo](https://gohugo.io) + [HugoBlox Academic](https://hugoblox.com) 构建的科研组展示网站。

> 聚焦三维战场态势仿真、智能推演与作战辅助分析

[![Deploy Hugo site to GitHub Pages](https://github.com/vista-research-group/vista-research-group.github.io/actions/workflows/deploy.yml/badge.svg)](https://github.com/vista-research-group/vista-research-group.github.io/actions/workflows/deploy.yml)

---

## 目录

- [项目简介](#项目简介)
- [本地运行](#本地运行)
- [内容维护](#内容维护)
  - [新增成果动态 (Post)](#新增成果动态-post)
  - [新增科研项目 (Project)](#新增科研项目-project)
  - [新增论文著作 (Publication)](#新增论文著作-publication)
  - [更新团队成员 (Author)](#更新团队成员-author)
- [部署指南](#部署指南)
  - [GitHub Pages](#github-pages)
  - [GitLab Pages](#gitlab-pages)
  - [Netlify](#netlify)
  - [Vercel](#vercel)
- [网站结构](#网站结构)
- [内容安全说明](#内容安全说明)
- [后续优化方向](#后续优化方向)

---

## 项目简介

VISTA 研究组网站用于展示部门的科研成果与团队信息。网站具有以下特点：

- 📝 **纯 Markdown 内容管理** — 无需数据库，所有内容通过 Markdown 文件维护
- 🎨 **深蓝科技风格** — 学术、简洁、现代、稳重
- 📱 **响应式设计** — 适配桌面与移动设备
- 🚀 **静态站点生成** — 基于 Hugo，构建速度快
- 🌐 **多平台部署** — 支持 GitHub Pages / GitLab Pages / Netlify / Vercel

### 网站导航结构

| 导航栏 | 路径 | 说明 |
|--------|------|------|
| Home | `/` | 首页门户 |
| Research | `/research/` | 研究方向 |
| Projects | `/project/` | 科研成果 |
| Publications | `/publication/` | 论文著作 |
| Posts | `/post/` | 成果动态 |
| Team | `/authors/` | 团队成员 |
| Resources | `/resources/` | 资源下载 |
| About | `/about/` | 关于我们 |

---

## 本地运行

### 前置要求

- [Hugo Extended](https://gohugo.io/installation/) ≥ 0.120.0
- [Go](https://go.dev/dl/) ≥ 1.21

### 安装 Hugo Extended (Windows)

```powershell
# 使用 Chocolatey
choco install hugo-extended

# 或使用 Scoop
scoop install hugo-extended

# 或从 GitHub Releases 下载
# https://github.com/gohugoio/hugo/releases
```

### 安装 Hugo Extended (macOS)

```bash
brew install hugo
```

### 安装 Hugo Extended (Linux)

```bash
# Ubuntu/Debian
sudo apt install hugo

# 或下载预编译二进制
# https://github.com/gohugoio/hugo/releases
```

### 克隆并运行

```bash
# 克隆仓库
git clone https://github.com/vista-research-group/vista-research-group.github.io.git
cd vista-research-group.github.io

# 下载 Hugo 模块（主题等依赖）
hugo mod get -u

# 启动本地开发服务器
hugo server -D

# 浏览器打开 http://localhost:1313
```

> **注意**：首次运行需要联网下载 HugoBlox 主题模块。如果模块下载失败，请确保 Go 代理设置正确：
> ```bash
> go env -w GOPROXY=https://goproxy.cn,direct   # 国内用户推荐
> ```

---

## 内容维护

所有网站内容均通过 Markdown 文件管理，位于 `content/` 目录下。更新内容只需编辑对应的 Markdown 文件，无需修改代码。

### 新增成果动态 (Post)

成果动态是团队的最新研究进展、会议报告、方法分享等博客式文章。

**步骤：**

1. 在 `content/post/` 下创建新目录，命名格式：`YYYY-MM-DD-文章英文简写/`
2. 在该目录下创建 `index.md`
3. 添加 front matter 和正文内容

**模板：**

```bash
# 创建文章目录
mkdir -p "content/post/$(date +%Y-%m-%d)-your-post-slug"

# 创建 index.md 并填入以下内容
```

```yaml
---
title: "你的文章标题"
date: 2026-06-06
authors:
  - admin              # 作者，与 content/authors/ 中的目录名对应
summary: "文章摘要，显示在列表页"
tags:
  - Tag1
  - Tag2
categories:
  - Research Update
featured: true          # 是否在首页展示
image:
  filename: featured.jpg  # 文章封面图（可选）
  caption: "图片说明"
---

## 背景

（正文内容，使用标准 Markdown 格式）

## 方法

（正文内容）

## 小结

（正文内容）
```

### 新增科研项目 (Project)

**步骤：**

1. 在 `content/project/` 下创建新目录
2. 在该目录下创建 `index.md` 和 `featured.jpg`

**模板：**

```yaml
---
title: "项目名称"
subtitle: "项目副标题"
date: 2026-06-06
summary: "项目摘要"
tags:
  - Tag1
categories:
  - Research Project
featured: true
image:
  filename: featured.jpg
  caption: "图片说明"
links:
  - icon: file
    icon_pack: fas
    name: Paper
    url: ""
  - icon: github
    icon_pack: fab
    name: Code
    url: ""
---

## 项目背景

## 技术路线

## 主要贡献

## 相关成果
```

### 新增论文著作 (Publication)

**步骤：**

1. 在 `content/publication/` 下创建新目录
2. 在该目录下创建 `index.md` 和 `cite.bib`

**模板：**

```yaml
---
title: "论文标题"
authors:
  - admin
  - member-a
date: 2026-06-06
publication_types:
  - paper-conference    # 类型见下方说明
publication: "会议/期刊名称"
abstract: "论文摘要"
tags:
  - Tag1
featured: true
links:
  - name: PDF
    url: ""
  - name: Project
    url: "/project/相关项目目录名/"
---
```

**Publication Types 说明：**

| 类型代码 | 含义 |
|----------|------|
| `paper-conference` | 会议论文 |
| `article-journal` | 期刊论文 |
| `patent` | 专利 |
| `software` | 软件著作权 |
| `report` | 技术报告 |
| `standard` | 标准规范 |
| `book` | 专著 |
| `thesis` | 学位论文 |

**cite.bib 模板：**

```bibtex
@inproceedings{引用key,
  title     = {论文标题},
  author    = {作者1 and 作者2},
  booktitle = {会议名称},
  year      = {2026},
  abstract  = {摘要}
}
```

### 更新团队成员 (Author)

**步骤：**

1. 在 `content/authors/` 下创建新目录（目录名为成员 ID）
2. 在该目录下创建 `_index.md` 和 `avatar.jpg`

**模板：**

```yaml
---
title: "姓名"
role: "Group Lead"                # Group Lead / Core Researcher / Collaborator
avatar_filename: avatar.jpg
bio: "个人简介（1-2句话）"
interests:
  - 研究方向1
  - 研究方向2
social:
  - icon: envelope
    icon_pack: fas
    link: "mailto:xxx@example.com"
  - icon: google-scholar
    icon_pack: ai
    link: "#"
organizations:
  - name: VISTA Research Group
    url: ""
education:
  courses:
    - course: PhD in XX
      institution: Example University
      year: ""
user_groups:
  - Group Lead           # 所属分组
---

个人详细介绍（可选）
```

---

## 部署指南

### GitHub Pages

1. 将代码推送到 `https://github.com/<your-org>/<your-repo>`
2. 在仓库 Settings → Pages 中，将 Source 设为 **GitHub Actions**
3. 推送代码到 `main` 分支即可自动触发部署
4. 部署完成后访问 `https://<your-org>.github.io/<your-repo>/`

> `.github/workflows/deploy.yml` 已配置好 CI/CD 流程，无需额外设置。

### GitLab Pages

1. 在仓库根目录创建 `.gitlab-ci.yml`：

```yaml
image: registry.gitlab.com/pages/hugo/hugo_extended:0.140.0

variables:
  GIT_SUBMODULE_STRATEGY: recursive
  HUGO_ENV: production

before_script:
  - apk add --no-cache go
  - hugo mod get -u

pages:
  script:
    - hugo --minify --gc
  artifacts:
    paths:
      - public
  only:
    - main
```

2. 推送代码，GitLab Pages 自动构建部署
3. 访问 `https://<your-namespace>.gitlab.io/<your-repo>/`

### Netlify

1. 在 [Netlify](https://app.netlify.com) 中 "Import from Git"
2. 选择你的 Git 仓库
3. 构建设置会自动从 `netlify.toml` 读取：
   - **Build command**: `hugo --minify --gc`
   - **Publish directory**: `public`
4. 点击 Deploy

### Vercel

1. 在 [Vercel](https://vercel.com) 中 "Import Project"
2. 选择你的 Git 仓库
3. 配置构建设置：
   - **Framework**: Hugo
   - **Build command**: `hugo --minify --gc`
   - **Output directory**: `public`
4. 添加环境变量：`HUGO_VERSION` = `0.140.0`
5. 点击 Deploy

---

## 网站结构

```
.
├── config/
│   └── _default/
│       ├── hugo.yaml          # Hugo 主配置
│       ├── menus.yaml          # 导航菜单
│       ├── params.yaml         # 主题参数（颜色、字体等）
│       └── languages.yaml      # 多语言配置
├── content/                    # 📝 所有内容（Markdown 维护）
│   ├── _index.md              #   首页
│   ├── research/_index.md     #   研究方向
│   ├── project/               #   科研项目
│   ├── post/                  #   成果动态
│   ├── publication/           #   论文著作
│   ├── authors/               #   团队成员
│   ├── resources/_index.md    #   资源下载
│   └── about/_index.md        #   关于我们
├── assets/
│   ├── media/                  # 媒体资源
│   └── scss/custom.scss       # 自定义样式
├── static/uploads/             # 静态文件
├── layouts/partials/           # 自定义模板
├── go.mod                      # Go 模块依赖
├── netlify.toml                # Netlify 部署配置
├── .github/workflows/          # GitHub Actions
└── README.md
```

---

## Decap CMS 后台配置说明

网站支持通过 [Decap CMS](https://decapcms.org/) 提供可视化后台编辑功能。

### 配置方法

1. 在 `static/admin/` 目录下创建 `config.yml`：

```yaml
backend:
  name: git-gateway
  branch: main
  repo: <your-org>/<your-repo>

media_folder: "static/uploads"
public_folder: "/uploads"

collections:
  - name: "post"
    label: "成果动态"
    folder: "content/post"
    create: true
    slug: "{{year}}-{{month}}-{{day}}-{{slug}}"
    fields:
      - { label: "标题", name: "title", widget: "string" }
      - { label: "日期", name: "date", widget: "datetime" }
      - { label: "作者", name: "authors", widget: "list", default: ["admin"] }
      - { label: "摘要", name: "summary", widget: "text" }
      - { label: "标签", name: "tags", widget: "list" }
      - { label: "正文", name: "body", widget: "markdown" }

  - name: "project"
    label: "科研项目"
    folder: "content/project"
    create: true
    fields:
      - { label: "项目名称", name: "title", widget: "string" }
      - { label: "副标题", name: "subtitle", widget: "string" }
      - { label: "日期", name: "date", widget: "datetime" }
      - { label: "摘要", name: "summary", widget: "text" }
      - { label: "标签", name: "tags", widget: "list" }
      - { label: "正文", name: "body", widget: "markdown" }
```

2. 在 `static/admin/` 目录下创建 `index.html`：

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>VISTA CMS</title>
</head>
<body>
  <script src="https://unpkg.com/decap-cms@^3.0.0/dist/decap-cms.js"></script>
</body>
</html>
```

3. 在 Netlify 中启用 Identity 和 Git Gateway 服务

4. 访问 `https://你的域名/admin/` 进入管理后台

> **注意**：Decap CMS 的后台编辑功能依赖于 Netlify Identity 或自建 OAuth 服务。如果不需要可视化管理后台，可以直接通过编辑 Markdown 文件维护内容——这本身已经非常简单。

---

## 内容安全与公开发布注意事项

本网站用于对外公开展示科研成果，内容管理需遵循以下原则：

### ✅ 可以公开

- 已发表的学术论文信息（标题、作者、摘要、DOI）
- 已授权的专利号与名称
- 已登记的软件著作权信息
- 公开发布的技术报告和标准规范
- 学术会议报告材料
- 团队成员公开的学术履历
- 使用抽象化、示意性语言描述的研究方向和技术路线

### ❌ 不应公开

- 未发表的敏感研究细节
- 真实军事部署、作战计划、战术参数
- 涉密系统架构、接口规范、数据格式
- 真实的武器系统参数与性能数据
- 未经脱敏的仿真数据与评估结果
- 不明确的涉密信息来源

### 📝 内容表述建议

- 使用抽象的学术术语（如"多智能体建模"而非"XX部队作战模型"）
- 使用示意性场景（如"区域控制场景"而非特定地理区域）
- 避免使用真实地点的地理信息数据
- 示意图使用抽象视觉元素（网格、图表、热力图），不使用真实地图
- 论文引用已发表文献，不引用内部报告

### 🔒 部署前检查清单

- [ ] 所有示例内容使用占位信息，不包含真实个人信息
- [ ] 功能介绍使用抽象术语，不涉及具体系统参数
- [ ] 图片使用抽象视觉元素或占位图
- [ ] 已删除或替换所有模板中的真实样例数据
- [ ] 已确认发布平台符合机构的内容发布规定

---

## 后续优化方向

以下是网站后续可以进一步完善的建议：

1. **图片资源** — 替换所有占位图为实际的抽象示意图和团队成员照片
2. **Decap CMS 集成** — 配置完整的可视化后台编辑系统，方便非技术人员维护
3. **搜索功能** — 集成 lunr.js 或 Algolia 实现站内全文搜索
4. **多语言完善** — 完善中英文双语内容（当前结构已支持，需补充对应的翻译内容）
5. **数据仪表板** — 在首页增加科研成果统计数字（论文数、项目数、专利数等）
6. **自动引用生成** — 集成 Google Scholar / DBLP 自动拉取论文信息
7. **交互式演示** — 嵌入 WebGL 三维态势可视化在线演示
8. **RSS / Atom Feed** — 自动生成内容订阅源
9. **SEO 优化** — 细化各页面的 meta description 和 Open Graph 标签
10. **暗色模式** — 完善暗色主题的颜色适配

---

## 许可

网站内容和代码在各自许可下发布。具体许可信息待补充。

---

> 🤖 Built with [Hugo](https://gohugo.io) + [HugoBlox](https://hugoblox.com) | Maintained by VISTA Research Group
