import { useEffect } from 'react';

const useDarkModeSync = (darkMode, setDarkMode) => {
  useEffect(() => {
    if (!window.electronAPI) return;

    const handleDarkModeToggle = () => {
      const newDarkMode = !darkMode;
      setDarkMode(newDarkMode);
      window.electronAPI.setDarkMode(newDarkMode);
      window.electronAPI.syncNativeDarkMode(newDarkMode);
    };

    window.electronAPI.onDarkModeToggle(handleDarkModeToggle);
    window.electronAPI.setDarkMode(darkMode);
    window.electronAPI.syncNativeDarkMode(darkMode);

    return () => {
      window.electronAPI.removeAllListeners('toggle-dark-mode');
    };
  }, [darkMode, setDarkMode]);
};

export default useDarkModeSync;
