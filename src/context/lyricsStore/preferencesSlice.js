let maxFileSizeLimit = 2;

export const createPreferencesSlice = (set) => ({
  showTooltips: true,
  showTutorialPopovers: true,
  showCanvasFloatingToolbar: true,
  toastSoundsMuted: false,
  skipSectionTitlesOnKeyboard: true,
  canvasCleanupOnPaste: true,
  formattingCapitalizeFirstLetter: true,
  formattingCapitalizeReligiousTerms: true,
  formattingNormalizeTypographicChars: true,
  maxFileSizeLimit: 2,

  setShowTooltips: (show) => set({ showTooltips: show }),
  setShowTutorialPopovers: (show) => set({ showTutorialPopovers: show }),
  setShowCanvasFloatingToolbar: (show) => set({ showCanvasFloatingToolbar: show }),
  setToastSoundsMuted: (muted) => set({ toastSoundsMuted: muted }),
  setSkipSectionTitlesOnKeyboard: (enabled) => set({ skipSectionTitlesOnKeyboard: enabled }),
  setCanvasCleanupOnPaste: (enabled) => set({ canvasCleanupOnPaste: enabled }),
  setFormattingCapitalizeFirstLetter: (enabled) => set({ formattingCapitalizeFirstLetter: enabled }),
  setFormattingCapitalizeReligiousTerms: (enabled) => set({ formattingCapitalizeReligiousTerms: enabled }),
  setFormattingNormalizeTypographicChars: (enabled) => set({ formattingNormalizeTypographicChars: enabled }),

  getMaxFileSize: () => maxFileSizeLimit,

  updateMaxFileSize: (newLimit) => {
    const normalized = Number.isFinite(Number(newLimit)) ? Number(newLimit) : 2;
    maxFileSizeLimit = normalized;
    set({ maxFileSizeLimit: normalized });
  },
});
