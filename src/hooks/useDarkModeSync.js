import { useEffect, useCallback } from 'react';
import useLyricsStore from '../context/LyricsStore';

const useDarkModeSync = (darkMode, setDarkMode) => {
  const themeMode = useLyricsStore((state) => state.themeMode);
  const setThemeMode = useLyricsStore((state) => state.setThemeMode);

  const applyThemeMode = useCallback(async (mode) => {
    let effectiveDark;

    if (window.electronAPI?.syncNativeThemeSource) {

      const result = await window.electronAPI.syncNativeThemeSource(mode);
      if (result?.success) {
        effectiveDark = result.shouldUseDarkColors;
      } else {
        effectiveDark = mode === 'dark';
      }
    } else {

      effectiveDark = mode === 'system'
        ? (window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false)
        : mode === 'dark';
    }

    setDarkMode(effectiveDark);

    if (window.electronAPI?.setDarkMode) {
      window.electronAPI.setDarkMode(effectiveDark);
    }
  }, [setDarkMode]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    if (themeMode !== 'system') return;

    const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mediaQuery) return;

    const handleChange = (e) => {
      const systemDark = e.matches;
      setDarkMode(systemDark);
      if (window.electronAPI?.setDarkMode) {
        window.electronAPI.setDarkMode(systemDark);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themeMode, setDarkMode]);

  useEffect(() => {
    applyThemeMode(themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (!window.electronAPI) return;

    const handleDarkModeToggle = () => {
      if (themeMode === 'system') return;

      const newDarkMode = !darkMode;
      setDarkMode(newDarkMode);

      const newThemeMode = newDarkMode ? 'dark' : 'light';
      setThemeMode(newThemeMode);

      if (window.electronAPI.syncNativeThemeSource) {
        window.electronAPI.syncNativeThemeSource(newThemeMode);
      }
      if (window.electronAPI.setDarkMode) {
        window.electronAPI.setDarkMode(newDarkMode);
      }
    };

    if (window.electronAPI.onDarkModeToggle) {
      window.electronAPI.onDarkModeToggle(handleDarkModeToggle);
    }

    if (window.electronAPI.setDarkMode) {
      window.electronAPI.setDarkMode(darkMode);
    }

    return () => {
      if (window.electronAPI.removeAllListeners) {
        window.electronAPI.removeAllListeners('toggle-dark-mode');
      }
    };
  }, [darkMode, setDarkMode, themeMode, setThemeMode]);
};

export default useDarkModeSync;