/**
 * 轻量级 YAML Frontmatter 解析器
 *
 * 解析 Markdown 文件中的 YAML frontmatter 块 (--- 分隔)
 * 只处理当前 frontmatter 中出现的字段类型:
 *   - string, integer, boolean, date
 *   - array (单层), object (单层嵌套)
 *   - 多行文本 (YAML | / > 块标量)
 */

/**
 * 解析完整的 Markdown 文件，返回 { frontmatter, body }
 * @param {string} raw - 原始 Markdown 文本
 * @returns {{ frontmatter: Record<string, any>, body: string }}
 */
export function parseMarkdown(raw) {
  if (!raw) return { frontmatter: {}, body: '' };

  // 检查是否以 --- 开头
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith('---')) {
    return { frontmatter: {}, body: raw };
  }

  // 找到结束的 --- (必须在行首，但前面的换行符可能不同)
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

    // 跳过空行和注释
    if (!line.trim() || line.trim().startsWith('#')) {
      i++;
      continue;
    }

    // 检查是否是多行值或非键值对行
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
      // 找到下一行的缩进级别
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
      // | 保留换行，> 折叠为空格
      if (blockScalarMatch[1] === '>') {
        result[key] = blockLines.join(' ').replace(/\s+/g, ' ').trim();
      } else {
        result[key] = blockLines.join('\n').trim();
      }
      // i 已经指向下一行，继续
      continue;
    }

    const value = afterColon.trim();
    // 当前键的缩进级别，用于判断子属性
    const keyIndent = (line.match(/^(\s*)/) || [''])[1].length;

    if (value === '' || value === '[]') {
      // 可能是数组或空对象
      // 检查后续行是否是数组项 (以 - 开头)
      const arr = tryParseArray(lines, i + 1);
      if (arr !== null) {
        result[key] = arr.items;
        i = arr.nextIdx;
        continue;
      }
      // 检查是否是嵌套对象 (后续行缩进需严格大于当前键)
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
    } else if (/^-?\d+$/.test(value)) {
      result[key] = parseInt(value, 10);
    } else if (/^-?\d+\.\d+$/.test(value)) {
      result[key] = parseFloat(value);
    } else {
      // 去掉可能的引号
      result[key] = value.replace(/^["'](.*)["']$/, '$1');
    }
    i++;
  }

  return result;
}

/**
 * 尝试解析 YAML 数组 (以 - 开头的列表项)
 */
function tryParseArray(lines, startIdx) {
  const items = [];
  let i = startIdx;
  let baseIndent = null;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const currentIndent = line.match(/^(\s*)/)[1];

    // 确定基准缩进
    if (baseIndent === null) {
      if (line.trim().startsWith('- ')) {
        baseIndent = currentIndent;
      } else {
        return null; // 不是数组
      }
    }

    // 检查缩进是否匹配
    if (!line.trim().startsWith('- ') || currentIndent !== baseIndent) {
      break;
    }

    const itemValue = line.trim().substring(2);
    // 去掉引号
    items.push(itemValue.replace(/^["'](.*)["']$/, '$1'));
    i++;
  }

  if (items.length === 0) return null;
  return { items, nextIdx: i };
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
      // 子属性必须比父键有更大的缩进
      if (currentIndentLen <= parentIndent) return null;
      baseIndent = currentIndent;
    }

    if (currentIndent !== baseIndent) break;
    if (!line.trim().match(/^\w/)) break; // 不是键值对

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
