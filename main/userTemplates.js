import { app } from 'electron';
import path from 'path';
import fs from 'fs/promises';

const TEMPLATES_FOLDER = 'UserTemplates';
const OUTPUT_TEMPLATES_FILE = 'output-templates.json';
const STAGE_TEMPLATES_FILE = 'stage-templates.json';

function getTemplatesDir() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, TEMPLATES_FOLDER);
}

async function ensureTemplatesDir() {
  const dir = getTemplatesDir();
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
  return dir;
}

function getTemplateFilePath(type) {
  const dir = getTemplatesDir();
  const fileName = type === 'stage' ? STAGE_TEMPLATES_FILE : OUTPUT_TEMPLATES_FILE;
  return path.join(dir, fileName);
}

/**
 * Load user templates from disk
 * @param {string} type - 'output' or 'stage'
 * @returns {Promise<Array>} Array of user templates
 */
export async function loadUserTemplates(type = 'output') {
  try {
    await ensureTemplatesDir();
    const filePath = getTemplateFilePath(type);

    try {
      const content = await fs.readFile(filePath, 'utf8');
      const templates = JSON.parse(content);
      return Array.isArray(templates) ? templates : [];
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  } catch (error) {
    console.error(`[UserTemplates] Error loading ${type} templates:`, error);
    return [];
  }
}

/**
 * Save a new user template to disk
 * @param {string} type - 'output' or 'stage'
 * @param {object} template - Template object with name and settings
 * @returns {Promise<object>} Result with success status
 */
export async function saveUserTemplate(type = 'output', template) {
  try {
    if (!template || !template.name || !template.settings) {
      throw new Error('Invalid template: name and settings are required');
    }

    await ensureTemplatesDir();
    const filePath = getTemplateFilePath(type);

    const templates = await loadUserTemplates(type);

    const id = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newTemplate = {
      id,
      name: template.name.trim(),
      description: template.description || '',
      settings: { ...template.settings },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isUserTemplate: true
    };

    templates.push(newTemplate);

    await fs.writeFile(filePath, JSON.stringify(templates, null, 2), 'utf8');

    console.log(`[UserTemplates] Saved ${type} template:`, newTemplate.name);
    return { success: true, template: newTemplate };
  } catch (error) {
    console.error(`[UserTemplates] Error saving ${type} template:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a user template from disk
 * @param {string} type - 'output' or 'stage'
 * @param {string} templateId - ID of the template to delete
 * @returns {Promise<object>} Result with success status
 */
export async function deleteUserTemplate(type = 'output', templateId) {
  try {
    if (!templateId) {
      throw new Error('Template ID is required');
    }

    const filePath = getTemplateFilePath(type);
    const templates = await loadUserTemplates(type);

    const index = templates.findIndex(t => t.id === templateId);
    if (index === -1) {
      throw new Error('Template not found');
    }

    const deletedTemplate = templates[index];
    templates.splice(index, 1);

    await fs.writeFile(filePath, JSON.stringify(templates, null, 2), 'utf8');

    console.log(`[UserTemplates] Deleted ${type} template:`, deletedTemplate.name);
    return { success: true };
  } catch (error) {
    console.error(`[UserTemplates] Error deleting ${type} template:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Update an existing user template
 * @param {string} type - 'output' or 'stage'
 * @param {string} templateId - ID of the template to update
 * @param {object} updates - Object with fields to update (name, description, settings)
 * @returns {Promise<object>} Result with success status
 */
export async function updateUserTemplate(type = 'output', templateId, updates) {
  try {
    if (!templateId) {
      throw new Error('Template ID is required');
    }

    const filePath = getTemplateFilePath(type);
    const templates = await loadUserTemplates(type);

    const index = templates.findIndex(t => t.id === templateId);
    if (index === -1) {
      throw new Error('Template not found');
    }

    if (updates.name !== undefined) {
      templates[index].name = updates.name.trim();
    }
    if (updates.description !== undefined) {
      templates[index].description = updates.description;
    }
    if (updates.settings !== undefined) {
      templates[index].settings = { ...updates.settings };
    }
    templates[index].updatedAt = Date.now();

    await fs.writeFile(filePath, JSON.stringify(templates, null, 2), 'utf8');

    console.log(`[UserTemplates] Updated ${type} template:`, templates[index].name);
    return { success: true, template: templates[index] };
  } catch (error) {
    console.error(`[UserTemplates] Error updating ${type} template:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if a template name already exists
 * @param {string} type - 'output' or 'stage'
 * @param {string} name - Template name to check
 * @param {string} excludeId - Optional template ID to exclude from check (for updates)
 * @returns {Promise<boolean>} True if name exists
 */
export async function templateNameExists(type = 'output', name, excludeId = null) {
  try {
    const templates = await loadUserTemplates(type);
    const normalizedName = name.trim().toLowerCase();
    return templates.some(t =>
      t.name.toLowerCase() === normalizedName &&
      (excludeId ? t.id !== excludeId : true)
    );
  } catch (error) {
    console.error(`[UserTemplates] Error checking template name:`, error);
    return false;
  }
}