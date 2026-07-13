import { useCallback } from 'react';
import { parseLyricsFileAsync } from '../utils/asyncLyricsParser';
import { useLyricsState } from './useStoreSelectors';
import { useControlSocket } from '../context/ControlSocketProvider';
import useToast from './useToast';
import { detectArtistFromFilename } from '../utils/artistDetection';
import useLyricsStore from '../context/LyricsStore';
import { mergeLyricsParsingOptions } from '../../shared/lyricsParsing.js';
import {
  getLyricFormatLabel,
  getLyricOriginLabel,
  getLyricImportFormatForName,
  stripLyricImportExtension,
} from '../../shared/lyricImportRegistry.js';

const useFileUpload = () => {
  const { setLyrics, setRawLyricsContent, selectLine, setLyricsFileName, setLyricsSource, setSongMetadata, setLyricsTimestamps, setLyricsEnhancedTimestamps } = useLyricsState();
  const { emitLyricsLoad, socket } = useControlSocket();
  const { showToast } = useToast();
  const maxFileSize = useLyricsStore((state) => state.maxFileSizeLimit);
  const lyricsParsingOptions = useLyricsStore((state) => state.lyricsParsingOptions);

  const MAX_FILE_SIZE_BYTES = maxFileSize * 1024 * 1024;

  const handleFileUpload = useCallback(async (file, additionalOptions = {}) => {
    try {
      if (!file) return false;
      if (file.size > MAX_FILE_SIZE_BYTES) {
        showToast({ title: 'File too large', message: `Max ${maxFileSize} MB allowed.`, variant: 'error' });
        return false;
      }

      const format = getLyricImportFormatForName(file.name || '');
      if (!format) {
        showToast({ title: 'Unsupported file', message: 'Supported lyric files: .txt, .lrc, .md, .markdown, .rtf, .docx.', variant: 'warn' });
        return false;
      }
      const fileType = format.fileType;
      const isLrc = fileType === 'lrc';

      const parsingOptions = mergeLyricsParsingOptions(lyricsParsingOptions, additionalOptions);
      const parsed = await parseLyricsFileAsync(file, {
        ...additionalOptions,
        ...parsingOptions,
        fileType,
      });
      if (!parsed || !Array.isArray(parsed.processedLines)) {
        throw new Error('Invalid lyrics parse response');
      }

      setLyrics(parsed.processedLines);

      let sourceContent = typeof additionalOptions.rawText === 'string'
        ? additionalOptions.rawText
        : (parsed.rawText || '');
      if ((isLrc || fileType === 'txt') && typeof additionalOptions.rawText !== 'string' && file && typeof file.text === 'function') {
        try {
          sourceContent = await file.text();
        } catch {
          sourceContent = parsed.rawText || '';
        }
      }

      setRawLyricsContent(sourceContent);

      setLyricsTimestamps(parsed.timestamps || []);
      setLyricsEnhancedTimestamps(parsed.enhancedTimestamps || []);

      selectLine(null);

      const baseName = stripLyricImportExtension(file.name);
      const filePath = additionalOptions.filePath || file?.path || null;
      setLyricsFileName(baseName);
      setLyricsSource({
        content: sourceContent,
        fileType,
        filePath,
        fileName: file.name,
        setlistItemId: additionalOptions.setlistItemId || null,
        ...(fileType === 'txt' ? { groupingPlan: parsed.groupingPlan || null } : {}),
      });

      const detected = detectArtistFromFilename(baseName);
      const providedMetadata = additionalOptions.songMetadata && typeof additionalOptions.songMetadata === 'object'
        ? additionalOptions.songMetadata
        : null;
      const metadata = providedMetadata
        ? {
          ...providedMetadata,
          title: providedMetadata.title || detected.title || baseName,
          lyricLines: parsed.processedLines.length,
          filePath,
          ...(fileType === 'txt' ? { groupingPlan: parsed.groupingPlan || null } : {}),
        }
        : {
          title: detected.title || baseName,
          artists: detected.artist ? [detected.artist] : [],
          album: null,
          year: null,
          lyricLines: parsed.processedLines.length,
          origin: getLyricOriginLabel(fileType),
          filePath,
          ...(fileType === 'txt' ? { groupingPlan: parsed.groupingPlan || null } : {}),
        };
      setSongMetadata(metadata);

      emitLyricsLoad({
        lyrics: parsed.processedLines,
        fileName: baseName,
        rawLyricsContent: sourceContent,
        lyricsSource: {
          content: sourceContent,
          fileType,
          filePath,
          fileName: file.name,
          setlistItemId: additionalOptions.setlistItemId || null,
          ...(fileType === 'txt' ? { groupingPlan: parsed.groupingPlan || null } : {}),
        },
        songMetadata: metadata,
        lyricsTimestamps: parsed.timestamps || [],
        lyricsEnhancedTimestamps: parsed.enhancedTimestamps || [],
        sections: parsed.sections || [],
        lineToSection: parsed.lineToSection || {},
      });

      if (socket && socket.connected) {
        socket.emit('fileNameUpdate', baseName);

        if (parsed.timestamps) {
          socket.emit('lyricsTimestampsUpdate', parsed.timestamps);
        }
      }

      window.dispatchEvent(new CustomEvent('lyrics-tutorial-load', {
        detail: {
          fileName: baseName,
          filePath,
          fileType,
        }
      }));

      try {
        if (filePath && window?.electronAPI?.addRecentFile) {
          await window.electronAPI.addRecentFile(filePath);
        }
      } catch { }

      showToast({ title: 'File loaded', message: `${getLyricFormatLabel(fileType)}: ${baseName}`, variant: 'success' });

      return true;
    } catch (err) {
      console.error('Failed to read lyrics file:', err);
      showToast({ title: 'Failed to load file', message: 'Please check the file and try again.', variant: 'error' });
      return false;
    }
  }, [setLyrics, setRawLyricsContent, selectLine, setLyricsFileName, setLyricsSource, setSongMetadata, setLyricsTimestamps, setLyricsEnhancedTimestamps, emitLyricsLoad, lyricsParsingOptions, socket, showToast, maxFileSize, MAX_FILE_SIZE_BYTES]);

  return handleFileUpload;
};

export default useFileUpload;
