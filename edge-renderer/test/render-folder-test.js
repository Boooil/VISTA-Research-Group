/**
 * 端到端离线渲染测试 — 验证 folder 解析 + 渲染链路
 *
 * 模拟:
 *   - slug-manifest.json → resolveFolder('publication', '<urlSlug>') = 'TRVP'
 *   - GitHub Raw fetch → 返回固定 markdown
 * 断言:
 *   - 渲染器用 folder (TRVP) 而非 urlSlug 拼 content 路径
 *   - 返回 status 200 + 非空 HTML + 标题出现
 *   - manifest 未命中的 slug → resolveFolder known=false
 */
import { renderPublication } from '../src/renderer.js';
import { resolveFolder } from '../src/slug-map.js';

const URL_SLUG = 'trvp-transformer-vae-framework-for-3d-point-cloud-instance-segmentation';
const ORIGIN = 'https://vista-research-group.pages.dev';

const MANIFEST = {
  publication: { [URL_SLUG]: 'TRVP', 'dde-net-x': 'DDE-Net' },
  post: {}, project: {}, author: { 'bo-jiang': '' },
};

const MD = `---
title: "TRVP: Transformer-VAE Framework"
authors:
  - WangBoyu
date: 2025-11-13
publication_types:
  - article-journal
publication: "electronics"
abstract: "A test abstract."
---
## Intro
Hello body.
`;

let fetchedUrls = [];
globalThis.fetch = async (url) => {
  const u = typeof url === 'string' ? url : url.url;
  fetchedUrls.push(u);
  if (u.endsWith('/slug-manifest.json')) {
    return new Response(JSON.stringify(MANIFEST), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (u.includes('/content/publication/TRVP/index.md')) {
    return new Response(MD, { status: 200 });
  }
  return new Response('not found', { status: 404 });
};

const log = { info() {}, warn() {}, error() {}, debug() {} };
const env = {};

let failed = 0;
function assert(cond, msg) {
  if (cond) { console.log('  ✓', msg); }
  else { console.error('  ✗', msg); failed++; }
}

console.log('=== Test 1: resolveFolder hit ===');
const r1 = await resolveFolder('publication', URL_SLUG, ORIGIN, log);
assert(r1.known === true, 'known=true for real slug');
assert(r1.folder === 'TRVP', `folder resolved to TRVP (got ${r1.folder})`);

console.log('=== Test 2: resolveFolder miss ===');
const r2 = await resolveFolder('publication', 'nonexistent-slug', ORIGIN, log);
assert(r2.known === false, 'known=false for unknown slug');

console.log('=== Test 3: author taxonomy term (folder empty) ===');
const r3 = await resolveFolder('author', 'bo-jiang', ORIGIN, log);
assert(r3.known === true && r3.folder === null, 'taxonomy term → known=true folder=null');

console.log('=== Test 4: render uses folder not slug ===');
fetchedUrls = [];
const result = await renderPublication({ slug: URL_SLUG, folder: 'TRVP', env, log });
assert(result.status === 200, `status 200 (got ${result.status})`);
assert(result.html && result.html.length > 500, `non-empty HTML (${result.html?.length} chars)`);
assert(result.html.includes('TRVP'), 'HTML contains title TRVP');
assert(
  fetchedUrls.some(u => u.includes('/content/publication/TRVP/index.md')),
  'fetched content/publication/TRVP/index.md (folder, not urlSlug)'
);
assert(
  !fetchedUrls.some(u => u.includes(URL_SLUG)),
  'did NOT fetch the long urlSlug path'
);

console.log(failed === 0 ? '\nALL PASSED' : `\n${failed} FAILED`);
if (failed > 0) process.exit(1);
