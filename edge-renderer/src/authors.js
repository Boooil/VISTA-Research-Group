/**
 * 作者名解析模块
 *
 * 将 frontmatter 中的 pinyin 标识映射为中文显示名
 * 使用 KV 存储作者数据，支持团队内部成员识别和外部作者直显
 */

// 团队作者的初始数据 (Phase 1 硬编码，后续自动同步到 KV)
const DEFAULT_AUTHORS = {
  WangBoyu: { title: '王博宇', pinyin: 'WangBoyu', role: '在读博士', avatar: 'avatar.jpg' },
  MengQingxin: { title: '孟庆昕', pinyin: 'MengQingxin', role: '在读硕士', avatar: 'avatar.jpg' },
  PengBotao: { title: '彭伯韬', pinyin: 'PengBotao', role: '在读硕士', avatar: 'avatar.jpg' },
  ChenXujian: { title: '陈旭涧', pinyin: 'ChenXujian', role: '研究员', avatar: '' },
  ShiYanyan: { title: '史燕燕', pinyin: 'ShiYanyan', role: '研究员', avatar: 'avatar.jpg' },
  GaoShengxuan: { title: '高晟轩', pinyin: 'GaoShengxuan', role: '在读硕士', avatar: 'avatar.jpg' },
  ZhangShuo: { title: '张硕', pinyin: 'ZhangShuo', role: '研究员', avatar: '' },
  LinTao: { title: '林涛', pinyin: 'LinTao', role: '在读博士', avatar: '' },
};

// 默认头像路径
const DEFAULT_AVATAR_URL = 'https://raw.githubusercontent.com/Boooil/VISTA-Research-Group/main/assets/media/icon.png';

// 上标映射 (用于共同第一作者标记)
const SUPERSCRIPTS = ['', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];

/**
 * 根据作者列表解析作者信息
 * @param {string[]} authorNames - frontmatter 中的 authors 数组
 * @param {object} [authorNotes] - 可选的 author_notes 对象
 * @param {{ get: (key: string, type?: string) => Promise<any> }} kv - KV namespace binding
 * @param {string} githubPath - 当前页面的 GitHub 路径 (用于拼接头像 URL)
 * @returns {Promise<{authors: AuthorInfo[], hasTeamMember: boolean, hasExternal: boolean}>}
 */
export async function resolveAuthors(authorNames, authorNotes, kv, githubPath = '') {
  if (!authorNames || authorNames.length === 0) {
    return { authors: [], hasTeamMember: false, hasExternal: false };
  }

  const repoBase = 'https://raw.githubusercontent.com/Boooil/VISTA-Research-Group/main';

  // 批量查询 KV (如果可用)
  const authorDataMap = {};
  for (const name of authorNames) {
    // KV 优先（包含 CMS 最新数据），DEFAULT_AUTHORS 作为兜底
    try {
      const kvData = kv && await kv.get(`author:${name}`, 'json');
      if (kvData) {
        authorDataMap[name] = kvData;
        continue;
      }
    } catch (e) {
      // KV 不可用，跳过
    }
    if (DEFAULT_AUTHORS[name]) {
      authorDataMap[name] = DEFAULT_AUTHORS[name];
    } else {
      authorDataMap[name] = null;
    }
  }

  const authors = authorNames.map((name, i) => {
    const data = authorDataMap[name];
    const note = authorNotes?.[i] || null;

    if (data) {
      // 团队成员
      const avatarUrl = data.avatar
        ? `${repoBase}/content/authors/${data.pinyin}/${data.avatar}`
        : null;

      return {
        name,
        displayName: data.title,
        isTeamMember: true,
        avatarUrl,
        role: data.role || '',
        authorUrl: `/author/${data.pinyin}/`,
        note,
      };
    } else {
      // 外部作者 - 直显输入值
      return {
        name,
        displayName: name,
        isTeamMember: false,
        avatarUrl: null,
        role: '',
        authorUrl: null,
        note,
      };
    }
  });

  const hasTeamMember = authors.some(a => a.isTeamMember);
  const hasExternal = authors.some(a => !a.isTeamMember);

  return { authors, hasTeamMember, hasExternal };
}

/**
 * 生成作者列表的 HTML
 * @param {AuthorInfo[]} authors
 * @returns {string} HTML 字符串
 */
export function renderAuthorsHTML(authors) {
  if (!authors || authors.length === 0) return '';

  return authors.map((a, i) => {
    const comma = i > 0 && !a.avatarUrl ? '<span class="mr-1">,</span>' : '';

    if (a.isTeamMember) {
      return `${comma}
  <a href="${a.authorUrl}" class="group inline-flex items-center text-current gap-x-1.5 mx-1 hover:underline">
    ${a.avatarUrl ? `<img src="${a.avatarUrl}" width="16" height="16" alt="${a.displayName}" class="inline-block h-4 w-4 rounded-full border border-current" loading="lazy" onerror="this.style.display='none'" />` : ''}
    <span class="text-sky-500 dark:text-sky-400 group-hover:text-sky-600 dark:group-hover:text-sky-300">${escapeHTML(a.displayName)}</span>
  </a>${renderAuthorNote(a)}`;
    } else {
      return `${comma}
  <div class="group inline-flex items-center text-current gap-x-1.5 mx-1">
    <div>${escapeHTML(a.displayName)}</div>
  </div>${renderAuthorNote(a)}`;
    }
  }).join('');
}

/**
 * 生成作者备注 tooltip HTML (Alpine.js)
 */
function renderAuthorNote(author) {
  if (!author.note) return '';
  return `
  <span class="relative inline-block ml-1" x-data="{ tooltip: false }">
    <button
      @mouseenter="tooltip = true"
      @mouseleave="tooltip = false"
      @click="tooltip = !tooltip"
      class="author-notes text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-200 transition-colors cursor-help"
      data-tooltip="${escapeHTML(author.note)}"
      aria-label="${escapeHTML(author.note)}"
      type="button"
    >
      <svg class="inline-block w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
      </svg>
    </button>
    <div
      x-show="tooltip"
      x-transition:enter="transition ease-out duration-200"
      x-transition:enter-start="opacity-0 transform scale-95"
      x-transition:enter-end="opacity-100 transform scale-100"
      x-transition:leave="transition ease-in duration-150"
      x-transition:leave-start="opacity-100 transform scale-100"
      x-transition:leave-end="opacity-0 transform scale-95"
      @click.away="tooltip = false"
      class="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 text-sm text-white bg-gray-900 dark:bg-gray-700 rounded-lg shadow-lg whitespace-nowrap"
      x-cloak
    >
      ${escapeHTML(author.note)}
      <div class="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
    </div>
  </span>`;
}

/**
 * publication_types 中文化映射
 */
export const PUB_TYPE_LABELS = {
  'paper-conference': '会议论文',
  'article-journal': '期刊论文',
  'patent': '专利',
  'software': '软件著作权',
  'report': '技术报告',
  'standard': '标准规范',
  'book': '专著',
  'thesis': '学位论文',
};

function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @typedef {object} AuthorInfo
 * @property {string} name - 原始标识 (pinyin 或中文名)
 * @property {string} displayName - 显示名 (中文或原文)
 * @property {boolean} isTeamMember - 是否为团队成员
 * @property {string|null} avatarUrl - 头像 URL
 * @property {string} role - 角色
 * @property {string|null} authorUrl - 作者页面链接
 * @property {string|null} note - 作者备注
 */
