/**
 * VISTA Edge Renderer — Cloudflare Worker
 *
 * 拦截 publication/post/project/author 详情页请求，
 * 从 GitHub Raw API 获取最新 .md 内容，动态渲染为完整 HTML。
 * 其他路径透传给 Cloudflare Pages。
 *
 * Phase 3: Webhook 鉴权 / Cron KV 同步 / 监控日志 / 404 回退
 */

import { createLogger } from './utils.js';
import { renderPublication, renderPost, renderProject, renderAuthor } from './renderer.js';
import { parseMarkdown } from './frontmatter.js';
import { resolveFolder, resolveSlugByFolder, writeSlugMapping } from './slug-map.js';

// 匹配详情页路径
const PUBLICATION_PATTERN = /^\/publication\/([^/]+)\/?$/;
const POST_PATTERN = /^\/post\/([^/]+)\/?$/;
const PROJECT_PATTERN = /^\/project\/([^/]+)\/?$/;
const AUTHOR_PATTERN = /^\/author\/([^/]+)\/?$/;

// 匹配管理端点
const PURGE_PATTERN = /^\/__purge\/?$/;

// 渲染器映射
const RENDERERS = {
  publication: renderPublication,
  post: renderPost,
  project: renderProject,
  author: renderAuthor,
};

export default {
  /**
   * fetch handler — 主请求入口
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const startTime = Date.now();

    const log = createLogger(env.DEBUG === 'true');

    try {
      // === 管理端点: 缓存清除 ===
      if (request.method === 'POST' && PURGE_PATTERN.test(pathname)) {
        return handlePurge(request, env, ctx, log);
      }

      // === 健康检查 ===
      if (pathname === '/__health') {
        return new Response(JSON.stringify({
          status: 'ok',
          version: '0.3.0',
          phase: 3,
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
          const result = await handleRoute(request, url, env, ctx, log, type, match[1], RENDERERS[type], startTime);
          return result;
        }
      }

      // === 未匹配路由 → 透传给 Cloudflare Pages ===
      log.debug('Passthrough to Cloudflare Pages', { pathname });
      return fetch(request);

    } catch (err) {
      log.error('Unexpected error', { message: err.message, stack: err.stack, category: 'fatal' });
      return new Response(
        'Edge Renderer Error\n\n' + err.message + '\n\n' + (err.stack || ''),
        {
          status: 500,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'X-Edge-Renderer': 'v0.3-error',
          },
        }
      );
    }
  },

  /**
   * scheduled handler — Cron 定时任务
   * 每24h 从 GitHub API 扫描 content/authors/ 并刷新 AUTHORS KV
   */
  async scheduled(event, env, ctx) {
    const log = createLogger(env.DEBUG === 'true');
    log.info('Cron triggered', { cron: event.cron, scheduledTime: event.scheduledTime });

    try {
      const count = await refreshAuthorsKV(env, log);
      log.info('Author KV refresh complete', { count });
    } catch (err) {
      log.error('Author KV refresh failed', { message: err.message, stack: err.stack, category: 'cron' });
    }
  },
};

// ============================================================================
// 路由处理
// ============================================================================

/**
 * 通用路由处理器
 */
async function handleRoute(request, url, env, ctx, log, type, slug, renderFn, startTime) {
  const cacheUrl = `${url.origin}/${type}/${slug}/`;
  const cache = caches.default;

  // 1. 检查 Worker Cache API (边缘缓存，热路径 < 5ms)
  try {
    const cached = await cache.match(cacheUrl);
    if (cached) {
      const elapsed = Date.now() - startTime;
      log.debug('Cache hit', { type, slug, elapsedMs: elapsed });
      // 克隆后添加计时头
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
    log.info('Slug not resolved, passing through to Pages', { type, slug, known });
    return passthroughToPages(request, log, { type, slug, reason: 'not-resolved' });
  }

  log.info('Cache miss, rendering', { type, slug, folder });

  // 3. 动态渲染 (带计时)
  const renderStart = Date.now();
  let result;
  try {
    result = await renderFn({ slug, folder, env, log });
  } catch (err) {
    log.error('Render function threw', { type, slug, folder, message: err.message, stack: err.stack, category: 'render' });
    // 渲染异常也透传给 Pages
    return passthroughToPages(request, log, { type, slug, reason: 'render-error', error: err.message });
  }

  const renderTime = Date.now() - renderStart;
  const { html, status, cacheKey } = result;

  // 4. 404 / 错误 → 透传给 Pages (可能 Pages 版本有内容)
  if (!html || status !== 200) {
    log.warn('Render failed or 404, passing through to Pages', { type, slug, status, renderTimeMs: renderTime });
    return passthroughToPages(request, log, { type, slug, reason: status === 404 ? 'not-found' : 'render-failed', status });
  }

  // 4. 返回响应 + 异步写缓存
  const totalTime = Date.now() - startTime;
  const response = new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600',
      'X-Edge-Renderer': 'v0.3-phase3',
      'X-Render-Type': type,
      'X-Render-Duration': `${totalTime}ms`,
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
        log.warn('Cache put failed', { message: err.message });
      }
    })()
  );

  return response;
}

/**
 * 透传到 Cloudflare Pages，带 fallback 标记
 * 用原始 request 透传 (Worker Route 配置为不拦截 fetch(request) 的回源)
 */
function passthroughToPages(request, log, context) {
  log.info('Falling back to Pages', context);
  return fetch(request);
}

// ============================================================================
// Webhook 鉴权 + 缓存清除 (3.3)
// ============================================================================

/**
 * 处理 /__purge 缓存失效请求
 * 使用 GitHub Webhook HMAC-SHA256 签名验证
 *
 * 支持两种请求体：
 *  1. GitHub push webhook payload（commits[].added/modified/removed）
 *  2. 旧式 { path: "/post/xxx/" }（手动 purge）
 */
async function handlePurge(request, env, ctx, log) {
  const origin = new URL(request.url).origin;

  // 1. 验证 Webhook 签名
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
    log.warn('WEBHOOK_SECRET not configured — purge endpoint is unprotected');
  }

  const cache = caches.default;

  // GitHub 首次配置 webhook 的 ping 事件
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
      const changedTargets = dedupTargets(changed.map(parseContentPath).filter(Boolean));
      const removedTargets = dedupTargets(removed.map(parseContentPath).filter(Boolean));

      const results = [];

      // 新增/修改：拉 index.md → 解析 title → 写 KV slug 映射(新文章兜底) + 清缓存
      for (const { type, folder } of changedTargets) {
        const slug = await syncContentMapping(type, folder, env, origin, log);
        if (slug) {
          const pagePath = `/${type}/${encodeURIComponent(slug)}/`;
          const deleted = await purgePage(cache, origin, pagePath, log);
          results.push({ type, folder, slug, action: 'upsert', deleted });
        } else {
          log.warn('Could not resolve slug for changed content', { type, folder });
        }
      }

      // 删除：用 manifest 反查 slug 清缓存
      for (const { type, folder } of removedTargets) {
        const urlSlug = await resolveSlugByFolder(type, folder, origin, log);
        if (urlSlug) {
          const pagePath = `/${type}/${urlSlug}/`;
          const deleted = await purgePage(cache, origin, pagePath, log);
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
 */
function collectChangedFiles(commits) {
  const changed = new Set();
  const removed = new Set();
  for (const c of commits) {
    for (const f of c.added || []) changed.add(f);
    for (const f of c.modified || []) changed.add(f);
    for (const f of c.removed || []) removed.add(f);
  }
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
 * 拉取变更内容的 index.md，解析标题，写入 KV slug 映射(新文章兜底)，返回 slug
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
    // URL 由 frontmatter.slug 决定;author 回退 pinyin;再无回退 title。
    const slugSource = frontmatter.slug || frontmatter.pinyin || frontmatter.title;
    if (!slugSource) {
      log.warn('syncContentMapping: no slug/title', { type, folder });
      return null;
    }
    return await writeSlugMapping(env.AUTHORS, type, slugSource, folder, log);
  } catch (e) {
    log.error('syncContentMapping error', { type, folder, message: e.message });
    return null;
  }
}

/**
 * 把内容文件路径解析为 { type, folder }
 */
function parseContentPath(filePath) {
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
 * 验证 GitHub Webhook 签名 (HMAC-SHA256)
 * 参考: https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
 */
async function verifyGitHubSignature(request, secret) {
  const signature = request.headers.get('X-Hub-Signature-256');
  if (!signature) return false;

  // 克隆 request 以读取 body (原 body 可被后续 json() 消费)
  const body = await request.clone().text();
  if (!body) return false;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigHex = signature.replace('sha256=', '');
    const sigBytes = hexToBytes(sigHex);

    return await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      encoder.encode(body)
    );
  } catch (err) {
    console.error('[AUTH] Signature verification error:', err.message);
    return false;
  }
}

/**
 * 十六进制字符串 → Uint8Array
 */
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// ============================================================================
// 定时任务: Author KV 刷新 (3.4)
// ============================================================================

/**
 * 从 GitHub API 扫描 content/authors/ 目录，
 * 解析每个 _index.md 的 frontmatter，写入 AUTHORS KV
 *
 * @returns {Promise<number>} 成功同步的作者数量
 */
async function refreshAuthorsKV(env, log) {
  const {
    GITHUB_OWNER = 'Boooil',
    GITHUB_REPO = 'VISTA-Research-Group',
    GITHUB_BRANCH = 'main',
  } = env;

  const kv = env.AUTHORS;
  if (!kv) {
    log.error('AUTHORS KV binding not available');
    return 0;
  }

  // 1. 获取 authors 目录列表
  const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/content/authors?ref=${GITHUB_BRANCH}`;
  log.info('Fetching authors directory', { apiUrl });

  let dirList;
  try {
    const res = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'VISTA-Edge-Renderer-Cron/0.3',
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    if (!res.ok) {
      log.error('GitHub API error', { status: res.status });
      return 0;
    }
    dirList = await res.json();
  } catch (err) {
    log.error('Failed to fetch authors directory', { message: err.message });
    return 0;
  }

  if (!Array.isArray(dirList)) {
    log.error('Unexpected GitHub API response', { type: typeof dirList });
    return 0;
  }

  // 只处理目录 (author pinyin slug)
  const authorDirs = dirList.filter(e => e.type === 'dir');
  log.info('Found author directories', { count: authorDirs.length });

  let synced = 0;

  for (const dir of authorDirs) {
    const pinyin = dir.name;
    try {
      // 2. 获取 _index.md 内容
      const rawUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/content/authors/${pinyin}/_index.md`;
      const mdRes = await fetch(rawUrl, {
        headers: { 'User-Agent': 'VISTA-Edge-Renderer-Cron/0.3' },
      });

      if (!mdRes.ok) {
        log.warn('Failed to fetch author _index.md', { pinyin, status: mdRes.status });
        continue;
      }

      const mdText = await mdRes.text();

      // 3. 解析 frontmatter
      const { frontmatter } = parseMarkdown(mdText);
      if (!frontmatter.title) {
        log.warn('Author frontmatter has no title', { pinyin });
        continue;
      }

      // 4. 构造 author 数据并写入 KV
      const authorData = {
        title: frontmatter.title,
        pinyin: frontmatter.pinyin || pinyin,
        role: frontmatter.role || '',
        avatar: frontmatter.avatar_filename || '',
        bio: frontmatter.bio || '',
        interests: frontmatter.interests || [],
        social: frontmatter.social || [],
        organizations: frontmatter.organizations || [],
        email: frontmatter.email || '',
        user_groups: frontmatter.user_groups || [],
      };

      await kv.put(`author:${pinyin}`, JSON.stringify(authorData));
      log.info('Synced author', { pinyin, title: authorData.title });
      synced++;
    } catch (err) {
      log.error('Failed to sync author', { pinyin, message: err.message });
    }
  }

  return synced;
}
