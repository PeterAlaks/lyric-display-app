import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useDarkModeState } from '@/hooks/useStoreSelectors';
import useTopMenuState from '@/hooks/WindowChrome/useTopMenuState';
import useSubMenuListNav from '@/hooks/WindowChrome/useSubmenuListNav';
import useMenuHandlers from '@/hooks/WindowChrome/useMenuHandlers';

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

const Separator = () => <div className="my-1 border-t border-gray-200/70 dark:border-slate-800" />;

const TopMenuBar = () => {
  const { darkMode } = useDarkModeState();
  const location = useLocation();
  const isNewSongCanvas = location.pathname === '/new-song';

  const [recents, setRecents] = useState([]);
  const [windowState, setWindowState] = useState({ isMaximized: false, isFullScreen: false, isFocused: true });
  const [appVersion, setAppVersion] = useState('');
  const [showFallbackIcon, setShowFallbackIcon] = useState(true);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    const platform = window.electronAPI?.getPlatform?.();
    setIsMac(platform === 'darwin');
  }, []);

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
    openSubmenu: openRecentsSubmenu,
    closeSubmenuToParent: closeRecentsSubmenu,
    handleSubmenuKeyDown: handleRecentsKeyDown,
  } = useSubMenuListNav({
    submenuId: 'file:recent',
    parentMenuId: 'file',
    openMenu,
    setOpenMenu,
    topMenuOrder,
    focusParentItem: () => focusIndex('file', 2),
    setOpenReason: ensureReason,
  });

  const menuHandlers = useMenuHandlers(closeMenu);

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
    recentsCloseTimerRef.current = setTimeout(closeRecentsSubmenu, 180);
  }, [clearRecentsCloseTimer, closeRecentsSubmenu]);

  useEffect(() => {
    return () => {
      clearCloseTimer();
      clearRecentsCloseTimer();
    };
  }, [clearCloseTimer, clearRecentsCloseTimer]);

  useEffect(() => {
    if (!openMenu) return;

    const ref = menuContainerRefs.current[openMenu];
    if (ref?.focus) {
      setTimeout(() => {
        try {
          ref.focus();
        } catch (error) {
          console.warn('Failed to focus menu:', error);
        }
      }, 0);
    }
  }, [openMenu]);

  useEffect(() => {
    const loadRecents = async () => {
      try {
        const result = await window.electronAPI?.recents?.list?.();
        if (result?.success) {
          setRecents(result.recents || []);
        }
      } catch (error) {
        console.warn('Failed to load recents:', error);
      }
    };

    loadRecents();

    const unsubscribe = window.electronAPI?.recents?.onChange?.((list) => {
      setRecents(list || []);
    });

    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onWindowState?.((state) => {
      if (state) {
        setWindowState((prev) => ({ ...prev, ...state }));
      }
    });

    window.electronAPI?.windowControls?.getState?.()
      .then((res) => {
        if (res?.success && res.state) {
          setWindowState(res.state);
        }
      })
      .catch((error) => console.warn('Failed to get window state:', error));

    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    let isMounted = true;

    window.electronAPI?.getAppVersion?.()
      .then((res) => {
        if (isMounted && res?.success && res.version) {
          setAppVersion(res.version);
        }
      })
      .catch((error) => console.warn('Failed to get app version:', error));

    return () => {
      isMounted = false;
    };
  }, []);

  const handleClearRecents = async () => {
    await menuHandlers.handleClearRecents();
    setRecents([]);
  };

  const handleBarDoubleClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    menuHandlers.handleMinimize();
  };

  const handleMaximizeToggle = () => {
    menuHandlers.handleMaximizeToggle(setWindowState);
  };

  const handleAbout = () => {
    menuHandlers.handleAbout(appVersion);
  };

  const isMaxOrFull = windowState.isMaximized || windowState.isFullScreen;

  const buildMenuHandler = useCallback((menuId) => {
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
  }, [createMenuKeyHandler, menuConfig, openRecentsSubmenu]);

  useEffect(() => {
    keyHandlersRef.current = {
      file: buildMenuHandler('file'),
      edit: buildMenuHandler('edit'),
      view: buildMenuHandler('view'),
      window: buildMenuHandler('window'),
      help: buildMenuHandler('help'),
      'file:recent': (event) => {
        ensureReason('keyboard');
        return handleRecentsKeyDown(event);
      },
    };
  }, [buildMenuHandler, ensureReason, handleRecentsKeyDown]);

  const getMenuKeyDown = useCallback((menuId) => {
    const cfg = menuConfig?.[menuId];
    return cfg ? buildMenuHandler(menuId) : undefined;
  }, [buildMenuHandler, menuConfig]);

  return (
    <div
      ref={barRef}
      className={`relative z-[1500] h-9 flex items-center justify-between ${isMac ? 'pl-[78px]' : 'pl-2.5'} pr-0 border-b text-[12px] ${darkMode ? 'bg-slate-900/90 border-slate-800 text-slate-100' : 'bg-slate-50/95 border-slate-200 text-slate-900'}`}
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
                <MenuItem ref={(el) => registerItemRef('file', 0, el)} label="New Lyrics" shortcut="Ctrl/Cmd + N" onClick={menuHandlers.handleNewLyrics} active={openMenu?.startsWith('file') && activeIndex === 0} />
                <MenuItem ref={(el) => registerItemRef('file', 1, el)} label="Load Lyrics File" shortcut="Ctrl/Cmd + O" onClick={menuHandlers.handleOpenLyrics} active={openMenu?.startsWith('file') && activeIndex === 1} />
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
                            onClick={() => menuHandlers.handleOpenRecent(r)}
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
                <MenuItem ref={(el) => registerItemRef('file', 3, el)} label="Connect Mobile Controller" onClick={menuHandlers.handleConnectMobile} disabled={isNewSongCanvas} active={openMenu?.startsWith('file') && activeIndex === 3} title={isNewSongCanvas ? 'Only available in Control Panel' : undefined} />
                <MenuItem ref={(el) => registerItemRef('file', 4, el)} label="Import Songs from EasyWorship" onClick={menuHandlers.handleEasyWorship} disabled={isNewSongCanvas} active={openMenu?.startsWith('file') && activeIndex === 4} title={isNewSongCanvas ? 'Only available in Control Panel' : undefined} />
                <MenuItem ref={(el) => registerItemRef('file', 5, el)} label="Preview Outputs" onClick={menuHandlers.handlePreviewOutputs} disabled={isNewSongCanvas} active={openMenu?.startsWith('file') && activeIndex === 5} title={isNewSongCanvas ? 'Only available in Control Panel' : undefined} />
                <Separator />
                <MenuItem ref={(el) => registerItemRef('file', 6, el)} label="Quit" shortcut="Alt + F4" onClick={menuHandlers.handleQuit} active={openMenu?.startsWith('file') && activeIndex === 6} />
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
                <MenuItem ref={(el) => registerItemRef('edit', 0, el)} label="Undo" shortcut="Ctrl/Cmd + Z" onClick={menuHandlers.handleUndo} active={openMenu === 'edit' && activeIndex === 0} />
                <MenuItem ref={(el) => registerItemRef('edit', 1, el)} label="Redo" shortcut="Ctrl/Cmd + Shift + Z" onClick={menuHandlers.handleRedo} active={openMenu === 'edit' && activeIndex === 1} />
                <Separator />
                <MenuItem ref={(el) => registerItemRef('edit', 2, el)} label="Cut" shortcut="Ctrl/Cmd + X" onClick={() => menuHandlers.handleClipboardAction('cut')} active={openMenu === 'edit' && activeIndex === 2} />
                <MenuItem ref={(el) => registerItemRef('edit', 3, el)} label="Copy" shortcut="Ctrl/Cmd + C" onClick={() => menuHandlers.handleClipboardAction('copy')} active={openMenu === 'edit' && activeIndex === 3} />
                <MenuItem ref={(el) => registerItemRef('edit', 4, el)} label="Paste" shortcut="Ctrl/Cmd + V" onClick={() => menuHandlers.handleClipboardAction('paste')} active={openMenu === 'edit' && activeIndex === 4} />
                <MenuItem ref={(el) => registerItemRef('edit', 5, el)} label="Delete" shortcut="Del" onClick={() => menuHandlers.handleClipboardAction('delete')} active={openMenu === 'edit' && activeIndex === 5} />
                <MenuItem ref={(el) => registerItemRef('edit', 6, el)} label="Select All" shortcut="Ctrl/Cmd + A" onClick={() => menuHandlers.handleClipboardAction('selectAll')} active={openMenu === 'edit' && activeIndex === 6} />
                <Separator />
                <MenuItem ref={(el) => registerItemRef('edit', 7, el)} label="Preferences" shortcut="Ctrl/Cmd + I" onClick={menuHandlers.handlePreferences} active={openMenu === 'edit' && activeIndex === 7} />
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
                <MenuItem ref={(el) => registerItemRef('view', 0, el)} label={darkMode ? 'Light Mode' : 'Dark Mode'} onClick={menuHandlers.handleToggleDarkMode} active={openMenu === 'view' && activeIndex === 0} />
                <MenuItem ref={(el) => registerItemRef('view', 1, el)} label="Reload" shortcut="Ctrl/Cmd + R" onClick={menuHandlers.handleReload} active={openMenu === 'view' && activeIndex === 1} />
                <MenuItem ref={(el) => registerItemRef('view', 2, el)} label="Toggle Developer Tools" shortcut="Ctrl/Cmd + Shift + I" onClick={menuHandlers.handleToggleDevTools} active={openMenu === 'view' && activeIndex === 2} />
                <Separator />
                <MenuItem ref={(el) => registerItemRef('view', 3, el)} label="Zoom In" shortcut="Ctrl/Cmd +" onClick={() => menuHandlers.handleZoom('in')} active={openMenu === 'view' && activeIndex === 3} />
                <MenuItem ref={(el) => registerItemRef('view', 4, el)} label="Zoom Out" shortcut="Ctrl/Cmd -" onClick={() => menuHandlers.handleZoom('out')} active={openMenu === 'view' && activeIndex === 4} />
                <MenuItem ref={(el) => registerItemRef('view', 5, el)} label="Reset Zoom" shortcut="Ctrl/Cmd 0" onClick={() => menuHandlers.handleZoom('reset')} active={openMenu === 'view' && activeIndex === 5} />
                <Separator />
                <MenuItem ref={(el) => registerItemRef('view', 6, el)} label="Toggle Fullscreen" shortcut="F11" onClick={menuHandlers.handleFullscreen} active={openMenu === 'view' && activeIndex === 6} />
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
                <MenuItem ref={(el) => registerItemRef('window', 0, el)} label="Minimize" onClick={menuHandlers.handleMinimize} active={openMenu === 'window' && activeIndex === 0} />
                <MenuItem ref={(el) => registerItemRef('window', 1, el)} label={isMaxOrFull ? 'Restore' : 'Maximize'} onClick={handleMaximizeToggle} active={openMenu === 'window' && activeIndex === 1} />
                <MenuItem ref={(el) => registerItemRef('window', 2, el)} label="Close" onClick={menuHandlers.handleQuit} active={openMenu === 'window' && activeIndex === 2} />
                <Separator />
                <MenuItem ref={(el) => registerItemRef('window', 3, el)} label="Keyboard Shortcuts" onClick={menuHandlers.handleShortcuts} active={openMenu === 'window' && activeIndex === 3} />
                <MenuItem ref={(el) => registerItemRef('window', 4, el)} label="External Display Settings" onClick={menuHandlers.handleDisplaySettings} active={openMenu === 'window' && activeIndex === 4} />
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
                <MenuItem ref={(el) => registerItemRef('help', 0, el)} label="Documentation" onClick={menuHandlers.handleDocs} active={openMenu === 'help' && activeIndex === 0} />
                <MenuItem ref={(el) => registerItemRef('help', 1, el)} label="GitHub Repository" onClick={menuHandlers.handleRepo} active={openMenu === 'help' && activeIndex === 1} />
                <MenuItem ref={(el) => registerItemRef('help', 2, el)} label="Connection Diagnostics" onClick={menuHandlers.handleConnectionDiagnostics} active={openMenu === 'help' && activeIndex === 2} />
                <MenuItem ref={(el) => registerItemRef('help', 3, el)} label="Integration Guide" onClick={menuHandlers.handleIntegrationGuide} active={openMenu === 'help' && activeIndex === 3} />
                <Separator />
                <MenuItem ref={(el) => registerItemRef('help', 4, el)} label="More About Author" onClick={() => window.open('https://linktr.ee/peteralaks', '_blank', 'noopener,noreferrer')} active={openMenu === 'help' && activeIndex === 4} />
                <MenuItem ref={(el) => registerItemRef('help', 5, el)} label="About LyricDisplay" onClick={handleAbout} active={openMenu === 'help' && activeIndex === 5} />
                <MenuItem ref={(el) => registerItemRef('help', 6, el)} label="Support Development" onClick={menuHandlers.handleSupportDev} active={openMenu === 'help' && activeIndex === 6} />
                <MenuItem ref={(el) => registerItemRef('help', 7, el)} label="Check for Updates" onClick={menuHandlers.handleCheckUpdates} active={openMenu === 'help' && activeIndex === 7} />
              </div>
            )}
          </div>
        </div>
      </div>

      {!isMac && (
        <div className="flex items-stretch ml-auto" style={noDrag}>
          <button
            type="button"
            onClick={menuHandlers.handleMinimize}
            title="Minimize window"
            className={`h-9 w-12 flex items-center justify-center transition ${darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-200'} ${!windowState.isFocused ? 'opacity-50' : ''}`}
            aria-label="Minimize window"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleMaximizeToggle}
            title={windowState.isMaximized ? 'Restore window' : 'Maximize window'}
            className={`h-9 w-12 flex items-center justify-center transition ${darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-200'} ${!windowState.isFocused ? 'opacity-50' : ''}`}
            aria-label={windowState.isMaximized ? 'Restore window' : 'Maximize window'}
          >
            {isMaxOrFull ? <Copy className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={menuHandlers.handleQuit}
            title="Close window"
            className={`h-9 w-12 flex items-center justify-center transition ${darkMode ? 'hover:bg-red-600 hover:text-white' : 'hover:bg-red-600 hover:text-white'
              } ${!windowState.isFocused ? 'opacity-50' : ''}`}
            aria-label="Close window"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default TopMenuBar;