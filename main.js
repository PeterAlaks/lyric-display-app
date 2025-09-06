import { app, BrowserWindow, Menu, shell, dialog, ipcMain, nativeTheme } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { fork } from 'child_process';
import { writeFile } from 'fs/promises';
import updaterPkg from 'electron-updater';
import os from 'os';
const { autoUpdater } = updaterPkg;

const isDev = !app.isPackaged;
let backendProcess = null;
let progressWindow = null;
let mainWindow = null; // Track main window for menu updates
let qrCodeWindow = null;

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

// Get local IP address
function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();

  for (const interfaceName of Object.keys(interfaces)) {
    const networkInterface = interfaces[interfaceName];

    for (const connection of networkInterface) {
      // Skip internal/loopback addresses
      if (connection.family === 'IPv4' && !connection.internal) {
        return connection.address;
      }
    }
  }

  return 'localhost'; // Fallback
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
      preload: resolveProductionPath('preload.js')
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

// Create QR Code dialog window
function createQRCodeDialog() {
  if (qrCodeWindow) {
    qrCodeWindow.focus();
    return qrCodeWindow;
  }

  qrCodeWindow = new BrowserWindow({
    width: 450,
    height: 550,
    resizable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    center: true,
    show: false,
    frame: true,
    parent: mainWindow, // Make it a child window
    modal: true, // Make it modal
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: resolveProductionPath('preload.js')
    }
  });

  qrCodeWindow.setMenuBarVisibility(false);

  // Load QR Code dialog HTML
  if (isDev) {
    qrCodeWindow.loadURL('http://localhost:5173/qr-dialog');
  } else {
    qrCodeWindow.loadURL('http://localhost:4000/#/qr-dialog');
  }

  qrCodeWindow.once('ready-to-show', () => {
    const localIP = getLocalIPAddress();
    qrCodeWindow.webContents.send('set-local-ip', localIP);
    qrCodeWindow.show();
  });

  qrCodeWindow.on('closed', () => {
    qrCodeWindow = null;
  });

  return qrCodeWindow;
}

// Start backend process
function startBackend() {
  return new Promise((resolve, reject) => {
    const serverPath = resolveProductionPath('server', 'index.js');
    backendProcess = fork(serverPath, [], {
      cwd: path.dirname(serverPath),
      env: { ...process.env, NODE_ENV: isDev ? 'development' : 'production' },
      stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
    });

    let isResolved = false;
    const timeout = setTimeout(() => {
      if (!isResolved) {
        console.log('Backend startup timeout, proceeding anyway...');
        isResolved = true;
        resolve();
      }
    }, 10000); // 10 second timeout

    backendProcess.on('error', (err) => {
      console.error('Backend process error:', err);
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeout);
        reject(err);
      }
    });

    backendProcess.on('exit', (code) => {
      if (code !== 0) {
        console.error('Backend process exited with code', code);
      }
    });

    // Listen for "ready" signal from backend
    backendProcess.on('message', (msg) => {
      if (msg?.status === 'ready' && !isResolved) {
        console.log('✅ Backend reported ready');
        isResolved = true;
        clearTimeout(timeout);
        resolve();
      }
    });

    // Fallback: if no message received in reasonable time, proceed anyway
    setTimeout(() => {
      if (!isResolved) {
        console.log('Backend ready message not received, proceeding...');
        isResolved = true;
        clearTimeout(timeout);
        resolve();
      }
    }, 5000); // 5 second fallback
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
      preload: resolveProductionPath('preload.js')
    },
    show: false, // Keep this false initially
    icon: path.join(__dirname, 'public', 'favicon.ico'),
    backgroundColor: isDev ? '#ffffff' : '#f9fafb', // Light gray background while loading
  });

  // Show window when ready to show, with a small delay to ensure content is loaded
  win.once('ready-to-show', () => {
    setTimeout(() => {
      win.show();
      if (isDev) {
        win.webContents.openDevTools({ mode: 'detach' });
      }
    }, 100); // Small delay to ensure content is ready
  });

  // Handle loading and navigation
  if (isDev) {
    win.loadURL(`http://localhost:5173${route}`);
  } else {
    const hashRoute = route === '/' ? '/' : `#${route}`;

    // Add error handling for production loading
    win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error('Failed to load:', errorCode, errorDescription, validatedURL);

      // Retry loading after a short delay
      setTimeout(() => {
        console.log('Retrying load...');
        win.loadURL(`http://localhost:4000/${hashRoute}`);
      }, 1000);
    });

    win.loadURL(`http://localhost:4000/${hashRoute}`);
  }

  // Set as main window if it's the control panel
  if (route === '/') {
    mainWindow = win;
  }

  return win;
}

// Handle dark mode toggle from menu
function toggleDarkMode() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('toggle-dark-mode');

    // Also update the menu checkbox immediately
    setTimeout(() => {
      updateDarkModeMenu();
    }, 100);
  }
}

// Show QR Code dialog
function showQRCodeDialog() {
  createQRCodeDialog();
}

// Create menu
function createMenu(win) {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Load Lyrics File',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('trigger-file-load');
            }
          },
        },
        {
          label: 'New Lyrics File',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('navigate-to-new-song');
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Connect Mobile Controller',
          click: () => showQRCodeDialog(),
        },
        { type: 'separator' },
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
        {
          label: 'Dark Mode',
          type: 'checkbox',
          checked: false,
          click: toggleDarkMode,
        },
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

  // Update menu checkbox based on current dark mode state
  updateDarkModeMenu();
}

// Update dark mode menu checkbox
function updateDarkModeMenu() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.executeJavaScript(`
      window.electronStore?.getDarkMode?.() || false
    `).then(isDark => {
      // Sync native theme
      nativeTheme.themeSource = isDark ? 'dark' : 'light';

      const menu = Menu.getApplicationMenu();
      if (menu) {
        const viewMenu = menu.items.find(item => item.label === 'View');
        if (viewMenu) {
          const darkModeItem = viewMenu.submenu.items.find(item => item.label === 'Dark Mode');
          if (darkModeItem) {
            darkModeItem.checked = isDark;
          }
        }
      }
    }).catch(err => {
      console.log('Could not get dark mode state:', err);
    });
  }
}

// IPC handlers for dark mode communication
ipcMain.handle('get-dark-mode', () => {
  // This will be handled by the renderer process
  return false;
});

ipcMain.handle('set-dark-mode', (event, isDark) => {
  updateDarkModeMenu();
  return true;
});

// IPC handlers for file operations (New Song Canvas)
ipcMain.handle('show-save-dialog', async (event, options) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, options);
    return result;
  } catch (error) {
    console.error('Error showing save dialog:', error);
    throw error;
  }
});

ipcMain.handle('write-file', async (event, filePath, content) => {
  try {
    await writeFile(filePath, content, 'utf8');
    return { success: true };
  } catch (error) {
    console.error('Error writing file:', error);
    throw error;
  }
});

ipcMain.handle('load-lyrics-file', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Text Files', extensions: ['txt'] }]
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const fs = await import('fs/promises');
      const content = await fs.readFile(result.filePaths[0], 'utf8');
      const fileName = result.filePaths[0].split(/[\\/]/).pop();

      return {
        success: true,
        content,
        fileName
      };
    }

    return { success: false, canceled: true };
  } catch (error) {
    console.error('Error loading lyrics file:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('new-lyrics-file', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('navigate-to-new-song');
  }
});

ipcMain.handle('sync-native-dark-mode', (event, isDark) => {
  try {
    nativeTheme.themeSource = isDark ? 'dark' : 'light';
    return { success: true };
  } catch (error) {
    console.error('Error syncing native dark mode:', error);
    return { success: false, error: error.message };
  }
});

// Add IPC handler for IP address
ipcMain.handle('get-local-ip', () => {
  return getLocalIPAddress();
});

// App lifecycle
app.whenReady().then(async () => {
  try {
    // Start backend and wait for it to be ready
    await startBackend();
    console.log('✅ Backend started successfully');

    // Small additional delay to ensure server is fully listening
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Now create the main window
    const mainWin = createWindow('/');
    createMenu(mainWin);

    // Initialize native theme based on system preference
    nativeTheme.themeSource = 'system';

    // Listen for system theme changes
    nativeTheme.on('updated', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        updateDarkModeMenu();
      }
    });

    // Start update check after everything is ready
    setTimeout(() => {
      if (!isDev) {
        checkForUpdates(false); // silent mode
      }
    }, 2000);

  } catch (error) {
    console.error('Failed to start backend:', error);

    // Create window anyway but with error handling
    const mainWin = createWindow('/');
    createMenu(mainWin);

    dialog.showErrorBox(
      'Startup Error',
      'There was an issue starting the backend server. Some features may not work properly.'
    );
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow('/');
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (qrCodeWindow && !qrCodeWindow.isDestroyed()) {
    qrCodeWindow.close();
  }
  if (backendProcess) {
    backendProcess.kill();
  }
});