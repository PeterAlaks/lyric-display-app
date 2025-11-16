import { useEffect } from 'react';

export const useElectronListeners = ({
  processLoadedLyrics,
  showToast,
  setEasyWorshipModalOpen,
  openSupportDevModal
}) => {

  useEffect(() => {
    if (!window?.electronAPI?.onOpenLyricsFromPath) return;
    const off = window.electronAPI.onOpenLyricsFromPath(async (payload) => {
      await processLoadedLyrics(payload || {});
    });
    return () => { try { off?.(); } catch { } };
  }, [processLoadedLyrics]);

  useEffect(() => {
    if (!window?.electronAPI?.onOpenLyricsFromPathError) return;
    const off = window.electronAPI.onOpenLyricsFromPathError(({ filePath }) => {
      showToast({
        title: 'File not found',
        message: `The file could not be opened. It may have been moved or deleted.\n${filePath || ''}`,
        variant: 'error'
      });
    });
    return () => { try { off?.(); } catch { } };
  }, [showToast]);

  useEffect(() => {
    const listener = (e) => {
      const payload = e?.detail || {};
      processLoadedLyrics(payload);
    };
    window.addEventListener('lyrics-opened', listener);
    return () => window.removeEventListener('lyrics-opened', listener);
  }, [processLoadedLyrics]);

  useEffect(() => {
    if (!window?.electronAPI?.onOpenEasyWorshipImport) return;

    const off = window.electronAPI.onOpenEasyWorshipImport(() => {
      setEasyWorshipModalOpen(true);
    });

    return () => {
      try {
        if (typeof off === 'function') off();
      } catch { }
    };
  }, [setEasyWorshipModalOpen]);

  useEffect(() => {
    if (!window?.electronAPI?.onOpenSupportDevModal) return;

    const off = window.electronAPI.onOpenSupportDevModal(() => {
      openSupportDevModal?.();
    });

    return () => {
      try {
        if (typeof off === 'function') off();
      } catch { }
    };
  }, [openSupportDevModal]);
};