---
title: "给Aizex-ChatGPT 装一个对话导航面板"
slug: Aizex-nav
content_type: post
date: 2026-06-22
authors:
  - WangBoyu
summary: "用一个油猴脚本，解决长对话里找不到历史提问的问题。"
tags:
  - 网页效率工具
categories:
  - preview
math: true
featured: true
---

## Aizex Panel

Aizex是一个基于GPT原生UI的“GPT X 聚合多系列模型”使用方案。

提供GPT、Claude、Gemini、Grok等一系列LLM。

https://aizex.net/

---

## 痛点

在对话时，一个对话往往会积累几十轮问答。想回头看某个问题，只能靠鼠标滚轮一路翻，或者拖动右侧滚动条盲猜位置。内容一多，这个过程非常低效。

理想的状态是：有一个侧边目录，把我所有的提问列出来，点一下就跳过去。

---

## 思路

Aizex Panel-ChatGPT 是 React 单页应用，每一轮对话都有稳定的 DOM 标记：

```
data-testid="conversation-turn-1"
data-testid="conversation-turn-2"
...
```

用户消息和 AI 回复通过 `data-message-author-role` 区分：

```
data-message-author-role="user"
data-message-author-role="assistant"
```

有了这两个锚点，就可以在不修改网站源码的情况下，用油猴脚本向页面注入一个浮动导航面板。

---

## 实现

### 安装方式

1. 浏览器安装 [Tampermonkey](https://www.tampermonkey.net/) 扩展（Chrome / Edge 均可）
2. 新建脚本，把 `chatgpt-nav.user.js` 的内容粘贴进去，保存
3. 访问 `https://mana-x.aizex.net/` 或 `https://chatgpt.com/` 任意对话页面，面板自动出现

### 脚本结构

```
chatgpt-nav.user.js
├── 样式注入        — 暗色主题浮动面板，与 ChatGPT 界面协调
├── getUserTurns()  — 扫描 DOM，提取所有用户提问
├── renderList()    — 渲染列表，支持关键词过滤
├── createPanel()   — 创建面板，绑定交互事件
├── init()          — 初始化，启动 MutationObserver 监听新消息
└── waitAndInit()   — 等待对话内容加载完成后再初始化
```

### 核心功能

**提问列表**

扫描页面所有 `conversation-turn-*` 节点，过滤出 `role="user"` 的轮次，提取前 80 字作预览，去掉 "你说：" 等界面前缀后显示为 `Q1`、`Q2`... 的编号列表。点击任意条目，页面平滑滚动到对应位置。

**实时搜索**

面板顶部有搜索框，输入关键词后列表实时过滤，大小写不敏感。

**收起 / 展开**

点击标题栏可以将面板收起为一个 40px 的圆形气泡（只显示 💬 图标），不遮挡阅读区域。状态存入 `localStorage`，刷新页面后保持。

**收起状态可拖拽**

收起后的气泡支持拖动到屏幕任意位置。松手后位置自动保存，下次收起时恢复到上次拖放的位置。展开状态始终回到右侧居中的默认位置。

用 4px 的移动阈值区分"点击展开"和"拖动移位"，两个操作不会互相干扰。

**自动刷新**

用 `MutationObserver` 监听对话区域的 DOM 变化，新消息出现后 500ms 内自动刷新导航列表。

**SPA 路由感知**

ChatGPT 切换对话不会刷新页面，脚本通过对比 `location.href` 检测路由变化，打开新对话时自动重新初始化面板。

---

## 关键细节

**拖拽与点击的区分**

mousedown 时记录起始坐标，mousemove 时判断位移是否超过 4px，超过才标记为拖拽。mouseup 时如果是拖拽则保存位置、阻止 click 触发展开；如果没有移动则正常展开。

```js
panel.addEventListener('mousedown', (e) => {
  const startX = e.clientX, startY = e.clientY;
  panel._dragged = false;
  function onMove(e) {
    if (Math.abs(e.clientX - startX) > 4 || Math.abs(e.clientY - startY) > 4)
      panel._dragged = true;
    // ...移动面板
  }
  // ...
});

header.addEventListener('click', (e) => {
  if (panel._dragged) { panel._dragged = false; return; }
  // ...切换展开/收起
});
```

**收起气泡的尺寸问题**

最初把标题 "💬 对话导航" 也放在收起状态里，但 40px 的宽度装不下，文字会被 `overflow: hidden` 截断。解决方案是在 HTML 里维护两套内容：展开时显示标题和"收起"按钮，收起时只显示独立的 `.__nav-icon` 元素，通过 CSS 互相切换显隐。

---

## 适配范围

脚本的 `@match` 规则覆盖两个域名：

```
https://mana-x.aizex.net/*   — Aizex 合租面板代理的 ChatGPT
https://chatgpt.com/*        — ChatGPT 官网
```

两者的 DOM 结构相同（均为 ChatGPT 前端），无需额外适配。

---

## 效果

![效果图](./1.jpg)

---

## 文件

| 文件 | 说明 |
|------|------|
| `chatgpt-nav.user.js` | 油猴脚本本体，安装到 Tampermonkey 即可使用。 |

[下载代码](./chatgpt-nav.user.js)

---

*开发于 2026-06-22，使用 Kiro + playwright-cli 辅助调试页面结构。*
