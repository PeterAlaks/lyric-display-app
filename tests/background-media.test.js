import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { createBackgroundMediaService } from '../server/media/backgroundMedia.js';
import {
  buildBackgroundMediaFilename,
  parseBackgroundMediaFilename,
  resolveBackgroundMediaExtension,
} from '../server/media/backgroundMediaFilename.js';

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

const buildName = (outputKey, timestamp, uuid = UUID_A, originalName = 'background.png') => (
  buildBackgroundMediaFilename({
    outputKey,
    timestamp,
    uuid,
    originalName,
    mimeType: 'image/png',
  })
);

test('background media filename builder and parser share one bounded format', () => {
  const filename = buildName('output3', 1800000000000);
  assert.equal(filename, `bg-output3-1800000000000-${UUID_A}.png`);
  assert.deepEqual(parseBackgroundMediaFilename(filename), {
    filename,
    outputKey: 'output3',
    timestamp: 1800000000000,
    uuid: UUID_A,
    extension: '.png',
  });
  assert.equal(buildName('output99', 1800000000000), null);
  assert.equal(buildBackgroundMediaFilename({
    outputKey: 'output1',
    timestamp: 1800000000000,
    uuid: '------------------------------------',
    originalName: 'background.png',
    mimeType: 'image/png',
  }), null);
  assert.equal(parseBackgroundMediaFilename('../bg-output1-1800000000000-invalid.png'), null);
});

test('background media extensions are restricted to supported media types', () => {
  assert.equal(resolveBackgroundMediaExtension({ originalName: 'photo.PNG', mimeType: 'image/png' }), '.png');
  assert.equal(resolveBackgroundMediaExtension({ originalName: 'photo.exe', mimeType: 'image/jpeg' }), '.jpg');
  assert.equal(resolveBackgroundMediaExtension({ originalName: 'photo.mp4', mimeType: 'image/png' }), '.png');
  assert.equal(resolveBackgroundMediaExtension({ originalName: 'photo.exe', mimeType: 'application/octet-stream' }), null);
});

test('background cleanup removes only superseded files for the same output', async () => {
  const backgroundMediaDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lyricdisplay-backgrounds-'));
  const oldOutput3 = buildName('output3', 1800000000000, UUID_A);
  const currentOutput3 = buildName('output3', 1800000001000, UUID_B);
  const otherOutput = buildName('output2', 1800000000000, UUID_A);
  const unrelated = 'operator-notes.png';

  try {
    await Promise.all([
      fs.writeFile(path.join(backgroundMediaDir, oldOutput3), 'old'),
      fs.writeFile(path.join(backgroundMediaDir, currentOutput3), 'current'),
      fs.writeFile(path.join(backgroundMediaDir, otherOutput), 'other'),
      fs.writeFile(path.join(backgroundMediaDir, unrelated), 'unrelated'),
    ]);

    const service = createBackgroundMediaService({ backgroundMediaDir });
    const result = await service.cleanupOldMediaFiles('output3', { keepFilename: currentOutput3 });
    const remaining = (await fs.readdir(backgroundMediaDir)).sort();

    assert.equal(result.deleted, 1);
    assert.deepEqual(remaining, [currentOutput3, otherOutput, unrelated].sort());
  } finally {
    await fs.rm(backgroundMediaDir, { recursive: true, force: true });
  }
});

test('invalid cleanup targets are ignored without scanning or deleting files', async () => {
  const service = createBackgroundMediaService({ backgroundMediaDir: 'unused' });
  assert.deepEqual(await service.cleanupOldMediaFiles('output99'), { deleted: 0, skipped: 0 });
});
