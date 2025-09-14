import { Menu, nativeTheme } from 'electron';

export function makeMenuAPI({ getMainWindow, createWindow, showQRCodeDialog, checkForUpdates }) {
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

  function createMenu() {
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
          { type: 'separator' },
          { label: 'Connect Mobile Controller', click: () => showQRCodeDialog?.() },
          { type: 'separator' },
          { label: 'Preview Output 1', accelerator: 'CmdOrCtrl+1', click: () => createWindow?.('/output1') },
          { label: 'Preview Output 2', accelerator: 'CmdOrCtrl+2', click: () => createWindow?.('/output2') },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      {
        label: 'Edit',
        submenu: [ { role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' } ],
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
            label: 'Keyboard Shortcuts...',
            click: () => {
              try {
                const win = getMainWindow?.();
                if (win && !win.isDestroyed()) win.webContents.send('open-shortcuts-help');
              } catch {}
            }
          },
          { role: 'close' }
        ],
      },
      {
        label: 'Help',
        submenu: [
          { label: 'Documentation', click: async () => { const { shell } = await import('electron'); await shell.openExternal('https://github.com/PeterAlaks/lyric-display-updates#readme'); } },
          { label: 'GitHub Repository', click: async () => { const { shell } = await import('electron'); await shell.openExternal('https://github.com/PeterAlaks/lyric-display-updates'); } },
          { type: 'separator' },
          { label: 'More About Author', click: async () => { const { shell } = await import('electron'); await shell.openExternal('https://linktr.ee/peteralaks'); } },
          {
            label: 'About App',
            click: async () => {
              const { app, dialog } = await import('electron');
              dialog.showMessageBox({ type: 'info', buttons: ['OK', 'Check for Updates'], title: 'About LyricDisplay', message: `LyricDisplay\nVersion ${app.getVersion()}\nBy Peter Alakembi` }).then((result) => {
                if (result.response === 1) { checkForUpdates?.(true); }
              });
            },
          },
          { label: 'Check for Updates', click: () => checkForUpdates?.(true) },
        ],
      },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
    updateDarkModeMenu();
  }

  return { createMenu, updateDarkModeMenu, toggleDarkMode };
}
