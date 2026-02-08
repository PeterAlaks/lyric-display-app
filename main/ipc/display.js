import { ipcMain, BrowserWindow } from 'electron';
import * as displayManager from '../displayManager.js';

/**
 * Register display management IPC handlers
 * Handles display detection, assignments, and output window management
 */
export function registerDisplayHandlers({ getMainWindow, requestRendererModal }) {
  
  ipcMain.handle('display:open-settings-modal', async () => {
    try {
      if (typeof requestRendererModal !== 'function') {
        return { success: false, error: 'Modal bridge unavailable' };
      }
      const { showDisplayDetectionModal } = await import('../displayDetection.js');
      const displays = displayManager.getAllDisplays();
      const externalDisplays = displays.filter(d => !d.primary);

      if (!externalDisplays || externalDisplays.length === 0) {
        return { success: false, error: 'No external displays connected' };
      }

      await showDisplayDetectionModal(externalDisplays, false, requestRendererModal, true);
      return { success: true };
    } catch (error) {
      console.error('Error opening display settings modal:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('display:get-all', async () => {
    try {
      const displays = displayManager.getAllDisplays();
      return { success: true, displays };
    } catch (error) {
      console.error('Error getting displays:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('display:get-primary', async () => {
    try {
      const display = displayManager.getPrimaryDisplay();
      return { success: true, display };
    } catch (error) {
      console.error('Error getting primary display:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('display:get-by-id', async (_event, { displayId }) => {
    try {
      const display = displayManager.getDisplayById(displayId);
      if (!display) {
        return { success: false, error: 'Display not found' };
      }
      return { success: true, display };
    } catch (error) {
      console.error('Error getting display by ID:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('display:save-assignment', async (_event, { displayId, outputKey }) => {
    try {
      if (!outputKey) {
        displayManager.removeDisplayAssignment(displayId);
        return { success: true };
      }

      displayManager.saveDisplayAssignment(displayId, outputKey);

      const windows = BrowserWindow.getAllWindows();
      const outputRoute = outputKey === 'stage' ? '/stage' : outputKey === 'output1' ? '/output1' : '/output2';

      for (const win of windows) {
        if (!win || win.isDestroyed()) continue;
        try {
          const url = win.webContents.getURL();
          if (url.includes(outputRoute)) {
            displayManager.moveWindowToDisplay(win, displayId, true);
            break;
          }
        } catch (err) {
          console.warn('Error checking window URL:', err);
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error saving display assignment:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('display:get-assignment', async (_event, { displayId }) => {
    try {
      const assignment = displayManager.getDisplayAssignment(displayId);
      return { success: true, assignment };
    } catch (error) {
      console.error('Error getting display assignment:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('display:get-all-assignments', async () => {
    try {
      const assignments = displayManager.getAllDisplayAssignments();
      return { success: true, assignments };
    } catch (error) {
      console.error('Error getting all display assignments:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('display:remove-assignment', async (_event, { displayId }) => {
    try {
      displayManager.removeDisplayAssignment(displayId);
      return { success: true };
    } catch (error) {
      console.error('Error removing display assignment:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('display:open-output-on-display', async (_event, { outputKey, displayId }) => {
    try {
      const { createWindow } = await import('../windows.js');
      const route = outputKey === 'stage' ? '/stage' : outputKey === 'output1' ? '/output1' : '/output2';

      const windows = BrowserWindow.getAllWindows();
      let existingWindow = null;

      for (const win of windows) {
        if (!win || win.isDestroyed()) continue;
        try {
          const url = win.webContents.getURL();
          if (url.includes(route)) {
            existingWindow = win;
            break;
          }
        } catch (err) {
          console.warn('Error checking window URL:', err);
        }
      }

      let win;
      if (existingWindow) {
        win = existingWindow;
        console.log('[IPC] Using existing window for', route);
      } else {
        win = createWindow(route);
        console.log('[IPC] Created new window for', route);

        await new Promise(resolve => {
          win.webContents.once('did-finish-load', () => {
            setTimeout(resolve, 300);
          });
        });
      }

      if (displayId) {
        displayManager.moveWindowToDisplay(win, displayId, true);
      }

      return { success: true };
    } catch (error) {
      console.error('Error opening output on display:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('display:close-output-window', async (_event, { outputKey }) => {
    try {
      const route = outputKey === 'stage' ? '/stage' : outputKey === 'output1' ? '/output1' : '/output2';
      const windows = BrowserWindow.getAllWindows();

      for (const win of windows) {
        if (!win || win.isDestroyed()) continue;
        try {
          const url = win.webContents.getURL();
          if (url.includes(route)) {
            console.log('[IPC] Closing output window for', route);
            win.close();
            return { success: true };
          }
        } catch (err) {
          console.warn('Error checking window URL:', err);
        }
      }

      return { success: false, error: 'Window not found' };
    } catch (error) {
      console.error('Error closing output window:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('open-output-window', async (_event, outputNumber) => {
    try {
      const route = outputNumber === 1 ? '/output1' : '/output2';
      const { createWindow } = await import('../windows.js');
      createWindow(route);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}
