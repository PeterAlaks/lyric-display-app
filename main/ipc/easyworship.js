import { ipcMain } from 'electron';
import * as easyWorship from '../easyWorship.js';

/**
 * Register EasyWorship import IPC handlers
 * Handles EasyWorship database validation, browsing, and song import
 */
export function registerEasyWorshipHandlers({ getMainWindow }) {
  
  ipcMain.handle('easyworship:validate-path', async (_event, { path: dbPath }) => {
    try {
      return await easyWorship.validateDatabasePath(dbPath);
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
      return await easyWorship.importSong(params);
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
      return { success: true, homedir: os.homedir() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}
