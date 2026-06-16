# Phase 3 实时性补齐方案 — 让 CMS 提交后 1-3 秒可见

> 状态：方案设计（待审阅）| 2026-06-16
> 关联：[edge-rendering-design.md](./edge-rendering-design.md) 第 8.2 节、第十二章 Phase 3.3

> **实施进度（2026-06-16）**
> - ✅ **改动 A（webhook purge）已实现并上线验证**：CMS 编辑已有文章 → push → `/__purge` 删边缘缓存 → 提交后 ~13s 新内容可见（实测专利摘要修改，render-time 晚于 commit 13s）。
> - ✅ **改动 B1（新文章 KV 即时映射）已实现**：urlize 规则用现有 12 篇内容逐字验证通过（见 `edge-renderer/test/urlize-test.js`）；webhook 对新增/修改内容拉 `index.md` 解析标题 → `urlizeTitle` → 写 `slugmap:<type>:<slug>` 到 KV；`resolveFolder` 改为 manifest 未命中时查 KV 兜底。新文章在 Hugo 构建完成前即可被边缘渲染。
> - KV 复用现有 `AUTHORS` namespace 的 `slugmap:` 前缀，无需新建绑定；映射 TTL 1h（构建完成后 manifest 接管）。

## 一、为什么写这份方案

### 1.1 原始目标（来自 edge-rendering-design.md 第 20 行）

> **核心目标**：CMS 提交后内容页面 **1-3 秒内可见**，刷新即看到新内容。

这是整个边缘渲染重构的立项理由——原来改内容要等 Hugo 全量构建 40-60s，论文著作（publication）这类高频更新内容编辑体验差。

### 1.2 当前实测差距

Phase 1-3 已让"内容页能被边缘动态渲染"成立（404、CSS hash、四类型渲染均已修复并上线）。但**核心 KPI「1-3 秒可见」尚未达成**，原因是两个缺口：

| 场景 | 当前实际表现 | 达标？ |
|:--|:--|:--:|
| 编辑已有文章 · 该页边缘无缓存 | 请求时实时渲染，~1-3s 可见 | ✅ |
| 编辑已有文章 · 该页已被缓存 | 等 `s-maxage=300` 过期，**最多 5 分钟** | ❌ |
| 新建文章 | slug 不在 manifest → 回退 Pages → **等构建 40-60s** | ❌ |

### 1.3 两个根因

**根因 A：Webhook 主动失效（purge）从未接线。**
`functions/[[path]].js` 内已实现完整的 `POST /__purge` 端点（含 HMAC 验签、删边缘缓存、清变体 URL），但**全仓库没有任何地方调用它**（已 grep 确认）。设计文档第 8.2 节 / Phase 3.3 原计划用它实现秒级失效，但触发侧缺失，导致实时性退化为纯被动 TTL（5 分钟）。

**根因 B：新文章的 slug 解析依赖 Hugo 构建产物。**
修复"slug≠文件夹名"404 时引入的 `slug-manifest.json` 随 Hugo 全量构建产出（40-60s）。新文章的 slug 在构建完成前不在 manifest 中，`resolveFolder` 未命中 → 回退 Pages（此时 Pages 也没构建完）→ 仍要等 40-60s。

> 注：根因 B 是 manifest 机制的副作用。设计文档第 4.2 节原始设想是"直接用 URL slug 拼文件夹路径"，无需等构建——但那个假设本身是错的（slug 是 urlize 标题，≠ 文件夹名），才导致最初的 404。所以不能简单退回原设计，需要一个"未命中时的兜底解析"。

---

## 二、关键事实核查（已确认）

| 项 | 现状 | 对方案的影响 |
|:--|:--|:--|
| CMS 后端 | Decap CMS，`backend: github`，直接提交 `main`（无 editorial workflow / PR） | purge 触发只能靠 **GitHub push webhook**，CMS 自身不发 purge |
| OAuth 中转 | `vista-cms-oauth.boil99.workers.dev`（独立 worker） | 与渲染无关，不复用 |
| 边缘渲染运行时 | Cloudflare **Pages Functions**（`functions/`），KV 绑定在 Pages dashboard 配置 | webhook 接收端点要放在 `functions/`（已有 `/__purge`） |
| GitHub Raw 抓取 | 匿名（限流 60 req/h/IP） | 新文章兜底若用 GitHub API 列目录，需考虑限流/加 token |
| `env` 绑定 | `AUTHORS`(KV)、`WEBHOOK_SECRET`、`DEBUG` | 新增映射可复用 KV；webhook secret 已预留 |
| `sync-kv` Action | push 命中 `content/authors/**` 等 paths 才触发 | 可在其中追加"提交后通知 purge"，但 Action 有 40-60s 滞后，不适合做实时 purge |

**结论**：purge 的实时触发必须走 **GitHub repository webhook（push 事件）→ 直接 POST 到 Pages Functions 的 `/__purge`**，不能依赖 GitHub Action（Action 本身就有构建级延迟）。

---

## 三、方案总览

```
CMS 保存 (Decap)
      │  commit + push 到 main (秒级)
      ▼
GitHub  ──push webhook──▶  POST https://vista-research-group.pages.dev/__purge
(repo settings)              │  body: GitHub push payload (commits[].modified/added)
                            ▼
                   functions/[[path]].js  handlePurge()
                   ├─ 验签 (X-Hub-Signature-256 + WEBHOOK_SECRET)
                   ├─ 解析改动文件路径 → 推导受影响的页面 URL + slug→folder
                   ├─ ① 删除边缘缓存 (cache.delete)        ← 解决根因 A
                   └─ ② 写入 slug→folder 即时映射到 KV     ← 解决根因 B
                            │
                            ▼
                   下次访问该页 → 边缘无缓存 → resolveFolder
                   先查 manifest，未命中再查 KV 即时映射 → 命中 → 实时渲染 (1-3s)
```

核心思路：**把 GitHub push webhook 直接打到边缘**，一次请求同时完成"失效旧缓存"和"补全新文章的 slug 映射"，绕过 Hugo 构建这条慢路径。

---

## 四、详细改动

### 4.1 改动 A：接通 Webhook purge（解决根因 A）

**现有 `handlePurge` 的不足**：它只接受 `{ path: "/post/xxx/" }` 这种已知单路径，而 GitHub push webhook 发来的是 commit payload（`commits[].added/modified/removed` 是文件路径，如 `content/publication/TRVP/index.md`）。需要让端点能解析 push payload。

**改法（`functions/[[path]].js`）**：
1. `handlePurge` 增加对 GitHub push 事件的支持：
   - 读 `X-GitHub-Event: push` 头；验签沿用现有 `verifyGitHubSignature`（已实现）。
   - 从 payload 收集所有 `added/modified/removed` 文件路径。
   - 过滤出 `content/{publication,post,project,authors}/<folder>/(index|_index).md` 形态的路径，解析出 `(type, folder)`。
2. 对每个受影响内容，**删除其边缘缓存**。但缓存 key 是 `/{type}/{urlSlug}/`（urlize 标题），而 webhook 只知道 `folder`——需要 folder→slug 反查：
   - 优先查 `slug-manifest.json` 的反向映射（已有正向 `slug→folder`，可在内存构建反向表）。
   - 已有文章必在 manifest 里 → 能拿到 urlSlug → 删缓存。✅
3. 保留对旧式 `{ path }` 请求体的兼容（手动 purge 仍可用）。

**触发侧（GitHub repo 设置，非代码）**：
- 在 GitHub repo → Settings → Webhooks 添加：
  - Payload URL: `https://vista-research-group.pages.dev/__purge`
  - Content-Type: `application/json`
  - Secret: 与 Pages 环境变量 `WEBHOOK_SECRET` 一致
  - 事件: 仅 `push`
- 这是一次性手动配置，需在文档/DEPLOY.md 记录。

**效果**：编辑已有文章 → push → webhook → 删该页边缘缓存 → 下次访问实时重渲染。受 GitHub Raw 30s 传输缓存影响，**最坏 30s、通常 1-3s 可见**。

### 4.2 改动 B：新文章 slug 即时映射（解决根因 B）

新文章的 `urlSlug→folder` 在 Hugo 构建前不存在于 manifest。两种兜底途径：

**方案 B1（推荐）：webhook 时把映射写入 KV。**
- webhook 解析出新增的 `content/<type>/<folder>/index.md` 时，需要算出它的 `urlSlug`。
- urlSlug = urlize(frontmatter.title)。Worker 拉取该 `index.md`（GitHub Raw，秒级可用），解析 frontmatter title，用与 Hugo 一致的 urlize 规则生成 slug。
- 写入 KV：`slugmap:<type>:<urlSlug>` → `<folder>`。
- `resolveFolder` 改为：**先查 manifest，未命中再查 KV `slugmap:*`**。命中即可渲染。
- Hugo 构建完成后 manifest 自然包含该 slug，KV 映射变为冗余（可设 TTL 自动过期，如 1h）。

  风险点：**urlize 规则必须与 Hugo 完全一致**（中文、标点、大小写）。Hugo 用 `urlize`（小写、空格转 `-`、去非 ASCII 或转拼音视配置而定）。这是 B1 的主要技术风险——若规则对不齐，slug 仍解析错。需要用现有内容逐个验证 urlize 输出 == manifest 现有 key。

**方案 B2（备选）：未命中时用 GitHub API 列目录 + 标题匹配。**
- `resolveFolder` 未命中 manifest 时，调用 GitHub API 列出 `content/<type>/` 下所有子目录，逐个拉 `index.md` 读 title，urlize 后与请求 slug 比对。
- 优点：不依赖 webhook，纯读路径自洽。
- 缺点：每次未命中要多次 GitHub API 调用（匿名限流 60/h），慢且可能触发限流；同样依赖 urlize 一致性。

**取舍**：B1 更快（命中 KV ~5ms）、不耗 API 限额，但需要 webhook 接线（与改动 A 同源，顺势完成）。B2 无需 webhook 但慢且有限流风险。**推荐 B1，B2 作为 B1 未覆盖时的可选兜底。**

### 4.3 缓存 TTL 调优（可选，低风险）

当前 `s-maxage=300`（5 分钟）。即便不接 webhook，把它调小（如 30-60s）也能把"已缓存文章"的最坏可见延迟从 5 分钟降到 1 分钟内，代价是边缘缓存命中率下降、GitHub Raw 请求增多。**作为 webhook 接线前的临时缓解，或 webhook 的兜底。**

---

## 五、工作量与风险评估

| 改动 | 文件 | 工作量 | 风险 |
|:--|:--|:--:|:--|
| A. webhook purge 接线（解析 push payload + folder→slug 反查 + 删缓存） | `functions/[[path]].js`（+ edge-renderer 同源） | 中 | 低（端点、验签已就绪） |
| A. GitHub webhook 配置 | repo settings（手动） | 小 | 低（一次性） |
| B1. 新文章 KV 即时映射 + resolveFolder 兜底 | `functions/_lib/slug-map.js`、`functions/[[path]].js` | 中 | **中：urlize 规则需与 Hugo 完全对齐** |
| C. TTL 调优 | `functions/[[path]].js` | 小 | 低 |

**主要风险：urlize 一致性（改动 B）。** 中文标题尤其要验证——需用现有 publication/post 的 title 跑 urlize，逐个比对 `slug-manifest.json` 的现有 key，全部吻合才能上线 B1。若无法可靠对齐，退化为 B2（API 列目录）或接受"新文章仍等构建"。

**WEBHOOK_SECRET 安全**：必须在 Pages 环境变量配置真实 secret，否则 `/__purge` 当前会"记录警告但放行"（开发态行为），生产环境是未授权失效风险。接线时应改为**生产环境强制要求 secret**。

---

## 六、建议实施顺序

1. **先做改动 A（webhook purge）** —— 直接覆盖核心痛点"编辑已有论文著作秒级可见"，风险低、收益最大。完成后"编辑已有文章"场景即达标。
2. **配置 GitHub webhook + WEBHOOK_SECRET** —— 让 A 真正生效，并强制生产验签。
3. **再做改动 B1（新文章 KV 映射）** —— 解决"新建文章"，但需先通过 urlize 一致性验证；不过关则用 B2 或暂缓。
4. （可选）**TTL 调优 C** —— 作为兜底，进一步压低任何遗漏场景的延迟。

完成 1-3 后，三个场景全部达到 1-3s（最坏受 GitHub Raw 30s 传输缓存约束）可见，符合设计文档核心目标。

---

## 七、验收标准

| 场景 | 验收方法 | 期望 |
|:--|:--|:--|
| 编辑已有文章 | CMS 改 publication 摘要 → 保存 → 立即刷新该页 | ≤30s 看到新摘要（通常 1-3s），响应含 `X-Edge-Renderer` |
| webhook 生效 | push 后查 Pages Functions 日志 | 有 `Cache purge { path, deleted: true }` |
| 新建文章（B1 后） | CMS 新建 publication → 保存 → 访问其 URL | 不再 404/回退，直接边缘渲染 |
| 验签 | 用错误 secret POST `/__purge` | 返回 401 |
| urlize 一致性（B1 前置） | 脚本对所有现有 title 跑 urlize 比对 manifest key | 100% 吻合 |

---

## 八、不在本方案内（明确边界）

- **Phase 4 的 1:1 渲染对齐**（面包屑、相关文章、JSON-LD 等）——与实时性无关，不在此处理。
- **列表页/首页实时性**——设计上仍走 Hugo 构建（变更频率低，可接受），本方案只覆盖四类详情页。
- **彻底去掉 Hugo 构建依赖**——shell 模板、CSS/JS、manifest 仍由 Hugo 产出，本方案只是让"内容详情"绕过构建即时可见。
