import { BrowserWindow } from 'electron';
import { resolveProductionPath } from './paths.js';

let progressWindow = null;

export function createProgressWindow({ parent } = {}) {
  if (progressWindow) {
    if (parent && !progressWindow.isDestroyed()) {
      try { progressWindow.setParentWindow(parent); } catch {}
    }
    return progressWindow;
  }

  progressWindow = new BrowserWindow({
    width: 400,
    height: 200,
    resizable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    parent: parent ?? undefined,
    modal: false,
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

  const progressHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Downloading Update</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; display: flex; flex-direction: column; justify-content: center; height: 160px; box-sizing: border-box; }
        .container { text-align: center; }
        .title { font-size: 16px; margin-bottom: 15px; color: #333; }
        .progress-container { background: #e0e0e0; border-radius: 10px; height: 20px; margin: 15px 0; overflow: hidden; position: relative; }
        .progress-bar { background: linear-gradient(90deg, #4CAF50, #45a049); height: 100%; width: 0%; transition: width 0.3s ease; border-radius: 10px; }
        .progress-text { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 12px; font-weight: bold; color: #333; }
        .details { font-size: 12px; color: #666; margin-top: 10px; }
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
        window.addEventListener('DOMContentLoaded', () => {
          if (window.electronAPI && window.electronAPI.onProgressUpdate) {
            window.electronAPI.onProgressUpdate((progress) => {
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
                details.textContent = speed + ' MB/s - ' + transferred + ' MB / ' + total + ' MB';
              }
            });
          }
        });
      </script>
    </body>
    </html>
  `;

  progressWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(progressHTML));

  progressWindow.on('closed', () => { progressWindow = null; });
  return progressWindow;
}

export function closeProgressWindow() {
  if (progressWindow && !progressWindow.isDestroyed()) {
    progressWindow.close();
  }
  progressWindow = null;
}

export function getProgressWindow() {
  return progressWindow;
}
