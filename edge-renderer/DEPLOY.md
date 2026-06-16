# Edge Renderer — 部署指南 (Phase 1)

## 前置条件

1. Cloudflare Workers 已开通 ✅
2. wrangler CLI 已安装 ✅
3. GitHub 仓库公开 ✅

## 部署步骤

### 1. 安装依赖

```bash
cd edge-renderer
npm install
```

### 2. 创建 KV Namespaces

```bash
# 创建 Authors KV (作者名映射)
npx wrangler kv:namespace create AUTHORS
npx wrangler kv:namespace create AUTHORS --preview

# 创建 Shells KV (Shell 模板，Phase 3 使用)
npx wrangler kv:namespace create SHELLS
npx wrangler kv:namespace create SHELLS --preview
```

将输出的 `id` 和 `preview_id` 填入 `wrangler.toml` 中对应的 KV namespace。

### 3. 填充作者 KV 数据

```bash
# 运行种子脚本，将现有 8 位团队成员写入 KV
npm run seed-authors
```

### 4. 部署 Worker

```bash
npx wrangler deploy
```

### 5. 配置 Worker Routes

在 Cloudflare Dashboard 中为 Pages 项目添加 Worker Route：

1. 进入 Cloudflare Dashboard → 你的域名 → Worker Routes
2. 添加路由: `vista-research-group.pages.dev/*` → `vista-edge-renderer`

这会让 Worker 拦截所有请求，对匹配路由动态渲染，不匹配则透传给 Pages。

### 6. 验证

```bash
# 健康检查
curl https://vista-research-group.pages.dev/__health

# 测试 publication 渲染
curl https://vista-research-group.pages.dev/publication/DDE-Net/


# 检查透传 (首页应返回 Pages 内容)
curl https://vista-research-group.pages.dev/
```

## Webhook 实时缓存失效 (Phase 3.3 — 改动 A)

让"编辑已有文章后秒级可见"生效，需在 GitHub 配置 push webhook 打到边缘 `/__purge`：

### 1. 在 Cloudflare Pages 配置 secret

Pages 项目 → Settings → Environment variables，添加（Production）：

```
WEBHOOK_SECRET = <一段随机字符串>
```

> 生产环境务必配置。未配置时 `/__purge` 会放行未签名请求（仅供本地调试）。

### 2. 在 GitHub 仓库配置 Webhook

仓库 → Settings → Webhooks → Add webhook：

| 字段 | 值 |
|:--|:--|
| Payload URL | `https://vista-research-group.pages.dev/__purge` |
| Content type | `application/json` |
| Secret | 与上面 `WEBHOOK_SECRET` 相同 |
| events | 仅勾选 **Just the push event** |

保存后 GitHub 会发一个 `ping`，端点返回 200（绿勾）即配置成功。

### 3. 验证

```bash
# CMS 编辑某篇 publication 摘要并保存 → 立即刷新该页
# 期望：≤30s（通常 1-3s）看到新摘要，响应头含 X-Edge-Renderer

# 在 Cloudflare Pages → Functions 实时日志中应看到：
#   Webhook purge complete { count: N }
#   Cache purge { path: "/publication/<slug>/", deleted: true }

# 手动测试 purge（需正确签名，或临时不配 secret 时）：
curl -X POST https://vista-research-group.pages.dev/__purge \
  -H 'Content-Type: application/json' \
  -d '{"path":"/publication/dde-net-dynamic-density-driven-estimation-for-arbitrary-oriented-object-detection/"}'
```

> **注意**：新建文章（slug 尚不在 `slug-manifest.json`）的实时性由改动 B 处理，本节仅覆盖"编辑已有文章"。

## Phase 1 完成状态

- [x] 1.1 Worker 项目初始化
- [x] 1.2 GitHub Raw 内容获取 + 缓存
- [x] 1.3 Frontmatter 解析器
- [x] 1.4 Markdown 渲染集成 (marked)
- [x] 1.5 Publication Shell 模板 (硬编码)
- [x] 1.6 作者名 KV 映射 (8 位团队成员)
- [x] 1.7 Publication 完整渲染链路
- [ ] 1.8 路由配置 + 部署上线 ← 需要你操作 Cloudflare Dashboard

## 文件结构

```
edge-renderer/
  package.json          # npm 依赖 (marked, wrangler)
  wrangler.toml         # Worker 配置
  src/
    index.js            # 入口: 路由分发 + 缓存
    renderer.js         # Publication 渲染器
    shell.js            # HTML Shell 模板
    frontmatter.js      # YAML frontmatter 解析器
    authors.js          # 作者名解析
    utils.js            # 工具函数
  test/
    parse-test.js       # frontmatter 解析测试
    parse-multi.js      # 多文件解析测试
    render-test.js      # Shell 渲染测试
```
