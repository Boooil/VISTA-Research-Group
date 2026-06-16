/**
 * VISTA Edge Renderer — Cloudflare Pages Function (catch-all)
 *
 * 拦截 publication/post/project/author 详情页请求，
 * 从 GitHub Raw API 获取最新 .md 内容，动态渲染为完整 HTML。
 * 其他路径通过 context.next() 透传给静态资源。
 *
 * Phase 1: 仅处理 /publication/* 路径
 */

import { createLogger } from './_lib/utils.js';
import { renderPublication } from './_lib/renderer.js';

// 匹配详情页路径
const PUBLICATION_PATTERN = /^\/publication\/([^/]+)\/?$/;
const PURGE_PATTERN = /^\/__purge\/?$/;

export async function onRequest(context) {
  const { request, env, waitUntil, next } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  const log = createLogger(env.DEBUG === 'true');

  try {
    // === 管理端点 ===
    if (request.method === 'POST' && PURGE_PATTERN.test(pathname)) {
      return handlePurge(request, env, waitUntil, log);
    }

    // === 健康检查 ===
    if (pathname === '/__health') {
      return new Response(JSON.stringify({
        status: 'ok',
        version: '0.1.0',
        phase: 1,
        runtime: 'pages-function',
        timestamp: new Date().toISOString(),
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // === Phase 1: Publication 路由 ===
    const pubMatch = pathname.match(PUBLICATION_PATTERN);
    if (pubMatch) {
      return handlePublication(url, env, waitUntil, log, pubMatch[1]);
    }

    // === 未匹配路由 → 透传给静态资源 ===
    log.debug('Passthrough to static assets', { pathname });
    return next();

  } catch (err) {
    log.error('Unexpected error', err.message);
    log.error('Stack', err.stack);
    return new Response(
      'Edge Renderer Error\n\n' + err.message + '\n\n' + (err.stack || ''),
      {
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Edge-Renderer': 'v0.1-error' },
      }
    );
  }
}

/**
 * 处理 /publication/<slug>/ 请求
 */
async function handlePublication(url, env, waitUntil, log, slug) {
  const cacheUrl = `${url.origin}/publication/${slug}/`;
  const cache = caches.default;

  // 1. 检查 Cache API (边缘缓存)
  try {
    const cached = await cache.match(cacheUrl);
    if (cached) {
      log.debug('Cache hit', { slug });
      return cached;
    }
  } catch (err) {
    log.warn('Cache read failed, continuing', err.message);
  }

  log.info('Cache miss, rendering', { slug });

  // 2. 动态渲染
  log.info('Starting render', { slug });
  const result = await renderPublication({ slug, env, log });
  log.info('Render result', { hasHtml: !!result.html, status: result.status, cacheKey: result.cacheKey });
  const { html, status, cacheKey } = result;

  // 3. 404 / 错误 → 尝试从 Pages 静态资源获取
  if (!html || status !== 200) {
    log.warn('Render failed or 404, fetching from Pages origin', { slug, status });
    try {
      const originRes = await fetch(new URL(url.pathname, url.origin), {
        redirect: 'follow',
      });
      if (originRes.ok) {
        return originRes;
      }
    } catch (e) {
      log.error('Origin fetch also failed', e.message);
    }
    // Hugo 静态版本也没有，返回 404
    return new Response('Not Found', { status: 404 });
  }

  // 4. 返回响应 + 异步写缓存
  const response = new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600',
      'X-Edge-Renderer': 'v0.1-phase1-pages',
      'X-Render-Time': new Date().toISOString(),
    },
  });

  // 异步写入缓存
  waitUntil(
    (async () => {
      try {
        await cache.put(cacheUrl, response.clone());
        log.debug('Cache put ok', { cacheKey });
      } catch (err) {
        log.warn('Cache put failed', err.message);
      }
    })()
  );

  return response;
}

/**
 * 处理 /__purge 缓存失效请求
 */
async function handlePurge(request, env, waitUntil, log) {
  try {
    const body = await request.json();
    const { path } = body;

    if (path) {
      const cacheUrl = `https://vista-research-group.pages.dev${path}`;
      const cache = caches.default;
      const deleted = await cache.delete(cacheUrl);
      log.info('Cache purge', { path, deleted });
    }

    return new Response(JSON.stringify({ purged: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    log.error('Purge error', err.message);
    return new Response(JSON.stringify({ purged: false, error: err.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
