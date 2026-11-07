import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  convertTextSongFileToLdsong,
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

test('structured song files are readable and writable through granted workflows', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'lyricdisplay-ldsong-'));
  const filePath = path.join(directory, 'Amazing Grace.ldsong');
  const content = '#LDSONG 1\n# Title: Amazing Grace\n\n[Verse 1]\nAmazing grace';

  try {
    await writeFile(filePath, content, 'utf8');
    const payload = await readLyricsFileFromPath(filePath, { remember: false });
    assert.equal(payload.fileType, 'ldsong');
    assert.equal(payload.content, content);
    assert.equal(validateLyricWrite(filePath, content).valid, true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('a library TXT song converts into a structured .ldsong next to it, leaving the original alone', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'lyricdisplay-convert-'));
  const source = path.join(directory, 'Amazing Grace.txt');
  const text = '[Verse 1]\nAmazing grace how sweet the sound\nThat saved a wretch like me\n\n[Chorus]\nMy chains are gone\n\n[Verse 2]\nTwas grace\n\n[Chorus]\nMy chains are gone\n';

  try {
    await writeFile(source, text, 'utf8');
    const result = await convertTextSongFileToLdsong(source, {
      parsingOptions: { enableSplitting: false },
      convertedOn: '2026-11-07',
    });
    const target = path.join(directory, 'Amazing Grace.ldsong');
    const written = await readFile(target, 'utf8');

    assert.deepEqual(result, { status: 'converted', sourcePath: source, targetPath: target });
    assert.match(written, /^#LDSONG 1\n# Title: Amazing Grace\n# Arrangement: Verse 1, Chorus, Verse 2, Chorus\n# Converted from TXT: 2026-11-07\n/);
    assert.equal(await readFile(source, 'utf8'), text);

    await writeFile(target, 'edited by hand', 'utf8');
    const again = await convertTextSongFileToLdsong(source, { parsingOptions: { enableSplitting: false } });
    assert.equal(again.status, 'skipped');
    assert.equal(again.reason, 'exists');
    assert.equal(await readFile(target, 'utf8'), 'edited by hand');

    const structuredTxt = path.join(directory, 'Already.txt');
    await writeFile(structuredTxt, '#LDSONG 1\n# Title: Already\n\nLine\n', 'utf8');
    const structured = await convertTextSongFileToLdsong(structuredTxt);
    assert.equal(structured.status, 'skipped');
    assert.equal(structured.reason, 'structured');

    const lrc = path.join(directory, 'Timed.lrc');
    await writeFile(lrc, '[00:01.00]Line', 'utf8');
    const timed = await convertTextSongFileToLdsong(lrc);
    assert.equal(timed.status, 'skipped');
    assert.equal(timed.reason, 'unsupported');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
