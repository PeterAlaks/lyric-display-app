import { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useModal from '@/hooks/useModal';
import useToast from '@/hooks/useToast';
import { useDarkModeState } from '@/hooks/useStoreSelectors';
import useLyricsStore from '@/context/LyricsStore';
import { confirmAndLaunchHeadlessMode, createLyricDisplayDockSetupActions } from '@/utils/lyricDisplayDock';

const useMenuHandlers = (closeMenu) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showModal } = useModal();
  const { showToast } = useToast();
  const { darkMode, setDarkMode } = useDarkModeState();
  const isNewSongCanvas = location.pathname === '/new-song';
  const isDevMode = import.meta.env.MODE === 'development';

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
                if (!window?.electronAPI?.parseLyricsFile) {
                  throw new Error('File reading API not available');
                }
                const result = await window.electronAPI.parseLyricsFile({ path: filePath });
                if (result?.success && result.payload?.rawText) {
                  window.dispatchEvent(new CustomEvent('load-into-canvas', {
                    detail: {
                      content: result.payload.rawText,
                      fileName,
                      filePath
                    }
                  }));
                } else {
                  throw new Error(result?.error || 'Failed to read file');
                }
              } catch (error) {
                console.error('Failed to open recent file:', error);
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

  const handleOpenObsSourceCreator = useCallback(() => {
    closeMenu();
    try {
      window.electronAPI?.display?.openObsSourceCreatorWindow?.();
    } catch (error) {
      console.warn('Failed to open OBS Source Creator window:', error);
    }
  }, [closeMenu]);

  const handleEasyWorship = useCallback(() => {
    closeMenu();
    window.dispatchEvent(new Event('open-easyworship-import'));
  }, [closeMenu]);

  const handlePresentationImport = useCallback(() => {
    closeMenu();
    window.dispatchEvent(new Event('open-presentation-import'));
  }, [closeMenu]);

  const handleOpenOnlineLyricsSearch = useCallback(() => {
    closeMenu();
    window.dispatchEvent(new Event('open-online-lyrics-search'));
  }, [closeMenu]);

  const handleOpenSetlist = useCallback(() => {
    closeMenu();
    window.dispatchEvent(new Event('open-setlist-modal'));
  }, [closeMenu]);

  const handlePreviewOutputs = useCallback(() => {
    closeMenu();
    showModal({
      title: 'Preview Outputs',
      headerDescription: 'Preview output, stage, time and custom displays with current output visibility.',
      component: 'PreviewOutputs',
      variant: 'info',
      size: 'large',
      dismissLabel: 'Close',
      className: 'max-w-4xl'
    });
  }, [closeMenu, showModal]);

  const handleSyncOutputs = useCallback(() => {
    closeMenu();
    window.dispatchEvent(new Event('sync-outputs-from-menu'));
  }, [closeMenu]);

  const handleOpenTimerControl = useCallback(async () => {
    closeMenu();

    try {
      if (window?.electronAPI?.display?.openTimerControlWindow) {
        await window.electronAPI.display.openTimerControlWindow();
        return;
      }
    } catch (error) {
      console.warn('Failed to open timer control window:', error);
    }

    navigate('/timer-control');
  }, [closeMenu, navigate]);

  const handleOpenLyricVideoStudio = useCallback(() => {
    closeMenu();
    navigate('/lyric-video-studio');
  }, [closeMenu, navigate]);

  const handleNdiPreferences = useCallback(() => {
    closeMenu();
    showModal({
      title: 'Preferences',
      component: 'UserPreferences',
      variant: 'info',
      size: 'lg',
      customLayout: true,
      initialCategory: 'ndi',
      actions: [],
      allowBackdropClose: false,
    });
  }, [closeMenu, showModal]);

  const handleUserMedia = useCallback(() => {
    closeMenu();
    showModal({
      title: 'User Media',
      headerDescription: 'Browse uploaded images and video assets.',
      component: 'UserMedia',
      variant: 'info',
      size: 'lg',
      customLayout: true,
      scrollBehavior: 'none',
      actions: [],
      allowedTypes: ['image', 'video'],
      initialTab: 'image',
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
    const themeMode = useLyricsStore.getState?.()?.themeMode;
    if (themeMode === 'system') return;

    const next = !darkMode;
    const nextMode = next ? 'dark' : 'light';
    setDarkMode(next);
    const { setThemeMode } = useLyricsStore.getState?.() || {};
    if (setThemeMode) {
      setThemeMode(nextMode);
    }
    window.electronAPI?.preferences?.set?.('appearance.themeMode', nextMode);
    window.electronAPI?.syncNativeThemeSource?.(nextMode);
    window.electronAPI?.setDarkMode?.(next);
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
    await showModal({
      title: 'Project to Display',
      headerDescription: 'Choose what to show and where it should appear.',
      component: 'ProjectOutput',
      variant: 'info',
      size: 'lg',
      className: 'max-w-4xl',
      actions: [],
      customLayout: true
    });
  }, [closeMenu, showModal]);

  const handlePreServiceHealth = useCallback(() => {
    closeMenu();
    showModal({
      title: 'Production Readiness Check',
      headerDescription: 'Review service-critical connection, output, NDI, display, media, and safety status',
      component: 'PreServiceHealth',
      variant: 'info',
      size: 'lg',
      customLayout: true,
      actions: [{ label: 'Close', variant: 'outline' }],
    });
  }, [closeMenu, showModal]);

  const handleOperatorActionLog = useCallback(() => {
    closeMenu();
    showModal({
      title: 'Operator Action Log',
      headerDescription: 'Review recent live control actions and export the log if needed',
      component: 'OperatorActionLog',
      variant: 'info',
      size: 'lg',
      customLayout: true,
      actions: [{ label: 'Close', variant: 'outline' }],
    });
  }, [closeMenu, showModal]);

  const handleLaunchHeadlessMode = useCallback(
    () => confirmAndLaunchHeadlessMode({ showModal, showToast }),
    [showModal, showToast]
  );

  const handleObsDockSetup = useCallback(() => {
    closeMenu();
    showModal({
      title: 'LyricDisplay Dock Setup',
      headerDescription: 'Copy the OBS dock URL and review Dock Mode startup options',
      component: 'ObsDockInfo',
      variant: 'info',
      size: 'lg',
      scrollBehavior: 'scroll',
      actions: isDevMode
        ? [{ label: 'Close', variant: 'outline' }]
        : createLyricDisplayDockSetupActions(handleLaunchHeadlessMode),
    });
  }, [closeMenu, handleLaunchHeadlessMode, isDevMode, showModal]);

  const handleDocs = useCallback(() => {
    closeMenu();
    window.open('https://lyricdisplay.app/documentation', '_blank', 'noopener,noreferrer');
  }, [closeMenu]);

  const handleRepo = useCallback(() => {
    closeMenu();
    window.open('https://github.com/PeterAlaks/lyric-display-app', '_blank', 'noopener,noreferrer');
  }, [closeMenu]);

  const handleConnectionDiagnostics = useCallback(() => {
    closeMenu();
    showModal({
      title: 'Connection Diagnostics',
      headerDescription: 'Inspect connected clients, sync state, and retry health',
      component: 'ConnectionDiagnostics',
      variant: 'info',
      size: 'large',
      actions: [
        { label: 'Close', variant: 'outline' },
        {
          label: 'Production Readiness',
          variant: 'default',
          onSelect: () => {
            showModal({
              title: 'Production Readiness Check',
              headerDescription: 'Review service-critical connection, output, NDI, display, media, and safety status',
              component: 'PreServiceHealth',
              variant: 'info',
              size: 'lg',
              customLayout: true,
              actions: [{ label: 'Close', variant: 'outline' }],
            });
          },
        },
      ],
    });
  }, [closeMenu, showModal]);

  const handleIntegrationGuide = useCallback(() => {
    closeMenu();
    showModal({
      title: 'Streaming Software Integration',
      headerDescription: 'Connect LyricDisplay to OBS, vMix or Wirecast',
      component: 'IntegrationInstructions',
      variant: 'info',
      size: 'lg',
      customLayout: true,
      dismissLabel: 'Close'
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

  const handleAbout = useCallback(async (appVersion) => {
    closeMenu();
    const result = await showModal({
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

    if (result?.action === 'checkUpdates') {
      handleCheckUpdates();
    }
  }, [closeMenu, showModal, handleCheckUpdates]);

  const handlePreferences = useCallback(() => {
    closeMenu();
    showModal({
      title: 'Preferences',
      headerDescription: 'Configure application settings and preferences',
      component: 'UserPreferences',
      variant: 'info',
      size: 'lg',
      actions: [],
      allowBackdropClose: false,
      customLayout: true
    });
  }, [closeMenu, showModal]);

  return {
    handleNewLyrics,
    handleOpenLyrics,
    handleOpenRecent,
    handleClearRecents,
    handleConnectMobile,
    handleOpenObsSourceCreator,
    handleEasyWorship,
    handlePresentationImport,
    handleOpenOnlineLyricsSearch,
    handleOpenSetlist,
    handlePreviewOutputs,
    handleSyncOutputs,
    handleOpenTimerControl,
    handleOpenLyricVideoStudio,
    handleNdiPreferences,
    handleUserMedia,
    handleQuit,

    handleUndo,
    handleRedo,
    handleClipboardAction,
    handlePreferences,

    handleToggleDarkMode,
    handleZoom,
    handleReload,
    handleToggleDevTools,
    handleFullscreen,

    handleMinimize,
    handleMaximizeToggle,
    handleShortcuts,
    handleDisplaySettings,
    handlePreServiceHealth,
    handleOperatorActionLog,
    handleObsDockSetup,

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
