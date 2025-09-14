import { dialog, BrowserWindow } from 'electron';
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
    // Notify renderer to show toast with actions
    BrowserWindow.getAllWindows().forEach(win => {
      try { win.webContents.send('updater:update-available', { version: info?.version }); } catch {}
    });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('No updates available.');
    if (showNoUpdateDialog) {
      dialog.showMessageBox({ type: 'info', buttons: ['OK'], message: "You're running the latest version of LyricDisplay." });
    }
  });

  autoUpdater.on('error', (err) => {
    closeProgressWindow();
    const msg = err == null ? 'Unknown error' : (err.stack || err).toString();
    BrowserWindow.getAllWindows().forEach(win => { try { win.webContents.send('updater:update-error', msg); } catch {} });
  });

  autoUpdater.on('download-progress', (progress) => {
    const msg = `Download speed: ${progress.bytesPerSecond} - Downloaded ${Math.round(progress.percent)}% (${progress.transferred}/${progress.total})`;
    console.log(msg);
    const win = getProgressWindow();
    if (win && !win.isDestroyed()) {
      try { win.webContents.send('progress-update', progress); } catch {}
    }
  });

  autoUpdater.on('update-downloaded', () => {
    closeProgressWindow();
    BrowserWindow.getAllWindows().forEach(win => { try { win.webContents.send('updater:update-downloaded'); } catch {} });
  });

  autoUpdater.checkForUpdates();
}
