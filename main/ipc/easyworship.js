import { app, ipcMain } from 'electron';
import * as easyWorship from '../easyWorship.js';
import { addFileNavigatorRoot, refreshFileInNavigator } from '../fileNavigator.js';

/**
 * Register EasyWorship import IPC handlers
 * Handles EasyWorship database validation, browsing, and song import
 */
export function registerEasyWorshipHandlers({ getMainWindow }) {
  
  ipcMain.handle('easyworship:validate-path', async (_event, { path: dbPath, version }) => {
    try {
      return await easyWorship.validateDatabasePath(dbPath, { version });
    } catch (error) {
      console.error('Error validating EasyWorship path:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('easyworship:browse-path', async () => {
    try {
      const win = getMainWindow?.();
      return await easyWorship.browseForDatabasePath(win);
    } catch (error) {
      console.error('Error browsing for database path:', error);
      return { canceled: true, error: error.message };
    }
  });

  ipcMain.handle('easyworship:browse-destination', async () => {
    try {
      const win = getMainWindow?.();
      return await easyWorship.browseForDestinationPath(win);
    } catch (error) {
      console.error('Error browsing for destination:', error);
      return { canceled: true, error: error.message };
    }
  });

  ipcMain.handle('easyworship:import-song', async (_event, params) => {
    try {
      const result = await easyWorship.importSong(params);
      if (result.success && result.filePath) {
        try {
          await addFileNavigatorRoot(params.destinationPath);
          await refreshFileInNavigator(result.filePath);
        } catch (indexError) {
          console.warn('EasyWorship lyrics were imported but the destination could not be indexed:', indexError?.message || indexError);
        }
      }
      return result;
    } catch (error) {
      console.error('Error importing song:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('easyworship:open-folder', async (_event, { path: folderPath }) => {
    try {
      await easyWorship.openFolder(folderPath);
      return { success: true };
    } catch (error) {
      console.error('Error opening folder:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('easyworship:get-user-home', async () => {
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
