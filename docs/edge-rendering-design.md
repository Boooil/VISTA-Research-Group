# Cloudflare Workers 边缘动态渲染 — 方案设计

> 状态：设计阶段 | 2026-06-15

## 一、背景与目标

### 1.1 问题

当前 CMS 提交流程：

```
CMS 提交 → GitHub push → Cloudflare Pages 触发 Hugo 全量构建 → CDN 部署
                          └────────── 40-60s ──────────┘
```

内容变更后需要等待 40-60 秒才能在网站上看到更新结果。对于论文著作（publication）这类频繁更新的内容，严重影响编辑体验。

### 1.2 目标

- **核心目标**：CMS 提交后内容页面 **1-3 秒内可见**，刷新即看到新内容
- **覆盖范围**：post / publication / project / author 四种内容详情页
- **不覆盖**：首页、列表页、标签/分类聚合页、RSS、sitemap — 这些仍走 Hugo → Pages 构建（变更频率低，40s 可接受）

---

## 二、架构总览

```
                         CMS 提交
                            │
                    GitHub push (秒级)
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
      GitHub Raw API               Cloudflare Pages
    (内容立即可读)                (触发全量 Hugo 构建)
              │                           │
              ▼                           ▼
    ┌───────────────────┐      静态资源 + 首页 + 列表页
    │  Edge Renderer    │          (40-60s 后更新)
    │  (Cloudflare      │
    │   Worker)         │
    └──────┬────────────┘
           │
    路由判断：
    ├─ /post/*          → Worker 动态渲染
    ├─ /publication/*   → Worker 动态渲染
    ├─ /project/*       → Worker 动态渲染
    ├─ /author/*        → Worker 动态渲染
    └─ 其他路径          → 透传 Cloudflare Pages
```

**部署方式**：使用 Cloudflare **Worker Routes** 挂载在 Pages 自定义域名上。Worker 位于 Pages 之前，对匹配路由拦截处理，不匹配则 `fetch(request)` 透传。

---

## 三、路由分发策略

| URL 模式 | 处理方 | 原因 |
|:---------|:------|:-----|
| `/post/<slug>/` | **Worker** | 高频更新，需即时可见 |
| `/publication/<slug>/` | **Worker** | 高频更新，核心痛点 |
| `/project/<slug>/` | **Worker** | 低频但同机制 |
| `/author/<slug>/` | **Worker** | 团队成员页面，低频变更 |
| `/` | Pages | 首页，sections 块结构复杂 |
| `/post/` (列表) | Pages | 列表随内容变更，Hugo 重建 |
| `/publication/` (列表) | Pages | 同上 |
| `/project/` (列表) | Pages | 同上 |
| `/author/` (列表) | Pages | 同上 |
| `/tags/*`, `/categories/*` | Pages | 分类聚合页 |
| `/research/`, `/resources/`, `/about/` | Pages | 独立页面，极少变更 |
| `/uploads/*` | Pages | 静态资源 |
| `/admin/*` | Pages | CMS 后台 |
| `*.js`, `*.css`, `*.png` 等 | Pages | 静态资源 |

**Worker 内部路由匹配逻辑**：

```text
1. 解析 URL pathname
2. 正则匹配：
   ^/(post|publication|project|author)/([^/]+)/?$
3. 命中 → 进入渲染流程
4. 未命中 → return fetch(request)  // 透传 Cloudflare Pages
```

---

## 四、内容获取层

### 4.1 数据源

```
GitHub Raw API:
GET https://raw.githubusercontent.com/{owner}/{repo}/{branch}/content/{type}/{slug}/index.md

示例:
https://raw.githubusercontent.com/Boooil/VISTA-Research-Group/main/content/publication/DDE-Net/index.md
```

- **优点**：CMS 提交 = GitHub push = Raw API 立即可用（秒级延迟）
- **鉴权**：公开仓库无需 token
- **CDN**：raw.githubusercontent.com 有全球 CDN 加速

### 4.2 Slug → 文件路径映射

| 页面类型 | URL 路径 | GitHub 文件路径 | 说明 |
|:---------|:---------|:----------------|:-----|
| Post | `/post/2026-06-10-my-post/` | `content/post/2026-06-10-my-post/index.md` | 日期前缀 slug |
| Publication | `/publication/DDE-Net/` | `content/publication/DDE-Net/index.md` | 纯 slug |
| Project | `/project/my-project/` | `content/project/my-project/index.md` | 纯 slug |
| Author | `/author/WangBoyu/` | `content/authors/WangBoyu/_index.md` | pinyin slug |

### 4.3 缓存策略

```
┌─────────────────────────────────────────────────────┐
│  层级 1: Worker Cache API (边缘缓存)                  │
│  • 缓存渲染后的完整 HTML                              │
│  • TTL: 300s (stale-while-revalidate)                │
│  • Key: 完整 URL                                     │
├─────────────────────────────────────────────────────┤
│  层级 2: GitHub Raw (传输层缓存)                      │
│  • 使用 cf: { cacheTtl: 30 } 指令                    │
│  • 30s 内重复请求命中 Cloudflare CDN 边缘缓存          │
│  • 不消耗 Worker 子请求额度                           │
├─────────────────────────────────────────────────────┤
│  层级 3: KV (作者名映射)                              │
│  • 预填充的 author pinyin → display name 映射表       │
│  • TTL: 24h，通过 GitHub Webhook 主动刷新              │
└─────────────────────────────────────────────────────┘
```

---

## 五、模板渲染引擎设计

### 5.1 核心思路：预提取 Shell + 动态填充 Content

Hugo 渲染的完整页面拆分为三部分：

```
┌──────────────────────────────────────┐
│  Shell Head                          │
│  <!DOCTYPE html> ... <body>          │
│  <nav> 导航栏 </nav>                  │
│  <aside> 侧边栏 </aside>              │
│  <article>                           │
├──────────────────────────────────────┤
│  Content Slot (Worker 动态填充)       │
│  - 标题 + 作者列表 + 日期              │
│  - 摘要框                             │
│  - 封面图                             │
│  - 正文 (Markdown → HTML)            │
│  - 标签 / 链接列表 / 页脚作者卡片       │
├──────────────────────────────────────┤
│  Shell Foot                          │
│  </article>                          │
│  <footer> 页脚 </footer>             │
│  <script> JS bundles </script>       │
│  </body></html>                      │
└──────────────────────────────────────┘
```

**Shell 模板来源**：从 Hugo 构建输出中提取现有页面的 HTML 结构，将内容区域替换为占位符。Hugo 全量构建完成后，通过 GitHub Action 将新 Shell 上传至 Cloudflare KV，Worker 启动时加载。

### 5.2 Shell 模板分类

针对四种页面类型，需要 4 个 Shell：

| Shell | 来源页面 | 内容区域特殊元素 |
|:------|:---------|:-----------------|
| `shell-post` | `/post/` 页面 | 日期格式、categories 标签、字体大小切换 (部分页面) |
| `shell-publication` | `/publication/` 页面 | publication_types 映射、发表期刊/会议、宽度切换 |
| `shell-project` | `/project/` 页面 | 链接列表、外部 URL |
| `shell-author` | `/author/` 页面 | 头像、角色标签、社交链接图标、研究方向 |

**Shell 维护方式**：

- Shell 模板存储在 **Cloudflare KV**（`SHELLS` namespace），由 Hugo 构建后的 GitHub Action 自动更新
- Worker 首次请求时从 KV 加载并缓存在内存中，避免重复 KV 读取

### 5.3 Frontmatter 解析

Worker 需要解析 `index.md` 的 YAML frontmatter：

```text
输入: "---\ntitle: xxx\nauthors: [...]\ndate: 2024-08-11\n---\n## Content"
输出: { frontmatter: {...}, body: "## Content" }
```

**实现方案**：手写简化版 YAML 解析器（~150 行），只处理当前 frontmatter 中出现的字段类型：

- string, integer, boolean, date
- array (单层)
- object (单层嵌套，如 `image: { filename: ..., caption: ... }`)
- 多行文本 (YAML `|` / `>` )

无需完整 YAML 规范支持（如锚点、引用、多级嵌套等）。

### 5.4 Markdown → HTML

使用 **`marked`** 库（~20KB gzipped）：

```javascript
import { marked } from 'marked';
marked.use({ gfm: true, breaks: false });
const html = marked.parse(markdownBody);
```

- 支持 GFM 表格、代码块、引用块
- 支持 Hugo goldmark 的 `unsafe: true` 等价行为（内联 HTML 透传）
- 数学公式 `$$...$$` 和 `\(...\)` 保留原文，由前端 KaTeX/MathJax 渲染

### 5.5 作者名解析（关键环节）

Hugo 中 `.GetTerms "authors"` 将 pinyin 标识映射为中文显示名。Worker 使用 **KV** 实现等价功能：

**KV 数据结构**：

```
Key:   "author:WangBoyu"
Value: {
  "title": "王博宇",
  "pinyin": "WangBoyu",
  "avatar": "avatar.jpg",
  "role": "在读博士"
}
```

**查找逻辑**：

1. 从 frontmatter 解析 `authors` 数组（如 `["WangBoyu", "External Name"]`）
2. 批量查询 KV：`KV.get("author:WangBoyu", "json")`
3. 命中 KV → 显示中文名 + 添加 `/author/xxx/` 链接（团队成员）
4. 未命中 → 直接显示输入值，无链接（外部作者）

**KV 填充方式**：

- **批量填充**：Hugo 构建时扫描 `content/authors/` 目录，提取每个 `_index.md` 的 frontmatter → 写入 KV
- **触发时机**：每次 Hugo 全量构建完成 → GitHub Action → `wrangler kv:bulk put`
- **主动刷新**：GitHub Webhook 触发 `/__purge` 端点时，检查作者目录是否有变更，有则更新 KV

### 5.6 图片处理

Hugo 的 `.Fit` / `.Process` 无法在 Worker 中复制。替代方案：

| 图片类型 | 处理方式 |
|:---------|:---------|
| **封面图 (featured)** | 使用 GitHub Raw 原始 URL。如存在预构建的多尺寸 WebP，使用 `srcset` 引用 |
| **正文内图片** | `./subfolder/img.png` → 转为 GitHub Raw 绝对路径 |
| **头像 (avatar)** | KV 中存储文件名，拼接 GitHub Raw URL |
| **Uploads 图片** | CMS 上传至 `static/uploads/` → 原路径走 Pages 直接提供 |

**正文图片路径转换示例**：

```
Markdown: ![](./subfolder/media/img.png)
    ↓ (拼接当前页面的 GitHub 路径)
GitHub Raw: https://raw.githubusercontent.com/Boooil/VISTA-Research-Group/main/content/post/<slug>/subfolder/media/img.png
```

### 5.7 publication_types 中文化映射

```javascript
const PUB_TYPE_LABELS = {
  'paper-conference': '会议论文',
  'article-journal': '期刊论文',
  'patent': '专利',
  'software': '软件著作权',
  'report': '技术报告',
  'standard': '标准规范',
  'book': '专著',
  'thesis': '学位论文'
};
```

### 5.8 阅读时间计算

```javascript
function calcReadingTime(text) {
  const wordsPerMinute = 200;
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}
```

> **注意**：中文字符无空格分隔，实际可用 `text.replace(/\s+/g, '').length / 400` 作为估算或直接使用 Hugo 构建时预计算的 `.ReadingTime` 值。

---

## 六、Publication Shell 详细结构

以 publication 类型为例，展示 Shell 模板的 Content Slot 设计：

```html
<div class="mx-auto flex max-w-screen-xl">
  <!-- ===== 侧边栏 (固定结构，从 Hugo 构建提取) ===== -->
  <aside><!-- 菜单树，固定 --></aside>

  <article class="w-full break-words flex ... pb-8">
    <main class="w-full min-w-0 max-w-6xl px-6 pt-4 md:px-12">

      <!-- ===== 面包屑导航 ===== -->
      {{BREADCRUMB}}

      <!-- ===== 标题 ===== -->
      <h1 class="mt-2 text-4xl font-bold ...">{{TITLE}}</h1>

      <!-- ===== 摘要 ===== -->
      {{SUMMARY}}

      <!-- ===== 元数据行 ===== -->
      <div class="mt-4 mb-16">
        <div class="text-gray-500 text-sm flex ...">
          {{DATE_DISPLAY}}
          {{AUTHORS_HTML}}
          {{READING_TIME}}
        </div>
        <div class="mt-3">{{LINKS_HTML}}</div>
      </div>

      <!-- ===== 封面图 ===== -->
      {{FEATURED_IMAGE}}

      <!-- ===== 宽度切换 + 正文 ===== -->
      <div x-data="{ widthMode: 'compact', ... }" :style="widthStyle" ...>
        <!-- 宽度切换条 -->
        <div class="flex items-center gap-2 justify-end mb-4">...</div>

        <!-- ===== 论文元数据 (publication 专属) ===== -->
        {{PUBLICATION_METADATA}}
        <!-- 包含: publication_type 标签、期刊/会议名、event 信息 -->

        <!-- ===== Markdown 正文 ===== -->
        <div class="prose prose-slate lg:prose-xl dark:prose-invert max-w-none">
          {{BODY_HTML}}
        </div>
      </div>

      <!-- ===== 最后编辑 + 页脚 ===== -->
      {{LAST_EDITED}}
      {{PAGE_FOOTER}}
      <!-- 包含: tags, 分享按钮, 作者卡片, 相关文章, 评论 -->

    </main>
  </article>
</div>
```

### Post / Project / Author Shell 差异

| 组件 | Post | Publication | Project | Author |
|:-----|:----:|:-----------:|:-------:|:------:|
| 日期显示 | YYYY年MM月DD日 | 仅年份 | 可选 | 无 |
| publication metadata | ✗ | ✓ | ✗ | ✗ |
| 宽度/字体切换 | 字体大小 | 宽度 | 字体大小 | 无 |
| 封面图 | ✓ | ✓ | ✓ | ✗ |
| 头像 + 个人信息 | ✗ | ✗ | ✗ | ✓ |
| 社交链接 | ✗ | ✗ | ✗ | ✓ |
| 外部链接列表 | ✓ | ✓ | ✓ | ✗ |
| 作者卡片 (页脚) | ✓ | ✓ | ✓ | ✗ |

---

## 七、Worker 完整请求流

```
请求到达 Worker
       │
       ▼
┌──────────────┐
│ 1. 解析 URL   │ → type (post/pub/project/author) + slug
└──────┬───────┘
       ▼
┌──────────────┐
│ 2. 查 Cache   │ → Cache API 命中 → 直接返回 HTML (热路径 < 5ms)
└──────┬───────┘
       ▼ (miss)
┌──────────────┐     ┌──────────────────────────┐
│ 3. 构建 Raw   │────▶│ raw.githubusercontent.com │
│    URL        │     │ /.../content/.../index.md │
└──────┬───────┘     └──────────────────────────┘
       ▼                        │
┌──────────────┐                │ (200 OK)
│ 4. 404 处理   │←───────────────
│ → 透传 Pages  │
└──────┬───────┘
       ▼ (200 OK)
┌──────────────┐
│ 5. 解析       │ → YAML frontmatter + Markdown body 分离
│    frontmatter│
└──────┬───────┘
       ▼
┌──────────────┐
│ 6. 加载 Shell │ → 从 KV/memory 获取对应类型的 HTML shell
└──────┬───────┘
       ▼
┌──────────────┐
│ 7. 解析作者   │ → 批量查 KV author:* → display name 映射
└──────┬───────┘
       ▼
┌──────────────┐
│ 8. 渲染 MD    │ → marked.parse(body) → HTML 字符串
└──────┬───────┘
       ▼
┌──────────────┐
│ 9. 拼装 HTML  │ → 填充 shell 的 {{SLOT}} 变量
└──────┬───────┘
       ▼
┌──────────────┐
│ 10. 存 Cache  │ → ctx.waitUntil(cache.put(...))
│     + 返回     │ → Response(html, { headers })
└──────────────┘
```

---

## 八、缓存失效机制

### 8.1 被动失效（TTL 自动过期）

| 缓存层 | TTL | 说明 |
|:-------|:----|:-----|
| Worker Cache API | 300s | 完整 HTML 页面缓存 |
| GitHub Raw `cf.cacheTtl` | 30s | markdown 源文件传输缓存 |
| KV author 映射 | 24h | 不设 TTL，主动更新 |

### 8.2 主动失效（Webhook 触发）

```
CMS 提交 → GitHub push → GitHub Webhook
                              │
                              ▼
                    Worker 端点: POST /__purge
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
            删除 Cache API        检查 author 变更
            (指定 page URL)       → 有变更则更新 KV
```

**实现细节**：

1. Worker 暴露 `POST /__purge` 端点
2. 请求体：`{ path: "/post/xxx/" }`
3. 使用 GitHub Webhook secret 验证请求来源
4. 删除对应 Cache 条目，可选检查并更新 author KV

### 8.3 定时全量刷新（Cron Trigger）

- 周期：每 24 小时
- 任务：重新扫描 `content/authors/` → 批量刷新 KV 映射
- 可选：预热高频访问页面缓存

---

## 九、Shell 模板维护流程

### 问题

Shell 包含导航栏、侧边栏、页脚等 HTML 结构，这些会随 HugoBlox 主题升级或网站配置变更而变化。Worker 中的 Shell 模板必须与 Pages 构建输出保持同步。

### 解决方案

```
Hugo 全量构建
      │
      ▼
public/ 目录 (完整的静态网站)
      │
      ▼
extract-shells.js (提取脚本)
      │  从 public/ 中选取代表性页面
      │  提取 HTML → 替换内容区域为占位符
      │  输出 4 个 shell-*.html 文件
      ▼
GitHub Action (构建后步骤)
      │  wrangler kv:key put --binding=SHELLS "shell:post" --path=shells/shell-post.html
      │  wrangler kv:key put --binding=SHELLS "shell:publication" --path=...
      │  wrangler kv:key put --binding=SHELLS "shell:project" --path=...
      │  wrangler kv:key put --binding=SHELLS "shell:author" --path=...
      ▼
Cloudflare KV (SHELLS namespace)
      │
      ▼
Worker 下次请求时从 KV 加载最新 Shell (缓存到内存)
```

**关键保证**：Shell 模板仅在 Hugo 构建完成后更新，与 Pages 上线的静态资源（CSS/JS）来自同一次构建，确保模板引用的 CSS 类名和 JS bundle 路径一致。

---

## 十、性能估算

| 场景 | 预计延迟 | 说明 |
|:-----|:---------|:-----|
| Cache 命中（热路径） | **< 5ms** | 直接返回缓存 HTML |
| 冷路径（GitHub Raw + 渲染） | **100-300ms** | 首次访问或缓存过期后 |
| 首次加载（无任何缓存） | **200-500ms** | Worker 冷启动 + 全流程 |
| 现状（Hugo Pages 首次部署） | **40-60s** | 对比基准 |

**Cloudflare Workers 免费额度评估**：

| 项目 | 免费额度 | 预估使用 | 状态 |
|:-----|:---------|:---------|:-----|
| 请求数 | 10 万/天 | < 5000/天 | ✅ 充足 |
| CPU 时间 | 10ms/请求 | < 2ms (热路径) | ✅ 充足 |
| KV 读取 | 10 万/天 | < 100/天 | ✅ 充足 |
| KV 写入 | 1000/天 | ~10/天 | ✅ 充足 |

---

## 十一、与现有架构集成

### 当前架构

```
Cloudflare Pages (vista-research-group.pages.dev)
├── /static/admin/* → CMS 后台 (Decap CMS)
└── /* → Hugo 生成的静态页面
```

### 新增后

```
Worker Route: vista-research-group.pages.dev/*
└── Worker (vista-edge-renderer)
    ├── /post/*          → 动态渲染
    ├── /publication/*   → 动态渲染
    ├── /project/*       → 动态渲染
    ├── /author/*        → 动态渲染
    └── /*              → fetch(request) 透传 Cloudflare Pages
```

### 注意事项

- **Pages Functions vs 独立 Worker**：Cloudflare Pages Functions 有 100ms CPU 时间限制，无法用于外部 API 调用场景。必须使用**独立 Worker + Worker Routes**。
- **Worker Routes 对自定义域名生效**：在 Cloudflare Dashboard 中为 Pages 项目的自定义域名添加 Worker Route。
- **OAuth Worker 不受影响**：现有的 `cloudflare-oauth-worker.js` 部署在独立子域名 `vista-cms-oauth.boil99.workers.dev`，与边缘渲染 Worker 互不干扰。

---

## 十二、实施计划

### Phase 1：核心可用（预计 3-5 天）

| # | 任务 | 产出 |
|:--|:-----|:-----|
| 1.1 | Worker 项目初始化 | `wrangler.toml`，基础路由框架，日志 |
| 1.2 | GitHub Raw 内容获取 + 缓存 | 能从 Raw API 获取 `.md` 文件并缓存 |
| 1.3 | Frontmatter 解析器 | 手写轻型 YAML 解析器 |
| 1.4 | Markdown 渲染集成 (`marked`) | `## Hello` → `<h2>Hello</h2>` |
| 1.5 | Publication Shell 模板 | 从 Hugo 输出提取 + 硬编码第一版 |
| 1.6 | 作者名 KV 映射 (手动填充) | 填充 8 位现有团队成员 |
| 1.7 | Publication 完整渲染链路 | `/publication/xxx/` → 完整 HTML |
| 1.8 | 路由配置 + 部署上线 | 挂载域名，验证透传规则 |

**Phase 1 验收标准**：访问 `/publication/DDE-Net/` 返回正确渲染的页面，外观与 Hugo 构建版本一致。

### Phase 2：覆盖其他类型（预计 2-3 天）

| # | 任务 | 产出 |
|:--|:-----|:-----|
| 2.1 | Post Shell + 渲染 | `/post/xxx/` 动态渲染 |
| 2.2 | Project Shell + 渲染 | `/project/xxx/` 动态渲染 |
| 2.3 | Author Shell + 渲染 | `/author/xxx/` 动态渲染 |
| 2.4 | 图片路径转换 | 相对路径 → GitHub Raw 绝对路径 |
| 2.5 | publication_types 中文化 | 论文类型标签正确显示 |

### Phase 3：生产化（预计 2-3 天）

| # | 任务 | 产出 |
|:--|:-----|:-----|
| 3.1 | Shell 自动提取脚本 | `scripts/extract-shells.js` |
| 3.2 | GitHub Action 集成 | 构建后自动上传 Shell + KV |
| 3.3 | Webhook 缓存失效 | `/__purge` 端点 + GitHub Webhook |
| 3.4 | 定时 KV 刷新 (Cron Trigger) | 每 24h 同步 author 映射 |
| 3.5 | 监控 + 错误日志 | Worker 异常告警、渲染错误统计 |
| 3.6 | 404 优雅回退 | GitHub Raw 404 → 自动透传 Pages |

### Phase 4：1:1 补齐计划 — 消除 Worker 与 Hugo 渲染差异

> **目标**：Worker 渲染的每个页面区域与 Hugo 构建版本完全一致，用户无法区分。

#### 4.1 差异总览与补齐映射

```
页面从上到下，逐区域对齐：

┌──────────────────────────────────────────────────────────────────┐
│ 区域                    Hugo 行为              Worker 现状       │
│                         (40-60s 构建)          (秒级渲染)        │
├──────────────────────────────────────────────────────────────────┤
│ A. <head> meta / SEO    完整 og / JSON-LD      基本 og 标签      │
│ B. 导航栏                动态菜单 + 语言选择     Shell 模板一致    │
│ C. 侧边栏                .Fragments TOC          Shell 模板一致    │
│ D. 面包屑                .Ancestors 自动回溯    简化路径 ← 需补齐  │
│ E. 标题 / 摘要           直接渲染                100% 一致         │
│ F. 作者列表              .GetTerms 解析          KV 映射 ← 待验证  │
│ G. 日期 + 阅读时间        Hugo .ReadingTime      自算 ← 需对齐     │
│ H. author_notes 提示     Alpine.js tooltip       Shell 模板一致    │
│ I. 封面图                .Fit + srcset + WebP    原始 URL ← 需补齐 │
│ J. 宽度/字体切换          Alpine.js               Shell 模板一致    │
│ K. publication metadata  类型+期刊+event         基本渲染 ← 需补全 │
│ L. Markdown 正文         goldmark 渲染            marked 渲染 ← 待验证│
│ M. 正文内图片            相对路径 + Hugo 处理      转 Raw URL ← 需补齐│
│ N. 数学公式              goldmark passthrough    保留原文 → 一致   │
│ O. 外部链接按钮           build_links 聚合        仅显式 links ← 需补齐│
│ P. 标签列表              直接渲染                100% 一致         │
│ Q. 分享按钮              page_sharer             按需复刻 ← 需补齐 │
│ R. 页脚作者卡片           .GetTerms + 头像+社交    KV 数据 ← 需补齐 │
│ S. 相关文章              Hugo related            暂不支持 ← 需补齐 │
│ T. 评论 (giscus)         模板统一                 Shell 模板一致    │
│ U. 最后编辑时间           Git .Lastmod            date 降级 ← 需补齐│
│ V. 页脚                  固定 HTML                Shell 模板一致    │
│ W. JSON-LD 结构化数据     自动生成                暂不支持 ← 需补齐 │
└──────────────────────────────────────────────────────────────────┘
```

#### 4.2 逐项补齐方案

| # | 区域 | 差异描述 | 补齐方案 | 工作量 | 优先级 |
|:--|:-----|:---------|:---------|:------|:------|
| D | 面包屑 | 缺少 `.Ancestors` 自动层级 | Worker 根据 URL 路径直接构造：`首页 > [section名] > 当前页` | 小 | P2 |
| F | 作者列表 | 新团队成员 KV 可能未同步 | 新增 Webhook 触发即时刷新 KV；Worker 运行时 fallback 到 GitHub Raw 拉取 author `_index.md` | 中 | P1 |
| G | 阅读时间 | Hugo 按英文分词 vs Worker 自算 | 中文场景统一用 `正文字符数 ÷ 400`，英文用 `单词数 ÷ 200` | 小 | P2 |
| I | 封面图 | 无 WebP 转换、无 srcset、无尺寸 | **方案**：Hugo 构建时预生成多尺寸 WebP → 存入 R2，同时生成 manifest JSON。Worker 根据 manifest 构造 `<img srcset="...">` | 中 | P1 |
| K | pub metadata | 缺少 event 信息、地址等 | 补全模板渲染：`publication`、`publication_types`、`event`、`location` | 小 | P1 |
| L | 正文渲染 | goldmark vs marked 差异 | Phase 1 逐页对比验证；如有差异，用 marked 自定义 renderer 修正 | 中 | P1 |
| M | 正文图片 | 相对路径 vs 绝对路径 | Worker 解析 Markdown 中的 `](./path)` → 拼接 GitHub Raw 绝对路径。Hugo 构建时预生成正文图片的 WebP + 尺寸数据到 manifest | 中 | P1 |
| O | 链接按钮 | 缺 `build_links` 聚合（PDF/BibTeX/DOI 自动检测） | Worker 实现简化版：检查 `links` frontmatter + 检测同目录下的 `cite.bib` / `*.pdf` 存在性（通过 GitHub API head 请求） | 中 | P2 |
| Q | 分享按钮 | 缺 page_sharer | 从 Shell 模板中保留分享按钮 HTML（其为固定结构），Worker 只需填入当前页面 URL | 小 | P2 |
| R | 作者卡片 | 缺头像、简介、社交链接 | KV 已存储 author 完整数据 → Worker 渲染作者卡片 HTML。Phase 1 手动填充，Phase 3 自动同步 | 中 | P1 |
| S | 相关文章 | 缺 related content | Worker 基于 tags/categories 交集计算相关度 → 渲染前 3 篇。或降级为：不渲染，等待 Pages 版本接管 | 大 | P3 |
| U | 最后编辑 | 缺 Git Lastmod | Worker 取 frontmatter `date` 作为发布日期；lastmod 通过 GitHub API 获取文件最后 commit 时间（可缓存） | 中 | P2 |
| W | JSON-LD | 缺结构化数据 | Worker 根据页面类型构造 JSON-LD（Article / Person），字段从 frontmatter + KV 映射 | 中 | P2 |

#### 4.3 优先级说明

| 优先级 | 含义 | 涉及区域 |
|:------:|:-----|:---------|
| **P1** | 用户明显可见，Phase 1-2 必须完成 | F, I, K, L, M, R |
| **P2** | 用户可感知但影响小，Phase 3 完成 | D, G, O, Q, U, W |
| **P3** | 锦上添花，可长期降级给 Pages 版本 | S |

#### 4.4 1:1 验证方法

```
每次 Phase 完成后执行：

1. 选取 3 个代表性页面：
   - 复杂正文（如 benchmark 文章，含表格+图片+公式）
   - 多作者论文（含团队成员 + 外部作者）
   - 含封面图 + 外部链接

2. 分别抓取 Worker 版本和 Pages 版本的 HTML

3. 用视觉 diff 工具对比：
   - Playwright 截图对比（像素级）
   - HTML 结构 diff（忽略动态属性如 nonce/timestamp）
   - 关键文本内容 MD5 校验

4. 差异项 → 记录 issue → 下一 Phase 修复
```

---

## 十三、方案 A 与 Hugo 的关系

### 13.1 直接回答：仍然紧密依赖 Hugo

方案 A **不是替代 Hugo**，而是 **在 Hugo 之前加了一层缓存穿透**。两者的分工如下：

```
              ┌─────────────────────────────────────┐
              │           Hugo (持续运行)             │
              │                                     │
              │  产出：                              │
              │  • Shell 模板 (供 Worker 使用)        │
              │  • CSS / JS / 字体 (供 Worker 引用)    │
              │  • 首页 / 列表页 / 分类页              │
              │  • 图片 WebP 变体 (供 Worker 引用)     │
              │  • 作者 KV 数据 (供 Worker 查询)       │
              │  • RSS / Sitemap / JSON-LD           │
              └─────────────────────────────────────┘
                              │
                              ▼
              ┌─────────────────────────────────────┐
              │     Cloudflare Pages (静态存储)       │
              │     • 全站静态文件                     │
              │     • 作为 Worker 的 fallback          │
              └─────────────────────────────────────┘
                              │
                              ▼
              ┌─────────────────────────────────────┐
              │     Worker (边缘渲染层)               │
              │                                     │
              │  拦截 /post/* /publication/* 等       │
              │  ├─ 从 GitHub Raw 取最新 .md          │
              │  ├─ 用 Hugo 产出的 Shell 模板包裹      │
              │  ├─ 引用 Hugo 产出的 CSS/JS            │
              │  ├─ 查询 Hugo 产出的作者 KV 映射        │
              │  └─ 使用 Hugo 预生成的图片 WebP         │
              │                                     │
              │  其他路径透传给 Pages                  │
              └─────────────────────────────────────┘
```

**Worker 自身不产出任何静态资源** — 所有 CSS、JS、字体、图片处理都来自 Hugo 构建。

### 13.2 依赖关系清单

| Hugo 产出 | Worker 如何使用 | 如果 Hugo 停了 |
|:----------|:----------------|:---------------|
| Shell 模板 HTML | 包裹 Worker 渲染的内容 | 模板不再更新（主题升级后可能错乱） |
| CSS (Tailwind) | `<link>` 引用 Pages URL | 现有 CSS 继续工作，新样式不生效 |
| JS bundles | `<script>` 引用 Pages URL | 交互功能继续工作 |
| 字体 | `@font-face` 引用 Pages URL | 字体正常 |
| 首页 / 列表页 | Worker 透传给 Pages | 首页/列表页无法访问（除非 Worker 降级渲染） |
| 作者 KV 数据 | Worker 查询作者映射 | 新团队成员无法解析，旧映射可用 |
| 图片 WebP 变体 | Worker 引用 R2/Pages URL | 回退到 GitHub Raw 原图 |
| RSS / Sitemap | 由 Pages 直接提供 | 无法更新 |
| 图片处理 manifest | Worker 构造 srcset | 回退到单张原图 |

### 13.3 能否去掉 Hugo？

**理论上可以，但不建议**。需要：

1. 在 Worker 中实现列表页渲染（翻页、过滤、排序） — **工作量大**
2. 在 Worker 中实现首页 block 渲染（hero / features / collections） — **极度复杂**
3. 自建 CSS/JS 构建流水线 — **维护成本高**
4. 自建图片处理流水线 — **需要额外服务**

**结论**：Hugo + Worker 是务实的分工 — Hugo 负责"重活儿"（整站构建、资源处理），Worker 负责"快活儿"（内容页秒级更新）。两者互补，不互斥。

### 13.4 双重渲染窗口

一个重要的设计细节：**用户看到的内容在 40-60s 内来自 Worker，之后自动切换到 Pages 版本**。

```
t=0    CMS 提交
       │
t=1s   Worker 缓存被清除（Webhook）
       用户访问 → Worker 动态渲染（功能 90-95%）
       │
t=40s  Hugo 构建完成
       │
t=60s  Cloudflare Pages 部署完成
       用户访问 → Pages 返回完整 Hugo 版本（功能 100%）
       Worker Cache 也在 300s 后自动过期
```

这个双重路径意味着：**即便 Worker 渲染有微小差异，用户只在新内容发布后的第一分钟内看到它**。之后自动回到 100% 准确的 Hugo 版本。

---

## 十四、备选简化方案

如果 Phase 1 工作量偏大，可采用**最小可行版本**：

> 只处理 **Publication 类型**（用户反馈的核心痛点），Post / Project / Author 继续走 Pages 构建。

优势：

- 只需 1 个 Shell 模板（Publication）
- 只需 1 种页面渲染逻辑
- **1-2 天可上线验证**效果
- 后续逐步扩展到其他类型

---

## 十五、风险与应对

| 风险 | 影响 | 缓解措施 |
|:-----|:-----|:---------|
| GitHub Raw API 限流 (60 req/h 无鉴权) | 内容获取失败 | Worker Cache + GitHub Raw cacheTtl 大幅减少实际请求；必要时增加 GitHub token 提升限额至 5000 req/h |
| Shell 模板与 Pages CSS/JS 版本不一致 | 页面样式错乱 | Shell 随 Hugo 构建自动更新；PR 合并触发同步 |
| 作者 KV 映射过期 | 新团队成员不显示中文名 | 24h Cron 自动刷新 + Webhook 触发即时更新 |
| Markdown 渲染差异 | 正文排版异常 | `marked` 配置对齐 goldmark 行为 (unsafe HTML, GFM 表格)；Phase 1 逐页对比验证 |
| 侧边栏菜单变更 | 菜单项不同步 | 菜单项极少变更；变更后随 Shell 一起更新 |
| Worker 冷启动 > 500ms | 延迟超标 | 热路径走 Cache（< 5ms）；冷路径在可接受范围 |
| Pages 构建失败 / 暂停 | 静态资源不更新 | Worker 独立运行，不受 Pages 构建状态影响 |

---

## 十六、依赖与前置条件

| 依赖项 | 当前状态 | 操作 |
|:-------|:---------|:-----|
| Cloudflare Workers 已开通 | ✅ 已在使用 (OAuth Worker) | 新建 Worker |
| 仓库为 GitHub 公开 | ✅ 公开 | 无需额外配置 |
| Cloudflare Pages 自定义域名 | ✅ `vista-research-group.pages.dev` | 添加 Worker Route |
| wrangler CLI | 需确认 | `npx wrangler login` |
| Cloudflare KV namespace | 需创建 | `wrangler kv:namespace create` |

---

> **下一步**：确认是否按 Phase 1 开始实现，或先按简化方案仅覆盖 Publication 类型。

---

## 十七、Phase 3 修复记录（2026-06-16）

部署后发现两个关键缺陷，已修复：

### 17.1 详情页全部 404 — slug ≠ 文件夹名

**根因**：permalink 为 `:slug` 且内容无显式 `slug:`，Hugo 用「标题 urlize 后」作为 URL（如 `/publication/trvp-transformer-vae-framework-.../`），与源文件夹名（`TRVP`）不一致。原渲染器假设 `URL slug == 文件夹名`，直接拼 `content/publication/<urlSlug>/index.md` → GitHub Raw 404 → 所有 publication/post/project 详情页 404。author 更甚：很多 `/author/*` 是 taxonomy term，无源文件夹。

**修复**：Hugo 构建时生成 `slug-manifest.json`（URL slug → 文件夹名映射）：

- `config/_default/hugo.yaml`：新增 `SLUGMANIFEST` outputFormat + `outputs.home`
- `layouts/index.slugmanifest.json`：遍历 `RegularPages` 与 author terms 生成映射
- `functions/_lib/slug-map.js`（与 `edge-renderer/src/slug-map.js` 同源）：`resolveFolder(type, urlSlug, origin)` 加载 manifest 并反查文件夹名；内存缓存 5 分钟
- 渲染器 `render*` 改为接收 `{ slug, folder }`：`contentDir` 用 `folder`，`canonicalUrl` 用 `slug`
- 路由处理在渲染前先 `resolveFolder`，未命中（含 taxonomy term）直接回退 Pages

### 17.2 回退逻辑自我递归

原 Function 渲染失败时 `fetch(new URL(url.pathname, url.origin))` 会再次命中自己 → 仍 404，静态页永远取不到。修复：Pages Function 改用 `next()` 取静态资源；独立 Worker 改用 `fetch(request)` 透传原始请求。

### 17.3 GitHub Action 构建失败

`.github/workflows/sync-kv.yml` 中 `hugo-version: 'extended'` 非法（应为版本号），导致 `Unable to find a compatible Hugo release asset`。修正为 `hugo-version: '0.148.2'` + `extended: true`（对齐 `hugo.yaml` 的 `module.hugoVersion.min`）。

> **注意**：`slug-manifest.json` 随每次 Hugo 全量构建更新（40-60s）。新发布内容在 Pages 构建完成前，其 slug 尚不在 manifest 中 → Function 回退 Pages（此时 Pages 也在构建）。这与设计的「双重渲染窗口」一致：新内容首分钟可能短暂走 Pages 旧版本，构建完成后即可被 Worker 即时渲染。
