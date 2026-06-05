请帮我在当前仓库中创建或改造一个基于 **Hugo + HugoBlox Academic** 的科研组展示网站。网站名称为 **VISTA Research Group**，中文名称为 **维势研究组**。网站用于展示我们部门科研成果，研究方向是“三维战场态势仿真、智能推演与作战辅助分析”。

## 一、技术栈要求

请使用：

- Hugo
- HugoBlox / Hugo Academic 体系
- Markdown 内容管理
- GitHub Pages / GitLab Pages / Netlify / Vercel 兼容部署
- 不使用传统后端数据库
- 不使用 WordPress
- 不使用 Jekyll

注意：如果资料中出现 Wowchemy、Hugo Academic、HugoBlox 等名称，请优先采用当前维护中的 **HugoBlox Academic** 结构。可以参考 Hugo Academic / Wowchemy 的实验室网站风格，但不要依赖过时配置。

如果当前仓库为空，请创建一个可运行的 Hugo 项目；如果当前仓库已有 HugoBlox Academic 模板，请在其基础上改造。

## 二、网站定位

网站英文名：

VISTA Research Group

英文全称解释：

Visualization, Intelligence, Simulation & Tactical Analysis

中文定位语：

三维战场态势仿真与智能推演研究组

整体风格要求：

- 学术
- 简洁
- 现代
- 稳重
- 科技感
- 适合高校实验室、科研院所、研究组展示
- 避免过度军事化视觉表达
- 不使用真实军事图片
- 不包含敏感细节
- 使用抽象三维网格、数字空间、态势图层、仿真系统风格元素即可

主色建议：

- 深蓝
- 科技蓝
- 白色
- 浅灰
- 少量强调色

## 三、网站导航结构

请实现以下一级导航：

1. Home / 首页
2. Research / 研究方向
3. Projects / 科研成果
4. Publications / 论文著作
5. Posts / 成果动态
6. Team / 团队成员
7. Resources / 资源下载
8. About / 关于我们

顶部导航需要在桌面端清晰展示，在移动端自动折叠菜单。

## 四、推荐 Hugo 目录结构

请尽量采用 HugoBlox / Hugo Academic 常见目录风格，同时保证内容结构清晰。

建议结构如下：

```text
.
├── config/
│   └── _default/
│       ├── hugo.yaml
│       ├── menus.yaml
│       ├── params.yaml
│       └── languages.yaml
├── content/
│   ├── _index.md
│   ├── research/
│   │   └── _index.md
│   ├── project/
│   │   ├── _index.md
│   │   ├── 3d-battlefield-situation-visualization/
│   │   │   ├── index.md
│   │   │   └── featured.jpg
│   │   ├── multi-agent-wargaming/
│   │   │   ├── index.md
│   │   │   └── featured.jpg
│   │   └── decision-intelligence/
│   │       ├── index.md
│   │       └── featured.jpg
│   ├── post/
│   │   ├── _index.md
│   │   ├── 2026-06-01-sample-research-update/
│   │   │   ├── index.md
│   │   │   └── featured.jpg
│   │   ├── 2026-06-15-simulation-method/
│   │   │   ├── index.md
│   │   │   └── featured.jpg
│   │   └── 2026-07-01-visualization-framework/
│   │       ├── index.md
│   │       └── featured.jpg
│   ├── publication/
│   │   ├── _index.md
│   │   └── sample-publication/
│   │       ├── index.md
│   │       └── cite.bib
│   ├── authors/
│   │   ├── admin/
│   │   │   ├── _index.md
│   │   │   └── avatar.jpg
│   │   ├── member-a/
│   │   │   ├── _index.md
│   │   │   └── avatar.jpg
│   │   └── member-b/
│   │       ├── _index.md
│   │       └── avatar.jpg
│   ├── resources/
│   │   └── _index.md
│   └── about/
│       └── _index.md
├── assets/
│   ├── media/
│   └── scss/
├── static/
│   └── uploads/
├── layouts/
│   └── partials/
├── go.mod
├── go.sum
├── netlify.toml
├── .github/
│   └── workflows/
│       └── deploy.yml
└── README.md
```

如果 HugoBlox 当前推荐结构与上述结构略有不同，请优先保持 HugoBlox 的最佳实践，但必须保证内容可通过 Markdown 维护。

## 五、首页设计

请将首页设计为科研组门户，不要只做个人主页。

首页需要包括以下模块：

### 1. Hero 首屏区域

内容：

- VISTA Research Group
- 维势研究组
- Visualization, Intelligence, Simulation & Tactical Analysis
- 聚焦三维战场态势仿真、智能推演与作战辅助分析
- 标语：洞察全域态势，推演未来行动

按钮：

- Explore Research
- Latest Work
- Contact Us

Hero 背景：

- 可以使用 CSS 渐变、抽象三维网格、数字地形、态势图层、模拟空间等视觉元素
- 不要使用真实军事照片
- 可以先用占位图或 CSS 背景

### 2. Research Highlights 研究方向

展示 3 个研究方向卡片：

1. 3D Battlefield Situation Visualization
   三维战场态势可视化
2. Simulation & Wargaming
   仿真建模与推演分析
3. Decision Intelligence
   智能评估与辅助决策

每张卡片包含：

- 英文标题
- 中文标题
- 简短说明
- 关键词标签
- 链接到 Research 页面

### 3. Featured Projects 重点成果

从 `content/project/` 中读取并展示 3–6 个 featured 项目。

每个项目卡片包含：

- 项目标题
- 项目摘要
- 封面图
- 标签
- 状态
- Read More 链接

### 4. Latest Posts 最新动态

从 `content/post/` 中读取最新 3–5 篇文章。

每篇文章展示：

- 标题
- 日期
- 摘要
- 标签
- Read More 链接

### 5. Recent Publications 近期成果

从 `content/publication/` 中展示最近 3–5 条成果，包括：

- 论文
- 专利
- 软著
- 技术报告
- 标准规范

### 6. Team Preview 团队预览

展示负责人和若干核心成员。使用占位成员，不要写真实个人信息。

### 7. Footer 页脚

包含：

- VISTA Research Group
- 维势研究组
- 研究方向简述
- 联系方式占位
- GitHub/GitLab 链接占位
- 版权信息

## 六、Research 页面

Research 页面需要完整展示三个研究方向：

### 方向一：三维战场态势可视化

内容包括：

- 研究背景
- 核心问题
- 技术路线
- 代表性成果
- 相关项目链接
- 关键词

### 方向二：仿真建模与推演分析

内容包括：

- 多实体建模
- 场景构建
- 行为规则
- 推演流程
- 评估指标
- 相关项目链接

### 方向三：智能评估与辅助决策

内容包括：

- 态势理解
- 方案评估
- 多智能体推演
- 指标体系
- 人机协同分析
- 相关项目链接

请使用公开、抽象、非敏感表述，不要涉及真实战术细节或真实系统参数。

## 七、Projects 科研成果

请使用 Hugo 的 `content/project/` 内容类型来管理项目。

每个项目应为 Page Bundle，例如：

```text
content/project/3d-battlefield-situation-visualization/
├── index.md
└── featured.jpg
```

项目 Markdown front matter 示例：

```yaml
---
title: "三维战场态势可视化原型系统"
subtitle: "面向多尺度作战场景的三维态势表达与交互分析"
date: 2026-06-01
summary: "该项目围绕三维战场环境中的多源态势融合、空间表达和交互推演开展研究。"
tags:
  - 3D Visualization
  - Situation Awareness
  - Simulation
categories:
  - Research Project
featured: true
image:
  filename: featured.jpg
  caption: "Abstract 3D situation visualization"
links:
  - icon: file
    icon_pack: fas
    name: Paper
    url: ""
  - icon: video
    icon_pack: fas
    name: Demo
    url: ""
  - icon: github
    icon_pack: fab
    name: Code
    url: ""
---

## 项目背景

## 技术路线

## 系统效果

## 主要贡献

## 相关成果
```

请创建至少 3 个示例项目：

1. 三维战场态势可视化原型系统
2. 多智能体仿真推演框架
3. 作战行动方案智能评估方法

所有内容都使用抽象、公开、非敏感描述。

## 八、Posts 成果动态

请使用 `content/post/` 管理博客式成果动态。

每篇文章也使用 Page Bundle：

```text
content/post/2026-06-01-sample-research-update/
├── index.md
└── featured.jpg
```

文章 front matter 示例：

```yaml
---
title: "面向三维战场态势的多层级可视化表达方法"
date: 2026-06-01
authors:
  - admin
summary: "本文介绍一种面向多尺度态势表达的三维可视化方法。"
tags:
  - 3D Visualization
  - Battlefield Situation
  - Simulation
categories:
  - Research Update
featured: true
image:
  filename: featured.jpg
  caption: "Abstract visualization framework"
---

## 背景

## 方法

## 实验与演示

## 小结
```

请创建至少 3 篇示例文章，主题包括：

1. 面向三维战场态势的多层级可视化表达方法
2. 多智能体推演中的行为建模思路
3. 面向方案评估的仿真指标体系设计

文章内容需要正式、学术、克制，避免敏感细节。

## 九、Publications 论文著作

请使用 HugoBlox Academic 的 publication 内容模型。

每条成果可以放在：

```text
content/publication/example-title/
├── index.md
└── cite.bib
```

Publication front matter 示例：

```yaml
---
title: "A Multi-level Visualization Method for 3D Situation Awareness"
authors:
  - admin
date: 2026-06-01
publication_types:
  - paper-conference
publication: "Conference or Journal Name"
abstract: "This work presents a multi-level visualization method for complex 3D situation awareness scenarios."
tags:
  - 3D Visualization
  - Simulation
featured: true
links:
  - name: PDF
    url: ""
  - name: Project
    url: "/project/3d-battlefield-situation-visualization/"
---
```

请创建至少 5 条示例成果，类型包括：

- Paper
- Patent
- Software Copyright
- Technical Report
- Standard / Guideline

如果 HugoBlox 默认 publication_types 不完全覆盖专利、软著、报告，请用 tags 或 categories 补充展示。

## 十、Team 团队成员

请使用 HugoBlox 的 authors 机制管理团队成员。

成员目录示例：

```text
content/authors/admin/_index.md
content/authors/member-a/_index.md
content/authors/member-b/_index.md
```

成员 front matter 示例：

```yaml
---
title: "张三"
role: "Group Lead"
ava
```

## 十一、示例内容

请创建足够的示例内容，使网站本地运行后不是空白页面。

至少包括：

- 3 篇 Posts 示例文章
- 3 个 Projects 示例项目
- 5 条 Publications 示例成果
- 4 个 Team 成员占位
- Research 页面完整示例内容
- About 页面完整示例内容

示例内容必须围绕以下主题，但不要包含真实涉密信息：

- 三维战场态势可视化
- 多智能体仿真推演
- 作战行动方案评估
- 数字地形与态势表达
- 智能辅助决策

所有示例内容使用公开、抽象、非敏感表述。

## 十二、README 文档

请创建或更新 README.md，包含：

1. 项目简介
2. 本地运行方法
3. 新增一篇成果动态的方法
4. 新增一个科研项目的方法
5. 更新团队成员的方法
6. 更新论文著作的方法
7. 部署到 GitHub Pages 的方法
8. 部署到 GitLab Pages 的方法
9. Decap CMS 后台配置说明
10. 内容安全与公开发布注意事项

README 需要写得清楚，让非专业前端人员也能维护。

## 十三、最终交付要求

请完成后给出：

1. 你创建/修改了哪些文件
2. 如何本地启动
3. 如何新增 Markdown 文章
4. 如何新增项目
5. 如何部署
6. 后续可以继续优化的地方