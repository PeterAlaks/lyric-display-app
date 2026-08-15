import assert from 'node:assert/strict';
import test from 'node:test';
import { parseLyricsFileAsync } from '../src/utils/asyncLyricsParser.js';

const originalWindow = globalThis.window;
const originalFileReader = globalThis.FileReader;

class TestFileReader {
  readAsText(file) {
    file.text()
      .then((text) => {
        this.onload?.({ target: { result: text } });
      })
      .catch((error) => {
        this.onerror?.(error);
      });
  }
}

test.afterEach(() => {
  if (originalWindow === undefined) {
    delete globalThis.window;
  } else {
    globalThis.window = originalWindow;
  }

  if (originalFileReader === undefined) {
    delete globalThis.FileReader;
  } else {
    globalThis.FileReader = originalFileReader;
  }
});

test('dropped Electron File without path sends raw text through IPC', async () => {
  let ipcCalls = 0;
  let payload;
  globalThis.window = {
    electronAPI: {
      parseLyricsFile: async (nextPayload) => {
        ipcCalls += 1;
        payload = nextPayload;
        return {
          success: true,
          payload: {
            rawText: nextPayload.rawText,
            processedLines: [{ displayText: 'First line\nSecond line' }],
          },
        };
      },
    },
  };
  globalThis.FileReader = TestFileReader;

  const file = new File(['First line\nSecond line'], 'song.txt', { type: 'text/plain' });
  const parsed = await parseLyricsFileAsync(file, { fileType: 'txt' });

  assert.equal(ipcCalls, 1);
  assert.equal(payload.path, null);
  assert.equal(payload.rawText, 'First line\nSecond line');
  assert.equal(payload.enableSplitting, undefined);
  assert.equal(parsed.rawText, 'First line\nSecond line');
  assert.equal(parsed.processedLines.length, 1);
  assert.equal(parsed.processedLines[0].displayText, 'First line\nSecond line');
});

test('Electron IPC parser accepts filePath alias from callers', async () => {
  let payload;
  globalThis.window = {
    electronAPI: {
      parseLyricsFile: async (nextPayload) => {
        payload = nextPayload;
        return {
          success: true,
          payload: {
            rawText: 'Loaded from IPC',
            processedLines: ['Loaded from IPC'],
          },
        };
      },
    },
  };

  const parsed = await parseLyricsFileAsync(null, {
    filePath: 'C:\\Lyrics\\song.txt',
    fileType: 'txt',
  });

  assert.equal(payload.path, 'C:\\Lyrics\\song.txt');
  assert.equal(payload.rawText, null);
  assert.deepEqual(parsed.processedLines, ['Loaded from IPC']);
});

test('Electron IPC receives quick-parser overrides and grouping-plan controls', async () => {
  let payload;
  globalThis.window = {
    electronAPI: {
      parseLyricsFile: async (nextPayload) => {
        payload = nextPayload;
        return {
          success: true,
          payload: { rawText: 'Line', processedLines: ['Line'] },
        };
      },
    },
  };

  const groupingPlan = { version: 1, lines: ['Line'], groups: [] };
  await parseLyricsFileAsync(null, {
    rawText: 'Line',
    fileType: 'txt',
    enableSplitting: true,
    splitConfig: { TARGET_LENGTH: 50 },
    groupingConfig: { maxLineLength: 60, maxLinesPerGroup: 2 },
    groupingPlan,
    ignoreSavedGroupingPlan: true,
  });

  assert.equal(payload.enableSplitting, true);
  assert.equal(payload.splitConfig.TARGET_LENGTH, 50);
  assert.equal(payload.groupingConfig.maxLineLength, 60);
  assert.deepEqual(payload.groupingPlan, groupingPlan);
  assert.equal(payload.ignoreSavedGroupingPlan, true);
});
