import { ipcMain, dialog } from 'electron';
import { exportSetlistToPDF, exportSetlistToTXT } from '../setlistExport.js';

/**
 * Register setlist IPC handlers
 * Handles setlist save, load, browse files, and export operations
 */
export function registerSetlistHandlers({ getMainWindow }) {
  
  ipcMain.handle('setlist:save', async (_event, { setlistData, defaultName }) => {
    try {
      const win = getMainWindow?.();
      const os = await import('os');
      const fs = await import('fs/promises');
      const path = await import('path');

      const userHome = os.homedir();
      const platform = process.platform;
      const separator = platform === 'win32' ? '\\' : '/';
      const defaultPath = `${userHome}${separator}Documents${separator}LyricDisplay${separator}Setlists`;

      try {
        await fs.mkdir(defaultPath, { recursive: true });
      } catch (err) {
        console.warn('Could not create setlist directory:', err);
      }

      const result = await dialog.showSaveDialog(win || undefined, {
        title: 'Save Setlist',
        defaultPath: path.join(defaultPath, defaultName || 'Setlist.ldset'),
        filters: [
          { name: 'LyricDisplay Setlist', extensions: ['ldset'] }
        ],
        properties: ['createDirectory', 'showOverwriteConfirmation']
      });

      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
      }

      const jsonContent = JSON.stringify(setlistData, null, 2);
      await fs.writeFile(result.filePath, jsonContent, 'utf8');

      console.log('[Setlist] Saved setlist to:', result.filePath);
      return { success: true, filePath: result.filePath };
    } catch (error) {
      console.error('[Setlist] Error saving setlist:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('setlist:load', async () => {
    try {
      const win = getMainWindow?.();
      const os = await import('os');
      const path = await import('path');

      const userHome = os.homedir();
      const platform = process.platform;
      const separator = platform === 'win32' ? '\\' : '/';
      const defaultPath = `${userHome}${separator}Documents${separator}LyricDisplay${separator}Setlists`;

      const result = await dialog.showOpenDialog(win || undefined, {
        title: 'Load Setlist',
        defaultPath: defaultPath,
        filters: [
          { name: 'LyricDisplay Setlist', extensions: ['ldset'] }
        ],
        properties: ['openFile']
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      const filePath = result.filePaths[0];
      const fs = await import('fs/promises');
      const content = await fs.readFile(filePath, 'utf8');
      const setlistData = JSON.parse(content);

      console.log('[Setlist] Loaded setlist from:', filePath);
      return { success: true, setlistData, filePath };
    } catch (error) {
      console.error('[Setlist] Error loading setlist:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('setlist:load-from-path', async (_event, { filePath }) => {
    try {
      const fs = await import('fs/promises');
      const content = await fs.readFile(filePath, 'utf8');
      const setlistData = JSON.parse(content);

      console.log('[Setlist] Loaded setlist from path:', filePath);
      return { success: true, setlistData, filePath };
    } catch (error) {
      console.error('[Setlist] Error loading setlist from path:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('setlist:get-user-home', async () => {
    try {
      const os = await import('os');
      return { success: true, homedir: os.homedir() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('setlist:browse-files', async () => {
    try {
      const win = getMainWindow?.();
      const result = await dialog.showOpenDialog(win || undefined, {
        title: 'Add Files to Setlist',
        filters: [
          { name: 'Lyric Files', extensions: ['txt', 'lrc'] }
        ],
        properties: ['openFile', 'multiSelections']
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      const fs = await import('fs/promises');
      const files = await Promise.all(
        result.filePaths.map(async (filePath) => {
          const content = await fs.readFile(filePath, 'utf8');
          const fileName = filePath.split(/[\\/]/).pop();
          const stats = await fs.stat(filePath);
          return {
            name: fileName,
            content,
            lastModified: stats.mtimeMs,
            filePath
          };
        })
      );

      console.log('[Setlist] Browsed and loaded', files.length, 'files');
      return { success: true, files };
    } catch (error) {
      console.error('[Setlist] Error browsing files:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('setlist:export', async (_event, { setlistData, options }) => {
    try {
      const win = getMainWindow?.();
      const os = await import('os');
      const path = await import('path');

      const { title = 'Setlist', includeLyrics = false, format = 'pdf' } = options || {};

      const userHome = os.homedir();
      const platform = process.platform;
      const separator = platform === 'win32' ? '\\' : '/';
      const defaultPath = `${userHome}${separator}Documents${separator}LyricDisplay${separator}Setlists`;

      try {
        const fs = await import('fs/promises');
        await fs.mkdir(defaultPath, { recursive: true });
      } catch (err) {
        console.warn('Could not create setlist directory:', err);
      }

      const extension = format === 'pdf' ? 'pdf' : 'txt';
      const filterName = format === 'pdf' ? 'PDF Document' : 'Text File';
      const defaultFileName = `${title}.${extension}`;

      const result = await dialog.showSaveDialog(win || undefined, {
        title: `Export Setlist as ${format.toUpperCase()}`,
        defaultPath: path.join(defaultPath, defaultFileName),
        filters: [
          { name: filterName, extensions: [extension] }
        ],
        properties: ['createDirectory', 'showOverwriteConfirmation']
      });

      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
      }

      let exportResult;
      if (format === 'pdf') {
        exportResult = await exportSetlistToPDF(result.filePath, setlistData, { title, includeLyrics });
      } else {
        exportResult = await exportSetlistToTXT(result.filePath, setlistData, { title, includeLyrics });
      }

      console.log('[Setlist] Exported setlist to:', result.filePath);
      return exportResult;
    } catch (error) {
      console.error('[Setlist] Error exporting setlist:', error);
      return { success: false, error: error.message };
    }
  });
}
