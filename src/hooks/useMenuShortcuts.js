import { useEffect } from 'react';

const useMenuShortcuts = (navigate, fileInputRef) => {
  useEffect(() => {
    if (!window.electronAPI) return;

    const handleTriggerFileLoad = () => {
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

