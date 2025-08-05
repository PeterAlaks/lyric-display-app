import { useCallback } from 'react';
import { parseLyrics } from '../utils/parseLyrics';
import useLyricsStore from '../context/LyricsStore';
import useSocket from './useSocket';

const useFileUpload = () => {
  const { setLyrics, selectLine, setLyricsFileName } = useLyricsStore(); // 👈 include setter
  const { emitLyricsLoad } = useSocket();

  const handleFileUpload = useCallback(async (file) => {
    try {
      const parsed = await parseLyrics(file);

      setLyrics(parsed);
      selectLine(null);
      emitLyricsLoad(parsed);

      // 👇 Set the filename without the .txt extension
      const baseName = file.name.replace(/\.txt$/i, '');
      setLyricsFileName(baseName);
    } catch (err) {
      console.error('Failed to read lyrics file:', err);
    }
  }, [setLyrics, selectLine, setLyricsFileName, emitLyricsLoad]);

  return handleFileUpload;
};

export default useFileUpload;
