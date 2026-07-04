import { DEFAULT_SCRIPTURE_TRANSLATION, getScriptureTranslation } from '../../constants/scripture.js';

export const createScriptureSlice = (set) => ({
  // 'song' | 'scripture' — controls which module the left control panel shows.
  // Always starts in song mode; only the translation choice is persisted.
  appMode: 'song',
  scriptureTranslation: DEFAULT_SCRIPTURE_TRANSLATION,

  setAppMode: (mode) => set({ appMode: mode === 'scripture' ? 'scripture' : 'song' }),
  setScriptureTranslation: (translationId) => set({
    scriptureTranslation: getScriptureTranslation(translationId)
      ? translationId
      : DEFAULT_SCRIPTURE_TRANSLATION,
  }),
});
