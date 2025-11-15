import { useCallback } from 'react';
import { parseLyricsFileAsync } from '../utils/asyncLyricsParser';
import { detectArtistFromFilename } from '../utils/artistDetection';

export const useLyricsLoader = ({
  setLyrics,
  setRawLyricsContent,
  setLyricsTimestamps,
  selectLine,
  setLyricsFileName,
  setSongMetadata,
  emitLyricsLoad,
  socket,
  showToast
}) => {
  const processLoadedLyrics = useCallback(async ({ content, fileName, filePath, fileType }, context = {}) => {
    const sanitize = (value) => (value || '')
      .replace(/[<>:"/\\|?*]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    try {
      const requestedType = (fileType || '').toLowerCase() === 'lrc' ? 'lrc' : ((fileType || '').toLowerCase() === 'txt' ? 'txt' : null);
      const providedName = sanitize(fileName);
      const fallbackName = sanitize(context.fallbackFileName);
      const baseName = providedName || fallbackName || 'Imported Lyrics';
      const hasExtension = /\.[a-z0-9]{2,5}$/i.test(providedName);
      const inferredType = (!requestedType && providedName && providedName.toLowerCase().endsWith('.lrc')) ? 'lrc' : 'txt';
      const finalType = requestedType || inferredType;
      const extension = finalType === 'lrc' ? '.lrc' : '.txt';
      const finalFileName = hasExtension ? providedName : `${baseName}${extension}`;

      const enableSplitting = Boolean(context.enableOnlineLyricsSplitting || context.enableIntelligentSplitting);

      const parsed = await parseLyricsFileAsync(null, {
        rawText: content || '',
        fileType: finalType,
        name: finalFileName,
        path: filePath,
        enableSplitting,
      });

      if (!parsed || !Array.isArray(parsed.processedLines)) {
        throw new Error('Invalid lyrics response');
      }

      const processedLines = parsed.processedLines;
      const rawText = parsed.rawText ?? (content || '');
      const timestamps = parsed.timestamps || [];
      const finalBaseName = (finalFileName || '').replace(/\.(txt|lrc)$/i, '');

      setLyrics(processedLines);
      setRawLyricsContent(finalType === 'lrc' ? (content || rawText) : rawText);
      setLyricsTimestamps(timestamps);
      selectLine(null);
      setLyricsFileName(finalBaseName);

      if (!context.providerId) {
        const detected = detectArtistFromFilename(finalBaseName);
        const metadata = {
          title: detected.title || finalBaseName,
          artists: detected.artist ? [detected.artist] : [],
          album: null,
          year: null,
          lyricLines: processedLines.length,
          origin: finalType === 'lrc' ? 'Local (.lrc)' : 'Local (.txt)',
          filePath: filePath || null
        };
        setSongMetadata(metadata);
      }

      emitLyricsLoad(processedLines);
      if (socket && socket.connected) {
        if (finalBaseName) {
          socket.emit('fileNameUpdate', finalBaseName);
        }
        socket.emit('lyricsTimestampsUpdate', timestamps);
      }

      try {
        if (filePath && window?.electronAPI?.addRecentFile) {
          await window.electronAPI.addRecentFile(filePath);
        }
      } catch { }

      showToast({
        title: context.toastTitle || 'Lyrics loaded',
        message: context.toastMessage || `${finalType === 'lrc' ? 'LRC' : 'Text'}: ${finalBaseName}`,
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
  }, [emitLyricsLoad, selectLine, setLyrics, setRawLyricsContent, setLyricsFileName, setSongMetadata, setLyricsTimestamps, showToast, socket]);

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

    const success = await processLoadedLyrics(
      {
        content: lyric.content,
        fileName: lyric.title || fallbackFileName,
        fileType,
        enableOnlineLyricsSplitting: !hasLrcTimestamps,
      },
      {
        fallbackFileName,
        toastTitle: 'Lyrics imported',
        toastMessage: `Loaded from ${providerName || providerId}.`,
        providerId,
      }
    );

    if (success) {
      const album = lyric.album || lyric.albumName || null;

      const metadata = {
        title: lyric.title || 'Untitled Song',
        artists: lyric.artist ? [lyric.artist] : [],
        album: album,
        year: lyric.year || null,
        lyricLines: lyrics.length,
        origin: providerName || providerId,
        filePath: null
      };
      setSongMetadata(metadata);
    }

    return success;
  }, [processLoadedLyrics, showToast, setSongMetadata]);

  return {
    processLoadedLyrics,
    handleImportFromLibrary
  };
};