import { ipcMain } from 'electron';
import { 
  fetchLyricsByProvider, 
  getProviderDefinitions, 
  getProviderKeyState, 
  removeProviderKey, 
  saveProviderKey, 
  searchAllProviders 
} from '../lyricsProviders/index.js';

/**
 * Register lyrics provider IPC handlers
 * Handles lyrics search, fetching, and provider API key management
 */
export function registerLyricsHandlers() {
  
  ipcMain.handle('lyrics:providers:list', async () => {
    try {
      const providersList = await getProviderDefinitions();
      return { success: true, providers: providersList };
    } catch (error) {
      console.error('Failed to list lyrics providers:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('lyrics:providers:key:get', async (_event, { providerId } = {}) => {
    try {
      const key = await getProviderKeyState(providerId);
      return { success: true, key };
    } catch (error) {
      console.error('Failed to read provider key:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('lyrics:providers:key:set', async (_event, { providerId, key } = {}) => {
    try {
      if (!providerId) throw new Error('providerId is required');
      await saveProviderKey(providerId, key);
      return { success: true };
    } catch (error) {
      console.error('Failed to store provider key:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('lyrics:providers:key:delete', async (_event, { providerId } = {}) => {
    try {
      await removeProviderKey(providerId);
      return { success: true };
    } catch (error) {
      console.error('Failed to delete provider key:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('lyrics:search', async (event, { query, limit, skipCache } = {}) => {
    try {
      const result = await searchAllProviders(query, {
        limit,
        skipCache,
        onPartialResults: (partialPayload) => {
          try {
            event.sender.send('lyrics:search:partial', partialPayload);
          } catch (error) {
            console.warn('Failed to send partial lyrics results:', error);
          }
        }
      });
      return { success: true, ...result };
    } catch (error) {
      console.error('Lyrics search failed:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('lyrics:fetch', async (_event, { providerId, payload } = {}) => {
    try {
      if (!providerId) throw new Error('providerId is required');
      const lyric = await fetchLyricsByProvider(providerId, payload);
      return { success: true, lyric };
    } catch (error) {
      console.error('Lyrics fetch failed:', error);
      return { success: false, error: error.message };
    }
  });
}
