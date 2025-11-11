import { Menu, nativeTheme, dialog, app } from 'electron';
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

    const isMac = process.platform === 'darwin';

    const template = [
      ...(isMac ? [{
        label: app.name,
        submenu: [
          {
            label: `About ${app.name}`,
            click: async () => {
              const message = [
                `LyricDisplay`,
                `Version ${app.getVersion()}`,
                `\n© 2025 LyricDisplay. All rights reserved.`,
                `Designed and developed by Peter Alakembi and David Okaliwe.`,
                `\n____________________________________________\n`,
                `Lyrics Provider Credits & Disclaimer:`,
                `This application integrates optional online lyrics search features. All lyrics, metadata, and content obtained through these services remain the property of their respective copyright holders.`,
                `\nLogos and brand marks of providers are used for identification and attribution only and do not imply endorsement or affiliation.`,
                `\nThis feature is offered "as is" for convenience and educational purposes. LyricDisplay and its developers are not affiliated with these content providers.`
              ].join('\n');

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
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      }] : []),
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
          ...(isMac ? [] : [{ role: 'quit' }]),
        ],
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          ...(isMac ? [
            { role: 'pasteAndMatchStyle' },
            { role: 'delete' },
            { role: 'selectAll' },
            { type: 'separator' },
            {
              label: 'Speech',
              submenu: [
                { role: 'startSpeaking' },
                { role: 'stopSpeaking' }
              ]
            }
          ] : [
            { role: 'delete' },
            { type: 'separator' },
            { role: 'selectAll' }
          ])
        ],
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'toggledevtools' },
          { type: 'separator' },
          { label: 'Dark Mode', type: 'checkbox', checked: false, click: toggleDarkMode },
          { type: 'separator' },
          { role: 'resetzoom' },
          { role: 'zoomin' },
          { role: 'zoomout' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          ...(isMac ? [
            { type: 'separator' },
            { role: 'front' },
            { type: 'separator' },
            { role: 'window' }
          ] : [
            { role: 'close' }
          ]),
          {
            label: 'Keyboard Shortcuts',
            click: () => {
              try {
                const win = getMainWindow?.();
                if (win && !win.isDestroyed()) win.webContents.send('open-shortcuts-help');
              } catch { }
            }
          },
          { type: 'separator' },
          {
            label: 'Display Settings',
            click: async () => {
              const win = getMainWindow?.();
              if (win && !win.isDestroyed()) {
                try {
                  const { getAllDisplays, getDisplayAssignment } = await import('./displayManager.js');
                  const displays = getAllDisplays();
                  const externalDisplays = displays.filter(d => !d.primary);

                  if (externalDisplays.length === 0) {
                    await (showInAppModal
                      ? showInAppModal({
                        title: 'No External Displays',
                        description: 'No external displays are currently connected. Connect an external display via HDMI or other connection to configure display settings.',
                        variant: 'info',
                        dismissLabel: 'OK'
                      }, { timeout: 30000 })
                      : Promise.resolve()
                    );
                    return;
                  }

                  const display = externalDisplays[0];
                  const assignment = getDisplayAssignment(display.id);

                  const { BrowserWindow } = await import('electron');
                  const windows = BrowserWindow.getAllWindows();
                  let isCurrentlyProjecting = false;

                  if (assignment) {
                    const outputRoute = assignment.outputKey === 'stage' ? '/stage' :
                      assignment.outputKey === 'output1' ? '/output1' : '/output2';

                    for (const w of windows) {
                      if (!w || w.isDestroyed()) continue;
                      try {
                        const url = w.webContents.getURL();
                        if (url.includes(outputRoute)) {
                          isCurrentlyProjecting = true;
                          break;
                        }
                      } catch (err) { }
                    }
                  }

                  await (showInAppModal
                    ? showInAppModal({
                      title: 'Display Settings',
                      headerDescription: 'Configure how to use connected displays',
                      component: 'DisplayDetection',
                      variant: 'info',
                      size: 'lg',
                      dismissible: true,
                      actions: [],
                      isManualOpen: true,
                      isCurrentlyProjecting,
                      displayInfo: {
                        id: display.id,
                        name: display.name,
                        bounds: display.bounds
                      }
                    }, { timeout: 600000 })
                    : Promise.resolve()
                  );
                } catch (err) {
                  console.warn('Could not open display settings:', err);
                }
              }
            }
          },
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
          ...(isMac ? [] : [{
            label: 'About App',
            click: async () => {
              const message = [
                `LyricDisplay`,
                `Version ${app.getVersion()}`,
                `\n© 2025 LyricDisplay. All rights reserved.`,
                `Designed and developed by Peter Alakembi and David Okaliwe.`,
                `\n____________________________________________\n`,
                `Lyrics Provider Credits & Disclaimer:`,
                `This application integrates optional online lyrics search features. All lyrics, metadata, and content obtained through these services remain the property of their respective copyright holders.`,
                `\nLogos and brand marks of providers are used for identification and attribution only and do not imply endorsement or affiliation.`,
                `\nThis feature is offered "as is" for convenience and educational purposes. LyricDisplay and its developers are not affiliated with these content providers.`
              ].join('\n');

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
          }]),
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