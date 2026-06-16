/**
 * 通用工具函数
 */

/**
 * 简单的日志记录器，带时间戳和级别
 */
export function createLogger(debug = false) {
  return {
    info(msg, data) {
      console.log(`[INFO] ${msg}`, data ?? '');
    },
    warn(msg, data) {
      console.warn(`[WARN] ${msg}`, data ?? '');
    },
    error(msg, data) {
      console.error(`[ERROR] ${msg}`, data ?? '');
    },
    debug(msg, data) {
      if (debug) console.log(`[DEBUG] ${msg}`, data ?? '');
    },
  };
}

/**
 * 计算中文/英文混合文本的阅读时间
 * 中文: 字符数 / 400 字/分钟
 * 英文: 单词数 / 200 词/分钟
 */
export function calcReadingTime(text) {
  if (!text) return 1;
  const chineseChars = (text.match(/[一-鿿]/g) || []).length;
  const nonChinese = text.replace(/[一-鿿]/g, '');
  const englishWords = nonChinese.trim().split(/\s+/).filter(Boolean).length;

  const chineseTime = chineseChars / 400;
  const englishTime = englishWords / 200;
  return Math.max(1, Math.ceil(chineseTime + englishTime));
}

/**
 * 格式化日期为 "Mon DD, YYYY" 格式
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * 从日期提取年份
 */
export function extractYear(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.getFullYear().toString();
  } catch {
    return dateStr;
  }
}

/**
 * 生成 ISO 8601 日期格式
 */
export function toISODate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toISOString();
  } catch {
    return '';
  }
}
