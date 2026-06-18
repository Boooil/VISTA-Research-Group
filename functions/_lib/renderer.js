/**
 * 页面渲染器 — 支持 Post / Publication / Project / Author 四种类型
 *
 * Phase 2: 完整覆盖四种详情页类型，图片路径转换，publication_types 中文化
 *
 * 职责:
 * 1. 从 GitHub Raw API 获取 Markdown 源文件
 * 2. 解析 frontmatter
 * 3. Markdown → HTML (marked)
 * 4. 组装完整页面 HTML
 */

import { marked } from 'marked';
import { parseMarkdown } from './frontmatter.js';
import { resolveAuthors, renderAuthorsHTML, PUB_TYPE_LABELS } from './authors.js';
import { formatDate, calcReadingTime, toISODate } from './utils.js';
import { renderPageShell, renderAuthorShell } from './shell.js';
import { getHeadAssets } from './head-assets.js';
import { getPublicationsByAuthor } from './slug-map.js';

// 配置 marked
marked.use({
  gfm: true,
  breaks: false,
});

// ============================================================================
// 公共辅助函数
// ============================================================================

/**
 * 从 GitHub Raw API 获取 Markdown 源内容
 * @returns {Promise<{mdText: string|null, status: number}>}
 */
async function fetchMarkdown(githubPath, env) {
  const {
    GITHUB_OWNER = 'Boooil',
    GITHUB_REPO = 'VISTA-Research-Group',
    GITHUB_BRANCH = 'main',
  } = env;

  const rawUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${githubPath}`;

  try {
    const res = await fetch(rawUrl, {
      cf: { cacheTtl: 30 },
      headers: { 'User-Agent': 'VISTA-Edge-Renderer/0.2' },
    });

    if (!res.ok) {
      return { mdText: null, status: res.status };
    }

    const mdText = await res.text();
    return { mdText, status: 200 };
  } catch (err) {
    return { mdText: null, status: 502 };
  }
}

/**
 * 将 Markdown 正文中的相对图片路径转为 GitHub Raw 绝对路径
 * 处理 ![alt](./img.png) 和 ![](relative/path.png) 格式
 *
 * Phase 2.4: 图片路径转换
 */
function convertImagePaths(markdown, githubContentDir, owner, repo, branch) {
  if (!markdown) return '';

  return markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
    // 跳过绝对 URL (http/https) 和根路径
    if (/^(https?:)?\/\//.test(src) || src.startsWith('/')) {
      return match;
    }

    // 解析相对路径 — 基于当前页面所在目录
    // ./subfolder/img.png → content/type/slug/subfolder/img.png
    const resolved = src.replace(/^\.\//, '');
    const absoluteUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${githubContentDir}${resolved}`;
    return `![${alt}](${absoluteUrl})`;
  });
}

// hugoblox.ids 字段 → URL 模板映射
const IDS_URL_TEMPLATES = {
  doi:             { label: 'DOI',           url: 'https://doi.org/{id}',                                    icon: 'doi' },
  arxiv:           { label: 'arXiv',         url: 'https://arxiv.org/abs/{id}',                              icon: 'arxiv' },
  openreview:      { label: 'OpenReview',    url: 'https://openreview.net/forum?id={id}',                    icon: 'link' },
  dblp:            { label: 'DBLP',          url: 'https://dblp.org/rec/{id}',                               icon: 'link' },
  semanticscholar: { label: 'Semantic Scholar', url: 'https://www.semanticscholar.org/paper/{id}',           icon: 'link' },
  acl_id:          { label: 'ACL',           url: 'https://aclanthology.org/{id}',                           icon: 'link' },
  hal:             { label: 'HAL',           url: 'https://hal.science/{id}',                                icon: 'link' },
  isbn:            { label: 'ISBN',          url: 'https://www.worldcat.org/isbn/{id}',                      icon: 'link' },
};

// 遗留字段 → 链接元数据
const LEGACY_FIELDS = {
  url_pdf:      { label: 'PDF',        icon: 'pdf' },
  url_code:     { label: 'Code',       icon: 'code' },
  url_dataset:  { label: 'Dataset',    icon: 'link' },
  url_slides:   { label: 'Slides',     icon: 'link' },
  url_video:    { label: 'Video',      icon: 'link' },
  url_poster:   { label: 'Poster',     icon: 'link' },
  url_project:  { label: 'Project',    icon: 'link' },
  url_source:   { label: 'Source',     icon: 'link' },
  external_link: { label: 'Site',      icon: 'link' },
};

/**
 * 从 frontmatter 归一化所有链接来源为 [{label, url, icon}]
 * 来源优先级: frontmatter.links > hugoblox.ids > legacy url_* > doi 遗留字段
 */
function buildLinks(frontmatter) {
  const result = [];
  const seen = new Set();

  function add(label, url, icon) {
    if (!url || seen.has(url)) return;
    seen.add(url);
    result.push({ label, url, icon: icon || 'link' });
  }

  // 1. frontmatter.links 数组（label/type 均支持）
  if (Array.isArray(frontmatter.links)) {
    for (const link of frontmatter.links) {
      const url = link.url || (link.id && link.provider
        ? (IDS_URL_TEMPLATES[link.provider]?.url || '').replace('{id}', link.id)
        : '');
      const label = link.label || link.name || link.type || 'Link';
      const icon = link.icon || link.type || 'link';
      add(label, url, icon);
    }
  }

  // 2. hugoblox.ids
  const ids = frontmatter.hugoblox?.ids || {};
  for (const [key, id] of Object.entries(ids)) {
    if (!id || !IDS_URL_TEMPLATES[key]) continue;
    const tmpl = IDS_URL_TEMPLATES[key];
    add(tmpl.label, tmpl.url.replace('{id}', id), tmpl.icon);
  }

  // 3. 顶层遗留 doi 字段
  if (frontmatter.doi && !ids.doi) {
    const doi = frontmatter.doi;
    const url = doi.startsWith('http') ? doi : `https://doi.org/${doi}`;
    add('DOI', url, 'doi');
  }

  // 4. legacy url_* 字段
  for (const [field, meta] of Object.entries(LEGACY_FIELDS)) {
    const url = frontmatter[field];
    if (url) add(meta.label, url, meta.icon);
  }

  return result;
}

/**
 * 渲染链接按钮 (通用)
 * @param frontmatter - 完整 frontmatter 对象，用于 buildLinks
 * @param type - 页面类型（publication 时附加 Cite 按钮）
 * @param citeBib - cite.bib 文本内容
 */
function renderLinksHTML(frontmatter, type, citeBib) {
  const buttons = [];

  for (const link of buildLinks(frontmatter)) {
    buttons.push(linkButton(link.label, link.url, link.icon));
  }

  // Cite 按钮（publication 专属）
  if (type === 'publication' && citeBib && citeBib.trim()) {
    buttons.push(citeCopyButton(citeBib));
  }

  if (buttons.length === 0) return '';
  return `<div>${buttons.join('\n')}</div>`;
}

function linkButton(label, url, icon) {
  const PDF_SVG = `<svg style="height:1em" class="inline-block" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.5 14.25v-2.625A3.375 3.375 0 0016.125 8.25h-1.5A1.125 1.125 0 0113.5 7.125v-1.5A3.375 3.375 0 0010.125 2.25H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>`;
  const CODE_SVG = `<svg style="height:1em" class="inline-block" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"/></svg>`;
  const LINK_SVG = `<svg style="height:1em" class="inline-block" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"/></svg>`;
  const svgMap = {
    pdf:   PDF_SVG,
    code:  CODE_SVG,
    doi:   LINK_SVG,
    arxiv: LINK_SVG,
    link:  LINK_SVG,
  };
  const svg = svgMap[icon] || LINK_SVG;
  return `<a class="hb-attachment-link hb-attachment-link-large inline-flex items-center gap-1 mr-2" href="${escapeHTML(url)}" target="_blank" rel="noopener">${svg}<span>${escapeHTML(label)}</span></a>`;
}

/**
 * Cite 复制按钮:点击把 BibTeX 内容复制到剪贴板(无 fetch、无 404)。
 * bib 原文内联进隐藏 <template>,JS 读取并 navigator.clipboard.writeText。
 * 自包含(内联 onclick),边缘版与静态版可共用同款标记。
 */
function citeCopyButton(bib) {
  const svg = `<svg style="height:1em" class="inline-block" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75A1.125 1.125.0 013.75 20.625V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06.0 011.5.124m7.5 10.376h3.375c.621.0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06.0 00-1.5-.124H9.375c-.621.0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375A1.125 1.125.0 018.25 16.125v-9.25m12 6.625v-1.875A3.375 3.375.0 0016.875 8.25h-1.5A1.125 1.125.0 0114.25 7.125v-1.5A3.375 3.375.0 0010.875 2.25H9.75"/></svg>`;
  // bib 内容放进 <script type="text/bibtex">(不执行、不需 HTML 转义正文,只须防 </script>)
  const safeBib = String(bib).replace(/<\/script>/gi, '<\\/script>');
  return `<span class="hb-cite-copy inline-flex items-center mr-2">` +
    `<script type="text/bibtex" class="hb-cite-data">${safeBib}</script>` +
    `<button type="button" class="hb-attachment-link hb-attachment-link-large inline-flex items-center gap-1 cursor-pointer" ` +
    `onclick="(function(b){var d=b.parentNode.querySelector('.hb-cite-data').textContent;` +
    `navigator.clipboard.writeText(d).then(function(){var s=b.querySelector('.hb-cite-label');var o=s.textContent;s.textContent='已复制 ✓';setTimeout(function(){s.textContent=o;},1500);})` +
    `.catch(function(){var s=b.querySelector('.hb-cite-label');s.textContent='复制失败';});})(this)">` +
    `${svg}<span class="hb-cite-label">Cite</span></button></span>`;
}

/**
 * 渲染封面图
 */
function renderFeaturedImage(imageUrl, imageMeta) {
  if (!imageUrl) return '';
  const alt = escapeHTML(imageMeta?.alt_text || '');
  const caption = imageMeta?.caption || '';
  const width = imageMeta?.width ? ` width="${escapeHTML(String(imageMeta.width))}"` : '';
  const height = imageMeta?.height ? ` height="${escapeHTML(String(imageMeta.height))}"` : '';
  const captionHTML = caption ? `<span class="article-header-caption">${escapeHTML(caption)}</span>` : '';
  return `<div class="article-header article-container featured-image-wrapper mt-4 mb-16" style="max-width:100%;max-height:480px"><div style="position:relative"><img src="${escapeHTML(imageUrl)}" alt="${alt}"${width}${height} class="featured-image" fetchpriority="high" loading="lazy" style="max-width:100%;height:auto">${captionHTML}</div></div>`;
}

// ============================================================================
// 页面渲染入口
// ============================================================================

/**
 * 渲染 publication 页面
 */
export async function renderPublication({ slug, folder, env, log }) {
  const {
    GITHUB_OWNER = 'Boooil',
    GITHUB_REPO = 'VISTA-Research-Group',
    GITHUB_BRANCH = 'main',
    SITE_BASE_URL = 'https://vista-research-group.pages.dev',
  } = env;

  const contentDir = `content/publication/${folder || slug}/`;

  // 1. 获取 Markdown
  const { mdText, status } = await fetchMarkdown(`${contentDir}index.md`, env);
  if (!mdText) {
    log.warn('[renderPublication] Failed to fetch or not found', { slug, status });
    return { html: null, status, cacheKey: null };
  }

  // 2. 解析 frontmatter + body
  const { frontmatter, body } = parseMarkdown(mdText);
  log.debug('[renderPublication] Parsed frontmatter', { title: frontmatter.title });

  if (!frontmatter.title) {
    log.warn('[renderPublication] No title', { slug });
    return { html: null, status: 500, cacheKey: null };
  }

  // 3. 转换正文内相对图片路径
  const processedBody = convertImagePaths(body, contentDir, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH);

  // 4. Markdown → HTML
  let bodyHTML = '';
  if (processedBody) {
    try {
      bodyHTML = marked.parse(processedBody);
    } catch (err) {
      log.error('[renderPublication] Markdown parse error', err.message);
      bodyHTML = `<pre>${escapeHTML(processedBody)}</pre>`;
    }
  }

  // 5. 解析作者
  const { authors } = await resolveAuthors(
    frontmatter.authors || [],
    frontmatter.author_notes || null,
    env.AUTHORS,
    contentDir
  );
  const authorsHTML = renderAuthorsHTML(authors);

  // 6. 元数据
  const pubType = frontmatter.publication_types?.[0] || '';
  const pubTypeLabel = PUB_TYPE_LABELS[pubType] || pubType;
  const dateDisplay = formatDate(frontmatter.date);
  const readingTime = calcReadingTime(body);
  const publicationVenue = frontmatter.publication || '';
  const abstract = frontmatter.abstract || frontmatter.summary || '';
  const event = frontmatter.event || '';
  const event_url = frontmatter.event_url || '';
  const location = frontmatter.location || '';

  // 7. 链接按钮 + Cite(bib 来自 frontmatter.cite,有则渲染复制按钮)
  const citeBib = frontmatter.cite || '';
  const linksHTML = renderLinksHTML(frontmatter, 'publication', citeBib);

  // 8. 封面图
  const featuredImage = frontmatter.image?.filename || '';
  const featuredImageUrl = featuredImage
    ? `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${contentDir}${featuredImage}`
    : '';
  const featuredHTML = renderFeaturedImage(featuredImageUrl, frontmatter.image);

  // 9. 构建 main 内容 (Publication: 宽度切换 + pub metadata)
  const mainContent = buildPublicationContent({
    title: frontmatter.title,
    dateDisplay,
    authorsHTML,
    readingTime,
    linksHTML,
    featuredHTML,
    bodyHTML,
    abstract,
    pubTypeLabel,
    pubType,
    publicationVenue,
    event,
    event_url,
    location,
    lastEdited: frontmatter.date,
    hasAuthors: authors.length > 0,
    hasDate: !!frontmatter.date,
    hasReadingTime: frontmatter.reading_time !== false,
  });

  // 10. 构建完整页面
  const canonicalUrl = `${SITE_BASE_URL}/publication/${slug}/`;
  const publishedISO = toISODate(frontmatter.date);
  const metaDescription = (abstract || frontmatter.title || '').substring(0, 300);
  const now = new Date();
  const currentYear = now.getFullYear().toString();

  const html = renderPageShell({
    content: mainContent,
    canonicalUrl,
    title: frontmatter.title,
    description: metaDescription,
    publishedTime: publishedISO,
    modifiedTime: publishedISO,
    ogImage: featuredImageUrl || '',
    currentYear,
    headAssets: await getHeadAssets(SITE_BASE_URL, log),
  });

  return { html, status: 200, cacheKey: canonicalUrl };
}

/**
 * 渲染 post 页面
 */
export async function renderPost({ slug, folder, env, log }) {
  const {
    GITHUB_OWNER = 'Boooil',
    GITHUB_REPO = 'VISTA-Research-Group',
    GITHUB_BRANCH = 'main',
    SITE_BASE_URL = 'https://vista-research-group.pages.dev',
  } = env;

  const contentDir = `content/post/${folder || slug}/`;

  // 1. 获取 Markdown
  const { mdText, status } = await fetchMarkdown(`${contentDir}index.md`, env);
  if (!mdText) {
    log.warn('[renderPost] Failed to fetch or not found', { slug, status });
    return { html: null, status, cacheKey: null };
  }

  // 2. 解析 frontmatter + body
  const { frontmatter, body } = parseMarkdown(mdText);
  log.debug('[renderPost] Parsed frontmatter', { title: frontmatter.title });

  if (!frontmatter.title) {
    log.warn('[renderPost] No title', { slug });
    return { html: null, status: 500, cacheKey: null };
  }

  // 3. 转换正文内相对图片路径
  const processedBody = convertImagePaths(body, contentDir, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH);

  // 4. Markdown → HTML
  let bodyHTML = '';
  if (processedBody) {
    try {
      bodyHTML = marked.parse(processedBody);
    } catch (err) {
      log.error('[renderPost] Markdown parse error', err.message);
      bodyHTML = `<pre>${escapeHTML(processedBody)}</pre>`;
    }
  }

  // 5. 解析作者
  const { authors } = await resolveAuthors(
    frontmatter.authors || [],
    frontmatter.author_notes || null,
    env.AUTHORS,
    contentDir
  );
  const authorsHTML = renderAuthorsHTML(authors);

  // 6. 元数据
  const dateDisplay = formatDate(frontmatter.date);
  const readingTime = calcReadingTime(body);

  // 7. 链接按钮 (Post 无 Cite.bib)
  const linksHTML = renderLinksHTML(frontmatter, 'post', '');

  // 8. 封面图
  const featuredImage = frontmatter.image?.filename || '';
  const featuredImageUrl = featuredImage
    ? `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${contentDir}${featuredImage}`
    : '';
  const featuredHTML = renderFeaturedImage(featuredImageUrl, frontmatter.image);

  // 9. Tags & Categories
  const tags = frontmatter.tags || [];
  const categories = frontmatter.categories || [];

  // 10. 构建 main 内容 (Post: 字体大小切换 + tags)
  const mainContent = buildPostContent({
    type: 'post',
    title: frontmatter.title,
    dateDisplay,
    authorsHTML,
    readingTime,
    linksHTML,
    featuredHTML,
    bodyHTML,
    tags,
    categories,
    summary: frontmatter.summary || '',
    lastEdited: frontmatter.date,
    hasAuthors: authors.length > 0,
    hasDate: !!frontmatter.date,
    hasReadingTime: frontmatter.reading_time !== false,
  });

  // 11. 构建完整页面
  const canonicalUrl = `${SITE_BASE_URL}/post/${slug}/`;
  const publishedISO = toISODate(frontmatter.date);
  const metaDescription = (frontmatter.summary || frontmatter.title || '').substring(0, 300);
  const now = new Date();
  const currentYear = now.getFullYear().toString();

  const html = renderPageShell({
    content: mainContent,
    canonicalUrl,
    title: frontmatter.title,
    description: metaDescription,
    publishedTime: publishedISO,
    modifiedTime: publishedISO,
    ogImage: featuredImageUrl || '',
    currentYear,
    headAssets: await getHeadAssets(SITE_BASE_URL, log),
  });

  return { html, status: 200, cacheKey: canonicalUrl };
}

/**
 * 渲染 project 页面
 */
export async function renderProject({ slug, folder, env, log }) {
  const {
    GITHUB_OWNER = 'Boooil',
    GITHUB_REPO = 'VISTA-Research-Group',
    GITHUB_BRANCH = 'main',
    SITE_BASE_URL = 'https://vista-research-group.pages.dev',
  } = env;

  const contentDir = `content/project/${folder || slug}/`;

  // 1. 获取 Markdown
  const { mdText, status } = await fetchMarkdown(`${contentDir}index.md`, env);
  if (!mdText) {
    log.warn('[renderProject] Failed to fetch or not found', { slug, status });
    return { html: null, status, cacheKey: null };
  }

  // 2. 解析 frontmatter + body
  const { frontmatter, body } = parseMarkdown(mdText);
  log.debug('[renderProject] Parsed frontmatter', { title: frontmatter.title });

  if (!frontmatter.title) {
    log.warn('[renderProject] No title', { slug });
    return { html: null, status: 500, cacheKey: null };
  }

  // 3. 转换正文内相对图片路径
  const processedBody = convertImagePaths(body, contentDir, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH);

  // 4. Markdown → HTML
  let bodyHTML = '';
  if (processedBody) {
    try {
      bodyHTML = marked.parse(processedBody);
    } catch (err) {
      log.error('[renderProject] Markdown parse error', err.message);
      bodyHTML = `<pre>${escapeHTML(processedBody)}</pre>`;
    }
  }

  // 5. 解析作者
  const { authors } = await resolveAuthors(
    frontmatter.authors || [],
    frontmatter.author_notes || null,
    env.AUTHORS,
    contentDir
  );
  const authorsHTML = renderAuthorsHTML(authors);

  // 6. 元数据
  const dateDisplay = formatDate(frontmatter.date);
  const readingTime = calcReadingTime(body);

  // 7. 链接按钮 (项目的显式链接)
  const linksHTML = renderLinksHTML(frontmatter, 'project', '');

  // 8. 封面图
  const featuredImage = frontmatter.image?.filename || '';
  const featuredImageUrl = featuredImage
    ? `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${contentDir}${featuredImage}`
    : '';
  const featuredHTML = renderFeaturedImage(featuredImageUrl, frontmatter.image);

  // 9. Tags
  const tags = frontmatter.tags || [];

  // 10. 构建 main 内容 (Project: 与 Post 类似，字体大小切换)
  const mainContent = buildPostContent({
    type: 'project',
    title: frontmatter.title,
    dateDisplay,
    authorsHTML,
    readingTime,
    linksHTML,
    featuredHTML,
    bodyHTML,
    tags,
    categories: [],
    summary: frontmatter.summary || '',
    lastEdited: frontmatter.date,
    hasAuthors: authors.length > 0,
    hasDate: !!frontmatter.date,
    hasReadingTime: frontmatter.reading_time !== false,
  });

  // 11. 构建完整页面
  const canonicalUrl = `${SITE_BASE_URL}/project/${slug}/`;
  const publishedISO = toISODate(frontmatter.date);
  const metaDescription = (frontmatter.summary || frontmatter.title || '').substring(0, 300);
  const now = new Date();
  const currentYear = now.getFullYear().toString();

  const html = renderPageShell({
    content: mainContent,
    canonicalUrl,
    title: frontmatter.title,
    description: metaDescription,
    publishedTime: publishedISO,
    modifiedTime: publishedISO,
    ogImage: featuredImageUrl || '',
    currentYear,
    headAssets: await getHeadAssets(SITE_BASE_URL, log),
  });

  return { html, status: 200, cacheKey: canonicalUrl };
}

/**
 * 渲染 author 个人页面
 */
export async function renderAuthor({ slug, folder, env, log }) {
  const {
    GITHUB_OWNER = 'Boooil',
    GITHUB_REPO = 'VISTA-Research-Group',
    GITHUB_BRANCH = 'main',
    SITE_BASE_URL = 'https://vista-research-group.pages.dev',
  } = env;

  const contentDir = `content/authors/${folder || slug}/`;

  // 1. 获取 _index.md (注意: author 使用 _index.md)
  const { mdText, status } = await fetchMarkdown(`${contentDir}_index.md`, env);
  if (!mdText) {
    log.warn('[renderAuthor] Failed to fetch or not found', { slug, status });
    return { html: null, status, cacheKey: null };
  }

  // 2. 解析 frontmatter
  const { frontmatter } = parseMarkdown(mdText);
  log.debug('[renderAuthor] Parsed frontmatter', { title: frontmatter.title });

  if (!frontmatter.title) {
    log.warn('[renderAuthor] No title', { slug });
    return { html: null, status: 500, cacheKey: null };
  }

  // 3. 头像 URL
  const avatarFilename = frontmatter.avatar_filename || '';
  const avatarUrl = avatarFilename
    ? `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${contentDir}${avatarFilename}`
    : '';

  // 4. 构建 Author Profile 内容
  const publications = await getPublicationsByAuthor(frontmatter.pinyin || slug, SITE_BASE_URL, log);

  const mainContent = buildAuthorContent({
    title: frontmatter.title,
    pinyin: frontmatter.pinyin || slug,
    role: frontmatter.role || '',
    bio: frontmatter.bio || '',
    interests: frontmatter.interests || [],
    social: frontmatter.social || [],
    organizations: frontmatter.organizations || [],
    email: frontmatter.email || '',
    avatarUrl,
    education: frontmatter.education || '',
    publications,
  });

  // 5. 构建完整页面
  const canonicalUrl = `${SITE_BASE_URL}/author/${slug}/`;
  const metaDescription = (frontmatter.bio || frontmatter.title || '').substring(0, 300);
  const now = new Date();
  const currentYear = now.getFullYear().toString();

  const html = renderAuthorShell({
    content: mainContent,
    canonicalUrl,
    title: frontmatter.title,
    description: metaDescription,
    publishedTime: '',
    modifiedTime: '',
    ogImage: avatarUrl || '',
    currentYear,
    headAssets: await getHeadAssets(SITE_BASE_URL, log),
  });

  return { html, status: 200, cacheKey: canonicalUrl };
}

// ============================================================================
// 内容区域构建函数
// ============================================================================

const CHEVRON_SVG = `<svg class="inline-block mx-1 h-3 w-3 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd"/></svg>`;

const SECTION_LABELS = {
  publication: '论文著作',
  post:        '博客',
  project:     '项目',
  author:      '作者',
};

function buildBreadcrumb(type, title) {
  const sectionLabel = SECTION_LABELS[type] || type;
  const sectionUrl = `/${type}/`;
  return `<nav class="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-4 flex-wrap" aria-label="breadcrumb">`
    + `<a href="/" class="hover:text-primary-600 dark:hover:text-primary-400 whitespace-nowrap">Home</a>`
    + CHEVRON_SVG
    + `<a href="${sectionUrl}" class="hover:text-primary-600 dark:hover:text-primary-400 whitespace-nowrap">${escapeHTML(sectionLabel)}</a>`
    + CHEVRON_SVG
    + `<span class="font-medium text-gray-700 dark:text-gray-200 truncate">${escapeHTML(title)}</span>`
    + `</nav>`;
}

/**
 * 构建 Post / Project 的 <main> 内容 (字体大小切换)
 */
function buildPostContent({
  type,
  title,
  dateDisplay,
  authorsHTML,
  readingTime,
  linksHTML,
  featuredHTML,
  bodyHTML,
  tags,
  categories,
  summary,
  lastEdited,
  hasAuthors,
  hasDate,
  hasReadingTime,
}) {
  let html = '';

  // 面包屑
  html += buildBreadcrumb(type || 'post', title);

  // 标题
  html += `<h1 class="mt-2 text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">${escapeHTML(title)}</h1>`;

  // 摘要
  if (summary) {
    html += `<p class="mt-3 text-lg text-gray-600 dark:text-gray-400">${escapeHTML(summary)}</p>`;
  }

  // 元数据行 (日期 + 作者 + 阅读时间)
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

  // 链接按钮
  if (linksHTML) {
    html += `<div class="mt-3">${linksHTML}</div>`;
  }

  html += `</div>`;

  // 封面图
  html += featuredHTML;

  // 字体大小切换 + 正文
  html += `<div
        x-data="{
          fontSize: 'standard',
          init() {
            const saved = localStorage.getItem('post-font-size');
            if (saved === 'small' || saved === 'large') {
              this.fontSize = saved;
            }
          },
          setSize(size) {
            this.fontSize = size;
            localStorage.setItem('post-font-size', size);
          }
        }">
        <div class="flex items-center gap-2 justify-end mb-4">
          <span class="text-xs text-gray-400 dark:text-gray-500 mr-1 hidden sm:inline">字号</span>
          <button
            @click="setSize('small')"
            :class="fontSize === 'small'
              ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300 ring-1 ring-primary-300'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'"
            class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer"
            title="小号字体"
          >小</button>
          <button
            @click="setSize('standard')"
            :class="fontSize === 'standard'
              ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300 ring-1 ring-primary-300'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'"
            class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer"
            title="标准字体"
          >标准</button>
          <button
            @click="setSize('large')"
            :class="fontSize === 'large'
              ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300 ring-1 ring-primary-300'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'"
            class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer"
            title="大号字体"
          >大</button>
        </div>

        <div class="prose prose-slate lg:prose-xl dark:prose-invert" :style="fontSize === 'small' ? 'font-size: 0.875rem' : fontSize === 'large' ? 'font-size: 1.5rem' : ''">
          ${bodyHTML}
        </div>
      </div>`;

  // Tags & Categories (页脚区域)
  if (tags.length > 0 || categories.length > 0) {
    html += `<div class="container mx-auto prose prose-slate lg:prose-xl dark:prose-invert mt-5"><div class="max-w-prose print:hidden">`;

    if (tags.length > 0) {
      html += `<div class="flex flex-wrap gap-2 mt-4">`;
      for (const tag of tags) {
        html += `<a href="/tags/${tag}/" class="inline-block bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs px-2.5 py-1 rounded-full hover:bg-primary-100 hover:text-primary-700 dark:hover:bg-primary-900 dark:hover:text-primary-300 transition-colors">${escapeHTML(tag)}</a>`;
      }
      html += `</div>`;
    }

    if (categories.length > 0) {
      html += `<div class="flex flex-wrap gap-2 mt-2">`;
      for (const cat of categories) {
        html += `<a href="/categories/${cat}/" class="inline-block bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-xs px-2.5 py-1 rounded-full hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors">${escapeHTML(cat)}</a>`;
      }
      html += `</div>`;
    }

    html += `</div></div>`;
  }

  // 最后编辑时间
  if (lastEdited) {
    html += `<time class="mt-12 mb-8 block text-xs text-gray-500 ltr:text-right rtl:text-left dark:text-gray-400" datetime="${toISODate(lastEdited)}"><span>Last updated on</span> ${formatDate(lastEdited)}</time>`;
  }

  // 页脚 (分享 + 前后导航)
  html += buildPageFooterHTML();

  return html;
}

/**
 * 构建 Publication 的 <main> 内容 (宽度切换 + pub metadata)
 */
function buildPublicationContent({
  title,
  dateDisplay,
  authorsHTML,
  readingTime,
  linksHTML,
  featuredHTML,
  bodyHTML,
  abstract,
  pubTypeLabel,
  pubType,
  publicationVenue,
  event,
  event_url,
  location,
  lastEdited,
  hasAuthors,
  hasDate,
  hasReadingTime,
}) {
  let html = '';

  // 面包屑
  html += buildBreadcrumb('publication', title);

  // 标题
  html += `<h1 class="mt-2 text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">${escapeHTML(title)}</h1>`;

  // 元数据行
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

  // 封面图
  html += featuredHTML;

  // 宽度切换 + metadata + 正文
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

  // Abstract + Publication metadata
  html += `<div class="flex flex-col gap-3 my-6">`;

  if (abstract) {
    let abstractHTML = '';
    try { abstractHTML = marked.parse(abstract); } catch (_) { abstractHTML = escapeHTML(abstract); }
    html += `<div class="font-bold text-2xl">Abstract</div>`;
    html += `<div class="prose prose-slate dark:prose-invert max-w-none">${abstractHTML}</div>`;
  }

  if (pubTypeLabel) {
    const pubTypeUrl = pubType ? `/publication_types/${pubType}/` : '#';
    html += `<div class="font-bold text-2xl">Type</div>`;
    html += `<div><a href="${pubTypeUrl}">${escapeHTML(pubTypeLabel)}</a></div>`;
  }

  if (publicationVenue) {
    let venueHTML = '';
    try { venueHTML = marked.parse(publicationVenue); } catch (_) { venueHTML = escapeHTML(publicationVenue); }
    html += `<div class="font-bold text-2xl">Publication</div>`;
    html += `<div class="prose prose-slate dark:prose-invert max-w-none">${venueHTML}</div>`;
  }

  if (event) {
    html += `<div class="font-bold text-2xl">Conference</div>`;
    if (event_url) {
      html += `<div><a href="${escapeHTML(event_url)}" target="_blank" rel="noopener">${escapeHTML(event)}</a></div>`;
    } else {
      html += `<div>${escapeHTML(event)}</div>`;
    }
  }

  if (location) {
    html += `<div class="font-bold text-2xl">Location</div>`;
    html += `<div>${escapeHTML(location)}</div>`;
  }

  html += `</div>`;

  // 正文
  if (bodyHTML) {
    html += `<div class="prose prose-slate lg:prose-xl dark:prose-invert max-w-none">${bodyHTML}</div>`;
  }

  html += `</div>`; // close width toggle div

  // 最后编辑时间
  if (lastEdited) {
    html += `<time class="mt-12 mb-8 block text-xs text-gray-500 ltr:text-right rtl:text-left dark:text-gray-400" datetime="${toISODate(lastEdited)}"><span>Last updated on</span> ${formatDate(lastEdited)}</time>`;
  }

  // 页脚
  html += buildPageFooterHTML();

  return html;
}

/**
 * 构建 Author 个人页面内容
 */
function buildAuthorContent({
  title,
  pinyin,
  role,
  bio,
  interests,
  social,
  organizations,
  email,
  avatarUrl,
  education,
  publications,
}) {
  let html = '';

  html += `<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">`;

  // 头像 + 信息行
  html += `<div class="flex flex-col sm:flex-row items-center sm:items-start gap-8 mb-12 mt-6">`;

  // 头像
  html += `<div class="flex-shrink-0">`;
  if (avatarUrl) {
    html += `<img src="${escapeHTML(avatarUrl)}" alt="${escapeHTML(title)}" width="256" height="256" class="w-48 h-48 rounded-2xl object-cover shadow-lg ring-1 ring-zinc-900/5 dark:ring-white/10">`;
  } else {
    const initial = title ? title.charAt(0) : '?';
    html += `<div class="w-48 h-48 rounded-2xl bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 flex items-center justify-center shadow-lg"><span class="text-5xl font-bold text-blue-600 dark:text-blue-300">${escapeHTML(initial)}</span></div>`;
  }
  html += `</div>`;

  // 信息
  html += `<div class="flex-1 text-center sm:text-left">`;
  html += `<h1 class="text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-2">${escapeHTML(title)}</h1>`;

  if (role) {
    html += `<p class="text-xl text-primary-600 dark:text-primary-400 font-medium mb-2">${escapeHTML(role)}</p>`;
  }

  // Organization + Email
  if (organizations.length > 0 || email) {
    html += `<p class="text-gray-500 dark:text-gray-400 mb-3">`;
    if (organizations.length > 0) {
      const org = organizations[0];
      const isObj = typeof org === 'object' && org !== null;
      const orgName = isObj ? (org.name || '') : String(org).replace(/^name:\s*/, '');
      html += `<span class="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">${escapeHTML(orgName)}</span>`;
    }
    if (organizations.length > 0 && email) {
      html += `<span class="mx-2 text-gray-300 dark:text-gray-600">|</span>`;
    }
    if (email) {
      html += `<span class="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">${escapeHTML(email)}</span>`;
    }
    html += `</p>`;
  }

  // Bio
  if (bio) {
    html += `<p class="text-gray-600 dark:text-gray-400 max-w-2xl leading-relaxed">${escapeHTML(bio)}</p>`;
  }

  // Education
  if (education) {
    html += `<p class="text-gray-600 dark:text-gray-400 max-w-2xl leading-relaxed mt-2"><span class="font-medium">教育背景：</span>${escapeHTML(education)}</p>`;
  }

  // Interests
  if (interests.length > 0) {
    html += `<div class="flex flex-wrap gap-2 mt-4 justify-center sm:justify-start">`;
    for (const interest of interests) {
      html += `<span class="inline-block bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm px-3 py-1 rounded-full">${escapeHTML(interest)}</span>`;
    }
    html += `</div>`;
  }

  // Social Links
  if (social.length > 0) {
    html += `<div class="flex gap-4 mt-4 justify-center sm:justify-start">`;
    for (const s of social) {
      const isObj = typeof s === 'object' && s !== null;
      const link = isObj ? (s.url || s.link || '#') : '#';
      const iconName = isObj ? (s.icon || 'link') : 'link';
      const iconPack = isObj ? (s.icon_pack || 'fas') : 'fas';
      const label = isObj ? (s.label || iconName) : iconName;
      const iconHTML = getFAIcon(iconPack, iconName);
      html += `<a href="${escapeHTML(link)}" target="_blank" rel="noopener" aria-label="${escapeHTML(label)}" title="${escapeHTML(label)}" class="text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-colors text-xl">${iconHTML}</a>`;
    }
    html += `</div>`;
  }

  html += `</div>`; // close info
  html += `</div>`; // close flex

  // 分隔线
  html += `<hr class="border-0 border-t border-gray-300 dark:border-gray-600 mb-10">`;

  // 成果列表
  html += `<h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">成果列表</h2>`;
  if (publications && publications.length > 0) {
    const TYPE_LABELS = { publication: '论文著作', post: '博客', project: '项目' };
    const grouped = {};
    for (const p of publications) {
      if (!grouped[p.type]) grouped[p.type] = [];
      grouped[p.type].push(p);
    }
    for (const type of ['publication', 'post', 'project']) {
      const group = grouped[type];
      if (!group || group.length === 0) continue;
      html += `<h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300 mt-8 mb-4">${escapeHTML(TYPE_LABELS[type] || type)}</h3>`;
      html += `<div class="flex flex-col gap-3">`;
      for (const p of group) {
        const title = p.title || p.slug;
        const date = p.date ? p.date.substring(0, 7) : '';
        const venue = p.venue || '';
        const pubTypeLabel = PUB_TYPE_LABELS[p.pub_type] || '';
        html += `<a href="/${type}/${escapeHTML(p.slug)}/"
          class="group flex items-start justify-between gap-4 rounded-xl bg-white dark:bg-gray-800/60 px-5 py-4 shadow-sm ring-1 ring-zinc-900/5 dark:ring-white/10 hover:shadow-md hover:ring-primary-300 dark:hover:ring-primary-700 transition-all duration-200 no-underline">
          <div class="flex-1 min-w-0">
            ${pubTypeLabel ? `<span class="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 mb-2">${escapeHTML(pubTypeLabel)}</span>` : ''}
            <div class="text-base font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors leading-snug">${escapeHTML(title)}</div>
            ${venue ? `<div class="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">${escapeHTML(venue)}</div>` : ''}
          </div>
          ${date ? `<time class="flex-shrink-0 text-sm text-gray-400 dark:text-gray-500 mt-0.5">${escapeHTML(date)}</time>` : ''}
        </a>`;
      }
      html += `</div>`;
    }
  } else {
    html += `<p class="text-center text-gray-500 dark:text-gray-400 py-12">`
      + `完整成果列表由 Hugo 全量构建生成，当前仅支持详情页即时渲染。<br>`
      + `请访问 <a href="/publication/" class="text-primary-600 hover:underline">Publications</a> 和 <a href="/post/" class="text-primary-600 hover:underline">Posts</a> 列表页。`
      + `</p>`;
  }

  html += `</div>`; // close max-w-7xl

  return html;
}

/**
 * 页脚 HTML (分享按钮 + 分隔线)
 */
function buildPageFooterHTML() {
  return `<div class="container mx-auto prose prose-slate lg:prose-xl dark:prose-invert mt-5"><div class="max-w-prose print:hidden">
<section class="flex flex-row flex-wrap justify-center pt-4 text-xl">
  <a target=_blank rel=noopener class="m-1 rounded-md bg-neutral-300 p-1.5 text-neutral-700 hover:bg-primary-500 hover:text-neutral-300 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-primary-400 dark:hover:text-neutral-800" href="#" title="Share on X"><svg style="height:1em" viewBox="0 0 512 512"><path fill="currentColor" d="M389.2 48h70.6L305.6 224.2 487 464H345L233.7 318.6 106.5 464H35.8L200.7 275.5 26.8 48H172.4L272.9 180.9 389.2 48zM364.4 421.8h39.1L151.1 88h-42L364.4 421.8z"/></svg></a>
</section>
<div class="pt-1 no-prose w-full"><hr class="border-dotted border-neutral-300 dark:border-neutral-600"></div>
</div></div>`;
}

/**
 * 用 Font Awesome 6 <i> 标签渲染社交图标，与 Hugo get_icon partial 对齐
 * icon_pack: fas → fa-solid, fab → fa-brands, far → fa-regular
 */
function getFAIcon(iconPack, iconName) {
  const packMap = {
    fas: 'fa-solid',
    fab: 'fa-brands',
    far: 'fa-regular',
    'fa-solid': 'fa-solid',
    'fa-brands': 'fa-brands',
    'fa-regular': 'fa-regular',
  };
  const faClass = packMap[iconPack] || 'fa-solid';
  return `<i class="${faClass} fa-${escapeHTML(iconName)} fa-xl"></i>`;
}

// ============================================================================
// HTML 转义
// ============================================================================

function escapeHTML(str) {
  if (str == null || str === '') return '';
  if (typeof str !== 'string') str = String(str);
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
