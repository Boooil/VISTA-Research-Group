---
title: "用 Agent Skill 重构网页应用测试"
content_type: post
date: 2026-06-11
authors:
  - MengQingxin
tags: 
  - Claude Code
  - Agent Skills 
  - Playwright
  - E2E
  - 自动化测试
  - AI Agent
summary: "我们提出一个Skills，可以将网页应用测试从传统脚本驱动，推进到“AI 动态操作浏览器 + 稳定路径沉淀为脚本 + Markdown 报告交付”的工作流。"
categories:
  - preview
math: true
featured: true
---

如果说过去的自动化测试更像“写好脚本，然后让机器重复执行”，那么这个仓库展示的是另一种思路：让 AI Agent 先像真实用户一样进入浏览器、观察界面、操作产品、读取后端响应与日志，再把值得长期回归的流程沉淀成可复跑脚本。

仓库地址：[Mencius2023/skills](https://github.com/Mencius2023/skills)

## 1. 这个仓库是什么？

`Mencius2023/skills` 是一个个人维护的 Claude Code / Agent Skills 集合。当前仓库的核心内容是一个名为 `web-app-test` 的 skill，用于网页应用自动化测试。

它的目标不是简单提供几个 Playwright 脚本模板，而是定义一套面向 AI Agent 的测试工作流：

- 用 Playwright 驱动真实浏览器；
- 模拟真实用户在前端界面中的操作；
- 连接真实后端，不做 mock；
- 同时检查 API 返回、HTTP 状态码、后端日志和页面截图；
- 对值得长期回归的流程，动态沉淀为 Playwright spec；
- 每轮测试结束后输出 Markdown 测试报告。

这使它更像一个“测试方法论 + 脚手架 + Agent 执行规范”的组合，而不只是一个代码模板仓库。

## 2. 仓库结构概览

仓库结构很简洁：

```text
skills/
└── web-app-test/
    ├── SKILL.md
    └── templates/
        ├── README.md
        ├── TEST_SPECIFICATION.template.md
        ├── run_regression.template.py
        ├── playwright.config.template.js
        └── standard-flow.spec.template.js
```

其中最重要的文件有三类：

| 文件 | 作用 |
|---|---|
| `README.md` | 仓库入口，说明 skill 列表、安装方式和结构约定 |
| `skills/web-app-test/SKILL.md` | 核心规范，定义网页应用测试的执行原则、分层策略、动态浏览器测试方法、报告格式等 |
| `templates/` | 新项目接入时使用的通用脚手架，落地后生成项目专属的测试规格书、回归运行器和 Playwright 配置 |

这个设计有一个非常重要的边界：**skill 本体是通用资产，项目测试文件是项目专属资产**。也就是说，`SKILL.md` 和 `templates/` 留在 skill 仓库中，而某个具体项目的 `TEST_SPECIFICATION.md`、测试脚本、操作指南等应该落到该项目根目录下的 `web-app-test/` 中，并跟随项目自己的 Git 仓库维护。

## 3. web-app-test 的核心定位

`web-app-test` 面向的是网页应用质量验证场景。只要用户提出“测网页”“测前端”“浏览器测试”“Playwright”“E2E”“端到端测试”“跑测试”“回归测试”“CI”“提交前检查”等需求，或者改动了前后端代码后想确认功能没有回归，就可以使用这个 skill。

它尤其强调两点：

第一，浏览器测试要连接真实后端。  
测试不是拦截请求、伪造数据、只看页面状态，而是尽可能贴近真实用户路径，验证前后端真实集成行为。

第二，AI 不是只执行脚本，而是参与判断。  
Agent 在浏览器中截图观察页面，用视觉能力判断 UI 是否符合用户预期，同时结合 API 响应和后端日志确认逻辑路径是否正确。

这和传统 E2E 测试的区别很明显：传统测试通常依赖预先写好的选择器和断言；这个 skill 则把 AI 的现场观察能力纳入测试闭环，用动态执行来抵抗前端界面频繁变化带来的脚本脆弱性。

## 4. 测试分为两大类

`SKILL.md` 中最关键的设计，是把测试分成两类，并明确两类脚本采用相反的设计策略。

### 4.1 程序测试脚本：必须预先设计

这类测试不涉及浏览器，主要直接调用后端模块、API 或构建命令，验证数据层、配置层、核心逻辑、API 契约、前端构建等。

它们是整个测试体系的“稳定底座”，应该在项目接入时就设计好，并且覆盖主要功能：

- L0：冒烟测试与基础依赖检查；
- L1：前端单元测试；
- L2：后端核心功能测试；
- L3：前端构建与静态检查；
- L5 或等价层级：真实 API 集成测试。

这类测试适合无人值守、批量复跑，也适合 CI。规格书里如果写了用例，却没有对应脚本或可直接运行命令，就会被视为未完成。

### 4.2 浏览器模拟用户操作：不预先写满，动态沉淀

另一类测试是浏览器 E2E。它使用 Playwright 驱动真实浏览器，模拟用户完整操作流程，并连接真实后端。

但仓库并不主张一开始就把所有浏览器流程都写成 Playwright 脚本。原因很实际：前端页面变化快，选择器、布局、弹窗、流程都可能变，提前写满脚本会带来高维护成本。

因此，`web-app-test` 的策略是：

1. 默认由 AI 动态接入浏览器；
2. AI 根据页面截图、源码和用户指南现场判断下一步操作；
3. 每个关键步骤后截图并检查 API / 日志；
4. 功能测完后再判断：这条测试以后是否需要回归？
5. 如果值得长期回归，再沉淀为 Playwright spec；
6. 如果流程细节容易变，但操作路径有参考价值，则沉淀为操作手册，例如 `L4_OPERATION_GUIDE.md`。

这是一种“先探索，再固化”的测试资产治理方式。

## 5. 一条完整测试链路是怎样的？

按照 skill 的设计，AI 执行浏览器测试时不是简单点击页面，而是进行一个循环：

```text
观察页面截图
  ↓
理解当前 UI 状态
  ↓
决定下一步用户操作
  ↓
通过 Playwright CLI 执行操作
  ↓
检查 API 响应 / HTTP 状态码
  ↓
读取后端日志
  ↓
再次截图并用视觉能力判断 UI 是否正确
  ↓
记录产物与结论
```

这个流程有两个验证维度：

| 验证方式 | 关注点 |
|---|---|
| API 返回值 + 后端日志 | 请求是否成功、数据结构是否符合预期、后端路径是否正确执行 |
| 截图 + 视觉判断 | 页面布局、面板状态、主题色、弹窗、画布、生成结果等用户可见体验是否正常 |

这非常适合测试现代 Web 应用，尤其是那些“接口返回成功但页面实际表现不对”的场景。

## 6. 测试资产如何落地到项目？

仓库要求具体项目中维护自己的 `web-app-test/` 目录：

```text
<被测项目根>/
└── web-app-test/
    ├── TEST_SPECIFICATION.md
    ├── L4_OPERATION_GUIDE.md
    ├── <其他分支文档>.md
    └── scripts/
        ├── run_regression.py
        ├── playwright.config.js
        └── <flow>.spec.js
```

其中：

- `TEST_SPECIFICATION.md` 是测试规格书，也是所有脚本的唯一索引；
- `scripts/` 下的每个脚本都必须登记到规格书附录；
- 不允许出现“孤儿脚本”，即存在于 `scripts/` 但在规格书里找不到的脚本；
- `L4_OPERATION_GUIDE.md` 等分支文档用于记录浏览器 UI 操作细节，避免主文档过长。

这个约定解决了一个常见问题：测试脚本散落在项目各处，时间一久没人知道哪些脚本还能跑、覆盖了哪些功能、失败后该如何复现。这里通过规格书统一索引，把测试资产纳入项目治理。

## 7. 新项目接入流程

当一个项目还没有 `web-app-test/`，或者已有内容明显来自其他项目时，就需要执行新项目落地流程。

大致步骤如下：

1. 在被测项目根目录创建 `web-app-test/` 和 `web-app-test/scripts/`；
2. 阅读当前项目的前端源码、后端源码、API 文档和用户指南；
3. 从 skill 的 `templates/` 中复制模板；
4. 把模板中的 `<产品名>`、`<前端目录>`、`<后端端口>`、`<前端健康检查>` 等占位符替换成项目真实值；
5. 删除不适用的层级或用例；
6. 补齐程序测试脚本和可执行命令；
7. 将 `web-app-test/` 纳入项目自己的版本控制。

模板映射关系如下：

| skill 模板 | 落地到项目中 |
|---|---|
| `templates/TEST_SPECIFICATION.template.md` | `web-app-test/TEST_SPECIFICATION.md` |
| `templates/run_regression.template.py` | `web-app-test/scripts/run_regression.py` |
| `templates/playwright.config.template.js` | `web-app-test/scripts/playwright.config.js` |
| `templates/standard-flow.spec.template.js` | `web-app-test/scripts/<flow>.spec.js` |

## 8. 模板目录提供了什么？

`templates/` 是这个仓库的可复用脚手架。

### 8.1 `TEST_SPECIFICATION.template.md`

这是测试规格书模板。它按测试层级组织：

- L0 冒烟测试；
- L1 前端单元测试；
- L2 后端核心功能测试；
- L3 前端构建与静态检查；
- L4 浏览器 E2E 测试。

L4 又进一步区分：

- API 契约：纯 HTTP 请求，预先设计，适合批量复跑；
- 浏览器流程：默认由 AI 动态操作，测完后按需沉淀。

规格书还包含若干附录，例如：

- `data-testid` 选择器契约；
- fixture 数据；
- 浏览器测试环境配置；
- 脚本清单。

这让测试文档不只是说明文档，而是测试执行入口、脚本索引和环境手册。

### 8.2 `run_regression.template.py`

这是非交互式回归运行器，也是 CI 的首选入口。

它按测试金字塔从 L0 到 L4 逐层执行：

```text
L0 冒烟 + 数据完整性
L1 前端单元测试
L2 配置回归 + 离线核心功能
L3 前端生产构建
L4 浏览器 E2E
```

运行器采用 fail-fast 策略：某一层失败后立即中断并返回退出码。这适合 CI 节省资源。但 skill 同时强调，AI 手动执行测试时不应被 fail-fast 限制，应尽量跑完更多用例，一次性收集完整问题。

### 8.3 `playwright.config.template.js`

这是 Playwright 配置模板，包含：

- `baseURL`；
- Chromium 项目；
- viewport；
- screenshot 策略；
- trace 策略；
- HTML 报告目录；
- webServer 自动拉起；
- 是否复用已有前端服务。

它把浏览器测试运行环境规范化，避免每个项目重复配置。

### 8.4 `standard-flow.spec.template.js`

这是 API 契约与浏览器流程的 spec 骨架。

它把一个 Playwright spec 分成两部分：

1. API 契约断言：健康检查、配置接口、错误处理、主要端点；
2. 浏览器流程：页面加载、核心业务全流程等稳定路径。

不稳定、易变化的浏览器 UI 交互不会一开始就写进 spec，而是由 AI 动态测试后再决定是否沉淀。

## 9. 安装与依赖

仓库 README 推荐使用 `skills.sh` CLI 安装指定 skill：

```bash
# 安装到当前项目
npx skills add Mencius2023/skills@web-app-test

# 安装到全局
npx skills add Mencius2023/skills@web-app-test -g -y
```

也可以手动安装：

```bash
git clone https://github.com/Mencius2023/skills.git
cp -r skills/skills/web-app-test ~/.claude/skills/web-app-test
```

`web-app-test` 依赖 `playwright-cli` skill，需要额外安装：

```bash
npm install -g @playwright/cli@latest
playwright-cli install
playwright-cli --version
```

如果不希望全局安装，也可以使用 `npx playwright-cli` 的方式运行。

## 10. 测试结束后必须交付 Markdown 报告

这个 skill 对测试交付物有明确要求：每轮测试结束后必须产出 Markdown 测试报告，而不是只在对话里口头总结。

报告建议包含：

- 测试范围；
- 通过 / 失败 / 跳过数量；
- 环境信息；
- 详细测试结果；
- 发现的问题；
- 本轮已修复内容；
- 新增或更新的自动化脚本；
- 待用户确认事项。

这一点很重要。因为 AI Agent 执行测试时会产生大量即时判断，如果没有报告固化，测试过程就会变成不可追溯的聊天记录。Markdown 报告把一次测试转化为可归档、可审查、可复盘的工程产物。

## 11. 失败不是只有“代码 bug”

`web-app-test` 对失败原因也做了分类：

| 类型 | 含义 | 处理方式 |
|---|---|---|
| 类型 A | 测试脚本 fixture、前置条件或断言逻辑有问题 | AI 可自行修复测试 |
| 类型 B | 产品 Feature 发生有意变更，旧测试预期过时 | AI 可更新测试预期 |
| 类型 C | 文档或设计未说明的意外回归 | 汇报用户，等待确认修复方向 |

这套分类避免了两个极端：

- 一看到测试失败就改代码；
- 一看到测试失败就改测试让它通过。

它要求 Agent 先判断根因，再决定是修脚本、改预期，还是报告真实 bug。

## 12. 这个仓库适合什么场景？

这个 skill 尤其适合以下场景：

- 前后端分离的 Web 应用；
- 页面交互复杂、纯 API 测试覆盖不够的产品；
- 需要频繁回归但 UI 又经常变化的项目；
- 有 LLM 生成结果、输出不完全确定的应用；
- 希望把 AI Agent 纳入测试流程的团队；
- 想把测试规格、脚本、报告统一治理的项目。

相对不适合的场景包括：

- 纯后端库，没有浏览器交互；
- 产品极小、没有持续回归需求；
- 团队只需要传统 CI 单元测试，不需要 AI 现场判断；
- 无法提供真实后端或测试环境的项目。

## 13. 这个设计最有价值的地方

我认为这个仓库最值得借鉴的不是具体代码量，而是它对 AI Agent 测试角色的重新定义。

它没有把 Agent 当作“自动生成 Playwright 脚本的工具”，而是把 Agent 放进一个完整测试生命周期：

```text
理解项目
  → 维护测试规格
  → 启动真实环境
  → 动态操作浏览器
  → 结合视觉、API、日志判断问题
  → 分类处理失败
  → 沉淀可复用脚本
  → 输出 Markdown 报告
```

这使测试从“一堆脚本”变成了“一套可演进的工程流程”。

## 14. 可以继续增强的方向

从博客解读视角看，这个仓库后续还可以补充一些内容，让它更容易被外部用户采用：

1. 增加一个完整示例项目，展示从模板落地到报告产出的全过程；
2. 提供一份真实的 `TEST_SPECIFICATION.md` 示例；
3. 补充 GitHub Actions / CI 配置示例；
4. 增加 FAQ，例如如何处理登录态、鉴权、外部服务调用、LLM 超时；
5. 明确许可证，便于他人复用；
6. 提供更多 skill，例如 API 测试、文档测试、性能冒烟测试等。

这些不是当前仓库的缺陷，而是一个个人 skill 集合走向通用工具包时自然会遇到的下一步。

## 15. 总结

`Mencius2023/skills` 当前体量不大，但它提出了一个很有实践价值的方向：让 AI Agent 不只是写测试，而是参与测试设计、执行、判断和资产沉淀。

其中的 `web-app-test` skill 把网页应用测试拆成两条线：

- 稳定、底层、可无人值守的程序测试，必须预先设计；
- 脆弱、界面相关、需要用户视角判断的浏览器测试，先由 AI 动态执行，再按需沉淀为脚本。

这种分工非常贴合现实中的 Web 应用测试难题：核心逻辑要稳定回归，界面流程又不能被过度僵化的脚本绑死。

如果你正在尝试把 Claude Code、Playwright 和 AI Agent 工作流结合起来，用于前端 / 全栈项目测试，这个仓库值得一读。它的价值不在于提供了多少现成代码，而在于提供了一套可落地、可演进、可追溯的 Agentic Testing 方法论。

---

## 参考链接

- 仓库首页：<https://github.com/Mencius2023/skills>
- `web-app-test` skill：<https://github.com/Mencius2023/skills/tree/main/skills/web-app-test>
- `SKILL.md`：<https://github.com/Mencius2023/skills/blob/main/skills/web-app-test/SKILL.md>
- 模板目录：<https://github.com/Mencius2023/skills/tree/main/skills/web-app-test/templates>
- `TEST_SPECIFICATION.template.md`：<https://github.com/Mencius2023/skills/blob/main/skills/web-app-test/templates/TEST_SPECIFICATION.template.md>
- `run_regression.template.py`：<https://github.com/Mencius2023/skills/blob/main/skills/web-app-test/templates/run_regression.template.py>
- `playwright.config.template.js`：<https://github.com/Mencius2023/skills/blob/main/skills/web-app-test/templates/playwright.config.template.js>
- `standard-flow.spec.template.js`：<https://github.com/Mencius2023/skills/blob/main/skills/web-app-test/templates/standard-flow.spec.template.js>
