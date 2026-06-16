/**
 * 种子脚本: 将现有团队成员信息写入 AUTHORS KV
 *
 * 使用方法:
 *   node scripts/seed-authors.js          # 生成 bulk JSON 文件
 *   npx wrangler kv:bulk put --binding=AUTHORS scripts/authors-kv-bulk.json
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 8 位现有团队成员的 author 数据
const AUTHORS = {
  WangBoyu: {
    title: '王博宇', pinyin: 'WangBoyu', role: '在读博士', avatar: 'avatar.jpg', bio: '',
    interests: ['Single-view 3D reconstruction', 'Local Updating of 3D Scenes', 'Object Recognition and Semantic Analysis'],
    social: [
      { icon: 'envelope', icon_pack: 'fas', link: 'mailto:boil99@foxmail.com' },
      { icon: 'github', icon_pack: 'fab', link: 'https://github.com/Boooil' },
    ],
    organizations: [{ name: 'VISTA Research Group', url: '' }],
    email: 'boil99@foxmail.com', user_groups: ['在读博士'],
  },
  MengQingxin: {
    title: '孟庆昕', pinyin: 'MengQingxin', role: '在读硕士', avatar: 'avatar.jpg', bio: '',
    interests: ['LLM Agent', 'LLM for Decision-Making', 'Environment Awareness for LLM'],
    social: [
      { icon: 'envelope', icon_pack: 'fas', link: 'mailto:meng_qx2018@163.com' },
      { icon: 'github', icon_pack: 'fab', link: 'https://github.com/Mencius2023' },
    ],
    organizations: [{ name: 'VISTA Research Group', url: '' }],
    email: 'meng_qx2018@163.com', user_groups: ['在读硕士'],
  },
  PengBotao: {
    title: '彭伯韬', pinyin: 'PengBotao', role: '在读硕士', avatar: 'avatar.jpg', bio: 'coder',
    interests: ['agent engineering'],
    social: [
      { icon: 'envelope', icon_pack: 'fas', link: 'mailto:gatroo@qq.com' },
      { icon: 'github', icon_pack: 'fab', link: 'https://github.com/gatro-adu' },
    ],
    organizations: [{ name: 'VISTA Research Group', url: '' }],
    email: 'gatroo@qq.com', user_groups: ['在读硕士'],
  },
  ChenXujian: {
    title: '陈旭涧', pinyin: 'ChenXujian', role: '研究员', avatar: '', bio: '',
    interests: [], social: [],
    organizations: [{ name: '智能体系设计与验证实验室' }],
    email: '', user_groups: ['研究员'],
  },
  ShiYanyan: {
    title: '史燕燕', pinyin: 'ShiYanyan', role: '研究员', avatar: 'avatar.jpg', bio: '高级工程师',
    interests: [], social: [],
    organizations: [{ name: '智能体系设计与验证实验室', url: '' }],
    email: '', user_groups: ['研究员'],
  },
  GaoShengxuan: {
    title: '高晟轩', pinyin: 'GaoShengxuan', role: '在读硕士', avatar: 'avatar.jpg', bio: '',
    interests: [],
    social: [
      { icon: 'envelope', icon_pack: 'fas', link: '#' },
      { icon: 'github', icon_pack: 'fab', link: '#' },
    ],
    organizations: [{ name: 'VISTA Research Group', url: '' }],
    email: '', user_groups: ['在读硕士'],
  },
  ZhangShuo: {
    title: '张硕', pinyin: 'ZhangShuo', role: '研究员', avatar: '', bio: '',
    interests: [], social: [],
    organizations: [{ name: 'VISTA Research Group' }],
    email: '', user_groups: ['研究员'],
  },
  LinTao: {
    title: '林涛', pinyin: 'LinTao', role: '在读博士', avatar: '', bio: '',
    interests: ['Kill Chain & Kill Web', 'Intelligent Systems Architecture'],
    social: [], organizations: [{ name: '智能体系设计与验证实验室' }],
    email: '', user_groups: ['在读博士'],
  },
};

// 生成 wrangler kv:bulk put 所需的 JSON 格式
const bulkData = Object.entries(AUTHORS).map(([key, value]) => ({
  key: `author:${key}`,
  value: JSON.stringify(value),
}));

const outputPath = __dirname + '/authors-kv-bulk.json';
writeFileSync(outputPath, JSON.stringify(bulkData, null, 2));

console.log(`Generated ${bulkData.length} author entries to ${outputPath}`);
console.log('');
console.log('Run this command to upload to Cloudflare KV:');
console.log('  npx wrangler@4 kv bulk put --binding=AUTHORS scripts/authors-kv-bulk.json');
