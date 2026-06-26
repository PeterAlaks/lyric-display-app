import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_SETLIST_ITEMS } from '../../shared/setlistLimits.js';
import { normalizeTimerControlSettings, normalizeTimerDisplaySettings } from '../utils/timerUtils';
import { createSolidPaint } from '../utils/paint';
import { createAppShellSlice } from './lyricsStore/appShellSlice.js';
import { createAutoplaySlice } from './lyricsStore/autoplaySlice.js';
import { createLyricsSessionSlice } from './lyricsStore/lyricsSessionSlice.js';
import {
  createOutputSlice,
  partializeOutputState,
  rehydrateOutputState
} from './lyricsStore/outputSlice.js';
import { createPreferencesSlice } from './lyricsStore/preferencesSlice.js';
import { createSetlistSlice } from './lyricsStore/setlistSlice.js';
import { createStageSlice } from './lyricsStore/stageSlice.js';
import { createTimerSlice } from './lyricsStore/timerSlice.js';

export { createDefaultOutputSettings, defaultOutput1Settings, defaultOutput2Settings } from './lyricsStore/outputSlice.js';
export { defaultStageSettings } from './lyricsStore/stageSlice.js';

const normalizePaintSettingUpdates = (settings = {}) => {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return {};
  const next = { ...settings };

  const hasBackgroundColor = Object.prototype.hasOwnProperty.call(next, 'backgroundColor');
  const hasBackgroundPaint = Object.prototype.hasOwnProperty.call(next, 'backgroundPaint');
  const hasFullscreenColor = Object.prototype.hasOwnProperty.call(next, 'fullScreenBackgroundColor');
  const hasFullscreenPaint = Object.prototype.hasOwnProperty.call(next, 'fullScreenBackgroundPaint');
  const isInheritedDefaultPaint = (paint, color) => (
    paint?.type === 'solid'
    && paint?.color === '#000000'
    && typeof color === 'string'
    && color.toUpperCase() !== '#000000'
  );

  if (hasBackgroundColor && (!hasBackgroundPaint || isInheritedDefaultPaint(next.backgroundPaint, next.backgroundColor))) {
    next.backgroundPaint = createSolidPaint(next.backgroundColor);
  }

  if (hasFullscreenColor && (!hasFullscreenPaint || isInheritedDefaultPaint(next.fullScreenBackgroundPaint, next.fullScreenBackgroundColor))) {
    next.fullScreenBackgroundPaint = createSolidPaint(next.fullScreenBackgroundColor);
  }

  return next;
};

export async function loadPreferencesIntoStore(store) {
  try {
    if (window.electronAPI?.preferences?.getAutoplayDefaults) {
      const result = await window.electronAPI.preferences.getAutoplayDefaults();
      if (result.success && result.defaults) {
        store.getState().setAutoplaySettings(result.defaults);
      }
    }

    if (window.electronAPI?.preferences?.getFileHandling) {
      const result = await window.electronAPI.preferences.getFileHandling();
      if (result.success && result.settings) {
        store.getState().updateMaxFileSize(result.settings.maxFileSize ?? 2);
        store.getState().updateMaxSetlistFiles(result.settings.maxSetlistFiles ?? DEFAULT_SETLIST_ITEMS);
      }
    }

    if (window.electronAPI?.preferences?.get) {
      const result = await window.electronAPI.preferences.get('appearance.showTooltips');
      if (result.success && typeof result.value === 'boolean') {
        store.getState().setShowTooltips(result.value);
      }
    }

    if (window.electronAPI?.preferences?.get) {
      const result = await window.electronAPI.preferences.get('appearance.showTutorialPopovers');
      if (result.success && typeof result.value === 'boolean') {
        store.getState().setShowTutorialPopovers(result.value);
      }
    }

    if (window.electronAPI?.preferences?.get) {
      const result = await window.electronAPI.preferences.get('appearance.showCanvasFloatingToolbar');
      if (result.success && typeof result.value === 'boolean') {
        store.getState().setShowCanvasFloatingToolbar(result.value);
      }
    }

    if (window.electronAPI?.preferences?.get) {
      const result = await window.electronAPI.preferences.get('general.toastSoundsMuted');
      if (result.success && typeof result.value === 'boolean') {
        store.getState().setToastSoundsMuted(result.value);
      }
    }

    if (window.electronAPI?.preferences?.get) {
      const result = await window.electronAPI.preferences.get('general.skipSectionTitlesOnKeyboard');
      if (result.success && typeof result.value === 'boolean') {
        store.getState().setSkipSectionTitlesOnKeyboard(result.value);
      }
    }

    // Load formatting preferences
    if (window.electronAPI?.preferences?.get) {
      const result = await window.electronAPI.preferences.get('formatting.enableCleanupOnPaste');
      if (result.success && typeof result.value === 'boolean') {
        store.getState().setCanvasCleanupOnPaste(result.value);
      }
    }
    if (window.electronAPI?.preferences?.get) {
      const result = await window.electronAPI.preferences.get('formatting.capitalizeFirstLetter');
      if (result.success && typeof result.value === 'boolean') {
        store.getState().setFormattingCapitalizeFirstLetter(result.value);
      }
    }
    if (window.electronAPI?.preferences?.get) {
      const result = await window.electronAPI.preferences.get('formatting.capitalizeReligiousTerms');
      if (result.success && typeof result.value === 'boolean') {
        store.getState().setFormattingCapitalizeReligiousTerms(result.value);
      }
    }
    if (window.electronAPI?.preferences?.get) {
      const result = await window.electronAPI.preferences.get('formatting.normalizeTypographicChars');
      if (result.success && typeof result.value === 'boolean') {
        store.getState().setFormattingNormalizeTypographicChars(result.value);
      }
    }

    if (window.electronAPI?.preferences?.get) {
      const result = await window.electronAPI.preferences.get('appearance.themeMode');
      if (result.success && typeof result.value === 'string' && ['light', 'dark', 'system'].includes(result.value)) {
        store.getState().setThemeMode(result.value);

        let effectiveDark;
        if (window.electronAPI?.syncNativeThemeSource) {
          const themeResult = await window.electronAPI.syncNativeThemeSource(result.value);
          effectiveDark = themeResult?.success ? themeResult.shouldUseDarkColors : (result.value === 'dark');
        } else {
          effectiveDark = result.value === 'system'
            ? (window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false)
            : result.value === 'dark';
        }
        store.getState().setDarkMode(effectiveDark);
      }
    }
  } catch (error) {
    console.warn('[LyricsStore] Failed to load preferences:', error);
  }
}

const useLyricsStore = create(
  persist(
    (set, get) => ({
      ...createLyricsSessionSlice(set),
      ...createAppShellSlice(set),
      ...createAutoplaySlice(set),
      ...createPreferencesSlice(set),
      ...createSetlistSlice(set, get),
      ...createStageSlice(set),
      ...createTimerSlice(set, normalizePaintSettingUpdates),
      ...createOutputSlice(set, get, normalizePaintSettingUpdates),
    }),
    {
      name: 'lyrics-store',
      partialize: (state) => {
        const persisted = {
          lyrics: state.lyrics,
          rawLyricsContent: state.rawLyricsContent,
          selectedLine: state.selectedLine,
          lyricsFileName: state.lyricsFileName,
          lyricsSource: state.lyricsSource,
          songMetadata: state.songMetadata,
          lyricsSections: state.lyricsSections,
          lineToSection: state.lineToSection,
          stageEnabled: state.stageEnabled,
          darkMode: state.darkMode,
          themeMode: state.themeMode,
          skipSectionTitlesOnKeyboard: state.skipSectionTitlesOnKeyboard,
          hasSeenWelcome: state.hasSeenWelcome,
          stageSettings: state.stageSettings,
          timerControlSettings: state.timerControlSettings,
          timerDisplaySettings: state.timerDisplaySettings,
          autoplaySettings: state.autoplaySettings,
          lyricsTimestamps: state.lyricsTimestamps,
          hasSeenIntelligentAutoplayInfo: state.hasSeenIntelligentAutoplayInfo,
          ...partializeOutputState(state),
        };

        return persisted;
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          rehydrateOutputState(state);
          state.timerDisplaySettings = normalizeTimerDisplaySettings(state.timerDisplaySettings);
          state.timerControlSettings = normalizeTimerControlSettings(state.timerControlSettings);
        }
      },
    }
  )
);

export default useLyricsStore;
