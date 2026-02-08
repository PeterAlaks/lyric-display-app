import { ipcMain, dialog } from 'electron';
import { readFile, writeFile } from 'fs/promises';
import { parseTxtContent, parseLrcContent } from '../../shared/lyricsParsing.js';
import { addRecent } from '../recents.js';
import * as userPreferences from '../userPreferences.js';

/**
 * Register file operation IPC handlers
 * Handles file dialogs, reading, writing, and parsing lyrics files
 */
export function registerFileHandlers({ getMainWindow }) {
  
  ipcMain.handle('show-save-dialog', async (_event, options) => {
    const win = getMainWindow?.();
    const result = await dialog.showSaveDialog(win || undefined, options);
    return result;
  });

  ipcMain.handle('write-file', async (_event, filePath, content) => {
    await writeFile(filePath, content, 'utf8');
    return { success: true };
  });

  ipcMain.handle('load-lyrics-file', async () => {
    try {
      const win = getMainWindow?.();
      const rememberLastPath = userPreferences.getPreference('general.rememberLastOpenedPath') ?? true;
      
      let defaultPath;
      if (rememberLastPath) {
        // Try to get the last opened directory first
        const { getLastOpenedDirectory } = await import('../recents.js');
        defaultPath = await getLastOpenedDirectory();
      }
      
      // Fall back to user's configured default path if no recent or rememberLastPath is false
      if (!defaultPath) {
        defaultPath = userPreferences.getDefaultLyricsPath();
      }
      
      const result = await dialog.showOpenDialog(win || undefined, { 
        properties: ['openFile'], 
        filters: [{ name: 'Text Files', extensions: ['txt', 'lrc'] }],
        defaultPath: defaultPath || undefined
      });
      
      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        const content = await readFile(filePath, 'utf8');
        const fileName = filePath.split(/[\\/]/).pop();
        try { 
          await addRecent(filePath); 
        } catch { }
        return { success: true, content, fileName, filePath };
      }
      return { success: false, canceled: true };
    } catch (error) {
      console.error('Error loading lyrics file:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('parse-lyrics-file', async (_event, payload = {}) => {
    try {
      const { fileType = 'txt', path: filePath, rawText } = payload || {};
      let content = typeof rawText === 'string' ? rawText : null;

      if (!content && filePath) {
        content = await readFile(filePath, 'utf8');
      }

      if (typeof content !== 'string') {
        return { success: false, error: 'No lyric content available for parsing' };
      }

      // Get user preferences for parsing
      const parsingConfig = userPreferences.getParsingConfig();
      const parsingOptions = {
        enableSplitting: parsingConfig.enableSplitting ?? true,
        splitConfig: parsingConfig.splitConfig || {
          TARGET_LENGTH: 60,
          MIN_LENGTH: 40,
          MAX_LENGTH: 80,
          OVERFLOW_TOLERANCE: 15,
        },
        groupingConfig: {
          enableAutoLineGrouping: parsingConfig.normalGroupConfig?.ENABLED ?? true,
          enableTranslationGrouping: parsingConfig.enableTranslationGrouping ?? true,
          maxLineLength: parsingConfig.normalGroupConfig?.MAX_LINE_LENGTH ?? 45,
          enableCrossBlankLineGrouping: parsingConfig.normalGroupConfig?.CROSS_BLANK_LINE_GROUPING ?? true,
          structureTagMode: parsingConfig.structureTagsConfig?.MODE ?? 'isolate',
        }
      };

      const parser = fileType === 'lrc' ? parseLrcContent : parseTxtContent;
      const result = parser(content, parsingOptions);

      return { success: true, payload: result };
    } catch (error) {
      console.error('Error parsing lyrics file via IPC:', error);
      return { success: false, error: error.message || 'Failed to parse lyrics' };
    }
  });

  ipcMain.handle('new-lyrics-file', () => {
    const win = getMainWindow?.();
    if (win && !win.isDestroyed()) {
      win.webContents.send('navigate-to-new-song');
    }
  });
}
