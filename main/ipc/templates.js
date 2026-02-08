import { ipcMain } from 'electron';
import * as userTemplates from '../userTemplates.js';

/**
 * Register user templates IPC handlers
 * Handles loading, saving, updating, and deleting user templates
 */
export function registerTemplatesHandlers() {
  
  ipcMain.handle('templates:load', async (_event, { type }) => {
    try {
      const templates = await userTemplates.loadUserTemplates(type);
      return { success: true, templates };
    } catch (error) {
      console.error('[UserTemplates] Error loading templates:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('templates:save', async (_event, { type, template }) => {
    try {
      const result = await userTemplates.saveUserTemplate(type, template);
      return result;
    } catch (error) {
      console.error('[UserTemplates] Error saving template:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('templates:delete', async (_event, { type, templateId }) => {
    try {
      const result = await userTemplates.deleteUserTemplate(type, templateId);
      return result;
    } catch (error) {
      console.error('[UserTemplates] Error deleting template:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('templates:update', async (_event, { type, templateId, updates }) => {
    try {
      const result = await userTemplates.updateUserTemplate(type, templateId, updates);
      return result;
    } catch (error) {
      console.error('[UserTemplates] Error updating template:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('templates:name-exists', async (_event, { type, name, excludeId }) => {
    try {
      const exists = await userTemplates.templateNameExists(type, name, excludeId);
      return { success: true, exists };
    } catch (error) {
      console.error('[UserTemplates] Error checking template name:', error);
      return { success: false, error: error.message };
    }
  });
}
