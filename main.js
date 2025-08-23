import { app, BrowserWindow, Menu, shell, dialog, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { fork } from 'child_process';
import updaterPkg from 'electron-updater';
const { autoUpdater } = updaterPkg;

const isDev = !app.isPackaged;
let backendProcess = null;
let progressWindow = null;

// Only add compatibility flags for older systems in production
// and only if we detect it's needed
if (!isDev && process.env.FORCE_COMPATIBILITY) {
  app.commandLine.appendSwitch('--disable-gpu-sandbox');
  app.commandLine.appendSwitch('--disable-software-rasterizer');
  app.commandLine.appendSwitch('--disable-features', 'VizDisplayCompositor');
}

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

// Create progress window
function createProgressWindow() {
  if (progressWindow) return progressWindow;

  progressWindow = new BrowserWindow({
    width: 400,
    height: 200,
    resizable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    center: true,
    show: false,
    frame: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: resolveProductionPath('progress-preload.js')
    }
  });

  progressWindow.setMenuBarVisibility(false);
  
  // Load progress HTML
  const progressHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Downloading Update</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
          margin: 0;
          padding: 20px;
          background: #f5f5f5;
          display: flex;
          flex-direction: column;
          justify-content: center;
          height: 160px;
          box-sizing: border-box;
        }
        .container {
          text-align: center;
        }
        .title {
          font-size: 16px;
          margin-bottom: 15px;
          color: #333;
        }
        .progress-container {
          background: #e0e0e0;
          border-radius: 10px;
          height: 20px;
          margin: 15px 0;
          overflow: hidden;
          position: relative;
        }
        .progress-bar {
          background: linear-gradient(90deg, #4CAF50, #45a049);
          height: 100%;
          width: 0%;
          transition: width 0.3s ease;
          border-radius: 10px;
        }
        .progress-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 12px;
          font-weight: bold;
          color: #333;
        }
        .details {
          font-size: 12px;
          color: #666;
          margin-top: 10px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="title">Downloading Update...</div>
        <div class="progress-container">
          <div class="progress-bar" id="progressBar"></div>
          <div class="progress-text" id="progressText">0%</div>
        </div>
        <div class="details" id="details">Preparing download...</div>
      </div>
      <script>
        console.log('Progress window script loaded');
        
        // Wait for DOM and electronAPI to be ready
        window.addEventListener('DOMContentLoaded', () => {
          console.log('DOM loaded, setting up progress listener');
          
          if (window.electronAPI && window.electronAPI.onProgressUpdate) {
            window.electronAPI.onProgressUpdate((progress) => {
              console.log('Progress received in renderer:', progress);
              
              const progressBar = document.getElementById('progressBar');
              const progressText = document.getElementById('progressText');
              const details = document.getElementById('details');
              
              if (progressBar && progressText && details) {
                const percent = Math.round(progress.percent);
                progressBar.style.width = percent + '%';
                progressText.textContent = percent + '%';
                
                const speed = (progress.bytesPerSecond / 1024 / 1024).toFixed(1);
                const transferred = (progress.transferred / 1024 / 1024).toFixed(1);
                const total = (progress.total / 1024 / 1024).toFixed(1);
                
                details.textContent = \`\${speed} MB/s - \${transferred} MB / \${total} MB\`;
                console.log('UI updated to:', percent + '%');
              } else {
                console.error('Progress elements not found');
              }
            });
          } else {
            console.error('electronAPI not available');
          }
        });
      </script>
    </body>
    </html>
  `;

  progressWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(progressHTML)}`);
  
  progressWindow.on('closed', () => {
    progressWindow = null;
  });

  return progressWindow;
}

// Close progress window
function closeProgressWindow() {
  if (progressWindow && !progressWindow.isDestroyed()) {
    progressWindow.close();
  }
  progressWindow = null;
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
        // Create and show progress window before starting download
        createProgressWindow().show();
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
    // Close progress window on error
    closeProgressWindow();
    
    dialog.showErrorBox('Update Error', err == null ? 'Unknown error' : (err.stack || err).toString());
  });

  autoUpdater.on('download-progress', (progress) => {
    const log_message = `Download speed: ${progress.bytesPerSecond} - Downloaded ${Math.round(progress.percent)}% (${progress.transferred}/${progress.total})`;
    console.log(log_message);
    
    // Update progress window if it exists - with debug logging
    if (progressWindow && !progressWindow.isDestroyed()) {
      console.log('Sending progress to window:', Math.round(progress.percent) + '%');
      progressWindow.webContents.send('progress-update', progress);
    } else {
      console.log('Progress window not available');
    }
  });

  autoUpdater.on('update-downloaded', () => {
    // Close progress window
    closeProgressWindow();
    
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