import assert from 'node:assert/strict';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { arrangeRootsWithLibrary, countUserRoots, ensureNavigatorDirectory } from '../main/fileNavigatorDirectories.js';

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

test('the song library is always indexed first without displacing folders the user chose', () => {
  const library = path.join('/docs', 'LyricDisplay', 'Lyrics');
  const songs = path.join('/music', 'Songs');
  const hymns = path.join('/music', 'Hymns');

  // Added ahead of the user's folders on first launch and after upgrading.
  assert.deepEqual(arrangeRootsWithLibrary([songs, hymns], library), [library, songs, hymns]);
  // Moved to the front, never duplicated, when the user already indexed it.
  assert.deepEqual(arrangeRootsWithLibrary([songs, library], library), [library, songs]);
  // Folders inside the library are folded into it.
  assert.deepEqual(arrangeRootsWithLibrary([path.join(library, 'Imports'), songs], library), [library, songs]);
  // A user folder that already contains the library keeps covering it.
  const documents = path.join('/docs');
  assert.deepEqual(arrangeRootsWithLibrary([documents, songs], library), [documents, songs]);
  // Without a library (no Documents folder), roots are untouched.
  assert.deepEqual(arrangeRootsWithLibrary([songs], null), [songs]);

  // The library never counts toward the user's folder limit.
  assert.equal(countUserRoots([library, songs, hymns], library), 2);
  assert.equal(countUserRoots([songs, hymns], library), 2);
});
