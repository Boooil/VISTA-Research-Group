/**
 * head-assets 测试 — 验证从 Pages 页面 <head> 提取资源标签
 */
import { extractHeadAssets, getHeadAssets } from '../src/head-assets.js';
import { renderPost, renderPublication } from '../src/renderer.js';

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

const MATH_PAGE = LIVE_PAGE.replace(
  '<title>X</title>',
  `<link rel=stylesheet href=/dist/lib/katex/katex.min.MATHHASH.css>
<script defer src=/dist/lib/katex/katex.min.MATHHASH.js></script>
<script defer src=/js/katex-renderer.MATHHASH.js></script>
<title>X</title>`
);

const MATH_POST = String.raw`---
title: "Math Test"
date: 2026-07-22
math: true
---
Inline $d_{\text{match}} = 1.0$ and spacing $2\,\mathrm{m}$.
Paren \(\alpha_{\text{x}} + \beta\).

$$e_{\text{pos}} = \left\| \mathbf{p}_{\text{pred}} - \mathbf{p}_{\text{gt}} \right\|_{2}$$

$$
\begin{aligned}
\text{Precision} &= \frac{TP}{TP + FP}, \quad
\text{Recall} = \frac{TP}{TP + FN} \\
F_1 &= \frac{2\,\text{Precision} \cdot \text{Recall}}
{\text{Precision} + \text{Recall}}
\end{aligned}
$$

\[\sum_{i=1}^{N} x_i\]

| Metric | Value |
|---|---|
| Norm | $\left\| \mathbf{v}_{\text{pred}} \right\|$ |

Code stays literal: ${'`'}$not_math_{x}$${'`'}.
`;

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
const fetchedUrls = [];
globalThis.fetch = async (url) => {
  const u = typeof url === 'string' ? url : url.url;
  fetchedUrls.push(u);
  if (u.endsWith('/publication/')) return new Response(LIVE_PAGE, { status: 200 });
  if (u.endsWith('/edge-assets/')) return new Response(MATH_PAGE, { status: 200 });
  if (u.includes('/content/publication/TRVP/index.md')) {
    return new Response(`---\ntitle: "TRVP Test"\ndate: 2025-01-01\npublication_types:\n  - article-journal\n---\n## Body\nhi`, { status: 200 });
  }
  if (u.includes('/content/post/math-test/index.md')) {
    return new Response(MATH_POST, { status: 200 });
  }
  return new Response('nf', { status: 404 });
};
const log = { info(){}, warn(){}, error(){}, debug(){} };
const result = await renderPublication({ slug: 'trvp-x', folder: 'TRVP', env: {}, log });
assert(result.status === 200, 'render ok');
assert(result.html.includes('/css/_entry.LIVEHASH123.css'), 'rendered HTML uses LIVE css hash');
assert(!result.html.includes('ac581f7c'), 'rendered HTML does NOT contain stale hardcoded hash');

console.log('=== Test 3: math page loads KaTeX assets and preserves TeX ===');
const mathResult = await renderPost({ slug: 'math-test', folder: 'math-test', env: {}, log });
assert(mathResult.status === 200, 'math post render ok');
assert(fetchedUrls.some(u => u.endsWith('/edge-assets/')), 'math post fetches the static math asset source');
assert(mathResult.html.includes('/dist/lib/katex/katex.min.MATHHASH.css'), 'math post injects KaTeX CSS');
assert(mathResult.html.includes('/js/katex-renderer.MATHHASH.js'), 'math post injects KaTeX auto-render script');
assert(mathResult.html.includes(String.raw`$d_{\text{match}} = 1.0$`), 'preserves inline TeX subscripts');
assert(mathResult.html.includes(String.raw`$2\,\mathrm{m}$`), 'preserves TeX spacing command');
assert(mathResult.html.includes(String.raw`\(\alpha_{\text{x}} + \beta\)`), 'preserves parenthesized inline TeX');
assert(mathResult.html.includes(String.raw`$$e_{\text{pos}} = \left\| \mathbf{p}_{\text{pred}} - \mathbf{p}_{\text{gt}} \right\|_{2}$$`), 'preserves block TeX without Markdown emphasis');
assert(mathResult.html.includes(String.raw`\begin{aligned}`) && mathResult.html.includes(String.raw`\text{Recall} = \frac{TP}{TP + FN} \\`), 'preserves multiline aligned TeX');
assert(mathResult.html.includes(String.raw`\[\sum_{i=1}^{N} x_i\]`), 'preserves bracketed block TeX');
assert(mathResult.html.includes(String.raw`$\left\| \mathbf{v}_{\text{pred}} \right\|$`), 'preserves TeX inside a GFM table cell');
assert(mathResult.html.includes('<code>$not_math_{x}$</code>'), 'does not treat inline code as math');
assert(!mathResult.html.includes('<em>{\\text{pred}}'), 'does not inject emphasis tags into TeX');

console.log(failed === 0 ? '\nALL PASSED' : `\n${failed} FAILED`);
if (failed > 0) process.exit(1);
