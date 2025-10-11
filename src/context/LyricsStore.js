// Project: LyricDisplay App
// File: src/context/LyricsStore.js
// This file defines the Zustand store for managing lyrics, output settings, and setlist.

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
      setlistFiles: [],
      isDesktopApp: false,
      setlistModalOpen: false,

      // Actions
      setLyrics: (lines) => set({ lyrics: lines }),
      setRawLyricsContent: (content) => set({ rawLyricsContent: content }),
      setLyricsFileName: (name) => set({ lyricsFileName: name }),
      selectLine: (index) => set({ selectedLine: index }),
      setIsOutputOn: (state) => set({ isOutputOn: state }),
      setDarkMode: (mode) => set({ darkMode: mode }),

      // New setlist actions
      setSetlistFiles: (files) => set({ setlistFiles: files }),
      setIsDesktopApp: (isDesktop) => set({ isDesktopApp: isDesktop }),
      setSetlistModalOpen: (open) => set({ setlistModalOpen: open }),

      addSetlistFiles: (newFiles) => set((state) => ({
        setlistFiles: [...state.setlistFiles, ...newFiles]
      })),

      removeSetlistFile: (fileId) => set((state) => ({
        setlistFiles: state.setlistFiles.filter(file => file.id !== fileId)
      })),

      clearSetlist: () => set({ setlistFiles: [] }),

      // Get setlist file by ID
      getSetlistFile: (fileId) => {
        const state = get();
        return state.setlistFiles.find(file => file.id === fileId);
      },

      // Check if setlist is full (25 files max)
      isSetlistFull: () => {
        const state = get();
        return state.setlistFiles.length >= 25;
      },

      // Get available setlist slots
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
        fontColor: '#FFFFFF',
        borderColor: '#000000',
        borderSize: 0,
        dropShadowColor: '#000000',
        dropShadowOpacity: 4,
        backgroundColor: '#000000',
        backgroundOpacity: 0,
        lyricsPosition: 'lower',
        fullScreenMode: false,
        fullScreenBackgroundType: 'color',
        fullScreenBackgroundColor: '#000000',
        fullScreenBackgroundMedia: null,
        fullScreenBackgroundMediaName: '',
        fullScreenRestorePosition: null,
        xMargin: 3.5,
        yMargin: 0
      },
      output2Settings: {
        fontStyle: 'Bebas Neue',
        bold: false,
        italic: false,
        underline: false,
        allCaps: false,
        fontSize: 48,
        fontColor: '#FFFFFF',
        borderColor: '#000000',
        borderSize: 0,
        dropShadowColor: '#000000',
        dropShadowOpacity: 4,
        backgroundColor: '#000000',
        backgroundOpacity: 0,
        lyricsPosition: 'lower',
        fullScreenMode: false,
        fullScreenBackgroundType: 'color',
        fullScreenBackgroundColor: '#000000',
        fullScreenBackgroundMedia: null,
        fullScreenBackgroundMediaName: '',
        fullScreenRestorePosition: null,
        xMargin: 3.5,
        yMargin: 0
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
        isOutputOn: state.isOutputOn,
        darkMode: state.darkMode,
        output1Settings: state.output1Settings,
        output2Settings: state.output2Settings,
      }),
    }
  )
);

export default useLyricsStore;
