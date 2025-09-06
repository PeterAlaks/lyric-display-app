import { useCallback } from 'react';
import { parseLyrics } from '../utils/parseLyrics';
import useLyricsStore from '../context/LyricsStore';
import useSocket from './useSocket';

const useFileUpload = () => {
  const { setLyrics, setRawLyricsContent, selectLine, setLyricsFileName } = useLyricsStore();
  const { emitLyricsLoad, socket } = useSocket(); // Add socket to destructuring

  const handleFileUpload = useCallback(async (file) => {
    try {
      // Parse the file to get both raw text and processed lines
      const parsed = await parseLyrics(file);

      // Store the processed lines for display in the control panel
      setLyrics(parsed.processedLines);

      // Store the original raw text for editing purposes
      setRawLyricsContent(parsed.rawText);

      // Clear any selected line
      selectLine(null);

      // Set the filename
      const baseName = file.name.replace(/\.txt$/i, '');
      setLyricsFileName(baseName);

      // Emit to connected outputs
      emitLyricsLoad(parsed.processedLines);

      // Broadcast filename to all clients
      if (socket && socket.connected) {
        socket.emit('fileNameUpdate', baseName);
      }

    } catch (err) {
      console.error('Failed to read lyrics file:', err);
      alert('Failed to process lyrics file. Please check the file format and try again.');
    }
  }, [setLyrics, setRawLyricsContent, selectLine, setLyricsFileName, emitLyricsLoad, socket]);

  return handleFileUpload;
};

export default useFileUpload;