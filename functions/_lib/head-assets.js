/**
 * head-assets — 运行时从线上 Pages 页面提取真实的 CSS/JS 资源引用
 *
 * 背景: shell 模板硬编码带 hash 的 CSS/JS 路径(如 /css/_entry.<hash>.css)。
 * hash 是内容指纹,每次 Hugo/Tailwind 构建都会变,硬编码必然过期 → 样式表 404
 * (返回 text/html 被浏览器拒绝)。
 *
 * 方案: Worker 渲染时抓取稳定的 Pages 静态页,
 * 从其 <head> 提取当前真实的 <link rel=stylesheet> 与构建产物 <script>,
 * 注入 shell。hash 永远与线上 Pages 一致,自愈、无需手动同步。
 */

// 模块级缓存(实例存活期间复用)，普通页与数学页分开缓存。
const _assets = { default: null, math: null };
const _assetsFetchedAt = { default: 0, math: 0 };
const ASSETS_TTL_MS = 300_000; // 5 分钟

// 两个来源都不走详情页边缘路由，必为 Hugo 产物。
// edge-assets 是隐藏资源页，math:true 让 Hugo 注入当前指纹的 KaTeX CSS/JS。
const SOURCE_PATHS = {
  default: '/publication/',
  math: '/edge-assets/',
};

/**
 * 从 HTML 的 <head> 中提取资源标签:
 *  - <link rel=stylesheet ...> (含 /css/ 本地与 cdnjs 外部)
 *  - <link rel=icon|apple-touch-icon ...>
 *  - 指向 /js/ 或 /dist/ 的 <script ...></script> (Hugo 构建产物)
 *  - <style>@font-face...</style> 内联字体声明
 *
 * @param {string} html
 * @returns {string} 拼接好的资源标签 HTML
 */
function extractHeadAssets(html) {
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const head = headMatch ? headMatch[1] : html;

  const tags = [];

  // 1. <link> 样式表 / 图标
  const linkRe = /<link\b[^>]*>/gi;
  let m;
  while ((m = linkRe.exec(head)) !== null) {
    const tag = m[0];
    if (/rel=(["']?)(stylesheet|icon|apple-touch-icon)\1/i.test(tag)) {
      // 跳过 canonical / alternate(由 shell 自己按页面填充)
      if (/rel=(["']?)(canonical|alternate)\1/i.test(tag)) continue;
      tags.push(tag);
    }
  }

  // 2. 构建产物 <script>(/js/ 或 /dist/),保留完整开闭标签
  const scriptRe = /<script\b[^>]*\bsrc=(["']?)([^"'\s>]+)\1[^>]*>\s*<\/script>/gi;
  while ((m = scriptRe.exec(head)) !== null) {
    const src = m[2];
    if (/^\/(js|dist)\//.test(src)) {
      tags.push(m[0]);
    }
  }

  // 3. 内联 @font-face <style>
  const styleRe = /<style\b[^>]*>[\s\S]*?@font-face[\s\S]*?<\/style>/gi;
  while ((m = styleRe.exec(head)) !== null) {
    tags.push(m[0]);
  }

  return tags.join('');
}

/**
 * 获取 head 资源标签(带内存缓存 + 边缘缓存)。
 * 失败时返回 null,调用方应回退到 shell 内置(可能过期)的硬编码资源。
 *
 * @param {string} origin
 * @param {object} [log]
 * @param {{ math?: boolean }} [options]
 * @returns {Promise<string|null>}
 */
export async function getHeadAssets(origin, log, options = {}) {
  const key = options.math ? 'math' : 'default';
  const sourcePath = SOURCE_PATHS[key];
  const now = Date.now();
  if (_assets[key] && now - _assetsFetchedAt[key] < ASSETS_TTL_MS) {
    return _assets[key];
  }

  try {
    const res = await fetch(`${origin}${sourcePath}`, {
      cf: { cacheTtl: 60, cacheEverything: true },
      headers: { 'User-Agent': 'VISTA-Edge-Renderer/head-assets' },
    });
    if (!res.ok) {
      log?.warn?.('head-assets source fetch failed', { status: res.status });
      return _assets[key];
    }
    const html = await res.text();
    const assets = extractHeadAssets(html);
    if (assets && assets.length > 0) {
      _assets[key] = assets;
      _assetsFetchedAt[key] = now;
    }
    return _assets[key];
  } catch (err) {
    log?.warn?.('head-assets fetch error', { message: err.message });
    return _assets[key];
  }
}

// 供测试使用
export { extractHeadAssets };
