import test from 'node:test';
import assert from 'node:assert/strict';
import {
  openFileNavigator,
  saveWithFileNavigator,
} from '../src/utils/fileNavigatorEvents.js';

test('file navigator requests preserve destination and setlist selection limits', () => {
  const previousWindow = globalThis.window;
  let receivedEvent = null;
  globalThis.window = {
    electronAPI: { fileNavigator: { getState: () => {} } },
    dispatchEvent: (event) => {
      receivedEvent = event;
      return true;
    },
  };

  try {
    assert.equal(openFileNavigator({ destination: 'setlist', maxSelections: 7 }), true);
    assert.equal(receivedEvent?.type, 'lyricdisplay:open-file-navigator');
    assert.deepEqual(receivedEvent?.detail, { destination: 'setlist', maxSelections: 7 });
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test('save navigator requests resolve with the selected indexed destination', async () => {
  const previousWindow = globalThis.window;
  let receivedEvent = null;
  globalThis.window = {
    electronAPI: {
      fileNavigator: {
        getState: () => {},
        prepareSave: () => {},
      },
    },
    dispatchEvent: (event) => {
      receivedEvent = event;
      return true;
    },
  };

  try {
    const selectionPromise = saveWithFileNavigator({
      suggestedName: 'Amazing Grace',
      extension: 'txt',
      initialDirectory: '/songs',
    });
    assert.equal(receivedEvent?.type, 'lyricdisplay:open-file-save-navigator');
    assert.equal(receivedEvent?.detail?.suggestedName, 'Amazing Grace');
    assert.equal(receivedEvent?.detail?.extension, 'txt');
    assert.equal(receivedEvent?.detail?.initialDirectory, '/songs');
    receivedEvent.detail.onComplete({ success: true, filePath: '/songs/Amazing Grace.txt' });
    assert.deepEqual(await selectionPromise, {
      success: true,
      filePath: '/songs/Amazing Grace.txt',
    });
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
