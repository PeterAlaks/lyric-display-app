import { BrowserWindow } from 'electron';
import { isDev, resolveProductionPath } from './paths.js';
import { getLocalIPAddress } from './utils.js';

let qrCodeWindow = null;

export function createQRCodeDialog(parent) {
  if (qrCodeWindow) {
    try { qrCodeWindow.focus(); } catch {}
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
    parent,
    modal: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: resolveProductionPath('preload.js')
    }
  });

  qrCodeWindow.setMenuBarVisibility(false);

  if (isDev) {
    qrCodeWindow.loadURL('http://localhost:5173/qr-dialog');
  } else {
    qrCodeWindow.loadURL('http://localhost:4000/#/qr-dialog');
  }

  qrCodeWindow.once('ready-to-show', () => {
    const localIP = getLocalIPAddress();
    try { qrCodeWindow.webContents.send('set-local-ip', localIP); } catch {}
    try { qrCodeWindow.show(); } catch {}
  });

  qrCodeWindow.on('closed', () => { qrCodeWindow = null; });
  return qrCodeWindow;
}

export function closeQRCodeDialog() {
  if (qrCodeWindow && !qrCodeWindow.isDestroyed()) {
    try { qrCodeWindow.close(); } catch {}
  }
  qrCodeWindow = null;
}

