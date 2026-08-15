import assert from 'node:assert/strict';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ensureNavigatorDirectory } from '../main/fileNavigatorDirectories.js';

test('default Lyrics directory creation reuses folders that already exist', async () => {
  const testRoot = await mkdtemp(path.join(os.tmpdir(), 'lyricdisplay-folder-'));
  const lyricsPath = path.join(testRoot, 'LyricDisplay', 'Lyrics');
  try {
    assert.equal(await ensureNavigatorDirectory(lyricsPath, 'The Lyrics folder'), true);
    assert.equal((await stat(lyricsPath)).isDirectory(), true);
    assert.equal(await ensureNavigatorDirectory(lyricsPath, 'The Lyrics folder'), false);
  } finally {
    await rm(testRoot, { recursive: true, force: true });
  }
});

test('default Lyrics directory creation explains files blocking either folder name', async () => {
  const testRoot = await mkdtemp(path.join(os.tmpdir(), 'lyricdisplay-folder-'));
  const blockingPath = path.join(testRoot, 'LyricDisplay');
  try {
    await writeFile(blockingPath, 'not a directory', 'utf8');
    await assert.rejects(
      ensureNavigatorDirectory(blockingPath, 'The LyricDisplay Documents folder'),
      /already exists but is not a folder/
    );
    await assert.rejects(
      ensureNavigatorDirectory(path.join(blockingPath, 'Lyrics'), 'The Lyrics folder'),
      /part of that path is not a folder/
    );
  } finally {
    await rm(testRoot, { recursive: true, force: true });
  }
});
