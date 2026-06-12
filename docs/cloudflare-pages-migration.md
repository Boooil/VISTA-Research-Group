# VISTA 网站迁移至 Cloudflare Pages 方案

> **背景**：Netlify 新计费规则下，所有生产部署（包括 CLI）均消耗 15 积分/次，月部署上限仅 ~20 次。Cloudflare Pages 提供**无限免费构建 + 全球 CDN + 中国节点**，是当前最优替代方案。

---

## 迁移总览

| 变更项 | 当前 (Netlify) | 目标 (Cloudflare Pages) |
|--------|---------------|------------------------|
| 托管平台 | Netlify | Cloudflare Pages |
| 构建方式 | GitHub Actions → npx netlify-cli | Cloudflare 内置构建 |
| CMS 认证 | Netlify Identity + Git Gateway | GitHub OAuth App |
| 部署触发 | git push → Actions | git push → Cloudflare |
| PR Preview | 无（已关闭） | 自动生成 |
| 构建积分 | 15 积分/次（受限于 ~20 次/月） | **无限免费** |
| CDN 节点 | 全球（无中国节点） | 330+ 节点（含中国大陆） |

---

## 架构对比

```
迁移前：
  git push → GitHub Actions (构建) → netlify-cli deploy → Netlify CDN
  CMS 编辑  → Netlify Identity → Git Gateway → GitHub 提交
                    ↑ 依赖 Netlify                   ↑ 15 积分/次

迁移后：
  git push → Cloudflare Pages (构建+部署) → Cloudflare CDN
  CMS 编辑  → GitHub OAuth → GitHub API → GitHub 提交
                    ↑ 不再依赖 Netlify！                 ↑ 免费无限
```

---

## 迁移步骤

### 第一步：Cloudflare Pages 创建项目（10 分钟）

#### 1.1 注册 Cloudflare 账号

访问 [dash.cloudflare.com](https://dash.cloudflare.com) 注册（如果已有账号则跳过）。

#### 1.2 创建 Pages 项目

1. 左侧菜单 → **Workers & Pages** → **Pages** 标签
2. 点击 **Connect to Git**
3. 授权 Cloudflare 访问 GitHub，选择 `Boooil/VISTA-Research-Group` 仓库
4. 点击 **Begin setup**

#### 1.3 配置构建设置

| 配置项 | 值 |
|--------|-----|
| **Framework preset** | Hugo |
| **Build command** | `npm install && hugo --gc --cleanDestinationDir --enableGitInfo && npx pagefind --site public --force-language zh` |
| **Build output directory** | `public` |

> **注意**：Cloudflare Pages 自动检测 `package.json` 并安装 Node.js 依赖，但 `npm install` 显式写在 build command 中可以确保 preact 等依赖在 Hugo JSBUILD 之前就位。

#### 1.4 设置环境变量

在项目设置的 **Settings → Environment variables** 中添加：

| Variable | Value | 说明 |
|----------|-------|------|
| `HUGO_VERSION` | `0.148.2` | 锁定 Hugo 版本 |
| `NODE_VERSION` | `20` | 锁定 Node.js 版本 |

#### 1.5 首次部署

保存配置后 Cloudflare 自动触发首次构建。构建完成后会分配一个 `*.pages.dev` 域名（如 `vista-research-group.pages.dev`）。先在这个域名上验证站点功能正常。

---

### 第二步：修改站点配置（5 分钟）

> ⚠️ 以下所有修改在验证首次部署成功后再进行。

#### 2.1 更新 Hugo baseURL

`config/_default/hugo.yaml`：

```yaml
# 改为 Cloudflare Pages 域名（或自定义域名）
baseURL: "https://vista-research-group.pages.dev/"
```

#### 2.2 更新 CMS site_url

`static/admin/config.yml`：

```yaml
site_url: "https://vista-research-group.pages.dev/"
display_url: "https://vista-research-group.pages.dev/"
```

#### 2.3 切换 CMS Backend

`static/admin/config.yml`：

```yaml
# 替换原来的 git-gateway backend
backend:
  name: github
  repo: Boooil/VISTA-Research-Group
  branch: main
```

> 原有 `backend` 块（包含 `name: git-gateway`）整块删除，替换为上面三行。

---

### 第三步：创建 GitHub OAuth App（10 分钟）

CMS 需要 GitHub OAuth App 来认证编辑者。

#### 3.1 创建 OAuth App

1. GitHub → 右上角头像 → **Settings**
2. 左侧菜单 → **Developer settings** → **OAuth Apps**
3. 点击 **New OAuth App**
4. 填写：

| 字段 | 值 |
|------|-----|
| Application name | `VISTA CMS` |
| Homepage URL | `https://vista-research-group.pages.dev` |
| Application description | `VISTA Research Group CMS` |
| Authorization callback URL | `https://api.decapcms.org/auth/github/callback` |

5. 点击 **Register application**
6. 生成 **Client Secret**（点击 Generate a new client secret）
7. 记录 **Client ID** 和 **Client Secret**

#### 3.2 在 Cloudflare Pages 中配置 OAuth 重定向

由于 Decap CMS 的认证回调是托管在 `decapcms.org` 的服务，CMS 登录时：

1. 用户在 `/admin/` 点击登录 → 跳转到 GitHub 授权页
2. GitHub 授权后 → 回调到 `https://api.decapcms.org/auth/github/callback`
3. Decap 服务用 GitHub token 代理所有 API 请求

这个过程完全由 Decap CMS 的托管服务处理，**不需要在 Cloudflare 做任何额外配置**。

---

### 第四步：CMS 配置收尾

`static/admin/config.yml` 完整 backend 块如下：

```yaml
backend:
  name: github
  repo: Boooil/VISTA-Research-Group
  branch: main
  base_url: https://api.decapcms.org
```

> `base_url` 指向 Decap CMS 官方托管的认证代理，处理 GitHub OAuth 流程。

---

### 第五步：清理 Netlify 相关配置（可选）

#### 5.1 保留或删除的文件

| 文件 | 处理方式 |
|------|---------|
| `netlify.toml` | 删除（不再需要） |
| `.github/workflows/deploy.yml` | 删除（不再需要） |
| `.netlify/state.json` | 删除（本地标识文件） |
| `deploy.bat` | 保留（本地构建预览用；将 netlify deploy 改为本地预览命令） |

#### 5.2 Netlify 站点

在 Cloudflare Pages 稳定运行一段时间后：
1. 登录 [Netlify Dashboard](https://app.netlify.com)
2. 进入站点 → **Site configuration** → **General**
3. 滚动到底部 → **Delete this site**（可选，也可以保留作为备份）

> 建议先保留 Netlify 站点 1-2 周作为回退方案。

---

### 第六步：自定义域名（可选）

如果希望使用自己的域名（如 `vista.example.com`）：

1. Cloudflare Pages → 项目 → **Custom domains**
2. 点击 **Set up a custom domain**
3. 输入域名，按照指引配置 DNS

如果域名本身就在 Cloudflare 管理，SSL 证书和 DNS 配置全自动完成。

---

## 完整配置清单

### `config/_default/hugo.yaml` (变更部分)

```yaml
baseURL: "https://vista-research-group.pages.dev/"
```

### `static/admin/config.yml` (变更部分)

```yaml
backend:
  name: github
  repo: Boooil/VISTA-Research-Group
  branch: main
  base_url: https://api.decapcms.org

site_url: "https://vista-research-group.pages.dev/"
display_url: "https://vista-research-group.pages.dev/"
```

### Cloudflare Pages 环境变量

| Variable | Value |
|----------|-------|
| `HUGO_VERSION` | `0.148.2` |
| `NODE_VERSION` | `20` |

---

## 验证清单

迁移完成后逐项检查：

- [ ] 首页（`/`）正常加载
- [ ] 团队成员页（`/authors/`）显示所有成员
- [ ] 成果动态（`/post/`）列表正常
- [ ] 论文著作（`/publication/`）列表正常
- [ ] Pagefind 搜索（`/` 页搜索框）能搜到中文内容
- [ ] CMS 后台（`/admin/`）可通过 GitHub 账号登录
- [ ] CMS 可以创建/编辑内容并发布
- [ ] CMS 上传图片功能正常
- [ ] 所有页面加载 CSS 样式正常
- [ ] HTTP → HTTPS 自动跳转
- [ ] 404 页面正常显示

---

## 可能遇到的问题

### Q: Hugo 版本不对怎么办？

Cloudflare Pages 默认 Hugo 版本可能低于 `0.148.2`。在项目环境变量中设置 `HUGO_VERSION=0.148.2` 即可锁定版本。

### Q: Hugo Modules 无法下载？

Cloudflare Pages 构建环境默认可以访问 GitHub。如果遇到 rate limit，可以在项目设置中添加 `HUGO_GOOGLEANALYTICS` 等必要的 token。通常 HugoBlox 模块从 GitHub 直接拉取不需要额外配置。

### Q: preact 找不到？

Cloudflare Pages 检测到 `package.json` 会自动运行 `npm install`，我们在 build command 中也显式调用了。双重保障。

### Q: Pagefind 搜索索引失败？

Pagefind 需要 Node.js 环境，Cloudflare Pages 构建环境已包含。确保 build command 中 `npx pagefind` 在 `hugo` 之后执行。

### Q: CMS 登录显示 "404 Not Found"？

确认 `static/admin/config.yml` 中 `backend.name` 已改为 `github`，且 `site_url` 指向正确的 Cloudflare Pages 域名。

### Q: 迁移后忘记停掉 Netlify？

如果 Netlify 自动构建还在运行，继续烧积分。迁移完成后记得去 Netlify 后台 **Stop builds** 或直接删除站点。

---

## 回滚方案

如果迁移后遇到无法解决的问题：

1. 切回 Netlify：恢复 `config.yml` 的 `backend: git-gateway`，恢复 `netlify.toml`
2. 重新 push 到 GitHub，Netlify 自动构建生效
3. Cloudflare Pages 站点保留不删除（无成本）

> **实际上几乎不需要回滚**：Cloudflare Pages 和 Hugo 的兼容性非常好，Decap CMS 的 GitHub backend 也是官方推荐的成熟方案。

---

## 相关文档

- [Cloudflare Pages — Deploy a Hugo site](https://developers.cloudflare.com/pages/framework-guides/deploy-a-hugo-site/)
- [Decap CMS — GitHub Backend](https://decapcms.org/docs/github-backend/)
- [VISTA Website 开发日志](./changelog.md)
- [CMS + GitHub Actions 零积分部署（已废弃）](./cms-github-actions-deploy.md)
