import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  readValidatedSetlistFile,
  saveSetlistFile,
  SETLIST_BACKUP_SUFFIX,
} from '../main/setlistFileStorage.js';
import {
  CURRENT_SETLIST_SCHEMA_VERSION,
  validateSetlistData,
} from '../main/setlistValidation.js';

function setlist(content, version = CURRENT_SETLIST_SCHEMA_VERSION) {
  return {
    version,
    items: [{
      displayName: 'Song',
      originalName: 'Song.txt',
      content,
      fileType: 'txt',
    }],
  };
}

async function withTemporaryDirectory(run) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lyricdisplay-setlist-'));
  try {
    await run(directory);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

test('setlist schemas migrate legacy files and reject future versions', () => {
  const legacy = validateSetlistData({ items: [] });
  assert.equal(legacy.valid, true);
  assert.equal(legacy.migrated, true);
  assert.equal(legacy.setlistData.version, CURRENT_SETLIST_SCHEMA_VERSION);

  const numericV1 = validateSetlistData(setlist('Lyrics', 1));
  assert.equal(numericV1.valid, true);
  assert.equal(numericV1.setlistData.version, CURRENT_SETLIST_SCHEMA_VERSION);

  const future = validateSetlistData(setlist('Lyrics', '2.0'));
  assert.equal(future.valid, false);
  assert.match(future.error, /newer LyricDisplay version/i);

  const malformed = validateSetlistData(setlist('Lyrics', 'next'));
  assert.equal(malformed.valid, false);
  assert.match(malformed.error, /unsupported setlist schema version/i);
});

test('durable setlist saves retain one last-known-good backup', async () => {
  await withTemporaryDirectory(async (directory) => {
    const filePath = path.join(directory, 'service.ldset');
    await saveSetlistFile(fs, filePath, setlist('First generation'));
    await saveSetlistFile(fs, filePath, setlist('Second generation'));

    const current = JSON.parse(await fs.readFile(filePath, 'utf8'));
    const backup = JSON.parse(await fs.readFile(`${filePath}${SETLIST_BACKUP_SUFFIX}`, 'utf8'));
    assert.equal(current.items[0].content, 'Second generation');
    assert.equal(backup.items[0].content, 'First generation');
    assert.deepEqual((await fs.readdir(directory)).sort(), [
      'service.ldset',
      `service.ldset${SETLIST_BACKUP_SUFFIX}`,
    ]);
  });
});

test('a failed final rename preserves the current file and cleans temporary files', async () => {
  await withTemporaryDirectory(async (directory) => {
    const filePath = path.join(directory, 'service.ldset');
    await saveSetlistFile(fs, filePath, setlist('Original'));

    const failingFs = {
      ...fs,
      async rename(source, destination) {
        if (destination === filePath) {
          const error = new Error('simulated rename failure');
          error.code = 'EACCES';
          throw error;
        }
        return fs.rename(source, destination);
      },
    };

    await assert.rejects(
      saveSetlistFile(failingFs, filePath, setlist('Replacement')),
      /simulated rename failure/,
    );
    const preserved = JSON.parse(await fs.readFile(filePath, 'utf8'));
    assert.equal(preserved.items[0].content, 'Original');
    assert.equal((await fs.readdir(directory)).some((name) => name.endsWith('.tmp')), false);
  });
});

test('setlist loading recovers a valid backup when the primary is corrupt', async () => {
  await withTemporaryDirectory(async (directory) => {
    const filePath = path.join(directory, 'service.ldset');
    await saveSetlistFile(fs, filePath, setlist('Recover me'));
    await saveSetlistFile(fs, filePath, setlist('Current'));
    await fs.writeFile(filePath, '{broken json', 'utf8');

    const loaded = await readValidatedSetlistFile(fs, filePath);
    assert.equal(loaded.success, true);
    assert.equal(loaded.recoveredFromBackup, true);
    assert.equal(loaded.setlistData.items[0].content, 'Recover me');
    assert.match(loaded.recoveryWarning, /last-known-good backup/i);
  });
});
