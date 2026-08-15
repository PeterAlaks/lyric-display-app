import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  extractFilePathFromArgs,
  handleFileOpen,
  isSupportedFile,
  isSupportedScheduleFile,
} from '../main/fileHandler.js';
import { serializeScheduleDocument } from '../shared/scheduleUtils.js';

test('operating-system file routing recognizes LyricDisplay schedules', () => {
  assert.equal(isSupportedScheduleFile('C:\\Schedules\\Sunday.LDSCH'), true);
  assert.equal(isSupportedFile('/schedules/service.ldsch'), true);
  assert.equal(
    extractFilePathFromArgs(['LyricDisplay', '--flag', 'C:\\Schedules\\Sunday.ldsch']),
    'C:\\Schedules\\Sunday.ldsch'
  );
});

test('opening an associated schedule validates it and sends it to the renderer', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'lyricdisplay-schedule-'));
  const filePath = path.join(directory, 'Service.ldsch');
  const sent = [];
  const fakeWindow = {
    isDestroyed: () => false,
    isMinimized: () => false,
    focus: () => {},
    webContents: {
      send: (channel, payload) => sent.push({ channel, payload }),
    },
  };

  try {
    await writeFile(filePath, serializeScheduleDocument({
      title: 'Sunday Service',
      items: [{ id: 'welcome', label: 'Welcome', durationMs: 4 * 60_000, timed: true }],
    }), 'utf8');

    await handleFileOpen(filePath, fakeWindow);

    assert.equal(sent.length, 1);
    assert.equal(sent[0].channel, 'open-schedule-from-path');
    assert.equal(sent[0].payload.filePath, filePath);
    assert.equal(sent[0].payload.schedule.title, 'Sunday Service');
    assert.equal(sent[0].payload.schedule.items[0].durationMs, 4 * 60_000);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
