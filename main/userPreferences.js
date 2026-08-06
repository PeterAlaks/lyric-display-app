/**
 * User Preferences Store
 * Centralized storage for all user-configurable application settings
 */

import Store from 'electron-store';
import './appIdentity.js';
import { DEFAULT_SETLIST_ITEMS, normalizeSetlistItemLimit } from '../shared/setlistLimits.js';
import { DEFAULT_CAPITALIZED_WORDS } from '../shared/capitalizedWords.js';
import { DEFAULT_SECTION_TAG_PHRASES } from '../shared/sectionTagPhrases.js';
import { DEFAULT_APPEARANCE_TRANSITIONS } from '../shared/transitionSettings.js';
import {
  CURRENT_PREFERENCES_SCHEMA_VERSION,
  migratePreferences,
} from './preferenceMigrations.js';
import { toStorageWriteFailure } from '../shared/storageErrors.js';

const preferenceWriteFailure = (error) => toStorageWriteFailure(error, {
  subject: 'preferences',
  fallback: 'Preferences could not be saved.',
});

const preferencesStore = new Store({
  name: 'user-preferences',
  defaults: {
    // General Settings
    general: {
      autoCheckForUpdates: true,
      confirmOnClose: true,
      liveSafetyMode: false,
      previewLines: false,
      toastSoundsMuted: false,
      skipSectionTitlesOnKeyboard: true,
      startMinimized: false,
      minimizeToTray: false,
    },

    // Lyrics Parsing Settings
    parsing: {
      enableAutoLineGrouping: true,
      enableTranslationGrouping: true,
      maxLineLength: 45,
      maxLinesPerGroup: 2,
      enableCrossBlankLineGrouping: true,
      structureTagMode: 'isolate', // 'isolate', 'strip', 'keep'
      sectionTagPhrases: [...DEFAULT_SECTION_TAG_PHRASES],
    },

    // Lyrics Formatting Settings
    formatting: {
      enableCleanupOnPaste: true,
      capitalizeFirstLetter: true,
      capitalizeReligiousTerms: true,
      capitalizedWords: [...DEFAULT_CAPITALIZED_WORDS],
      normalizeTypographicChars: true,
    },

    // Line Splitting Settings
    lineSplitting: {
      enabled: true,
      targetLength: 60,
      minLength: 40,
      maxLength: 80,
      overflowTolerance: 15,
    },

    // External Control (MIDI/OSC)
    externalControl: {
      midi: {
        enabled: false,
        selectedPortIndex: -1,
        mappings: null, // null means use defaults
      },
      osc: {
        enabled: false,
        port: 8000,
        feedbackEnabled: false,
        feedbackPort: 9000,
        addressPrefix: '/lyricdisplay',
      },
    },

    // Autoplay Settings
    autoplay: {
      defaultInterval: 5,
      defaultLoop: true,
      defaultStartFromFirst: true,
      defaultSkipBlankLines: true,
    },

    // File Handling
    fileHandling: {
      rememberLastOpenedPath: true,
      maxRecentFiles: 10,
      maxFileSize: 2, // MB
      maxSetlistFiles: DEFAULT_SETLIST_ITEMS,
      fileNavigatorSort: 'name-asc',
    },

    // Appearance Settings
    appearance: {
      themeMode: 'light', // 'light', 'dark', 'system'
      showTooltips: true,
      showTutorialPopovers: true,
      showCanvasFloatingToolbar: true,
      ...DEFAULT_APPEARANCE_TRANSITIONS,
    },

    // Advanced Settings
    advanced: {
      enableDebugLogging: false,
      disableHardwareAcceleration: false,
      connectionTimeout: 10000,
      heartbeatInterval: 30000,
      maxConnectionAttempts: 10,
      ffmpegPath: '',
      shareAnonymousUsageData: false,
      telemetryConsentDecided: false,
    },
  },
});

const preferenceMigration = migratePreferences(preferencesStore.store);
if (preferenceMigration.success && preferenceMigration.changed) {
  preferencesStore.store = preferenceMigration.preferences;
  console.log(`[UserPreferences] Migrated schema ${preferenceMigration.sourceVersion} to ${CURRENT_PREFERENCES_SCHEMA_VERSION}`);
} else if (!preferenceMigration.success) {
  console.warn(`[UserPreferences] ${preferenceMigration.error}; existing preferences were left unchanged`);
}

/**
 * Get all preferences
 * @returns {object} All user preferences
 */
export function getAllPreferences() {
  try {
    return {
      general: preferencesStore.get('general'),
      appearance: preferencesStore.get('appearance'),
      parsing: preferencesStore.get('parsing'),
      formatting: preferencesStore.get('formatting'),
      lineSplitting: preferencesStore.get('lineSplitting'),
      externalControl: preferencesStore.get('externalControl'),
      autoplay: preferencesStore.get('autoplay'),
      fileHandling: preferencesStore.get('fileHandling'),
      advanced: preferencesStore.get('advanced'),
    };
  } catch (error) {
    console.error('[UserPreferences] Failed to get preferences:', error);
    return preferencesStore.store;
  }
}

/**
 * Get a specific preference category
 * @param {string} category - Category name (general, parsing, etc.)
 * @returns {object} Category preferences
 */
export function getPreferenceCategory(category) {
  try {
    return preferencesStore.get(category);
  } catch (error) {
    console.error(`[UserPreferences] Failed to get category ${category}:`, error);
    return null;
  }
}

/**
 * Get a specific preference value
 * @param {string} path - Dot-notation path (e.g., 'general.confirmOnClose')
 * @returns {any} Preference value
 */
export function getPreference(path) {
  try {
    return preferencesStore.get(path);
  } catch (error) {
    console.error(`[UserPreferences] Failed to get preference ${path}:`, error);
    return null;
  }
}

/**
 * Set a specific preference value
 * @param {string} path - Dot-notation path (e.g., 'general.confirmOnClose')
 * @param {any} value - Value to set
 */
export function setPreference(path, value) {
  try {
    preferencesStore.set(path, value);
    console.log(`[UserPreferences] Set ${path}:`, value);
    return { success: true };
  } catch (error) {
    console.error(`[UserPreferences] Failed to set preference ${path}:`, error);
    return { success: false, ...preferenceWriteFailure(error) };
  }
}

/**
 * Update an entire preference category
 * @param {string} category - Category name
 * @param {object} values - New values for the category
 */
export function updatePreferenceCategory(category, values) {
  try {
    const current = preferencesStore.get(category) || {};
    preferencesStore.set(category, { ...current, ...values });
    console.log(`[UserPreferences] Updated category ${category}`);
    return { success: true };
  } catch (error) {
    console.error(`[UserPreferences] Failed to update category ${category}:`, error);
    return { success: false, ...preferenceWriteFailure(error) };
  }
}

/**
 * Save all preferences at once
 * @param {object} preferences - Complete preferences object
 */
export function saveAllPreferences(preferences) {
  try {
    const nextPreferences = { ...preferencesStore.store };
    Object.entries(preferences).forEach(([category, values]) => {
      if (values && typeof values === 'object') {
        nextPreferences[category] = values;
      }
    });
    preferencesStore.store = nextPreferences;
    console.log('[UserPreferences] Saved all preferences');
    return { success: true };
  } catch (error) {
    console.error('[UserPreferences] Failed to save preferences:', error);
    return { success: false, ...preferenceWriteFailure(error) };
  }
}

/**
 * Reset a category to defaults
 * @param {string} category - Category name
 */
export function resetCategoryToDefaults(category) {
  try {
    const defaults = preferencesStore.store;
    if (defaults[category]) {
      preferencesStore.reset(category);
      console.log(`[UserPreferences] Reset category ${category} to defaults`);
    }
    return { success: true };
  } catch (error) {
    console.error(`[UserPreferences] Failed to reset category ${category}:`, error);
    return { success: false, ...preferenceWriteFailure(error) };
  }
}

/**
 * Reset all preferences to defaults
 */
export function resetAllToDefaults() {
  try {
    preferencesStore.clear();
    preferencesStore.set('_schemaVersion', CURRENT_PREFERENCES_SCHEMA_VERSION);
    console.log('[UserPreferences] Reset all preferences to defaults');
    return { success: true };
  } catch (error) {
    console.error('[UserPreferences] Failed to reset preferences:', error);
    return { success: false, ...preferenceWriteFailure(error) };
  }
}

/**
 * Get parsing configuration for use in lyrics parser
 * @returns {object} Parsing configuration
 */
export function getParsingConfig() {
  try {
    const parsing = preferencesStore.get('parsing');
    const lineSplitting = preferencesStore.get('lineSplitting');

    return {
      enableSplitting: lineSplitting?.enabled ?? true,
      splitConfig: {
        TARGET_LENGTH: lineSplitting?.targetLength ?? 60,
        MIN_LENGTH: lineSplitting?.minLength ?? 40,
        MAX_LENGTH: lineSplitting?.maxLength ?? 80,
        OVERFLOW_TOLERANCE: lineSplitting?.overflowTolerance ?? 15,
      },
      normalGroupConfig: {
        ENABLED: parsing?.enableAutoLineGrouping ?? true,
        MAX_LINE_LENGTH: parsing?.maxLineLength ?? 45,
        MAX_LINES_PER_GROUP: parsing?.maxLinesPerGroup ?? 2,
        CROSS_BLANK_LINE_GROUPING: parsing?.enableCrossBlankLineGrouping ?? true,
      },
      structureTagsConfig: {
        ENABLED: true,
        MODE: parsing?.structureTagMode ?? 'isolate',
        PHRASES: parsing?.sectionTagPhrases ?? DEFAULT_SECTION_TAG_PHRASES,
      },
      enableTranslationGrouping: parsing?.enableTranslationGrouping ?? true,
    };
  } catch (error) {
    console.error('[UserPreferences] Failed to get parsing config:', error);
    return {
      enableSplitting: true,
      splitConfig: {
        TARGET_LENGTH: 60,
        MIN_LENGTH: 40,
        MAX_LENGTH: 80,
        OVERFLOW_TOLERANCE: 15,
      },
    };
  }
}

/**
 * Get autoplay defaults for the renderer
 * @returns {object} Autoplay settings in the format expected by the store
 */
export function getAutoplayDefaults() {
  try {
    const autoplay = preferencesStore.get('autoplay');
    return {
      interval: autoplay?.defaultInterval ?? 5,
      loop: autoplay?.defaultLoop ?? true,
      startFromFirst: autoplay?.defaultStartFromFirst ?? true,
      skipBlankLines: autoplay?.defaultSkipBlankLines ?? true,
    };
  } catch (error) {
    console.error('[UserPreferences] Failed to get autoplay defaults:', error);
    return {
      interval: 5,
      loop: true,
      startFromFirst: true,
      skipBlankLines: true,
    };
  }
}

/**
 * Get advanced settings for connection management
 * @returns {object} Advanced connection settings
 */
export function getAdvancedSettings() {
  try {
    const advanced = preferencesStore.get('advanced');
    return {
      enableDebugLogging: advanced?.enableDebugLogging ?? false,
      disableHardwareAcceleration: advanced?.disableHardwareAcceleration ?? false,
      connectionTimeout: advanced?.connectionTimeout ?? 10000,
      heartbeatInterval: advanced?.heartbeatInterval ?? 30000,
      maxConnectionAttempts: advanced?.maxConnectionAttempts ?? 10,
    };
  } catch (error) {
    console.error('[UserPreferences] Failed to get advanced settings:', error);
    return {
      enableDebugLogging: false,
      disableHardwareAcceleration: false,
      connectionTimeout: 10000,
      heartbeatInterval: 30000,
      maxConnectionAttempts: 10,
    };
  }
}

/**
 * Get file handling settings
 * @returns {object} File handling settings
 */
export function getFileHandlingSettings() {
  try {
    const fileHandling = preferencesStore.get('fileHandling');
    return {
      maxRecentFiles: fileHandling?.maxRecentFiles ?? 10,
      maxFileSize: fileHandling?.maxFileSize ?? 2,
      maxSetlistFiles: normalizeSetlistItemLimit(fileHandling?.maxSetlistFiles),
      fileNavigatorSort: fileHandling?.fileNavigatorSort ?? 'name-asc',
    };
  } catch (error) {
    console.error('[UserPreferences] Failed to get file handling settings:', error);
    return {
      maxRecentFiles: 10,
      maxFileSize: 2,
      maxSetlistFiles: DEFAULT_SETLIST_ITEMS,
      fileNavigatorSort: 'name-asc',
    };
  }
}

/**
 * Export preferences to JSON
 * @returns {string} JSON string of preferences
 */
export function exportPreferences() {
  try {
    return JSON.stringify(getAllPreferences(), null, 2);
  } catch (error) {
    console.error('[UserPreferences] Failed to export preferences:', error);
    return null;
  }
}

/**
 * Import preferences from JSON
 * @param {string} jsonString - JSON string of preferences
 * @returns {object} Result with success status
 */
export function importPreferences(jsonString) {
  try {
    const imported = JSON.parse(jsonString);
    return saveAllPreferences(imported);
  } catch (error) {
    console.error('[UserPreferences] Failed to import preferences:', error);
    return { success: false, error: error.message };
  }
}

export default preferencesStore;
