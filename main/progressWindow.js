import { BrowserWindow } from 'electron';
import { resolveProductionPath } from './paths.js';

let progressWindow = null;
let lastState = null;

const safeJSONStringify = (value) => JSON.stringify(value ?? {}).replace(/</g, '\\u003c');

const getProgressHTML = ({ initialState = null } = {}) => `
  <!DOCTYPE html>
  <html>
  <head>
    <title>LyricDisplay Update</title>
    <meta charset="utf-8">
    <style>
      :root {
        color-scheme: light dark;
        --bg: #f8fafc;
        --text: #111827;
        --muted: #475569;
        --border: #d1d5db;
        --track: #e5e7eb;
        --accent: #2563eb;
        --accent-ring: rgba(37, 99, 235, 0.14);
        --success: #059669;
        --error: #dc2626;
      }

      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #111827;
          --text: #f9fafb;
          --muted: #cbd5e1;
          --border: #374151;
          --track: #374151;
          --accent: #60a5fa;
          --accent-ring: rgba(96, 165, 250, 0.18);
          --success: #34d399;
          --error: #f87171;
        }
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        height: 100vh;
        background: var(--bg);
        color: var(--text);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
        overflow: hidden;
      }

      .shell {
        height: 100vh;
        padding: 34px 38px 30px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }

      .header {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        min-width: 0;
      }

      .status-dot {
        width: 14px;
        height: 14px;
        border-radius: 999px;
        background: var(--accent);
        margin-top: 8px;
        flex: 0 0 auto;
        box-shadow: 0 0 0 5px var(--accent-ring);
      }

      .status-dot.error { background: var(--error); }
      .status-dot.success { background: var(--success); }

      h1 {
        font-size: 24px;
        line-height: 1.3;
        margin: 0;
        font-weight: 700;
        letter-spacing: 0;
      }

      .subtitle {
        color: var(--muted);
        font-size: 14px;
        line-height: 1.45;
        margin-top: 6px;
        overflow-wrap: anywhere;
      }

      .progress-block {
        margin-top: 34px;
      }

      .progress-container {
        background: var(--track);
        border-radius: 999px;
        height: 24px;
        overflow: hidden;
        position: relative;
        width: 100%;
      }

      .progress-bar {
        background: var(--accent);
        height: 100%;
        width: 0%;
        transition: width 0.25s ease, background-color 0.2s ease;
      }

      .progress-bar.success { background: var(--success); }
      .progress-bar.error { background: var(--error); }

      .details {
        min-height: 46px;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.5;
        margin-top: 14px;
        overflow-wrap: anywhere;
      }

      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 28px;
      }

      button {
        border: 1px solid var(--border);
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 650;
        min-width: 104px;
        padding: 10px 14px;
        background: transparent;
        color: var(--text);
      }

      button.primary {
        background: var(--accent);
        border-color: var(--accent);
        color: #ffffff;
      }

      button.success {
        background: var(--success);
        border-color: var(--success);
        color: #ffffff;
      }

      button:disabled {
        cursor: default;
        opacity: 0.55;
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <main role="status" aria-live="polite">
        <div class="header">
          <div class="status-dot" id="statusDot"></div>
          <div>
            <h1 id="title">Preparing update</h1>
            <div class="subtitle" id="subtitle">LyricDisplay is preparing the download.</div>
          </div>
        </div>

        <div class="progress-block">
          <div class="progress-container">
            <div class="progress-bar" id="progressBar"></div>
          </div>
          <div class="details" id="details">Waiting for download progress...</div>
        </div>

        <div class="actions">
          <button type="button" id="hideBtn">Hide</button>
          <button type="button" id="retryBtn" class="primary" hidden>Retry</button>
          <button type="button" id="installBtn" class="success" hidden>Install</button>
        </div>
      </main>
    </div>

    <script>
      const INITIAL_STATE = ${safeJSONStringify(initialState)};
      const els = {
        statusDot: document.getElementById('statusDot'),
        title: document.getElementById('title'),
        subtitle: document.getElementById('subtitle'),
        progressBar: document.getElementById('progressBar'),
        details: document.getElementById('details'),
        hideBtn: document.getElementById('hideBtn'),
        retryBtn: document.getElementById('retryBtn'),
        installBtn: document.getElementById('installBtn')
      };

      const formatBytes = (bytes) => {
        const value = Number(bytes) || 0;
        if (value <= 0) return '0 MB';
        return (value / 1024 / 1024).toFixed(1) + ' MB';
      };

      const formatSpeed = (bytesPerSecond) => {
        const value = Number(bytesPerSecond) || 0;
        if (value <= 0) return 'Calculating speed';
        return (value / 1024 / 1024).toFixed(1) + ' MB/s';
      };

      const versionLabel = (state) => {
        const version = state && state.updateInfo && state.updateInfo.version;
        return version ? 'LyricDisplay v' + version : 'LyricDisplay update';
      };

      const setProgress = (percent, tone) => {
        const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
        els.progressBar.style.width = safePercent + '%';
        els.progressBar.className = 'progress-bar' + (tone ? ' ' + tone : '');
      };

      const setTone = (tone) => {
        els.statusDot.className = 'status-dot' + (tone ? ' ' + tone : '');
      };

      const renderState = (state = {}) => {
        const status = state.status || 'idle';
        const progress = state.progress || {};
        const percent = Math.round(Math.max(0, Math.min(100, Number(progress.percent) || 0)));
        const updateName = versionLabel(state);

        els.retryBtn.hidden = true;
        els.installBtn.hidden = true;
        els.hideBtn.disabled = false;
        setTone('');

        if (status === 'downloading') {
          els.title.textContent = 'Downloading update';
          els.subtitle.textContent = updateName;
          setProgress(percent);
          const total = Number(progress.total) || 0;
          const transferred = Number(progress.transferred) || 0;
          const sizeText = total > 0
            ? formatBytes(transferred) + ' of ' + formatBytes(total)
            : formatBytes(transferred) + ' downloaded';
          els.details.textContent = percent + '% complete - ' + formatSpeed(progress.bytesPerSecond) + ' - ' + sizeText;
          return;
        }

        if (status === 'downloaded') {
          els.title.textContent = 'Update ready to install';
          els.subtitle.textContent = updateName + ' has finished downloading.';
          setTone('success');
          setProgress(100, 'success');
          els.details.textContent = 'Install when you are ready to restart LyricDisplay.';
          els.installBtn.hidden = false;
          return;
        }

        if (status === 'installing') {
          els.title.textContent = 'Restarting to install';
          els.subtitle.textContent = updateName;
          setTone('success');
          setProgress(100, 'success');
          els.details.textContent = 'LyricDisplay is closing and installing the update.';
          els.hideBtn.disabled = true;
          return;
        }

        if (status === 'error') {
          const message = state.error && state.error.message ? state.error.message : 'The update could not be downloaded.';
          els.title.textContent = 'Update download failed';
          els.subtitle.textContent = updateName;
          setTone('error');
          setProgress(percent, 'error');
          els.details.textContent = message;
          els.retryBtn.hidden = false;
          return;
        }

        els.title.textContent = 'Preparing update';
        els.subtitle.textContent = updateName;
        setProgress(percent);
        els.details.textContent = 'Waiting for download progress...';
      };

      window.addEventListener('DOMContentLoaded', () => {
        if (!window.electronAPI) return;

        renderState(INITIAL_STATE);

        window.electronAPI.onUpdaterState?.(renderState);

        window.electronAPI.getUpdaterState?.().then((result) => {
          renderState(result && result.state ? result.state : {});
        }).catch(() => {});

        els.hideBtn.addEventListener('click', () => {
          window.electronAPI.hideUpdateProgressWindow?.();
        });

        els.retryBtn.addEventListener('click', async () => {
          els.retryBtn.disabled = true;
          try {
            await window.electronAPI.requestUpdateDownload?.();
          } finally {
            els.retryBtn.disabled = false;
          }
        });

        els.installBtn.addEventListener('click', async () => {
          els.installBtn.disabled = true;
          try {
            await window.electronAPI.requestInstallAndRestart?.();
          } finally {
            els.installBtn.disabled = false;
          }
        });
      });
    </script>
  </body>
  </html>
`;

const getProgressWindowState = (state) => {
  const source = state || {};
  return {
    status: source.status || 'idle',
    updateInfo: source.updateInfo
      ? {
        version: source.updateInfo.version ?? null,
        releaseName: source.updateInfo.releaseName ?? null,
        releaseDate: source.updateInfo.releaseDate ?? null
      }
      : null,
    progress: source.progress ? { ...source.progress } : null,
    error: source.error
      ? {
        message: source.error.message || 'Unknown error',
        phase: source.error.phase || source.status || 'update',
        retryable: Boolean(source.error.retryable)
      }
      : null,
    downloadedAt: source.downloadedAt ?? null
  };
};

export function createProgressWindow({ parent, initialState } = {}) {
  lastState = getProgressWindowState(initialState || lastState);

  if (progressWindow && !progressWindow.isDestroyed()) {
    if (parent) {
      try { progressWindow.setParentWindow(parent); } catch { }
    }
    updateProgressWindowState(lastState);
    return progressWindow;
  }

  progressWindow = new BrowserWindow({
    width: 640,
    height: 360,
    resizable: false,
    minimizable: true,
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

  progressWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(getProgressHTML({
    initialState: lastState
  })));

  progressWindow.webContents.once('did-finish-load', () => {
    updateProgressWindowState(lastState);
  });

  progressWindow.on('close', (event) => {
    if (lastState?.status === 'downloading') {
      event.preventDefault();
      progressWindow.hide();
    }
  });

  progressWindow.on('closed', () => {
    progressWindow = null;
  });

  return progressWindow;
}

export function hideProgressWindow() {
  if (progressWindow && !progressWindow.isDestroyed()) {
    progressWindow.hide();
  }
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

export function updateProgressWindowState(nextState) {
  lastState = getProgressWindowState(nextState || lastState);
  if (!progressWindow || progressWindow.isDestroyed() || !lastState) return;

  try {
    progressWindow.webContents.send('updater:state-changed', lastState);
  } catch {
  }
}
