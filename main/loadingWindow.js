import { BrowserWindow } from 'electron';
import path from 'path';
import { resolveProductionPath, appRoot } from './paths.js';
import { readFileSync } from 'fs';

let loadingWindow = null;

function getAppVersion() {
  try {
    const packagePath = path.join(appRoot, 'package.json');
    const packageData = JSON.parse(readFileSync(packagePath, 'utf8'));
    return packageData.version || '5.7.0';
  } catch (error) {
    console.error('[LoadingWindow] Failed to read version:', error);
    return '5.7.0';
  }
}

export function createLoadingWindow() {
  if (loadingWindow && !loadingWindow.isDestroyed()) {
    return loadingWindow;
  }

  const version = getAppVersion();

  loadingWindow = new BrowserWindow({
    width: 600,
    height: 315,
    resizable: false,
    minimizable: false,
    maximizable: false,
    closable: true,
    skipTaskbar: true,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    center: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: resolveProductionPath('preload.js')
    }
  });

  const logoPath = path.join(appRoot, 'public', 'logos', 'LyricDisplay logo-white.png');
  let logoUrl = '';
  try {
    const logoBuffer = readFileSync(logoPath);
    const logoBase64 = logoBuffer.toString('base64');
    logoUrl = `data:image/png;base64,${logoBase64}`;
  } catch (error) {
    console.error('[LoadingWindow] Failed to load logo:', error);
    logoUrl = '';
  }

  const loadingHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Loading LyricDisplay</title>
      <style>
        @font-face {
          font-family: 'Space Grotesk';
          src: url('file:///${path.join(appRoot, 'src', 'assets', 'fonts', 'Space_Grotesk', 'SpaceGrotesk-VariableFont_wght.ttf').replace(/\\/g, '/')}') format('truetype');
          font-weight: 300 700;
          font-style: normal;
        }
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          overflow: hidden;
          width: 600px;
          height: 315px;
          background: transparent;
          -webkit-app-region: drag;
        }
        
        .container {
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #000000 0%, #1F2937 50%, #111827 100%);
          border-radius: 20px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 35px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          position: relative;
        }
        
        .center-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        
        .logo-group {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 6px;
        }
        
        .logo {
          width: 350px;
          height: auto;
          object-fit: contain;
          flex-shrink: 0;
        }
        
        .tagline {
          font-size: 12px;
          color: #9CA3AF;
          font-weight: 400;
          line-height: 1.4;
        }
        
        .footer {
          position: absolute;
          bottom: 30px;
          left: 35px;
          right: 35px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }
        
        .version-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .version {
          font-size: 12px;
          font-weight: 400;
          color: #ffffff;
          letter-spacing: 0.5px;
        }
        
        .credits {
          font-size: 9px;
          color: #6B7280;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          font-weight: 500;
        }
        
        .status-container {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 6px;
        }
        
        .status-text {
          font-size: 11px;
          color: #D1D5DB;
          text-align: right;
          font-weight: 400;
        }
        
        .loading-dots {
          display: inline-flex;
          gap: 4px;
          margin-left: 4px;
        }
        
        .dot {
          width: 4px;
          height: 4px;
          background: #D1D5DB;
          border-radius: 50%;
          animation: pulse 1.4s ease-in-out infinite;
        }
        
        .dot:nth-child(2) {
          animation-delay: 0.2s;
        }
        
        .dot:nth-child(3) {
          animation-delay: 0.4s;
        }
        
        @keyframes pulse {
          0%, 80%, 100% {
            opacity: 0.3;
            transform: scale(0.8);
          }
          40% {
            opacity: 1;
            transform: scale(1);
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="center-content">
          <div class="logo-group">
            <img src="${logoUrl}" alt="LyricDisplay Logo" class="logo">
            <div class="tagline">Powering worship experiences worldwide...</div>
          </div>
        </div>
        
        <div class="footer">
          <div class="version-info">
            <div class="version">v${version}</div>
            <div class="credits">BUILT BY PETER ALAKEMBI AND DAVID OKALIWE</div>
          </div>
          
          <div class="status-container">
            <div class="status-text" id="statusText">
              Initializing<span class="loading-dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>
            </div>
          </div>
        </div>
      </div>
      
      <script>
        window.addEventListener('DOMContentLoaded', () => {
          if (window.electronAPI && window.electronAPI.onLoadingStatus) {
            window.electronAPI.onLoadingStatus((status) => {
              const statusText = document.getElementById('statusText');
              if (statusText) {
                statusText.innerHTML = status + '<span class="loading-dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>';
              }
            });
          }
        });
      </script>
    </body>
    </html>
  `;

  loadingWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(loadingHTML));

  loadingWindow.once('ready-to-show', () => {
    if (loadingWindow && !loadingWindow.isDestroyed()) {
      loadingWindow.show();
    }
  });

  loadingWindow.on('closed', () => {
    loadingWindow = null;
  });

  return loadingWindow;
}

/**
 * @param {string} status - The status message to display
 */
export function updateLoadingStatus(status) {
  if (loadingWindow && !loadingWindow.isDestroyed()) {
    loadingWindow.webContents.send('loading-status', status);
  }
}

export function closeLoadingWindow() {
  if (loadingWindow && !loadingWindow.isDestroyed()) {
    const fadeSteps = 10;
    const fadeInterval = 30;
    let currentOpacity = 1.0;

    const fadeOut = setInterval(() => {
      currentOpacity -= 0.1;
      if (currentOpacity <= 0 || loadingWindow.isDestroyed()) {
        clearInterval(fadeOut);
        if (loadingWindow && !loadingWindow.isDestroyed()) {
          loadingWindow.close();
        }
        loadingWindow = null;
      } else {
        try {
          loadingWindow.setOpacity(currentOpacity);
        } catch (error) {
          clearInterval(fadeOut);
          if (loadingWindow && !loadingWindow.isDestroyed()) {
            loadingWindow.close();
          }
          loadingWindow = null;
        }
      }
    }, fadeInterval);
  }
}

export function getLoadingWindow() {
  return loadingWindow;
}