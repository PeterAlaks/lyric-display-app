import { useCallback, useMemo } from 'react';
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
            lyricsSource: state.lyricsSource,
            songMetadata: state.songMetadata,
            lyricsTimestamps: state.lyricsTimestamps,
            lyricsSections: state.lyricsSections,
            lineToSection: state.lineToSection,
            pendingSavedVersion: state.pendingSavedVersion,
            setLyrics: state.setLyrics,
            setLyricsSections: state.setLyricsSections,
            setLineToSection: state.setLineToSection,
            setRawLyricsContent: state.setRawLyricsContent,
            setLyricsFileName: state.setLyricsFileName,
            setLyricsSource: state.setLyricsSource,
            setSongMetadata: state.setSongMetadata,
            setLyricsTimestamps: state.setLyricsTimestamps,
            selectLine: state.selectLine,
            setPendingSavedVersion: state.setPendingSavedVersion,
            clearPendingSavedVersion: state.clearPendingSavedVersion,
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

export const useIndividualOutputState = () =>
    useStoreWithEqualityFn(
        useLyricsStore,
        (state) => ({
            output1Enabled: state.output1Enabled,
            output2Enabled: state.output2Enabled,
            stageEnabled: state.stageEnabled,
            setOutput1Enabled: state.setOutput1Enabled,
            setOutput2Enabled: state.setOutput2Enabled,
            setStageEnabled: state.setStageEnabled,
        }),
        shallow
    );

const useOutputSettingsBase = (outputKey) => {
    const settings = useLyricsStore((state) => state[`${outputKey}Settings`]);
    const updateOutputSettings = useLyricsStore((state) => state.updateOutputSettings);
    const updateSettings = useCallback((newSettings) => {
        updateOutputSettings(outputKey, newSettings);
    }, [updateOutputSettings, outputKey]);

    return useMemo(() => ({
        settings,
        updateSettings,
    }), [settings, updateSettings]);
};

export const useOutput1Settings = () => useOutputSettingsBase('output1');
export const useOutput2Settings = () => useOutputSettingsBase('output2');
export const useOutputSettings = (outputKey) => useOutputSettingsBase(outputKey);

export const useOutputEnabled = (outputKey) =>
    useLyricsStore((state) => state[`${outputKey}Enabled`]);

export const useCustomOutputIds = () =>
    useLyricsStore((state) => state.customOutputIds);

export const useAllOutputIds = () =>
    useStoreWithEqualityFn(
        useLyricsStore,
        (state) => ['output1', 'output2', ...(state.customOutputIds || [])],
        shallow
    );

export const useStageSettings = () => useOutputSettingsBase('stage');

export const useDarkModeState = () =>
    useStoreWithEqualityFn(
        useLyricsStore,
        (state) => ({
            darkMode: state.darkMode,
            setDarkMode: state.setDarkMode,
            themeMode: state.themeMode,
            setThemeMode: state.setThemeMode,
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
            getMaxSetlistFiles: state.getMaxSetlistFiles,
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
            state.setlistFiles.length < 50 &&
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

export const useTimerDisplaySettings = () =>
    useStoreWithEqualityFn(
        useLyricsStore,
        (state) => ({
            settings: state.timerDisplaySettings,
            updateSettings: state.updateTimerDisplaySettings,
        }),
        shallow
    );

export const useTimerControlSettings = () =>
    useStoreWithEqualityFn(
        useLyricsStore,
        (state) => ({
            settings: state.timerControlSettings,
            updateSettings: state.updateTimerControlSettings,
        }),
        shallow
    );

export const useIntelligentAutoplayState = () =>
    useStoreWithEqualityFn(
        useLyricsStore,
        (state) => ({
            lyricsTimestamps: state.lyricsTimestamps,
            hasSeenIntelligentAutoplayInfo: state.hasSeenIntelligentAutoplayInfo,
            setHasSeenIntelligentAutoplayInfo: state.setHasSeenIntelligentAutoplayInfo,
        }),
        shallow
    );

export const useSetOutputEnabledAction = () =>
    useStoreWithEqualityFn(
        useLyricsStore,
        (state) => state.setOutputEnabled,
        shallow
    );
