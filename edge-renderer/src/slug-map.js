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
 *
 * 查找顺序:
 *   1. slug-manifest.json (Hugo 构建产出,已有文章)
 *   2. KV slugmap:<type>:<slug> (webhook 即时写入,新文章在构建完成前的兜底)
 *
 * @param {string} type
 * @param {string} urlSlug
 * @param {string} origin
 * @param {object} [log]
 * @param {{ get: Function }} [kv] - 可选 KV binding,用于新文章兜底查询
 * @returns {Promise<{folder: string|null, known: boolean}>}
 *   known=false: 两层都未命中 → 调用方应回退 Pages
 *   known=true folder=string: 命中,folder 为源文件夹名
 *   known=true folder=null:  命中但无源文件夹 (如 author taxonomy term) → 回退 Pages
 */
export async function resolveFolder(type, urlSlug, origin, log, kv) {
  const manifest = await loadManifest(origin, log);
  const table = manifest && manifest[type];

  if (table) {
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
  }

  // 3. KV 兜底 (新文章: manifest 尚未包含,但 webhook 已写入即时映射)
  if (kv) {
    try {
      const decoded = normalizeSlug(urlSlug);
      const folder = await kv.get(slugMapKey(type, decoded));
      if (folder) {
        return { folder, known: true };
      }
    } catch (e) {
      log?.warn?.('slugmap KV lookup failed', { message: e.message });
    }
  }

  return { folder: null, known: false };
}

/**
 * 反查：type + 文件夹名 → URL slug。
 * 供 webhook purge 使用——push 只知道改动的文件夹名(content/<type>/<folder>/)，
 * 需反推出页面 URL slug 才能删对应边缘缓存。
 *
 * @returns {Promise<string|null>} 命中返回 urlSlug，未命中返回 null
 */
export async function resolveSlugByFolder(type, folder, origin, log) {
  const manifest = await loadManifest(origin, log);
  if (!manifest || !manifest[type] || !folder) {
    return null;
  }
  const table = manifest[type];
  for (const [urlSlug, f] of Object.entries(table)) {
    if (f === folder) return urlSlug;
  }
  return null;
}

// ============================================================================
// 新文章即时映射 (B1): urlize + KV 读写
// ============================================================================

// KV TTL: 新文章映射只需撑到下次 Hugo 构建完成(manifest 接管),1h 足够
const SLUGMAP_TTL_SEC = 3600;

/**
 * KV key 规范: slugmap:<type>:<decodedSlug>
 */
function slugMapKey(type, decodedSlug) {
  return `slugmap:${type}:${decodedSlug}`;
}

/**
 * 复刻 Hugo 的 urlize 规则，把标题转成 URL slug。
 *
 * Hugo 行为(已用现有 12 篇内容逐字验证, 见 test/urlize-test.js):
 *   1. 转小写
 *   2. 删除标点/符号(: ， 、 。 ：等),不产生 -
 *   3. 连续空白 → 单个 -
 *   4. 合并连续 -,去首尾 -
 *   5. CJK 等非 ASCII 字母原样保留
 *
 * @param {string} title
 * @returns {string} decoded slug (未 percent-encode)
 */
export function urlizeTitle(title) {
  if (!title) return '';
  let s = String(title).toLowerCase();
  s = s.replace(/[^\p{L}\p{N}\s-]/gu, ''); // 删除非 字母/数字/空白/连字符 的字符
  s = s.replace(/\s+/g, '-');               // 空白 → -
  s = s.replace(/-+/g, '-');                // 合并连续 -
  s = s.replace(/^-+|-+$/g, '');            // 去首尾 -
  return s;
}

/**
 * 把一篇内容的 slug→folder 写入 KV (供新文章在 Hugo 构建完成前即时解析)。
 * @param {{ put: Function }} kv
 * @param {string} type
 * @param {string} title - frontmatter 标题
 * @param {string} folder - 源文件夹名
 * @param {object} [log]
 * @returns {Promise<string|null>} 写入的 slug,失败返回 null
 */
export async function writeSlugMapping(kv, type, title, folder, log) {
  if (!kv || !title || !folder) return null;
  const slug = urlizeTitle(title);
  if (!slug) return null;
  try {
    await kv.put(slugMapKey(type, slug), folder, { expirationTtl: SLUGMAP_TTL_SEC });
    log?.info?.('slugmap KV written', { type, slug, folder });
    return slug;
  } catch (e) {
    log?.warn?.('slugmap KV write failed', { message: e.message });
    return null;
  }
}

export { slugMapKey };
