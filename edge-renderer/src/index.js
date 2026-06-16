/**
 * VISTA Edge Renderer — Cloudflare Worker
 *
 * 拦截 publication/post/project/author 详情页请求，
 * 从 GitHub Raw API 获取最新 .md 内容，动态渲染为完整 HTML。
 * 其他路径透传给 Cloudflare Pages。
 *
 * Phase 2: 完整覆盖四种详情页类型
 */

import { createLogger } from './utils.js';
import { renderPublication, renderPost, renderProject, renderAuthor } from './renderer.js';

// 匹配详情页路径
const PUBLICATION_PATTERN = /^\/publication\/([^/]+)\/?$/;
const POST_PATTERN = /^\/post\/([^/]+)\/?$/;
const PROJECT_PATTERN = /^\/project\/([^/]+)\/?$/;
const AUTHOR_PATTERN = /^\/author\/([^/]+)\/?$/;

// 匹配管理端点
const PURGE_PATTERN = /^\/__purge\/?$/;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    const log = createLogger(env.DEBUG === 'true');

    try {
      // === 管理端点 ===
      if (request.method === 'POST' && PURGE_PATTERN.test(pathname)) {
        return handlePurge(request, env, ctx, log);
      }

      // === 健康检查 ===
      if (pathname === '/__health') {
        return new Response(JSON.stringify({
          status: 'ok',
          version: '0.2.0',
          phase: 2,
          timestamp: new Date().toISOString(),
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // === 路由匹配 ===
      let match;

      // Publication
      match = pathname.match(PUBLICATION_PATTERN);
      if (match) {
        return handleRoute(url, env, ctx, log, 'publication', match[1], renderPublication);
      }

      // Post
      match = pathname.match(POST_PATTERN);
      if (match) {
        return handleRoute(url, env, ctx, log, 'post', match[1], renderPost);
      }

      // Project
      match = pathname.match(PROJECT_PATTERN);
      if (match) {
        return handleRoute(url, env, ctx, log, 'project', match[1], renderProject);
      }

      // Author
      match = pathname.match(AUTHOR_PATTERN);
      if (match) {
        return handleRoute(url, env, ctx, log, 'author', match[1], renderAuthor);
      }

      // === 未匹配路由 → 透传给 Cloudflare Pages ===
      log.debug('Passthrough to Cloudflare Pages', { pathname });
      return fetch(request);

    } catch (err) {
      log.error('Unexpected error', err.message);
      log.error('Stack', err.stack);
      return new Response(
        'Edge Renderer Error\n\n' + err.message + '\n\n' + (err.stack || ''),
        {
          status: 500,
          headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Edge-Renderer': 'v0.2-error' },
        }
      );
    }
  },
};

/**
 * 通用路由处理器
 * @param {URL} url
 * @param {object} env
 * @param {object} ctx
 * @param {object} log
 * @param {string} type - 页面类型标识
 * @param {string} slug - URL slug
 * @param {function} renderFn - 渲染函数
 */
async function handleRoute(url, env, ctx, log, type, slug, renderFn) {
  const cacheUrl = `${url.origin}/${type}/${slug}/`;
  const cache = caches.default;

  // 1. 检查 Worker Cache API (边缘缓存，热路径 < 5ms)
  try {
    const cached = await cache.match(cacheUrl);
    if (cached) {
      log.debug('Cache hit', { type, slug });
      return cached;
    }
  } catch (err) {
    log.warn('Cache read failed, continuing', err.message);
  }

  log.info('Cache miss, rendering', { type, slug });

  // 2. 动态渲染
  const result = await renderFn({ slug, env, log });
  const { html, status, cacheKey } = result;

  // 3. 404 / 错误 → 透传给 Pages (可能 Pages 版本有内容)
  if (!html || status !== 200) {
    log.warn('Render failed or 404, passing through to Pages', { type, slug, status });
    return fetch(url.toString());
  }

  // 4. 返回响应 + 异步写缓存
  const response = new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600',
      'X-Edge-Renderer': 'v0.2-phase2',
      'X-Render-Type': type,
      'X-Render-Time': new Date().toISOString(),
    },
  });

  // 异步写入缓存 (不阻塞响应)
  ctx.waitUntil(
    (async () => {
      try {
        await cache.put(cacheUrl, response.clone());
        log.debug('Cache put ok', { type, slug, cacheKey });
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
async function handlePurge(request, env, ctx, log) {
  // TODO Phase 3: 验证 Webhook secret
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
