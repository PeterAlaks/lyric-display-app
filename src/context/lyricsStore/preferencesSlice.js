import { normalizeLyricsParsingOptions } from '../../../shared/lyricsParsing/preferenceOptions.js';
import {
  DEFAULT_CAPITALIZED_WORDS,
  normalizeCapitalizedWords,
} from '../../../shared/capitalizedWords.js';
import {
  DEFAULT_APPEARANCE_TRANSITIONS,
  normalizeAppearanceTransitions,
} from '../../../shared/transitionSettings.js';
import {
  DEFAULT_PREVIEW_SETTINGS,
  normalizePreviewSettings,
} from '../../../shared/previewSettings.js';

let maxFileSizeLimit = 2;

export const createPreferencesSlice = (set) => ({
  showTooltips: true,
  appLanguage: 'en',
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
  previewSettings: { ...DEFAULT_PREVIEW_SETTINGS },

  setShowTooltips: (show) => set({ showTooltips: show }),
  setAppLanguage: (language) => set({ appLanguage: language }),
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
  setPreviewSettings: (settings) => set({
    previewSettings: normalizePreviewSettings(settings),
  }),

  getMaxFileSize: () => maxFileSizeLimit,

  updateMaxFileSize: (newLimit) => {
    const normalized = Number.isFinite(Number(newLimit)) ? Number(newLimit) : 2;
    maxFileSizeLimit = normalized;
    set({ maxFileSizeLimit: normalized });
  },
});
