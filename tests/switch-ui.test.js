import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const srcRoot = path.join(repositoryRoot, 'src');

async function findJsxFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return findJsxFiles(entryPath);
    return entry.isFile() && entry.name.endsWith('.jsx') ? [entryPath] : [];
  }));
  return nestedFiles.flat();
}

test('shared switch owns its reusable geometry, appearance, and directional motion', async () => {
  const switchSource = await readFile(path.join(srcRoot, 'components', 'ui', 'switch.jsx'), 'utf8');
  const globalStyles = await readFile(path.join(srcRoot, 'index.css'), 'utf8');

  for (const size of ['compact', 'small', 'medium', 'large']) {
    assert.match(switchSource, new RegExp(`${size}:`), `missing ${size} switch size`);
  }
  for (const variant of ['default', 'control', 'success', 'warning', 'blue']) {
    assert.match(switchSource, new RegExp(`${variant}:`), `missing ${variant} switch variant`);
  }
  assert.equal((switchSource.match(/data-\[state=checked\]:bg-green-500/g) ?? []).length, 5);
  assert.equal((switchSource.match(/dark:data-\[state=checked\]:bg-green-400/g) ?? []).length, 5);

  assert.match(switchSource, /data-motion=\{motion \?\? undefined\}/);
  assert.match(globalStyles, /@keyframes switch-thumb-to-checked/);
  assert.match(globalStyles, /@keyframes switch-thumb-to-unchecked/);
  assert.match(globalStyles, /--switch-thumb-inset:\s*0\.125rem/);
  assert.match(globalStyles, /var\(--switch-track-width\) - var\(--switch-thumb-width\) - var\(--switch-thumb-inset\)/);
  assert.match(globalStyles, /\.switch-track[\s\S]*?corner-shape:\s*round/);
  assert.match(globalStyles, /\.switch-thumb[\s\S]*?corner-shape:\s*round/);
  assert.match(globalStyles, /prefers-reduced-motion:\s*reduce[\s\S]*?\.switch-thumb/);
});

test('switch consumers use shared variants instead of hardcoded track or thumb classes', async () => {
  const jsxFiles = await findJsxFiles(srcRoot);
  const sharedSwitchPath = path.join(srcRoot, 'components', 'ui', 'switch.jsx');

  for (const filePath of jsxFiles) {
    if (filePath === sharedSwitchPath) continue;
    const source = await readFile(filePath, 'utf8');
    const switchElements = source.match(/<Switch\b[\s\S]*?\/>/g) ?? [];

    for (const switchElement of switchElements) {
      const relativePath = path.relative(repositoryRoot, filePath);
      assert.doesNotMatch(switchElement, /\b(?:className|thumbClassName)=/, `${relativePath} hardcodes shared switch styling`);
      assert.match(switchElement, /\bsize="(?:compact|small|medium|large)"/, `${relativePath} does not select a shared switch size`);
      assert.match(switchElement, /\bvariant="(?:default|control|success|warning|blue)"/, `${relativePath} does not select a shared switch variant`);
    }
  }
});
