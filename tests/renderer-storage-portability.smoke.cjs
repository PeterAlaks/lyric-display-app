const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow } = require('electron');

const phase = process.env.LYRICDISPLAY_STORAGE_SMOKE_PHASE;
const appDataPath = process.env.LYRICDISPLAY_STORAGE_SMOKE_APP_DATA;
const sourceOrigin = process.env.LYRICDISPLAY_STORAGE_SMOKE_SOURCE_ORIGIN;
const targetOrigin = process.env.LYRICDISPLAY_STORAGE_SMOKE_TARGET_ORIGIN;

if (!phase || !appDataPath || !sourceOrigin || !targetOrigin) {
  throw new Error('Renderer storage smoke test environment is incomplete.');
}

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('headless');
app.commandLine.appendSwitch('disable-gpu');
app.setName('LyricDisplay');
app.setPath('appData', appDataPath);
app.setPath('userData', path.join(appDataPath, 'LyricDisplay-Dev'));
app.setPath('sessionData', path.join(appDataPath, 'LyricDisplay-Dev'));

const preloadPath = path.resolve(__dirname, '..', 'preload.js');
const sourceState = JSON.stringify({
  state: {
    hasSeenWelcome: true,
    timerControlSettings: { scheduleTitle: 'Sunday Service' },
    output1Settings: { fontSize: 72 },
  },
  version: 0,
});
const targetDefaults = JSON.stringify({
  state: {
    hasSeenWelcome: false,
    timerControlSettings: { scheduleTitle: 'Timer Schedule' },
    output1Settings: { fontSize: 48 },
  },
  version: 0,
});
const updatedState = JSON.stringify({
  ...JSON.parse(sourceState),
  state: {
    ...JSON.parse(sourceState).state,
    timerControlSettings: { scheduleTitle: 'Evening Service' },
  },
});

const openWindow = async (origin, { preload = false } = {}) => {
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preload ? preloadPath : undefined,
    },
  });
  await window.loadURL(origin);
  return window;
};

const flushBrowserStorage = async (window) => {
  window.webContents.session.flushStorageData();
  await new Promise((resolve) => setTimeout(resolve, 100));
};

const loadNativeStorage = async () => {
  const storageModuleUrl = pathToFileURL(
    path.resolve(__dirname, '..', 'main', 'rendererPersistentStorage.js'),
  ).href;
  const storageModule = await import(storageModuleUrl);
  storageModule.registerRendererPersistentStorageHandlers();
  return storageModule;
};

const runSourceUpgrade = async () => {
  const sourceSeed = await openWindow(sourceOrigin);
  await sourceSeed.webContents.executeJavaScript(`
    localStorage.setItem('lyrics-store', ${JSON.stringify(sourceState)});
    localStorage.setItem('lyricdisplay_activeOutputTab', 'output2');
  `);
  await flushBrowserStorage(sourceSeed);
  sourceSeed.destroy();

  const { flushRendererPersistentStorage } = await loadNativeStorage();
  const sourceWindow = await openWindow(sourceOrigin, { preload: true });
  assert.equal(
    await sourceWindow.webContents.executeJavaScript(
      `window.electronAPI.persistentStorage.getItem('lyrics-store')`,
    ),
    sourceState,
  );
  assert.equal(flushRendererPersistentStorage().success, true);
  sourceWindow.destroy();
};

const runTargetRestart = async () => {
  const targetSeed = await openWindow(targetOrigin);
  await targetSeed.webContents.executeJavaScript(
    `localStorage.setItem('lyrics-store', ${JSON.stringify(targetDefaults)})`,
  );
  await flushBrowserStorage(targetSeed);
  targetSeed.destroy();

  const { flushRendererPersistentStorage } = await loadNativeStorage();
  const targetWindow = await openWindow(targetOrigin, { preload: true });
  assert.equal(
    await targetWindow.webContents.executeJavaScript(`localStorage.getItem('lyrics-store')`),
    sourceState,
  );
  assert.equal(
    await targetWindow.webContents.executeJavaScript(
      `window.electronAPI.persistentStorage.getItem('lyricdisplay_activeOutputTab')`,
    ),
    'output2',
  );

  await targetWindow.webContents.executeJavaScript(
    `window.electronAPI.persistentStorage.setItem('lyrics-store', ${JSON.stringify(updatedState)})`,
  );
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(flushRendererPersistentStorage().success, true);
  targetWindow.destroy();
};

const runSourceReturn = async () => {
  const { flushRendererPersistentStorage } = await loadNativeStorage();
  const returnedWindow = await openWindow(sourceOrigin, { preload: true });
  assert.equal(
    await returnedWindow.webContents.executeJavaScript(`localStorage.getItem('lyrics-store')`),
    updatedState,
  );
  assert.equal(flushRendererPersistentStorage().success, true);
  returnedWindow.destroy();
};

const run = async () => {
  if (phase === 'source-upgrade') {
    await runSourceUpgrade();
  } else if (phase === 'target-restart') {
    await runTargetRestart();
  } else if (phase === 'source-return') {
    await runSourceReturn();
  } else {
    throw new Error(`Unknown renderer storage smoke phase: ${phase}`);
  }
  process.stdout.write(`Renderer storage smoke phase passed: ${phase}.\n`);
};

app.whenReady()
  .then(run)
  .then(() => app.exit(0))
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });

app.on('window-all-closed', (event) => event?.preventDefault?.());
