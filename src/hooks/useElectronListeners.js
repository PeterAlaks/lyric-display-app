import { useEffect } from 'react';
import useSetlistLoader from './useSetlistLoader';

export const useElectronListeners = ({
  processLoadedLyrics,
  showToast,
  setEasyWorshipModalOpen,
  openSupportDevModal,
  setlistFiles,
  setSetlistFiles,
  emitSetlistAdd,
  emitSetlistClear
}) => {
  const loadSetlist = useSetlistLoader({ setlistFiles, setSetlistFiles, emitSetlistAdd, emitSetlistClear });

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

  useEffect(() => {
    if (!window?.electronAPI?.onOpenSetlistFromPath) return;

    const handleOpenSetlistFromPath = async (payload) => {
      const { filePath } = payload;
      console.log('[ElectronListeners] Opening setlist from path:', filePath);

      try {
        const result = await window.electronAPI.setlist.loadFromPath(filePath);

        if (result.success && result.setlistData) {
          const blob = new Blob([JSON.stringify(result.setlistData)], { type: 'application/json' });
          const file = new File([blob], 'setlist.ldset', { type: 'application/json' });

          await loadSetlist(file);
        } else {
          showToast({
            title: 'Load failed',
            message: result.error || 'Could not load setlist',
            variant: 'error',
          });
        }
      } catch (error) {
        console.error('Error loading setlist from path:', error);
        showToast({
          title: 'Load failed',
          message: error.message || 'An error occurred',
          variant: 'error',
        });
      }
    };

    const cleanup = window.electronAPI.onOpenSetlistFromPath(handleOpenSetlistFromPath);
    return () => {
      try {
        if (typeof cleanup === 'function') cleanup();
      } catch { }
    };
  }, [loadSetlist, showToast]);
};