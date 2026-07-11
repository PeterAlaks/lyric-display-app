import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { getWindowPreloadRole } from '../main/windowSecurity.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('passive display preload excludes control, file, NDI, and update mutation channels', () => {
  const source = read('preloads/passive.cjs');
  for (const forbidden of [
    'write-file',
    'display:project-output',
    'ndi:set-output-enabled',
    'osc:enable',
    'security:rotate-jwt-and-restart',
    'updater:install',
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
  assert.equal(source.includes('token-store:get'), true);
  assert.equal(source.includes('preferences:get-advanced-settings'), true);
});

test('data-document preloads expose only their role-specific IPC channels', () => {
  const browser = read('preloads/browser.cjs');
  const loading = read('preloads/loading.cjs');
  const updater = read('preloads/updater.cjs');

  assert.equal(browser.includes('browser-nav'), true);
  assert.equal(browser.includes('token-store:'), false);
  assert.equal(loading.includes('loading-status'), true);
  assert.equal(loading.includes('ipcRenderer.invoke'), false);
  assert.equal(updater.includes('updater:install'), true);
  assert.equal(updater.includes('write-file'), false);
});

test('packaging includes and unpacks role-specific preload files', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.build.files.includes('preloads/**/*'), true);
  assert.equal(pkg.build.asarUnpack.includes('preloads/**/*'), true);
});

test('window routes receive control, passive, or no preload by role', () => {
  assert.equal(getWindowPreloadRole('/'), 'control');
  assert.equal(getWindowPreloadRole('/timer-control'), 'control');
  assert.equal(getWindowPreloadRole('/output1?projection=true'), 'passive');
  assert.equal(getWindowPreloadRole('/output12'), 'passive');
  assert.equal(getWindowPreloadRole('/stage'), 'passive');
  assert.equal(getWindowPreloadRole('/time'), 'passive');
  assert.equal(getWindowPreloadRole('/lyric-video-live-output'), 'passive');
  assert.equal(getWindowPreloadRole('/lyric-video-export-frame'), 'none');
});
