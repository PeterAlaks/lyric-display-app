import { useCallback } from 'react';
import { parseLyricsFileAsync } from '../utils/asyncLyricsParser';
import { useLyricsState } from './useStoreSelectors';
import { useControlSocket } from '../context/ControlSocketProvider';
import useToast from './useToast';

const useFileUpload = () => {
  const { setLyrics, setRawLyricsContent, selectLine, setLyricsFileName } = useLyricsState();
  const { emitLyricsLoad, socket } = useControlSocket();
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
      const parsed = await parseLyricsFileAsync(file, { fileType: isLrc ? 'lrc' : 'txt' });
      if (!parsed || !Array.isArray(parsed.processedLines)) {
        throw new Error('Invalid lyrics parse response');
      }

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

      // Add to recent files (Electron only)
      try {
        const filePath = file?.path;
        if (filePath && window?.electronAPI?.addRecentFile) {
          await window.electronAPI.addRecentFile(filePath);
        }
      } catch { }

      showToast({ title: 'File loaded', message: `${isLrc ? 'LRC' : 'Text'}: ${baseName}`, variant: 'success' });

    } catch (err) {
      console.error('Failed to read lyrics file:', err);
      showToast({ title: 'Failed to load file', message: 'Please check the file and try again.', variant: 'error' });
    }
  }, [setLyrics, setRawLyricsContent, selectLine, setLyricsFileName, emitLyricsLoad, socket, showToast]);

  return handleFileUpload;
};

export default useFileUpload;
