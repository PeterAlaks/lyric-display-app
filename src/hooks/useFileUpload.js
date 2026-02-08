import { useCallback, useState, useEffect } from 'react';
import { parseLyricsFileAsync } from '../utils/asyncLyricsParser';
import { useLyricsState } from './useStoreSelectors';
import { useControlSocket } from '../context/ControlSocketProvider';
import useToast from './useToast';
import { detectArtistFromFilename } from '../utils/artistDetection';

const useFileUpload = () => {
  const { setLyrics, setRawLyricsContent, selectLine, setLyricsFileName, setSongMetadata, setLyricsTimestamps } = useLyricsState();
  const { emitLyricsLoad, socket } = useControlSocket();
  const { showToast } = useToast();

  const [maxFileSize, setMaxFileSize] = useState(2);

  useEffect(() => {
    const loadMaxFileSize = async () => {
      try {
        if (window.electronAPI?.preferences?.getFileHandling) {
          const result = await window.electronAPI.preferences.getFileHandling();
          if (result.success && result.settings) {
            setMaxFileSize(result.settings.maxFileSize ?? 2);
          }
        }
      } catch (error) {
        console.error('Failed to load max file size preference:', error);
      }
    };
    loadMaxFileSize();
  }, []);

  const MAX_FILE_SIZE_BYTES = maxFileSize * 1024 * 1024;

  const handleFileUpload = useCallback(async (file, additionalOptions = {}) => {
    try {
      if (!file) return false;
      if (file.size > MAX_FILE_SIZE_BYTES) {
        showToast({ title: 'File too large', message: `Max ${maxFileSize} MB allowed.`, variant: 'error' });
        return false;
      }

      const nameLower = (file.name || '').toLowerCase();
      const isTxt = nameLower.endsWith('.txt');
      const isLrc = nameLower.endsWith('.lrc');
      if (!isTxt && !isLrc) {
        showToast({ title: 'Unsupported file', message: 'Only .txt or .lrc files are supported.', variant: 'warn' });
        return false;
      }

      const parsed = await parseLyricsFileAsync(file, {
        fileType: isLrc ? 'lrc' : 'txt',
        ...additionalOptions
      });
      if (!parsed || !Array.isArray(parsed.processedLines)) {
        throw new Error('Invalid lyrics parse response');
      }

      setLyrics(parsed.processedLines);

      if (isLrc && file) {
        try {
          const originalContent = await file.text();
          setRawLyricsContent(originalContent);
        } catch {

          setRawLyricsContent(parsed.rawText);
        }
      } else {
        setRawLyricsContent(parsed.rawText);
      }

      if (parsed.timestamps) {
        setLyricsTimestamps(parsed.timestamps);
      }

      selectLine(null);

      const baseName = file.name.replace(/\.(txt|lrc)$/i, '');
      const filePath = additionalOptions.filePath || file?.path || null;
      setLyricsFileName(baseName);

      const detected = detectArtistFromFilename(baseName);
      const metadata = {
        title: detected.title || baseName,
        artists: detected.artist ? [detected.artist] : [],
        album: null,
        year: null,
        lyricLines: parsed.processedLines.length,
        origin: isLrc ? 'Local (.lrc)' : 'Local (.txt)',
        filePath
      };
      setSongMetadata(metadata);

      emitLyricsLoad(parsed.processedLines);

      if (socket && socket.connected) {
        socket.emit('fileNameUpdate', baseName);

        if (parsed.timestamps) {
          socket.emit('lyricsTimestampsUpdate', parsed.timestamps);
        }
      }

      try {
        if (filePath && window?.electronAPI?.addRecentFile) {
          await window.electronAPI.addRecentFile(filePath);
        }
      } catch { }

      showToast({ title: 'File loaded', message: `${isLrc ? 'LRC' : 'Text'}: ${baseName}`, variant: 'success' });

      return true;
    } catch (err) {
      console.error('Failed to read lyrics file:', err);
      showToast({ title: 'Failed to load file', message: 'Please check the file and try again.', variant: 'error' });
      return false;
    }
  }, [setLyrics, setRawLyricsContent, selectLine, setLyricsFileName, setSongMetadata, setLyricsTimestamps, emitLyricsLoad, socket, showToast, maxFileSize, MAX_FILE_SIZE_BYTES]);

  return handleFileUpload;
};

export default useFileUpload;