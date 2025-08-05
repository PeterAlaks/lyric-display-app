// Project: Lyric Display App
// File: src/context/LyricsStore.js

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useLyricsStore = create(
  persist(
    (set) => ({
      lyrics: [],
      selectedLine: null,
      lyricsFileName: '',
      isOutputOn: true,
      setLyrics: (lines) => set({ lyrics: lines }),
      setLyricsFileName: (name) => set({ lyricsFileName: name }),
      selectLine: (index) => set({ selectedLine: index }),
      setIsOutputOn: (state) => set({ isOutputOn: state }),

      output1Settings: {
        fontStyle: 'Bebas Neue',
        bold: false,
        italic: false,
        underline: false,
        fontSize: 48,
        fontColor: '#FFFFFF',
        dropShadowColor: '#000000',
        dropShadowOpacity: 4,
        backgroundColor: '#000000',
        backgroundOpacity: 0,
        xMargin: 3.5,
        yMargin: 0
      },
      output2Settings: {
        fontStyle: 'Bebas Neue',
        bold: false,
        italic: false,
        underline: false,
        fontSize: 48,
        fontColor: '#FFFFFF',
        dropShadowColor: '#000000',
        dropShadowOpacity: 4,
        backgroundColor: '#000000',
        backgroundOpacity: 0,
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
        selectedLine: state.selectedLine,
        lyricsFileName: state.lyricsFileName,
        isOutputOn: state.isOutputOn,
        output1Settings: state.output1Settings,
        output2Settings: state.output2Settings,
      }),
    }
  )
);

export default useLyricsStore;