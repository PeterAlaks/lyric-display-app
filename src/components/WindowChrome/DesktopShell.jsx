import React, { useEffect } from 'react';
import { Copy, Minus, Square, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import TopMenuBar from './TopMenuBar';
import { useDarkModeState, useIsDesktopApp } from '@/hooks/useStoreSelectors';

const dragRegion = { WebkitAppRegion: 'drag' };
const noDrag = { WebkitAppRegion: 'no-drag' };

const CompactTitleBar = ({ darkMode, title = 'LyricDisplay' }) => {
  const [windowState, setWindowState] = React.useState({ isMaximized: false });

  React.useEffect(() => {
    window.electronAPI?.windowControls?.getState?.()
      ?.then((result) => {
        if (result?.success && result.state) setWindowState(result.state);
      })
      .catch(() => {});

    return window.electronAPI?.onWindowState?.((state) => {
      if (state) setWindowState(state);
    });
  }, []);

  const controlClass = darkMode
    ? 'h-9 w-11 inline-flex items-center justify-center text-slate-300 hover:bg-slate-700 hover:text-white transition-colors'
    : 'h-9 w-11 inline-flex items-center justify-center text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors';

  return (
    <div
      className={`h-9 flex items-center justify-between border-b select-none ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}
      style={dragRegion}
    >
      <div className="flex items-center gap-2 px-3 min-w-0">
        <img src="/LyricDisplay-icon.png" alt="" className="h-5 w-5 shrink-0" draggable={false} />
        <span className="text-xs font-semibold truncate">{title}</span>
      </div>
      <div className="flex items-center" style={noDrag}>
        <button type="button" className={controlClass} onClick={() => window.electronAPI?.windowControls?.minimize?.()} aria-label="Minimize">
          <Minus className="w-4 h-4" />
        </button>
        <button
          type="button"
          className={controlClass}
          onClick={() => window.electronAPI?.windowControls?.toggleMaximize?.()}
          aria-label={windowState.isMaximized ? 'Restore Down' : 'Maximize'}
          title={windowState.isMaximized ? 'Restore Down' : 'Maximize'}
        >
          {windowState.isMaximized ? <Copy className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
        </button>
        <button
          type="button"
          className={`h-9 w-11 inline-flex items-center justify-center transition-colors ${darkMode ? 'text-slate-300 hover:bg-red-600 hover:text-white' : 'text-slate-600 hover:bg-red-500 hover:text-white'}`}
          onClick={() => window.electronAPI?.windowControls?.close?.()}
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const DesktopShell = ({ children }) => {
  const { darkMode } = useDarkModeState();
  const isDesktopApp = useIsDesktopApp();
  const location = useLocation();
  const isTimerControl = location.pathname === '/timer-control';
  const isObsSetup = location.pathname === '/obs-setup';
  const compactTitle = isTimerControl
    ? 'LyricDisplay Timer'
    : isObsSetup
      ? 'LyricDisplay OBS Source Creator'
      : 'LyricDisplay';

  useEffect(() => {
    if (!isDesktopApp || typeof document === 'undefined') return;

    const body = document.body;
    const previousBg = body.style.backgroundColor;
    const previousMargin = body.style.margin;
    const previousVar = body.style.getPropertyValue('--top-menu-height');
    body.style.backgroundColor = darkMode ? '#0f172a' : '#f8fafc';
    body.style.margin = '0';
    body.style.setProperty('--top-menu-height', '2.25rem');

    return () => {
      body.style.backgroundColor = previousBg;
      body.style.margin = previousMargin;
      if (previousVar) {
        body.style.setProperty('--top-menu-height', previousVar);
      } else {
        body.style.removeProperty('--top-menu-height');
      }
    };
  }, [isDesktopApp, darkMode]);

  const shellStyle = {
    backgroundColor: darkMode ? '#0f172a' : '#f8fafc',
    transition: 'background-color 140ms ease'
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col" style={shellStyle}>
      {isTimerControl || isObsSetup ? <CompactTitleBar darkMode={darkMode} title={compactTitle} /> : <TopMenuBar />}
      <div className={`flex-1 min-h-0 flex flex-col ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        {children}
      </div>
    </div>
  );
};

export default DesktopShell;
