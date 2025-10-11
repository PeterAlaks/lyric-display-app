import { useEffect } from 'react';

const useMenuShortcuts = (navigate, fileInputRef) => {
  useEffect(() => {
    if (!window.electronAPI) return;

    const handleTriggerFileLoad = async () => {
      try {
        if (window.electronAPI?.loadLyricsFile) {
          const result = await window.electronAPI.loadLyricsFile();
          if (result && result.success && result.content) {
            const payload = { content: result.content, fileName: result.fileName, filePath: result.filePath };
            window.dispatchEvent(new CustomEvent('lyrics-opened', { detail: payload }));
            return;
          }
          if (result && result.canceled) return;
        }
      } catch (e) {
      }
      fileInputRef?.current?.click();
    };

    const handleNavigateToNewSong = () => {
      navigate('/new-song?mode=new');
    };

    window.electronAPI.onTriggerFileLoad(handleTriggerFileLoad);
    window.electronAPI.onNavigateToNewSong(handleNavigateToNewSong);

    return () => {
      window.electronAPI.removeAllListeners('trigger-file-load');
      window.electronAPI.removeAllListeners('navigate-to-new-song');
    };
  }, [navigate, fileInputRef]);
};

export default useMenuShortcuts;
