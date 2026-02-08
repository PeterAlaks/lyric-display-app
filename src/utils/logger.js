// Check if verbose logging is enabled via environment or user preferences
let isVerbose = Boolean(import.meta.env.DEV || import.meta.env.MODE === 'development' || import.meta.env.VITE_ENABLE_VERBOSE_LOGS === 'true');
let userDebugLoggingEnabled = false;

/**
 * Load debug logging preference from user settings
 * Called on app startup
 */
export async function loadDebugLoggingPreference() {
  try {
    if (window.electronAPI?.preferences?.getAdvancedSettings) {
      const result = await window.electronAPI.preferences.getAdvancedSettings();
      if (result.success && result.settings) {
        userDebugLoggingEnabled = result.settings.enableDebugLogging ?? false;
        if (userDebugLoggingEnabled) {
          console.info('[Logger] Debug logging enabled via user preferences');
        }
      }
    }
  } catch (error) {
    console.warn('[Logger] Failed to load debug logging preference:', error);
  }
}

/**
 * Check if debug logging is currently enabled
 */
export function isDebugLoggingEnabled() {
  return isVerbose || userDebugLoggingEnabled;
}

/**
 * Enable or disable debug logging at runtime
 */
export function setDebugLogging(enabled) {
  userDebugLoggingEnabled = enabled;
}

export const logDebug = (...args) => {
  if (isVerbose || userDebugLoggingEnabled) {
    console.debug(...args);
  }
};

export const logInfo = (...args) => {
  if (isVerbose || userDebugLoggingEnabled) {
    console.info(...args);
  }
};

export const logWarn = (...args) => {
  console.warn(...args);
};

export const logError = (...args) => {
  console.error(...args);
};
