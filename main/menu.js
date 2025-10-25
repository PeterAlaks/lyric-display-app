import { Menu, nativeTheme, dialog } from 'electron';
import path from 'path';
import { promises as fs } from 'fs';
import { getRecents, subscribe, clearRecents } from './recents.js';

export function makeMenuAPI({ getMainWindow, createWindow, checkForUpdates, showInAppModal }) {
  function updateDarkModeMenu() {
    const win = getMainWindow?.();
    if (win && !win.isDestroyed()) {
      win.webContents.executeJavaScript(`window.electronStore?.getDarkMode?.() || false`).then(isDark => {
        nativeTheme.themeSource = isDark ? 'dark' : 'light';
        const menu = Menu.getApplicationMenu();
        if (menu) {
          const viewMenu = menu.items.find(item => item.label === 'View');
          if (viewMenu) {
            const darkModeItem = viewMenu.submenu.items.find(item => item.label === 'Dark Mode');
            if (darkModeItem) { darkModeItem.checked = isDark; }
          }
        }
      }).catch(err => { console.log('Could not get dark mode state:', err); });
    }
  }

  function toggleDarkMode() {
    const win = getMainWindow?.();
    if (win && !win.isDestroyed()) {
      win.webContents.send('toggle-dark-mode');
      setTimeout(() => { updateDarkModeMenu(); }, 100);
    }
  }

  const BACKOFF_WARNING_THRESHOLD_MS = 4000;

  const formatDuration = (ms) => {
    if (!Number.isFinite(ms) || ms <= 0) return "0s";
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes > 0) {
      return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
    }
    return `${seconds}s`;
  };

  const formatRelativeTime = (timestamp) => {
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      return null;
    }
    const delta = Date.now() - timestamp;
    if (delta < 0) {
      return "just now";
    }
    const seconds = Math.round(delta / 1000);
    if (seconds < 45) {
      return `${seconds}s ago`;
    }
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
      return `${minutes}m ago`;
    }
    const hours = Math.round(minutes / 60);
    if (hours < 48) {
      return `${hours}h ago`;
    }
    const days = Math.round(hours / 24);
    if (days < 14) {
      return `${days}d ago`;
    }
    const weeks = Math.round(days / 7);
    if (weeks < 8) {
      return `${weeks}w ago`;
    }
    return new Date(timestamp).toLocaleString();
  };

  const formatAttemptSummary = (count) => {
    if (!Number.isFinite(count) || count <= 0) {
      return "no recent attempts";
    }
    return `${count} ${count === 1 ? "attempt" : "attempts"}`;
  };

  const buildDiagnosticsDescription = (stats) => {
    if (!stats) {
      return "Connection diagnostics are not available yet.";
    }

    const lines = ["Overview:"];

    if (stats.globalBackoffActive) {
      lines.push(
        `- Auto retry: waiting about ${formatDuration(stats.globalBackoffRemainingMs)} before trying again`
      );
    } else {
      lines.push("- Auto retry: ready to reconnect immediately if needed");
    }

    lines.push(`- Failed attempts this session: ${stats.globalFailures ?? 0}`);

    const clientEntries = Object.entries(stats.clients || {});
    const totalClients = Number.isFinite(stats.totalClients)
      ? stats.totalClients
      : clientEntries.length;
    lines.push(`- Active connection ${totalClients === 1 ? "client" : "clients"}: ${totalClients}`);

    if (stats.lastFailureTime) {
      const friendly = formatRelativeTime(stats.lastFailureTime);
      if (friendly) {
        lines.push(`- Most recent failure: ${friendly}`);
      }
    }

    if (clientEntries.length > 0) {
      lines.push("", "Client details:");
      clientEntries.forEach(([id, info]) => {
        const statusLabel = info.status === "connected"
          ? "Connected"
          : info.status === "disconnected"
            ? "Waiting to retry"
            : typeof info.status === "string"
              ? info.status.charAt(0).toUpperCase() + info.status.slice(1)
              : "Unknown";
        const nextRetry = info.backoffRemaining > 0
          ? `next retry in ${formatDuration(info.backoffRemaining)}`
          : info.status === "connected"
            ? "no retry scheduled"
            : "ready to retry";
        const lastAttempt = formatRelativeTime(info.lastAttemptTime);

        lines.push(`- ${id}: ${statusLabel}`);
        if (info.isConnecting) {
          lines.push("    Currently reconnecting");
        }
        lines.push(`    Attempts this session: ${formatAttemptSummary(info.attempts)}`);
        lines.push(`    Next retry: ${nextRetry}`);
        if (lastAttempt) {
          lines.push(`    Last attempt: ${lastAttempt}`);
        }
      });
    } else {
      lines.push("", "No connection clients are queued for retry right now.");
    }

    return lines.join("\n");
  };

  async function openConnectionDiagnostics() {
    const win = getMainWindow?.();
    if (!win || win.isDestroyed()) {
      await dialog.showMessageBox({
        type: "info",
        buttons: ["Close"],
        defaultId: 0,
        message: "Open the main window to view connection diagnostics.",
      });
      return;
    }

    if (typeof showInAppModal === "function") {
      try {
        await showInAppModal(
          {
            title: "Connection Diagnostics",
            component: "ConnectionDiagnostics",
            variant: "info",
            size: "large",
            actions: [
              {
                label: "Close",
                value: 0,
                variant: "secondary",
                autoFocus: true,
              },
            ],
          },
          {
            fallback: () => {
              dialog.showMessageBox({
                type: "info",
                buttons: ["Close"],
                defaultId: 0,
                title: "Connection Diagnostics",
                message: "Please view diagnostics from the main application window.",
              });
            }, timeout: 600000
          }
        );
      } catch (error) {
        console.warn("Could not open diagnostics modal:", error);
      }
    }
  }

  async function createMenu() {
    const recentFiles = await getRecents();

    const buildRecentSubmenu = () => {
      if (!recentFiles || recentFiles.length === 0) {
        return [
          { label: 'No recent files', enabled: false },
          { type: 'separator' },
          {
            label: 'Clear Recent Files',
            enabled: false,
          },
        ];
      }
      const pad = '\u2003\u2003\u2003\u2003';
      const items = recentFiles.map((fp) => ({
        label: path.basename(fp) + pad,
        sublabel: fp,
        click: async () => {
          try {
            const win = getMainWindow?.();
            const content = await fs.readFile(fp, 'utf8');
            const fileName = path.basename(fp);
            if (win && !win.isDestroyed()) {
              win.webContents.send('open-lyrics-from-path', { content, fileName, filePath: fp });
            }
          } catch (e) {
            const win = getMainWindow?.();
            if (win && !win.isDestroyed()) {
              try { win.webContents.send('open-lyrics-from-path-error', { filePath: fp }); } catch { }
            }
          }
        }
      }));

      items.push({ type: 'separator' });
      items.push({
        label: 'Clear Recent Files',
        click: async () => { await clearRecents(); createMenu(); },
      });
      return items;
    };
    const template = [
      {
        label: 'File',
        submenu: [
          {
            label: 'Load Lyrics File',
            accelerator: 'CmdOrCtrl+O',
            click: () => { const win = getMainWindow?.(); if (win && !win.isDestroyed()) win.webContents.send('trigger-file-load'); },
          },
          {
            label: 'New Lyrics File',
            accelerator: 'CmdOrCtrl+N',
            click: () => { const win = getMainWindow?.(); if (win && !win.isDestroyed()) win.webContents.send('navigate-to-new-song'); },
          },
          {
            label: 'Open Recent',
            submenu: buildRecentSubmenu(),
          },
          { type: 'separator' },
          {
            label: 'Connect Mobile Controller',
            click: () => {
              const win = getMainWindow?.();
              if (win && !win.isDestroyed()) {
                try { win.webContents.send('open-qr-dialog'); } catch { }
              }
            }
          },
          { type: 'separator' },
          {
            label: 'Import Songs from EasyWorship',
            click: () => {
              const win = getMainWindow?.();
              if (win && !win.isDestroyed()) {
                try {
                  win.webContents.send('open-easyworship-import');
                } catch (err) {
                  console.error('Failed to send easyworship import event:', err);
                }
              }
            }
          },
          { type: 'separator' },
          {
            label: 'Preview Outputs',
            click: async () => {
              const win = getMainWindow?.();
              if (win && !win.isDestroyed()) {
                try {
                  await (showInAppModal
                    ? showInAppModal({
                      title: 'Preview Outputs',
                      headerDescription: 'Live preview of both output displays side-by-side',
                      component: 'PreviewOutputs',
                      variant: 'info',
                      size: 'large',
                      dismissLabel: 'Close',
                      className: 'max-w-4xl'
                    }, { timeout: 600000 })
                    : Promise.resolve()
                  );
                } catch (err) {
                  console.warn('Could not open preview outputs modal:', err);
                }
              }
            }
          },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      {
        label: 'Edit',
        submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }],
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'toggledevtools' },
          { type: 'separator' },
          { label: 'Dark Mode', type: 'checkbox', checked: false, click: toggleDarkMode },
          { type: 'separator' },
          { role: 'resetzoom' }, { role: 'zoomin' }, { role: 'zoomout' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          {
            label: 'Keyboard Shortcuts',
            click: () => {
              try {
                const win = getMainWindow?.();
                if (win && !win.isDestroyed()) win.webContents.send('open-shortcuts-help');
              } catch { }
            }
          },
          { role: 'close' }
        ],
      },
      {
        label: 'Help',
        submenu: [
          { label: 'Documentation', click: async () => { const { shell } = await import('electron'); await shell.openExternal('https://github.com/PeterAlaks/lyric-display-app#readme'); } },
          { label: 'GitHub Repository', click: async () => { const { shell } = await import('electron'); await shell.openExternal('https://github.com/PeterAlaks/lyric-display-app'); } },
          { label: 'Connection Diagnostics', click: openConnectionDiagnostics },
          {
            label: 'Integration Guide',
            click: async () => {
              const win = getMainWindow?.();
              if (win && !win.isDestroyed()) {
                try {
                  await (showInAppModal
                    ? showInAppModal({
                      title: 'Streaming Software Integration',
                      headerDescription: 'Connect LyricDisplay to OBS, vMix, or Wirecast',
                      component: 'IntegrationInstructions',
                      variant: 'info',
                      size: 'lg',
                      dismissLabel: 'Close'
                    }, { timeout: 600000 })
                    : Promise.resolve()
                  );
                } catch (err) {
                  console.warn('Could not open integration guide:', err);
                }
              }
            }
          },
          { type: 'separator' },
          { label: 'More About Author', click: async () => { const { shell } = await import('electron'); await shell.openExternal('https://linktr.ee/peteralaks'); } },
          {
            label: 'About App',
            click: async () => {
              const { app, dialog } = await import('electron');
              const message = `LyricDisplay\nVersion ${app.getVersion()}\nBy Peter Alakembi`;

              const result = await (showInAppModal
                ? showInAppModal(
                  {
                    title: 'About LyricDisplay',
                    description: message,
                    variant: 'info',
                    actions: [
                      { label: 'OK', value: { response: 0 }, variant: 'outline' },
                      { label: 'Check for Updates', value: { response: 1 } },
                    ],
                  },
                  {
                    fallback: () => dialog
                      .showMessageBox({ type: 'info', buttons: ['OK', 'Check for Updates'], title: 'About LyricDisplay', message })
                      .then((res) => ({ response: res.response })),
                    timeout: 600000,
                  }
                )
                : dialog
                  .showMessageBox({ type: 'info', buttons: ['OK', 'Check for Updates'], title: 'About LyricDisplay', message })
                  .then((res) => ({ response: res.response }))
              );

              if ((result?.response ?? -1) === 1) {
                checkForUpdates?.(true);
              }
            },
          },
          {
            label: 'Support Development',
            click: async () => {
              const { shell } = await import('electron');
              await shell.openExternal('https://paystack.shop/pay/lyricdisplay-support');
            }
          },
          { label: 'Check for Updates', click: () => checkForUpdates?.(true) },
        ],
      },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
    updateDarkModeMenu();
  }

  try {
    subscribe(() => { createMenu(); });
  } catch { }

  return { createMenu, updateDarkModeMenu, toggleDarkMode };
}
