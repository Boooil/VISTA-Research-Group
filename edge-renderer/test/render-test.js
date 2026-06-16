/**
 * 直接测试 renderPublication 函数
 */
import { renderPageShell } from '../src/shell.js';

const html = renderPageShell({
  content: '<h1>TEST TITLE</h1><p>This is test content</p>',
  canonicalUrl: 'https://vista-research-group.pages.dev/publication/test/',
  title: 'Test Publication Title',
  description: 'Test description for meta tags',
  publishedTime: '2024-01-01T00:00:00.000Z',
  modifiedTime: '2024-01-01T00:00:00.000Z',
  ogImage: 'https://example.com/image.jpg',
  currentYear: '2026',
});

console.log('=== Output length:', html.length, 'chars ===');
console.log('Has __CONTENT__:', html.includes('__CONTENT__'));
console.log('Has __META_DESC__:', html.includes('__META_DESC__'));
console.log('Has test h1:', html.includes('<h1>TEST TITLE</h1>'));
console.log('Has test content:', html.includes('This is test content'));

// Save to file
import { writeFileSync } from 'fs';
writeFileSync('test/shell-output.html', html);
console.log('Saved to test/shell-output.html');
