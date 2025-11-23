import { dialog, BrowserWindow } from 'electron';
import { requestRendererModal } from './modalBridge.js';
import updaterPkg from 'electron-updater';
import { createProgressWindow, closeProgressWindow, getProgressWindow } from './progressWindow.js';

const { autoUpdater } = updaterPkg;

export function checkForUpdates(showNoUpdateDialog = false) {
  autoUpdater.autoDownload = false;
  autoUpdater.removeAllListeners();

  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    const updateInfo = {
      version: info?.version,
      releaseNotes: info?.releaseNotes,
      releaseName: info?.releaseName,
      releaseDate: info?.releaseDate
    };

    BrowserWindow.getAllWindows().forEach(win => {
      try { win.webContents.send('updater:update-available', updateInfo); } catch { }
    });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('No updates available.');
    if (showNoUpdateDialog) {
      requestRendererModal({
        title: 'Up to date',
        description: "You're running the latest version of LyricDisplay.",
        variant: 'info',
        actions: [
          { label: 'OK', value: { response: 0 } },
        ],
      }, {
        fallback: () => dialog
          .showMessageBox({ type: 'info', buttons: ['OK'], message: "You're running the latest version of LyricDisplay." })
          .then((res) => ({ response: res.response })),
      }).catch(() => {
        dialog.showMessageBox({ type: 'info', buttons: ['OK'], message: "You're running the latest version of LyricDisplay." });
      });
    }
  });

  autoUpdater.on('error', (err) => {
    closeProgressWindow();
    const msg = err == null ? 'Unknown error' : (err.stack || err).toString();
    BrowserWindow.getAllWindows().forEach(win => { try { win.webContents.send('updater:update-error', msg); } catch { } });
  });

  autoUpdater.on('download-progress', (progress) => {
    const msg = `Download speed: ${progress.bytesPerSecond} - Downloaded ${Math.round(progress.percent)}% (${progress.transferred}/${progress.total})`;
    console.log(msg);
    const win = getProgressWindow();
    if (win && !win.isDestroyed()) {
      try { win.webContents.send('progress-update', progress); } catch { }
    }
  });

  autoUpdater.on('update-downloaded', () => {
    closeProgressWindow();
    BrowserWindow.getAllWindows().forEach(win => { try { win.webContents.send('updater:update-downloaded'); } catch { } });
  });

  autoUpdater.checkForUpdates();
}