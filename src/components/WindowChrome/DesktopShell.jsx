import React, { useEffect } from 'react';
import TopMenuBar from './TopMenuBar';
import { useDarkModeState, useIsDesktopApp } from '@/hooks/useStoreSelectors';

const DesktopShell = ({ children }) => {
  const { darkMode } = useDarkModeState();
  const isDesktopApp = useIsDesktopApp();

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
      <TopMenuBar />
      <div className={`flex-1 min-h-0 flex flex-col ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        {children}
      </div>
    </div>
  );
};

export default DesktopShell;