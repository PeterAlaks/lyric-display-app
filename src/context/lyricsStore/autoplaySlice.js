export const DEFAULT_AUTOPLAY_SETTINGS = {
  interval: 5,
  loop: true,
  startFromFirst: true,
  skipBlankLines: true,
};

export const createAutoplaySlice = (set) => ({
  autoplaySettings: { ...DEFAULT_AUTOPLAY_SETTINGS },
  hasSeenIntelligentAutoplayInfo: false,

  setAutoplaySettings: (settings) => set({ autoplaySettings: settings }),
  setHasSeenIntelligentAutoplayInfo: (seen) => set({ hasSeenIntelligentAutoplayInfo: seen }),
});
