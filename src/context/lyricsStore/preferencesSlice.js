import { normalizeLyricsParsingOptions } from '../../../shared/lyricsParsing/preferenceOptions.js';
import {
  DEFAULT_CAPITALIZED_WORDS,
  normalizeCapitalizedWords,
} from '../../../shared/capitalizedWords.js';
import {
  DEFAULT_APPEARANCE_TRANSITIONS,
  normalizeAppearanceTransitions,
} from '../../../shared/transitionSettings.js';

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
  formattingCapitalizedWords: [...DEFAULT_CAPITALIZED_WORDS],
  formattingNormalizeTypographicChars: true,
  maxFileSizeLimit: 2,
  lyricsParsingOptions: normalizeLyricsParsingOptions(),
  appearanceTransitions: { ...DEFAULT_APPEARANCE_TRANSITIONS },

  setShowTooltips: (show) => set({ showTooltips: show }),
  setShowTutorialPopovers: (show) => set({ showTutorialPopovers: show }),
  setShowCanvasFloatingToolbar: (show) => set({ showCanvasFloatingToolbar: show }),
  setToastSoundsMuted: (muted) => set({ toastSoundsMuted: muted }),
  setSkipSectionTitlesOnKeyboard: (enabled) => set({ skipSectionTitlesOnKeyboard: enabled }),
  setPreviewLinesEnabled: (enabled) => set({ previewLinesEnabled: enabled }),
  setCanvasCleanupOnPaste: (enabled) => set({ canvasCleanupOnPaste: enabled }),
  setFormattingCapitalizeFirstLetter: (enabled) => set({ formattingCapitalizeFirstLetter: enabled }),
  setFormattingCapitalizeReligiousTerms: (enabled) => set({ formattingCapitalizeReligiousTerms: enabled }),
  setFormattingCapitalizedWords: (words) => set({
    formattingCapitalizedWords: normalizeCapitalizedWords(words),
  }),
  setFormattingNormalizeTypographicChars: (enabled) => set({ formattingNormalizeTypographicChars: enabled }),
  setLyricsParsingOptions: (options) => set({
    lyricsParsingOptions: normalizeLyricsParsingOptions(options),
  }),
  setAppearanceTransitions: (settings) => set({
    appearanceTransitions: normalizeAppearanceTransitions(settings),
  }),

  getMaxFileSize: () => maxFileSizeLimit,

  updateMaxFileSize: (newLimit) => {
    const normalized = Number.isFinite(Number(newLimit)) ? Number(newLimit) : 2;
    maxFileSizeLimit = normalized;
    set({ maxFileSizeLimit: normalized });
  },
});
