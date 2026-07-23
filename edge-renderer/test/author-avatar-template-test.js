import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDir, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const resolver = read('layouts/partials/authors/avatar-resource.html');

assert.match(resolver, /Params\.avatar_filename/, 'avatar resolver should honor the CMS filename field');
assert.match(resolver, /Resources\.GetMatch \./, 'avatar resolver should resolve the exact page resource filename');
assert.match(resolver, /GetMatch "\*avatar\*"/, 'legacy avatar.jpg naming should remain supported');

for (const relativePath of [
  'layouts/authors/list.html',
  'layouts/partials/authors/card.html',
  'layouts/partials/hbx/blocks/team-showcase/block.html',
  'layouts/publication/single.html',
  'layouts/_default/single.html',
]) {
  assert.match(
    read(relativePath),
    /partial "authors\/avatar-resource\.html"/,
    `${relativePath} should use the shared avatar resolver`,
  );
}

for (const authorDir of ['pengyilin', 'wangyichang']) {
  const frontmatter = read(`content/authors/${authorDir}/_index.md`);
  const avatarMatch = frontmatter.match(/^avatar_filename:\s*([^\r\n]+)$/m);
  assert.ok(avatarMatch, `${authorDir} should declare avatar_filename`);

  const avatarFilename = avatarMatch[1].trim().replace(/^['"]|['"]$/g, '');
  assert.ok(!avatarFilename.toLowerCase().includes('avatar'), `${authorDir} should exercise a non-avatar filename`);
  assert.ok(
    fs.existsSync(path.join(root, 'content', 'authors', authorDir, avatarFilename)),
    `${authorDir} avatar resource should exist`,
  );
}

console.log('PASS: Hugo author avatar templates honor avatar_filename with legacy fallback');
