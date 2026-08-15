import { app, ipcMain } from 'electron';
import * as presentation from '../presentation.js';
import { addFileNavigatorRoot, refreshFileInNavigator } from '../fileNavigator.js';

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
      const result = await presentation.importPresentation(params);
      if (result.success && result.filePath) {
        try {
          await addFileNavigatorRoot(params.destinationPath);
          await refreshFileInNavigator(result.filePath);
        } catch (indexError) {
          console.warn('Presentation lyrics were imported but the destination could not be indexed:', indexError?.message || indexError);
        }
      }
      return result;
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
      return {
        success: true,
        homedir: os.homedir(),
        documentsPath: app.getPath('documents'),
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}
