#!/usr/bin/env node
/**
 * cleanup-author-avatars.js
 *
 * 扫描 content/authors/ 下各作者文件夹，删除 avatar_filename 未引用的图片文件。
 * CMS 的 image widget 清空字段时只更新 frontmatter，不删除已上传的图片文件，
 * 本脚本在 sync-kv Action 中运行，补齐这一步。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const AUTHORS_DIR = path.join(__dirname, '..', 'content', 'authors');
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg']);

function getAvatarFilename(mdPath) {
  try {
    const text = fs.readFileSync(mdPath, 'utf8');
    const match = text.match(/^avatar_filename:\s*["']?([^"'\n\r]*)["']?/m);
    if (!match) return '';
    return match[1].trim();
  } catch {
    return '';
  }
}

let deletedCount = 0;

for (const authorDir of fs.readdirSync(AUTHORS_DIR)) {
  const authorPath = path.join(AUTHORS_DIR, authorDir);
  try {
    if (!fs.statSync(authorPath).isDirectory()) continue;
  } catch {
    continue;
  }

  const mdFile = ['_index.md', 'index.md'].find(f => {
    try { fs.statSync(path.join(authorPath, f)); return true; } catch { return false; }
  });
  if (!mdFile) continue;

  const avatarFilename = getAvatarFilename(path.join(authorPath, mdFile));

  for (const file of fs.readdirSync(authorPath)) {
    if (!IMAGE_EXTS.has(path.extname(file).toLowerCase())) continue;
    if (file === avatarFilename) continue;

    const filePath = path.join(authorPath, file);
    console.log(`DELETE orphaned avatar: ${authorDir}/${file} (avatar_filename="${avatarFilename}")`);
    fs.rmSync(filePath, { force: true });
    deletedCount++;
  }
}

if (deletedCount === 0) {
  console.log('No orphaned avatar files found.');
} else {
  console.log(`Deleted ${deletedCount} orphaned avatar file(s).`);
}
