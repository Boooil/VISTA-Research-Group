/**
 * head-assets 测试 — 验证从 Pages 页面 <head> 提取资源标签
 */
import { extractHeadAssets, getHeadAssets } from '../src/head-assets.js';
import { renderPublication } from '../src/renderer.js';

let failed = 0;
function assert(cond, msg) {
  if (cond) console.log('  ✓', msg);
  else { console.error('  ✗', msg); failed++; }
}

// 模拟一个 Pages 页面 head(含真实 hash 的 _entry CSS)
const LIVE_PAGE = `<!doctype html><html><head>
<meta charset=utf-8>
<link rel=stylesheet href=/css/themes/blue.min.css>
<link rel="stylesheet" href="/css/_entry.LIVEHASH123.css" integrity="sha256-x" crossorigin="anonymous">
<link href=/css/custom.min.abc.css rel=stylesheet>
<script src=/js/hb-head.min.def.js crossorigin=anonymous></script>
<link rel=canonical href="https://x/publication/">
<link rel=alternate hreflang=en href="https://x/publication/">
<link rel=icon type=image/png href=/media/icon.png>
<style>@font-face{font-family:inter var;src:url(/dist/font/Inter.var.woff2)format(woff2)}</style>
<script defer src=/dist/lib/alpinejs/cdn.min.ghi.js defer></script>
<title>X</title>
</head><body>...</body></html>`;

console.log('=== Test 1: extractHeadAssets ===');
const assets = extractHeadAssets(LIVE_PAGE);
assert(assets.includes('/css/_entry.LIVEHASH123.css'), 'extracts live _entry CSS hash');
assert(assets.includes('/css/themes/blue.min.css'), 'extracts theme CSS');
assert(assets.includes('/css/custom.min.abc.css'), 'extracts custom CSS');
assert(assets.includes('/js/hb-head.min.def.js'), 'extracts hb-head script');
assert(assets.includes('/dist/lib/alpinejs/cdn.min.ghi.js'), 'extracts alpine script');
assert(assets.includes('@font-face'), 'extracts inline font-face style');
assert(assets.includes('/media/icon.png'), 'extracts icon link');
assert(!assets.includes('rel=canonical'), 'excludes canonical (shell fills per-page)');
assert(!assets.includes('hreflang'), 'excludes alternate hreflang');
assert(!assets.includes('<title>'), 'does not pull title');

console.log('=== Test 2: getHeadAssets + render injects live hash, not stale ===');
globalThis.fetch = async (url) => {
  const u = typeof url === 'string' ? url : url.url;
  if (u.endsWith('/publication/')) return new Response(LIVE_PAGE, { status: 200 });
  if (u.includes('/content/publication/TRVP/index.md')) {
    return new Response(`---\ntitle: "TRVP Test"\ndate: 2025-01-01\npublication_types:\n  - article-journal\n---\n## Body\nhi`, { status: 200 });
  }
  return new Response('nf', { status: 404 });
};
const log = { info(){}, warn(){}, error(){}, debug(){} };
const result = await renderPublication({ slug: 'trvp-x', folder: 'TRVP', env: {}, log });
assert(result.status === 200, 'render ok');
assert(result.html.includes('/css/_entry.LIVEHASH123.css'), 'rendered HTML uses LIVE css hash');
assert(!result.html.includes('ac581f7c'), 'rendered HTML does NOT contain stale hardcoded hash');

console.log(failed === 0 ? '\nALL PASSED' : `\n${failed} FAILED`);
if (failed > 0) process.exit(1);
