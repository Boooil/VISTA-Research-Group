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

### 2. URL slug ≠ 内容文件夹名(最易踩的坑)
- Hugo permalink 是 `:slug`,内容无显式 `slug:` frontmatter → **URL = urlize(title)**,与源文件夹名(`TRVP`、`WangBoyu_patent2`)无关。
- 解析靠 `slug-manifest.json`(Hugo 构建产出,`layouts/index.slugmanifest.json`)做 `urlSlug→folder`;`resolveFolder` 未命中再查 KV `slugmap:*`(新文章兜底)。
- 改 URL/slug 相关逻辑前,先理解这层映射,别假设 slug==folder。

### 3. 不要在 shell 里硬编码带 hash 的 CSS/JS 路径
- `/css/_entry.<hash>.css` 的 hash 是构建指纹,每次构建漂移,硬编码必 404(`MIME type text/html`)。
- 已改为运行时从线上 Pages 页面(`/publication/`)抓 `<head>` 注入(`functions/_lib/head-assets.js` 的 `getHeadAssets`),`__HEAD_ASSETS__` 占位符。别退回硬编码。

### 4. CMS 新建内容必须手填 `url_slug`,文件夹名不能依赖中文 title
- Decap `encoding: ascii` 会把纯中文 title 剥空 → 路径畸形 → GitHub 报 `malformed path component`。
- publication/project/post 的 `slug:` 用 `{{fields.url_slug}}`,`url_slug` 必填,pattern `^[A-Za-z0-9][A-Za-z0-9_-]*$`。
- **`path:` 必须用 `{{slug}}/index`,不能用 `{{fields.url_slug}}/index`**:Decap 的 `path` 模板对 `{{fields.X}}` 解析不可靠(issue #4787/#4092),会解析成空 → `content/publication//index.md` → GitHub `malformed path component`。`{{fields.X}}` 只放 `slug:` 里(稳定),`path` 引用 `{{slug}}`。
- 新增内容文件时,frontmatter 必须含 `url_slug`(值=文件夹名),否则 CMS 编辑会卡保存。
- `url_slug` 只决定文件夹名;Hugo URL 仍是 urlize(title),两者解耦,改 `url_slug` 不影响已有 URL。
- Decap 在浏览器缓存 config + 本地草稿:改 config 后需硬刷 `/admin/`;弹"加载本地备份"时别加载旧的坏草稿。

### 4b. 时区:CMS 本地时间 vs 构建机 UTC → 必须 `buildFuture: true`
- CMS 的 `date` 默认 `{{now}}` 按**浏览器本地时间**(北京 UTC+8)生成;Cloudflare Pages 构建机用 **UTC**。
- 中国时间下午(UTC 当天未到)发的文,`date` 会超前 UTC 一天,被 Hugo 默认判为"未来日期"**跳过**→ 详情页(边缘渲染,不查日期)可见,但列表页/sitemap(Hugo)缺失。
- `config/_default/hugo.yaml` 已设 `buildFuture: true` 根治。**实测 `timeZone: Asia/Shanghai` 无效**(Hugo 对纯日期 future 判定不吃 timeZone),别改回去。本站无定时发布需求。

### 4c. 列表页/首页是 Hugo 产物,与边缘渲染无关,有 40-60s 构建窗口
- 边缘渲染器**只接管详情页**(`/publication|post|project|author/<slug>/`),列表页 `/publication/`、首页、sitemap 一律透传 Pages 静态产物。
- 新文章详情页**秒级可见**(边缘渲染),但出现在**列表页要等 Hugo 构建完成**(40-60s)。这是设计文档的「双重渲染窗口」,不是 bug。
- 排查"列表页缺文章"时:别凭单条 grep 下结论(易被 CDN 缓存/中文目录名误导),用唯一链接计数 + sitemap + 探针对照实验交叉印证。


### 5. urlize 规则(B1 依赖,改 slug 逻辑须保持一致)
Worker 端 `urlizeTitle()`(`functions/_lib/slug-map.js`)必须逐字复刻 Hugo:小写 → 删标点(不产生 `-`)→ 空白转 `-` → 合并/去首尾 `-` → CJK 原样保留。改动后跑 `edge-renderer/test/urlize-test.js` 比对现有 12 篇。

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
- `docs/edge-rendering-design.md` — 边缘渲染总体方案
- `docs/phase3-realtime-plan.md` — 实时性(purge + 新文章 KV 映射)方案与进度
