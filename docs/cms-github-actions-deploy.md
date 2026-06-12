# CMS + GitHub Actions 零积分自动部署方案

> **目标**：在 Netlify 新计费规则（300 积分/月，每次自动构建 15 积分，仅 ~20 次/月）下，保持 CMS 在线编辑 → 自动部署的完整体验，同时**不消耗任何 Netlify 构建积分**。

---

## 架构总览

```
┌──────────┐    编辑内容     ┌──────────┐   Git Gateway    ┌──────────┐
│  Decap   │ ──────────────→ │  Netlify │ ──────────────→ │  GitHub  │
│  CMS     │   提交到 Git    │ Identity │   提交 commit    │  Repo    │
│ /admin/  │                └──────────┘                 └────┬─────┘
└──────────┘                                                  │
                                                    push to main 触发
                                                              │
                                                              ▼
┌──────────┐    netlify CLI    ┌──────────┐    hugo build    ┌──────────┐
│ Netlify  │ ←─────────────── │  GitHub  │ ←────────────── │  GitHub  │
│  CDN     │   上传 public/    │ Actions  │   + pagefind    │ Actions  │
│ (托管)   │   零积分！         │  Runner  │                 │  Runner  │
└──────────┘                  └──────────┘                 └──────────┘
```

- **Decap CMS**：在线编辑界面，通过 Netlify Identity / Git Gateway 将内容变更写入 GitHub 仓库
- **GitHub Actions**：检测到 push → 执行 Hugo 构建 + Pagefind 索引 → 通过 Netlify CLI 上传 → **零积分**
- **Netlify**：只做静态文件托管和 CDN，不做构建

---

## 准备工作（一次性，约 15 分钟）

### 第一步：获取 Netlify 凭证

#### 1.1 创建 Personal Access Token

1. 登录 [Netlify](https://app.netlify.com)
2. 点击右上角头像 → **User settings**
3. 左侧菜单 → **Applications**
4. 点击 **Personal access tokens**
5. 点击 **New access token**
6. 填写名称（如 `github-actions-deploy`），点击 **Generate token**
7. **立即复制 token**（只显示一次）

#### 1.2 获取 Site ID

1. 进入你的站点（`vista-research-group`）
2. 左侧菜单 → **Site configuration** → **General**
3. 找到 **Site details** → **API ID**（一串类似 `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` 的字符串）
4. 复制这个 ID

### 第二步：在 GitHub 配置 Secrets

1. 打开 GitHub 仓库：`Boooil/VISTA-Research-Group`
2. 顶部菜单 → **Settings**
3. 左侧菜单 → **Secrets and variables** → **Actions**
4. 点击 **New repository secret**，分别添加两个 secret：

| Name | Value |
|------|-------|
| `NETLIFY_AUTH_TOKEN` | 第一步创建的 Personal Access Token |
| `NETLIFY_SITE_ID` | 第一步复制的 API ID |

添加完成后，列表应显示：

```
NETLIFY_AUTH_TOKEN   ***
NETLIFY_SITE_ID      xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### 第三步：创建 GitHub Actions 工作流

仓库中已有 `.github/workflows/deploy.yml`，内容如下：

```yaml
name: Deploy to Netlify

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          submodules: recursive

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup Hugo
        uses: peaceiris/actions-hugo@v3
        with:
          hugo-version: '0.148.2'
          extended: true

      - name: Build
        run: |
          hugo --minify --gc --cleanDestinationDir --enableGitInfo \
            --baseURL https://vista-research-group.netlify.app/
          npx pagefind --site public --force-language zh

      - name: Deploy to Netlify
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
        run: |
          npm install -g netlify-cli
          netlify deploy --prod --dir=public --auth=$NETLIFY_AUTH_TOKEN --site=$NETLIFY_SITE_ID
```

> 提交此文件后，GitHub Actions 即开始工作。

### 第四步：关闭 Netlify 自动构建

这一点很关键 —— 避免重复部署和浪费积分残留配额：

1. 登录 [Netlify Dashboard](https://app.netlify.com)
2. 进入站点 → **Site configuration** → **Build & deploy** → **Build settings**
3. 滚动到底部，点击 **Stop builds**
4. 确认操作

> **不用担心**：Stop builds 只停 Git push 触发的自动构建。CLI 部署、CMS（Git Gateway）、Netlify Identity、Netlify Forms 等功能完全不受影响。

---

## 日常使用

### CMS 在线编辑（推荐给非技术人员）

1. 访问 `https://vista-research-group.netlify.app/admin/`
2. 使用 Netlify Identity 登录
3. 创建/编辑内容（团队成员、成果动态、科研项目、论文著作等）
4. 点击 **发布** → CMS 自动提交到 GitHub → GitHub Actions 自动构建部署
5. 约 **2-3 分钟**后网站自动更新

> GitHub Actions 运行进度可在 `https://github.com/Boooil/VISTA-Research-Group/actions` 查看。

### Git Push 部署（推荐给开发者）

直接在本地编辑 Markdown 文件，commit 并 push：

```bash
git add .
git commit -m "feat: 新增一篇论文"
git push origin main
```

GitHub Actions 自动触发部署，无需任何额外操作。

### 本地 CLI 部署（调试/紧急使用）

如果 GitHub Actions 不可用或需要立即生效，可以使用本地 CLI 部署：

```bash
.\deploy.bat
```

详见 [`deploy-via-cli.md`](./deploy-via-cli.md)。

---

## 工作流触发场景对照表

| 触发方式 | 谁操作 | 自动部署？ | 积分消耗 |
|----------|--------|-----------|---------|
| CMS 在线编辑 → 发布 | 非技术人员 | ✅ GitHub Actions | **0** |
| `git push` 到 main | 开发者 | ✅ GitHub Actions | **0** |
| `.\deploy.bat` 本地 | 开发者 | ✅ 手动本地 | **0** |
| Netlify 自动构建 | - | ❌ 已关闭 | - |

---

## 常见问题

### Q: CMS 编辑后多久能看到更新？

通常在 **2-3 分钟**内：
1. CMS 提交到 GitHub（几秒）
2. GitHub Actions 排队启动（0-30 秒）
3. Hugo 构建 + Pagefind 索引（约 60-90 秒）
4. Netlify CLI 上传（约 30 秒）

可以在 GitHub 仓库的 **Actions** 标签页查看实时进度。

### Q: GitHub Actions 有使用限制吗？

**公开仓库**：完全免费，**无限使用**。每月有 2000 分钟的额度（Linux runner），对于 Hugo 站点来说绰绰有余（每次构建约 1-2 分钟，足够构建 1000+ 次）。

**私有仓库**：免费额度为每月 500 分钟。

### Q: 如果 GitHub Actions 部署失败怎么办？

1. 先去 GitHub Actions 看失败日志（`https://github.com/Boooil/VISTA-Research-Group/actions`）
2. 常见失败原因：
   - `NETLIFY_AUTH_TOKEN` 过期 → 在 Netlify 重新生成 token，更新 GitHub Secret
   - Hugo 版本不兼容 → 检查 `.github/workflows/deploy.yml` 中的 `hugo-version`
   - Pagefind 索引失败 → 检查 `public/` 目录是否正确生成
3. 紧急情况下可以使用 `.\deploy.bat` 本地部署

### Q: Netlify Identity / Git Gateway 还需要保留吗？

**需要。** CMS 的在线编辑功能依赖 Netlify Identity（用户认证）和 Git Gateway（写入 GitHub 仓库）。这两个服务和构建积分无关，继续免费使用。

### Q: 是否会影响 PR Preview 或 Branch Deploy？

**Branch Deploy 会受影响**——因为关闭了 Netlify 自动构建。如果你需要 PR Preview 功能，可以：

- 保留 Netlify 的 `[context.deploy-preview]` 和 `[context.branch-deploy]` 自动构建，只关闭 production 构建
- 或者在 Netlify 设置中将 production 构建关闭，但保留 deploy-preview（deploy-preview 同样消耗积分，但按需使用）

### Q: Hugo 版本需要升级怎么办？

修改 `.github/workflows/deploy.yml` 中 `Setup Hugo` 步骤的 `hugo-version` 字段，同时更新 `netlify.toml` 中的 `HUGO_VERSION`（保持一致，方便本地开发和 Netlify 备用）。

### Q: CMS 能正常上传图片吗？

**可以。** 图片上传走的是 Git Gateway → GitHub 仓库，不经过 Netlify 构建服务器。上传的图片存在 `static/uploads/`，经由 GitHub Actions 构建后映射到 `/uploads/`。

---

## 故障恢复

### 场景一：GitHub Actions 不可用

**现象**：push 后 Actions 页面没有运行或全部失败

**临时方案**：使用本地 CLI 部署

```bash
.\deploy.bat
```

### 场景二：Token 过期

**现象**：Actions 日志中 Netlify 部署步骤报认证错误

**修复步骤**：
1. 登录 Netlify → User settings → Applications → Personal access tokens
2. 删除旧 token，创建新 token
3. GitHub 仓库 → Settings → Secrets → Actions → 更新 `NETLIFY_AUTH_TOKEN`

### 场景三：紧急回滚

找到上一次正常部署对应的 GitHub commit，在 Actions 页面点击该 commit 旁边的 **Re-run jobs** 按钮，即可重新部署该版本。

---

## 相关文档

- [Netlify CLI 本地部署指南](./deploy-via-cli.md) — 手动部署方式和一键脚本
- [GitHub Actions 文档](https://docs.github.com/en/actions) — GitHub Actions 官方文档
- [Decap CMS 文档](https://decapcms.org/docs/intro/) — CMS 使用和配置指南
- [Netlify CLI 文档](https://cli.netlify.com/) — Netlify CLI 官方文档
