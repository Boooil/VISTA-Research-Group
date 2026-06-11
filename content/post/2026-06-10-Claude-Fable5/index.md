---
title: "Claude Fable 5：Anthropic 迈向 Mythos 级智能的里程碑"
content_type: post
date: 2026-06-10
authors:
  - WangBoyu
summary: "Anthropic 正式发布了其最新的旗舰 AI 模型 Claude Fable 5。这是 Anthropic 首次将其顶尖的Mythos级智能开放给公众使用。Fable 5 的定位在原有的旗舰模型 Opus 之上，旨在处理最具挑战性的软件工程、知识工作和长程自主任务。"
tags:
  - AI
  - Claude
categories:
  - News
featured: true
image:
  filename: featured.jpg
  caption: 
---

## 引言

2026年6月9日，Anthropic 正式发布了其最新的旗舰 AI 模型 **Claude Fable 5** [1]。这是 Anthropic 首次将其顶尖的 **Mythos 级（Mythos-class）** 智能开放给公众使用。Fable 5 的定位在原有的旗舰模型 Opus 之上，旨在处理最具挑战性的软件工程、知识工作和长程自主任务。

## 1. 核心特性与技术规格

Claude Fable 5 不仅仅是性能的微调，它代表了 AI 能力的一个阶跃。其底层架构与受限的 Claude Mythos 5 相同，但为大众使用增加了更严谨的安全防护层。

| 规格项目 | 详细参数 |
| :--- | :--- |
| **API 模型 ID** | claude-fable-5 |
| **模型等级** | Mythos-class (位于 Opus 4.8 之上) |
| **上下文窗口** | 1,000,000 Tokens (1M) |
| **最大输出** | 128,000 Tokens |
| **输入支持** | 文本、图像、文件 |
| **发布日期** | 2026年6月9日 |
| **数据保留** | 30天安全监控保留期 [2] |

> **“任务越长、越复杂，Fable 5 相较于我们其他模型的领先优势就越大。”** —— Anthropic 官方公告 [1]

## 2. 行业领先的基准测试（Benchmarks）

在多项关键基准测试中，Claude Fable 5 均刷新了行业纪录，特别是在编程和专业知识领域展现了压倒性的优势。

### 2.1 编程与软件工程
Fable 5 在 **SWE-Bench Pro** 上取得了 **80.3%** 的惊人成绩，比之前的领先模型（Opus 4.8）高出 11 个百分点，更是远超 GPT-5.5 的 58.6% [3]。

### 2.2 综合能力对比表

| 基准测试 | Fable 5 (Mythos) | Opus 4.8 | GPT-5.5 | Gemini 3.1 Pro |
| :--- | :---: | :---: | :---: | :---: |
| **SWE-Bench Pro (编程)** | **80.3%** | 69.2% | 58.6% | 54.2% |
| **GDPval-AA (专业知识 ELO)** | **1932** | 1890 | 1769 | 1314 |
| **Blueprint-Bench 2 (空间推理)** | **38.6%** | 14.5% | 36.2% | 26.5% |
| **Legal Agent (法律推理)** | **13.3%** | 10.4% | 2.1% | 0.0% |
| **OSWorld-Verified (计算机使用)** | **85.0%** | 83.4% | 78.7% | 76.2% |

*注：部分涉及网络安全和生物领域的测试（如 ExploitBench）在 Fable 5 中因安全防护会回退至 Opus 4.8 水平，而无限制的 Mythos 5 在这些领域表现更强 [3]。*

## 3. 实际应用效果与评价

### 3.1 现实世界的“生产力飞跃”
*   **Stripe 案例**：Stripe 报告称，Fable 5 在一天内完成了一个包含 5000 万行 Ruby 代码的迁移任务，而同样的任务如果由整个工程团队手动完成，预计需要超过两个月 [1]。
*   **视觉与游戏**：Fable 5 展现了极强的视觉自主能力，能够仅凭原始屏幕截图完成《宝可梦 火红版》游戏，无需任何额外的地图或导航辅助 [1]。

### 3.2 专家评价
前 OpenAI 科学家 Andrej Karpathy 将 Fable 5 称为“值得大版本号跨越的阶跃式进步”，并特别指出它在解决极难问题时的“自主思考感”显著增强 [2]。

## 4. 安全防护与回退机制

由于 Mythos 级模型具有极高的潜在能力，Anthropic 为 Fable 5 引入了**自动安全回退系统**：
*   当系统检测到涉及敏感网络安全、生物或化学攻击的查询时，会触发安全拦截。
*   被拦截的请求将由 **Claude Opus 4.8** 代为回答，并告知用户。
*   Anthropic 报告称，这种回退在平均不到 5% 的会话中发生 [1]。

## 5. 价格与访问方式

Fable 5 定位为高端生产力工具，价格约为 Opus 4.8 的两倍。

*   **输入价格**：$10 / 每百万 Tokens
*   **输出价格**：$50 / 每百万 Tokens
*   **Prompt 缓存**：命中缓存可享受 90% 的输入折扣 ($1 / MTok) [2]。

**访问渠道**：
*   **Claude.ai**：已面向 Pro、Max 和 Team 用户开放。
*   **API**：可通过 Anthropic 官方 API、Amazon Bedrock 和 Google Cloud Vertex AI 接入。
*   **GitHub Copilot**：正在逐步向企业和高级订阅用户推送 [2]。

---

## 参考文献

1. [Anthropic 官方公告：Claude Fable 5 and Claude Mythos 5](https://www.anthropic.com/news/claude-fable-5-mythos-5)
2. [TrueFoundry: Claude Fable 5: API, Benchmarks, Pricing & How to Use It](https://www.truefoundry.com/blog/claude-fable-5-api-benchmarks-pricing-how-to-use-it)
3. [Lushbinary: Claude Fable 5 vs GPT-5.5 vs Gemini 3.1 Pro Compared](https://lushbinary.com/blog/claude-fable-5-vs-gpt-5-5-vs-gemini-3-1-pro-comparison/)
