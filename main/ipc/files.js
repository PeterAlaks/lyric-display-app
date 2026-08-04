import { BrowserWindow, ipcMain, dialog } from 'electron';
import { readFile, stat } from 'fs/promises';
import path from 'path';
import { parseLyricImportContent } from '../../shared/documentTextExtraction.js';
import {
  getLyricOpenDialogFilters,
  normalizeLyricFileType,
} from '../../shared/lyricImportRegistry.js';
import {
  assertLyricImportSize,
  getBinaryByteLength,
} from '../../shared/lyricImportLimits.js';
import {
  buildLyricsParsingOptions,
  mergeLyricsParsingOptions,
} from '../../shared/lyricsParsing/preferenceOptions.js';
import {
  extractExplicitGroupingDirective,
  parseTxtContent,
} from '../../shared/lyricsParsing/txtParser.js';
import * as userPreferences from '../userPreferences.js';
import { grantLyricVideoMediaFile, revokeLyricVideoMediaFile } from '../lyricVideoMediaProtocol.js';
import {
  getActiveLyricImportByteLimit,
  grantLyricWritePath,
  normalizeLyricPath,
  readLyricsFileFromPath,
  validateLyricImportPath,
  validateLyricWrite,
} from '../lyricFiles.js';
import { refreshFileInNavigator } from '../fileNavigator.js';
import {
  getRememberedLyricsGrouping,
  rememberLyricsGrouping,
} from '../lyricsGroupingMetadata.js';
import { saveTextFileAtomically } from '../atomicFileSave.js';

const AUDIO_MIME_TYPES = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
};
/**
 * Register file operation IPC handlers
 * Handles file dialogs, reading, writing, and parsing lyrics files
 */
export function registerFileHandlers({ getMainWindow }) {

  ipcMain.handle('show-save-dialog', async (event, options) => {
    const senderWindow = event?.sender ? BrowserWindow.fromWebContents(event.sender) : null;
    const win = senderWindow && !senderWindow.isDestroyed()
      ? senderWindow
      : getMainWindow?.();
    const result = await dialog.showSaveDialog(win || undefined, options);
    if (!result.canceled && result.filePath) {
      grantLyricWritePath(result.filePath);
    }
    return result;
  });

  ipcMain.handle('write-file', async (_event, filePath, content, options = {}) => {
    const extension = path.extname(filePath || '').toLowerCase();
    const collisionPolicy = options?.collisionPolicy === 'create' ? 'create' : 'replace';
    const cleanContent = extension === '.txt' && typeof content === 'string'
      ? extractExplicitGroupingDirective(content).content
      : content;
    const validation = validateLyricWrite(filePath, cleanContent, { collisionPolicy });
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      await saveTextFileAtomically(validation.normalized, cleanContent, {
        mode: collisionPolicy,
      });
    } catch (error) {
      if (error?.code === 'FILE_EXISTS') {
        return {
          success: false,
          code: 'FILE_EXISTS',
          error: 'A file with that name already exists',
        };
      }
      return {
        success: false,
        code: error?.code || 'WRITE_FAILED',
        error: error?.message || 'File write failed',
      };
    }
    void refreshFileInNavigator(validation.normalized);

    let groupingPlan = null;
    if (extension === '.txt' && options?.preserveGrouping === true) {
      const parsingOptions = buildLyricsParsingOptions(userPreferences.getParsingConfig());
      const parsed = parseTxtContent(cleanContent, {
        ...parsingOptions,
        groupingConfig: {
          ...parsingOptions.groupingConfig,
          enableCrossBlankLineGrouping: false,
        },
      });
      groupingPlan = parsed.groupingPlan;
      rememberLyricsGrouping(validation.normalized, cleanContent, groupingPlan);
    }

    return { success: true, content: cleanContent, groupingPlan };
  });

  ipcMain.handle('load-lyrics-file', async () => {
    try {
      const win = getMainWindow?.();
      const rememberLastPath = userPreferences.getPreference('fileHandling.rememberLastOpenedPath') ?? true;
      let defaultPath = null;
      if (rememberLastPath) {
        const { getLastOpenedDirectory } = await import('../recents.js');
        defaultPath = await getLastOpenedDirectory();
      }

      const result = await dialog.showOpenDialog(win || undefined, {
        properties: ['openFile'],
        filters: getLyricOpenDialogFilters(),
        defaultPath: defaultPath || undefined
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const payload = await readLyricsFileFromPath(result.filePaths[0]);
        return { success: true, ...payload };
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
      const normalized = normalizeLyricPath(payload?.filePath);
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
      const {
        fileType,
        name,
        path: filePath,
        rawText,
        rawBytes,
        groupingConfig,
        groupingPlan: requestedGroupingPlan,
        ignoreSavedGroupingPlan,
        enableSplitting,
        splitConfig,
      } = payload || {};
      const content = typeof rawText === 'string' ? rawText : null;
      const finalFileType = normalizeLyricFileType({ fileType, fileName: name || filePath });
      const maxImportBytes = await getActiveLyricImportByteLimit();

      if (typeof content !== 'string' && !rawBytes && !filePath) {
        return { success: false, error: 'No lyric content available for parsing' };
      }

      let validatedFilePath = null;
      if (filePath) {
        const validated = await validateLyricImportPath(filePath, finalFileType);
        validatedFilePath = validated.normalized;
      }
      if (content !== null) {
        assertLyricImportSize(Buffer.byteLength(content, 'utf8'), maxImportBytes);
      }
      if (rawBytes) {
        assertLyricImportSize(getBinaryByteLength(rawBytes), maxImportBytes);
      }

      // Get user preferences for parsing
      const configuredOptions = buildLyricsParsingOptions(userPreferences.getParsingConfig());
      const parsingOptions = mergeLyricsParsingOptions(configuredOptions, {
        ...(typeof enableSplitting === 'boolean' ? { enableSplitting } : {}),
        ...(splitConfig && typeof splitConfig === 'object' ? { splitConfig } : {}),
        ...(groupingConfig && typeof groupingConfig === 'object' ? { groupingConfig } : {}),
      });

      if (finalFileType === 'txt') {
        const groupingContent = content ?? (
          validatedFilePath ? await readFile(validatedFilePath, 'utf8') : null
        );
        parsingOptions.groupingPlan = requestedGroupingPlan || (
          !ignoreSavedGroupingPlan && typeof groupingContent === 'string'
            ? getRememberedLyricsGrouping(validatedFilePath, groupingContent)
            : null
        );
      }

      const result = await parseLyricImportContent({
        fileType: finalFileType,
        fileName: name || filePath,
        rawText: content,
        rawBytes,
        path: validatedFilePath,
        readFile,
        parsingOptions,
      });
      if (validatedFilePath) {
        grantLyricWritePath(validatedFilePath);
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
