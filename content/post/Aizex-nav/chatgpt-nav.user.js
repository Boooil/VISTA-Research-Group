// ==UserScript==
// @name         ChatGPT 对话导航
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  在 ChatGPT 页面注入浮动导航面板，快速跳转到任意历史提问；支持导出选中提问为 Markdown
// @match        https://*.memofun.net/*
// @match        https://*.aizex.net/*
// @match        https://chatgpt.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const PANEL_ID = '__conv-nav-panel';
  const STORAGE_KEY = '__conv-nav-collapsed';
  const POS_KEY = '__conv-nav-pos';
  const WIDTH_KEY = '__conv-nav-width';

  const styles = `
    #${PANEL_ID} {
      position: fixed;
      right: 16px;
      top: 50%;
      transform: translateY(-50%);
      width: 280px;
      min-width: 180px;
      max-width: 480px;
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
      overflow: hidden;
    }
    #${PANEL_ID} .__nav-resize-handle {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 6px;
      cursor: ew-resize;
      z-index: 1;
      border-radius: 12px 0 0 12px;
    }
    #${PANEL_ID} .__nav-resize-handle:hover,
    #${PANEL_ID} .__nav-resize-handle:active {
      background: rgba(25, 195, 125, 0.25);
    }
    #${PANEL_ID}.collapsed {
      width: 40px !important;
      min-width: 40px !important;
      max-width: 40px !important;
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
      display: flex;
      align-items: flex-start;
      gap: 6px;
    }
    #${PANEL_ID} .__nav-item:hover {
      background: #3f3f3f;
      border-left-color: #19c37d;
    }
    #${PANEL_ID} .__nav-item.selected {
      background: rgba(25, 195, 125, 0.1);
    }
    #${PANEL_ID} .__nav-checkbox-wrap {
      flex-shrink: 0;
      padding-top: 2px;
      line-height: 1;
    }
    #${PANEL_ID} .__nav-checkbox {
      width: 13px;
      height: 13px;
      accent-color: #19c37d;
      cursor: pointer;
      margin: 0;
    }
    #${PANEL_ID} .__nav-item-content {
      flex: 1;
      min-width: 0;
      cursor: pointer;
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
    /* --- 工具栏 --- */
    #${PANEL_ID} .__nav-toolbar {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-bottom: 1px solid #444;
      flex-shrink: 0;
    }
    #${PANEL_ID} .__nav-select-all-label {
      font-size: 11px;
      color: #aaa;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      user-select: none;
    }
    #${PANEL_ID} .__nav-select-all-check {
      width: 13px;
      height: 13px;
      accent-color: #19c37d;
      cursor: pointer;
      margin: 0;
    }
    #${PANEL_ID} .__nav-selection-count {
      font-size: 11px;
      color: #19c37d;
      display: none;
    }
    #${PANEL_ID} .__nav-selection-count strong {
      font-weight: 700;
    }
    #${PANEL_ID} .__nav-export-btn {
      margin-left: auto;
      padding: 3px 10px;
      background: #19c37d;
      color: #fff;
      border: none;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }
    #${PANEL_ID} .__nav-export-btn:hover:not(:disabled) {
      background: #15a76b;
    }
    #${PANEL_ID} .__nav-export-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  `;

  function injectStyles() {
    if (document.getElementById('__conv-nav-styles')) return;
    const el = document.createElement('style');
    el.id = '__conv-nav-styles';
    el.textContent = styles;
    document.head.appendChild(el);
  }

  // 尝试多种选择器，兼容不同版本的 memofun.net / ChatGPT DOM 结构
  function getConversationTurns() {
    const selectors = [
      '[data-testid^="conversation-turn"]',
      '[data-testid^="chat-turn"]',
      '[class*="ConversationTurn"]',
      '[class*="conversation-turn"]',
      'article[data-scroll-anchor]',
      'article',
    ];
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) return els;
    }
    return [];
  }

  // 检测一个 turn 元素的角色
  function detectRole(turnEl) {
    const roleEl = turnEl.querySelector('[data-message-author-role]');
    if (roleEl) {
      return roleEl.getAttribute('data-message-author-role') || null;
    }
    // 降级判断
    const hasAssistant = turnEl.querySelector('[class*="assistant"], [aria-label*="ChatGPT"], [aria-label*="assistant"]');
    if (hasAssistant) return 'assistant';
    const hasUser = turnEl.querySelector('[class*="user"], [aria-label*="You"], [aria-label*="user"]');
    if (hasUser) return 'user';
    return null;
  }

  function getUserTurns() {
    const turns = getConversationTurns();
    const result = [];
    let qIndex = 1;
    turns.forEach(turn => {
      if (detectRole(turn) !== 'user') return;
      const roleEl = turn.querySelector('[data-message-author-role]');
      const textEl = roleEl || turn;
      let text = textEl.innerText || '';
      // 去除 "你说：" 前缀
      text = text.replace(/^你说[：:]\s*/m, '').trim();
      result.push({ index: qIndex++, text: text.slice(0, 80), el: turn });
    });
    return result;
  }

  // ===================== HTML → Markdown 转换 =====================

  // 从 KaTeX / MathJax 渲染元素中提取原始 LaTeX 源码
  function extractLatexSource(katexEl) {
    // 策略1: KaTeX 的 <annotation encoding="application/x-tex">
    const annotation = katexEl.querySelector('annotation[encoding="application/x-tex"]');
    if (annotation) return annotation.textContent.trim();

    // 策略2: data-tex 属性
    const dataTex = katexEl.getAttribute('data-tex');
    if (dataTex) return dataTex.trim();

    // 策略3: 父元素中的 MathJax <script type="math/tex">
    const parent = katexEl.parentElement;
    if (parent) {
      const script = parent.querySelector('script[type^="math/tex"]');
      if (script) return script.textContent.trim();
    }

    // 策略4: 同级 MathJax script
    const sibling = katexEl.previousElementSibling || katexEl.nextElementSibling;
    if (sibling && sibling.tagName === 'SCRIPT' && (sibling.type || '').indexOf('math/tex') === 0) {
      return sibling.textContent.trim();
    }

    return null;
  }

  // 判断 KaTeX 公式是否为块级显示模式
  function isLatexDisplay(katexEl) {
    if (katexEl.classList.contains('katex-display')) return true;
    if (katexEl.closest('.katex-display')) return true;
    // MathJax display mode
    const parent = katexEl.parentElement;
    if (parent) {
      const script = parent.querySelector('script[type="math/tex; mode=display"]');
      if (script) return true;
    }
    return false;
  }

  // 从 code 元素提取编程语言
  function extractLanguage(codeEl) {
    const cls = codeEl.className || '';
    const m = cls.match(/language-(\w+)/);
    if (m) return m[1];
    const dl = codeEl.getAttribute('data-language');
    if (dl) return dl;
    return '';
  }

  // 表格转 Markdown
  function tableToMarkdown(tableEl) {
    const rows = tableEl.querySelectorAll('tr');
    if (rows.length === 0) return '';

    let result = '';
    let isFirstRow = true;
    let colCount = 0;

    // 先遍历一遍确定最大列数
    rows.forEach(row => {
      const len = row.querySelectorAll('th, td').length;
      if (len > colCount) colCount = len;
    });
    if (colCount === 0) return '';

    rows.forEach(row => {
      const cells = row.querySelectorAll('th, td');
      const values = [];
      cells.forEach(cell => {
        let text = processChildren(cell).trim().replace(/\|/g, '\\|').replace(/\n/g, ' ');
        values.push(text);
      });
      // 补齐到相同列数
      while (values.length < colCount) values.push('');
      result += '| ' + values.join(' | ') + ' |\n';

      // 表头后插入分隔行
      if (isFirstRow && row.querySelectorAll('th').length > 0) {
        result += '| ' + values.map(function () { return '---'; }).join(' | ') + ' |\n';
      }
      isFirstRow = false;
    });

    // 如果第一行没有 th，在首行后仍然插入分隔行（Markdown 要求）
    if (rows[0] && rows[0].querySelectorAll('th').length === 0 && colCount > 0) {
      const sep = '| ' + Array(colCount).fill('---').join(' | ') + ' |\n';
      result = result.replace(/\n/, '\n' + sep);
    }

    return result;
  }

  // 找到 turn 内的消息内容容器
  function findContentElement(turnEl) {
    const roleEl = turnEl.querySelector('[data-message-author-role]');
    const base = roleEl || turnEl;
    const selectors = [
      '[class*="markdown"]',
      '[class*="prose"]',
      '[data-message-content]',
    ];
    for (var i = 0; i < selectors.length; i++) {
      var el = base.querySelector(selectors[i]);
      if (el && el.textContent.trim().length > 0) return el;
    }
    return base;
  }

  // 递归处理子节点
  function processChildren(el) {
    var result = '';
    for (var i = 0; i < el.childNodes.length; i++) {
      var child = el.childNodes[i];
      if (child.nodeType === 3) { // TextNode
        result += child.textContent;
      } else if (child.nodeType === 1) { // Element
        result += processElement(child);
      }
    }
    return result;
  }

  // 处理列表
  function processListItems(listEl) {
    var isOrdered = listEl.tagName.toLowerCase() === 'ol';
    var items = listEl.querySelectorAll(':scope > li');
    var result = '';
    items.forEach(function (li, idx) {
      var prefix = isOrdered ? (idx + 1) + '. ' : '- ';
      var content = processChildren(li).trim();
      // 每行内容前加上缩进
      result += prefix + content.replace(/\n/g, '\n  ') + '\n';
    });
    return result;
  }

  // 处理单个元素
  function processElement(el) {
    // 跳过隐藏元素
    if (el.style && el.style.display === 'none') return '';
    if (el.hidden) return '';

    // 跳过按钮等交互元素（常见于代码块复制按钮等）
    var tag = el.tagName.toLowerCase();
    if (tag === 'button' || tag === 'svg' || tag === 'path') return '';

    // --- 先检查 KaTeX 公式（在任何其它处理之前） ---
    if (el.classList && el.classList.contains('katex')) {
      var latex = extractLatexSource(el);
      var tex = latex !== null ? latex : el.textContent.trim();
      if (isLatexDisplay(el)) {
        return '\n\n$$\n' + tex + '\n$$\n\n';
      }
      return '$' + tex + '$';
    }

    // 元素本身可能包含 .katex-display 后代 —— 递归处理时子元素会被逐个处理，
    // 但如果整个元素就是一个 display 公式的容器（如 .katex-display 但没有 .katex class），
    // 需要特殊处理
    if (el.classList && el.classList.contains('katex-display')) {
      // 找到其中的 .katex 元素来提取
      var katexChild = el.querySelector('.katex');
      if (katexChild) {
        var dLatex = extractLatexSource(katexChild);
        var dTex = dLatex !== null ? dLatex : katexChild.textContent.trim();
        return '\n\n$$\n' + dTex + '\n$$\n\n';
      }
      return '\n\n$$\n' + el.textContent.trim() + '\n$$\n\n';
    }

    // --- 块级元素 ---
    switch (tag) {
      case 'p':
        return '\n\n' + processChildren(el) + '\n\n';
      case 'h1': return '\n\n# ' + processChildren(el) + '\n\n';
      case 'h2': return '\n\n## ' + processChildren(el) + '\n\n';
      case 'h3': return '\n\n### ' + processChildren(el) + '\n\n';
      case 'h4': return '\n\n#### ' + processChildren(el) + '\n\n';
      case 'h5': return '\n\n##### ' + processChildren(el) + '\n\n';
      case 'h6': return '\n\n###### ' + processChildren(el) + '\n\n';
      case 'hr': return '\n\n---\n\n';
      case 'br': return '\n';
      case 'pre': {
        var codeEl = el.querySelector('code');
        var lang = codeEl ? extractLanguage(codeEl) : '';
        var codeText = codeEl ? codeEl.textContent : el.textContent;
        return '\n\n```' + lang + '\n' + codeText + '\n```\n\n';
      }
      case 'blockquote':
        return '\n\n> ' + processChildren(el).trim().replace(/\n/g, '\n> ') + '\n\n';
      case 'table':
        return '\n\n' + tableToMarkdown(el) + '\n\n';
      case 'ul':
      case 'ol':
        return '\n\n' + processListItems(el) + '\n\n';
      // --- 行内元素 ---
      case 'strong':
      case 'b':
        return '**' + processChildren(el) + '**';
      case 'em':
      case 'i':
        return '*' + processChildren(el) + '*';
      case 'code':
        // 检查是否在 <pre> 内
        if (el.closest('pre')) return el.textContent;
        return '`' + el.textContent + '`';
      case 'a': {
        var href = el.getAttribute('href') || '';
        return '[' + processChildren(el) + '](' + href + ')';
      }
      case 'img': {
        var src = el.getAttribute('src') || '';
        var alt = el.getAttribute('alt') || '';
        return '![' + alt + '](' + src + ')';
      }
      case 'del':
      case 's':
        return '~~' + processChildren(el) + '~~';
      case 'li':
        // 由 processListItems 统一处理；这里仅返回内容
        return processChildren(el);
      case 'div':
      case 'span':
      case 'section':
      case 'article':
      case 'main':
        return processChildren(el);
      default:
        return processChildren(el);
    }
  }

  // 入口：将 HTML 元素内容转为 Markdown 字符串
  function htmlToMarkdown(rootEl) {
    if (!rootEl) return '';
    var raw = processChildren(rootEl);
    // 压缩多余空行
    raw = raw.replace(/\n{3,}/g, '\n\n');
    return raw.trim();
  }

  // ===================== 对话配对提取 =====================

  function getConversationPairs() {
    var turns = getConversationTurns();
    var pairs = [];
    var currentQuestion = null;
    var qIndex = 1;

    turns.forEach(function (turn) {
      var role = detectRole(turn);
      if (!role) return;

      if (role === 'user') {
        // 上一个问题还没回答就遇到新问题：先保存
        if (currentQuestion) pairs.push(currentQuestion);

        var contentEl = findContentElement(turn);
        var fullText = contentEl ? contentEl.innerText.trim() : '';
        fullText = fullText.replace(/^你说[：:]\s*/m, '').trim();

        currentQuestion = {
          index: qIndex++,
          question: { el: contentEl || turn, fullText: fullText },
          answer: null
        };
      } else if (role === 'assistant' && currentQuestion && !currentQuestion.answer) {
        var ansContentEl = findContentElement(turn);
        currentQuestion.answer = {
          el: ansContentEl || turn,
          fullText: ansContentEl ? ansContentEl.innerText.trim() : ''
        };
        pairs.push(currentQuestion);
        currentQuestion = null;
      }
      // system / tool 类消息不参与配对，也不打断当前配对
    });

    // 最后一个问题无回答
    if (currentQuestion) pairs.push(currentQuestion);

    return pairs;
  }

  // ===================== 导出组装 =====================

  function buildExportMarkdown(pairs) {
    var now = new Date();
    var dateStr = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0');

    var lines = [];
    lines.push('# ChatGPT 对话导出');
    lines.push('');
    lines.push('**导出日期**: ' + dateStr);
    lines.push('**页面地址**: ' + location.href);
    lines.push('**导出提问数**: ' + pairs.length);
    lines.push('');
    lines.push('---');
    lines.push('');

    pairs.forEach(function (pair) {
      lines.push('## Q' + pair.index);
      lines.push('');
      lines.push('**提问**:');
      lines.push('');
      // 用户问题：直接用纯文本（用户消息通常无复杂格式）
      lines.push(pair.question.fullText || '*(无内容)*');
      lines.push('');
      lines.push('**回答**:');
      lines.push('');

      if (pair.answer) {
        // 助手回答：使用 HTML→Markdown 转换
        var md = htmlToMarkdown(pair.answer.el);
        lines.push(md || pair.answer.fullText || '*(无内容)*');
      } else {
        lines.push('*(此问题暂无回答)*');
      }
      lines.push('');
      lines.push('---');
      lines.push('');
    });

    return lines.join('\n');
  }

  function generateFilename() {
    var title = (document.title || 'ChatGPT').trim();
    // 去除非法文件名字符
    title = title.replace(/[\\\/:\*\?"<>\|]/g, '').trim();
    if (title.length > 80) title = title.slice(0, 80);
    var now = new Date();
    var ds = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0');
    return title + '-' + ds + '.md';
  }

  function downloadMarkdown(markdown, filename) {
    var blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  }

  // ===================== 位置辅助 =====================

  // 将拖拽位置限制在视口可见范围内，防止气泡"丢失"
  function clampPosition(left, top) {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var bubbleSize = 44; // 收起气泡的大致尺寸
    var margin = 8;

    if (typeof left !== 'number' || isNaN(left)) {
      left = vw - bubbleSize - 16;
    }
    if (typeof top !== 'number' || isNaN(top)) {
      top = vh / 2;
    }

    // 保证至少有一部分在屏幕内可被拖回
    left = Math.max(-bubbleSize + margin, Math.min(left, vw - margin));
    top = Math.max(-bubbleSize + margin, Math.min(top, vh - margin));

    return { left: left, top: top };
  }

  // ===================== UI 辅助 =====================

  function updateSelectionUI(toolbarEl, selectionState, totalItems) {
    var countEl = toolbarEl.querySelector('.__nav-selection-count');
    var btnEl = toolbarEl.querySelector('.__nav-export-btn');
    var selectAllCheck = toolbarEl.querySelector('.__nav-select-all-check');

    var count = selectionState.size;

    // 更新计数显示
    if (countEl) {
      if (count > 0) {
        countEl.style.display = '';
        countEl.innerHTML = '已选 <strong>' + count + '</strong> 项';
      } else {
        countEl.style.display = 'none';
      }
    }

    // 更新导出按钮
    if (btnEl) btnEl.disabled = (count === 0);

    // 更新全选框状态
    if (selectAllCheck) {
      if (count === 0) {
        selectAllCheck.checked = false;
        selectAllCheck.indeterminate = false;
      } else if (count >= totalItems) {
        selectAllCheck.checked = true;
        selectAllCheck.indeterminate = false;
      } else {
        selectAllCheck.checked = false;
        selectAllCheck.indeterminate = true;
      }
    }
  }

  // ===================== 列表渲染（修改） =====================

  function renderList(items, filter, listEl, selectionState, onSelectionChange) {
    listEl.innerHTML = '';
    var query = (filter || '').toLowerCase();
    var filtered = query
      ? items.filter(function (i) { return i.text.toLowerCase().indexOf(query) !== -1; })
      : items;

    if (filtered.length === 0) {
      var empty = document.createElement('div');
      empty.className = '__nav-empty';
      empty.textContent = query ? '无匹配结果' : '暂无提问';
      listEl.appendChild(empty);
      return;
    }

    filtered.forEach(function (item) {
      var isSelected = selectionState.has(item.index);

      var div = document.createElement('div');
      div.className = '__nav-item' + (isSelected ? ' selected' : '');

      // 复选框
      var cbWrap = document.createElement('span');
      cbWrap.className = '__nav-checkbox-wrap';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = '__nav-checkbox';
      cb.setAttribute('data-index', item.index);
      cb.checked = isSelected;
      cb.addEventListener('change', function () {
        if (cb.checked) {
          selectionState.add(item.index);
        } else {
          selectionState.delete(item.index);
        }
        // 同步高亮
        if (cb.checked) {
          div.classList.add('selected');
        } else {
          div.classList.remove('selected');
        }
        if (onSelectionChange) onSelectionChange();
      });
      cb.addEventListener('click', function (e) {
        e.stopPropagation();
      });
      cbWrap.appendChild(cb);
      div.appendChild(cbWrap);

      // 文字内容区域（点击滚动）
      var content = document.createElement('div');
      content.className = '__nav-item-content';
      content.innerHTML = '<div class="__nav-num">Q' + item.index + '</div><div class="__nav-text" title="' + item.text.replace(/"/g, '&quot;') + '">' + item.text + '</div>';
      content.addEventListener('click', function () {
        item.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      div.appendChild(content);

      listEl.appendChild(div);
    });
  }

  // ===================== 面板创建（修改） =====================

  function createPanel() {
    var panel = document.createElement('div');
    panel.id = PANEL_ID;

    var collapsed = localStorage.getItem(STORAGE_KEY) === '1';
    if (collapsed) panel.classList.add('collapsed');

    // 恢复收起时的拖拽位置
    var savedPos = (function () {
      try { return JSON.parse(localStorage.getItem(POS_KEY)); } catch (e) { return null; }
    })();
    if (collapsed && savedPos) {
      var clamped = clampPosition(savedPos.left, savedPos.top);
      panel.style.right = 'auto';
      panel.style.top = clamped.top + 'px';
      panel.style.left = clamped.left + 'px';
      panel.style.transform = 'none';
    }

    panel.innerHTML =
      '<div class="__nav-resize-handle"></div>' +
      '<div class="__nav-header">' +
        '<span class="__nav-icon">💬</span>' +
        '<span class="__nav-title">💬 对话导航</span>' +
        '<span class="__nav-toggle">' + (collapsed ? '' : '收起') + '</span>' +
      '</div>' +
      '<div class="__nav-body">' +
        '<input class="__nav-search" type="text" placeholder="搜索提问…" />' +
        '<div class="__nav-toolbar">' +
          '<label class="__nav-select-all-label">' +
            '<input type="checkbox" class="__nav-select-all-check" />' +
            '<span>全选</span>' +
          '</label>' +
          '<span class="__nav-selection-count">已选 <strong>0</strong> 项</span>' +
          '<button class="__nav-export-btn" disabled>📥 导出 Markdown</button>' +
        '</div>' +
        '<div class="__nav-list"></div>' +
      '</div>';

    var header = panel.querySelector('.__nav-header');
    var toggle = panel.querySelector('.__nav-toggle');
    var searchEl = panel.querySelector('.__nav-search');
    var listEl = panel.querySelector('.__nav-list');
    var resizeHandle = panel.querySelector('.__nav-resize-handle');
    var toolbarEl = panel.querySelector('.__nav-toolbar');
    var selectAllCheck = panel.querySelector('.__nav-select-all-check');
    var exportBtn = panel.querySelector('.__nav-export-btn');

    // 恢复上次保存的宽度
    var savedWidth = parseInt(localStorage.getItem(WIDTH_KEY));
    if (savedWidth && !collapsed) panel.style.width = savedWidth + 'px';

    // 状态
    var items = getUserTurns();
    var selectionState = new Set();

    function onSelectionChange() {
      updateSelectionUI(toolbarEl, selectionState, items.length);
    }

    renderList(items, '', listEl, selectionState, onSelectionChange);

    // 左侧拖拽调整宽度
    resizeHandle.addEventListener('mousedown', function (e) {
      e.stopPropagation();
      e.preventDefault();
      var startX = e.clientX;
      var startWidth = panel.offsetWidth;

      function onMove(e) {
        var newWidth = Math.min(480, Math.max(180, startWidth + (startX - e.clientX)));
        panel.style.width = newWidth + 'px';
      }

      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        localStorage.setItem(WIDTH_KEY, parseInt(panel.style.width));
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    // 收起/展开（收起状态下用延迟区分单击展开和双击重置）
    var _clickTimer = null;
    header.addEventListener('click', function (e) {
      if (panel._dragged) { panel._dragged = false; return; }

      var isCollapsed = panel.classList.contains('collapsed');

      if (isCollapsed) {
        // 收起状态：延迟 350ms 执行展开；如果期间触发双击，取消展开并重置位置
        if (_clickTimer) {
          // 第二次点击 → 双击：重置位置
          clearTimeout(_clickTimer);
          _clickTimer = null;
          localStorage.removeItem(POS_KEY);
          panel.style.left = 'auto';
          panel.style.right = '16px';
          panel.style.top = '50%';
          panel.style.transform = 'translateY(-50%)';
          return;
        }
        _clickTimer = setTimeout(function () {
          _clickTimer = null;
          // 执行展开
          panel.classList.add('collapsed'); // 先加回，toggle 才能正确切换到展开
          panel.classList.toggle('collapsed');
          toggle.textContent = '收起';
          localStorage.setItem(STORAGE_KEY, '0');
          panel.style.left = 'auto';
          panel.style.right = '16px';
          panel.style.top = '50%';
          panel.style.transform = 'translateY(-50%)';
          var w = parseInt(localStorage.getItem(WIDTH_KEY));
          if (w) panel.style.width = w + 'px';
        }, 350);
        return;
      }

      // 展开状态：直接收起（无需双击检测）
      panel.classList.toggle('collapsed');
      toggle.textContent = '';
      localStorage.setItem(STORAGE_KEY, '1');
      panel.removeAttribute('style');
      var pos = (function () {
        try { return JSON.parse(localStorage.getItem(POS_KEY)); } catch (e) { return null; }
      })();
      if (pos) {
        var clamped = clampPosition(pos.left, pos.top);
        panel.style.left = clamped.left + 'px';
        panel.style.top = clamped.top + 'px';
        panel.style.right = 'auto';
        panel.style.transform = 'none';
      } else {
        panel.style.left = 'auto';
        panel.style.right = '16px';
        panel.style.top = '50%';
        panel.style.transform = 'translateY(-50%)';
      }
    });

    // 收起状态下支持拖拽
    panel.addEventListener('mousedown', function (e) {
      if (!panel.classList.contains('collapsed')) return;
      var startX = e.clientX;
      var startY = e.clientY;
      var rect = panel.getBoundingClientRect();
      var offsetX = e.clientX - rect.left;
      var offsetY = e.clientY - rect.top;
      panel._dragged = false;

      function onMove(e) {
        var dx = e.clientX - startX;
        var dy = e.clientY - startY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) panel._dragged = true;
        if (!panel._dragged) return;
        var newLeft = e.clientX - offsetX;
        var newTop = e.clientY - offsetY;
        panel.style.left = newLeft + 'px';
        panel.style.top = newTop + 'px';
        panel.style.right = 'auto';
        panel.style.transform = 'none';
      }

      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if (panel._dragged) {
          var clamped = clampPosition(
            parseInt(panel.style.left),
            parseInt(panel.style.top)
          );
          localStorage.setItem(POS_KEY, JSON.stringify({
            left: clamped.left,
            top: clamped.top
          }));
        }
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    // 搜索
    searchEl.addEventListener('input', function () {
      renderList(items, searchEl.value, listEl, selectionState, onSelectionChange);
    });

    // 全选
    selectAllCheck.addEventListener('change', function () {
      if (selectAllCheck.checked) {
        items.forEach(function (item) { selectionState.add(item.index); });
      } else {
        selectionState.clear();
      }
      renderList(items, searchEl.value, listEl, selectionState, onSelectionChange);
      onSelectionChange();
    });

    // 导出按钮
    exportBtn.addEventListener('click', function () {
      if (selectionState.size === 0) return;

      // 获取选中的 index 集合用于快速查找
      var selectedSet = new Set(selectionState);

      // 获取完整对话配对并过滤
      var allPairs = getConversationPairs();
      var selectedPairs = allPairs.filter(function (p) {
        return selectedSet.has(p.index);
      });

      if (selectedPairs.length === 0) {
        alert('未找到匹配的对话内容，请刷新后重试。');
        return;
      }

      try {
        var md = buildExportMarkdown(selectedPairs);
        var filename = generateFilename();
        downloadMarkdown(md, filename);
      } catch (err) {
        console.error('[ChatGPT Nav] 导出失败:', err);
        alert('导出失败: ' + err.message);
      }
    });

    // 刷新函数（更新 selectionState 中可能失效的 index）
    panel._refresh = function () {
      items = getUserTurns();
      // 清理已不存在的选中项
      var validIndices = new Set();
      items.forEach(function (item) { validIndices.add(item.index); });
      var toDelete = [];
      selectionState.forEach(function (idx) {
        if (!validIndices.has(idx)) toDelete.push(idx);
      });
      toDelete.forEach(function (idx) { selectionState.delete(idx); });

      renderList(items, searchEl.value, listEl, selectionState, onSelectionChange);
      onSelectionChange();
    };

    document.body.appendChild(panel);
    return panel;
  }

  function init() {
    injectStyles();

    // 移除旧面板
    var old = document.getElementById(PANEL_ID);
    if (old) old.remove();

    var panel = createPanel();

    // 监听 DOM 变化，自动刷新列表
    var observer = new MutationObserver(function () {
      if (panel._refreshTimer) clearTimeout(panel._refreshTimer);
      panel._refreshTimer = setTimeout(function () { panel._refresh(); }, 500);
    });

    var target = document.querySelector('main') || document.body;
    observer.observe(target, { childList: true, subtree: true });
  }

  // 等待对话内容出现后初始化，防重入
  var _initPending = false;
  function waitAndInit() {
    if (_initPending) return;
    _initPending = true;

    function tryInit() {
      if (getConversationTurns().length > 0) {
        _initPending = false;
        init();
        return true;
      }
      return false;
    }

    if (tryInit()) return;

    var observer = new MutationObserver(function () {
      if (tryInit()) observer.disconnect();
    });

    var target = document.body || document.documentElement;
    observer.observe(target, { childList: true, subtree: true });

    // 兜底：3 秒后无论是否找到对话内容，强制初始化面板
    setTimeout(function () {
      observer.disconnect();
      if (_initPending) {
        _initPending = false;
        init();
      }
    }, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitAndInit);
  } else {
    waitAndInit();
  }

  // 处理 SPA 路由切换
  var lastUrl = location.href;
  new MutationObserver(function () {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      _initPending = false;
      setTimeout(waitAndInit, 800);
    }
  }).observe(document.body || document.documentElement, { childList: true, subtree: true });

})();
