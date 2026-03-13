import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Default autoplay settings - will be overridden by user preferences when available
const defaultAutoplaySettings = {
  interval: 5,
  loop: true,
  startFromFirst: true,
  skipBlankLines: true,
};

// Default max setlist files - will be overridden by user preferences when available
let maxSetlistFilesLimit = 50;


// Function to load preferences from main process (called after app init)
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
        // Trigger a re-render by updating a dummy state
        store.getState().updateMaxSetlistFiles(maxSetlistFilesLimit);
      }
    }

    // Load tooltip visibility preference
    if (window.electronAPI?.preferences?.get) {
      const result = await window.electronAPI.preferences.get('general.showTooltips');
      if (result.success && typeof result.value === 'boolean') {
        store.getState().setShowTooltips(result.value);
      }
    }

    // Load toast sounds muted preference
    if (window.electronAPI?.preferences?.get) {
      const result = await window.electronAPI.preferences.get('general.toastSoundsMuted');
      if (result.success && typeof result.value === 'boolean') {
        store.getState().setToastSoundsMuted(result.value);
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
  alwaysShowBackground: false,
  fullScreenRestorePosition: null,
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
  alwaysShowBackground: false,
  fullScreenRestorePosition: null,
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

/** Maximum number of user-created outputs (on top of the 2 defaults) */
export const MAX_CUSTOM_OUTPUTS = 4;

export const defaultOutput2Settings = {
  fontStyle: 'Bebas Neue',
  bold: false,
  italic: false,
  underline: false,
  allCaps: false,
  textAlign: 'center',
  letterSpacing: 0,
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
  alwaysShowBackground: false,
  fullScreenRestorePosition: null,
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
  nextFontSize: 72,
  nextColor: '#808080',
  nextBold: false,
  nextItalic: false,
  nextUnderline: false,
  nextAllCaps: false,
  nextAlign: 'left',
  nextLetterSpacing: 0,
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
      // IDs of user-created outputs beyond the default output1/output2
      customOutputIds: [],
      darkMode: false,
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
      autoplaySettings: {
        interval: 5,
        loop: true,
        startFromFirst: true,
        skipBlankLines: true,
      },
      lyricsTimestamps: [],
      hasSeenIntelligentAutoplayInfo: false,
      showTooltips: true,
      toastSoundsMuted: false,
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
      setDarkMode: (mode) => set({ darkMode: mode }),
      setHasSeenWelcome: (seen) => set({ hasSeenWelcome: seen }),
      setSetlistFiles: (files) => set({ setlistFiles: files }),
      setIsDesktopApp: (isDesktop) => set({ isDesktopApp: isDesktop }),
      setSetlistModalOpen: (open) => set({ setlistModalOpen: open }),
      setSongMetadata: (metadata) => set({ songMetadata: metadata }),
      setAutoplaySettings: (settings) => set({ autoplaySettings: settings }),
      setLyricsTimestamps: (timestamps) => set({ lyricsTimestamps: timestamps }),
      setShowTooltips: (show) => set({ showTooltips: show }),
      setToastSoundsMuted: (muted) => set({ toastSoundsMuted: muted }),
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
        set((state) => ({
          [`${output}Settings`]: {
            ...state[`${output}Settings`],
            ...newSettings
          }
        })),

      /** Returns the ordered list of all output IDs (default + custom) */
      getAllOutputIds: () => {
        const state = get();
        return ['output1', 'output2', ...state.customOutputIds];
      },

      /** Add a new custom output. Returns the new output ID or null if at limit. */
      addCustomOutput: () => {
        const state = get();
        if (state.customOutputIds.length >= MAX_CUSTOM_OUTPUTS) return null;

        // Find the next available number (starting from 3)
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

      /** Remove a custom output by ID. Only custom outputs (not output1/output2) can be removed. */
      removeCustomOutput: (outputId) => {
        const state = get();
        if (outputId === 'output1' || outputId === 'output2') return false;
        if (!state.customOutputIds.includes(outputId)) return false;

        const updates = {
          customOutputIds: state.customOutputIds.filter(id => id !== outputId),
        };
        // Clean up the settings and enabled keys
        updates[`${outputId}Settings`] = undefined;
        updates[`${outputId}Enabled`] = undefined;

        set(updates);
        return true;
      },

      /** Generic setter for any output's enabled state */
      setOutputEnabled: (outputId, enabled) =>
        set({ [`${outputId}Enabled`]: enabled }),
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
          darkMode: state.darkMode,
          themeMode: state.themeMode,
          hasSeenWelcome: state.hasSeenWelcome,
          output1Settings: state.output1Settings,
          output2Settings: state.output2Settings,
          stageSettings: state.stageSettings,
          autoplaySettings: state.autoplaySettings,
          lyricsTimestamps: state.lyricsTimestamps,
          hasSeenIntelligentAutoplayInfo: state.hasSeenIntelligentAutoplayInfo,
          customOutputIds: state.customOutputIds,
        };

        // Persist settings and enabled state for each custom output
        for (const id of (state.customOutputIds || [])) {
          if (state[`${id}Settings`]) persisted[`${id}Settings`] = state[`${id}Settings`];
          if (typeof state[`${id}Enabled`] === 'boolean') persisted[`${id}Enabled`] = state[`${id}Enabled`];
        }

        return persisted;
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Reset runtime-only fields for all outputs
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