export const createAppShellSlice = (set) => ({
  darkMode: false,
  themeMode: 'light',
  hasSeenWelcome: false,
  isDesktopApp: false,

  setDarkMode: (mode) => set({ darkMode: mode }),
  setThemeMode: (mode) => set({ themeMode: mode }),
  setHasSeenWelcome: (seen) => set({ hasSeenWelcome: seen }),
  setIsDesktopApp: (isDesktop) => set({ isDesktopApp: isDesktop }),
});
