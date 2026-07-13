import React from 'react';
import { normalizeLyricFileType } from '../../../shared/lyricImportRegistry.js';
import {
  buildLyricsParsingOptions,
  mergeLyricsParsingOptions,
  sanitizeMaxLinesPerGroup,
} from '../../../shared/lyricsParsing.js';
import useLyricsStore from '../../context/LyricsStore.js';

export const useQuickParserControls = ({
  hasLyrics,
  lyricsSource,
  songMetadata,
  rawLyricsContent,
  lyricsFileName,
  processLoadedLyrics,
  showToast,
}) => {
  const [quickParserOpen, setQuickParserOpen] = React.useState(false);
  const [quickParserLoading, setQuickParserLoading] = React.useState(false);
  const [reloadingWithParser, setReloadingWithParser] = React.useState(false);
  const lyricsParsingOptions = useLyricsStore((state) => state.lyricsParsingOptions);
  const setLyricsParsingOptions = useLyricsStore((state) => state.setLyricsParsingOptions);
  const lyricsGroupingConfig = lyricsParsingOptions.groupingConfig;
  const quickParserSettings = React.useMemo(() => ({
    enableAutoLineGrouping: lyricsGroupingConfig.enableAutoLineGrouping,
    enableTranslationGrouping: lyricsGroupingConfig.enableTranslationGrouping,
    maxLinesPerGroup: lyricsGroupingConfig.maxLinesPerGroup,
  }), [lyricsGroupingConfig]);

  const clampGroupSize = React.useCallback((value) => {
    return sanitizeMaxLinesPerGroup(value);
  }, []);

  const loadQuickParserSettings = React.useCallback(async () => {
    if (!window.electronAPI?.preferences?.getParsingConfig) return;
    setQuickParserLoading(true);
    try {
      const result = await window.electronAPI.preferences.getParsingConfig();
      if (result?.success && result.config) {
        setLyricsParsingOptions(buildLyricsParsingOptions(result.config));
      }
    } catch (error) {
      console.error('Failed to load quick parser settings:', error);
    } finally {
      setQuickParserLoading(false);
    }
  }, [setLyricsParsingOptions]);

  React.useEffect(() => {
    if (hasLyrics) {
      loadQuickParserSettings();
    }
  }, [hasLyrics, loadQuickParserSettings]);

  React.useEffect(() => {
    if (quickParserOpen) {
      loadQuickParserSettings();
    }
  }, [quickParserOpen, loadQuickParserSettings]);

  React.useEffect(() => {
    const handleParsingPreferencesUpdated = (event) => {
      const next = event?.detail || {};
      const current = useLyricsStore.getState().lyricsParsingOptions;
      setLyricsParsingOptions(mergeLyricsParsingOptions(current, {
        groupingConfig: next,
      }));
    };

    window.addEventListener('parsing-preferences-updated', handleParsingPreferencesUpdated);
    return () => window.removeEventListener('parsing-preferences-updated', handleParsingPreferencesUpdated);
  }, [setLyricsParsingOptions]);

  const updateQuickParserSetting = React.useCallback(async (key, value) => {
    const current = useLyricsStore.getState().lyricsParsingOptions;
    setLyricsParsingOptions(mergeLyricsParsingOptions(current, {
      groupingConfig: {
        [key]: key === 'maxLinesPerGroup' ? clampGroupSize(value) : value,
      },
    }));

    window.dispatchEvent(new CustomEvent('parsing-preferences-updated', {
      detail: { [key]: value }
    }));

    try {
      if (window.electronAPI?.preferences?.set) {
        await window.electronAPI.preferences.set(`parsing.${key}`, value);
      }
    } catch (error) {
      console.error(`Failed to update parsing preference "${key}":`, error);
      showToast({
        title: 'Preference update failed',
        message: 'Could not save quick parser setting.',
        variant: 'error',
      });
    }
  }, [clampGroupSize, setLyricsParsingOptions, showToast]);

  const songFilePath = songMetadata?.filePath || null;

  const handleReloadWithQuickParser = React.useCallback(async () => {
    if (!hasLyrics || reloadingWithParser || typeof processLoadedLyrics !== 'function') return;

    const inferredType = (() => {
      return normalizeLyricFileType({
        fileType: lyricsSource?.fileType,
        fileName: lyricsSource?.fileName || lyricsSource?.filePath || songFilePath,
        fallback: 'txt',
      });
    })();

    const sourceContent = lyricsSource?.content || rawLyricsContent || '';
    const sourcePath = lyricsSource?.filePath || songFilePath || null;
    const sourceFileName = lyricsSource?.fileName
      || (lyricsFileName ? `${lyricsFileName}.${inferredType}` : `lyrics.${inferredType}`);

    if (!sourceContent && !sourcePath) {
      showToast({
        title: 'Reload unavailable',
        message: 'No source lyrics content is available to reparse.',
        variant: 'warn'
      });
      return;
    }

    setReloadingWithParser(true);
    try {
      const success = await processLoadedLyrics(
        {
          content: sourceContent,
          fileName: sourceFileName,
          filePath: sourcePath,
          fileType: inferredType,
        },
        {
          fallbackFileName: sourceFileName,
          toastTitle: 'Lyrics reloaded',
          toastMessage: 'Loaded lyrics were reparsed with updated parser settings.',
          ignoreSavedGroupingPlan: true,
          groupingConfig: {
            enableAutoLineGrouping: quickParserSettings.enableAutoLineGrouping,
            enableTranslationGrouping: quickParserSettings.enableTranslationGrouping,
            maxLinesPerGroup: quickParserSettings.maxLinesPerGroup,
          },
        }
      );

      if (success) {
        setQuickParserOpen(false);
      }
    } finally {
      setReloadingWithParser(false);
    }
  }, [hasLyrics, lyricsFileName, lyricsSource, processLoadedLyrics, quickParserSettings, rawLyricsContent, reloadingWithParser, showToast, songFilePath]);

  return {
    quickParserOpen,
    setQuickParserOpen,
    quickParserLoading,
    reloadingWithParser,
    quickParserSettings,
    clampGroupSize,
    updateQuickParserSetting,
    handleReloadWithQuickParser,
  };
};
