/**
 * IPC Handlers Index
 * Central registration point for all IPC handlers
 * 
 * This module breaks down the monolithic ipc.js into logical, maintainable groups:
 * - app: App-level handlers (version, dark mode)
 * - window: Window controls (minimize, maximize, close, fullscreen, etc.)
 * - files: File operations (load, save, parse lyrics)
 * - recents: Recent files management
 * - auth: Authentication (admin key, JWT, join code, token store)
 * - lyrics: Lyrics providers (search, fetch, provider keys)
 * - easyworship: EasyWorship import handlers
 * - setlist: Setlist operations (save, load, browse, export)
 * - display: Display management (assignments, output windows)
 * - updater: App updater controls
 * - templates: User templates handlers
 * - preferences: User preferences handlers
 * - misc: Miscellaneous (fonts, IP address, browser)
 */

import { registerAppHandlers } from './app.js';
import { registerWindowHandlers } from './window.js';
import { registerFileHandlers } from './files.js';
import { registerRecentsHandlers } from './recents.js';
import { registerAuthHandlers } from './auth.js';
import { registerLyricsHandlers } from './lyrics.js';
import { registerEasyWorshipHandlers } from './easyworship.js';
import { registerSetlistHandlers } from './setlist.js';
import { registerDisplayHandlers } from './display.js';
import { registerUpdaterHandlers } from './updater.js';
import { registerTemplatesHandlers } from './templates.js';
import { registerPreferencesHandlers } from './preferences.js';
import { registerMiscHandlers } from './misc.js';

/**
 * Register all IPC handlers
 * @param {Object} context - Context object containing helper functions
 * @param {Function} context.getMainWindow - Function to get the main window
 * @param {Function} context.openInAppBrowser - Function to open in-app browser
 * @param {Function} context.updateDarkModeMenu - Function to update dark mode menu
 * @param {Function} context.updateUndoRedoState - Function to update undo/redo state
 * @param {Function} context.checkForUpdates - Function to check for updates
 * @param {Function} context.requestRendererModal - Function to request renderer modal
 */
export function registerIpcHandlers(context) {
  // Register all handler groups
  registerAppHandlers(context);
  registerWindowHandlers(context);
  registerFileHandlers(context);
  registerRecentsHandlers(context);
  registerAuthHandlers(context);
  registerLyricsHandlers(context);
  registerEasyWorshipHandlers(context);
  registerSetlistHandlers(context);
  registerDisplayHandlers(context);
  registerUpdaterHandlers(context);
  registerTemplatesHandlers(context);
  registerPreferencesHandlers(context);
  registerMiscHandlers(context);
}
