import { ipcMain, dialog } from 'electron';
import { exportSetlistToPDF, exportSetlistToTXT } from '../setlistExport.js';
import { extractLyricTextFromSource } from '../../shared/documentTextExtraction.js';
import {
  getLyricOpenDialogFilters,
  normalizeLyricFileType,
} from '../../shared/lyricImportRegistry.js';
import {
  MAX_SETLIST_FILE_BYTES,
  hasSetlistExtension,
  normalizeSetlistPath,
  sanitizeSetlistDefaultName,
  validateSetlistData,
} from '../setlistValidation.js';

async function readValidatedSetlistFile(fs, filePath) {
  const normalizedPath = normalizeSetlistPath(filePath);
  if (!normalizedPath || !hasSetlistExtension(normalizedPath)) {
    return { success: false, error: 'Only .ldset files can be loaded as setlists' };
  }

  const stats = await fs.stat(normalizedPath);
  if (stats.size > MAX_SETLIST_FILE_BYTES) {
    return { success: false, error: 'Setlist file is too large' };
  }

  const content = await fs.readFile(normalizedPath, 'utf8');
  const setlistData = JSON.parse(content);
  const validation = validateSetlistData(setlistData);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  return { success: true, setlistData, filePath: normalizedPath };
}

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

      const safeDefaultName = sanitizeSetlistDefaultName(defaultName);
      const result = await dialog.showSaveDialog(win || undefined, {
        title: 'Save Setlist',
        defaultPath: path.join(defaultPath, safeDefaultName),
        filters: [
          { name: 'LyricDisplay Setlist', extensions: ['ldset'] }
        ],
        properties: ['createDirectory', 'showOverwriteConfirmation']
      });

      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
      }

      const normalizedPath = normalizeSetlistPath(result.filePath);
      if (!normalizedPath || !hasSetlistExtension(normalizedPath)) {
        return { success: false, error: 'Setlists must be saved as .ldset files' };
      }

      const validation = validateSetlistData(setlistData);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const jsonContent = JSON.stringify(setlistData, null, 2);
      if (Buffer.byteLength(jsonContent, 'utf8') > MAX_SETLIST_FILE_BYTES) {
        return { success: false, error: 'Setlist file is too large' };
      }

      await fs.writeFile(normalizedPath, jsonContent, 'utf8');

      console.log('[Setlist] Saved setlist to:', normalizedPath);
      return { success: true, filePath: normalizedPath };
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
      const loaded = await readValidatedSetlistFile(fs, filePath);
      if (!loaded.success) {
        return loaded;
      }

      console.log('[Setlist] Loaded setlist from:', loaded.filePath);
      return loaded;
    } catch (error) {
      console.error('[Setlist] Error loading setlist:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('setlist:load-from-path', async (_event, { filePath }) => {
    try {
      const fs = await import('fs/promises');
      const loaded = await readValidatedSetlistFile(fs, filePath);
      if (!loaded.success) {
        return loaded;
      }

      console.log('[Setlist] Loaded setlist from path:', loaded.filePath);
      return loaded;
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
        filters: getLyricOpenDialogFilters(),
        properties: ['openFile', 'multiSelections']
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      const fs = await import('fs/promises');
      const files = await Promise.all(
        result.filePaths.map(async (filePath) => {
          const fileName = filePath.split(/[\\/]/).pop();
          const fileType = normalizeLyricFileType({ fileName });
          const extractedContent = await extractLyricTextFromSource({
            fileType,
            fileName,
            path: filePath,
            readFile: fs.readFile,
          });
          const stats = await fs.stat(filePath);
          return {
            name: fileName,
            content: extractedContent,
            fileType,
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
