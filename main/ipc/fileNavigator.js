import { BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { stat } from 'fs/promises';
import {
  addFileNavigatorRoots,
  browseFileNavigator,
  createFileNavigatorLyricsFolder,
  getFileNavigatorPreview,
  getFileNavigatorSaveDestinations,
  getFileNavigatorState,
  prepareFileNavigatorSave,
  rebuildFileNavigatorIndex,
  removeFileNavigatorRoot,
  resolveFileNavigatorSelection,
  searchFileNavigator,
} from '../fileNavigator.js';
import { readLyricsFileFromPath } from '../lyricFiles.js';

function errorResult(error, fallback) {
  return { success: false, error: error?.message || fallback };
}

export function registerFileNavigatorHandlers({ getMainWindow }) {
  ipcMain.handle('file-navigator:get-state', async () => {
    try {
      return { success: true, ...(await getFileNavigatorState()) };
    } catch (error) {
      return errorResult(error, 'Could not initialize the file navigator');
    }
  });

  ipcMain.handle('file-navigator:save-destinations', async (_event, preferredDirectory = null) => {
    try {
      return {
        success: true,
        destinations: await getFileNavigatorSaveDestinations(preferredDirectory),
      };
    } catch (error) {
      return errorResult(error, 'Could not load indexed save folders');
    }
  });

  ipcMain.handle('file-navigator:add-root', async (event) => {
    try {
      const senderWindow = event?.sender ? BrowserWindow.fromWebContents(event.sender) : null;
      const win = senderWindow && !senderWindow.isDestroyed()
        ? senderWindow
        : getMainWindow?.();
      const current = await getFileNavigatorState();
      const result = await dialog.showOpenDialog(win || undefined, {
        title: 'Add Lyrics Folders',
        buttonLabel: 'Index selected folders',
        properties: ['openDirectory', 'multiSelections'],
        defaultPath: current.roots?.[0]?.path || undefined,
      });
      if (result.canceled || !result.filePaths?.length) {
        return { success: false, canceled: true };
      }
      return { success: true, ...(await addFileNavigatorRoots(result.filePaths)) };
    } catch (error) {
      return errorResult(error, 'Could not add the selected folders');
    }
  });

  ipcMain.handle('file-navigator:create-lyrics-folder', async () => {
    try {
      return { success: true, ...(await createFileNavigatorLyricsFolder()) };
    } catch (error) {
      return errorResult(error, 'Could not create the Lyrics folder');
    }
  });

  ipcMain.handle('file-navigator:remove-root', async (_event, rootPath) => {
    try {
      return { success: true, ...(await removeFileNavigatorRoot(rootPath)) };
    } catch (error) {
      return errorResult(error, 'Could not remove the folder');
    }
  });

  ipcMain.handle('file-navigator:reindex', async () => {
    try {
      return { success: true, ...(await rebuildFileNavigatorIndex()) };
    } catch (error) {
      return errorResult(error, 'Could not refresh the file index');
    }
  });

  ipcMain.handle('file-navigator:search', async (_event, payload = {}) => {
    try {
      return { success: true, results: await searchFileNavigator(payload) };
    } catch (error) {
      return errorResult(error, 'Could not search indexed lyric files');
    }
  });

  ipcMain.handle('file-navigator:browse', async (_event, directoryPath) => {
    try {
      return { success: true, ...(await browseFileNavigator(directoryPath)) };
    } catch (error) {
      return errorResult(error, 'Could not browse the selected folder');
    }
  });

  ipcMain.handle('file-navigator:preview', async (_event, filePath) => {
    try {
      return { success: true, ...(await getFileNavigatorPreview(filePath)) };
    } catch (error) {
      return errorResult(error, 'Could not preview the selected file');
    }
  });

  ipcMain.handle('file-navigator:prepare-save', async (_event, payload = {}) => {
    try {
      return { success: true, ...(await prepareFileNavigatorSave(payload)) };
    } catch (error) {
      return errorResult(error, 'Could not use the selected save destination');
    }
  });

  ipcMain.handle('file-navigator:open', async (_event, filePath) => {
    try {
      const resolved = await resolveFileNavigatorSelection(filePath);
      const payload = await readLyricsFileFromPath(resolved);
      return { success: true, ...payload };
    } catch (error) {
      return errorResult(error, 'Could not load the selected lyrics file');
    }
  });

  ipcMain.handle('file-navigator:open-many', async (_event, filePaths = []) => {
    try {
      const requestedPaths = [...new Set((Array.isArray(filePaths) ? filePaths : [])
        .filter((filePath) => typeof filePath === 'string' && filePath.trim()))]
        .slice(0, 100);
      if (requestedPaths.length === 0) throw new Error('No lyric files selected');
      const files = await Promise.all(requestedPaths.map(async (filePath) => {
        const resolved = await resolveFileNavigatorSelection(filePath);
        const payload = await readLyricsFileFromPath(resolved, {
          remember: false,
          grantWrite: false,
        });
        const fileStat = await stat(resolved);
        return {
          name: payload.fileName,
          content: payload.content,
          fileType: payload.fileType,
          filePath: payload.filePath,
          lastModified: fileStat.mtimeMs,
        };
      }));
      return { success: true, files };
    } catch (error) {
      return errorResult(error, 'Could not load the selected lyric files');
    }
  });

  ipcMain.handle('file-navigator:reveal', async (_event, filePath) => {
    try {
      const resolved = await resolveFileNavigatorSelection(filePath);
      shell.showItemInFolder(resolved);
      return { success: true };
    } catch (error) {
      return errorResult(error, 'Could not reveal the selected file');
    }
  });
}
