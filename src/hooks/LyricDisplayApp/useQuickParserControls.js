import React from 'react';
import { normalizeLyricFileType } from '../../../shared/lyricImportRegistry.js';

const DEFAULT_PARSER_SETTINGS = {
  enableAutoLineGrouping: true,
  enableTranslationGrouping: true,
  maxLinesPerGroup: 2,
};

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
  const [quickParserSettings, setQuickParserSettings] = React.useState(DEFAULT_PARSER_SETTINGS);

  const clampGroupSize = React.useCallback((value) => {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed)) return 2;
    return Math.max(2, Math.min(12, parsed));
  }, []);

  const loadQuickParserSettings = React.useCallback(async () => {
    if (!window.electronAPI?.preferences?.getCategory) return;
    setQuickParserLoading(true);
    try {
      const result = await window.electronAPI.preferences.getCategory('parsing');
      if (result?.success && result.data) {
        setQuickParserSettings({
          enableAutoLineGrouping: result.data.enableAutoLineGrouping ?? true,
          enableTranslationGrouping: result.data.enableTranslationGrouping ?? true,
          maxLinesPerGroup: clampGroupSize(result.data.maxLinesPerGroup ?? 2),
        });
      }
    } catch (error) {
      console.error('Failed to load quick parser settings:', error);
    } finally {
      setQuickParserLoading(false);
    }
  }, [clampGroupSize]);

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
      setQuickParserSettings((prev) => ({
        ...prev,
        enableAutoLineGrouping: next.enableAutoLineGrouping ?? prev.enableAutoLineGrouping,
        enableTranslationGrouping: next.enableTranslationGrouping ?? prev.enableTranslationGrouping,
        maxLinesPerGroup: clampGroupSize(next.maxLinesPerGroup ?? prev.maxLinesPerGroup),
      }));
    };

    window.addEventListener('parsing-preferences-updated', handleParsingPreferencesUpdated);
    return () => window.removeEventListener('parsing-preferences-updated', handleParsingPreferencesUpdated);
  }, [clampGroupSize]);

  const updateQuickParserSetting = React.useCallback(async (key, value) => {
    setQuickParserSettings((prev) => ({ ...prev, [key]: value }));

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
  }, [showToast]);

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
