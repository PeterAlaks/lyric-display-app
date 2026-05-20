import { useEffect, useRef } from 'react';

export const usePendingSavedVersionPrompt = ({
  clearPendingSavedVersion,
  lyricsFileName,
  pendingSavedVersion,
  processLoadedLyrics,
  rawLyricsContent,
  showToast,
}) => {
  const handledSavedVersionRef = useRef(null);

  useEffect(() => {
    if (!pendingSavedVersion) return;

    const key = pendingSavedVersion.createdAt || `${pendingSavedVersion.filePath || ''}-${pendingSavedVersion.fileName || ''}`;
    if (handledSavedVersionRef.current === key) {
      clearPendingSavedVersion();
      return;
    }
    handledSavedVersionRef.current = key;

    const { rawText, fileName: savedBaseName, filePath, extension } = pendingSavedVersion;
    const safeBaseName = savedBaseName || lyricsFileName || 'lyrics';
    const savedFileName = `${safeBaseName}.${extension || 'txt'}`;

    const loadSavedVersion = async () => {
      try {
        await processLoadedLyrics(
          {
            content: rawText || '',
            fileName: savedFileName,
            filePath: filePath || null,
            fileType: extension || 'txt'
          },
          { fallbackFileName: savedFileName }
        );
      } catch (error) {
        console.error('Failed to reload saved lyrics from pending version:', error);
        showToast({
          title: 'Load failed',
          message: 'Could not load the last saved lyrics file.',
          variant: 'error'
        });
      }
    };

    showToast({
      title: 'Load saved lyrics',
      message: 'You recently saved a lyrics file. Do you want to load that into the control panel?',
      variant: 'info',
      duration: 7000,
      actions: [
        { label: 'Load lyrics', onClick: loadSavedVersion }
      ]
    });

    clearPendingSavedVersion();
  }, [pendingSavedVersion, clearPendingSavedVersion, processLoadedLyrics, rawLyricsContent, lyricsFileName, showToast]);
};
