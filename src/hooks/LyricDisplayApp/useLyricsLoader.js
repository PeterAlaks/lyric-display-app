import { useCallback, useEffect } from 'react';
import { parseLyricsFileAsync } from '../../utils/asyncLyricsParser';
import useLyricsStore from '../../context/LyricsStore.js';
import { mergeLyricsParsingOptions } from '../../../shared/lyricsParsing.js';
import { detectArtistFromFilename } from '../../utils/artistDetection';
import {
  getLyricFormatLabel,
  getLyricImportFormatForType,
  getLyricOriginLabel,
  normalizeLyricFileType,
  stripLyricImportExtension,
} from '../../../shared/lyricImportRegistry.js';

export const usePendingLyricsLoad = (processLoadedLyrics) => {
  useEffect(() => {
    if (!window.__pendingLyricsLoad) return;
    const pendingData = window.__pendingLyricsLoad;
    delete window.__pendingLyricsLoad;
    processLoadedLyrics(pendingData);
  }, [processLoadedLyrics]);
};

export const useLyricsLoader = ({
  setLyrics,
  setLyricsSections = () => { },
  setLineToSection = () => { },
  setRawLyricsContent,
  setLyricsTimestamps,
  setLyricsEnhancedTimestamps = () => { },
  selectLine,
  setLyricsFileName,
  setLyricsSource,
  setSongMetadata,
  emitLyricsLoad,
  socket,
  showToast
}) => {
  const lyricsParsingOptions = useLyricsStore((state) => state.lyricsParsingOptions);

  const processLoadedLyrics = useCallback(async ({ content, fileName, filePath, fileType }, context = {}) => {
    const sanitize = (value) => (value || '')
      .replace(/[<>:"/\\|?*]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    try {
      const providedName = sanitize(fileName);
      const fallbackName = sanitize(context.fallbackFileName);
      const baseName = providedName || fallbackName || 'Imported Lyrics';
      const hasExtension = /\.[a-z0-9]{2,5}$/i.test(providedName);
      const finalType = normalizeLyricFileType({ fileType, fileName: providedName, fallback: 'txt' });
      const primaryExtension = getLyricImportFormatForType(finalType)?.extensions?.[0] || 'txt';
      const extension = `.${primaryExtension}`;
      const finalFileName = hasExtension ? providedName : `${baseName}${extension}`;

      const hasExplicitSplitting = Object.prototype.hasOwnProperty.call(context, 'enableOnlineLyricsSplitting')
        || Object.prototype.hasOwnProperty.call(context, 'enableIntelligentSplitting')
        || Object.prototype.hasOwnProperty.call(context, 'enableSplitting');
      const parsingOptions = mergeLyricsParsingOptions(lyricsParsingOptions, {
        ...(hasExplicitSplitting ? {
          enableSplitting: Boolean(
            context.enableOnlineLyricsSplitting
            ?? context.enableIntelligentSplitting
            ?? context.enableSplitting
          ),
        } : {}),
        ...(context.splitConfig ? { splitConfig: context.splitConfig } : {}),
        ...(context.groupingConfig ? { groupingConfig: context.groupingConfig } : {}),
      });

      const parsed = await parseLyricsFileAsync(null, {
        ...parsingOptions,
        rawText: content || '',
        fileType: finalType,
        name: finalFileName,
        path: filePath,
        groupingPlan: context.groupingPlan,
        ignoreSavedGroupingPlan: context.ignoreSavedGroupingPlan,
      });

      if (!parsed || !Array.isArray(parsed.processedLines)) {
        throw new Error('Invalid lyrics response');
      }

      const processedLines = parsed.processedLines;
      const rawText = parsed.rawText ?? (content || '');
      const timestamps = parsed.timestamps || [];
      const enhancedTimestamps = parsed.enhancedTimestamps || [];
      const sections = parsed.sections || [];
      const lineToSection = parsed.lineToSection || {};
      const finalBaseName = stripLyricImportExtension(finalFileName || '');
      const sourceContent = content || rawText;

      setLyrics(processedLines);
      if (setLyricsSections) setLyricsSections(sections);
      if (setLineToSection) setLineToSection(lineToSection);
      setRawLyricsContent(sourceContent);
      setLyricsTimestamps(timestamps);
      setLyricsEnhancedTimestamps(enhancedTimestamps);
      selectLine(null);
      setLyricsFileName(finalBaseName);
      setLyricsSource({
        content: sourceContent || '',
        fileType: finalType,
        filePath: filePath || null,
        fileName: finalFileName,
        setlistItemId: context.setlistItemId || null,
        ...(finalType === 'txt' ? { groupingPlan: parsed.groupingPlan || null } : {}),
      });

      let metadata = context.songMetadata || null;
      if (metadata) {
        metadata = {
          ...metadata,
          ...(finalType === 'txt' ? { groupingPlan: parsed.groupingPlan || null } : {}),
        };
        setSongMetadata(metadata);
      } else if (!context.providerId) {
        const detected = detectArtistFromFilename(finalBaseName);
        metadata = {
          title: detected.title || finalBaseName,
          artists: detected.artist ? [detected.artist] : [],
          album: null,
          year: null,
          lyricLines: processedLines.length,
          origin: getLyricOriginLabel(finalType),
          filePath: filePath || null,
          ...(finalType === 'txt' ? { groupingPlan: parsed.groupingPlan || null } : {}),
        };
        setSongMetadata(metadata);
      }

      emitLyricsLoad({
        lyrics: processedLines,
        fileName: finalBaseName,
        rawLyricsContent: sourceContent,
        lyricsSource: {
          content: sourceContent || '',
          fileType: finalType,
          filePath: filePath || null,
          fileName: finalFileName,
          setlistItemId: context.setlistItemId || null,
          ...(finalType === 'txt' ? { groupingPlan: parsed.groupingPlan || null } : {}),
        },
        songMetadata: metadata,
        lyricsTimestamps: timestamps,
        lyricsEnhancedTimestamps: enhancedTimestamps,
        sections,
        lineToSection,
      });
      if (socket && socket.connected) {
        if (finalBaseName) {
          socket.emit('fileNameUpdate', finalBaseName);
        }
        socket.emit('lyricsTimestampsUpdate', timestamps);
      }

      window.dispatchEvent(new CustomEvent('lyrics-tutorial-load', {
        detail: {
          fileName: finalBaseName,
          filePath: filePath || null,
          fileType: finalType,
        }
      }));

      try {
        if (filePath && window?.electronAPI?.addRecentFile) {
          await window.electronAPI.addRecentFile(filePath);
        }
      } catch { }

      showToast({
        title: context.toastTitle || 'Lyrics loaded',
        message: context.toastMessage || `${getLyricFormatLabel(finalType)}: ${finalBaseName}`,
        variant: context.toastVariant || 'success',
      });

      return true;
    } catch (err) {
      console.error('Failed to load lyrics content:', err);
      showToast({
        title: context.errorTitle || 'Failed to load lyrics',
        message: context.errorMessage || 'The lyrics could not be processed.',
        variant: 'error',
      });
      return false;
    }
  }, [emitLyricsLoad, lyricsParsingOptions, selectLine, setLyrics, setRawLyricsContent, setLyricsFileName, setLyricsSource, setSongMetadata, setLyricsTimestamps, setLyricsEnhancedTimestamps, showToast, socket]);

  const handleImportFromLibrary = useCallback(async ({ providerId, providerName, lyric }, lyrics) => {
    if (!lyric || typeof lyric.content !== 'string' || !lyric.content.trim()) {
      showToast({
        title: 'Import failed',
        message: 'The selected provider did not return lyric content.',
        variant: 'error',
      });
      return false;
    }

    const baseNamePieces = [lyric.title || 'Untitled Song', lyric.artist || providerName || providerId];
    const fallbackFileName = baseNamePieces.filter(Boolean).join(' - ');

    const hasLrcTimestamps = /^\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/.test(lyric.content.trim());
    const fileType = hasLrcTimestamps ? 'lrc' : 'txt';
    const album = lyric.album || lyric.albumName || null;
    const metadata = {
      title: lyric.title || 'Untitled Song',
      artists: lyric.artist ? [lyric.artist] : [],
      album: album,
      year: lyric.year || lyric.metadata?.year || null,
      lyricLines: lyrics.length,
      origin: providerName || providerId,
      filePath: null
    };

    const success = await processLoadedLyrics(
      {
        content: lyric.content,
        fileName: lyric.title || fallbackFileName,
        fileType,
      },
      {
        fallbackFileName,
        toastTitle: 'Lyrics imported',
        toastMessage: `Loaded from ${providerName || providerId}.`,
        providerId,
        songMetadata: metadata,
        enableOnlineLyricsSplitting: !hasLrcTimestamps,
      }
    );

    if (success) {
      setSongMetadata(metadata);
    }

    return success;
  }, [processLoadedLyrics, showToast, setSongMetadata]);

  return {
    processLoadedLyrics,
    handleImportFromLibrary
  };
};
