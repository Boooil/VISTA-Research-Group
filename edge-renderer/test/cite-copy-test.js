/**
 * Cite 复制按钮测试 —— cite.bib 存在则内联 + 渲染复制组件;不存在则无 Cite
 */
import { renderPublication } from '../src/renderer.js';

let failed = 0;
function assert(cond, msg) {
  if (cond) console.log('  ✓', msg);
  else { console.error('  ✗', msg); failed++; }
}

const MD = `---
title: "Cite 测试论文"
slug: cite-test
date: 2026-01-01
publication_types:
  - article-journal
---
正文`;

const BIB = '@article{test2026,\n  title={A Test},\n  author={Doe, Jane},\n  year={2026}\n}';

function setFetch(withBib) {
  globalThis.fetch = async (url) => {
    const u = typeof url === 'string' ? url : url.url;
    if (u.includes('/cite-test/index.md')) return new Response(MD, { status: 200 });
    if (u.includes('/cite-test/cite.bib')) {
      return withBib ? new Response(BIB, { status: 200 }) : new Response('nf', { status: 404 });
    }
    if (u.endsWith('/publication/')) return new Response('<html><head></head><body></body></html>', { status: 200 });
    return new Response('nf', { status: 404 });
  };
}

const log = { info(){}, warn(){}, error(){}, debug(){} };

console.log('=== Test 1: 有 cite.bib → 渲染复制组件,bib 内联 ===');
setFetch(true);
let r = await renderPublication({ slug: 'cite-test', folder: 'cite-test', env: {}, log });
assert(r.status === 200, 'render ok');
assert(r.html.includes('hb-cite-copy'), '含复制组件容器 hb-cite-copy');
assert(r.html.includes('hb-cite-data'), '含 bib 数据元素');
assert(r.html.includes('@article{test2026'), 'bib 原文内联进页面');
assert(r.html.includes('navigator.clipboard.writeText'), '含复制到剪贴板 JS');
assert(!r.html.includes('href="/publication/cite-test/cite.bib"'), '不再是打开文件的旧链接');

console.log('=== Test 2: 无 cite.bib → 不显示 Cite ===');
setFetch(false);
r = await renderPublication({ slug: 'cite-test', folder: 'cite-test', env: {}, log });
assert(r.status === 200, 'render ok(无 bib)');
assert(!r.html.includes('hb-cite-copy'), '无 cite.bib 时不渲染 Cite 组件');
assert(!r.html.includes('hb-cite-label'), '无 Cite 按钮');

console.log('=== Test 3: bib 含 </script> 被安全转义 ===');
globalThis.fetch = async (url) => {
  const u = typeof url === 'string' ? url : url.url;
  if (u.includes('/x/index.md')) return new Response(MD.replace('cite-test','x'), { status: 200 });
  if (u.includes('/x/cite.bib')) return new Response('@a{k, note={</script><b>x}}', { status: 200 });
  if (u.endsWith('/publication/')) return new Response('<html><head></head><body></body></html>', { status: 200 });
  return new Response('nf', { status: 404 });
};
r = await renderPublication({ slug: 'x', folder: 'x', env: {}, log });
assert(!r.html.includes('</script><b>'), '原始 </script> 不出现(已转义防破坏)');
assert(r.html.includes('<\\/script>'), '</script> 被转义为 <\\/script>');

console.log(failed === 0 ? '\nALL PASSED' : `\n${failed} FAILED`);
if (failed > 0) process.exit(1);
