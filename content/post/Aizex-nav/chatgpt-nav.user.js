// ==UserScript==
// @name         ChatGPT 对话导航
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  在 ChatGPT 页面注入浮动导航面板，快速跳转到任意历史提问
// @match        https://mana-x.aizex.net/*
// @match        https://chatgpt.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const PANEL_ID = '__conv-nav-panel';
  const STORAGE_KEY = '__conv-nav-collapsed';
  const POS_KEY = '__conv-nav-pos';

  const styles = `
    #${PANEL_ID} {
      position: fixed;
      right: 16px;
      top: 50%;
      transform: translateY(-50%);
      width: 280px;
      max-height: 60vh;
      background: #2f2f2f;
      color: #ececec;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.4);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      transition: width 0.2s ease;
      overflow: hidden;
    }
    #${PANEL_ID}.collapsed {
      width: 40px;
      max-height: 40px;
      border-radius: 20px;
      cursor: grab;
      transform: none;
    }
    #${PANEL_ID}.collapsed:active {
      cursor: grabbing;
    }
    #${PANEL_ID} .__nav-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      background: #3f3f3f;
      border-radius: 12px 12px 0 0;
      cursor: pointer;
      user-select: none;
      flex-shrink: 0;
    }
    #${PANEL_ID}.collapsed .__nav-header {
      border-radius: 20px;
      padding: 0;
      width: 40px;
      height: 40px;
      justify-content: center;
    }
    #${PANEL_ID} .__nav-title {
      font-weight: 600;
      font-size: 13px;
      white-space: nowrap;
      overflow: hidden;
    }
    #${PANEL_ID}.collapsed .__nav-title {
      display: none;
    }
    #${PANEL_ID} .__nav-toggle {
      font-size: 11px;
      opacity: 0.6;
      flex-shrink: 0;
    }
    #${PANEL_ID}.collapsed .__nav-toggle {
      display: none;
    }
    #${PANEL_ID} .__nav-icon {
      display: none;
    }
    #${PANEL_ID}.collapsed .__nav-icon {
      display: block;
      font-size: 20px;
      line-height: 1;
    }
    #${PANEL_ID} .__nav-body {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      flex: 1;
    }
    #${PANEL_ID}.collapsed .__nav-body {
      display: none;
    }
    #${PANEL_ID} .__nav-search {
      margin: 8px 10px 4px;
      padding: 6px 10px;
      background: #1e1e1e;
      border: 1px solid #555;
      border-radius: 6px;
      color: #ececec;
      font-size: 12px;
      outline: none;
      flex-shrink: 0;
    }
    #${PANEL_ID} .__nav-search::placeholder {
      color: #888;
    }
    #${PANEL_ID} .__nav-list {
      overflow-y: auto;
      flex: 1;
      padding: 4px 0 8px;
    }
    #${PANEL_ID} .__nav-list::-webkit-scrollbar {
      width: 4px;
    }
    #${PANEL_ID} .__nav-list::-webkit-scrollbar-thumb {
      background: #555;
      border-radius: 2px;
    }
    #${PANEL_ID} .__nav-item {
      padding: 7px 12px;
      cursor: pointer;
      border-left: 2px solid transparent;
      line-height: 1.4;
      transition: background 0.15s;
    }
    #${PANEL_ID} .__nav-item:hover {
      background: #3f3f3f;
      border-left-color: #19c37d;
    }
    #${PANEL_ID} .__nav-num {
      color: #19c37d;
      font-weight: 600;
      font-size: 11px;
      margin-bottom: 2px;
    }
    #${PANEL_ID} .__nav-text {
      color: #ccc;
      font-size: 12px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #${PANEL_ID} .__nav-empty {
      padding: 12px;
      color: #888;
      text-align: center;
      font-size: 12px;
    }
  `;

  function injectStyles() {
    if (document.getElementById('__conv-nav-styles')) return;
    const el = document.createElement('style');
    el.id = '__conv-nav-styles';
    el.textContent = styles;
    document.head.appendChild(el);
  }

  function getUserTurns() {
    const turns = document.querySelectorAll('[data-testid^="conversation-turn"]');
    const result = [];
    let qIndex = 1;
    turns.forEach(turn => {
      const roleEl = turn.querySelector('[data-message-author-role]');
      if (!roleEl || roleEl.getAttribute('data-message-author-role') !== 'user') return;
      let text = roleEl.innerText || '';
      // 去除 "你说：" 前缀
      text = text.replace(/^你说[：:]\s*/m, '').trim();
      result.push({ index: qIndex++, text: text.slice(0, 80), el: turn });
    });
    return result;
  }

  function renderList(items, filter, listEl) {
    listEl.innerHTML = '';
    const query = (filter || '').toLowerCase();
    const filtered = query
      ? items.filter(i => i.text.toLowerCase().includes(query))
      : items;

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = '__nav-empty';
      empty.textContent = query ? '无匹配结果' : '暂无提问';
      listEl.appendChild(empty);
      return;
    }

    filtered.forEach(item => {
      const div = document.createElement('div');
      div.className = '__nav-item';
      div.innerHTML = `<div class="__nav-num">Q${item.index}</div><div class="__nav-text" title="${item.text.replace(/"/g, '&quot;')}">${item.text}</div>`;
      div.addEventListener('click', () => {
        item.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      listEl.appendChild(div);
    });
  }

  function createPanel() {
    const panel = document.createElement('div');
    panel.id = PANEL_ID;

    const collapsed = localStorage.getItem(STORAGE_KEY) === '1';
    if (collapsed) panel.classList.add('collapsed');

    // 恢复收起时的拖拽位置
    const savedPos = (() => {
      try { return JSON.parse(localStorage.getItem(POS_KEY)); } catch { return null; }
    })();
    if (collapsed && savedPos) {
      panel.style.right = 'auto';
      panel.style.top = savedPos.top + 'px';
      panel.style.left = savedPos.left + 'px';
      panel.style.transform = 'none';
    }

    panel.innerHTML = `
      <div class="__nav-header">
        <span class="__nav-icon">💬</span>
        <span class="__nav-title">💬 对话导航</span>
        <span class="__nav-toggle">${collapsed ? '' : '收起'}</span>
      </div>
      <div class="__nav-body">
        <input class="__nav-search" type="text" placeholder="搜索提问…" />
        <div class="__nav-list"></div>
      </div>
    `;

    const header = panel.querySelector('.__nav-header');
    const toggle = panel.querySelector('.__nav-toggle');
    const searchEl = panel.querySelector('.__nav-search');
    const listEl = panel.querySelector('.__nav-list');

    let items = getUserTurns();
    renderList(items, '', listEl);

    // 收起/展开
    header.addEventListener('click', (e) => {
      if (panel._dragged) { panel._dragged = false; return; }
      const isCollapsed = panel.classList.toggle('collapsed');
      toggle.textContent = isCollapsed ? '' : '收起';
      localStorage.setItem(STORAGE_KEY, isCollapsed ? '1' : '0');
      if (isCollapsed) {
        // 收起时恢复上次拖拽位置（如有），否则保持当前右侧居中
        const pos = (() => {
          try { return JSON.parse(localStorage.getItem(POS_KEY)); } catch { return null; }
        })();
        if (pos) {
          panel.style.left = pos.left + 'px';
          panel.style.top = pos.top + 'px';
          panel.style.right = 'auto';
          panel.style.transform = 'none';
        } else {
          panel.style.left = 'auto';
          panel.style.right = '16px';
          panel.style.top = '50%';
          panel.style.transform = 'translateY(-50%)';
        }
      } else {
        // 展开时始终恢复默认右侧居中位置
        panel.style.left = 'auto';
        panel.style.right = '16px';
        panel.style.top = '50%';
        panel.style.transform = 'translateY(-50%)';
      }
    });

    // 收起状态下支持拖拽
    panel.addEventListener('mousedown', (e) => {
      if (!panel.classList.contains('collapsed')) return;
      const startX = e.clientX;
      const startY = e.clientY;
      const rect = panel.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      panel._dragged = false;

      function onMove(e) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) panel._dragged = true;
        if (!panel._dragged) return;
        const newLeft = e.clientX - offsetX;
        const newTop = e.clientY - offsetY;
        panel.style.left = newLeft + 'px';
        panel.style.top = newTop + 'px';
        panel.style.right = 'auto';
        panel.style.transform = 'none';
      }

      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if (panel._dragged) {
          localStorage.setItem(POS_KEY, JSON.stringify({
            left: parseInt(panel.style.left),
            top: parseInt(panel.style.top)
          }));
        }
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    searchEl.addEventListener('input', () => {
      renderList(items, searchEl.value, listEl);
    });

    panel._refresh = () => {
      items = getUserTurns();
      renderList(items, searchEl.value, listEl);
    };

    document.body.appendChild(panel);
    return panel;
  }

  function init() {
    injectStyles();

    // 移除旧面板
    const old = document.getElementById(PANEL_ID);
    if (old) old.remove();

    const panel = createPanel();

    // 监听 DOM 变化，自动刷新列表
    const observer = new MutationObserver(() => {
      if (panel._refreshTimer) clearTimeout(panel._refreshTimer);
      panel._refreshTimer = setTimeout(() => panel._refresh(), 500);
    });

    const target = document.querySelector('main') || document.body;
    observer.observe(target, { childList: true, subtree: true });
  }

  // 等待页面主体加载后再初始化
  function waitAndInit() {
    if (document.querySelector('[data-testid^="conversation-turn"]')) {
      init();
      return;
    }
    const observer = new MutationObserver(() => {
      if (document.querySelector('[data-testid^="conversation-turn"]')) {
        observer.disconnect();
        init();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitAndInit);
  } else {
    waitAndInit();
  }

  // 处理 SPA 路由切换（ChatGPT 是单页应用）
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(waitAndInit, 800);
    }
  }).observe(document.body, { childList: true, subtree: true });

})();
