#!/usr/bin/env node
/**
 * seed-authors.js — 从 content/authors/ 动态生成 AUTHORS KV bulk JSON
 *
 * 读取每个作者文件夹的 _index.md，解析 frontmatter，
 * 生成 wrangler kv bulk put 所需的 JSON 格式。
 *
 * 用法:
 *   node scripts/seed-authors.js
 *   npx wrangler@4 kv bulk put --binding=AUTHORS scripts/authors-kv-bulk.json
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const AUTHORS_DIR = join(__dirname, '..', '..', 'content', 'authors');
const OUTPUT_PATH = join(__dirname, 'authors-kv-bulk.json');

// ============================================================================
// 轻量 YAML frontmatter 解析（只需处理作者 _index.md 的字段）
// ============================================================================

function parseFrontmatter(mdText) {
  const match = mdText.match(/^---\r?\n([\s\S]*?)\n---/);
  if (!match) return {};
  return parseYAML(match[1]);
}

function parseYAML(text) {
  const result = {};
  const lines = text.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) { i++; continue; }

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1 || !line.match(/^\w/)) { i++; continue; }

    const key = line.substring(0, colonIdx).trim();
    const afterColon = line.substring(colonIdx + 1).trim();

    if (afterColon === '' || afterColon === '[]') {
      // 尝试解析数组或对象
      const arr = tryParseArray(lines, i + 1);
      if (arr) {
        result[key] = arr.items;
        i = arr.nextIdx;
        continue;
      }
      result[key] = afterColon === '[]' ? [] : '';
    } else {
      result[key] = parseScalar(afterColon.replace(/^["'](.*)["']$/, '$1'));
    }
    i++;
  }
  return result;
}

function tryParseArray(lines, startIdx) {
  const items = [];
  let i = startIdx;
  let baseIndent = null;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const currentIndent = (line.match(/^(\s*)/) || ['', ''])[1];
    if (baseIndent === null) {
      if (!line.trim().startsWith('- ')) return null;
      baseIndent = currentIndent;
    }
    if (currentIndent.length < baseIndent.length) break;
    if (currentIndent !== baseIndent || !line.trim().startsWith('- ')) break;

    const itemRaw = line.trim().substring(2).trim();
    if (itemRaw.includes(':')) {
      // 对象 item
      const obj = {};
      const colonIdx = itemRaw.indexOf(':');
      const fk = itemRaw.substring(0, colonIdx).trim();
      const fv = itemRaw.substring(colonIdx + 1).trim().replace(/^["'](.*)["']$/, '$1');
      if (fk) obj[fk] = parseScalar(fv);
      i++;
      while (i < lines.length) {
        const sub = lines[i];
        if (!sub.trim()) { i++; continue; }
        const subIndent = (sub.match(/^(\s*)/) || ['', ''])[1];
        if (subIndent.length <= baseIndent.length) break;
        if (sub.trim().startsWith('- ')) break;
        const sc = sub.indexOf(':');
        if (sc === -1) { i++; continue; }
        const sk = sub.substring(0, sc).trim();
        const sv = sub.substring(sc + 1).trim().replace(/^["'](.*)["']$/, '$1');
        if (sk) obj[sk] = parseScalar(sv);
        i++;
      }
      items.push(obj);
    } else {
      items.push(itemRaw.replace(/^["'](.*)["']$/, '$1'));
      i++;
    }
  }

  if (items.length === 0) return null;
  return { items, nextIdx: i };
}

function parseScalar(val) {
  if (val === 'true') return true;
  if (val === 'false') return false;
  if (/^-?\d+$/.test(val)) return parseInt(val, 10);
  if (/^-?\d+\.\d+$/.test(val)) return parseFloat(val);
  return val;
}

// ============================================================================
// 主逻辑：扫描 content/authors/ 生成 KV entries
// ============================================================================

const bulkData = [];

for (const authorDir of readdirSync(AUTHORS_DIR).sort()) {
  const authorPath = join(AUTHORS_DIR, authorDir);
  if (!statSync(authorPath).isDirectory()) continue;

  const mdPath = join(authorPath, '_index.md');
  let mdText = '';
  try {
    mdText = readFileSync(mdPath, 'utf8');
  } catch {
    console.warn(`SKIP ${authorDir}: no _index.md`);
    continue;
  }

  const fm = parseFrontmatter(mdText);
  if (!fm.pinyin) {
    console.warn(`SKIP ${authorDir}: no pinyin field`);
    continue;
  }

  const entry = {
    title:        fm.title        || fm.pinyin,
    pinyin:       fm.pinyin,
    role:         fm.role         || '',
    avatar:       fm.avatar_filename || '',
    bio:          fm.bio          || '',
    interests:    Array.isArray(fm.interests) ? fm.interests : [],
    social:       Array.isArray(fm.social)    ? fm.social    : [],
    organizations: Array.isArray(fm.organizations) ? fm.organizations : [],
    email:        fm.email        || '',
    user_groups:  Array.isArray(fm.user_groups) ? fm.user_groups : [],
  };

  bulkData.push({
    key:   `author:${fm.pinyin}`,
    value: JSON.stringify(entry),
  });

  console.log(`  ${fm.pinyin}: avatar="${entry.avatar}" social=${entry.social.length}`);
}

writeFileSync(OUTPUT_PATH, JSON.stringify(bulkData, null, 2));
console.log(`\nGenerated ${bulkData.length} author entries → ${OUTPUT_PATH}`);
