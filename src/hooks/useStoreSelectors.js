// File: src/hooks/useStoreSelectors.js

import { useStoreWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/shallow';
import useLyricsStore from '../context/LyricsStore';

export const useLyricsState = () =>
    useStoreWithEqualityFn(
        useLyricsStore,
        (state) => ({
            lyrics: state.lyrics,
            rawLyricsContent: state.rawLyricsContent,
            selectedLine: state.selectedLine,
            lyricsFileName: state.lyricsFileName,
            songMetadata: state.songMetadata,
            setLyrics: state.setLyrics,
            setRawLyricsContent: state.setRawLyricsContent,
            setLyricsFileName: state.setLyricsFileName,
            setSongMetadata: state.setSongMetadata,
            selectLine: state.selectLine,
        }),
        shallow
    );

export const useOutputState = () =>
    useStoreWithEqualityFn(
        useLyricsStore,
        (state) => ({
            isOutputOn: state.isOutputOn,
            setIsOutputOn: state.setIsOutputOn,
        }),
        shallow
    );

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

export const useStageSettings = () =>
    useStoreWithEqualityFn(
        useLyricsStore,
        (state) => ({
            settings: state.stageSettings,
            updateSettings: (newSettings) =>
                state.updateOutputSettings('stage', newSettings),
        }),
        shallow
    );

export const useDarkModeState = () =>
    useStoreWithEqualityFn(
        useLyricsStore,
        (state) => ({
            darkMode: state.darkMode,
            setDarkMode: state.setDarkMode,
        }),
        shallow
    );

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

export const useAutoplaySettings = () =>
    useStoreWithEqualityFn(
        useLyricsStore,
        (state) => ({
            settings: state.autoplaySettings,
            setSettings: state.setAutoplaySettings,
        }),
        shallow
    );