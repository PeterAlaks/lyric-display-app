import { useEffect } from 'react';
import useSetlistLoader from '../SetlistModal/useSetlistLoader';
import { logDebug, logError } from '../../utils/logger';

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
    const handler = () => setEasyWorshipModalOpen(true);
    let off;

    try {
      if (window?.electronAPI?.onOpenEasyWorshipImport) {
        off = window.electronAPI.onOpenEasyWorshipImport(handler);
      }
    } catch { }

    window.addEventListener('open-easyworship-import', handler);

    return () => {
      try {
        if (typeof off === 'function') off();
      } catch { }
      window.removeEventListener('open-easyworship-import', handler);
    };
  }, [setEasyWorshipModalOpen]);

  useEffect(() => {
    const handler = () => openSupportDevModal?.();
    let off;

    try {
      if (window?.electronAPI?.onOpenSupportDevModal) {
        off = window.electronAPI.onOpenSupportDevModal(handler);
      }
    } catch { }

    window.addEventListener('open-support-dev-modal', handler);

    return () => {
      try {
        if (typeof off === 'function') off();
      } catch { }
      window.removeEventListener('open-support-dev-modal', handler);
    };
  }, [openSupportDevModal]);

  useEffect(() => {
    if (!window?.electronAPI?.onOpenSetlistFromPath) return;

    const handleOpenSetlistFromPath = async (payload) => {
      const { filePath } = payload;
      logDebug('[ElectronListeners] Opening setlist from path:', filePath);

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
        logError('Error loading setlist from path:', error);
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