// Project: LyricDisplay App
// File: src/hooks/useStoreSelectors.js

import { useStoreWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/shallow';
import useLyricsStore from '../context/LyricsStore';

// Lyrics state selector
export const useLyricsState = () =>
    useStoreWithEqualityFn(
        useLyricsStore,
        (state) => ({
            lyrics: state.lyrics,
            rawLyricsContent: state.rawLyricsContent,
            selectedLine: state.selectedLine,
            lyricsFileName: state.lyricsFileName,
            setLyrics: state.setLyrics,
            setRawLyricsContent: state.setRawLyricsContent,
            setLyricsFileName: state.setLyricsFileName,
            selectLine: state.selectLine,
        }),
        shallow
    );

// Output control selector
export const useOutputState = () =>
    useStoreWithEqualityFn(
        useLyricsStore,
        (state) => ({
            isOutputOn: state.isOutputOn,
            setIsOutputOn: state.setIsOutputOn,
        }),
        shallow
    );

// Output 1 settings selector
export const useOutput1Settings = () =>
    useStoreWithEqualityFn(
        useLyricsStore,
        (state) => ({
            settings: state.output1Settings,
            updateSettings: (newSettings) =>
                state.updateOutputSettings('output1', newSettings),
        }),
        shallow
    );

// Output 2 settings selector
export const useOutput2Settings = () =>
    useStoreWithEqualityFn(
        useLyricsStore,
        (state) => ({
            settings: state.output2Settings,
            updateSettings: (newSettings) =>
                state.updateOutputSettings('output2', newSettings),
        }),
        shallow
    );

// Dark mode selector
export const useDarkModeState = () =>
    useStoreWithEqualityFn(
        useLyricsStore,
        (state) => ({
            darkMode: state.darkMode,
            setDarkMode: state.setDarkMode,
        }),
        shallow
    );

// Setlist state selector
export const useSetlistState = () =>
    useStoreWithEqualityFn(
        useLyricsStore,
        (state) => ({
            setlistFiles: state.setlistFiles,
            setlistModalOpen: state.setlistModalOpen,
            isDesktopApp: state.isDesktopApp,
            setSetlistFiles: state.setSetlistFiles,
            setSetlistModalOpen: state.setSetlistModalOpen,
            addSetlistFiles: state.addSetlistFiles,
            removeSetlistFile: state.removeSetlistFile,
            clearSetlist: state.clearSetlist,
            getSetlistFile: state.getSetlistFile,
            isSetlistFull: state.isSetlistFull,
            getAvailableSetlistSlots: state.getAvailableSetlistSlots,
        }),
        shallow
    );

// Atomic selectors (for single-value reads, no equality fn needed)
export const useLyricsFileName = () =>
    useLyricsStore((state) => state.lyricsFileName);
export const useIsDesktopApp = () =>
    useLyricsStore((state) => state.isDesktopApp);
export const useSelectedLine = () =>
    useLyricsStore((state) => state.selectedLine);
export const useIsOutputOn = () =>
    useLyricsStore((state) => state.isOutputOn);
export const useDarkMode = () =>
    useLyricsStore((state) => state.darkMode);

// Derived selectors
export const useHasLyrics = () =>
    useLyricsStore((state) => Boolean(state.lyrics && state.lyrics.length > 0));

export const useCanAddToSetlist = () =>
    useLyricsStore(
        (state) =>
            state.isDesktopApp &&
            state.setlistFiles.length < 25 &&
            state.lyricsFileName != null &&
            state.lyrics != null &&
            state.lyrics.length > 0
    );
