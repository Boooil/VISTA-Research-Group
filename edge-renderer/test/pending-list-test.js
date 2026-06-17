/**
 * 待建清单测试 —— addPending / getPending / removePending + 去重/上限/过滤
 */
import { addPending, getPending, removePending, pendingKey } from '../src/slug-map.js';

let failed = 0;
function assert(cond, msg) {
  if (cond) console.log('  ✓', msg);
  else { console.error('  ✗', msg); failed++; }
}

function makeKV() {
  const store = new Map();
  return {
    store,
    async get(k, t) { const v = store.get(k); return v == null ? null : (t === 'json' ? JSON.parse(v) : v); },
    async put(k, v) { store.set(k, v); },
  };
}

const log = { info(){}, warn(){}, error(){}, debug(){} };

console.log('=== Test 1: addPending 写入 + getPending 读取 ===');
const kv = makeKV();
await addPending(kv, 'publication', { slug: 'trvp', title: 'TRVP 论文', date: '2026-06-17' }, log);
let list = await getPending(kv, 'publication', log);
assert(list.length === 1 && list[0].slug === 'trvp', '写入一条并读回');
assert(list[0].title === 'TRVP 论文', 'title 保留');

console.log('=== Test 2: 新条目在前 + 按 slug 去重 ===');
await addPending(kv, 'publication', { slug: 'dde-net', title: 'DDE' }, log);
await addPending(kv, 'publication', { slug: 'trvp', title: 'TRVP v2' }, log); // 重复 slug
list = await getPending(kv, 'publication', log);
assert(list.length === 2, '去重后仍 2 条(trvp 不重复)');
assert(list[0].slug === 'trvp' && list[0].title === 'TRVP v2', '重复 slug 更新且移到最前');

console.log('=== Test 3: removePending 移除 ===');
await removePending(kv, 'publication', ['trvp'], log);
list = await getPending(kv, 'publication', log);
assert(list.length === 1 && list[0].slug === 'dde-net', '移除 trvp 后剩 dde-net');

console.log('=== Test 4: 类型隔离 ===');
await addPending(kv, 'post', { slug: 'my-post', title: 'P' }, log);
const pubList = await getPending(kv, 'publication', log);
const postList = await getPending(kv, 'post', log);
assert(pubList.length === 1 && postList.length === 1, 'publication 与 post 清单互不干扰');
assert(kv.store.has(pendingKey('post')), 'pendingKey 命名正确');

console.log('=== Test 5: 空/未知类型返回空数组 ===');
const empty = await getPending(kv, 'project', log);
assert(Array.isArray(empty) && empty.length === 0, '无数据 → []');
const noKv = await getPending(null, 'publication', log);
assert(Array.isArray(noKv) && noKv.length === 0, '无 kv → []');

console.log('=== Test 6: 横幅过滤逻辑(已进静态列表的 slug 被剔除) ===');
// 模拟 handleListPage 的过滤:html 含 /publication/dde-net/ → 该条已构建,应过滤
const pending = [{ slug: 'dde-net', title: 'DDE' }, { slug: 'brand-new', title: 'New' }];
const html = '<a href="/publication/dde-net/">DDE</a> ... rest of static list';
const fresh = pending.filter(e => !(html.includes(`/publication/${e.slug}/`) || html.includes(encodeURIComponent(e.slug))));
assert(fresh.length === 1 && fresh[0].slug === 'brand-new', '已构建的 dde-net 被过滤,只剩 brand-new');

console.log(failed === 0 ? '\nALL PASSED' : `\n${failed} FAILED`);
if (failed > 0) process.exit(1);
