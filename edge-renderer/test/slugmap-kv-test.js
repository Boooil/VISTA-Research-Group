/**
 * B1 测试 —— resolveFolder 的 KV 兜底 + writeSlugMapping
 *
 * 场景:新文章 slug 不在 manifest,但 webhook 已写入 KV slugmap → 应能解析。
 */
import { resolveFolder, writeSlugMapping, urlizeTitle, slugMapKey } from '../src/slug-map.js';

let failed = 0;
function assert(cond, msg) {
  if (cond) console.log('  ✓', msg);
  else { console.error('  ✗', msg); failed++; }
}

// 内存 KV mock
function makeKV() {
  const store = new Map();
  return {
    store,
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v) { store.set(k, v); },
  };
}

const MANIFEST = { publication: { 'old-paper': 'OldPaper' }, post: {}, project: {}, author: {} };
globalThis.fetch = async (url) => {
  const u = typeof url === 'string' ? url : url.url;
  if (u.endsWith('/slug-manifest.json')) return new Response(JSON.stringify(MANIFEST), { status: 200 });
  return new Response('nf', { status: 404 });
};
const log = { info(){}, warn(){}, error(){}, debug(){} };
const ORIGIN = 'https://vista-research-group.pages.dev';

console.log('=== Test 1: writeSlugMapping 写入正确 key ===');
const kv = makeKV();
const slug = await writeSlugMapping(kv, 'publication', '一种全新的方法、系统', 'BrandNewPatent', log);
assert(slug === '一种全新的方法系统', `urlize 标题 → ${slug}`);
assert(kv.store.get(slugMapKey('publication', '一种全新的方法系统')) === 'BrandNewPatent', 'KV 存了 slugmap:publication:<slug> = folder');

console.log('=== Test 2: resolveFolder manifest 命中(老文章,不查 KV) ===');
const r1 = await resolveFolder('publication', 'old-paper', ORIGIN, log, kv);
assert(r1.known && r1.folder === 'OldPaper', 'manifest 命中 OldPaper');

console.log('=== Test 3: resolveFolder manifest 未命中 → KV 兜底命中(新文章) ===');
// 新文章 slug 的 percent-encoded 形式(浏览器请求 url.pathname 的样子)
const encoded = encodeURIComponent('一种全新的方法系统');
const r2 = await resolveFolder('publication', encoded, ORIGIN, log, kv);
assert(r2.known && r2.folder === 'BrandNewPatent', `KV 兜底解析 encoded slug → BrandNewPatent (got ${r2.folder})`);

console.log('=== Test 4: 两层都未命中 → known=false ===');
const r3 = await resolveFolder('publication', 'nonexistent', ORIGIN, log, kv);
assert(!r3.known, '未知 slug → known=false (回退 Pages)');

console.log('=== Test 5: 无 KV 传入时退化为纯 manifest(不报错) ===');
const r4 = await resolveFolder('publication', 'old-paper', ORIGIN, log);
assert(r4.known && r4.folder === 'OldPaper', '无 kv 参数时 manifest 仍正常');

console.log('=== Test 6: slug 字段值(已规范英文)直接驱动映射(新模型) ===');
// 新模型:URL=slug 字段,webhook 用 frontmatter.slug(如 "trvp")写映射,非 urlize(title)
const kv2 = makeKV();
const s6 = await writeSlugMapping(kv2, 'publication', 'trvp', 'TRVP', log);
assert(s6 === 'trvp', `slug 字段 trvp → ${s6}(urlize 幂等)`);
const r6 = await resolveFolder('publication', 'trvp', ORIGIN, log, kv2);
assert(r6.known && r6.folder === 'TRVP', 'slug=trvp 解析回文件夹 TRVP');

console.log(failed === 0 ? '\nALL PASSED' : `\n${failed} FAILED`);
if (failed > 0) process.exit(1);
