/**
 * webhook purge 逻辑测试 —— parseContentPath / collectChangedFiles / resolveSlugByFolder
 *
 * 验证 GitHub push payload → (type, folder) → urlSlug → 缓存路径 的解析正确。
 */
import { resolveSlugByFolder, resolveFolder } from '../src/slug-map.js';

let failed = 0;
function assert(cond, msg) {
  if (cond) console.log('  ✓', msg);
  else { console.error('  ✗', msg); failed++; }
}

// 复刻 index.js 里的纯函数(保持与实现一致)
function collectChangedFiles(commits) {
  const files = new Set();
  for (const c of commits) {
    for (const list of [c.added, c.modified, c.removed]) {
      if (Array.isArray(list)) for (const f of list) files.add(f);
    }
  }
  return [...files];
}
function parseContentPath(filePath) {
  const mAuthor = filePath.match(/^content\/authors\/([^/]+)\/_index\.md$/);
  if (mAuthor) return { type: 'author', folder: mAuthor[1] };
  const m = filePath.match(/^content\/(publication|post|project)\/([^/]+)\/index\.md$/);
  if (m) return { type: m[1], folder: m[2] };
  return null;
}

console.log('=== Test 1: parseContentPath ===');
assert(JSON.stringify(parseContentPath('content/publication/TRVP/index.md')) === JSON.stringify({ type: 'publication', folder: 'TRVP' }), 'publication index.md');
assert(parseContentPath('content/post/2026-x/index.md').type === 'post', 'post index.md');
assert(parseContentPath('content/authors/WangBoyu/_index.md').type === 'author', 'author _index.md');
assert(parseContentPath('content/authors/WangBoyu/_index.md').folder === 'WangBoyu', 'author folder');
assert(parseContentPath('content/publication/TRVP/featured.jpg') === null, 'non-md asset ignored');
assert(parseContentPath('static/uploads/x.png') === null, 'non-content ignored');
assert(parseContentPath('content/publication/_index.md') === null, 'section list ignored');

console.log('=== Test 2: collectChangedFiles (dedup added/modified/removed) ===');
const commits = [
  { added: ['content/publication/TRVP/index.md'], modified: ['config/x.yaml'], removed: [] },
  { added: [], modified: ['content/publication/TRVP/index.md'], removed: ['content/post/old/index.md'] },
];
const files = collectChangedFiles(commits);
assert(files.includes('content/publication/TRVP/index.md'), 'collects added/modified');
assert(files.includes('content/post/old/index.md'), 'collects removed');
assert(files.filter(f => f === 'content/publication/TRVP/index.md').length === 1, 'dedup across commits');

console.log('=== Test 3: resolveSlugByFolder (reverse lookup via manifest) ===');
const MANIFEST = {
  publication: { 'trvp-transformer-vae-x': 'TRVP', 'dde-net-y': 'DDE-Net' },
  post: {}, project: {}, author: { '王博宇': 'WangBoyu' },
};
globalThis.fetch = async (url) => {
  const u = typeof url === 'string' ? url : url.url;
  if (u.endsWith('/slug-manifest.json')) return new Response(JSON.stringify(MANIFEST), { status: 200 });
  return new Response('nf', { status: 404 });
};
const log = { info(){}, warn(){}, error(){}, debug(){} };
const ORIGIN = 'https://vista-research-group.pages.dev';

const s1 = await resolveSlugByFolder('publication', 'TRVP', ORIGIN, log);
assert(s1 === 'trvp-transformer-vae-x', `TRVP → ${s1}`);
const s2 = await resolveSlugByFolder('author', 'WangBoyu', ORIGIN, log);
assert(s2 === '王博宇', `WangBoyu → ${s2}`);
const s3 = await resolveSlugByFolder('publication', 'BrandNew', ORIGIN, log);
assert(s3 === null, 'new folder not in manifest → null (will fall through, no stale cache)');

console.log(failed === 0 ? '\nALL PASSED' : `\n${failed} FAILED`);
if (failed > 0) process.exit(1);
