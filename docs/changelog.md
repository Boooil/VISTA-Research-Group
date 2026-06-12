# VISTA Website 开发日志

> 维势研究组官网：从零到一的建站全记录。涵盖技术选型、CMS 集成、部署架构演进与性能优化。

---

## 项目概况

**VISTA Research Group**（维势研究组）聚焦三维战场态势可视化、仿真推演与智能辅助决策。

| 项目信息 | 详情 |
|----------|------|
| 网站地址 | [vista-research-group.netlify.app](https://vista-research-group.netlify.app) |
| 代码仓库 | [Boooil/VISTA-Research-Group](https://github.com/Boooil/VISTA-Research-Group) |
| 技术栈 | Hugo + HugoBlox + Decap CMS + Netlify |
| 总提交 | 38 commits |
| 线上页面 | 120 页 |
| 搜索索引 | 65 页，2503 个词条 |

---

## 技术架构

```
┌──────────────────────────────────────┐
│            Decap CMS                  │
│      (在线内容编辑 /admin/)           │
│      Netlify Identity 认证             │
│      Git Gateway → GitHub 提交        │
└──────────────┬───────────────────────┘
               │ 内容变更
               ▼
┌──────────────────────────────────────┐
│         Hugo Static Site Generator    │
│      HugoBlox Academic 主题           │
│      Hugo Modules 管理依赖             │
│      ESBuild 编译 JSX 组件             │
│      Pagefind 全文搜索（中文）          │
└──────────────┬───────────────────────┘
               │ 构建产物
               ▼
┌──────────────────────────────────────┐
│        GitHub Actions (CI/CD)         │
│      push → 自动构建 → 零积分部署     │
│      npm 依赖缓存 · Hugo 模块缓存      │
│      npx netlify-cli → Netlify CDN    │
└──────────────┬───────────────────────┘
               │ 托管
               ▼
┌──────────────────────────────────────┐
│            Netlify                     │
│      静态文件托管 · 全球 CDN            │
│      HTTPS · HTTP Headers             │
└──────────────────────────────────────┘
```

---

## 时间线

### Phase 1 — 基础设施搭建

**2026-05 ~ 2026-06-09**

- 基于 **Hugo 0.148.2** + **HugoBlox Academic** 主题搭建静态站点框架
- 配置 Hugo Modules 管理主题依赖，避免 vendor 代码耦合
- 通过 `config/_default/hugo.yaml` 集中管理站点元数据、Taxonomy、Permalink、Markdown 渲染等
- 首页采用 Landing Page 布局：Hero → Features → Projects → Posts → Publications → Team
- 部署到 **Netlify**，配置 `netlify.toml` 自动构建管道

**关键提交**：
| 序号 | 提交信息 | 说明 |
|------|---------|------|
| 1-12 | `action modify 1-13` | 初始建站，反复调试 Netlify 构建配置 |

---

### Phase 2 — Decap CMS 集成

**2026-06-09 ~ 2026-06-10**

引入 **Decap CMS**（原 Netlify CMS）实现在线内容编辑，让非技术人员也能通过 Web 界面维护网站内容。

**主要工作**：

- **基础设施**：创建 `static/admin/index.html` + `config.yml`，配置 Git Gateway 后端、Netlify Identity 认证
- **Collections 定义**（6 个内容类型）：
  - `authors` — 团队成员（头像、角色、研究方向、社交链接）
  - `post` — 成果动态（标题、作者关联、标签、封面图）
  - `project` — 科研项目（名称、摘要、外部链接）
  - `publication` — 论文著作（标题、作者关联、出版物类型、期刊/会议）
  - `pages` — 独立页面（Research / Resources / About）
  - `homepage` — 首页配置（标题编辑）
- **预览模板**：`static/admin/preview-templates.js` + `preview-styles.css`，CMS 编辑时实时预览
- **Relation Widget**：Post/Publication 的作者字段通过 CMS relation widget 关联 authors collection，下拉搜索自动补全
- **Ghost Entry 修复**：通过 `content_type` hidden field + collection filter 消除 CMS 中的 `_index.md` 幽灵条目
- **Pinyin 排序**：作者使用 `pinyin` 字段作为排序键，全小写无空格

**关键提交**：
| 序号 | 提交信息 | 说明 |
|------|---------|------|
| 13 | `feat: Phase 1 - Decap CMS infrastructure` | CMS 基础设施 |
| 14 | `feat: Decap CMS integration - collections config` | 全部 collections 配置 |
| 15 | `feat: Phase 4 - CMS preview templates` | 预览模板 |
| 16 | `fix: remove broken skeleton screen CSS` | 修复 CMS UI 阻塞 |
| 17-20 | `fix: filter out _index.md ghost entries` 系列 | Ghost 条目消灭 |
| 21 | `fix: relation widget saves correct pinyin` | 作者关联修复 |

---

### Phase 3 — 部署架构升级：零积分方案

**2026-06-12**

#### 背景

Netlify 计费规则变更：从"每月 300 构建分钟"改为"每月 300 积分"，每次自动构建消耗 **15 积分**，每月仅能部署约 20 次。对于需要频繁内容更新的学术网站，这严重不足。

#### 解决方案

用 **GitHub Actions 构建 + Netlify CLI 部署**替代 Netlify 自动构建：

```
之前（消耗积分）：
  git push → Netlify 检测 → Netlify 服务器 hugo build → 15 积分

现在（零积分）：
  git push → GitHub Actions → hugo build + pagefind
           → npx netlify-cli deploy --prod --dir=public → 0 积分
```

**关键决策**：

1. **为什么选 GitHub Actions** — 公开仓库无限免费，与 CMS（Git Gateway → GitHub 提交）天然适配
2. **为什么保留 Netlify 托管** — Netlify Identity（CMS 认证）、Git Gateway、全球 CDN 继续使用，只关闭自动构建（Stop builds）
3. **本地 CLI 作为备选** — `deploy.bat` 一键本地部署，紧急情况手动触发

#### 踩坑记录

| 问题 | 原因 | 解决 |
|------|------|------|
| `Could not resolve "preact"` | Hugo JSBUILD 需要 preact，但 GitHub Actions 无 `node_modules` | 添加 `npm install` 步骤 |
| `npm ci` 失败 | `package-lock.json` 与 `package.json` 不同步 | 改用 `npm install` |
| Hugo 模块重复下载 | 未缓存 `/tmp/hugo_cache_runner` | 添加 `actions/cache@v4` |
| netlify-cli 每次装 34 秒 | 全局安装不受 npm cache 覆盖 | 改用 `npx --yes netlify-cli` + 缓存 `~/.npm/_npx` |
| 构建跑了两次 | 我们的 Build 步骤 + netlify deploy 自动读 `netlify.toml` 又跑一遍 | 删除显式 Build 步骤，由 netlify deploy 统一执行 |

#### 最终 CI 管道

```yaml
name: Deploy to Netlify
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - Checkout (with submodules)
      - Setup Node.js 20 (cache: npm)
      - Setup Hugo 0.148.2 extended
      - Cache Hugo modules (/tmp/hugo_cache_runner)
      - Cache Netlify CLI npx (~/.npm/_npx)
      - npm install        ← 预装 preact 等依赖
      - npx netlify-cli deploy --prod --dir=public
                            ← 读 netlify.toml，自动构建+部署
```

**缓存命中率**：
- npm 依赖：181MB，首次后恢复仅 3s
- Hugo 模块：27MB，跳过重复下载
- npx netlify-cli：已加入缓存

**关键提交**：
| 序号 | 提交信息 | 说明 |
|------|---------|------|
| 22 | `feat: add GitHub Actions auto-deploy workflow + docs` | 初始 CI 管道 |
| 23 | `fix: add npm ci step to resolve preact dependency` | 修复 preact 缺失 |
| 24 | `fix: use npm install instead of npm ci` | lockfile 兼容 |
| 25 | `perf: add npm and Hugo module caching` | 缓存优化 |
| 26 | `perf: remove redundant build step, cache netlify CLI` | 去重+cache 补全 |

---

### Phase 4 — 内容填充

**2026-06-10 ~ 至今**

通过 CMS 在线编辑，陆续添加：

- 团队成员：6 人（含 Group Lead、在读博士、在读硕士）
- 成果动态：4 篇
- 论文著作：7 篇

---

## 功能特性

### 内容管理

| 特性 | 说明 |
|------|------|
| 在线编辑 | `https://vista-research-group.netlify.app/admin/` 登录即编 |
| 6 种内容类型 | 成员、动态、项目、论文、页面、首页 |
| 作者关联 | Post/Publication 通过 relation widget 关联 authors |
| 图片上传 | 拖拽上传 → Git Gateway → GitHub `static/uploads/` |
| 预览 & 草稿 | CMS 实时预览 + Netlify Identity 权限控制 |
| 中文化 UI | CMS 界面完整汉化（`locale: zh_Hans`） |

### 前端

| 特性 | 说明 |
|------|------|
| 响应式布局 | Tailwind CSS 4 + HugoBlox 组件体系 |
| 深色首页 Hero | 渐变背景（`#1e3a8a` → `#0f172a`） |
| 团队展示 | 按角色分组、拼音排序、头像 + 社交链接 |
| 论文引用视图 | Citation 格式列表 + publication_types 分类 |
| 全文搜索 | Pagefind 中文索引（65 页 / 2503 词条） |
| Math 渲染 | LaTeX 块级 + 行内公式（Goldmark passthrough） |

### 部署

| 特性 | 说明 |
|------|------|
| CI/CD 自动化 | CMS 编辑 / git push → GitHub Actions → 自动部署 |
| 零积分部署 | 脱离 Netlify 构建服务器，无部署次数限制 |
| 3 层缓存 | npm 依赖 + Hugo 模块 + npx 包 |
| 本地备选 | `deploy.bat` 一键本地部署 |
| 安全头 | X-Frame-Options DENY, X-Content-Type-Options nosniff |

---

## 目录结构

```
VISTA_Website/
├── .github/workflows/deploy.yml   # CI/CD 自动部署管道
├── config/_default/
│   ├── hugo.yaml                  # Hugo 核心配置
│   ├── menus.yaml                 # 导航菜单
│   └── params.yaml                # 主题参数
├── content/
│   ├── _index.md                  # 首页 (Landing Page)
│   ├── about/                     # 关于我们
│   ├── authors/                   # 团队成员 (6 人)
│   ├── post/                      # 成果动态 (4 篇)
│   ├── project/                   # 科研项目
│   ├── publication/               # 论文著作 (7 篇)
│   ├── research/                  # 研究方向
│   └── resources/                 # 资源下载
├── static/
│   ├── admin/                     # Decap CMS 配置 + 预览模板
│   └── uploads/                   # CMS 上传的图片
├── netlify.toml                   # Netlify 构建配置
├── package.json                   # npm 依赖 (preact, tailwindcss, pagefind)
├── deploy.bat                     # Windows 一键本地部署脚本
└── docs/                          # 项目文档
    ├── deploy-via-cli.md          # CLI 本地部署指南
    └── cms-github-actions-deploy.md # CMS + Actions 自动部署指南
```

---

## 技术债务 & 待改进

- [ ] `package-lock.json` 与 `package.json` 不同步，需本地 `npm install` 重新生成
- [ ] PR Preview（deploy-preview context）因关闭 Netlify 自动构建暂不可用，后续可评估在 Actions 中实现
- [ ] 首页 sections 结构复杂（sections YAML），目前 CMS 只能编辑标题，复杂配置仍需代码修改
- [ ] 缺少自动化测试（链接检查、HTML 验证等）
- [ ] 图片上传无尺寸限制/自动压缩

---

## 相关文档

- [Netlify CLI 本地部署指南](./deploy-via-cli.md)
- [CMS + GitHub Actions 零积分自动部署方案](./cms-github-actions-deploy.md)
- [Decap CMS 官方文档](https://decapcms.org/docs/intro/)
- [HugoBlox 文档](https://docs.hugoblox.com/)
