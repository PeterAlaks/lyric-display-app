import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  getFolderSelectionNotice,
  mergeFileNavigatorStatus,
  openFileNavigator,
  saveWithFileNavigator,
} from '../src/utils/fileNavigatorEvents.js';

test('native lyrics folder picker supports selecting a batch of directories', async () => {
  const source = await readFile(new URL('../main/ipc/fileNavigator.js', import.meta.url), 'utf8');
  assert.match(source, /properties:\s*\['openDirectory', 'multiSelections'\]/);
  assert.match(source, /addFileNavigatorRoots\(result\.filePaths\)/);
});

test('default Lyrics folder creation is exposed across every navigator empty state', async () => {
  const [ipcSource, engineSource, preloadSource, navigatorSource, saveSource, preferencesSource] = await Promise.all([
    readFile(new URL('../main/ipc/fileNavigator.js', import.meta.url), 'utf8'),
    readFile(new URL('../main/fileNavigator.js', import.meta.url), 'utf8'),
    readFile(new URL('../preload.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/FileNavigatorModal.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/FileSaveNavigatorModal.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/UserPreferencesModal/IndexedLyricsFoldersPreferencesPage.jsx', import.meta.url), 'utf8'),
  ]);

  assert.match(ipcSource, /file-navigator:create-lyrics-folder/);
  assert.match(engineSource, /const documentsPath = app\.getPath\('documents'\)/);
  assert.match(engineSource, /path\.join\(documentsPath, 'LyricDisplay'\)/);
  assert.match(engineSource, /path\.join\(appDocumentsPath, 'Lyrics'\)/);
  assert.match(engineSource, /ensureNavigatorDirectory\(lyricsFolderPath, 'The Lyrics folder'\)/);
  assert.match(preloadSource, /createLyricsFolder:\s*\(\)\s*=>\s*ipcRenderer\.invoke\('file-navigator:create-lyrics-folder'\)/);
  for (const source of [navigatorSource, saveSource, preferencesSource]) {
    assert.match(source, /createLyricsFolder/);
    assert.match(source, /Create lyrics folder/);
    assert.match(source, /Creating folder/);
  }
});

test('multi-folder indexing feedback summarizes complete and partial selections', () => {
  assert.deepEqual(getFolderSelectionNotice({
    requestedCount: 3,
    addedCount: 3,
    skipped: [],
  }), {
    title: '3 folders indexed',
    message: 'The selected folders are ready to search.',
    variant: 'success',
  });

  assert.deepEqual(getFolderSelectionNotice({
    requestedCount: 3,
    addedCount: 2,
    skipped: [{ reason: 'Folder is already indexed.' }],
  }), {
    title: '2 indexed, 1 skipped',
    message: 'Folder is already indexed.',
    variant: 'warning',
  });
  assert.equal(getFolderSelectionNotice({ requestedCount: 1, addedCount: 1 }), null);
});

test('file navigator ignores intermediate index progress renders', () => {
  const scanning = { scanning: true, scannedFiles: 0, indexedFiles: 20 };
  assert.equal(mergeFileNavigatorStatus(scanning, {
    scanning: true,
    scannedFiles: 250,
    indexedFiles: 20,
  }), scanning);

  assert.deepEqual(mergeFileNavigatorStatus(scanning, {
    scanning: false,
    scannedFiles: 420,
    indexedFiles: 420,
  }), {
    scanning: false,
    scannedFiles: 420,
    indexedFiles: 420,
  });
});

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
      contentByExtension: { txt: 'Amazing grace' },
    });
    assert.equal(receivedEvent?.type, 'lyricdisplay:open-file-save-navigator');
    assert.equal(receivedEvent?.detail?.suggestedName, 'Amazing Grace');
    assert.equal(receivedEvent?.detail?.extension, 'txt');
    assert.equal(receivedEvent?.detail?.initialDirectory, '/songs');
    assert.deepEqual(receivedEvent?.detail?.contentByExtension, { txt: 'Amazing grace' });
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
