import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { clearLogDirectoryContents } from '../main/logCleanup.js';

test('system log cleanup removes every entry inside the exact log directory', async (t) => {
  const testRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lyricdisplay-log-cleanup-'));
  const logDirectory = path.join(testRoot, 'logs');
  await fs.mkdir(path.join(logDirectory, 'archived'), { recursive: true });
  await fs.writeFile(path.join(logDirectory, 'latest.log'), 'pointer', 'utf8');
  await fs.writeFile(path.join(logDirectory, 'session.log'), 'session', 'utf8');
  await fs.writeFile(path.join(logDirectory, 'archived', 'old.log'), 'old', 'utf8');
  t.after(() => fs.rm(testRoot, { recursive: true, force: true }));

  const result = await clearLogDirectoryContents(logDirectory);

  assert.equal(result.removedEntries, 3);
  assert.deepEqual(await fs.readdir(logDirectory), []);
});

test('system log cleanup rejects broad filesystem roots', async () => {
  await assert.rejects(
    clearLogDirectoryContents(path.parse(process.cwd()).root),
    /filesystem root/,
  );
});
