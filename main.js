import { app, BrowserWindow, Menu, shell, dialog, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { fork } from 'child_process';
import updaterPkg from 'electron-updater';
const { autoUpdater } = updaterPkg;

const isDev = !app.isPackaged;
let backendProcess = null;

// ESM __dirname and __filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to resolve paths for production
function resolveProductionPath(...segments) {
  if (isDev) {
    return path.join(__dirname, ...segments);
  } else {
    // Use asar.unpacked path for files excluded from asar
    return path.join(process.resourcesPath, 'app.asar.unpacked', ...segments);
  }
}

// Start backend process
function startBackend() {
  const serverPath = resolveProductionPath('server', 'index.js');
  backendProcess = fork(serverPath, [], {
    cwd: path.dirname(serverPath),
    env: { ...process.env, NODE_ENV: isDev ? 'development' : 'production' },
    stdio: ['inherit', 'inherit', 'inherit', 'ipc'], // ✅ 'ipc' needed to receive messages
  });

  backendProcess.on('error', (err) => {
    console.error('Backend process error:', err);
  });

  backendProcess.on('exit', (code) => {
    if (code !== 0) {
      console.error('Backend process exited with code', code);
    }
  });

  // ✅ Listen for "ready" signal from backend
  backendProcess.on('message', (msg) => {
    if (msg?.status === 'ready') {
      console.log('✅ Backend reported ready, starting update check...');
      checkForUpdates(false); // silent mode
    }
  });
}

// Auto-updater setup
function checkForUpdates(showNoUpdateDialog = false) {
  autoUpdater.autoDownload = false;

  autoUpdater.removeAllListeners();

  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox({
      type: 'info',
      buttons: ['Download', 'Later'],
      defaultId: 0,
      message: `Version ${info.version} is available. Do you want to download it now?`,
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.downloadUpdate();
      }
    });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('No updates available.');
    if (showNoUpdateDialog) {
      dialog.showMessageBox({
        type: 'info',
        buttons: ['OK'],
        message: "You're running the latest version of LyricDisplay.",
      });
    }
  });

  autoUpdater.on('error', (err) => {
    dialog.showErrorBox('Update Error', err == null ? 'Unknown error' : (err.stack || err).toString());
  });

  autoUpdater.on('download-progress', (progress) => {
    const log_message = `Download speed: ${progress.bytesPerSecond} - Downloaded ${Math.round(progress.percent)}% (${progress.transferred}/${progress.total})`;
    console.log(log_message);
    dialog.showMessageBox({
      type: 'info',
      message: `Downloading update... ${Math.round(progress.percent)}%`,
    });
  });

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
      type: 'info',
      buttons: ['Install and Restart', 'Later'],
      defaultId: 0,
      message: 'Update downloaded. Do you want to install it now?',
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.checkForUpdates();
}

// Create window
function createWindow(route = '/') {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
    icon: path.join(__dirname, 'public', 'favicon.ico'),
  });

  win.once('ready-to-show', () => win.show());

  if (isDev) {
    win.loadURL(`http://localhost:5173${route}`);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    const hashRoute = route === '/' ? '/' : `#${route}`;
    win.loadURL(`http://localhost:4000/${hashRoute}`);
  }

  return win;
}

// Create menu
function createMenu(mainWindow) {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Preview Output 1',
          accelerator: 'CmdOrCtrl+1',
          click: () => createWindow('/output1'),
        },
        {
          label: 'Preview Output 2',
          accelerator: 'CmdOrCtrl+2',
          click: () => createWindow('/output2'),
        },
        { type: 'separator' },
        {
          label: 'Open Project Folder',
          accelerator: 'CmdOrCtrl+O',
          click: () => shell.openPath(__dirname),
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggledevtools' },
        { type: 'separator' },
        { role: 'resetzoom' },
        { role: 'zoomin' },
        { role: 'zoomout' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: async () => {
            await shell.openExternal('https://github.com/PeterAlaks/lyric-display-app#readme');
          },
        },
        {
          label: 'GitHub Repository',
          click: async () => {
            await shell.openExternal('https://github.com/PeterAlaks/lyric-display-updates');
          },
        },
        { type: 'separator' },
        {
          label: 'More About Author',
          click: async () => {
            await shell.openExternal('https://linktr.ee/peteralaks');
          },
        },
        {
          label: 'About App',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              buttons: ['OK', 'Check for Updates'],
              title: 'About LyricDisplay',
              message: `LyricDisplay\nVersion ${app.getVersion()}\nBy Peter Alakembi`,
            }).then((result) => {
              if (result.response === 1) {
                checkForUpdates(true);
              }
            });
          },
        },
        {
          label: 'Check for Updates',
          click: () => checkForUpdates(true),
        },
      ],
    },
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App lifecycle
app.whenReady().then(() => {
  startBackend();
  const mainWindow = createWindow('/');
  createMenu(mainWindow);

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow('/');
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});
