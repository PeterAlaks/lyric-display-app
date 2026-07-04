import { BrowserWindow, shell } from 'electron';
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
    width: 760,
    height: 440,
    resizable: false,
    minimizable: false,
    maximizable: false,
    closable: true,
    skipTaskbar: true,
    frame: false,
    transparent: true,
    center: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: resolveProductionPath('preload.js')
    }
  });

  const logoPath = path.join(appRoot, 'public', 'logos', 'LyricDisplay logo-white.png');
  const photoPath = path.join(appRoot, 'public', 'images', 'elianna-gill-d5mw4DMHPBI-unsplash.jpg');
  let logoUrl = '';
  let photoUrl = '';
  try {
    const logoBuffer = readFileSync(logoPath);
    const logoBase64 = logoBuffer.toString('base64');
    logoUrl = `data:image/png;base64,${logoBase64}`;
  } catch (error) {
    console.error('[LoadingWindow] Failed to load logo:', error);
    logoUrl = '';
  }
  try {
    const photoBuffer = readFileSync(photoPath);
    const photoBase64 = photoBuffer.toString('base64');
    photoUrl = `data:image/jpeg;base64,${photoBase64}`;
  } catch (error) {
    console.error('[LoadingWindow] Failed to load loading photo:', error);
    photoUrl = '';
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
          width: 760px;
          height: 440px;
          background: transparent;
          -webkit-app-region: drag;
          padding: 16px;
          box-sizing: border-box;
        }
        
        .container {
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #000000 0%, #1F2937 50%, #111827 100%);
          border-radius: 22px;
          display: flex;
          overflow: hidden;
          box-shadow: 0 10px 24px -8px rgba(0, 0, 0, 0.42);
          position: relative;
        }

        .photo-panel {
          width: 48%;
          min-width: 320px;
          height: 100%;
          background: #111827;
          position: relative;
          overflow: hidden;
        }

        .photo-panel img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          object-position: center;
        }

        .photo-panel::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, rgba(0, 0, 0, 0) 72%, rgba(17, 24, 39, 0.18) 100%);
          pointer-events: none;
        }

        .content-panel {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          padding: 42px 40px 28px;
          background: linear-gradient(135deg, #000000 0%, #1F2937 50%, #111827 100%);
        }
        
        .center-content {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          gap: 24px;
          flex: 1;
        }
        
        .logo-group {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
        }
        
        .logo {
          width: 260px;
          height: auto;
          object-fit: contain;
          flex-shrink: 0;
        }
        
        .tagline {
          max-width: 280px;
          font-size: 12px;
          color: #9CA3AF;
          font-weight: 400;
          line-height: 1.5;
        }
        
        .meta-stack {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .bottom-content {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        
        .version-info {
          display: flex;
          flex-direction: column;
          gap: 6px;
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
          letter-spacing: 0.18em;
          text-transform: uppercase;
          font-weight: 500;
          line-height: 1.5;
        }
        
        .status-container {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 6px;
        }
        
        .status-text {
          font-size: 11px;
          color: #D1D5DB;
          text-align: left;
          font-weight: 400;
        }

        .photo-credit {
          color: #6B7280;
          font-size: 10px;
          line-height: 1.5;
          -webkit-app-region: no-drag;
        }

        .photo-credit a {
          color: #A7B3C5;
          text-decoration: none;
          transition: color 140ms ease;
        }

        .photo-credit a:hover,
        .photo-credit a:focus-visible {
          color: #FFFFFF;
          outline: none;
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
        <div class="photo-panel">
          ${photoUrl ? `<img src="${photoUrl}" alt="">` : ''}
        </div>
        <div class="content-panel">
          <div class="center-content">
            <div class="logo-group">
              <img src="${logoUrl}" alt="LyricDisplay Logo" class="logo">
              <div class="tagline">Powering worship experiences worldwide...</div>
            </div>
            
            <div class="meta-stack">
              <div class="status-container">
                <div class="status-text" id="statusText">
                  Initializing<span class="loading-dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>
                </div>
              </div>
            </div>
          </div>
          <div class="bottom-content">
            <div class="version-info">
              <div class="version">v${version}</div>
              <div class="credits">BUILT BY PETER ALAKEMBI AND DAVID OKALIWE</div>
            </div>
            <div class="photo-credit">
              Photo by <a href="https://unsplash.com/@elianna_gill03?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText" target="_blank" rel="noopener noreferrer">Elianna Gill</a> on <a href="https://unsplash.com/?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText" target="_blank" rel="noopener noreferrer">Unsplash</a>
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

  loadingWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      shell.openExternal(url);
    } catch (error) {
      console.error('[LoadingWindow] Failed to open external URL:', url, error);
    }
    return { action: 'deny' };
  });

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
