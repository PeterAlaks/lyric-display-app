import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  readLyricsFileFromPath,
  validateLyricImportPath,
  validateLyricWrite,
} from '../main/lyricFiles.js';

test('canonical lyric loader validates, reads, and grants an opened local file', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'lyricdisplay-loader-'));
  const filePath = path.join(directory, 'Amazing Grace.LRC');
  const content = '[00:01.00]Amazing grace\n[00:04.00]How sweet the sound';

  try {
    await writeFile(filePath, content, 'utf8');
    const payload = await readLyricsFileFromPath(filePath, { remember: false });

    assert.equal(payload.content, content);
    assert.equal(payload.fileName, 'Amazing Grace.LRC');
    assert.equal(payload.filePath, path.resolve(filePath));
    assert.equal(payload.fileType, 'lrc');
    assert.deepEqual(validateLyricWrite(filePath, content), {
      valid: true,
      normalized: path.resolve(filePath),
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('canonical lyric loader rejects unsupported local file types', async () => {
  await assert.rejects(
    validateLyricImportPath(path.join(os.tmpdir(), 'lyrics.pdf')),
    /Unsupported lyric file type/
  );
});
