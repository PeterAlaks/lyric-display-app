import { dialog } from 'electron';
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
    dialog.showMessageBox({
      type: 'info',
      buttons: ['Download', 'Later'],
      defaultId: 0,
      message: `Version ${info.version} is available. Do you want to download it now?`,
    }).then((result) => {
      if (result.response === 0) {
        createProgressWindow().show();
        autoUpdater.downloadUpdate();
      }
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
    dialog.showErrorBox('Update Error', err == null ? 'Unknown error' : (err.stack || err).toString());
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
    dialog.showMessageBox({ type: 'info', buttons: ['Install and Restart', 'Later'], defaultId: 0, message: 'Update downloaded. Do you want to install it now?' }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.checkForUpdates();
}

