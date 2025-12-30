import { useEffect } from 'react';

const useDarkModeSync = (darkMode, setDarkMode) => {
  useEffect(() => {

    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    if (!window.electronAPI) return;

    const handleDarkModeToggle = () => {
      const newDarkMode = !darkMode;
      setDarkMode(newDarkMode);
      if (window.electronAPI.setDarkMode) {
        window.electronAPI.setDarkMode(newDarkMode);
      }
      if (window.electronAPI.syncNativeDarkMode) {
        window.electronAPI.syncNativeDarkMode(newDarkMode);
      }
    };

    if (window.electronAPI.onDarkModeToggle) {
      window.electronAPI.onDarkModeToggle(handleDarkModeToggle);
    }
    if (window.electronAPI.setDarkMode) {
      window.electronAPI.setDarkMode(darkMode);
    }
    if (window.electronAPI.syncNativeDarkMode) {
      window.electronAPI.syncNativeDarkMode(darkMode);
    }

    return () => {
      if (window.electronAPI.removeAllListeners) {
        window.electronAPI.removeAllListeners('toggle-dark-mode');
      }
    };
  }, [darkMode, setDarkMode]);
};

export default useDarkModeSync;