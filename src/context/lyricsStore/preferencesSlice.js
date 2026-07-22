import { normalizeLyricsParsingOptions } from '../../../shared/lyricsParsing.js';

let maxFileSizeLimit = 2;

export const createPreferencesSlice = (set) => ({
  showTooltips: true,
  showTutorialPopovers: true,
  showCanvasFloatingToolbar: true,
  toastSoundsMuted: false,
  skipSectionTitlesOnKeyboard: true,
  previewLinesEnabled: false,
  canvasCleanupOnPaste: true,
  formattingCapitalizeFirstLetter: true,
  formattingCapitalizeReligiousTerms: true,
  formattingNormalizeTypographicChars: true,
  maxFileSizeLimit: 2,
  lyricsParsingOptions: normalizeLyricsParsingOptions(),

  setShowTooltips: (show) => set({ showTooltips: show }),
  setShowTutorialPopovers: (show) => set({ showTutorialPopovers: show }),
  setShowCanvasFloatingToolbar: (show) => set({ showCanvasFloatingToolbar: show }),
  setToastSoundsMuted: (muted) => set({ toastSoundsMuted: muted }),
  setSkipSectionTitlesOnKeyboard: (enabled) => set({ skipSectionTitlesOnKeyboard: enabled }),
  setPreviewLinesEnabled: (enabled) => set({ previewLinesEnabled: enabled }),
  setCanvasCleanupOnPaste: (enabled) => set({ canvasCleanupOnPaste: enabled }),
  setFormattingCapitalizeFirstLetter: (enabled) => set({ formattingCapitalizeFirstLetter: enabled }),
  setFormattingCapitalizeReligiousTerms: (enabled) => set({ formattingCapitalizeReligiousTerms: enabled }),
  setFormattingNormalizeTypographicChars: (enabled) => set({ formattingNormalizeTypographicChars: enabled }),
  setLyricsParsingOptions: (options) => set({
    lyricsParsingOptions: normalizeLyricsParsingOptions(options),
  }),

  getMaxFileSize: () => maxFileSizeLimit,

  updateMaxFileSize: (newLimit) => {
    const normalized = Number.isFinite(Number(newLimit)) ? Number(newLimit) : 2;
    maxFileSizeLimit = normalized;
    set({ maxFileSizeLimit: normalized });
  },
});
