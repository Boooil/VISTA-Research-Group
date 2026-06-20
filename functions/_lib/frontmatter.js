/**
 * 轻量级 YAML Frontmatter 解析器
 *
 * 解析 Markdown 文件中的 YAML frontmatter 块 (--- 分隔)
 */

/**
 * 解析完整的 Markdown 文件，返回 { frontmatter, body }
 * @param {string} raw - 原始 Markdown 文本
 * @returns {{ frontmatter: Record<string, any>, body: string }}
 */
export function parseMarkdown(raw) {
  if (!raw) return { frontmatter: {}, body: '' };

  const trimmed = raw.trimStart();
  if (!trimmed.startsWith('---')) {
    return { frontmatter: {}, body: raw };
  }

  const startIdx = raw.indexOf('---');
  const afterStart = raw.substring(startIdx + 3);
  const endMatch = afterStart.match(/\n---(\r?\n|$)/);
  if (!endMatch) {
    return { frontmatter: {}, body: raw };
  }

  const yamlBlock = afterStart.substring(0, endMatch.index);
  const bodyStart = endMatch.index + endMatch[0].length;
  const body = afterStart.substring(bodyStart).trim();

  const frontmatter = parseYAML(yamlBlock);
  return { frontmatter, body };
}

/**
 * 简化的 YAML 解析器
 */
function parseYAML(text) {
  const result = {};
  const lines = text.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim() || line.trim().startsWith('#')) {
      i++;
      continue;
    }

    if (!line.match(/^\s*[\w-]+\s*:/)) {
      i++;
      continue;
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) { i++; continue; }

    const key = line.substring(0, colonIdx).trim();
    const afterColon = line.substring(colonIdx + 1);

    // 检查块标量 (| 或 >)
    const blockScalarMatch = afterColon.match(/^\s*(\||\>)\s*(.*)$/);
    if (blockScalarMatch) {
      let indent = '';
      let blockLines = [];
      i++;
      while (i < lines.length && (lines[i].trim() === '' || lines[i].match(/^(\s+)/))) {
        if (lines[i].trim() === '') {
          blockLines.push('');
        } else {
          const leading = lines[i].match(/^(\s*)/)[1];
          if (!indent) indent = leading;
          if (leading.length >= indent.length || lines[i].trim() === '') {
            blockLines.push(lines[i].substring(indent.length));
          } else {
            break;
          }
        }
        i++;
      }
      if (blockScalarMatch[1] === '>') {
        result[key] = blockLines.join(' ').replace(/\s+/g, ' ').trim();
      } else {
        result[key] = blockLines.join('\n').trim();
      }
      continue;
    }

    const value = afterColon.trim();
    const keyIndent = (line.match(/^(\s*)/) || [''])[1].length;

    if (value === '' || value === '[]') {
      const arr = tryParseArray(lines, i + 1);
      if (arr !== null) {
        result[key] = arr.items;
        i = arr.nextIdx;
        continue;
      }
      const obj = tryParseObject(lines, i + 1, keyIndent);
      if (obj !== null) {
        result[key] = obj.items;
        i = obj.nextIdx;
        continue;
      }
      result[key] = value === '[]' ? [] : '';
    } else if (value === 'true') {
      result[key] = true;
    } else if (value === 'false') {
      result[key] = false;
    } else if (value === 'null' || value === '~') {
      result[key] = null;
    } else if (/^-?\d+$/.test(value)) {
      result[key] = parseInt(value, 10);
    } else if (/^-?\d+\.\d+$/.test(value)) {
      result[key] = parseFloat(value);
    } else {
      result[key] = value.replace(/^["'](.*)["']$/, '$1');
    }
    i++;
  }

  return result;
}

/**
 * 尝试解析 YAML 数组
 * 支持两种 item 形态:
 *   - 标量:   - WangBoyu
 *   - 对象:   - icon: envelope
 *               icon_pack: fas
 *               link: "..."
 */
function tryParseArray(lines, startIdx) {
  const items = [];
  let i = startIdx;
  let baseIndent = null;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const currentIndent = (line.match(/^(\s*)/) || ['', ''])[1];

    if (baseIndent === null) {
      if (line.trim().startsWith('- ') || line.trim() === '-') {
        baseIndent = currentIndent;
      } else {
        return null;
      }
    }

    // 缩进比 base 浅 → 离开了数组
    if (currentIndent.length < baseIndent.length) break;

    if (currentIndent !== baseIndent || !line.trim().startsWith('- ')) break;

    const itemRaw = line.trim().substring(2).trim(); // "- " 后面的内容

    // 判断是否为内联对象 item (含 ":")
    if (itemRaw.includes(':')) {
      const obj = {};
      // 解析第一行的 key: value
      const colonIdx = itemRaw.indexOf(':');
      const firstKey = itemRaw.substring(0, colonIdx).trim();
      const firstVal = itemRaw.substring(colonIdx + 1).trim().replace(/^["'](.*)["']$/, '$1');
      if (firstKey) obj[firstKey] = parseScalar(firstVal);
      i++;
      // 消费后续缩进更深的 key: value 行（同一 item 的剩余字段）
      while (i < lines.length) {
        const sub = lines[i];
        if (!sub.trim()) { i++; continue; }
        const subIndent = (sub.match(/^(\s*)/) || ['', ''])[1];
        if (subIndent.length <= baseIndent.length) break; // 回到数组层级或更浅
        if (sub.trim().startsWith('- ')) break;           // 新 item
        const subColon = sub.indexOf(':');
        if (subColon === -1) { i++; continue; }
        const subKey = sub.substring(0, subColon).trim();
        const subVal = sub.substring(subColon + 1).trim().replace(/^["'](.*)["']$/, '$1');
        if (subKey) obj[subKey] = parseScalar(subVal);
        i++;
      }
      items.push(obj);
    } else {
      // 标量 item
      items.push(itemRaw.replace(/^["'](.*)["']$/, '$1'));
      i++;
    }
  }

  if (items.length === 0) return null;
  return { items, nextIdx: i };
}

function parseScalar(val) {
  if (val === 'true') return true;
  if (val === 'false') return false;
  if (/^-?\d+$/.test(val)) return parseInt(val, 10);
  if (/^-?\d+\.\d+$/.test(val)) return parseFloat(val);
  return val;
}

/**
 * 尝试解析 YAML 单层嵌套对象
 */
function tryParseObject(lines, startIdx, parentIndent = -1) {
  const items = {};
  let i = startIdx;
  let baseIndent = null;
  let found = false;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const currentIndent = line.match(/^(\s*)/)[1];
    const currentIndentLen = currentIndent.length;

    if (baseIndent === null) {
      if (currentIndentLen <= parentIndent) return null;
      baseIndent = currentIndent;
    }

    if (currentIndent !== baseIndent) break;
    if (!line.trim().match(/^\w/)) break;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) break;

    const key = line.substring(0, colonIdx).trim();
    let value = line.substring(colonIdx + 1).trim();
    value = value.replace(/^["'](.*)["']$/, '$1');

    if (value === 'true') value = true;
    else if (value === 'false') value = false;
    else if (/^-?\d+$/.test(value)) value = parseInt(value, 10);
    else if (/^-?\d+\.\d+$/.test(value)) value = parseFloat(value);

    items[key] = value;
    found = true;
    i++;
  }

  if (!found) return null;
  return { items, nextIdx: i };
}
