import { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useModal from '@/hooks/useModal';
import useToast from '@/hooks/useToast';
import { useDarkModeState } from '@/hooks/useStoreSelectors';

const useMenuHandlers = (closeMenu) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showModal } = useModal();
  const { showToast } = useToast();
  const { darkMode, setDarkMode } = useDarkModeState();
  const isNewSongCanvas = location.pathname === '/new-song';

  const handleNewLyrics = useCallback(() => {
    closeMenu();
    navigate('/new-song?mode=new');
    window.dispatchEvent(new Event('navigate-to-new-song'));
  }, [closeMenu, navigate]);

  const handleOpenLyrics = useCallback(async () => {
    closeMenu();
    
    if (isNewSongCanvas) {
      try {
        if (window?.electronAPI?.loadLyricsFile) {
          const result = await window.electronAPI.loadLyricsFile();
          if (result?.success && result.content) {
            showModal({
              title: 'Load Lyrics File',
              description: `You've selected "${result.fileName || 'a lyrics file'}". Choose where to load it:`,
              body: 'Load into the Canvas Editor to edit the lyrics, or load into the Control Panel to display them on your outputs.',
              variant: 'info',
              size: 'sm',
              actions: [
                {
                  label: 'Load into Canvas Editor',
                  variant: 'default',
                  value: 'canvas',
                  onSelect: () => {
                    window.dispatchEvent(new CustomEvent('load-into-canvas', {
                      detail: {
                        content: result.content,
                        fileName: result.fileName,
                        filePath: result.filePath
                      }
                    }));
                  }
                },
                {
                  label: 'Load into Control Panel',
                  variant: 'outline',
                  value: 'control',
                  onSelect: () => {
                    // Store the file data before navigation
                    window.__pendingLyricsLoad = {
                      content: result.content,
                      fileName: result.fileName,
                      filePath: result.filePath
                    };
                    navigate('/');
                  }
                }
              ]
            });
          }
        }
      } catch (error) {
        showToast({
          title: 'Load failed',
          message: error?.message || 'Could not load file',
          variant: 'error'
        });
      }
    } else {
      window.dispatchEvent(new Event('trigger-file-load'));
    }
  }, [closeMenu, isNewSongCanvas, showModal, showToast, navigate]);

  const handleOpenRecent = useCallback(async (filePath) => {
    closeMenu();
    if (!filePath) return;

    if (isNewSongCanvas) {
      const fileName = filePath.split(/[\\/]/).pop();
      showModal({
        title: 'Load Recent File',
        description: `You've selected "${fileName}". Choose where to load it:`,
        body: 'Load into the Canvas Editor to edit the lyrics, or load into the Control Panel to display them on your outputs.',
        variant: 'info',
        size: 'sm',
        actions: [
          {
            label: 'Load into Canvas Editor',
            variant: 'default',
            value: 'canvas',
            onSelect: async () => {
              try {
                const fs = await import('fs/promises');
                const content = await fs.readFile(filePath, 'utf8');
                
                window.dispatchEvent(new CustomEvent('load-into-canvas', {
                  detail: {
                    content,
                    fileName,
                    filePath
                  }
                }));
              } catch (error) {
                if (window?.electronAPI?.parseLyricsFile) {
                  try {
                    const result = await window.electronAPI.parseLyricsFile({ path: filePath });
                    if (result?.success && result.payload?.rawText) {
                      window.dispatchEvent(new CustomEvent('load-into-canvas', {
                        detail: {
                          content: result.payload.rawText,
                          fileName,
                          filePath
                        }
                      }));
                      return;
                    }
                  } catch (parseError) {
                    console.error('Parse error:', parseError);
                  }
                }
                
                showToast({
                  title: 'Could not open recent file',
                  message: 'File may have been moved or deleted.',
                  variant: 'error'
                });
              }
            }
          },
          {
            label: 'Load into Control Panel',
            variant: 'outline',
            value: 'control',
            onSelect: async () => {
              try {
                const result = await window.electronAPI?.recents?.open?.(filePath);
                if (result?.success === false) {
                  showToast({
                    title: 'Could not open recent file',
                    message: result.error || 'File may have been moved or deleted.',
                    variant: 'error'
                  });
                } else {
                  navigate('/');
                }
              } catch (error) {
                showToast({
                  title: 'Could not open recent file',
                  message: error?.message || 'Unknown error',
                  variant: 'error'
                });
              }
            }
          }
        ]
      });
    } else {
      try {
        const result = await window.electronAPI?.recents?.open?.(filePath);
        if (result?.success === false) {
          showToast({
            title: 'Could not open recent file',
            message: result.error || 'File may have been moved or deleted.',
            variant: 'error'
          });
        }
      } catch (error) {
        showToast({
          title: 'Could not open recent file',
          message: error?.message || 'Unknown error',
          variant: 'error'
        });
      }
    }
  }, [closeMenu, showToast, isNewSongCanvas, showModal, navigate]);

  const handleClearRecents = useCallback(async () => {
    closeMenu();
    try {
      await window.electronAPI?.recents?.clear?.();
    } catch (error) {
      console.warn('Failed to clear recents:', error);
    }
  }, [closeMenu]);

  const handleConnectMobile = useCallback(() => {
    closeMenu();
    window.dispatchEvent(new Event('open-qr-dialog'));
  }, [closeMenu]);

  const handleEasyWorship = useCallback(() => {
    closeMenu();
    window.dispatchEvent(new Event('open-easyworship-import'));
  }, [closeMenu]);

  const handlePreviewOutputs = useCallback(() => {
    closeMenu();
    showModal({
      title: 'Preview Outputs',
      headerDescription: 'Live preview of both output displays side-by-side',
      component: 'PreviewOutputs',
      variant: 'info',
      size: 'large',
      dismissLabel: 'Close',
      className: 'max-w-4xl'
    });
  }, [closeMenu, showModal]);

  const handleQuit = useCallback(() => {
    closeMenu();
    window.electronAPI?.windowControls?.close?.();
  }, [closeMenu]);

  const handleUndo = useCallback(() => {
    closeMenu();
    window.dispatchEvent(new Event('menu-undo'));
  }, [closeMenu]);

  const handleRedo = useCallback(() => {
    closeMenu();
    window.dispatchEvent(new Event('menu-redo'));
  }, [closeMenu]);

  const handleClipboardAction = useCallback((command) => {
    closeMenu();
    try {
      document.execCommand(command);
    } catch (error) {
      console.warn(`Clipboard action '${command}' failed:`, error);
    }
  }, [closeMenu]);

  const handleToggleDarkMode = useCallback(() => {
    closeMenu();
    const next = !darkMode;
    setDarkMode(next);
    window.electronAPI?.setDarkMode?.(next);
    window.electronAPI?.syncNativeDarkMode?.(next);
  }, [closeMenu, darkMode, setDarkMode]);

  const handleZoom = useCallback((direction) => {
    closeMenu();

    if (window.electronAPI?.windowControls?.setZoom) {
      window.electronAPI.windowControls.setZoom(direction);
    } else if (direction === 'reset') {
      window.location.reload();
    }
  }, [closeMenu]);

  const handleReload = useCallback(() => {
    closeMenu();
    window.electronAPI?.windowControls?.reload?.() || window.location.reload();
  }, [closeMenu]);

  const handleToggleDevTools = useCallback(() => {
    closeMenu();
    window.electronAPI?.windowControls?.toggleDevTools?.();
  }, [closeMenu]);

  const handleFullscreen = useCallback(() => {
    closeMenu();
    window.electronAPI?.windowControls?.toggleFullscreen?.();
  }, [closeMenu]);

  const handleMinimize = useCallback(() => {
    closeMenu();
    window.electronAPI?.windowControls?.minimize?.();
  }, [closeMenu]);

  const handleMaximizeToggle = useCallback(async (setWindowState) => {
    closeMenu();
    try {
      const result = await window.electronAPI?.windowControls?.toggleMaximize?.();
      if (result?.success && typeof result.isMaximized === 'boolean') {
        setWindowState((prev) => ({ ...prev, isMaximized: result.isMaximized }));
      }
    } catch (error) {
      console.warn('Failed to toggle maximize:', error);
    }
  }, [closeMenu]);

  const handleShortcuts = useCallback(() => {
    closeMenu();
    window.dispatchEvent(new Event('show-keyboard-shortcuts'));
  }, [closeMenu]);

  const handleDisplaySettings = useCallback(async () => {
    closeMenu();
    try {
      const result = await window.electronAPI?.displaySettings?.openModal?.();
      if (result?.success === false) {
        showToast({
          title: 'No external displays',
          message: result.error || 'Connect an external display to configure projection.',
          variant: 'info'
        });
      }
    } catch (error) {
      showToast({
        title: 'Could not open display settings',
        message: error?.message || 'Unknown error',
        variant: 'error'
      });
    }
  }, [closeMenu, showToast]);

  const handleDocs = useCallback(() => {
    closeMenu();
    window.open('https://github.com/PeterAlaks/lyric-display-app#readme', '_blank', 'noopener,noreferrer');
  }, [closeMenu]);

  const handleRepo = useCallback(() => {
    closeMenu();
    window.open('https://github.com/PeterAlaks/lyric-display-app', '_blank', 'noopener,noreferrer');
  }, [closeMenu]);

  const handleConnectionDiagnostics = useCallback(() => {
    closeMenu();
    showModal({
      title: 'Connection Diagnostics',
      component: 'ConnectionDiagnostics',
      variant: 'info',
      size: 'large',
      dismissLabel: 'Close'
    });
  }, [closeMenu, showModal]);

  const handleIntegrationGuide = useCallback(() => {
    closeMenu();
    showModal({
      title: 'Streaming Software Integration',
      headerDescription: 'Connect LyricDisplay to OBS, vMix, or Wirecast',
      component: 'IntegrationInstructions',
      variant: 'info',
      size: 'lg',
      dismissLabel: 'Close'
    });
  }, [closeMenu, showModal]);

  const handleAbout = useCallback((appVersion) => {
    closeMenu();
    showModal({
      title: 'About LyricDisplay',
      component: 'AboutApp',
      variant: 'info',
      size: 'md',
      version: appVersion,
      actions: [
        { label: 'Close', value: { action: 'close' }, variant: 'outline' },
        { label: 'Check for Updates', value: { action: 'checkUpdates' } }
      ]
    });
  }, [closeMenu, showModal]);

  const handleSupportDev = useCallback(() => {
    closeMenu();
    window.dispatchEvent(new Event('open-support-dev-modal'));
  }, [closeMenu]);

  const handleCheckUpdates = useCallback(() => {
    closeMenu();
    window.electronAPI?.checkForUpdates?.(true);
  }, [closeMenu]);

  return {
    handleNewLyrics,
    handleOpenLyrics,
    handleOpenRecent,
    handleClearRecents,
    handleConnectMobile,
    handleEasyWorship,
    handlePreviewOutputs,
    handleQuit,

    handleUndo,
    handleRedo,
    handleClipboardAction,

    handleToggleDarkMode,
    handleZoom,
    handleReload,
    handleToggleDevTools,
    handleFullscreen,

    handleMinimize,
    handleMaximizeToggle,
    handleShortcuts,
    handleDisplaySettings,

    handleDocs,
    handleRepo,
    handleConnectionDiagnostics,
    handleIntegrationGuide,
    handleAbout,
    handleSupportDev,
    handleCheckUpdates,
  };
};

export default useMenuHandlers;