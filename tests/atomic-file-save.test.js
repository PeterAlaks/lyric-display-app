import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { saveTextFileAtomically } from '../main/atomicFileSave.js';
import {
  grantLyricWritePath,
  validateLyricWrite,
} from '../main/lyricFiles.js';

async function withTemporaryDirectory(run) {
  const directoryPath = await mkdtemp(path.join(os.tmpdir(), 'lyricdisplay-atomic-save-'));
  try {
    await run(directoryPath);
  } finally {
    await rm(directoryPath, { recursive: true, force: true });
  }
}

test('exclusive navigator saves never replace an existing file', async () => {
  await withTemporaryDirectory(async (directoryPath) => {
    const filePath = path.join(directoryPath, 'Amazing Grace.txt');
    await writeFile(filePath, 'existing lyrics', 'utf8');

    await assert.rejects(
      saveTextFileAtomically(filePath, 'new lyrics', { mode: 'create' }),
      (error) => error?.code === 'FILE_EXISTS'
    );

    assert.equal(await readFile(filePath, 'utf8'), 'existing lyrics');
    assert.deepEqual(await readdir(directoryPath), ['Amazing Grace.txt']);
  });
});

test('exclusive navigator saves publish a complete new file', async () => {
  await withTemporaryDirectory(async (directoryPath) => {
    const filePath = path.join(directoryPath, 'New Song.lrc');
    const result = await saveTextFileAtomically(filePath, '[00:01.00]New song', { mode: 'create' });

    assert.deepEqual(result, { created: true, replaced: false });
    assert.equal(await readFile(filePath, 'utf8'), '[00:01.00]New song');
    assert.deepEqual(await readdir(directoryPath), ['New Song.lrc']);
  });
});

test('confirmed replacements swap in complete content and remove temporary files', async () => {
  await withTemporaryDirectory(async (directoryPath) => {
    const filePath = path.join(directoryPath, 'Song.txt');
    await writeFile(filePath, 'old lyrics', 'utf8');

    const result = await saveTextFileAtomically(filePath, 'replacement lyrics', { mode: 'replace' });

    assert.deepEqual(result, { created: false, replaced: true });
    assert.equal(await readFile(filePath, 'utf8'), 'replacement lyrics');
    assert.deepEqual(await readdir(directoryPath), ['Song.txt']);
  });
});

test('confirmed replacements never replace a folder with the same name', async () => {
  await withTemporaryDirectory(async (directoryPath) => {
    const folderPath = path.join(directoryPath, 'Song.txt');
    await mkdir(folderPath);

    await assert.rejects(
      saveTextFileAtomically(folderPath, 'replacement lyrics', { mode: 'replace' }),
      (error) => error?.code === 'INVALID_SAVE_TARGET'
    );

    assert.deepEqual(await readdir(directoryPath), ['Song.txt']);
  });
});

test('simultaneous exclusive saves allow exactly one completed file', async () => {
  await withTemporaryDirectory(async (directoryPath) => {
    const filePath = path.join(directoryPath, 'Race.txt');
    const outcomes = await Promise.allSettled([
      saveTextFileAtomically(filePath, 'first complete version', { mode: 'create' }),
      saveTextFileAtomically(filePath, 'second complete version', { mode: 'create' }),
    ]);

    assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
    const rejected = outcomes.find((outcome) => outcome.status === 'rejected');
    assert.equal(rejected?.reason?.code, 'FILE_EXISTS');
    assert.match(await readFile(filePath, 'utf8'), /^(first|second) complete version$/);
    assert.deepEqual(await readdir(directoryPath), ['Race.txt']);
  });
});

test('create authorization cannot be used to replace a file', async () => {
  await withTemporaryDirectory(async (directoryPath) => {
    const filePath = path.join(directoryPath, 'Authorized.txt');
    grantLyricWritePath(filePath, { collisionPolicy: 'create' });

    assert.equal(validateLyricWrite(filePath, 'lyrics', { collisionPolicy: 'create' }).valid, true);
    assert.deepEqual(validateLyricWrite(filePath, 'lyrics', { collisionPolicy: 'replace' }), {
      valid: false,
      error: 'File replacement was not confirmed by a LyricDisplay file workflow',
    });

    grantLyricWritePath(filePath, { collisionPolicy: 'replace' });
    assert.equal(validateLyricWrite(filePath, 'lyrics', { collisionPolicy: 'replace' }).valid, true);
  });
});
