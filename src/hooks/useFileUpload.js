import { useCallback } from 'react';
import { parseLyrics } from '../utils/parseLyrics';
import useLyricsStore from '../context/LyricsStore';
import useSocket from './useSocket';

const useFileUpload = () => {
  const { setLyrics, setRawLyricsContent, selectLine, setLyricsFileName } = useLyricsStore();
  const { emitLyricsLoad } = useSocket();

  const handleFileUpload = useCallback(async (file) => {
    try {
      // Parse the file to get both raw text and processed lines
      const parsed = await parseLyrics(file);

      // Store the processed lines for display in the control panel
      setLyrics(parsed.processedLines);
      
      // Store the original raw text for editing purposes
      // This preserves the exact original formatting
      setRawLyricsContent(parsed.rawText);
      
      // Clear any selected line
      selectLine(null);
      
      // Emit to connected outputs
      emitLyricsLoad(parsed.processedLines);

      // Set the filename
      const baseName = file.name.replace(/\.txt$/i, '');
      setLyricsFileName(baseName);
      
    } catch (err) {
      console.error('Failed to read lyrics file:', err);
      alert('Failed to process lyrics file. Please check the file format and try again.');
    }
  }, [setLyrics, setRawLyricsContent, selectLine, setLyricsFileName, emitLyricsLoad]);

  return handleFileUpload;
};

export default useFileUpload;