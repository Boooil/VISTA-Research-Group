/**
 * VISTA Edge Renderer — Cloudflare Pages Function (catch-all)
 *
 * Phase 3: 完整覆盖 publication/post/project/author 四种详情页
 * Webhook 鉴权 / 监控日志 / 404 回退
 *
 * 其他路径通过 context.next() 透传给静态资源。
 */

import { createLogger } from './_lib/utils.js';
import { renderPublication, renderPost, renderProject, renderAuthor } from './_lib/renderer.js';
import { resolveFolder, resolveSlugByFolder, writeSlugMapping, addPending, removePending, getPending } from './_lib/slug-map.js';
import { parseMarkdown } from './_lib/frontmatter.js';

// 匹配详情页路径
const PUBLICATION_PATTERN = /^\/publication\/([^/]+)\/?$/;
const POST_PATTERN = /^\/post\/([^/]+)\/?$/;
const PROJECT_PATTERN = /^\/project\/([^/]+)\/?$/;
const AUTHOR_PATTERN = /^\/author\/([^/]+)\/?$/;

// 匹配列表页路径(注入"最新发布"横幅)
const LIST_PATTERN = /^\/(publication|post|project)\/?$/;

// 管理端点
const PURGE_PATTERN = /^\/__purge\/?$/;

// 渲染器映射
const RENDERERS = {
  publication: renderPublication,
  post: renderPost,
  project: renderProject,
  author: renderAuthor,
};

export async function onRequest(context) {
  const { request, env, waitUntil, next } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;
  const startTime = Date.now();

  const log = createLogger(env.DEBUG === 'true');

  try {
    // === 管理端点: 缓存清除 ===
    if (request.method === 'POST' && PURGE_PATTERN.test(pathname)) {
      return handlePurge(request, env, waitUntil, log);
    }

    // === 健康检查 ===
    if (pathname === '/__health') {
      return new Response(JSON.stringify({
        status: 'ok',
        version: '0.3.0',
        phase: 3,
        runtime: 'pages-function',
        timestamp: new Date().toISOString(),
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // === 路由匹配 ===
    let match;
    for (const [type, pattern] of [
      ['publication', PUBLICATION_PATTERN],
      ['post', POST_PATTERN],
      ['project', PROJECT_PATTERN],
      ['author', AUTHOR_PATTERN],
    ]) {
      match = pathname.match(pattern);
      if (match) {
        return handleRoute(url, env, waitUntil, next, log, type, match[1], RENDERERS[type], startTime);
      }
    }

    // === 列表页: 注入"最新发布"横幅 ===
    const listMatch = pathname.match(LIST_PATTERN);
    if (listMatch) {
      return handleListPage(env, next, log, listMatch[1]);
    }

    // === 未匹配路由 → 透传给静态资源 ===
    log.debug('Passthrough to static assets', { pathname });
    return next();

  } catch (err) {
    log.error('Unexpected error', { message: err.message, stack: err.stack, category: 'fatal' });
    return new Response(
      'Edge Renderer Error\n\n' + err.message + '\n\n' + (err.stack || ''),
      {
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Edge-Renderer': 'v0.3-error' },
      }
    );
  }
}

/**
 * 通用路由处理器
 */
async function handleRoute(url, env, waitUntil, next, log, type, slug, renderFn, startTime) {
  const cacheUrl = `${url.origin}/${type}/${slug}/`;
  const cache = caches.default;

  // 1. 检查 Cache API
  try {
    const cached = await cache.match(cacheUrl);
    if (cached) {
      const elapsed = Date.now() - startTime;
      log.debug('Cache hit', { type, slug, elapsedMs: elapsed });
      const response = new Response(cached.body, cached);
      response.headers.set('X-Render-Duration', `${elapsed}ms`);
      response.headers.set('X-Cache', 'HIT');
      return response;
    }
  } catch (err) {
    log.warn('Cache read failed, continuing', { message: err.message });
  }

  // 2. 解析真实内容文件夹名 (URL slug ≠ 文件夹名)
  //    manifest 未命中时,用 KV slugmap 兜底(新文章在 Hugo 构建完成前即可解析)
  const { folder, known } = await resolveFolder(type, slug, url.origin, log, env.AUTHORS);
  if (!known || !folder) {
    // 两层都未命中 (如 author taxonomy term，或非内容页) → 回退静态资源
    log.info('Slug not resolved, passthrough to static', { type, slug, known });
    return next();
  }

  log.info('Cache miss, rendering', { type, slug, folder });

  // 3. 动态渲染
  let result;
  try {
    result = await renderFn({ slug, folder, env, log });
  } catch (err) {
    log.error('Render function threw', { type, slug, folder, message: err.message, category: 'render' });
    return next();
  }

  const { html, status, cacheKey } = result;

  // 4. 404 / 错误 → 回退 Pages 静态资源 (next() 取已构建的 Hugo 页面，避免自我递归)
  if (!html || status !== 200) {
    log.warn('Render failed or 404, passthrough to static', { type, slug, folder, status });
    return next();
  }

  // 4. 返回响应 + 异步写缓存
  const totalTime = Date.now() - startTime;
  const response = new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600',
      'X-Edge-Renderer': 'v0.3-phase3-pages',
      'X-Render-Type': type,
      'X-Render-Duration': `${totalTime}ms`,
      'X-Render-Time': new Date().toISOString(),
    },
  });

  // 异步写入缓存
  waitUntil(
    (async () => {
      try {
        await cache.put(cacheUrl, response.clone());
        log.debug('Cache put ok', { type, slug, cacheKey });
      } catch (err) {
        log.warn('Cache put failed', { message: err.message });
      }
    })()
  );

  return response;
}

/**
 * 列表页处理:取 Pages 静态列表 → 读 KV 待建清单 → 过滤掉已进静态列表的 slug
 * → 把"真·未构建"的条目注入顶部"最新发布"横幅。无待建则原样返回。
 */
async function handleListPage(env, next, log, type) {
  const res = await next();

  // 只处理 HTML
  const ct = res.headers.get('Content-Type') || '';
  if (!ct.includes('text/html')) return res;

  let pending;
  try {
    pending = await getPending(env.AUTHORS, type, log);
  } catch {
    return res;
  }
  if (!pending || pending.length === 0) return res;

  const html = await res.text();

  // 过滤:已出现在静态列表里的 slug → 构建已追上,清理待建清单
  const fresh = [];
  const caughtUp = [];
  for (const e of pending) {
    const href = `/${type}/${e.slug}/`;
    if (html.includes(href) || html.includes(encodeURIComponent(e.slug))) {
      caughtUp.push(e.slug);
    } else {
      fresh.push(e);
    }
  }
  if (caughtUp.length) {
    // 异步清理(不阻塞响应)
    removePending(env.AUTHORS, type, caughtUp, log).catch(() => {});
  }

  if (fresh.length === 0) {
    return new Response(html, res);
  }

  const banner = buildPendingBanner(type, fresh);
  // 注入到列表条目容器之前
  const anchor = '<div class="flex flex-col items-center">';
  const idx = html.indexOf(anchor);
  const injected = idx >= 0
    ? html.slice(0, idx) + banner + html.slice(idx)
    : html.replace(/<\/main>/i, banner + '</main>');

  const headers = new Headers(res.headers);
  headers.delete('Content-Length');
  headers.set('X-Edge-List-Banner', String(fresh.length));
  return new Response(injected, { status: res.status, headers });
}

/**
 * 构建"最新发布"横幅 HTML(极简,不复刻卡片;链接指向秒级可见的详情页)
 */
function buildPendingBanner(type, items) {
  const rows = items.map(e => {
    const href = `/${type}/${encodeURIComponent(e.slug)}/`;
    const dateStr = e.date ? `<span class="text-xs text-gray-400 ml-2">${escapeAttr(e.date)}</span>` : '';
    return `<li class="py-1.5"><a href="${href}" class="text-primary-600 hover:underline dark:text-primary-400">${escapeAttr(e.title)}</a>${dateStr}</li>`;
  }).join('');

  return `<div class="max-w-prose mx-auto px-6 md:px-0 mb-8">
  <div class="rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50/60 dark:bg-primary-900/20 px-5 py-4">
    <div class="flex items-center gap-2 mb-2"><span>🆕</span><span class="font-semibold text-gray-800 dark:text-gray-100">最新发布</span><span class="text-xs text-gray-500 dark:text-gray-400">（刚发布，完整卡片将在站点构建完成后出现）</span></div>
    <ul class="list-none m-0 p-0">${rows}</ul>
  </div>
</div>`;
}

function escapeAttr(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * 处理 /__purge 缓存失效请求
 *
 * 支持两种请求体：
 *  1. GitHub push webhook payload（含 commits[].added/modified/removed 文件路径）
 *     → 解析受影响的内容页 → 删边缘缓存
 *  2. 旧式 { path: "/post/xxx/" }（手动 purge，兼容保留）
 */
async function handlePurge(request, env, waitUntil, log) {
  const origin = new URL(request.url).origin;

  // 验证 Webhook 签名
  const secret = env.WEBHOOK_SECRET;
  if (secret) {
    const verified = await verifyGitHubSignature(request, secret);
    if (!verified) {
      log.warn('Webhook signature verification failed');
      return new Response(JSON.stringify({ purged: false, error: 'unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } else {
    // 生产环境应始终配置 secret；未配置时拒绝 GitHub 事件，仅允许本地手动 path purge
    log.warn('WEBHOOK_SECRET not configured — purge endpoint is unprotected');
  }

  const cache = caches.default;

  // GitHub 首次配置 webhook 会发 ping 事件，无 commits → 回 200 让其显示成功
  const ghEvent = request.headers.get('X-GitHub-Event');
  if (ghEvent === 'ping') {
    log.info('Webhook ping received');
    return new Response(JSON.stringify({ ok: true, pong: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();

    // === 形态 1：GitHub push payload ===
    if (Array.isArray(body.commits)) {
      const { changed, removed } = collectChangedFiles(body.commits);

      // 去重 (type/folder)，分别处理"新增或修改"与"删除"
      const changedTargets = dedupTargets(changed.map(parseContentPath).filter(Boolean));
      const removedTargets = dedupTargets(removed.map(parseContentPath).filter(Boolean));

      const results = [];

      // 新增/修改：拉 index.md → 解析 → 写 KV slug 映射 + 待建清单 + 清缓存
      for (const { type, folder } of changedTargets) {
        const meta = await syncContentMapping(type, folder, env, origin, log);
        if (meta) {
          const { slug, title, date } = meta;
          const pagePath = `/${type}/${encodeURIComponent(slug)}/`;
          const deleted = await purgePage(cache, origin, pagePath, log);
          // 列表横幅只覆盖三个列表型,author 不做
          if (type === 'publication' || type === 'post' || type === 'project') {
            await addPending(env.AUTHORS, type, { slug, title, date }, log);
          }
          results.push({ type, folder, slug, action: 'upsert', deleted });
        } else {
          log.warn('Could not resolve slug for changed content', { type, folder });
        }
      }

      // 删除：用 manifest 反查 slug 清缓存 + 从待建清单移除
      for (const { type, folder } of removedTargets) {
        const urlSlug = await resolveSlugByFolder(type, folder, origin, log);
        if (urlSlug) {
          const pagePath = `/${type}/${urlSlug}/`;
          const deleted = await purgePage(cache, origin, pagePath, log);
          const decoded = decodeURIComponent(urlSlug);
          await removePending(env.AUTHORS, type, [decoded, urlSlug], log);
          results.push({ type, folder, action: 'remove', deleted });
        }
      }

      log.info('Webhook processed', { count: results.length });
      return new Response(JSON.stringify({ purged: true, items: results }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // === 形态 2：旧式 { path } 手动 purge ===
    const { path } = body;
    if (path) {
      const deleted = await purgePage(cache, origin, path, log);
      return new Response(JSON.stringify({ purged: true, path, deleted }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ purged: false, error: 'no path or commits in body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    log.error('Purge error', { message: err.message, category: 'purge' });
    return new Response(JSON.stringify({ purged: false, error: err.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * 收集 push payload 中的变更文件路径，区分"新增/修改"与"删除"
 * @returns {{ changed: string[], removed: string[] }}
 */
function collectChangedFiles(commits) {
  const changed = new Set();
  const removed = new Set();
  for (const c of commits) {
    for (const f of c.added || []) changed.add(f);
    for (const f of c.modified || []) changed.add(f);
    for (const f of c.removed || []) removed.add(f);
  }
  // 同一文件既改又(在另一 commit)删 → 以删除为准
  for (const f of removed) changed.delete(f);
  return { changed: [...changed], removed: [...removed] };
}

/**
 * 对 (type, folder) 列表去重
 */
function dedupTargets(targets) {
  const seen = new Set();
  const out = [];
  for (const t of targets) {
    const key = `${t.type}/${t.folder}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/**
 * 拉取变更内容的 index.md，解析标题，写入 KV slug 映射(新文章兜底)，返回 slug。
 * 复用渲染器的 GitHub Raw 路径规则。author 用 _index.md。
 * @returns {Promise<string|null>} urlize 后的 slug(decoded)，失败返回 null
 */
async function syncContentMapping(type, folder, env, origin, log) {
  const {
    GITHUB_OWNER = 'Boooil',
    GITHUB_REPO = 'VISTA-Research-Group',
    GITHUB_BRANCH = 'main',
  } = env;
  const dir = type === 'author' ? 'authors' : type;
  const file = type === 'author' ? '_index.md' : 'index.md';
  const rawUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/content/${dir}/${folder}/${file}`;

  try {
    const res = await fetch(rawUrl, {
      cf: { cacheTtl: 10 },
      headers: { 'User-Agent': 'VISTA-Edge-Renderer/webhook' },
    });
    if (!res.ok) {
      log.warn('syncContentMapping: fetch md failed', { type, folder, status: res.status });
      return null;
    }
    const md = await res.text();
    const { frontmatter } = parseMarkdown(md);
    // URL 由 frontmatter.slug 字段决定(Hugo permalink :slug 优先用它);
    // author 无 slug 字段,回退 pinyin;再无则回退 urlize(title)。
    const slugSource = frontmatter.slug || frontmatter.pinyin || frontmatter.title;
    if (!slugSource) {
      log.warn('syncContentMapping: no slug/title', { type, folder });
      return null;
    }
    // 写 KV 即时映射 + 返回 slug 与展示元数据(供待建清单)
    const slug = await writeSlugMapping(env.AUTHORS, type, slugSource, folder, log);
    if (!slug) return null;
    return { slug, title: frontmatter.title || slug, date: frontmatter.date || '' };
  } catch (e) {
    log.error('syncContentMapping error', { type, folder, message: e.message });
    return null;
  }
}

/**
 * 把内容文件路径解析为 { type, folder }。
 * 仅匹配详情页内容文件，忽略其他文件。
 *   content/publication/TRVP/index.md      → { type: 'publication', folder: 'TRVP' }
 *   content/post/2026-x/index.md           → { type: 'post', folder: '2026-x' }
 *   content/authors/WangBoyu/_index.md     → { type: 'author', folder: 'WangBoyu' }
 */
function parseContentPath(filePath) {
  // authors 目录映射到 author 类型，且用 _index.md
  const mAuthor = filePath.match(/^content\/authors\/([^/]+)\/_index\.md$/);
  if (mAuthor) return { type: 'author', folder: mAuthor[1] };

  const m = filePath.match(/^content\/(publication|post|project)\/([^/]+)\/index\.md$/);
  if (m) return { type: m[1], folder: m[2] };

  return null;
}

/**
 * 删除某页面路径的边缘缓存 (含尾斜杠变体)
 */
async function purgePage(cache, origin, path, log) {
  const cacheUrl = `${origin}${path}`;
  const deleted = await cache.delete(cacheUrl);
  log.info('Cache purge', { path, deleted });

  const altUrl = path.endsWith('/')
    ? `${origin}${path.slice(0, -1)}`
    : `${origin}${path}/`;
  if (altUrl !== cacheUrl) {
    await cache.delete(altUrl);
  }
  return deleted;
}

/**
 * 验证 GitHub Webhook HMAC-SHA256 签名
 */
async function verifyGitHubSignature(request, secret) {
  const signature = request.headers.get('X-Hub-Signature-256');
  if (!signature) return false;

  const body = await request.clone().text();
  if (!body) return false;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const sigHex = signature.replace('sha256=', '');
    const sigBytes = hexToBytes(sigHex);
    return await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(body));
  } catch (err) {
    console.error('[AUTH] Signature verification error:', err.message);
    return false;
  }
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}
