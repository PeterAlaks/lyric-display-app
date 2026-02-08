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

export const defaultOutput2Settings = {
  fontStyle: 'Bebas Neue',
  bold: false,
  italic: false,
  underline: false,
  allCaps: false,
  textAlign: 'center',
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
  nextFontSize: 72,
  nextColor: '#808080',
  nextBold: false,
  nextItalic: false,
  nextUnderline: false,
  nextAllCaps: false,
  nextAlign: 'left',
  showNextArrow: true,
  nextArrowColor: '#FFA500',
  prevFontSize: 28,
  prevColor: '#404040',
  prevBold: false,
  prevItalic: false,
  prevUnderline: false,
  prevAllCaps: false,
  prevAlign: 'left',
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
    }),
    {
      name: 'lyrics-store',
      partialize: (state) => ({
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
        hasSeenWelcome: state.hasSeenWelcome,
        output1Settings: state.output1Settings,
        output2Settings: state.output2Settings,
        stageSettings: state.stageSettings,
        autoplaySettings: state.autoplaySettings,
        lyricsTimestamps: state.lyricsTimestamps,
        hasSeenIntelligentAutoplayInfo: state.hasSeenIntelligentAutoplayInfo,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.output1Settings = {
            ...state.output1Settings,
            autosizerActive: false,
            primaryViewportWidth: null,
            primaryViewportHeight: null,
            allInstances: null,
            instanceCount: 0,
          };
          state.output2Settings = {
            ...state.output2Settings,
            autosizerActive: false,
            primaryViewportWidth: null,
            primaryViewportHeight: null,
            allInstances: null,
            instanceCount: 0,
          };
        }
      },
    }
  )
);

export default useLyricsStore;