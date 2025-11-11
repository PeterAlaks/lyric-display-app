// File: src/context/LyricsStore.js

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useLyricsStore = create(
  persist(
    (set, get) => ({
      lyrics: [],
      rawLyricsContent: '',
      selectedLine: null,
      lyricsFileName: '',
      isOutputOn: true,
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

      setLyrics: (lines) => set({ lyrics: lines }),
      setRawLyricsContent: (content) => set({ rawLyricsContent: content }),
      setLyricsFileName: (name) => set({ lyricsFileName: name }),
      selectLine: (index) => set({ selectedLine: index }),
      setIsOutputOn: (state) => set({ isOutputOn: state }),
      setDarkMode: (mode) => set({ darkMode: mode }),
      setHasSeenWelcome: (seen) => set({ hasSeenWelcome: seen }),
      setSetlistFiles: (files) => set({ setlistFiles: files }),
      setIsDesktopApp: (isDesktop) => set({ isDesktopApp: isDesktop }),
      setSetlistModalOpen: (open) => set({ setlistModalOpen: open }),
      setSongMetadata: (metadata) => set({ songMetadata: metadata }),
      setAutoplaySettings: (settings) => set({ autoplaySettings: settings }),
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
        return state.setlistFiles.length >= 25;
      },

      getAvailableSetlistSlots: () => {
        const state = get();
        return Math.max(0, 25 - state.setlistFiles.length);
      },

      output1Settings: {
        fontStyle: 'Bebas Neue',
        bold: false,
        italic: false,
        underline: false,
        allCaps: false,
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
        fullScreenRestorePosition: null,
        xMargin: 3.5,
        yMargin: 0,
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
      },
      output2Settings: {
        fontStyle: 'Bebas Neue',
        bold: false,
        italic: false,
        underline: false,
        allCaps: false,
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
        fullScreenRestorePosition: null,
        xMargin: 3.5,
        yMargin: 0,
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
      },
      stageSettings: {
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
      },
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
        darkMode: state.darkMode,
        hasSeenWelcome: state.hasSeenWelcome,
        output1Settings: state.output1Settings,
        output2Settings: state.output2Settings,
        stageSettings: state.stageSettings,
        autoplaySettings: state.autoplaySettings,
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