import { app, BrowserWindow, nativeTheme } from 'electron';
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
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      :root {
        color-scheme: light dark;
        --surface: #ffffff;
        --surface-muted: #f8fafc;
        --text: #111827;
        --muted: #64748b;
        --subtle: #94a3b8;
        --border: rgba(15, 23, 42, 0.08);
        --track: #e5e7eb;
        --accent: #3b82f6;
        --accent-end: #9333ea;
        --accent-soft: rgba(59, 130, 246, 0.10);
        --success: #10b981;
        --success-soft: rgba(16, 185, 129, 0.11);
        --error: #f43f5e;
        --error-soft: rgba(244, 63, 94, 0.10);
      }

      @media (prefers-color-scheme: dark) {
        :root {
          --surface: #1f2937;
          --surface-muted: #26303d;
          --text: #f9fafb;
          --muted: #cbd5e1;
          --subtle: #94a3b8;
          --border: rgba(255, 255, 255, 0.07);
          --track: #374151;
          --accent: #60a5fa;
          --accent-end: #a855f7;
          --accent-soft: rgba(96, 165, 250, 0.13);
          --success: #34d399;
          --success-soft: rgba(52, 211, 153, 0.12);
          --error: #fb7185;
          --error-soft: rgba(251, 113, 133, 0.12);
        }
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        height: 100vh;
        background: var(--surface);
        color: var(--text);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
        overflow: hidden;
      }

      .shell {
        height: 100vh;
      }

      .panel {
        position: relative;
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        background: var(--surface);
      }

      .header {
        display: flex;
        align-items: center;
        gap: 16px;
        min-width: 0;
      }

      .state-icon {
        width: 46px;
        height: 46px;
        display: grid;
        place-items: center;
        flex: 0 0 auto;
        border-radius: 15px;
        corner-shape: squircle;
        background: var(--accent-soft);
        color: var(--accent);
      }

      .state-icon[data-tone="success"] {
        background: var(--success-soft);
        color: var(--success);
      }

      .state-icon[data-tone="error"] {
        background: var(--error-soft);
        color: var(--error);
      }

      .state-icon svg {
        display: none;
        width: 22px;
        height: 22px;
        stroke: currentColor;
      }

      .state-icon[data-tone="active"] .icon-download,
      .state-icon[data-tone="success"] .icon-success,
      .state-icon[data-tone="error"] .icon-error {
        display: block;
      }

      h1 {
        margin: 0;
        font-size: 21px;
        font-weight: 720;
        line-height: 1.25;
        letter-spacing: -0.02em;
      }

      .subtitle {
        margin-top: 4px;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.45;
        overflow-wrap: anywhere;
      }

      .content {
        flex: 1 1 auto;
        min-height: 0;
        padding: 20px 22px 16px;
      }

      .progress-block { margin-top: 18px; }

      .progress-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 8px;
      }

      .progress-label {
        color: var(--subtle);
        font-size: 9px;
        font-weight: 750;
        letter-spacing: 0.09em;
        text-transform: uppercase;
      }

      .progress-percent {
        color: var(--muted);
        font-size: 11px;
        font-weight: 750;
        font-variant-numeric: tabular-nums;
      }

      .progress-container {
        position: relative;
        width: 100%;
        height: 8px;
        overflow: hidden;
        border-radius: 999px;
        background: var(--track);
      }

      .progress-bar {
        position: relative;
        width: 0%;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #60a5fa, var(--accent-end));
        transition: width 0.3s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.2s ease;
      }

      .progress-bar.active::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.42), transparent);
        transform: translateX(-100%);
        animation: progress-sheen 1.8s ease-in-out infinite;
      }

      .progress-bar.success { background: var(--success); }
      .progress-bar.error { background: var(--error); }

      .details {
        display: flex;
        align-items: center;
        min-height: 40px;
        margin-top: 13px;
        padding: 10px 12px;
        border: 1px solid var(--border);
        border-radius: 13px;
        background: var(--surface-muted);
        color: var(--muted);
        font-size: 11px;
        line-height: 1.45;
        overflow-wrap: anywhere;
      }

      .footer {
        display: flex;
        align-items: center;
        gap: 16px;
        min-height: 60px;
        padding: 11px 22px;
        border-top: 1px solid var(--border);
        background: var(--surface-muted);
      }

      .footer-hint {
        min-width: 0;
        margin: 0;
        color: var(--subtle);
        font-size: 10px;
        line-height: 1.4;
      }

      .actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
        margin-left: auto;
        flex: 0 0 auto;
      }

      button {
        min-width: 78px;
        padding: 8px 14px;
        border: 1px solid var(--border);
        border-radius: 999px;
        background: var(--surface);
        color: var(--text);
        cursor: pointer;
        font-family: inherit;
        font-size: 11px;
        font-weight: 700;
        transition: border-color 0.16s ease, background-color 0.16s ease, transform 0.16s ease;
      }

      button:hover:not(:disabled) {
        border-color: color-mix(in srgb, var(--muted) 40%, transparent);
        transform: translateY(-1px);
      }

      button:focus-visible {
        outline: 3px solid var(--accent-soft);
        outline-offset: 2px;
      }

      button.primary {
        border-color: transparent;
        background: linear-gradient(90deg, #60a5fa, var(--accent-end));
        color: #ffffff;
      }

      button.success {
        border-color: var(--success);
        background: var(--success);
        color: #ffffff;
      }

      button:disabled {
        cursor: default;
        opacity: 0.55;
      }

      @keyframes progress-sheen {
        55%, 100% { transform: translateX(100%); }
      }

      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation: none !important;
          transition: none !important;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <main class="panel">
        <section class="content" role="status" aria-live="polite">
          <div class="header">
            <div class="state-icon" id="stateIcon" data-tone="active" aria-hidden="true">
              <svg class="icon-download" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path>
              </svg>
              <svg class="icon-success" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m5 12 4 4L19 6"></path>
              </svg>
              <svg class="icon-error" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 8v5"></path><path d="M12 17h.01"></path><path d="M10.3 3.7 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z"></path>
              </svg>
            </div>
            <div>
              <h1 id="title">Preparing update</h1>
              <div class="subtitle" id="subtitle">LyricDisplay is preparing the download.</div>
            </div>
          </div>

          <div class="progress-block">
            <div class="progress-meta">
              <span class="progress-label">Download progress</span>
              <span class="progress-percent" id="progressPercent">0%</span>
            </div>
            <div class="progress-container" id="progressTrack" role="progressbar" aria-label="Update download progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
              <div class="progress-bar" id="progressBar"></div>
            </div>
            <div class="details" id="details">Waiting for download progress…</div>
          </div>
        </section>

        <footer class="footer">
          <p class="footer-hint" id="footerHint">You can keep using LyricDisplay while the update downloads.</p>
          <div class="actions">
            <button type="button" id="hideBtn">Hide</button>
            <button type="button" id="retryBtn" class="primary" hidden>Try again</button>
            <button type="button" id="installBtn" class="success" hidden>Install &amp; restart</button>
          </div>
        </footer>
      </main>
    </div>

    <script>
      const INITIAL_STATE = ${safeJSONStringify(initialState)};
      const els = {
        stateIcon: document.getElementById('stateIcon'),
        title: document.getElementById('title'),
        subtitle: document.getElementById('subtitle'),
        progressTrack: document.getElementById('progressTrack'),
        progressBar: document.getElementById('progressBar'),
        progressPercent: document.getElementById('progressPercent'),
        details: document.getElementById('details'),
        footerHint: document.getElementById('footerHint'),
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
        const roundedPercent = Math.round(safePercent);
        els.progressBar.style.width = safePercent + '%';
        els.progressBar.className = 'progress-bar' + (tone ? ' ' + tone : '');
        els.progressPercent.textContent = roundedPercent + '%';
        els.progressTrack.setAttribute('aria-valuenow', String(roundedPercent));
      };

      const setTone = (tone = 'active') => {
        els.stateIcon.dataset.tone = tone;
      };

      const renderState = (state = {}) => {
        const status = state.status || 'idle';
        const progress = state.progress || {};
        const percent = Math.round(Math.max(0, Math.min(100, Number(progress.percent) || 0)));
        const updateName = versionLabel(state);

        els.retryBtn.hidden = true;
        els.installBtn.hidden = true;
        els.hideBtn.disabled = false;
        setTone('active');

        if (status === 'downloading') {
          els.title.textContent = 'Downloading update';
          els.subtitle.textContent = updateName;
          els.footerHint.textContent = 'You can keep using LyricDisplay while the update downloads.';
          setProgress(percent, 'active');
          const total = Number(progress.total) || 0;
          const transferred = Number(progress.transferred) || 0;
          const sizeText = total > 0
            ? formatBytes(transferred) + ' of ' + formatBytes(total)
            : formatBytes(transferred) + ' downloaded';
          els.details.textContent = formatSpeed(progress.bytesPerSecond) + '  ·  ' + sizeText;
          return;
        }

        if (status === 'downloaded') {
          els.title.textContent = 'Update ready to install';
          els.subtitle.textContent = updateName + ' has finished downloading.';
          setTone('success');
          setProgress(100, 'success');
          els.details.textContent = 'Install when you are ready to restart LyricDisplay.';
          els.footerHint.textContent = 'Save any open work before restarting the app.';
          els.installBtn.hidden = false;
          return;
        }

        if (status === 'installing') {
          els.title.textContent = 'Restarting to install';
          els.subtitle.textContent = updateName;
          setTone('success');
          setProgress(100, 'success');
          els.details.textContent = 'LyricDisplay is closing and installing the update.';
          els.footerHint.textContent = 'Keep LyricDisplay open while installation begins.';
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
          els.footerHint.textContent = 'Check your connection, then try the download again.';
          els.retryBtn.hidden = false;
          return;
        }

        els.title.textContent = 'Preparing update';
        els.subtitle.textContent = updateName;
        setProgress(percent, 'active');
        els.details.textContent = 'Waiting for download progress…';
        els.footerHint.textContent = 'You can keep using LyricDisplay while the update downloads.';
      };

      window.addEventListener('DOMContentLoaded', () => {
        renderState(INITIAL_STATE);

        if (!window.electronAPI) return;

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

const createUpdaterBrowserWindow = ({ parent, initialState }) => {
  const win = new BrowserWindow({
    title: 'LyricDisplay Update',
    width: 560,
    height: 260,
    useContentSize: true,
    resizable: false,
    minimizable: true,
    maximizable: false,
    skipTaskbar: true,
    parent: parent ?? undefined,
    modal: false,
    center: true,
    show: false,
    frame: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#111827' : '#f1f5f9',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: resolveProductionPath('preloads', 'updater.cjs')
    }
  });

  win.setMenuBarVisibility(false);
  void win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(getProgressHTML({
    initialState
  })));
  return win;
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

  progressWindow = createUpdaterBrowserWindow({
    parent,
    initialState: lastState
  });

  progressWindow.webContents.once('did-finish-load', () => {
    updateProgressWindowState(lastState);
  });

  progressWindow.on('close', (event) => {
    if (app.isQuitting) return;
    event.preventDefault();
    progressWindow.hide();
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
    progressWindow.destroy();
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
