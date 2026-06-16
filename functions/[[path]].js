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
import { resolveFolder, resolveSlugByFolder } from './_lib/slug-map.js';

// 匹配详情页路径
const PUBLICATION_PATTERN = /^\/publication\/([^/]+)\/?$/;
const POST_PATTERN = /^\/post\/([^/]+)\/?$/;
const PROJECT_PATTERN = /^\/project\/([^/]+)\/?$/;
const AUTHOR_PATTERN = /^\/author\/([^/]+)\/?$/;

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
  const { folder, known } = await resolveFolder(type, slug, url.origin, log);
  if (!known || !folder) {
    // manifest 未命中 (如 author taxonomy term，或非内容页) → 回退静态资源
    log.info('Slug not in manifest, passthrough to static', { type, slug, known });
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
      const paths = collectChangedFiles(body.commits);
      const targets = paths.map(parseContentPath).filter(Boolean);
      // 去重 (type, folder)
      const seen = new Set();
      const purged = [];
      for (const { type, folder } of targets) {
        const dedupKey = `${type}/${folder}`;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);

        const urlSlug = await resolveSlugByFolder(type, folder, origin, log);
        if (!urlSlug) {
          // 新文章：manifest 尚无映射，无既有缓存可删；交由 resolveFolder 兜底(改动 B)
          log.info('Purge: slug not in manifest yet (new content?)', { type, folder });
          continue;
        }
        const pagePath = `/${type}/${urlSlug}/`;
        const deleted = await purgePage(cache, origin, pagePath, log);
        purged.push({ type, folder, path: pagePath, deleted });
      }
      log.info('Webhook purge complete', { count: purged.length });
      return new Response(JSON.stringify({ purged: true, items: purged }), {
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
 * 收集 push payload 中所有变更文件路径 (added + modified + removed)
 */
function collectChangedFiles(commits) {
  const files = new Set();
  for (const c of commits) {
    for (const list of [c.added, c.modified, c.removed]) {
      if (Array.isArray(list)) {
        for (const f of list) files.add(f);
      }
    }
  }
  return [...files];
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
