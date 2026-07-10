import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSha256Checksum } from '../main/ndi/installer.js';

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
