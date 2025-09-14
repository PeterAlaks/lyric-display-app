import { useCallback } from 'react';
import { parseLyrics } from '../utils/parseLyrics';
import { parseLrc } from '../utils/parseLrc';
import useLyricsStore from '../context/LyricsStore';
import useSocket from './useSocket';
import useToast from './useToast';

const useFileUpload = () => {
  const { setLyrics, setRawLyricsContent, selectLine, setLyricsFileName } = useLyricsStore();
  const { emitLyricsLoad, socket } = useSocket(); // Add socket to destructuring
  const { showToast } = useToast();

  const MAX_FILE_SIZE_MB = 2;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

  const handleFileUpload = useCallback(async (file) => {
    try {
      if (!file) return;
      // Validate size
      if (file.size > MAX_FILE_SIZE_BYTES) {
        showToast({ title: 'File too large', message: `Max ${MAX_FILE_SIZE_MB} MB allowed.`, variant: 'error' });
        return;
      }

      const nameLower = (file.name || '').toLowerCase();
      const isTxt = nameLower.endsWith('.txt');
      const isLrc = nameLower.endsWith('.lrc');
      if (!isTxt && !isLrc) {
        showToast({ title: 'Unsupported file', message: 'Only .txt or .lrc files are supported.', variant: 'warn' });
        return;
      }

      // Parse the file to get both raw text and processed lines
      const parsed = isLrc ? await parseLrc(file) : await parseLyrics(file);

      // Store the processed lines for display in the control panel
      setLyrics(parsed.processedLines);

      // Store the original raw text for editing purposes
      setRawLyricsContent(parsed.rawText);

      // Clear any selected line
      selectLine(null);

      // Set the filename
      const baseName = file.name.replace(/\.(txt|lrc)$/i, '');
      setLyricsFileName(baseName);

      // Emit to connected outputs
      emitLyricsLoad(parsed.processedLines);

      // Broadcast filename to all clients
      if (socket && socket.connected) {
        socket.emit('fileNameUpdate', baseName);
      }

      showToast({ title: 'File loaded', message: `${isLrc ? 'LRC' : 'Text'}: ${baseName}`, variant: 'success' });

    } catch (err) {
      console.error('Failed to read lyrics file:', err);
      showToast({ title: 'Failed to load file', message: 'Please check the file and try again.', variant: 'error' });
    }
  }, [setLyrics, setRawLyricsContent, selectLine, setLyricsFileName, emitLyricsLoad, socket, showToast]);

  return handleFileUpload;
};

export default useFileUpload;
