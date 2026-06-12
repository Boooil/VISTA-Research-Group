# Netlify CLI 本地部署指南

> **背景**：Netlify 从 2026 年起将计费方式从"每月 300 构建分钟"改为"每月 300 积分"，每次自动构建消耗 **15 积分**，即每月仅能部署约 **20 次**。通过改用 CLI 本地部署，完全绕过 Netlify 构建服务器，**不消耗任何积分**，部署次数不受限制。

---

## 原理

```
之前（消耗积分）：
  git push → Netlify 检测变更 → Netlify 服务器执行 hugo build → 部署

现在（零积分）：
  本地执行 hugo build → netlify CLI 直接上传 public/ → 部署完成
```

CLI 部署相当于把已经构建好的静态文件直接推送到 Netlify 的 CDN 节点，Netlify 只做托管，不做构建，因此**不产生积分消耗**。

---

## 准备工作（仅需一次）

### 1. 安装 Node.js（如未安装）

Netlify CLI 依赖 Node.js。如果你的项目已经能运行 `npx pagefind`，说明 Node.js 已安装，可跳过此步。

```bash
# 检查是否已安装
node --version   # 需要 >= 18
```

如未安装，从 [nodejs.org](https://nodejs.org) 下载 LTS 版本。

### 2. 安装 Netlify CLI

```bash
npm install -g netlify-cli
```

验证安装：

```bash
netlify --version
```

### 3. 登录 Netlify 账号

```bash
netlify login
```

此命令会自动打开浏览器，授权 CLI 访问你的 Netlify 账号。完成后终端会显示 `Logged in as <your-email>`。

### 4. 关联当前项目（仅需一次）

在项目根目录执行：

```bash
netlify link
```

交互式选择：
- 选择 `Use current git remote origin`（自动识别 GitHub 仓库对应的 Netlify 站点）
- 或者手动搜索你的站点名称（如 `vista-research-group`）

完成后项目根目录会出现 `.netlify/state.json`（已在 `.gitignore` 中），表示关联成功。

---

## 日常部署操作

### 完整部署命令（生产环境）

在项目根目录依次执行以下三条命令：

```bash
# 第一步：本地构建 Hugo 站点
hugo --minify --gc --cleanDestinationDir --enableGitInfo \
  --baseURL https://vista-research-group.netlify.app/

# 第二步：生成搜索索引
npx pagefind --site public --force-language zh

# 第三步：部署到 Netlify 生产环境
netlify deploy --prod --dir=public
```

执行 `netlify deploy --prod` 时会要求确认（输入 `y`），确认后开始上传，通常 **30 秒内**完成。

### ⚡ 一键部署脚本（推荐）

为了简化操作，可以将以上步骤封装为 npm script。在 `package.json` 中添加：

```json
{
  "scripts": {
    "build": "hugo --minify --gc --cleanDestinationDir --enableGitInfo --baseURL https://vista-research-group.netlify.app/ && npx pagefind --site public --force-language zh",
    "deploy": "npm run build && netlify deploy --prod --dir=public"
  }
}
```

之后每次只需：

```bash
npm run deploy
```

如果项目没有 `package.json`，也可以创建一个简单的脚本文件：

**Windows (`deploy.bat`)**：

```bat
@echo off
echo === 1/3 正在构建 Hugo 站点...
hugo --minify --gc --cleanDestinationDir --enableGitInfo --baseURL https://vista-research-group.netlify.app/
if %errorlevel% neq 0 exit /b %errorlevel%

echo === 2/3 正在生成搜索索引...
npx pagefind --site public --force-language zh
if %errorlevel% neq 0 exit /b %errorlevel%

echo === 3/3 正在部署到 Netlify...
netlify deploy --prod --dir=public
echo === 部署完成！
```

**macOS/Linux (`deploy.sh`)**：

```bash
#!/bin/bash
set -e

echo "=== 1/3 正在构建 Hugo 站点..."
hugo --minify --gc --cleanDestinationDir --enableGitInfo \
  --baseURL https://vista-research-group.netlify.app/

echo "=== 2/3 正在生成搜索索引..."
npx pagefind --site public --force-language zh

echo "=== 3/3 正在部署到 Netlify..."
netlify deploy --prod --dir=public

echo "=== 部署完成！"
```

```bash
chmod +x deploy.sh
./deploy.sh
```

---

## 可选：预览部署（不发布到生产）

如果只想预览效果而不发布，可以使用不带 `--prod` 的部署命令：

```bash
netlify deploy --dir=public
```

这会生成一个临时预览链接（draft URL），可以用浏览器打开检查，确认无误后再发布：

```bash
netlify deploy --prod --dir=public
```

---

## 可选：停止 Netlify 自动构建

改用 CLI 部署后，建议关闭 Netlify 的自动构建，避免 push 代码时误触发构建浪费积分：

1. 登录 [Netlify Dashboard](https://app.netlify.com)
2. 进入你的站点 → **Site configuration** → **Build & deploy** → **Build settings**
3. 点击 **Stop builds**

> **不用担心**：这只停了 Git push 触发的自动构建，CLI 部署和 PR Preview 等功能不受影响。

---

## 常见问题

### Q: CLI 部署会消耗积分吗？

**不会。** Netlify 明确说明 CLI 直接上传（`netlify deploy --dir`）属于手动部署，不计入构建积分。积分只针对 Netlify 服务器上执行的自动构建。

### Q: 需要修改 `netlify.toml` 吗？

**不需要。** `netlify.toml` 中的 `[build]` 配置只对 Netlify 自动构建生效。CLI 部署时你已经在本地手动执行了构建命令，Netlify 不会读取 `netlify.toml` 中的构建配置。头信息（headers）等配置仍然生效。

### Q: Hugo 版本升级了怎么办？

本地使用的 Hugo 版本和 Netlify 服务器无关。确保你本地的 Hugo 版本符合项目要求（当前要求 `>= 0.148.2`）：

```bash
hugo version
```

如需升级，去 [Hugo Releases](https://github.com/gohugoio/hugo/releases) 下载最新 extended 版本。

### Q: Pagefind 搜索还能正常工作吗？

**可以。** 第二步 `npx pagefind --site public` 在本地生成搜索索引，和之前 Netlify 服务器上执行的效果完全一样。

### Q: 多人协作怎么办？

每个人都可以用自己的账号登录 Netlify CLI，只要在 Netlify 站点中把对应的 Netlify 账号添加为 **Collaborator** 即可。或者直接用方案二（GitHub Actions），由 CI 统一构建部署。

---

> 📘 **推荐**：如果需要 CMS 在线编辑自动部署、或 push 即部署的全自动体验，请参阅 [CMS + GitHub Actions 零积分自动部署方案](./cms-github-actions-deploy.md)。
>
> 以下 CLI 本地部署方式适合**临时/紧急部署**或不想配置 GitHub Actions 的场景。

## 进阶：GitHub Actions 自动化（不消耗积分的自动部署）

如果你希望保持 push 即部署的体验，同时又不想消耗积分，可以参考以下 `.github/workflows/deploy.yml` 配置：

```yaml
name: Deploy to Netlify
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive

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

需要事先在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 中添加两个 secrets：

| Secret | 获取方式 |
|--------|---------|
| `NETLIFY_AUTH_TOKEN` | Netlify → 头像 → User settings → Applications → Personal access tokens |
| `NETLIFY_SITE_ID` | Netlify → 站点 → Site configuration → General → API ID |

> GitHub Actions 为公开仓库提供**无限的免费构建分钟**数，配合 Netlify CLI 上传，实现"自动部署且零积分"的最佳体验。

---

## 总结

|  | 自动构建部署 | CLI 本地部署 |
|---|---|---|
| 积分消耗 | 15/次 | **0** |
| 月部署次数 | ~20 次 | **无限** |
| 部署速度 | 慢（2-5 分钟） | 快（本地构建 + 30 秒上传） |
| 自动化 | ✅ | 需手动执行 |
| 适合场景 | 少量更新 | **日常频繁更新** |
