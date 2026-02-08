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
    window.addEventListener('trigger-file-load', handleTriggerFileLoad);
    window.addEventListener('navigate-to-new-song', handleNavigateToNewSong);

    return () => {
      window.electronAPI.removeAllListeners('trigger-file-load');
      window.electronAPI.removeAllListeners('navigate-to-new-song');
      window.removeEventListener('trigger-file-load', handleTriggerFileLoad);
      window.removeEventListener('navigate-to-new-song', handleNavigateToNewSong);
    };
  }, [navigate, fileInputRef]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;
      const activeElement = document.activeElement;
      const isTyping = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable
      );

      if (cmdOrCtrl && !event.shiftKey && event.key === 'z') {
        if (isTyping) return;
        event.preventDefault();
        window.dispatchEvent(new Event('menu-undo'));
        return;
      }

      if (cmdOrCtrl && event.shiftKey && (event.key === 'z' || event.key === 'Z')) {
        if (isTyping) return;
        event.preventDefault();
        window.dispatchEvent(new Event('menu-redo'));
        return;
      }

      if (cmdOrCtrl && !event.shiftKey && event.key === 'x') {
        if (!isTyping) return;
        return;
      }

      if (cmdOrCtrl && !event.shiftKey && event.key === 'c') {
        if (!isTyping) return;
        return;
      }

      if (cmdOrCtrl && !event.shiftKey && event.key === 'v') {
        if (!isTyping) return;
        return;
      }

      if (cmdOrCtrl && !event.shiftKey && event.key === 'a') {
        if (!isTyping) return;
        return;
      }

      if (cmdOrCtrl && !event.shiftKey && event.key === 'r') {
        event.preventDefault();
        window.electronAPI?.windowControls?.reload?.();
        return;
      }

      if (cmdOrCtrl && event.shiftKey && event.key === 'I') {
        event.preventDefault();
        window.electronAPI?.windowControls?.toggleDevTools?.();
        return;
      }

      if (cmdOrCtrl && !event.shiftKey && (event.key === 'i' || event.key === 'I')) {
        if (isTyping) return;
        event.preventDefault();
        window.dispatchEvent(new Event('open-user-preferences'));
        return;
      }

      if (cmdOrCtrl && !event.shiftKey && (event.key === '+' || event.key === '=')) {
        event.preventDefault();
        window.electronAPI?.windowControls?.setZoom?.('in');
        return;
      }

      if (cmdOrCtrl && !event.shiftKey && (event.key === '-' || event.key === '_')) {
        event.preventDefault();
        window.electronAPI?.windowControls?.setZoom?.('out');
        return;
      }

      if (cmdOrCtrl && !event.shiftKey && event.key === '0') {
        event.preventDefault();
        window.electronAPI?.windowControls?.setZoom?.('reset');
        return;
      }

      if (event.key === 'F11') {
        event.preventDefault();
        window.electronAPI?.windowControls?.toggleFullscreen?.();
        return;
      }

      if (event.altKey && event.key === 'F4') {
        event.preventDefault();
        window.electronAPI?.windowControls?.close?.();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);
};

export default useMenuShortcuts;