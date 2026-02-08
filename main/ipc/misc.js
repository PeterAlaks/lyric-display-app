import { ipcMain } from 'electron';
import { loadSystemFonts } from '../systemFonts.js';
import { getLocalIPAddress } from '../utils.js';

/**
 * Register miscellaneous IPC handlers
 * Handles fonts, IP address, and in-app browser
 */
export function registerMiscHandlers({ openInAppBrowser }) {
  
  ipcMain.handle('fonts:list', async () => {
    try {
      const fonts = await loadSystemFonts();
      return { success: true, fonts: fonts || [] };
    } catch (error) {
      console.error('Error listing system fonts:', error);
      return { success: false, error: error.message, fonts: [] };
    }
  });

  ipcMain.handle('get-local-ip', () => getLocalIPAddress());

  ipcMain.handle('open-in-app-browser', (_event, url) => {
    openInAppBrowser?.(url || 'https://www.google.com');
  });
}
