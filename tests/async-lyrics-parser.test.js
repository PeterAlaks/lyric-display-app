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

test('dropped Electron File without path skips IPC and parses locally', async () => {
  let ipcCalls = 0;
  globalThis.window = {
    electronAPI: {
      parseLyricsFile: async () => {
        ipcCalls += 1;
        return { success: false, error: 'No lyric content available for parsing' };
      },
    },
  };
  globalThis.FileReader = TestFileReader;

  const file = new File(['First line\nSecond line'], 'song.txt', { type: 'text/plain' });
  const parsed = await parseLyricsFileAsync(file, { fileType: 'txt' });

  assert.equal(ipcCalls, 0);
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
