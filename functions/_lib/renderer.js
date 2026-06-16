/**
 * Publication 页面渲染器
 *
 * 负责:
 * 1. 从 GitHub Raw API 获取 Markdown 源文件
 * 2. 解析 frontmatter
 * 3. Markdown → HTML (marked)
 * 4. 组装完整页面 HTML
 */

import { marked } from 'marked';
import { parseMarkdown } from './frontmatter.js';
import { resolveAuthors, renderAuthorsHTML, PUB_TYPE_LABELS } from './authors.js';
import { formatDate, extractYear, calcReadingTime, toISODate } from './utils.js';
import { renderPublicationShell } from './shell.js';

// 配置 marked
marked.use({
  gfm: true,
  breaks: false,
});

/**
 * 渲染 publication 页面
 * @param {object} params
 * @param {string} params.slug - publication slug
 * @param {object} params.env - Worker env (KV bindings, vars)
 * @param {object} params.log - logger
 * @returns {Promise<{html: string, status: number, cacheKey: string}>}
 */
export async function renderPublication({ slug, env, log }) {
  const {
    GITHUB_OWNER = 'Boooil',
    GITHUB_REPO = 'VISTA-Research-Group',
    GITHUB_BRANCH = 'main',
    SITE_BASE_URL = 'https://vista-research-group.pages.dev',
  } = env;

  // 1. 构建 GitHub Raw URL
  const rawUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/content/publication/${slug}/index.md`;
  log.debug('Fetching markdown', { rawUrl });

  // 2. 获取 Markdown 内容
  let mdText;
  try {
    const res = await fetch(rawUrl, {
      cf: { cacheTtl: 30 },
      headers: { 'User-Agent': 'VISTA-Edge-Renderer/0.1' },
    });

    if (!res.ok) {
      log.warn('GitHub Raw returned non-200', { status: res.status, slug });
      return { html: null, status: res.status, cacheKey: null };
    }

    mdText = await res.text();
  } catch (err) {
    log.error('Failed to fetch from GitHub Raw', err.message);
    return { html: null, status: 502, cacheKey: null };
  }

  // 3. 解析 frontmatter
  const { frontmatter, body } = parseMarkdown(mdText);
  log.debug('Parsed frontmatter', { title: frontmatter.title, authors: frontmatter.authors?.length });

  if (!frontmatter.title) {
    log.warn('No title in frontmatter', { slug });
    return { html: null, status: 500, cacheKey: null };
  }

  // 4. Markdown → HTML
  let bodyHTML = '';
  if (body) {
    try {
      bodyHTML = marked.parse(body);
    } catch (err) {
      log.error('Markdown parsing failed', err.message);
      bodyHTML = `<pre>${escapeHTML(body)}</pre>`;
    }
  }

  // 5. 解析作者
  const githubPath = `content/publication/${slug}/`;
  const { authors } = await resolveAuthors(
    frontmatter.authors || [],
    frontmatter.author_notes || null,
    env.AUTHORS,
    githubPath
  );

  // 6. 处理 metadata
  const pubType = frontmatter.publication_types?.[0] || '';
  const pubTypeLabel = PUB_TYPE_LABELS[pubType] || pubType;

  const dateDisplay = formatDate(frontmatter.date);
  const readingTime = calcReadingTime(body);
  const publicationVenue = frontmatter.publication || '';
  const abstract = frontmatter.abstract || frontmatter.summary || '';
  const links = frontmatter.links || [];

  // 封面图
  const featuredImage = frontmatter.image?.filename || '';
  const featuredImageUrl = featuredImage
    ? `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/content/publication/${slug}/${featuredImage}`
    : '';

  // 7. 组装 content HTML
  const authorsHTML = renderAuthorsHTML(authors);
  const linksHTML = renderLinksHTML(links, slug, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH);
  const featuredHTML = renderFeaturedImage(featuredImageUrl, frontmatter.image);

  const metadataHTML = renderPublicationMetadata({
    abstract,
    pubTypeLabel,
    pubType,
    publicationVenue,
  });

  const proseHTML = bodyHTML
    ? `<div class="prose prose-slate lg:prose-xl dark:prose-invert max-w-none">${bodyHTML}</div>`
    : '';

  // 8. 构建完整 <main> 内容
  const mainContent = buildMainContent({
    title: frontmatter.title,
    dateDisplay,
    authorsHTML,
    readingTime,
    linksHTML,
    featuredHTML,
    metadataHTML,
    proseHTML,
    lastEdited: frontmatter.date,
    hasAuthors: authors.length > 0,
    hasDate: !!frontmatter.date,
    hasReadingTime: frontmatter.reading_time !== false,
  });

  // 9. 构建完整页面
  const canonicalUrl = `${SITE_BASE_URL}/publication/${slug}/`;
  const publishedISO = toISODate(frontmatter.date);
  const metaDescription = (abstract || frontmatter.title || '').substring(0, 300);

  const now = new Date();
  const currentYear = now.getFullYear().toString();

  const html = renderPublicationShell({
    content: mainContent,
    canonicalUrl,
    title: frontmatter.title,
    description: metaDescription,
    publishedTime: publishedISO,
    modifiedTime: publishedISO,
    ogImage: featuredImageUrl || '',
    currentYear,
  });

  return { html, status: 200, cacheKey: canonicalUrl };
}

/**
 * 渲染链接按钮
 */
function renderLinksHTML(links, slug, owner, repo, branch) {
  const buttons = [];

  if (Array.isArray(links)) {
    for (const link of links) {
      if (link.url && link.name) {
        buttons.push(linkButton(link.name, link.url, link.name.toLowerCase()));
      }
    }
  }

  const citeBibUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/content/publication/${slug}/cite.bib`;
  buttons.push(linkButton('Cite', `/publication/${slug}/cite.bib`, 'cite'));

  if (buttons.length === 0) return '';

  return `<div>${buttons.join('\n')}</div>`;
}

function linkButton(label, url, icon) {
  const svgMap = {
    pdf: `<svg style="height:1em" class="inline-block" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.5 14.25v-2.625A3.375 3.375.0 0016.125 8.25h-1.5A1.125 1.125.0 0113.5 7.125v-1.5A3.375 3.375.0 0010.125 2.25H8.25m2.25 0H5.625c-.621.0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621.0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>`,
    cite: `<svg style="height:1em" class="inline-block" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75A1.125 1.125.0 013.75 20.625V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06.0 011.5.124m7.5 10.376h3.375c.621.0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06.0 00-1.5-.124H9.375c-.621.0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375A1.125 1.125.0 018.25 16.125v-9.25m12 6.625v-1.875A3.375 3.375.0 0016.875 8.25h-1.5A1.125 1.125.0 0114.25 7.125v-1.5A3.375 3.375.0 0010.875 2.25H9.75"/></svg>`,
    default: `<svg style="height:1em" class="inline-block" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.19 8.688a4.5 4.5.0 011.242 7.244l-4.5 4.5a4.5 4.5.0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5.0 00-6.364-6.364l-4.5 4.5a4.5 4.5.0 001.242 7.244"/></svg>`,
  };
  const svg = svgMap[icon] || svgMap.default;
  return `<a class="hb-attachment-link hb-attachment-link-large inline-flex items-center gap-1 mr-2" href="${url}" target="_blank" rel="noopener">${svg}<span>${escapeHTML(label)}</span></a>`;
}

/**
 * 渲染封面图
 */
function renderFeaturedImage(imageUrl, imageMeta) {
  if (!imageUrl) return '';
  const alt = imageMeta?.alt_text || '';
  const caption = imageMeta?.caption || '';
  return `<div class="article-header article-container featured-image-wrapper mt-4 mb-16" style="max-width:100%;max-height:480px"><div style="position:relative"><img src="${imageUrl}" alt="${escapeHTML(alt)}" class="featured-image" fetchpriority="high" style="max-width:100%;height:auto">${caption ? `<span class="article-header-caption">${escapeHTML(caption)}</span>` : ''}</div></div>`;
}

/**
 * 渲染 publication metadata 区域
 */
function renderPublicationMetadata({ abstract, pubTypeLabel, pubType, publicationVenue }) {
  let html = '';

  html += `<div
        x-data="{
          widthMode: 'compact',
          widthStyle: 'max-width: 65ch;',
          center: true,
          widthOptions: [{&quot;center&quot;:true,&quot;desc&quot;:&quot;65ch · 与标题对齐&quot;,&quot;key&quot;:&quot;compact&quot;,&quot;label&quot;:&quot;紧凑&quot;,&quot;style&quot;:&quot;max-width: 65ch;&quot;},{&quot;center&quot;:true,&quot;desc&quot;:&quot;48rem · 适中宽度&quot;,&quot;key&quot;:&quot;standard&quot;,&quot;label&quot;:&quot;标准&quot;,&quot;style&quot;:&quot;max-width: 48rem;&quot;},{&quot;center&quot;:true,&quot;desc&quot;:&quot;56rem · 更宽&quot;,&quot;key&quot;:&quot;wide&quot;,&quot;label&quot;:&quot;宽栏&quot;,&quot;style&quot;:&quot;max-width: 56rem;&quot;},{&quot;center&quot;:false,&quot;desc&quot;:&quot;不限宽 · 全屏&quot;,&quot;key&quot;:&quot;full&quot;,&quot;label&quot;:&quot;铺满&quot;,&quot;style&quot;:&quot;max-width: none;&quot;}],
          init() {
            const saved = localStorage.getItem('pub-single-width-mode');
            const found = this.widthOptions.find(o => o.key === saved);
            if (found) {
              this.widthMode = found.key;
              this.widthStyle = found.style;
              this.center = found.center;
            }
          },
          setWidth(mode) {
            this.widthMode = mode;
            const found = this.widthOptions.find(o => o.key === mode);
            if (found) {
              this.widthStyle = found.style;
              this.center = found.center;
            }
            localStorage.setItem('pub-single-width-mode', mode);
          }
        }"
        :style="widthStyle"
        :class="(center ? 'mx-auto ' : '') + 'mt-8'">

        <div class="flex items-center gap-2 justify-end mb-4">
          <span class="text-xs text-gray-400 dark:text-gray-500 mr-1 hidden sm:inline">宽度</span>
          <template x-for="opt in widthOptions" :key="opt.key">
            <button
              @click="setWidth(opt.key)"
              :class="widthMode === opt.key
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300 ring-1 ring-primary-300'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'"
              :title="opt.desc"
              class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer"
              x-text="opt.label"
            ></button>
          </template>
        </div>`;

  if (abstract) {
    html += `<div class="flex flex-col gap-3 my-6">`;
    html += `<div class="font-bold text-2xl">Abstract</div>`;
    html += `<div>${escapeHTML(abstract)}</div>`;
  } else {
    html += `<div class="flex flex-col gap-3 my-6">`;
  }

  if (pubTypeLabel) {
    const pubTypeUrl = pubType ? `/publication_types/${pubType}/` : '#';
    html += `<div class="font-bold text-2xl">Type</div>`;
    html += `<div><a href="${pubTypeUrl}">${escapeHTML(pubTypeLabel)}</a></div>`;
  }

  if (publicationVenue) {
    html += `<div class="font-bold text-2xl">Publication</div>`;
    html += `<div>${escapeHTML(publicationVenue)}</div>`;
  }

  html += `</div>`;

  return html;
}

/**
 * 构建完整 main 区域内容
 */
function buildMainContent({
  title,
  dateDisplay,
  authorsHTML,
  readingTime,
  linksHTML,
  featuredHTML,
  metadataHTML,
  proseHTML,
  lastEdited,
  hasAuthors,
  hasDate,
  hasReadingTime,
}) {
  let html = '';

  html += `<h1 class="mt-2 text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">${escapeHTML(title)}</h1>`;

  html += `<div class="mt-4 mb-16">`;
  html += `<div class="text-gray-500 dark:text-gray-300 text-sm flex items-center flex-wrap gap-y-2">`;

  if (dateDisplay && hasDate) {
    html += `<span class="mr-1">${dateDisplay}</span>`;
    if (hasAuthors) html += `<span class="mx-1">·</span>`;
  }

  html += authorsHTML;

  if (hasReadingTime) {
    html += `<span class="mx-1">·</span>`;
    html += `<span class="mx-1">${readingTime} min read</span>`;
  }

  html += `</div>`;

  if (linksHTML) {
    html += `<div class="mt-3">${linksHTML}</div>`;
  }

  html += `</div>`;
  html += featuredHTML;
  html += metadataHTML;

  if (proseHTML) {
    html += proseHTML;
  }

  html += `</div>`; // close width toggle div

  if (lastEdited) {
    html += `<time class="mt-12 mb-8 block text-xs text-gray-500 ltr:text-right rtl:text-left dark:text-gray-400" datetime="${toISODate(lastEdited)}"><span>Last updated on</span> ${formatDate(lastEdited)}</time>`;
  }

  html += `<div class="container mx-auto prose prose-slate lg:prose-xl dark:prose-invert mt-5"><div class="max-w-prose print:hidden">`;
  html += `<section class="flex flex-row flex-wrap justify-center pt-4 text-xl">`;
  html += `<a target=_blank rel=noopener class="m-1 rounded-md bg-neutral-300 p-1.5 text-neutral-700 hover:bg-primary-500 hover:text-neutral-300 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-primary-400 dark:hover:text-neutral-800" href="#" title="Share on X"><svg style="height:1em" viewBox="0 0 512 512"><path fill="currentColor" d="M389.2 48h70.6L305.6 224.2 487 464H345L233.7 318.6 106.5 464H35.8L200.7 275.5 26.8 48H172.4L272.9 180.9 389.2 48zM364.4 421.8h39.1L151.1 88h-42L364.4 421.8z"/></svg></a>`;
  html += `</section>`;
  html += `<div class="pt-1 no-prose w-full"><hr class="border-dotted border-neutral-300 dark:border-neutral-600"></div>`;
  html += `</div></div>`;

  return html;
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
