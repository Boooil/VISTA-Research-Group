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
 * manifest 值格式兼容两种:
 *   旧格式: string (author 段及旧构建产物)
 *   新格式: { folder: string, authors: string[] } (publication/post/project)
 *
 * 查找顺序:
 *   1. slug-manifest.json (Hugo 构建产出,已有文章)
 *   2. KV slugmap:<type>:<slug> (webhook 即时写入,新文章在构建完成前的兜底)
 *
 * @returns {Promise<{folder: string|null, known: boolean}>}
 */
export async function resolveFolder(type, urlSlug, origin, log, kv) {
  const manifest = await loadManifest(origin, log);
  const table = manifest && manifest[type];

  if (table) {
    // 1. 直接命中
    if (Object.prototype.hasOwnProperty.call(table, urlSlug)) {
      const raw = table[urlSlug];
      const folder = typeof raw === 'object' && raw !== null ? (raw.folder || null) : (raw || null);
      return { folder, known: true };
    }

    // 2. 解码后比对
    const target = normalizeSlug(urlSlug);
    for (const key of Object.keys(table)) {
      if (normalizeSlug(key) === target) {
        const raw = table[key];
        const folder = typeof raw === 'object' && raw !== null ? (raw.folder || null) : (raw || null);
        return { folder, known: true };
      }
    }
  }

  // 3. KV 兜底
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
  for (const [urlSlug, raw] of Object.entries(table)) {
    const f = typeof raw === 'object' && raw !== null ? raw.folder : raw;
    if (f === folder) return urlSlug;
  }
  return null;
}

/**
 * 按 author pinyin 从 manifest 返回该作者的成果列表。
 * 仅覆盖 manifest 已包含的内容（Hugo 构建产物）。
 * @param {string} authorPinyin - 如 "WangBoyu"
 * @param {string} origin
 * @param {object} [log]
 * @returns {Promise<Array<{slug, title, type}>>}
 */
export async function getPublicationsByAuthor(authorPinyin, origin, log) {
  const manifest = await loadManifest(origin, log);
  if (!manifest) return [];

  const results = [];
  for (const type of ['publication', 'post', 'project']) {
    const table = manifest[type];
    if (!table) continue;
    for (const [slug, raw] of Object.entries(table)) {
      if (typeof raw !== 'object' || raw === null) continue;
      const authors = Array.isArray(raw.authors) ? raw.authors : [];
      if (authors.includes(authorPinyin)) {
        results.push({
          slug,
          type,
          title:    raw.title    || slug,
          date:     raw.date     || '',
          pub_type: raw.pub_type || '',
          venue:    raw.venue    || '',
        });
      }
    }
  }
  // 按日期倒序
  results.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
  return results;
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

// ============================================================================
// 待建清单 (问题 1): 新发布但可能未进静态列表的条目,供列表页注入"最新发布"横幅
// ============================================================================

const PENDING_TTL_SEC = 3600; // 1h,够撑到 Hugo 构建追上
const PENDING_MAX = 20;        // 每类型最多保留的待建条目数

function pendingKey(type) {
  return `pending:${type}`;
}

/**
 * 读取某类型的待建清单
 * @returns {Promise<Array<{slug,title,date}>>}
 */
export async function getPending(kv, type, log) {
  if (!kv) return [];
  try {
    const arr = await kv.get(pendingKey(type), 'json');
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    log?.warn?.('getPending failed', { type, message: e.message });
    return [];
  }
}

/**
 * upsert 一条待建条目(按 slug 去重,新的在前)
 */
export async function addPending(kv, type, entry, log) {
  if (!kv || !entry?.slug) return;
  try {
    const list = await getPending(kv, type, log);
    const filtered = list.filter(e => e.slug !== entry.slug);
    const next = [{ slug: entry.slug, title: entry.title || entry.slug, date: entry.date || '' }, ...filtered].slice(0, PENDING_MAX);
    await kv.put(pendingKey(type), JSON.stringify(next), { expirationTtl: PENDING_TTL_SEC });
    log?.info?.('addPending', { type, slug: entry.slug, count: next.length });
  } catch (e) {
    log?.warn?.('addPending failed', { type, message: e.message });
  }
}

/**
 * 从待建清单移除若干 slug(删除事件,或构建已追上时清理)
 */
export async function removePending(kv, type, slugs, log) {
  if (!kv || !slugs?.length) return;
  try {
    const list = await getPending(kv, type, log);
    const set = new Set(slugs);
    const next = list.filter(e => !set.has(e.slug));
    if (next.length === list.length) return; // 无变化
    await kv.put(pendingKey(type), JSON.stringify(next), { expirationTtl: PENDING_TTL_SEC });
    log?.info?.('removePending', { type, removed: list.length - next.length });
  } catch (e) {
    log?.warn?.('removePending failed', { type, message: e.message });
  }
}

export { pendingKey };

