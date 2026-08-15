import { ipcMain } from 'electron';
import { loadSystemFonts } from '../systemFonts.js';
import { getLocalIPAddress } from '../utils.js';
import { isDev } from '../paths.js';
import { assertTrustedAppRenderer, normalizeBrowserUrl } from './senderValidation.js';

/**
 * Register miscellaneous IPC handlers
 * Handles fonts, IP address, and in-app browser
 */
export function registerMiscHandlers({ openInAppBrowser }) {
  const senderOptions = {
    development: isDev,
    backendPort: Number(process.env.PORT) || 4000,
  };
  
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

  ipcMain.handle('open-in-app-browser', (event, url) => {
    assertTrustedAppRenderer(event, 'open-in-app-browser', senderOptions);
    openInAppBrowser?.(normalizeBrowserUrl(url));
    return { success: true };
  });
}
