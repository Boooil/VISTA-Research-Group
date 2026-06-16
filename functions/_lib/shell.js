/**
 * Publication 页面 Shell 模板
 *
 * 从 Hugo 构建输出中提取的页面框架
 * 使用字符串占位符，通过 .replace() 填充
 */

const SHELL_TEMPLATE = `<!doctype html><html lang=en dir=ltr data-wc-theme-default=system><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><meta http-equiv=X-UA-Compatible content="IE=edge"><meta name=generator content="VISTA Edge Renderer"><meta name=description content="__META_DESC__"><link rel=alternate hreflang=en href=__CANONICAL_URL__>
<link rel=stylesheet href=/css/themes/blue.min.css>
<link rel=stylesheet href=/css/_entry.ac581f7c12cb784e2f8daae0a230a97dd057e01cd131509d3f32ea514a320423.css integrity="sha256-rFgffBLLeE4vjargojCpfdBX4BzRMVCdPzLqUUoyBCM=" crossorigin=anonymous>
<link href=/css/custom.min.c7ec571ce6c7c322d60e989e095aa511431edc766ca5e8059a5a76b99b80e21d.css rel=stylesheet><script src=/js/hb-head.min.01cd73a09512f0fc45bed2c68f9f9a23041c57dafb87c91cf91373611031bd84.js integrity="sha256-Ac1zoJUS8PxFvtLGj5+aIwQcV9r7h8kc+RNzYRAxvYQ=" crossorigin=anonymous></script><link rel=icon type=image/png href=/media/icon_hu_fb1746b3b5524ac3.png><link rel=apple-touch-icon type=image/png href=/media/icon_hu_eac71196304f5a85.png><link rel=canonical href=__CANONICAL_URL__>
<meta property="twitter:card" content="summary_large_image"><meta property="og:site_name" content="VISTA Research Group"><meta property="og:url" content="__CANONICAL_URL__"><meta property="og:title" content="__OG_TITLE__"><meta property="og:description" content="__OG_DESC__">__OG_IMAGE_TAGS__<meta property="og:locale" content="en">__PUBLISHED_TIME_TAG____MODIFIED_TIME_TAG__<title>__PAGE_TITLE__</title><style>@font-face{font-family:inter var;font-style:normal;font-weight:100 900;font-display:swap;src:url(/dist/font/Inter.var.woff2)format(woff2)}</style><script defer src=/js/hugo-blox-en.min.65b31b94cb4f09cfd8f827efdb711400b677b90781e4aee753207d95de698687.js integrity="sha256-ZbMblMtPCc/Y+Cfv23EUALZ3uQeB5K7nUyB9ld5phoc="></script><script>console.log("✓ Alpine.js loading on demand")</script><script src=/dist/lib/alpinejs/cdn.min.e041f1b639d1e6b2fc2736d8d7638a409afcd444a6ec90446f8f4e44fa36f406.js integrity="sha256-4EHxtjnR5rL8JzbY12OKQJr81ESm7JBEb49ORPo29AY=" defer></script><script defer src=/js/hb-search.min.135366008264b9d452ff89aad28374bc7e4b40d2c047098318511786419873b0.js integrity="sha256-E1NmAIJkudRS/4mq0oN0vH5LQNLARwmDGFEXhkGYc7A="></script><link rel=stylesheet href=https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css crossorigin=anonymous referrerpolicy=no-referrer></head><body class="dark:bg-hb-dark dark:text-white page-wrapper" id=top><div id=page-bg></div><div class=page-header><header id=site-header class=header><nav class="navbar px-3 flex justify-start"><div class="order-0 h-full"><a class=navbar-brand href=/ title="VISTA Research Group">VISTA Research Group</a></div><input id=nav-toggle type=checkbox class=hidden>
<label for=nav-toggle class="order-3 cursor-pointer flex items-center lg:hidden text-dark dark:text-white lg:order-1"><svg id="show-button" class="h-6 fill-current block" viewBox="0 0 20 20"><title>Open Menu</title><path d="M0 3h20v2H0V3zm0 6h20v2H0V9zm0 6h20v2H0V0z"/></svg>
<svg id="hide-button" class="h-6 fill-current hidden" viewBox="0 0 20 20"><title>Close Menu</title><polygon points="11 9 22 9 22 11 11 11 11 22 9 22 9 11 -2 11 -2 9 9 9 9 -2 11 -2" transform="rotate(45 10 10)"/></svg></label><ul id=nav-menu class="navbar-nav order-3 hidden lg:flex w-full pb-6 lg:order-1 lg:w-auto lg:space-x-2 lg:pb-0 xl:space-x-8 justify-start"><li class=nav-item><a class=nav-link href=/>Home</a></li><li class=nav-item><a class=nav-link href=/research/>Research</a></li><li class=nav-item><a class=nav-link href=/project/>Projects</a></li><li class=nav-item><a class=nav-link href=/publication/>Publications</a></li><li class=nav-item><a class=nav-link href=/post/>Posts</a></li><li class=nav-item><a class=nav-link href=/authors/>Team</a></li><li class=nav-item><a class=nav-link href=/resources/>Resources</a></li><li class=nav-item><a class=nav-link href=/about/>About</a></li></ul><div class="order-1 ml-auto flex items-center md:order-2 lg:ml-0"><button aria-label="toggle search" class="text-black hover:text-primary inline-block px-3 text-xl dark:text-white cursor-pointer" data-search-toggle>
<svg height="16" width="16" viewBox="0 0 512 512" fill="currentColor"><path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8.0 45.3s-32.8 12.5-45.3.0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9.0 208S93.1.0 208 0 416 93.1 416 208zM208 352a144 144 0 100-288 144 144 0 100 288z"/></svg></button></div></nav></header>
<!-- SEARCH MODAL (static) -->
__SEARCH_MODAL__
</div>
<!-- PAGE BODY -->
<div class="page-body my-10"><div class="mx-auto flex max-w-screen-xl">
<!-- SIDEBAR (static) -->
<aside class="hb-sidebar-container max-lg:[transform:translate3d(0,-100%,0)] lg:hidden xl:block"><div class="px-4 pt-4 lg:hidden"></div><div class="hb-scrollbar lg:h-[calc(100vh-var(--navbar-height))]"><ul class="flex flex-col gap-1 lg:hidden"><li><a class="hb-sidebar-custom-link text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-primary-800 dark:hover:text-gray-50" href=/post/>Posts</a></li><li class=open><a class="hb-sidebar-custom-link text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-primary-800 dark:hover:text-gray-50" href=/publication/>Publications</a></li><li><a class="hb-sidebar-custom-link text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-primary-800 dark:hover:text-gray-50" href=/about/>About</a></li><li><a class="hb-sidebar-custom-link text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-primary-800 dark:hover:text-gray-50" href=/project/>Projects</a></li><li><a class="hb-sidebar-custom-link text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-primary-800 dark:hover:text-gray-50" href=/research/>Research</a></li><li><a class="hb-sidebar-custom-link text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-primary-800 dark:hover:text-gray-50" href=/resources/>Resources</a></li></ul><div class="max-xl:hidden h-0 w-32 shrink-0"></div></div></aside>
<!-- MAIN CONTENT (dynamic) -->
<article class="w-full break-words flex min-h-[calc(100vh-var(--navbar-height))] min-w-0 justify-center pb-8 pr-[calc(env(safe-area-inset-right)-1.5rem)]">
<main class="w-full min-w-0 max-w-6xl px-6 pt-4 md:px-12">
__CONTENT__
</main>
</article>
</div></div>
<!-- PAGE FOOTER (static) -->
<div class=page-footer><footer class="container mx-auto flex flex-col justify-items-center text-sm leading-6 mt-24 mb-4 text-slate-700 dark:text-slate-200"><footer class=site-footer><div class="container mx-auto px-4 max-w-6xl"><div class="grid grid-cols-1 md:grid-cols-4 gap-8"><div class=md:col-span-2><h3 class="text-xl font-bold text-white mb-3">VISTA Research Group</h3><p class="text-lg text-sky-200/70 mb-2">维势研究组</p><p class="text-sm text-slate-400 leading-relaxed max-w-md">Visualization, Intelligence, Simulation &amp; Tactical Analysis<br>聚焦三维战场态势仿真、智能推演与作战辅助分析</p></div><div><h4 class="text-sm font-semibold text-white uppercase tracking-wider mb-4">Quick Links</h4><ul class="space-y-2 text-sm"><li><a href=/research/ class="text-slate-400 hover:text-white transition-colors">Research</a></li><li><a href=/project/ class="text-slate-400 hover:text-white transition-colors">Projects</a></li><li><a href=/publication/ class="text-slate-400 hover:text-white transition-colors">Publications</a></li><li><a href=/post/ class="text-slate-400 hover:text-white transition-colors">Posts</a></li></ul></div><div><h4 class="text-sm font-semibold text-white uppercase tracking-wider mb-4">More</h4><ul class="space-y-2 text-sm"><li><a href=/authors/ class="text-slate-400 hover:text-white transition-colors">Team</a></li><li><a href=/resources/ class="text-slate-400 hover:text-white transition-colors">Resources</a></li><li><a href=/about/ class="text-slate-400 hover:text-white transition-colors">About</a></li><li><a href=https://github.com/boooil/VISTA-Research-Group class="text-slate-400 hover:text-white transition-colors" target=_blank rel=noopener>GitHub</a></li></ul></div></div><div class="footer-bottom flex flex-col md:flex-row justify-between items-center gap-4"><p class="text-slate-500 text-sm">&copy; __CURRENT_YEAR__ VISTA Research Group. All rights reserved.</p><p class="text-slate-600 text-xs">Built with <a href=https://gohugo.io class="text-slate-500 hover:text-white transition-colors">Hugo</a> &amp; <a href=https://hugoblox.com class="text-slate-500 hover:text-white transition-colors">HugoBlox</a></p></div></div></footer><p class="powered-by text-center text-sm opacity-80 py-1">Made with <a class="underline hover:opacity-100" href="https://hugoblox.com?utm_source=site_footer" target=_blank rel=noopener>Hugo Blox Builder</a>. <a class="inline-flex items-center rounded px-2 py-0.5 border border-current ms-2 text-xs hover:opacity-100" href="https://hugoblox.com/start" target=_blank rel=noopener>Create yours →</a></p></footer></div><div id=hb-notification-container class="fixed top-20 right-4 z-[9999] pointer-events-none" aria-live=polite aria-atomic=true></div></body></html>`;

export function renderPublicationShell({
  content,
  canonicalUrl,
  title,
  description,
  publishedTime,
  modifiedTime,
  ogImage,
  currentYear,
}) {
  const safeTitle = escapeHTML(title);
  const safeDesc = escapeHTML(description || '').substring(0, 300);
  const ogImageTags = ogImage
    ? `<meta property="og:image" content="${escapeHTML(ogImage)}"><meta property="twitter:image" content="${escapeHTML(ogImage)}">`
    : '';
  const publishedTimeTag = publishedTime
    ? `<meta property="article:published_time" content="${escapeHTML(publishedTime)}">`
    : '';
  const modifiedTimeTag = modifiedTime
    ? `<meta property="article:modified_time" content="${escapeHTML(modifiedTime)}">`
    : '';

  return SHELL_TEMPLATE
    .replace(/__CONTENT__/, content)
    .replace(/__CANONICAL_URL__/g, escapeHTML(canonicalUrl))
    .replace(/__META_DESC__/g, safeDesc)
    .replace(/__OG_TITLE__/g, `${safeTitle} | VISTA Research Group`)
    .replace(/__OG_DESC__/g, safeDesc)
    .replace(/__OG_IMAGE_TAGS__/g, ogImageTags)
    .replace(/__PUBLISHED_TIME_TAG__/g, publishedTimeTag)
    .replace(/__MODIFIED_TIME_TAG__/g, modifiedTimeTag)
    .replace(/__PAGE_TITLE__/g, `${safeTitle} | VISTA Research Group`)
    .replace(/__CURRENT_YEAR__/g, escapeHTML(currentYear))
    .replace('__SEARCH_MODAL__', SEARCH_MODAL_HTML);
}

// 搜索模态框 HTML (从 Hugo 构建输出提取)
const SEARCH_MODAL_HTML = `<div x-data=searchModal() x-show=$store.search.open @keydown.escape.window="$store.search.open = false" @keydown.cmd.k.window.prevent="$store.search.open = !$store.search.open" @keydown.ctrl.k.window.prevent="$store.search.open = !$store.search.open" x-cloak class="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm" style=display:none><div class="absolute inset-0" @click="$store.search.open = false"></div><div class="relative mx-auto mt-[10vh] max-w-3xl" x-show=$store.search.open x-transition:enter="transition ease-out duration-200" x-transition:enter-start="opacity-0 translate-y-4 scale-95" x-transition:enter-end="opacity-100 translate-y-0 scale-100" x-transition:leave="transition ease-in duration-150" x-transition:leave-start="opacity-100 translate-y-0 scale-100" x-transition:leave-end="opacity-0 translate-y-4 scale-95"><div class="mx-4 overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-2xl ring-1 ring-gray-900/10 dark:ring-white/10"><div class="border-b border-gray-200 dark:border-gray-800"><div class="flex items-center gap-3 px-4 py-3"><svg class="h-5 w-5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5A7 7 0 113 10a7 7 0 0114 0z"/></svg>
<input x-ref=searchInput x-model=query @input="loading = query.trim() !== ''" @input.debounce.300ms=search() type=text placeholder="Search..." class="flex-1 bg-transparent text-lg outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400" autocomplete=off autofocus><div x-show=loading class=flex-shrink-0><svg class="animate-spin h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373.0.0 5.373.0 12h4zm2 5.291A7.962 7.962.0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg></div><kbd class="hidden sm:block flex-shrink-0 rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-400">ESC</kbd>
<button @click="$store.search.open = false" class="flex-shrink-0 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 cursor-pointer">
<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 18 6M6 6l12 12"/></svg></button></div></div><div class="max-h-[60vh] overflow-y-auto"><div x-show="!query && results.length === 0" class=p-6></div><div x-show="query && results.length > 0" class="divide-y divide-gray-200 dark:divide-gray-800"><template x-for="(result, index) in results" :key=result.id><a :href=result.url @mouseenter="selectedIndex = index" @click="$store.search.open = false" class="block px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group search-result"><h3 class="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors mb-2" x-html="result.meta.title || 'Untitled'"></h3><p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2" x-html=result.excerpt></p></a></template></div><div x-show="query && loading" class="px-6 py-16 text-center"><div class="inline-flex items-center gap-3"><svg class="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373.0.0 5.373.0 12h4zm2 5.291A7.962 7.962.0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg><div class=text-left><p class="text-lg font-medium text-gray-900 dark:text-white">Searching...</p></div></div></div><div x-show="query && results.length === 0 && !loading && hasSearched" class="px-6 py-12 text-center"><svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656.0M9 10h.01M15 10h.01M21 12A9 9 0 113 12a9 9 0 0118 0z"/></svg><h3 class="mt-4 text-lg font-semibold text-gray-900 dark:text-white">No results found</h3><button @click="query = ''; $refs.searchInput.focus()" class="mt-4 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium">Clear search</button></div></div><div class="border-t border-gray-200 dark:border-gray-800 px-4 py-3 bg-gray-50 dark:bg-gray-900/50"><div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400"><a href=https://hugoblox.com target=_blank rel=noopener class="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Powered by Hugo Blox</a></div></div></div></div></div><script>function searchModal(){return{query:"",results:[],loading:!1,hasSearched:!1,selectedIndex:-1,activeFilter:null,availableFilters:[],pagefind:null,async init(){try{this.pagefind=await import("/pagefind/pagefind.js"),await this.pagefind.init(),console.log("✓ Pagefind initialized"),await this.loadFilters()}catch(e){console.error("Failed to initialize Pagefind:",e)}this.$watch("$store.search.open",e=>{e?(this.$nextTick(()=>this.$refs.searchInput?.focus()),document.body.style.overflow="hidden"):(document.body.style.overflow="",this.query="",this.results=[],this.selectedIndex=-1,this.hasSearched=!1)}),window.addEventListener("keydown",e=>{if(!this.$store.search.open||this.results.length===0)return;if(e.key==="ArrowDown")e.preventDefault(),this.selectedIndex=this.selectedIndex<this.results.length-1?this.selectedIndex+1:0,this.scrollToSelected();else if(e.key==="ArrowUp")e.preventDefault(),this.selectedIndex=this.selectedIndex>0?this.selectedIndex-1:this.results.length-1,this.scrollToSelected();else if(e.key==="Enter"&&this.selectedIndex>=0){e.preventDefault();const t=this.results[this.selectedIndex];t&&(window.location.href=t.url,this.$store.search.open=!1)}})},scrollToSelected(){this.$nextTick(()=>{const e=document.querySelector(".search-result:nth-child("+(this.selectedIndex+1)+")");e&&e.scrollIntoView({block:"nearest",behavior:"smooth"})})},async search(){if(!this.query.trim()){this.results=[],this.hasSearched=!1;return}this.loading=!0,this.hasSearched=!1;try{const s=await this.pagefind.search(this.query);this.results=await Promise.all(s.results.slice(0,10).map(async e=>{const t=await e.data();return{id:t.url,url:t.url,meta:t.meta,excerpt:t.excerpt,filters:t.filters||{}}}))}catch(e){console.error("Search error:",e),this.results=[]}finally{this.loading=!1,this.hasSearched=!0}},async loadFilters(){try{const e=await this.pagefind.search("");const t=[];e.filters&&e.filters.type&&Object.entries(e.filters.type).forEach(([e,n])=>{t.push({category:"type",value:e,label:e.charAt(0).toUpperCase()+e.slice(1),count:n,filterKey:\`type:\${e}\`})}),this.availableFilters=t}catch(e){console.error("Failed to load filters:",e)}}}}document.addEventListener("alpine:init",()=>{Alpine.store("search",{open:!1})})</script><style>[x-cloak]{display:none!important}</style>`;

/**
 * 如果 KV 中有更新的 shell，从 KV 加载
 */
export async function loadShellFromKV(shellsKV) {
  try {
    const shellHTML = await shellsKV.get('shell:publication');
    if (shellHTML) {
      return (params) => shellHTML.replace('__CONTENT__', params.content)
        .replace(/__CANONICAL_URL__/g, escapeHTML(params.canonicalUrl))
        .replace(/__OG_TITLE__/g, escapeHTML(params.title) + ' | VISTA Research Group')
        .replace(/__META_DESC__/g, escapeHTML(params.description || '').substring(0, 300))
        .replace(/__OG_DESC__/g, escapeHTML(params.description || '').substring(0, 300))
        .replace(/__PUBLISHED_TIME_TAG__/g, params.publishedTime ? `<meta property="article:published_time" content="${escapeHTML(params.publishedTime)}">` : '')
        .replace(/__MODIFIED_TIME_TAG__/g, params.modifiedTime ? `<meta property="article:modified_time" content="${escapeHTML(params.modifiedTime)}">` : '')
        .replace(/__PAGE_TITLE__/g, escapeHTML(params.title) + ' | VISTA Research Group')
        .replace(/__OG_IMAGE_TAGS__/g, params.ogImage ? `<meta property="og:image" content="${escapeHTML(params.ogImage)}"><meta property="twitter:image" content="${escapeHTML(params.ogImage)}">` : '')
        .replace(/__CURRENT_YEAR__/g, escapeHTML(params.currentYear || '2026'));
    }
  } catch (e) {
    console.warn('[SHELL] Failed to load shell from KV, using default:', e);
  }
  return null;
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
