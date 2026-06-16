/**
 * Shell 模板自动提取脚本
 *
 * 从 Hugo 构建输出 (public/) 中提取页面框架，
 * 将内容区域替换为占位符，生成 Shell 模板供 Worker 使用。
 *
 * Phase 3.1: 自动化 Shell 维护
 *
 * 使用方法:
 *   1. 先运行 Hugo 构建: hugo --minify
 *   2. 运行本脚本: node scripts/extract-shells.js
 *   3. 输出: scripts/shells/shell-{type}.html + shell-templates.js
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const PUBLIC_DIR = resolve(ROOT, 'public');
const SHELLS_DIR = resolve(__dirname, 'shells');
const EDGE_SRC_DIR = resolve(ROOT, 'edge-renderer', 'src');

// 确保输出目录存在
if (!existsSync(SHELLS_DIR)) {
  mkdirSync(SHELLS_DIR, { recursive: true });
}

// ============================================================================
// 配置: 每种页面类型的参考页面
// ============================================================================

const SHELL_CONFIGS = [
  {
    type: 'publication',
    layout: 'standard',
    // 找一个有代表性的 publication 页面
    sourcePaths: [
      'publication/DDE-Net/index.html',
      'publication/TRVP/index.html',
      'publication/UrbanMUDA/index.html',
      'publication/BehaviorGenerationforHeterogeneousAgentsinUrbanSimulationDeduction/index.html',
    ],
  },
  {
    type: 'post',
    layout: 'standard',
    sourcePaths: [
      'post/2026-06-14-vista/index.html',
      'post/2026-06-10-3D-BLU-Benchmark/index.html',
      'post/2026-06-10-cms/index.html',
    ],
  },
  {
    type: 'project',
    layout: 'standard',
    // Project 可能没有独立页面，fallback 到 post 结构
    sourcePaths: [
      'project/index.html',  // 列表页，非详情页
    ],
    fallbackType: 'post',  // 无独立页面时复用 post 的 shell
  },
  {
    type: 'author',
    layout: 'author',
    sourcePaths: [
      'author/WangBoyu/index.html',
      'author/MengQingxin/index.html',
    ],
  },
];

// ============================================================================
// 主流程
// ============================================================================

console.log('=== VISTA Shell Extractor ===\n');

const results = {};

for (const config of SHELL_CONFIGS) {
  console.log(`--- Processing: ${config.type} (layout: ${config.layout}) ---`);

  const sourcePath = findExistingPath(config.sourcePaths);
  if (!sourcePath) {
    if (config.fallbackType) {
      console.log(`  No source page found, will reuse "${config.fallbackType}" shell`);
      results[config.type] = { fallback: config.fallbackType };
      continue;
    }
    console.error(`  ERROR: No source page found for ${config.type}, skipping`);
    continue;
  }

  console.log(`  Source: ${sourcePath}`);
  const html = readFileSync(sourcePath, 'utf-8');

  let shell;
  if (config.layout === 'standard') {
    shell = extractStandardShell(html, config.type);
  } else if (config.layout === 'author') {
    shell = extractAuthorShell(html);
  }

  if (shell) {
    // 写入 .html 文件 (用于 KV 上传)
    const htmlPath = resolve(SHELLS_DIR, `shell-${config.type}.html`);
    writeFileSync(htmlPath, shell, 'utf-8');
    console.log(`  Output: ${htmlPath} (${Buffer.byteLength(shell, 'utf-8')} bytes)`);
    results[config.type] = { path: htmlPath, layout: config.layout };
  }
}

// 处理 fallback (project 复用 post shell)
if (results.project?.fallback === 'post' && results.post?.path) {
  const postShell = readFileSync(results.post.path, 'utf-8');
  const projectShellPath = resolve(SHELLS_DIR, 'shell-project.html');
  writeFileSync(projectShellPath, postShell, 'utf-8');
  console.log(`  Project shell: copied from post shell`);
  results.project = { path: projectShellPath, layout: 'standard', fallbackFrom: 'post' };
}

// ============================================================================
// 生成 shell-templates.js (供 edge-renderer 使用)
// ============================================================================

console.log('\n--- Generating shell-templates.js ---');

const templatesModule = generateTemplatesModule(results);
const templatesPath = resolve(SHELLS_DIR, 'shell-templates.js');
writeFileSync(templatesPath, templatesModule, 'utf-8');
console.log(`  Output: ${templatesPath}`);

console.log('\n=== Done ===');
console.log('\nNext steps:');
console.log('  1. Review generated shells in scripts/shells/');
console.log('  2. Upload shells to KV:');
console.log('     npx wrangler kv:key put --binding=SHELLS "shell:publication" --path=scripts/shells/shell-publication.html');
console.log('     npx wrangler kv:key put --binding=SHELLS "shell:post" --path=scripts/shells/shell-post.html');
console.log('     npx wrangler kv:key put --binding=SHELLS "shell:project" --path=scripts/shells/shell-project.html');
console.log('     npx wrangler kv:key put --binding=SHELLS "shell:author" --path=scripts/shells/shell-author.html');
console.log('  3. Or run the GitHub Action to automate step 2');

// ============================================================================
// Shell 提取函数
// ============================================================================

/**
 * 提取标准布局 Shell (post / publication / project)
 *
 * 结构: <head>...<body><nav/><div class="page-body"><sidebar/><article><main>__CONTENT__</main></article></div><footer/></body>
 */
function extractStandardShell(html, type) {
  let shell = html;

  // 1. 替换 meta description
  shell = shell.replace(
    /<meta name=description content="[^"]*">/,
    '<meta name=description content="__META_DESC__">'
  );

  // 2. 替换 canonical URL
  // Hugo 输出的 canonical 格式: <link rel=canonical href="https://vista-research-group.pages.dev/...">
  shell = shell.replace(
    /<link rel=canonical href="[^"]*">/,
    '<link rel=canonical href=__CANONICAL_URL__>'
  );
  // 也处理 hreflang alternate
  shell = shell.replace(
    /<link rel=alternate hreflang=en href="[^"]*">/,
    '<link rel=alternate hreflang=en href=__CANONICAL_URL__>'
  );

  // 3. 替换 OG / Twitter meta
  shell = shell.replace(
    /<meta property="og:url" content="[^"]*">/,
    '<meta property="og:url" content="__CANONICAL_URL__">'
  );
  shell = shell.replace(
    /<meta property="og:title" content="[^"]*">/,
    '<meta property="og:title" content="__OG_TITLE__">'
  );
  shell = shell.replace(
    /<meta property="og:description" content="[^"]*">/,
    '<meta property="og:description" content="__OG_DESC__">'
  );
  shell = shell.replace(
    /<meta property="og:image" content="[^"]*">/g,
    '__OG_IMAGE_TAGS__'
  );
  shell = shell.replace(
    /<meta property="twitter:image" content="[^"]*">/g,
    ''
  );
  // 移除多余的 twitter:image 替换残留
  shell = shell.replace(/__OG_IMAGE_TAGS__\s*__OG_IMAGE_TAGS__/g, '__OG_IMAGE_TAGS__');

  // 处理 og:type
  shell = shell.replace(
    /<meta property="og:type" content="[^"]*">/,
    '__OG_TYPE_TAG__'
  );

  // 4. 替换 article:published_time / modified_time
  shell = shell.replace(
    /<meta property="article:published_time" content="[^"]*">/,
    '__PUBLISHED_TIME_TAG__'
  );
  shell = shell.replace(
    /<meta property="article:modified_time" content="[^"]*">/,
    '__MODIFIED_TIME_TAG__'
  );

  // 5. 替换 <title>
  shell = shell.replace(
    /<title>[^<]*<\/title>/,
    '<title>__PAGE_TITLE__</title>'
  );

  // 6. 替换主内容区域 — 这是最关键的步骤
  // HugoBlox 的输出结构:
  //   <main class="w-full min-w-0 max-w-6xl px-6 pt-4 md:px-12">
  //     ... 完整的页面内容 ...
  //   </main>
  //
  // 我们需要将 <main> 标签内的内容替换为 __CONTENT__
  // 注意 Hugo minified 输出没有换行

  // 使用 main 标签作为锚点
  const mainOpenRegex = /(<main class="w-full min-w-0 max-w-6xl[^"]*"[^>]*>)/;
  const mainOpenMatch = shell.match(mainOpenRegex);

  if (mainOpenMatch) {
    const mainOpenTag = mainOpenMatch[1];
    const mainStartIdx = mainOpenMatch.index + mainOpenTag.length;

    // 找到对应的 </main> (minify 后是 </main>)
    const mainCloseIdx = shell.indexOf('</main>', mainStartIdx);
    if (mainCloseIdx !== -1) {
      // 替换 <main>...</main> 之间的内容
      const before = shell.substring(0, mainStartIdx);
      const after = shell.substring(mainCloseIdx);
      shell = before + '\n__CONTENT__\n' + after;
    } else {
      console.warn('  WARNING: Could not find </main> closing tag');
    }
  } else {
    console.warn('  WARNING: Could not find <main> opening tag');
  }

  // 7. 替换搜索模态框 (Pagefind 搜索)
  // 搜索模态框是 Alpine.js 组件，包含在 shell 中
  // Hugo 构建后这部分是完整的，我们保留它

  // 8. 替换 copyright 年份
  shell = shell.replace(
    /© \d{4} VISTA Research Group/,
    '© __CURRENT_YEAR__ VISTA Research Group'
  );

  // 9. 清理: 移除可能残留的重复占位符
  shell = shell.replace(/__OG_IMAGE_TAGS__\s+/g, '__OG_IMAGE_TAGS__');

  return shell;
}

/**
 * 提取 Author 布局 Shell
 *
 * Author 页面没有 sidebar+article 包装，page-body 直接包含 profile 内容
 */
function extractAuthorShell(html) {
  let shell = html;

  // 复用相同的 meta 替换逻辑
  shell = shell.replace(
    /<meta name=description content="[^"]*">/,
    '<meta name=description content="__META_DESC__">'
  );
  shell = shell.replace(
    /<link rel=canonical href="[^"]*">/,
    '<link rel=canonical href=__CANONICAL_URL__>'
  );
  shell = shell.replace(
    /<link rel=alternate hreflang=en href="[^"]*">/,
    '<link rel=alternate hreflang=en href=__CANONICAL_URL__>'
  );
  shell = shell.replace(
    /<meta property="og:url" content="[^"]*">/,
    '<meta property="og:url" content="__CANONICAL_URL__">'
  );
  shell = shell.replace(
    /<meta property="og:title" content="[^"]*">/,
    '<meta property="og:title" content="__OG_TITLE__">'
  );
  shell = shell.replace(
    /<meta property="og:description" content="[^"]*">/,
    '<meta property="og:description" content="__OG_DESC__">'
  );
  shell = shell.replace(
    /<meta property="og:image" content="[^"]*">/g,
    '__OG_IMAGE_TAGS__'
  );
  shell = shell.replace(
    /<meta property="twitter:image" content="[^"]*">/g,
    ''
  );
  shell = shell.replace(/__OG_IMAGE_TAGS__\s*__OG_IMAGE_TAGS__/g, '__OG_IMAGE_TAGS__');
  shell = shell.replace(
    /<meta property="og:type" content="[^"]*">/,
    '__OG_TYPE_TAG__'
  );
  shell = shell.replace(
    /<meta property="article:published_time" content="[^"]*">/,
    '__PUBLISHED_TIME_TAG__'
  );
  shell = shell.replace(
    /<meta property="article:modified_time" content="[^"]*">/,
    '__MODIFIED_TIME_TAG__'
  );
  shell = shell.replace(
    /<title>[^<]*<\/title>/,
    '<title>__PAGE_TITLE__</title>'
  );

  // Author 特定: 替换 page-body 内的内容
  // 找到 <div class="page-body my-10"> 之后的内容
  // 在 page-body 和 page-footer 之间的所有内容替换为 __CONTENT__
  const pageBodyRegex = /(<div class="page-body my-10">)/;
  const pageBodyMatch = shell.match(pageBodyRegex);

  if (pageBodyMatch) {
    const bodyStartIdx = pageBodyMatch.index + pageBodyMatch[1].length;

    // 找到 page-footer 的开始
    const footerIdx = shell.indexOf('<div class=page-footer>', bodyStartIdx);
    if (footerIdx !== -1) {
      const before = shell.substring(0, bodyStartIdx);
      const after = shell.substring(footerIdx);
      shell = before + '\n__CONTENT__\n' + after;
    } else {
      console.warn('  WARNING: Could not find page-footer for author shell');
    }
  } else {
    console.warn('  WARNING: Could not find page-body for author shell');
  }

  // 替换 copyright
  shell = shell.replace(
    /© \d{4} VISTA Research Group/,
    '© __CURRENT_YEAR__ VISTA Research Group'
  );

  return shell;
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 从候选路径列表中找到第一个存在的文件
 */
function findExistingPath(candidates) {
  for (const relPath of candidates) {
    const fullPath = resolve(PUBLIC_DIR, relPath);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

/**
 * 生成 shell-templates.js 模块文件
 * 此文件可被 edge-renderer/src/shell.js 直接导入
 */
function generateTemplatesModule(results) {
  const templates = {};

  for (const config of SHELL_CONFIGS) {
    const { type } = config;
    const result = results[type];
    if (result?.path && existsSync(result.path)) {
      templates[type] = readFileSync(result.path, 'utf-8');
    }
  }

  let output = `/**
 * Auto-generated shell templates (Phase 3.1)
 * Generated by: scripts/extract-shells.js
 * Generated at: ${new Date().toISOString()}
 *
 * DO NOT EDIT MANUALLY — re-run extract-shells.js after Hugo build to update.
 */
\n`;

  for (const [type, html] of Object.entries(templates)) {
    // 将 HTML 存储为模板字面量 (用 String.raw 避免转义问题)
    const escaped = html
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\$/g, '\\$');
    output += `export const SHELL_${type.toUpperCase()} = \`${escaped}\`;\n\n`;
  }

  output += `/**
 * 按类型获取 shell 模板
 * @param {string} type - 'post' | 'publication' | 'project' | 'author'
 * @returns {string|null}
 */
export function getShellTemplate(type) {
  const templates = {
    publication: SHELL_PUBLICATION,
    post: SHELL_POST,
    project: SHELL_PROJECT,
    author: SHELL_AUTHOR,
  };
  return templates[type] || null;
}
`;

  return output;
}
