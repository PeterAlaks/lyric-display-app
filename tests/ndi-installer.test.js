import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parseSha256Checksum, replaceDirectoryAtomically } from '../main/ndi/installer.js';

const HASH = 'a'.repeat(64);

test('NDI installer parses standard SHA-256 sidecar formats', () => {
  assert.equal(parseSha256Checksum(HASH), HASH);
  assert.equal(parseSha256Checksum(`${HASH}  lyricdisplay-ndi-win.zip\n`), HASH);
  assert.equal(parseSha256Checksum(`${HASH} *lyricdisplay-ndi-win.zip`), HASH);
});

test('NDI installer rejects malformed checksum sidecars', () => {
  assert.equal(parseSha256Checksum('not-a-checksum'), null);
  assert.equal(parseSha256Checksum('b'.repeat(63)), null);
  assert.equal(parseSha256Checksum(`${HASH}unexpected`), null);
  assert.equal(parseSha256Checksum(`${HASH}\n${HASH}`), null);
});

test('NDI installer atomically replaces an existing companion directory', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lyricdisplay-ndi-install-'));
  const destinationPath = path.join(root, 'Companion');
  const stagedPath = path.join(root, 'Companion-extracting');

  try {
    fs.mkdirSync(destinationPath, { recursive: true });
    fs.mkdirSync(stagedPath, { recursive: true });
    fs.writeFileSync(path.join(destinationPath, 'version.txt'), 'old', 'utf8');
    fs.writeFileSync(path.join(stagedPath, 'version.txt'), 'new', 'utf8');

    const result = replaceDirectoryAtomically({ fs, stagedPath, destinationPath });

    assert.equal(fs.readFileSync(path.join(destinationPath, 'version.txt'), 'utf8'), 'new');
    assert.equal(fs.existsSync(stagedPath), false);
    assert.equal(fs.existsSync(result.backupPath), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('NDI installer restores the prior companion when replacement fails', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lyricdisplay-ndi-rollback-'));
  const destinationPath = path.join(root, 'Companion');
  const missingStagedPath = path.join(root, 'missing-extraction');

  try {
    fs.mkdirSync(destinationPath, { recursive: true });
    fs.writeFileSync(path.join(destinationPath, 'version.txt'), 'old', 'utf8');

    assert.throws(
      () => replaceDirectoryAtomically({ fs, stagedPath: missingStagedPath, destinationPath }),
      /ENOENT/
    );
    assert.equal(fs.readFileSync(path.join(destinationPath, 'version.txt'), 'utf8'), 'old');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
