import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Minus, Square, Copy, X } from 'lucide-react';
import { useDarkModeState } from '@/hooks/useStoreSelectors';
import useModal from '@/hooks/useModal';
import useToast from '@/hooks/useToast';
import useTopMenuState from '@/hooks/WindowChrome/useTopMenuState';
import useSubmenuListNavigation from '@/hooks/WindowChrome/useSubmenuListNavigation';

const dragRegion = { WebkitAppRegion: 'drag' };
const noDrag = { WebkitAppRegion: 'no-drag' };

const MenuItem = React.forwardRef(({ label, shortcut, onClick, disabled, active, ...rest }, ref) => (
  <button
    ref={ref}
    type="button"
    style={noDrag}
    disabled={disabled}
    onClick={onClick}
    {...rest}
    className={`w-full flex items-center justify-between px-3 py-1.5 text-[12px] rounded-md transition outline-none ${disabled
      ? 'opacity-60 cursor-not-allowed'
      : 'hover:bg-blue-500/10 focus:bg-blue-500/10'
      } ${active
        ? 'bg-blue-500/15 text-blue-700 dark:text-blue-100 ring-1 ring-blue-500/40'
        : ''
      }`}
    aria-selected={active || undefined}
  >
    <span className="text-left">{label}</span>
    {shortcut && <span className="text-[11px] text-gray-400">{shortcut}</span>}
  </button>
));
MenuItem.displayName = 'MenuItem';

const MenuSectionTitle = ({ children }) => (
  <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">
    {children}
  </div>
);

const Separator = () => <div className="my-1 border-t border-gray-200/70 dark:border-slate-800/40" />;

const TopMenuBar = () => {
  const { darkMode, setDarkMode } = useDarkModeState();
  const navigate = useNavigate();
  const { showModal } = useModal();
  const { showToast } = useToast();

  const [recents, setRecents] = useState([]);
  const [windowState, setWindowState] = useState({ isMaximized: false, isFullScreen: false });
  const [appVersion, setAppVersion] = useState('');
  const [showFallbackIcon, setShowFallbackIcon] = useState(true);

  const barRef = useRef(null);
  const keyHandlersRef = useRef({});
  const recentsCloseTimerRef = useRef(null);

  const topMenuOrder = ['file', 'edit', 'view', 'window', 'help'];

  const {
    openMenu,
    setOpenMenu,
    openReason,
    setOpenReason,
    activeIndex,
    setActiveIndex,
    activeIndexRef,
    menuContainerRefs,
    menuRefs,
    registerItemRef,
    focusIndex,
    openMenuAndFocus,
    toggleMenu,
    closeMenu,
    scheduleCloseMenu,
    clearCloseTimer,
    createMenuKeyHandler,
    ensureReason,
    menuConfig,
  } = useTopMenuState({
    barRef,
    topMenuOrder,
    keyHandlerLookup: (id) => {
      const baseId = id?.includes(':') ? id.split(':')[0] : id;
      return keyHandlersRef.current[id] || keyHandlersRef.current[baseId];
    },
  });

  const {
    submenuIndex: recentsIndex,
    resetSubmenuRefs: resetRecentsRefs,
    registerSubmenuItemRef: registerRecentItemRef,
    focusSubmenuIndex: focusRecentsIndex,
    openSubmenu: openRecentsSubmenu,
    closeSubmenuToParent: closeRecentsSubmenu,
    handleSubmenuKeyDown: handleRecentsKeyDown,
  } = useSubmenuListNavigation({
    submenuId: 'file:recent',
    parentMenuId: 'file',
    openMenu,
    setOpenMenu,
    topMenuOrder,
    focusParentItem: () => focusIndex('file', 2),
    setOpenReason: ensureReason,
  });

  const menuBg = darkMode ? 'bg-slate-900/95 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900';
  const menuPanelExtra = 'backdrop-blur-md';

  const clearRecentsCloseTimer = useCallback(() => {
    if (recentsCloseTimerRef.current) {
      clearTimeout(recentsCloseTimerRef.current);
      recentsCloseTimerRef.current = null;
    }
  }, []);

  const closeRecentsAfterDelay = useCallback(() => {
    clearRecentsCloseTimer();
    recentsCloseTimerRef.current = setTimeout(() => {
      closeRecentsSubmenu();
    }, 180);
  }, [clearRecentsCloseTimer, closeRecentsSubmenu]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);
  useEffect(() => () => clearRecentsCloseTimer(), [clearRecentsCloseTimer]);

  useEffect(() => {
    if (!openMenu) return;
    const ref = menuContainerRefs.current[openMenu];
    if (ref && typeof ref.focus === 'function') {
      setTimeout(() => {
        try { ref.focus(); } catch { }
      }, 0);
    }
  }, [openMenu]);

  useEffect(() => {
    let unsubscribe;
    const loadRecents = async () => {
      try {
        const result = await window.electronAPI?.recents?.list?.();
        if (result?.success) {
          setRecents(result.recents || []);
        }
      } catch { }
    };

    loadRecents();
    try {
      unsubscribe = window.electronAPI?.recents?.onChange?.((list) => {
        setRecents(list || []);
      });
    } catch { }

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  useEffect(() => {
    const off = window.electronAPI?.onWindowState?.((state) => {
      if (state) setWindowState((prev) => ({ ...prev, ...state }));
    });

    window.electronAPI?.windowControls?.getState?.().then((res) => {
      if (res?.success && res.state) {
        setWindowState(res.state);
      }
    }).catch(() => { });

    return () => {
      if (typeof off === 'function') off();
    };
  }, []);

  useEffect(() => {
    let active = true;
    window.electronAPI?.getAppVersion?.().then((res) => {
      if (!active) return;
      if (res?.success && res.version) {
        setAppVersion(res.version);
      }
    }).catch(() => { });
    return () => { active = false; };
  }, []);

  const handleNewLyrics = () => {
    closeMenu();
    navigate('/new-song?mode=new');
    window.dispatchEvent(new Event('navigate-to-new-song'));
  };

  const handleOpenLyrics = () => {
    closeMenu();
    window.dispatchEvent(new Event('trigger-file-load'));
  };

  const handleOpenRecent = async (filePath) => {
    closeMenu();
    if (!filePath) return;
    try {
      const result = await window.electronAPI?.recents?.open?.(filePath);
      if (result && result.success === false) {
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
  };

  const handleClearRecents = async () => {
    closeMenu();
    try {
      await window.electronAPI?.recents?.clear?.();
      setRecents([]);
    } catch { }
  };

  const handleConnectMobile = () => {
    closeMenu();
    window.dispatchEvent(new Event('open-qr-dialog'));
  };

  const handleEasyWorship = () => {
    closeMenu();
    window.dispatchEvent(new Event('open-easyworship-import'));
  };

  const handlePreviewOutputs = () => {
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
  };

  const handleQuit = () => {
    closeMenu();
    window.electronAPI?.windowControls?.close?.();
  };

  const handleUndo = () => {
    closeMenu();
    window.dispatchEvent(new Event('menu-undo'));
  };

  const handleRedo = () => {
    closeMenu();
    window.dispatchEvent(new Event('menu-redo'));
  };

  const handleClipboardAction = (command) => {
    closeMenu();
    try { document.execCommand(command); } catch { }
  };

  const handleToggleDarkMode = () => {
    closeMenu();
    const next = !darkMode;
    setDarkMode(next);
    window.electronAPI?.setDarkMode?.(next);
    window.electronAPI?.syncNativeDarkMode?.(next);
  };

  const handleZoom = (direction) => {
    closeMenu();
    if (window.electronAPI?.windowControls?.setZoom) {
      window.electronAPI.windowControls.setZoom(direction);
    } else {
      if (direction === 'reset') window.location.reload();
    }
  };

  const handleReload = () => {
    closeMenu();
    if (window.electronAPI?.windowControls?.reload) {
      window.electronAPI.windowControls.reload();
    } else {
      window.location.reload();
    }
  };

  const handleToggleDevTools = () => {
    closeMenu();
    window.electronAPI?.windowControls?.toggleDevTools?.();
  };

  const handleFullscreen = () => {
    closeMenu();
    window.electronAPI?.windowControls?.toggleFullscreen?.();
  };

  const handleMinimize = () => {
    closeMenu();
    window.electronAPI?.windowControls?.minimize?.();
  };

  const handleBarDoubleClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    handleMinimize();
  };

  const handleMaximizeToggle = async () => {
    closeMenu();
    try {
      const result = await window.electronAPI?.windowControls?.toggleMaximize?.();
      if (result?.success && typeof result.isMaximized === 'boolean') {
        setWindowState((prev) => ({ ...prev, isMaximized: result.isMaximized }));
      }
    } catch { }
  };

  const handleShortcuts = () => {
    closeMenu();
    window.dispatchEvent(new Event('show-keyboard-shortcuts'));
  };

  const handleDisplaySettings = async () => {
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
  };

  const handleDocs = () => {
    closeMenu();
    const url = 'https://github.com/PeterAlaks/lyric-display-app#readme';
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleRepo = () => {
    closeMenu();
    const url = 'https://github.com/PeterAlaks/lyric-display-app';
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleConnectionDiagnostics = () => {
    closeMenu();
    showModal({
      title: 'Connection Diagnostics',
      component: 'ConnectionDiagnostics',
      variant: 'info',
      size: 'large',
      dismissLabel: 'Close'
    });
  };

  const handleIntegrationGuide = () => {
    closeMenu();
    showModal({
      title: 'Streaming Software Integration',
      headerDescription: 'Connect LyricDisplay to OBS, vMix, or Wirecast',
      component: 'IntegrationInstructions',
      variant: 'info',
      size: 'lg',
      dismissLabel: 'Close'
    });
  };

  const handleAbout = () => {
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
  };

  const handleSupportDev = () => {
    closeMenu();
    window.dispatchEvent(new Event('open-support-dev-modal'));
  };

  const handleCheckUpdates = () => {
    closeMenu();
    window.electronAPI?.checkForUpdates?.(true);
  };

  const isMaxOrFull = windowState.isMaximized || windowState.isFullScreen;

  useEffect(() => {
    const buildHandler = (menuId) => {
      const cfg = menuConfig?.[menuId];
      if (!cfg) return null;
      return createMenuKeyHandler({
        menuId,
        itemCount: cfg.count,
        submenuIndexes: cfg.sub,
        openSubmenu: menuId === 'file'
          ? () => openRecentsSubmenu(true, 'keyboard')
          : undefined,
      });
    };

    keyHandlersRef.current = {
      file: buildHandler('file'),
      edit: buildHandler('edit'),
      view: buildHandler('view'),
      window: buildHandler('window'),
      help: buildHandler('help'),
      'file:recent': (event) => {
        ensureReason('keyboard');
        return handleRecentsKeyDown(event);
      },
    };
  }, [createMenuKeyHandler, ensureReason, handleRecentsKeyDown, menuConfig, openRecentsSubmenu]);

  const getMenuKeyDown = useCallback((menuId) => {
    const cfg = menuConfig?.[menuId];
    if (!cfg) return undefined;
    return createMenuKeyHandler({
      menuId,
      itemCount: cfg.count,
      submenuIndexes: cfg.sub,
      openSubmenu: menuId === 'file'
        ? () => openRecentsSubmenu(true, 'keyboard')
        : undefined,
    });
  }, [createMenuKeyHandler, menuConfig, openRecentsSubmenu]);

  return (
    <div
      ref={barRef}
      className={`relative z-[1500] h-9 flex items-center justify-between pl-2.5 pr-0 border-b text-[12px] ${darkMode ? 'bg-slate-900/90 border-slate-800 text-slate-100' : 'bg-slate-50/95 border-slate-200 text-slate-900'}`}
      onDoubleClickCapture={handleBarDoubleClick}
      style={dragRegion}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="flex items-center gap-2 pr-2" style={noDrag}>
          {showFallbackIcon && <div className="h-3.5 w-3.5 rounded-sm bg-gradient-to-br from-blue-500 to-indigo-600" aria-hidden />}
          <img
            src="/LyricDisplay-icon.png"
            alt="LyricDisplay"
            className="h-3.5 w-3.5"
            onLoad={() => setShowFallbackIcon(false)}
            onError={() => setShowFallbackIcon(true)}
          />
        </div>

        <div className="flex items-center gap-0.5" style={noDrag}>
          <div
            className="relative"
            onMouseEnter={() => { clearCloseTimer(); if (openMenu) openMenuAndFocus('file', openReason || 'hover'); }}
            onMouseLeave={() => { if (openMenu?.startsWith('file')) scheduleCloseMenu('file'); }}>
            <button
              type="button"
              onClick={() => toggleMenu('file')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md transition ${(openMenu && openMenu.startsWith('file')) ? (darkMode ? 'bg-slate-800' : 'bg-slate-200') : 'hover:bg-slate-200/50 dark:hover:bg-slate-800/80'
                }`}
              style={noDrag}
            >
              File
            </button>
            {openMenu && openMenu.startsWith('file') && (
              <div
                className={`absolute left-0 top-full mt-0 w-72 rounded-xl border shadow-xl z-50 p-1 ${menuBg} ${menuPanelExtra}`}
                onKeyDown={getMenuKeyDown('file')}
                role="menu"
                tabIndex={0}
                ref={(el) => { menuContainerRefs.current['file'] = el; }}
                onMouseEnter={clearCloseTimer}
                onMouseLeave={() => scheduleCloseMenu('file')}
              >
                <MenuItem ref={(el) => registerItemRef('file', 0, el)} label="New Lyrics" shortcut="Ctrl/Cmd + N" onClick={handleNewLyrics} active={openMenu?.startsWith('file') && activeIndex === 0} />
                <MenuItem ref={(el) => registerItemRef('file', 1, el)} label="Load Lyrics File" shortcut="Ctrl/Cmd + O" onClick={handleOpenLyrics} active={openMenu?.startsWith('file') && activeIndex === 1} />
                <div
                  className="relative"
                  onMouseEnter={clearRecentsCloseTimer}
                  onMouseLeave={closeRecentsAfterDelay}
                >
                  <MenuItem
                    ref={(el) => registerItemRef('file', 2, el)}
                    label="Open Recent"
                    shortcut="›"
                    onClick={() => { }}
                    disabled={false}
                    active={openMenu?.startsWith('file') && activeIndex === 2}
                    onMouseEnter={() => { clearCloseTimer(); clearRecentsCloseTimer(); openRecentsSubmenu(false, 'hover'); }}
                    onMouseLeave={closeRecentsAfterDelay}
                  />
                  {openMenu === 'file:recent' && (
                    <div
                      className={`absolute left-full top-0 ml-1 w-72 rounded-xl border shadow-xl z-50 p-1 ${menuBg} ${menuPanelExtra}`}
                      role="menu"
                      tabIndex={0}
                      ref={(el) => { menuContainerRefs.current['file:recent'] = el; }}
                      onKeyDown={handleRecentsKeyDown}
                      onMouseEnter={() => { clearCloseTimer(); clearRecentsCloseTimer(); openRecentsSubmenu(false, 'hover'); }}
                      onMouseLeave={closeRecentsAfterDelay}
                    >
                      {resetRecentsRefs()}
                      {recents && recents.length > 0 ? (
                        recents.map((r, idx) => (
                          <MenuItem
                            key={r}
                            ref={registerRecentItemRef(idx)}
                            label={r.split(/[\\/]/).pop()}
                            active={openMenu === 'file:recent' && recentsIndex === idx}
                            onClick={() => handleOpenRecent(r)}
                          />
                        ))
                      ) : (
                        <div className="px-3 py-2 text-xs text-gray-400">No recent files</div>
                      )}
                      <Separator />
                      <MenuItem
                        ref={registerRecentItemRef(recents.length)}
                        label="Clear Recent Files"
                        onClick={handleClearRecents}
                        disabled={!recents || recents.length === 0}
                        active={openMenu === 'file:recent' && recentsIndex === recents.length}
                      />
                    </div>
                  )}
                </div>
                <Separator />
                <MenuItem ref={(el) => registerItemRef('file', 3, el)} label="Connect Mobile Controller" onClick={handleConnectMobile} active={openMenu?.startsWith('file') && activeIndex === 3} />
                <MenuItem ref={(el) => registerItemRef('file', 4, el)} label="Import Songs from EasyWorship" onClick={handleEasyWorship} active={openMenu?.startsWith('file') && activeIndex === 4} />
                <MenuItem ref={(el) => registerItemRef('file', 5, el)} label="Preview Outputs" onClick={handlePreviewOutputs} active={openMenu?.startsWith('file') && activeIndex === 5} />
                <Separator />
                <MenuItem ref={(el) => registerItemRef('file', 6, el)} label="Quit" shortcut="Alt + F4" onClick={handleQuit} active={openMenu?.startsWith('file') && activeIndex === 6} />
              </div>
            )}
          </div>

          <div
            className="relative"
            onMouseEnter={() => { clearCloseTimer(); if (openMenu) openMenuAndFocus('edit', openReason || 'hover'); }}
            onMouseLeave={() => { if (openMenu === 'edit') scheduleCloseMenu('edit'); }}>
            <button
              type="button"
              onClick={() => toggleMenu('edit')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md transition ${openMenu === 'edit' ? (darkMode ? 'bg-slate-800' : 'bg-slate-200') : 'hover:bg-slate-200/50 dark:hover:bg-slate-800/80'
                }`}
              style={noDrag}
            >
              Edit
            </button>
            {openMenu === 'edit' && (
              <div className={`absolute left-0 top-full mt-0 w-64 rounded-xl border shadow-xl z-50 p-1 ${menuBg} ${menuPanelExtra}`}
                role="menu"
                onKeyDown={getMenuKeyDown('edit')}
                tabIndex={0}
                ref={(el) => { menuContainerRefs.current['edit'] = el; }}
                onMouseEnter={clearCloseTimer}
                onMouseLeave={() => scheduleCloseMenu('edit')}
              >
                <MenuItem ref={(el) => registerItemRef('edit', 0, el)} label="Undo" shortcut="Ctrl/Cmd + Z" onClick={handleUndo} active={openMenu === 'edit' && activeIndex === 0} />
                <MenuItem ref={(el) => registerItemRef('edit', 1, el)} label="Redo" shortcut="Ctrl/Cmd + Shift + Z" onClick={handleRedo} active={openMenu === 'edit' && activeIndex === 1} />
                <Separator />
                <MenuItem ref={(el) => registerItemRef('edit', 2, el)} label="Cut" shortcut="Ctrl/Cmd + X" onClick={() => handleClipboardAction('cut')} active={openMenu === 'edit' && activeIndex === 2} />
                <MenuItem ref={(el) => registerItemRef('edit', 3, el)} label="Copy" shortcut="Ctrl/Cmd + C" onClick={() => handleClipboardAction('copy')} active={openMenu === 'edit' && activeIndex === 3} />
                <MenuItem ref={(el) => registerItemRef('edit', 4, el)} label="Paste" shortcut="Ctrl/Cmd + V" onClick={() => handleClipboardAction('paste')} active={openMenu === 'edit' && activeIndex === 4} />
                <MenuItem ref={(el) => registerItemRef('edit', 5, el)} label="Delete" shortcut="Del" onClick={() => handleClipboardAction('delete')} active={openMenu === 'edit' && activeIndex === 5} />
                <MenuItem ref={(el) => registerItemRef('edit', 6, el)} label="Select All" shortcut="Ctrl/Cmd + A" onClick={() => handleClipboardAction('selectAll')} active={openMenu === 'edit' && activeIndex === 6} />
              </div>
            )}
          </div>

          <div
            className="relative"
            onMouseEnter={() => { clearCloseTimer(); if (openMenu) openMenuAndFocus('view', openReason || 'hover'); }}
            onMouseLeave={() => { if (openMenu === 'view') scheduleCloseMenu('view'); }}>
            <button
              type="button"
              onClick={() => toggleMenu('view')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md transition ${openMenu === 'view' ? (darkMode ? 'bg-slate-800' : 'bg-slate-200') : 'hover:bg-slate-200/50 dark:hover:bg-slate-800/80'
                }`}
              style={noDrag}
            >
              View
            </button>
            {openMenu === 'view' && (
              <div className={`absolute left-0 top-full mt-0 w-80 rounded-xl border shadow-xl z-50 p-1 ${menuBg} ${menuPanelExtra}`}
                role="menu"
                tabIndex={0}
                ref={(el) => { menuContainerRefs.current['view'] = el; }}
                onMouseEnter={clearCloseTimer}
                onMouseLeave={() => scheduleCloseMenu('view')}
                onKeyDown={getMenuKeyDown('view')}
              >
                <MenuItem ref={(el) => registerItemRef('view', 0, el)} label={darkMode ? 'Light Mode' : 'Dark Mode'} onClick={handleToggleDarkMode} active={openMenu === 'view' && activeIndex === 0} />
                <MenuItem ref={(el) => registerItemRef('view', 1, el)} label="Reload" shortcut="Ctrl/Cmd + R" onClick={handleReload} active={openMenu === 'view' && activeIndex === 1} />
                <MenuItem ref={(el) => registerItemRef('view', 2, el)} label="Toggle Developer Tools" shortcut="Ctrl/Cmd + Shift + I" onClick={handleToggleDevTools} active={openMenu === 'view' && activeIndex === 2} />
                <Separator />
                <MenuItem ref={(el) => registerItemRef('view', 3, el)} label="Zoom In" shortcut="Ctrl/Cmd +" onClick={() => handleZoom('in')} active={openMenu === 'view' && activeIndex === 3} />
                <MenuItem ref={(el) => registerItemRef('view', 4, el)} label="Zoom Out" shortcut="Ctrl/Cmd -" onClick={() => handleZoom('out')} active={openMenu === 'view' && activeIndex === 4} />
                <MenuItem ref={(el) => registerItemRef('view', 5, el)} label="Reset Zoom" shortcut="Ctrl/Cmd 0" onClick={() => handleZoom('reset')} active={openMenu === 'view' && activeIndex === 5} />
                <Separator />
                <MenuItem ref={(el) => registerItemRef('view', 6, el)} label="Toggle Fullscreen" shortcut="F11" onClick={handleFullscreen} active={openMenu === 'view' && activeIndex === 6} />
              </div>
            )}
          </div>

          <div
            className="relative"
            onMouseEnter={() => { clearCloseTimer(); if (openMenu) openMenuAndFocus('window', openReason || 'hover'); }}
            onMouseLeave={() => { if (openMenu === 'window') scheduleCloseMenu('window'); }}>
            <button
              type="button"
              onClick={() => toggleMenu('window')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md transition ${openMenu === 'window' ? (darkMode ? 'bg-slate-800' : 'bg-slate-200') : 'hover:bg-slate-200/50 dark:hover:bg-slate-800/80'
                }`}
              style={noDrag}
            >
              Window
            </button>
            {openMenu === 'window' && (
              <div className={`absolute left-0 top-full mt-0 w-64 rounded-xl border shadow-xl z-50 p-1 ${menuBg} ${menuPanelExtra}`}
                role="menu"
                tabIndex={0}
                ref={(el) => { menuContainerRefs.current['window'] = el; }}
                onMouseEnter={clearCloseTimer}
                onMouseLeave={() => scheduleCloseMenu('window')}
                onKeyDown={getMenuKeyDown('window')}
              >
                <MenuItem ref={(el) => registerItemRef('window', 0, el)} label="Minimize" onClick={handleMinimize} active={openMenu === 'window' && activeIndex === 0} />
                <MenuItem ref={(el) => registerItemRef('window', 1, el)} label={isMaxOrFull ? 'Restore' : 'Maximize'} onClick={handleMaximizeToggle} active={openMenu === 'window' && activeIndex === 1} />
                <MenuItem ref={(el) => registerItemRef('window', 2, el)} label="Close" onClick={handleQuit} active={openMenu === 'window' && activeIndex === 2} />
                <Separator />
                <MenuItem ref={(el) => registerItemRef('window', 3, el)} label="Keyboard Shortcuts" onClick={handleShortcuts} active={openMenu === 'window' && activeIndex === 3} />
                <MenuItem ref={(el) => registerItemRef('window', 4, el)} label="Display Settings" onClick={handleDisplaySettings} active={openMenu === 'window' && activeIndex === 4} />
              </div>
            )}
          </div>

          <div
            className="relative"
            onMouseEnter={() => { clearCloseTimer(); if (openMenu) openMenuAndFocus('help', openReason || 'hover'); }}
            onMouseLeave={() => { if (openMenu === 'help') scheduleCloseMenu('help'); }}>
            <button
              type="button"
              onClick={() => toggleMenu('help')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md transition ${openMenu === 'help' ? (darkMode ? 'bg-slate-800' : 'bg-slate-200') : 'hover:bg-slate-200/50 dark:hover:bg-slate-800/80'
                }`}
              style={noDrag}
            >
              Help
            </button>
            {openMenu === 'help' && (
              <div className={`absolute left-0 top-full mt-0 w-72 rounded-xl border shadow-xl z-50 p-1 ${menuBg} ${menuPanelExtra}`}
                role="menu"
                tabIndex={0}
                ref={(el) => { menuContainerRefs.current['help'] = el; }}
                onMouseEnter={clearCloseTimer}
                onMouseLeave={() => scheduleCloseMenu('help')}
                onKeyDown={getMenuKeyDown('help')}
              >
                <MenuItem ref={(el) => registerItemRef('help', 0, el)} label="Documentation" onClick={handleDocs} active={openMenu === 'help' && activeIndex === 0} />
                <MenuItem ref={(el) => registerItemRef('help', 1, el)} label="GitHub Repository" onClick={handleRepo} active={openMenu === 'help' && activeIndex === 1} />
                <MenuItem ref={(el) => registerItemRef('help', 2, el)} label="Connection Diagnostics" onClick={handleConnectionDiagnostics} active={openMenu === 'help' && activeIndex === 2} />
                <MenuItem ref={(el) => registerItemRef('help', 3, el)} label="Integration Guide" onClick={handleIntegrationGuide} active={openMenu === 'help' && activeIndex === 3} />
                <Separator />
                <MenuItem ref={(el) => registerItemRef('help', 4, el)} label="More About Author" onClick={() => window.open('https://linktr.ee/peteralaks', '_blank', 'noopener,noreferrer')} active={openMenu === 'help' && activeIndex === 4} />
                <MenuItem ref={(el) => registerItemRef('help', 5, el)} label="About LyricDisplay" onClick={handleAbout} active={openMenu === 'help' && activeIndex === 5} />
                <MenuItem ref={(el) => registerItemRef('help', 6, el)} label="Support Development" onClick={handleSupportDev} active={openMenu === 'help' && activeIndex === 6} />
                <MenuItem ref={(el) => registerItemRef('help', 7, el)} label="Check for Updates" onClick={handleCheckUpdates} active={openMenu === 'help' && activeIndex === 7} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-stretch ml-auto" style={noDrag}>
        <button
          type="button"
          onClick={handleMinimize}
          title="Minimize window"
          className={`h-9 w-12 flex items-center justify-center transition ${darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-200'}`}
          aria-label="Minimize window"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleMaximizeToggle}
          title={windowState.isMaximized ? 'Restore window' : 'Maximize window'}
          className={`h-9 w-12 flex items-center justify-center transition ${darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-200'}`}
          aria-label={windowState.isMaximized ? 'Restore window' : 'Maximize window'}
        >
          {isMaxOrFull ? <Copy className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
        </button>
        <button
          type="button"
          onClick={handleQuit}
          title="Close window"
          className={`h-9 w-12 flex items-center justify-center transition ${darkMode ? 'hover:bg-red-600 hover:text-white' : 'hover:bg-red-600 hover:text-white'
            }`}
          aria-label="Close window"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default TopMenuBar;