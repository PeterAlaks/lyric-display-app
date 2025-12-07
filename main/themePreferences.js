import Store from 'electron-store';

const themeStore = new Store({
  name: 'preferences',
  defaults: {
    darkMode: null
  }
});

export function getSavedDarkMode() {
  try {
    const value = themeStore.get('darkMode');
    return typeof value === 'boolean' ? value : null;
  } catch (error) {
    console.warn('[Theme] Failed to read saved dark mode:', error);
    return null;
  }
}

export function saveDarkModePreference(isDark) {
  try {
    themeStore.set('darkMode', !!isDark);
  } catch (error) {
    console.warn('[Theme] Failed to persist dark mode:', error);
  }
}