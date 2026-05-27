import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_TIMER_CONTROL_SETTINGS, DEFAULT_TIMER_DISPLAY, normalizeTimerControlSettings } from '../utils/timerUtils';

let maxSetlistFilesLimit = 50;

const settingsChanged = (current = {}, next = {}) => {
  if (!next || typeof next !== 'object' || Array.isArray(next)) return false;
  return Object.entries(next).some(([key, value]) => !Object.is(current?.[key], value));
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
        maxSetlistFilesLimit = result.settings.maxSetlistFiles ?? 50;
        store.getState().updateMaxSetlistFiles(maxSetlistFilesLimit);
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
      const result = await window.electronAPI.preferences.get('general.toastSoundsMuted');
      if (result.success && typeof result.value === 'boolean') {
        store.getState().setToastSoundsMuted(result.value);
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

export const defaultOutput1Settings = {
  fontStyle: 'Bebas Neue',
  bold: false,
  italic: false,
  underline: false,
  allCaps: false,
  textAlign: 'center',
  letterSpacing: 0,
  lineSpacing: 1,
  fontSize: 48,
  translationFontSizeMode: 'bound',
  translationFontSize: 48,
  fontColor: '#FFFFFF',
  translationLineColor: '#FBBF24',
  borderColor: '#000000',
  borderSize: 0,
  dropShadowColor: '#000000',
  dropShadowOpacity: 4,
  dropShadowOffsetX: 0,
  dropShadowOffsetY: 8,
  dropShadowBlur: 10,
  backgroundColor: '#000000',
  backgroundOpacity: 0,
  backgroundBandVerticalPadding: 20,
  backgroundBandHeightMode: 'adaptive',
  backgroundBandCustomLines: 3,
  backgroundBandLockedToMaxLines: false,
  lyricsPosition: 'lower',
  fullScreenMode: false,
  fullScreenBackgroundType: 'color',
  fullScreenBackgroundColor: '#000000',
  fullScreenBackgroundMedia: null,
  fullScreenBackgroundMediaName: '',
  fullScreenElementEnabled: false,
  fullScreenElementMedia: null,
  fullScreenElementMediaName: '',
  fullScreenElementScale: 25,
  fullScreenElementPosition: 'center',
  fullScreenElementPaddingX: 0,
  fullScreenElementPaddingY: 0,
  fullScreenElementOpacity: 2.5,
  fullScreenElementBlur: 0,
  alwaysShowBackground: false,
  fullScreenRestorePosition: null,
  fullScreenRestoreFontSize: null,
  fullScreenRestoreMaxLinesEnabled: null,
  fullScreenRestoreMaxLines: null,
  fullScreenRestoreLetterSpacing: null,
  fullScreenRestoreLineSpacing: null,
  fullScreenRestoreXMargin: null,
  fullScreenRestoreYMargin: null,
  fullScreenRestoreFontColor: null,
  fullScreenRestoreTranslationLineColor: null,
  fullScreenRestoreTranslationFontSizeMode: null,
  fullScreenRestoreTranslationFontSize: null,
  fullScreenFontSize: null,
  fullScreenMaxLinesEnabled: null,
  fullScreenMaxLines: null,
  fullScreenLetterSpacing: null,
  fullScreenLineSpacing: null,
  fullScreenXMargin: null,
  fullScreenYMargin: null,
  fullScreenFontColor: null,
  fullScreenTranslationLineColor: null,
  fullScreenTranslationFontSizeMode: null,
  fullScreenTranslationFontSize: null,
  xMargin: 3.5,
  yMargin: 2,
  maxLinesEnabled: false,
  maxLines: 3,
  minFontSize: 24,
  autosizerActive: false,
  primaryViewportWidth: null,
  primaryViewportHeight: null,
  allInstances: null,
  instanceCount: 0,
  transitionAnimation: 'none',
  transitionSpeed: 150
};

/** Default settings factory for any new output */
export const createDefaultOutputSettings = (overrides = {}) => ({
  fontStyle: 'Bebas Neue',
  bold: false,
  italic: false,
  underline: false,
  allCaps: false,
  textAlign: 'center',
  letterSpacing: 0,
  lineSpacing: 1,
  fontSize: 48,
  translationFontSizeMode: 'bound',
  translationFontSize: 48,
  fontColor: '#FFFFFF',
  translationLineColor: '#FBBF24',
  borderColor: '#000000',
  borderSize: 0,
  dropShadowColor: '#000000',
  dropShadowOpacity: 4,
  dropShadowOffsetX: 0,
  dropShadowOffsetY: 8,
  dropShadowBlur: 10,
  backgroundColor: '#000000',
  backgroundOpacity: 0,
  backgroundBandVerticalPadding: 20,
  backgroundBandHeightMode: 'adaptive',
  backgroundBandCustomLines: 3,
  backgroundBandLockedToMaxLines: false,
  lyricsPosition: 'lower',
  fullScreenMode: false,
  fullScreenBackgroundType: 'color',
  fullScreenBackgroundColor: '#000000',
  fullScreenBackgroundMedia: null,
  fullScreenBackgroundMediaName: '',
  fullScreenElementEnabled: false,
  fullScreenElementMedia: null,
  fullScreenElementMediaName: '',
  fullScreenElementScale: 25,
  fullScreenElementPosition: 'center',
  fullScreenElementPaddingX: 0,
  fullScreenElementPaddingY: 0,
  fullScreenElementOpacity: 2.5,
  fullScreenElementBlur: 0,
  alwaysShowBackground: false,
  fullScreenRestorePosition: null,
  fullScreenRestoreFontSize: null,
  fullScreenRestoreMaxLinesEnabled: null,
  fullScreenRestoreMaxLines: null,
  fullScreenRestoreLetterSpacing: null,
  fullScreenRestoreLineSpacing: null,
  fullScreenRestoreXMargin: null,
  fullScreenRestoreYMargin: null,
  fullScreenRestoreFontColor: null,
  fullScreenRestoreTranslationLineColor: null,
  fullScreenRestoreTranslationFontSizeMode: null,
  fullScreenRestoreTranslationFontSize: null,
  fullScreenFontSize: null,
  fullScreenMaxLinesEnabled: null,
  fullScreenMaxLines: null,
  fullScreenLetterSpacing: null,
  fullScreenLineSpacing: null,
  fullScreenXMargin: null,
  fullScreenYMargin: null,
  fullScreenFontColor: null,
  fullScreenTranslationLineColor: null,
  fullScreenTranslationFontSizeMode: null,
  fullScreenTranslationFontSize: null,
  xMargin: 3.5,
  yMargin: 2,
  maxLinesEnabled: false,
  maxLines: 3,
  minFontSize: 24,
  autosizerActive: false,
  primaryViewportWidth: null,
  primaryViewportHeight: null,
  allInstances: null,
  instanceCount: 0,
  transitionAnimation: 'none',
  transitionSpeed: 150,
  ...overrides,
});

export const MAX_CUSTOM_OUTPUTS = 4;

export const defaultOutput2Settings = {
  fontStyle: 'Bebas Neue',
  bold: false,
  italic: false,
  underline: false,
  allCaps: false,
  textAlign: 'center',
  letterSpacing: 0,
  lineSpacing: 1,
  fontSize: 72,
  translationFontSizeMode: 'bound',
  translationFontSize: 72,
  fontColor: '#FFFFFF',
  translationLineColor: '#FBBF24',
  borderColor: '#000000',
  borderSize: 0,
  dropShadowColor: '#000000',
  dropShadowOpacity: 4,
  dropShadowOffsetX: 0,
  dropShadowOffsetY: 8,
  dropShadowBlur: 10,
  backgroundColor: '#000000',
  backgroundOpacity: 0,
  backgroundBandVerticalPadding: 30,
  backgroundBandHeightMode: 'adaptive',
  backgroundBandCustomLines: 3,
  backgroundBandLockedToMaxLines: false,
  lyricsPosition: 'lower',
  fullScreenMode: false,
  fullScreenBackgroundType: 'color',
  fullScreenBackgroundColor: '#000000',
  fullScreenBackgroundMedia: null,
  fullScreenBackgroundMediaName: '',
  fullScreenElementEnabled: false,
  fullScreenElementMedia: null,
  fullScreenElementMediaName: '',
  fullScreenElementScale: 25,
  fullScreenElementPosition: 'center',
  fullScreenElementPaddingX: 0,
  fullScreenElementPaddingY: 0,
  fullScreenElementOpacity: 2.5,
  fullScreenElementBlur: 0,
  alwaysShowBackground: false,
  fullScreenRestorePosition: null,
  fullScreenRestoreFontSize: null,
  fullScreenRestoreMaxLinesEnabled: null,
  fullScreenRestoreMaxLines: null,
  fullScreenRestoreLetterSpacing: null,
  fullScreenRestoreLineSpacing: null,
  fullScreenRestoreXMargin: null,
  fullScreenRestoreYMargin: null,
  fullScreenRestoreFontColor: null,
  fullScreenRestoreTranslationLineColor: null,
  fullScreenRestoreTranslationFontSizeMode: null,
  fullScreenRestoreTranslationFontSize: null,
  fullScreenFontSize: null,
  fullScreenMaxLinesEnabled: null,
  fullScreenMaxLines: null,
  fullScreenLetterSpacing: null,
  fullScreenLineSpacing: null,
  fullScreenXMargin: null,
  fullScreenYMargin: null,
  fullScreenFontColor: null,
  fullScreenTranslationLineColor: null,
  fullScreenTranslationFontSizeMode: null,
  fullScreenTranslationFontSize: null,
  xMargin: 3.5,
  yMargin: 2,
  maxLinesEnabled: false,
  maxLines: 3,
  minFontSize: 24,
  autosizerActive: false,
  primaryViewportWidth: null,
  primaryViewportHeight: null,
  allInstances: null,
  instanceCount: 0,
  transitionAnimation: 'none',
  transitionSpeed: 150
};

export const defaultStageSettings = {
  fontStyle: 'Bebas Neue',
  backgroundColor: '#000000',
  liveFontSize: 120,
  liveColor: '#FFFFFF',
  liveBold: true,
  liveItalic: false,
  liveUnderline: false,
  liveAllCaps: false,
  liveAlign: 'left',
  liveLetterSpacing: 0,
  liveLineSpacing: 1,
  nextFontSize: 72,
  nextColor: '#808080',
  nextBold: false,
  nextItalic: false,
  nextUnderline: false,
  nextAllCaps: false,
  nextAlign: 'left',
  nextLetterSpacing: 0,
  nextLineSpacing: 1,
  showNextLine: true,
  showNextArrow: true,
  nextArrowColor: '#FFA500',
  prevFontSize: 28,
  prevColor: '#404040',
  prevBold: false,
  prevItalic: false,
  prevUnderline: false,
  prevAllCaps: false,
  prevAlign: 'left',
  prevLetterSpacing: 0,
  prevLineSpacing: 1,
  showPrevLine: true,
  currentSongColor: '#FFFFFF',
  currentSongSize: 24,
  upcomingSongColor: '#808080',
  upcomingSongSize: 18,
  upcomingSongMode: 'automatic',
  upcomingSongFullScreen: false,
  timerFullScreen: false,
  customMessagesFullScreen: false,
  showTime: true,
  messageScrollSpeed: 3000,
  bottomBarColor: '#FFFFFF',
  bottomBarSize: 20,
  translationLineColor: '#FBBF24',
  maxLinesEnabled: false,
  maxLines: 3,
  minFontSize: 24,
  transitionAnimation: 'slide',
  transitionSpeed: 300
};

const useLyricsStore = create(
  persist(
    (set, get) => ({
      lyrics: [],
      rawLyricsContent: '',
      selectedLine: null,
      lyricsFileName: '',
      lyricsSections: [],
      lineToSection: {},
      isOutputOn: true,
      output1Enabled: true,
      output2Enabled: true,
      stageEnabled: true,
      customOutputIds: [],
      previewCustomOutputId: null,
      darkMode: false,
      themeMode: 'light',
      hasSeenWelcome: false,
      setlistFiles: [],
      isDesktopApp: false,
      setlistModalOpen: false,
      songMetadata: {
        title: '',
        artists: [],
        album: '',
        year: null,
        origin: '',
        filePath: '',
      },
      lyricsSource: {
        content: '',
        fileType: 'txt',
        filePath: null,
        fileName: '',
      },
      autoplaySettings: {
        interval: 5,
        loop: true,
        startFromFirst: true,
        skipBlankLines: true,
      },
      timerControlSettings: { ...DEFAULT_TIMER_CONTROL_SETTINGS },
      timerDisplaySettings: { ...DEFAULT_TIMER_DISPLAY },
      lyricsTimestamps: [],
      hasSeenIntelligentAutoplayInfo: false,
      showTooltips: true,
      showTutorialPopovers: true,
      toastSoundsMuted: false,
      canvasCleanupOnPaste: true,
      formattingCapitalizeFirstLetter: true,
      formattingCapitalizeReligiousTerms: true,
      formattingNormalizeTypographicChars: true,
      pendingSavedVersion: null,
      maxSetlistFilesVersion: 0,

      setLyrics: (lines) => set({ lyrics: lines }),
      setLyricsSections: (sections) => set({ lyricsSections: Array.isArray(sections) ? sections : [] }),
      setLineToSection: (mapping) => set({ lineToSection: mapping && typeof mapping === 'object' ? mapping : {} }),
      setRawLyricsContent: (content) => set({ rawLyricsContent: content }),
      setLyricsFileName: (name) => set({ lyricsFileName: name }),
      selectLine: (index) => set({ selectedLine: index }),
      setIsOutputOn: (state) => set({ isOutputOn: state }),
      setOutput1Enabled: (enabled) => set({ output1Enabled: enabled }),
      setOutput2Enabled: (enabled) => set({ output2Enabled: enabled }),
      setStageEnabled: (enabled) => set({ stageEnabled: enabled }),
      setPreviewCustomOutputId: (outputId) =>
        set((state) => {
          if (outputId === null) return { previewCustomOutputId: null };
          if (typeof outputId !== 'string' || !outputId.startsWith('output')) return {};
          if (!state.customOutputIds.includes(outputId)) return {};
          return { previewCustomOutputId: outputId };
        }),
      setDarkMode: (mode) => set({ darkMode: mode }),
      setThemeMode: (mode) => set({ themeMode: mode }),
      setHasSeenWelcome: (seen) => set({ hasSeenWelcome: seen }),
      setSetlistFiles: (files) => set({ setlistFiles: files }),
      setIsDesktopApp: (isDesktop) => set({ isDesktopApp: isDesktop }),
      setSetlistModalOpen: (open) => set({ setlistModalOpen: open }),
      setSongMetadata: (metadata) => set({ songMetadata: metadata }),
      setLyricsSource: (source) => set({
        lyricsSource: {
          content: source?.content || '',
          fileType: source?.fileType || 'txt',
          filePath: source?.filePath || null,
          fileName: source?.fileName || '',
        }
      }),
      setAutoplaySettings: (settings) => set({ autoplaySettings: settings }),
      updateTimerControlSettings: (settings) => set((state) => ({
        timerControlSettings: normalizeTimerControlSettings({
          ...state.timerControlSettings,
          ...(settings && typeof settings === 'object' ? settings : {}),
        }),
      })),
      updateTimerDisplaySettings: (settings, options = {}) => set((state) => {
        const incomingSettings = settings && typeof settings === 'object' ? settings : {};
        const currentUpdatedAt = Number(state.timerDisplaySettings?.displayUpdatedAt) || 0;
        const incomingUpdatedAt = Number(incomingSettings.displayUpdatedAt) || 0;

        if (incomingUpdatedAt > 0 && currentUpdatedAt > incomingUpdatedAt) {
          return {};
        }
        if (options?.touch === false && incomingUpdatedAt === 0 && currentUpdatedAt > 0) {
          return {};
        }

        const shouldTouch = options?.touch !== false && incomingUpdatedAt === 0;

        return {
          timerDisplaySettings: {
            ...state.timerDisplaySettings,
            ...incomingSettings,
            displayUpdatedAt: incomingUpdatedAt || (shouldTouch ? Date.now() : currentUpdatedAt),
          }
        };
      }),
      setLyricsTimestamps: (timestamps) => set({ lyricsTimestamps: timestamps }),
      setShowTooltips: (show) => set({ showTooltips: show }),
      setShowTutorialPopovers: (show) => set({ showTutorialPopovers: show }),
      setToastSoundsMuted: (muted) => set({ toastSoundsMuted: muted }),
      setCanvasCleanupOnPaste: (enabled) => set({ canvasCleanupOnPaste: enabled }),
      setFormattingCapitalizeFirstLetter: (enabled) => set({ formattingCapitalizeFirstLetter: enabled }),
      setFormattingCapitalizeReligiousTerms: (enabled) => set({ formattingCapitalizeReligiousTerms: enabled }),
      setFormattingNormalizeTypographicChars: (enabled) => set({ formattingNormalizeTypographicChars: enabled }),
      setHasSeenIntelligentAutoplayInfo: (seen) => set({ hasSeenIntelligentAutoplayInfo: seen }),
      setPendingSavedVersion: (payload) => set({ pendingSavedVersion: payload || null }),
      clearPendingSavedVersion: () => set({ pendingSavedVersion: null }),
      addSetlistFiles: (newFiles) => set((state) => ({
        setlistFiles: [...state.setlistFiles, ...newFiles]
      })),
      removeSetlistFile: (fileId) => set((state) => ({
        setlistFiles: state.setlistFiles.filter(file => file.id !== fileId)
      })),
      clearSetlist: () => set({ setlistFiles: [] }),

      getSetlistFile: (fileId) => {
        const state = get();
        return state.setlistFiles.find(file => file.id === fileId);
      },

      isSetlistFull: () => {
        const state = get();
        return state.setlistFiles.length >= maxSetlistFilesLimit;
      },

      getAvailableSetlistSlots: () => {
        const state = get();
        return Math.max(0, maxSetlistFilesLimit - state.setlistFiles.length);
      },

      getMaxSetlistFiles: () => maxSetlistFilesLimit,

      updateMaxSetlistFiles: (newLimit) => {
        maxSetlistFilesLimit = newLimit;
        set((state) => ({ maxSetlistFilesVersion: state.maxSetlistFilesVersion + 1 }));
      },

      output1Settings: defaultOutput1Settings,
      output2Settings: defaultOutput2Settings,
      stageSettings: defaultStageSettings,
      updateOutputSettings: (output, newSettings) =>
        set((state) => {
          const key = `${output}Settings`;
          const currentSettings = state[key] || {};
          if (!settingsChanged(currentSettings, newSettings)) return state;
          return {
            [key]: {
              ...currentSettings,
              ...newSettings
            }
          };
        }),

      getAllOutputIds: () => {
        const state = get();
        return ['output1', 'output2', ...state.customOutputIds];
      },

      addCustomOutput: () => {
        const state = get();
        if (state.customOutputIds.length >= MAX_CUSTOM_OUTPUTS) return null;

        const allIds = ['output1', 'output2', ...state.customOutputIds];
        let nextNum = 3;
        while (allIds.includes(`output${nextNum}`)) nextNum++;
        const newId = `output${nextNum}`;

        set({
          customOutputIds: [...state.customOutputIds, newId],
          [`${newId}Settings`]: createDefaultOutputSettings(),
          [`${newId}Enabled`]: true,
        });

        return newId;
      },

      removeCustomOutput: (outputId) => {
        const state = get();
        if (outputId === 'output1' || outputId === 'output2') return false;
        if (!state.customOutputIds.includes(outputId)) return false;

        const nextCustomOutputIds = state.customOutputIds.filter(id => id !== outputId);
        const updates = {
          customOutputIds: nextCustomOutputIds,
        };

        if (state.previewCustomOutputId === outputId) {
          updates.previewCustomOutputId = null;
        }

        updates[`${outputId}Settings`] = undefined;
        updates[`${outputId}Enabled`] = undefined;

        set(updates);
        return true;
      },

      setCustomOutputs: (outputIds) =>
        set((state) => {
          const normalized = Array.from(
            new Set(
              (Array.isArray(outputIds) ? outputIds : [])
                .filter((id) => typeof id === 'string' && id.startsWith('output'))
                .filter((id) => id !== 'output1' && id !== 'output2')
            )
          ).sort((a, b) => {
            const numA = parseInt(a.replace('output', ''), 10);
            const numB = parseInt(b.replace('output', ''), 10);
            if (Number.isFinite(numA) && Number.isFinite(numB)) return numA - numB;
            return a.localeCompare(b);
          });

          const updates = {
            customOutputIds: normalized,
            previewCustomOutputId: normalized.includes(state.previewCustomOutputId)
              ? state.previewCustomOutputId
              : null,
          };

          for (const existingId of state.customOutputIds || []) {
            if (!normalized.includes(existingId)) {
              updates[`${existingId}Settings`] = undefined;
              updates[`${existingId}Enabled`] = undefined;
            }
          }

          for (const id of normalized) {
            if (!state[`${id}Settings`]) {
              updates[`${id}Settings`] = createDefaultOutputSettings();
            }
            if (typeof state[`${id}Enabled`] !== 'boolean') {
              updates[`${id}Enabled`] = true;
            }
          }

          return updates;
        }),

      setOutputEnabled: (outputId, enabled) =>
        set((state) => {
          if (typeof outputId !== 'string' || !outputId.startsWith('output')) return {};
          if (outputId !== 'output1' && outputId !== 'output2' && !state.customOutputIds.includes(outputId)) {
            return {};
          }
          return { [`${outputId}Enabled`]: enabled };
        }),
    }),
    {
      name: 'lyrics-store',
      partialize: (state) => {
        const persisted = {
          lyrics: state.lyrics,
          rawLyricsContent: state.rawLyricsContent,
          selectedLine: state.selectedLine,
          lyricsFileName: state.lyricsFileName,
          songMetadata: state.songMetadata,
          isOutputOn: state.isOutputOn,
          lyricsSections: state.lyricsSections,
          lineToSection: state.lineToSection,
          output1Enabled: state.output1Enabled,
          output2Enabled: state.output2Enabled,
          stageEnabled: state.stageEnabled,
          previewCustomOutputId: state.previewCustomOutputId,
          darkMode: state.darkMode,
          themeMode: state.themeMode,
          hasSeenWelcome: state.hasSeenWelcome,
          output1Settings: state.output1Settings,
          output2Settings: state.output2Settings,
          stageSettings: state.stageSettings,
          timerControlSettings: state.timerControlSettings,
          timerDisplaySettings: state.timerDisplaySettings,
          autoplaySettings: state.autoplaySettings,
          lyricsTimestamps: state.lyricsTimestamps,
          hasSeenIntelligentAutoplayInfo: state.hasSeenIntelligentAutoplayInfo,
          customOutputIds: state.customOutputIds,
        };

        for (const id of (state.customOutputIds || [])) {
          if (state[`${id}Settings`]) persisted[`${id}Settings`] = state[`${id}Settings`];
          if (typeof state[`${id}Enabled`] === 'boolean') persisted[`${id}Enabled`] = state[`${id}Enabled`];
        }

        return persisted;
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          if (state.previewCustomOutputId && !state.customOutputIds?.includes(state.previewCustomOutputId)) {
            state.previewCustomOutputId = null;
          }
          state.timerDisplaySettings = {
            ...DEFAULT_TIMER_DISPLAY,
            ...(state.timerDisplaySettings || {}),
            otherItemsScale: state.timerDisplaySettings?.otherItemsScale ?? state.timerDisplaySettings?.globalClockScale ?? DEFAULT_TIMER_DISPLAY.otherItemsScale,
            displayUpdatedAt: Number.isFinite(Number(state.timerDisplaySettings?.displayUpdatedAt)) ? Number(state.timerDisplaySettings.displayUpdatedAt) : 0,
          };
          state.timerControlSettings = normalizeTimerControlSettings(state.timerControlSettings);
          const allOutputIds = ['output1', 'output2', ...(state.customOutputIds || [])];
          for (const id of allOutputIds) {
            if (state[`${id}Settings`]) {
              state[`${id}Settings`] = {
                ...state[`${id}Settings`],
                autosizerActive: false,
                primaryViewportWidth: null,
                primaryViewportHeight: null,
                allInstances: null,
                instanceCount: 0,
              };
            }
          }
        }
      },
    }
  )
);

export default useLyricsStore;
