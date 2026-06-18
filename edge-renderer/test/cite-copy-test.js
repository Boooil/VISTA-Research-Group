/**
 * Cite 复制按钮测试 —— bib 来自 frontmatter.cite;有则内联复制组件,无则不显示
 */
import { renderPublication } from '../src/renderer.js';

let failed = 0;
function assert(cond, msg) {
  if (cond) console.log('  ✓', msg);
  else { console.error('  ✗', msg); failed++; }
}

const BIB = '@article{test2026,\n  title={A Test},\n  author={Doe, Jane},\n  year={2026}\n}';

// frontmatter 用块标量 | 内联 bib(每行缩进 2 空格)
function mdWithCite(bib) {
  const indented = bib ? '\ncite: |\n' + bib.split('\n').map(l => l ? '  ' + l : '').join('\n') : '';
  return `---
title: "Cite 测试论文"
slug: cite-test
date: 2026-01-01
publication_types:
  - article-journal${indented}
---
正文`;
}

function setFetch(bib) {
  globalThis.fetch = async (url) => {
    const u = typeof url === 'string' ? url : url.url;
    if (u.includes('/cite-test/index.md')) return new Response(mdWithCite(bib), { status: 200 });
    if (u.endsWith('/publication/')) return new Response('<html><head></head><body></body></html>', { status: 200 });
    return new Response('nf', { status: 404 });
  };
}

const log = { info(){}, warn(){}, error(){}, debug(){} };

console.log('=== Test 1: frontmatter 有 cite → 渲染复制组件,bib 内联 ===');
setFetch(BIB);
let r = await renderPublication({ slug: 'cite-test', folder: 'cite-test', env: {}, log });
assert(r.status === 200, 'render ok');
assert(r.html.includes('hb-cite-copy'), '含复制组件容器 hb-cite-copy');
assert(r.html.includes('hb-cite-data'), '含 bib 数据元素');
assert(r.html.includes('@article{test2026'), 'bib 原文内联进页面');
assert(r.html.includes('navigator.clipboard.writeText'), '含复制到剪贴板 JS');
assert(!r.html.includes('href="/publication/cite-test/cite.bib"'), '不再是打开文件的旧链接');

console.log('=== Test 2: 无 cite → 不显示 Cite ===');
setFetch('');
r = await renderPublication({ slug: 'cite-test', folder: 'cite-test', env: {}, log });
assert(r.status === 200, 'render ok(无 cite)');
assert(!r.html.includes('hb-cite-copy'), '无 cite 时不渲染 Cite 组件');

console.log('=== Test 3: bib 含 </script> 被安全转义 ===');
setFetch('@a{k, note={x}}\n</script>evil');
r = await renderPublication({ slug: 'cite-test', folder: 'cite-test', env: {}, log });
assert(!r.html.includes('</script>evil'), '原始 </script> 不出现(已转义)');
assert(r.html.includes('<\\/script>'), '</script> 被转义为 <\\/script>');

console.log(failed === 0 ? '\nALL PASSED' : `\n${failed} FAILED`);
if (failed > 0) process.exit(1);

