# CLAUDE.md — VISTA Research Group 网站

Hugo + HugoBlox 静态站,部署在 Cloudflare Pages,前置一层 **Cloudflare Pages Functions** 做内容详情页的边缘动态渲染(CMS 提交后秒级可见)。CMS 是 Decap CMS(GitHub backend,直接提交 `main`)。

## 架构速览

```
CMS(Decap) ──push──▶ GitHub main ──┬──▶ Cloudflare Pages 全量 Hugo 构建(40-60s,首页/列表/静态资源)
                                    │
                                    └──push webhook──▶ Pages Functions /__purge(秒级失效边缘缓存)
浏览器 ──▶ Pages Functions(functions/[[path]].js)
            ├─ /publication|post|project|author/<slug>/ → 边缘动态渲染(GitHub Raw + marked)
            └─ 其他 → next() 透传 Pages 静态资源
```

## 关键约束(已验证,改动前务必遵守)

### 1. 线上运行时是 Pages Functions,不是独立 Worker
- 线上由 `functions/[[path]].js` + `functions/_lib/*` 提供服务(`/__health` 返回 `runtime: pages-function`)。
- `edge-renderer/src/*` 是**未挂路由的独立 Worker 副本**,与 `functions/_lib/*` **保持同源**:改渲染逻辑要两边同步。差异仅在入口——Function 用 `next()` 回退,Worker 用 `fetch(request)`。
- 改"线上行为"必须改 `functions/`。

### 2. URL slug 来自 `slug` frontmatter 字段,≠ 内容文件夹名
- Hugo permalink 是 `:slug`,**优先用 frontmatter `slug:` 字段**(无则才回退 urlize(title))。所有内容都带 `slug:`,所以 **URL = slug 字段值**,与源文件夹名(`TRVP`、`WangBoyu_patent2`)无关。
- slug 字段值各篇唯一 → **根除了"两篇同 title 撞同一 URL"的重名 bug**(早期 URL=urlize(title) 时会撞)。
- 解析靠 `slug-manifest.json`(Hugo 构建产出,`layouts/index.slugmanifest.json`,用 `.RelPermalink` 生成)做 `slug→folder`;`resolveFolder` 未命中再查 KV `slugmap:*`(新文章兜底)。
- 改 URL/slug 逻辑前,先理解 slug≠folder 这层映射,别假设 slug==folder。
- Hugo 对 `slug:` 值**不 urlize**(原样保留大小写/下划线),所以 slug 必须写成规范小写连字符。

### 3. 不要在 shell 里硬编码带 hash 的 CSS/JS 路径
- `/css/_entry.<hash>.css` 的 hash 是构建指纹,每次构建漂移,硬编码必 404(`MIME type text/html`)。
- 已改为运行时从线上 Pages 页面(`/publication/`)抓 `<head>` 注入(`functions/_lib/head-assets.js` 的 `getHeadAssets`),`__HEAD_ASSETS__` 占位符。别退回硬编码。

### 4. CMS 新建内容必须手填 `slug`(英文唯一短名)
- Decap `encoding: ascii` 会把纯中文 title 剥空 → 路径畸形 → GitHub 报 `malformed path component`。
- publication/project/post 都有必填 `slug` 字段,用自定义 `unique-slug` widget(`static/admin/slug-unique-widget.js`),pattern `^[a-z0-9][a-z0-9-]*$`。`slug:` 模板用 `{{fields.slug}}`。
- **`path:` 必须用 `{{slug}}/index`,不能用 `{{fields.slug}}/index`**:Decap 的 `path` 模板对 `{{fields.X}}` 解析不可靠(issue #4787/#4092),会解析成空 → `content/publication//index.md` → GitHub `malformed path component`。`{{fields.X}}` 只放 `slug:` 里(稳定),`path` 引用 `{{slug}}`。
- slug 字段同时决定 **URL** 和文件夹名;每篇必须唯一。新增内容文件 frontmatter 必须含 `slug`,否则 CMS 编辑会卡保存。
- **slug 撞名是 Decap page bundle 已知缺陷**(issue #7606):重复 slug 不报错也不覆盖,而生成 `index-1.md` → Hugo 不渲染(网站无)、CMS 却列出幽灵 entry。防护两层:① `unique-slug` widget 新建时查 GitHub API 实时拦截(API 失败则降级放行);② `.github/workflows/content-sanity.yml` 巡检 `content/**/index-[0-9]*.md` 残留并让构建失败。本地手写内容也要保证 slug 唯一。
- Decap 在浏览器缓存 config + 本地草稿:改 config 后需硬刷 `/admin/`;弹"加载本地备份"时别加载旧的坏草稿。

### 4b. 时区:CMS 本地时间 vs 构建机 UTC → 必须 `buildFuture: true`
- CMS 的 `date` 默认 `{{now}}` 按**浏览器本地时间**(北京 UTC+8)生成;Cloudflare Pages 构建机用 **UTC**。
- 中国时间下午(UTC 当天未到)发的文,`date` 会超前 UTC 一天,被 Hugo 默认判为"未来日期"**跳过**→ 详情页(边缘渲染,不查日期)可见,但列表页/sitemap(Hugo)缺失。
- `config/_default/hugo.yaml` 已设 `buildFuture: true` 根治。**实测 `timeZone: Asia/Shanghai` 无效**(Hugo 对纯日期 future 判定不吃 timeZone),别改回去。本站无定时发布需求。

### 4b-2. post 的 slug 日期前缀必须用 `{{fields.date | date('YYYY-MM-DD')}}`,不能用 `{{year}}-{{month}}-{{day}}`
- 内置 `{{year}}/{{month}}/{{day}}` 在线上 Decap 版本(未含 fix #7633)取的是**"打开新建表单那一刻"的时间**,不是 date 字段值。
- 后果:中国凌晨打开表单(本地已跨天但 date 字段/提交是另一天)→ 文件夹日期前缀比 date 字段落后/超前一天(实测 `date:2026-06-17` 却生成 `2026-06-16-xxx`)。
- 已改用 filter 语法 `{{fields.date | date('YYYY-MM-DD')}}`(commit #6690 的 filter 支持)直接从 date 字段取,文件夹日期 = 用户选的日期,与时区/表单打开时刻无关。别改回内置 tag。

### 4c. 列表页/首页是 Hugo 产物;列表页用"最新发布"横幅补实时入口
- 边缘渲染器**只完整接管详情页**;列表页 `/publication|post|project/`、首页、sitemap 仍是 Hugo 构建产物。
- 新文章详情页**秒级可见**;正式列表卡片要等 Hugo 构建(40-60s)。为补这段窗口,Worker 拦截三个列表页,在顶部注入"🆕 最新发布"横幅(`handleListPage` + `buildPendingBanner`),列出已发布但未进静态列表的条目链接(指向秒级可见的详情页)。
- 数据源:webhook 每次 push 把新内容 upsert 进 KV `pending:<type>`(`addPending`),**不按访客查 GitHub**(避开 60/h 限流)。构建追上后,列表页拦截发现该 slug 已在静态 HTML 中 → `removePending` 自清理,横幅自动消失。
- 横幅是**链接列表,非复刻卡片**(项目卡片依赖 Hugo 图片/term 管线,Worker 不复刻)。首页 block、author 列表不做。
- 排查"列表页缺文章"时:别凭单条 grep 下结论(易被 CDN 缓存/中文目录名误导),用唯一链接计数 + sitemap + 探针对照实验交叉印证。


### 5. 新文章 KV 映射用 `slug` 字段,不是 title
- webhook 的 `syncContentMapping`(`functions/[[path]].js`)写 KV slugmap 时,slug 来源是 `frontmatter.slug || frontmatter.pinyin || frontmatter.title`(优先 slug 字段,与 Hugo 的 URL 一致)。
- `urlizeTitle()`(`functions/_lib/slug-map.js`)对已规范的 slug 值是幂等 no-op;它仍存在是为兼容无 slug 字段的旧/author 内容。CMS pattern 强制小写连字符,保证 urlize 不改变 slug。
- 改 slug 逻辑后跑 `edge-renderer/test/urlize-test.js` 和 `slugmap-kv-test.js`。

### 6. Webhook purge 需要 `WEBHOOK_SECRET`
- `/__purge` 用 HMAC-SHA256 验签;Cloudflare Pages env 与 GitHub webhook secret 必须一致。
- 改 env 后需 Cloudflare **重新部署**才生效。

## 构建与测试

```bash
# Hugo 构建(产出 public/ + slug-manifest.json)
hugo --minify --gc --cleanDestinationDir --baseURL https://vista-research-group.pages.dev/

# 边缘渲染器测试(纯逻辑,Node 直接跑)
cd edge-renderer
node test/urlize-test.js        # urlize 与 Hugo 一致性
node test/slugmap-kv-test.js    # resolveFolder manifest + KV 兜底
node test/render-folder-test.js # slug→folder 解析 + 渲染
node test/head-assets-test.js   # CSS/JS 动态注入
node test/purge-test.js         # webhook payload 解析
node test/parse-test.js         # frontmatter 解析
```

## 部署

- **代码改动**(`functions/`):push main → Cloudflare Pages 自动部署。
- **`sync-kv` Action**(`.github/workflows/sync-kv.yml`):提取 shell + author 数据写 KV。仅当 push 命中 `content/authors/**`、`config/**`、`layouts/**` 等 paths 才触发;Hugo 版本固定 `0.148.2`;wrangler 用 `npx wrangler@4` + 空格式 KV 子命令(`kv key put` / `kv bulk put`)。
- CMS 配置(`static/admin/config.yml`)改动:部署后强刷 `/admin/` 才生效(Decap 缓存 config)。

## 设计文档

设计文档统一放至docs/下。

- `docs/edge-rendering-design.md` — 边缘渲染总体方案
- `docs/phase3-realtime-plan.md` — 实时性(purge + 新文章 KV 映射)方案与进度
