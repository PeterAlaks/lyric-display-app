import { ipcMain } from 'electron';
import * as presentation from '../presentation.js';

/**
 * Register presentation import IPC handlers
 * Handles presentation path validation, browsing, and file import
 */
export function registerPresentationHandlers({ getMainWindow }) {

  ipcMain.handle('presentation:validate-path', async (_event, { path: folderPath }) => {
    try {
      return await presentation.validatePresentationPath(folderPath);
    } catch (error) {
      console.error('Error validating presentation path:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('presentation:browse-path', async () => {
    try {
      const win = getMainWindow?.();
      return await presentation.browseForPresentationPath(win);
    } catch (error) {
      console.error('Error browsing for presentation path:', error);
      return { canceled: true, error: error.message };
    }
  });

  ipcMain.handle('presentation:browse-destination', async () => {
    try {
      const win = getMainWindow?.();
      return await presentation.browseForDestinationPath(win);
    } catch (error) {
      console.error('Error browsing for presentation destination:', error);
      return { canceled: true, error: error.message };
    }
  });

  ipcMain.handle('presentation:import-file', async (_event, params) => {
    try {
      return await presentation.importPresentation(params);
    } catch (error) {
      console.error('Error importing presentation:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('presentation:open-folder', async (_event, { path: folderPath }) => {
    try {
      await presentation.openFolder(folderPath);
      return { success: true };
    } catch (error) {
      console.error('Error opening presentation import folder:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('presentation:get-user-home', async () => {
    try {
      const os = await import('os');
      return { success: true, homedir: os.homedir() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}
