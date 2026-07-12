import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const packageLock = JSON.parse(fs.readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
const removedDirectDependencies = [
  '@tailwindcss/forms',
  'archiver',
  'rollup',
];

test('verified unused packages are absent from direct dependency declarations', () => {
  const declared = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  for (const dependency of removedDirectDependencies) {
    assert.equal(declared[dependency], undefined, `${dependency} must not return without a documented runtime use`);
  }
});

test('removed dependency trees are absent while the active Vite and Rolldown toolchain remains', () => {
  const packages = packageLock.packages || {};
  for (const dependency of removedDirectDependencies) {
    assert.equal(packages[`node_modules/${dependency}`], undefined);
  }

  assert.ok(packages['node_modules/vite']);
  assert.ok(packages['node_modules/rolldown']);
});

test('Zustand traditional selectors retain their required peer dependency', () => {
  const selectorsSource = fs.readFileSync(
    new URL('../src/hooks/useStoreSelectors.js', import.meta.url),
    'utf8',
  );
  const declared = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  assert.match(selectorsSource, /from ['"]zustand\/traditional['"]/);
  assert.ok(
    declared['use-sync-external-store'],
    'zustand/traditional imports use-sync-external-store/shim/with-selector at runtime',
  );
  assert.ok(
    packageLock.packages?.['node_modules/use-sync-external-store'],
    'the selector peer dependency must be installed in the locked dependency tree',
  );
});
