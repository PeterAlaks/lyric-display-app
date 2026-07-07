import { ipcMain, dialog } from 'electron';
import { readFile, stat, writeFile } from 'fs/promises';
import path from 'path';
import { parseLyricImportContent, extractLyricTextFromSource } from '../../shared/documentTextExtraction.js';
import {
  getLyricOpenDialogFilters,
  normalizeLyricFileType,
} from '../../shared/lyricImportRegistry.js';
import { addRecent } from '../recents.js';
import * as userPreferences from '../userPreferences.js';
import { grantLyricVideoMediaFile, revokeLyricVideoMediaFile } from '../lyricVideoMediaProtocol.js';

const ALLOWED_WRITE_EXTENSIONS = new Set(['.txt', '.lrc']);
const AUDIO_MIME_TYPES = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
};
const MAX_WRITE_CONTENT_BYTES = 10 * 1024 * 1024;
const writeGrantPaths = new Set();

function normalizeFilePath(filePath) {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    return null;
  }
  const resolved = path.resolve(filePath);
  if (!path.isAbsolute(resolved)) {
    return null;
  }
  return resolved;
}

function grantWritePath(filePath) {
  const normalized = normalizeFilePath(filePath);
  if (normalized) {
    writeGrantPaths.add(normalized);
  }
  return normalized;
}

function validateLyricWrite(filePath, content) {
  const normalized = normalizeFilePath(filePath);
  if (!normalized) {
    return { valid: false, error: 'Invalid file path' };
  }

  const extension = path.extname(normalized).toLowerCase();
  if (!ALLOWED_WRITE_EXTENSIONS.has(extension)) {
    return { valid: false, error: 'Only .txt and .lrc lyric files can be written here' };
  }

  if (!writeGrantPaths.has(normalized)) {
    return { valid: false, error: 'File write was not granted by a LyricDisplay file workflow' };
  }

  if (typeof content !== 'string') {
    return { valid: false, error: 'File content must be text' };
  }

  if (Buffer.byteLength(content, 'utf8') > MAX_WRITE_CONTENT_BYTES) {
    return { valid: false, error: 'File content is too large' };
  }

  return { valid: true, normalized };
}

/**
 * Register file operation IPC handlers
 * Handles file dialogs, reading, writing, and parsing lyrics files
 */
export function registerFileHandlers({ getMainWindow }) {

  ipcMain.handle('show-save-dialog', async (_event, options) => {
    const win = getMainWindow?.();
    const result = await dialog.showSaveDialog(win || undefined, options);
    if (!result.canceled && result.filePath) {
      grantWritePath(result.filePath);
    }
    return result;
  });

  ipcMain.handle('write-file', async (_event, filePath, content) => {
    const validation = validateLyricWrite(filePath, content);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    await writeFile(validation.normalized, content, 'utf8');
    return { success: true };
  });

  ipcMain.handle('load-lyrics-file', async () => {
    try {
      const win = getMainWindow?.();
      const rememberLastPath = userPreferences.getPreference('fileHandling.rememberLastOpenedPath') ?? true;

      let defaultPath;

      if (rememberLastPath) {
        const { getLastOpenedDirectory } = await import('../recents.js');
        defaultPath = await getLastOpenedDirectory();
      } else {
        const configuredPath = userPreferences.getPreference('fileHandling.defaultLyricsPath');
        if (configuredPath && configuredPath.trim()) {
          defaultPath = configuredPath;
        }
      }

      if (!defaultPath) {
        defaultPath = userPreferences.getDefaultLyricsPath();
      }

      const result = await dialog.showOpenDialog(win || undefined, {
        properties: ['openFile'],
        filters: getLyricOpenDialogFilters(),
        defaultPath: defaultPath || undefined
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        const fileName = filePath.split(/[\\/]/).pop();
        const fileType = normalizeLyricFileType({ fileName });
        const content = await extractLyricTextFromSource({
          fileType,
          fileName,
          path: filePath,
          readFile,
        });
        grantWritePath(filePath);
        try {
          await addRecent(filePath);
        } catch { }
        return { success: true, content, fileName, filePath, fileType };
      }
      return { success: false, canceled: true };
    } catch (error) {
      console.error('Error loading lyrics file:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('lyric-video:select-audio', async () => {
    try {
      const win = getMainWindow?.();
      const result = await dialog.showOpenDialog(win || undefined, {
        properties: ['openFile'],
        filters: [
          { name: 'Audio Files', extensions: ['mp3', 'wav', 'm4a', 'aac'] },
        ],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      const filePath = result.filePaths[0];
      const extension = path.extname(filePath).toLowerCase();
      const fileName = path.basename(filePath);

      return {
        success: true,
        filePath,
        fileName,
        mimeType: AUDIO_MIME_TYPES[extension] || 'audio/*',
        sourceUrl: grantLyricVideoMediaFile(filePath, AUDIO_MIME_TYPES[extension] || 'audio/*'),
      };
    } catch (error) {
      console.error('Error selecting lyric video audio:', error);
      return { success: false, error: error.message || 'Failed to select audio' };
    }
  });

  ipcMain.handle('lyric-video:restore-audio', async (_event, payload = {}) => {
    try {
      const normalized = normalizeFilePath(payload?.filePath);
      if (!normalized) {
        return { success: false, error: 'Invalid audio file path' };
      }

      const fileStat = await stat(normalized);
      if (!fileStat.isFile()) {
        return { success: false, error: 'Saved audio path is not a file' };
      }

      const extension = path.extname(normalized).toLowerCase();
      const fileName = path.basename(normalized);
      const mimeType = AUDIO_MIME_TYPES[extension] || payload?.mimeType || 'audio/*';

      return {
        success: true,
        filePath: normalized,
        fileName,
        mimeType,
        sourceUrl: grantLyricVideoMediaFile(normalized, mimeType),
      };
    } catch (error) {
      return { success: false, error: error?.message || 'Saved audio file could not be restored' };
    }
  });

  ipcMain.handle('lyric-video:revoke-media', async (_event, sourceUrl) => ({
    success: revokeLyricVideoMediaFile(sourceUrl),
  }));

  ipcMain.handle('parse-lyrics-file', async (_event, payload = {}) => {
    try {
      const { fileType = 'txt', name, path: filePath, rawText, rawBytes } = payload || {};
      const content = typeof rawText === 'string' ? rawText : null;
      const finalFileType = normalizeLyricFileType({ fileType, fileName: name || filePath });

      if (typeof content !== 'string' && !rawBytes && !filePath) {
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
          maxLinesPerGroup: parsingConfig.normalGroupConfig?.MAX_LINES_PER_GROUP ?? 2,
          enableCrossBlankLineGrouping: parsingConfig.normalGroupConfig?.CROSS_BLANK_LINE_GROUPING ?? true,
          structureTagMode: parsingConfig.structureTagsConfig?.MODE ?? 'isolate',
        }
      };

      const result = await parseLyricImportContent({
        fileType: finalFileType,
        fileName: name || filePath,
        rawText: content,
        rawBytes,
        path: filePath,
        readFile,
        parsingOptions,
      });
      if (filePath) {
        grantWritePath(filePath);
      }

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
