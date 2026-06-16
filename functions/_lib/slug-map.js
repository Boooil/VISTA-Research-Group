/**
 * slug-map — URL slug → 内容文件夹名 解析
 *
 * 背景: permalink 为 :slug 且内容无显式 slug:，Hugo 用「标题 urlize 后」作为 URL，
 * 与源文件夹名 (TRVP / WangBoyu 等) 不一致。Hugo 构建时生成 /slug-manifest.json，
 * 本模块加载它，把请求 URL 的 slug 反查回真实文件夹名。
 *
 * 详见 docs/edge-rendering-design.md
 */

// 模块级缓存 (Worker/Function 实例存活期间复用，避免重复拉取)
let _manifest = null;
let _manifestFetchedAt = 0;
const MANIFEST_TTL_MS = 300_000; // 5 分钟内复用内存缓存

/**
 * 加载 slug-manifest.json (带内存缓存 + 边缘缓存)
 * @param {string} origin - 站点 origin，如 https://vista-research-group.pages.dev
 * @param {object} log
 * @returns {Promise<object|null>} { publication:{}, post:{}, project:{}, author:{} }
 */
async function loadManifest(origin, log) {
  const now = Date.now();
  if (_manifest && now - _manifestFetchedAt < MANIFEST_TTL_MS) {
    return _manifest;
  }

  try {
    const res = await fetch(`${origin}/slug-manifest.json`, {
      cf: { cacheTtl: 60, cacheEverything: true },
      headers: { 'User-Agent': 'VISTA-Edge-Renderer/slug-map' },
    });
    if (!res.ok) {
      log?.warn?.('slug-manifest fetch failed', { status: res.status });
      return _manifest; // 失败时沿用旧缓存 (可能为 null)
    }
    const data = await res.json();
    _manifest = data;
    _manifestFetchedAt = now;
    return _manifest;
  } catch (err) {
    log?.warn?.('slug-manifest fetch error', { message: err.message });
    return _manifest;
  }
}

/**
 * 规范化 slug 用于比对: 解码 percent-encoding，失败则保留原值
 */
function normalizeSlug(slug) {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

/**
 * 解析 type + URL slug → 真实内容文件夹名
 * @returns {Promise<{folder: string|null, known: boolean}>}
 *   known=false: manifest 未加载到或该 slug 不在 manifest 中 → 调用方应回退 Pages
 *   known=true folder=string: 命中，folder 为源文件夹名
 *   known=true folder=null:  命中但无源文件夹 (如 author taxonomy term) → 回退 Pages
 */
export async function resolveFolder(type, urlSlug, origin, log) {
  const manifest = await loadManifest(origin, log);
  if (!manifest || !manifest[type]) {
    return { folder: null, known: false };
  }

  const table = manifest[type];

  // 1. 直接命中 (manifest key 与 url.pathname 同为 percent-encoded)
  if (Object.prototype.hasOwnProperty.call(table, urlSlug)) {
    const v = table[urlSlug];
    return { folder: v || null, known: true };
  }

  // 2. 解码后比对 (防御 encoding 差异)
  const target = normalizeSlug(urlSlug);
  for (const key of Object.keys(table)) {
    if (normalizeSlug(key) === target) {
      const v = table[key];
      return { folder: v || null, known: true };
    }
  }

  return { folder: null, known: false };
}
