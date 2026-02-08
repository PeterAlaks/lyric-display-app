/**
 * External Control Bridge
 * Connects MIDI and OSC controllers to the renderer process
 * Translates external control actions into IPC messages
 */

import { ipcMain, BrowserWindow } from 'electron';
import { getMIDIController, initializeMIDI, destroyMIDI } from './midiController.js';
import { getOSCController, initializeOSC, destroyOSC } from './oscController.js';

let isInitialized = false;
let getMainWindowFn = null;

/**
 * Send an action to the renderer process
 */
function sendToRenderer(action) {
  const mainWindow = getMainWindowFn?.();
  if (!mainWindow || mainWindow.isDestroyed()) {
    console.warn('[ExternalControl] No main window available for action:', action.type);
    return false;
  }

  try {
    mainWindow.webContents.send('external-control:action', action);
    return true;
  } catch (error) {
    console.error('[ExternalControl] Error sending action to renderer:', error);
    return false;
  }
}

/**
 * Handle actions from MIDI controller
 */
function handleMIDIAction(action) {
  console.log('[ExternalControl] MIDI action:', action.type);
  sendToRenderer(action);
}

/**
 * Handle actions from OSC controller
 */
function handleOSCAction(action) {
  console.log('[ExternalControl] OSC action:', action.type);
  sendToRenderer(action);
}

/**
 * Initialize external control systems
 */
export async function initializeExternalControl(options = {}) {
  if (isInitialized) {
    return { success: true, message: 'Already initialized' };
  }

  getMainWindowFn = options.getMainWindow;

  const results = {
    midi: { success: false, error: null },
    osc: { success: false, error: null }
  };

  // Initialize MIDI
  try {
    const midiResult = await initializeMIDI();
    results.midi = midiResult;
    
    if (midiResult.success) {
      const midiController = getMIDIController();
      midiController.on('action', handleMIDIAction);
    }
  } catch (error) {
    console.error('[ExternalControl] MIDI initialization error:', error);
    results.midi = { success: false, error: error.message };
  }

  // Initialize OSC
  try {
    const oscResult = await initializeOSC();
    results.osc = oscResult;
    
    if (oscResult.success) {
      const oscController = getOSCController();
      oscController.on('action', handleOSCAction);
    }
  } catch (error) {
    console.error('[ExternalControl] OSC initialization error:', error);
    results.osc = { success: false, error: error.message };
  }

  isInitialized = true;
  console.log('[ExternalControl] Initialization complete:', results);
  return { success: true, results };
}

/**
 * Update OSC state for feedback
 */
export function updateOSCState(updates) {
  try {
    const oscController = getOSCController();
    if (oscController) {
      oscController.updateState(updates);
    }
  } catch (error) {
    // OSC might not be initialized
  }
}

/**
 * Register IPC handlers for external control
 */
export function registerExternalControlIPC() {
  // ============ MIDI IPC Handlers ============

  ipcMain.handle('midi:initialize', async () => {
    try {
      const result = await initializeMIDI();
      if (result.success) {
        const controller = getMIDIController();
        controller.on('action', handleMIDIAction);
      }
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('midi:get-status', () => {
    try {
      const controller = getMIDIController();
      return { success: true, status: controller.getStatus() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('midi:refresh-ports', () => {
    try {
      const controller = getMIDIController();
      const ports = controller.refreshPorts();
      return { success: true, ports };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('midi:select-port', async (_event, { portIndex }) => {
    try {
      const controller = getMIDIController();
      return await controller.selectPort(portIndex);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('midi:enable', () => {
    try {
      const controller = getMIDIController();
      return controller.enable();
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('midi:disable', () => {
    try {
      const controller = getMIDIController();
      return controller.disable();
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('midi:set-mapping', (_event, { type, key, mapping }) => {
    try {
      const controller = getMIDIController();
      return controller.setMapping(type, key, mapping);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('midi:remove-mapping', (_event, { type, key }) => {
    try {
      const controller = getMIDIController();
      return controller.removeMapping(type, key);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('midi:reset-mappings', () => {
    try {
      const controller = getMIDIController();
      return controller.resetMappings();
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('midi:start-learn', async (_event, { timeout }) => {
    try {
      const controller = getMIDIController();
      const result = await controller.startLearnMode(timeout || 10000);
      return { success: true, learned: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ============ OSC IPC Handlers ============

  ipcMain.handle('osc:initialize', async () => {
    try {
      const result = await initializeOSC();
      if (result.success) {
        const controller = getOSCController();
        controller.on('action', handleOSCAction);
      }
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('osc:get-status', () => {
    try {
      const controller = getOSCController();
      return { success: true, status: controller.getStatus() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('osc:enable', () => {
    try {
      const controller = getOSCController();
      return controller.enable();
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('osc:disable', () => {
    try {
      const controller = getOSCController();
      return controller.disable();
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('osc:set-port', (_event, { port }) => {
    try {
      const controller = getOSCController();
      return controller.setPort(port);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('osc:set-feedback-port', (_event, { port }) => {
    try {
      const controller = getOSCController();
      return controller.setFeedbackPort(port);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('osc:set-address-prefix', (_event, { prefix }) => {
    try {
      const controller = getOSCController();
      return controller.setAddressPrefix(prefix);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('osc:set-feedback-enabled', (_event, { enabled }) => {
    try {
      const controller = getOSCController();
      return controller.setFeedbackEnabled(enabled);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('osc:get-supported-addresses', () => {
    try {
      const controller = getOSCController();
      return { success: true, addresses: controller.getSupportedAddresses() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('osc:send-feedback', (_event, { address, args }) => {
    try {
      const controller = getOSCController();
      controller.sendFeedbackMessage(address, args);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ============ Combined Status ============

  ipcMain.handle('external-control:get-status', () => {
    try {
      const midiController = getMIDIController();
      const oscController = getOSCController();
      
      return {
        success: true,
        midi: midiController?.getStatus() || { initialized: false },
        osc: oscController?.getStatus() || { initialized: false }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  console.log('[ExternalControl] IPC handlers registered');
}

/**
 * Cleanup external control systems
 */
export function destroyExternalControl() {
  destroyMIDI();
  destroyOSC();
  isInitialized = false;
  getMainWindowFn = null;
  console.log('[ExternalControl] Destroyed');
}

export default {
  initializeExternalControl,
  registerExternalControlIPC,
  destroyExternalControl,
  updateOSCState
};
