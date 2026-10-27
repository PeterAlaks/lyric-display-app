export const createAppShellSlice = (set) => ({
  // Production consoles default to dark; a saved choice always wins on rehydration.
  darkMode: true,
  themeMode: 'dark',
  hasSeenWelcome: false,
  isDesktopApp: false,

  setDarkMode: (mode) => set({ darkMode: mode }),
  setThemeMode: (mode) => set({ themeMode: mode }),
  setHasSeenWelcome: (seen) => set({ hasSeenWelcome: seen }),
  setIsDesktopApp: (isDesktop) => set({ isDesktopApp: isDesktop }),
});
