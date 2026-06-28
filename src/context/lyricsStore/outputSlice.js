import { DEFAULT_OUTPUT_IDS, MAX_CUSTOM_OUTPUTS } from '../../../shared/outputRegistry.js';

const settingValueEqual = (current, next) => {
  if (current === next) return true;
  if (!current || !next || typeof current !== 'object' || typeof next !== 'object') {
    return Object.is(current, next);
  }

  if (Array.isArray(current) || Array.isArray(next)) {
    if (!Array.isArray(current) || !Array.isArray(next) || current.length !== next.length) return false;
    for (let index = 0; index < current.length; index += 1) {
      if (!settingValueEqual(current[index], next[index])) return false;
    }
    return true;
  }

  const currentKeys = Object.keys(current);
  const nextKeys = Object.keys(next);
  if (currentKeys.length !== nextKeys.length) return false;
  for (const key of currentKeys) {
    if (!Object.prototype.hasOwnProperty.call(next, key) || !settingValueEqual(current[key], next[key])) {
      return false;
    }
  }
  return true;
};

const settingsChanged = (current = {}, next = {}) => {
  if (!next || typeof next !== 'object' || Array.isArray(next)) return false;
  return Object.entries(next).some(([key, value]) => !settingValueEqual(current?.[key], value));
};

export const defaultOutput1Settings = {
  fontStyle: 'Bebas Neue',
  bold: false,
  italic: false,
  underline: false,
  allCaps: false,
  textAlign: 'center',
  letterSpacing: 0,
  lineSpacing: 1,
  fontSize: 48,
  translationFontSizeMode: 'bound',
  translationFontSize: 48,
  fontColor: '#FFFFFF',
  translationLineColor: '#FBBF24',
  borderColor: '#000000',
  borderSize: 0,
  dropShadowColor: '#000000',
  dropShadowOpacity: 4,
  dropShadowOffsetX: 0,
  dropShadowOffsetY: 8,
  dropShadowBlur: 10,
  backgroundColor: '#000000',
  backgroundPaint: { type: 'solid', color: '#000000' },
  backgroundOpacity: 0,
  backgroundBandVerticalPadding: 20,
  backgroundBandHeightMode: 'adaptive',
  backgroundBandCustomLines: 3,
  backgroundBandLockedToMaxLines: false,
  lyricsPosition: 'lower',
  fullScreenMode: false,
  fullScreenBackgroundType: 'color',
  fullScreenBackgroundColor: '#000000',
  fullScreenBackgroundPaint: { type: 'solid', color: '#000000' },
  fullScreenBackgroundMedia: null,
  fullScreenBackgroundMediaName: '',
  fullScreenElementEnabled: false,
  fullScreenElementMedia: null,
  fullScreenElementMediaName: '',
  fullScreenElementScale: 25,
  fullScreenElementPosition: 'center',
  fullScreenElementPaddingX: 0,
  fullScreenElementPaddingY: 0,
  fullScreenElementOpacity: 2.5,
  fullScreenElementBlur: 0,
  alwaysShowBackground: false,
  fullScreenRestorePosition: null,
  fullScreenRestoreFontSize: null,
  fullScreenRestoreMaxLinesEnabled: null,
  fullScreenRestoreMaxLines: null,
  fullScreenRestoreLetterSpacing: null,
  fullScreenRestoreLineSpacing: null,
  fullScreenRestoreXMargin: null,
  fullScreenRestoreYMargin: null,
  fullScreenRestoreFontColor: null,
  fullScreenRestoreTranslationLineColor: null,
  fullScreenRestoreTranslationFontSizeMode: null,
  fullScreenRestoreTranslationFontSize: null,
  fullScreenFontSize: null,
  fullScreenMaxLinesEnabled: null,
  fullScreenMaxLines: null,
  fullScreenLetterSpacing: null,
  fullScreenLineSpacing: null,
  fullScreenXMargin: null,
  fullScreenYMargin: null,
  fullScreenFontColor: null,
  fullScreenTranslationLineColor: null,
  fullScreenTranslationFontSizeMode: null,
  fullScreenTranslationFontSize: null,
  xMargin: 3.5,
  yMargin: 2,
  maxLinesEnabled: false,
  maxLines: 3,
  minFontSize: 24,
  autosizerActive: false,
  primaryViewportWidth: null,
  primaryViewportHeight: null,
  allInstances: null,
  instanceCount: 0,
  transitionAnimation: 'none',
  transitionSpeed: 150
};

/** Default settings factory for any new output */
export const createDefaultOutputSettings = (overrides = {}) => ({
  fontStyle: 'Bebas Neue',
  bold: false,
  italic: false,
  underline: false,
  allCaps: false,
  textAlign: 'center',
  letterSpacing: 0,
  lineSpacing: 1,
  fontSize: 48,
  translationFontSizeMode: 'bound',
  translationFontSize: 48,
  fontColor: '#FFFFFF',
  translationLineColor: '#FBBF24',
  borderColor: '#000000',
  borderSize: 0,
  dropShadowColor: '#000000',
  dropShadowOpacity: 4,
  dropShadowOffsetX: 0,
  dropShadowOffsetY: 8,
  dropShadowBlur: 10,
  backgroundColor: '#000000',
  backgroundPaint: { type: 'solid', color: '#000000' },
  backgroundOpacity: 0,
  backgroundBandVerticalPadding: 20,
  backgroundBandHeightMode: 'adaptive',
  backgroundBandCustomLines: 3,
  backgroundBandLockedToMaxLines: false,
  lyricsPosition: 'lower',
  fullScreenMode: false,
  fullScreenBackgroundType: 'color',
  fullScreenBackgroundColor: '#000000',
  fullScreenBackgroundPaint: { type: 'solid', color: '#000000' },
  fullScreenBackgroundMedia: null,
  fullScreenBackgroundMediaName: '',
  fullScreenElementEnabled: false,
  fullScreenElementMedia: null,
  fullScreenElementMediaName: '',
  fullScreenElementScale: 25,
  fullScreenElementPosition: 'center',
  fullScreenElementPaddingX: 0,
  fullScreenElementPaddingY: 0,
  fullScreenElementOpacity: 2.5,
  fullScreenElementBlur: 0,
  alwaysShowBackground: false,
  fullScreenRestorePosition: null,
  fullScreenRestoreFontSize: null,
  fullScreenRestoreMaxLinesEnabled: null,
  fullScreenRestoreMaxLines: null,
  fullScreenRestoreLetterSpacing: null,
  fullScreenRestoreLineSpacing: null,
  fullScreenRestoreXMargin: null,
  fullScreenRestoreYMargin: null,
  fullScreenRestoreFontColor: null,
  fullScreenRestoreTranslationLineColor: null,
  fullScreenRestoreTranslationFontSizeMode: null,
  fullScreenRestoreTranslationFontSize: null,
  fullScreenFontSize: null,
  fullScreenMaxLinesEnabled: null,
  fullScreenMaxLines: null,
  fullScreenLetterSpacing: null,
  fullScreenLineSpacing: null,
  fullScreenXMargin: null,
  fullScreenYMargin: null,
  fullScreenFontColor: null,
  fullScreenTranslationLineColor: null,
  fullScreenTranslationFontSizeMode: null,
  fullScreenTranslationFontSize: null,
  xMargin: 3.5,
  yMargin: 2,
  maxLinesEnabled: false,
  maxLines: 3,
  minFontSize: 24,
  autosizerActive: false,
  primaryViewportWidth: null,
  primaryViewportHeight: null,
  allInstances: null,
  instanceCount: 0,
  transitionAnimation: 'none',
  transitionSpeed: 150,
  ...overrides,
});

export const defaultOutput2Settings = {
  fontStyle: 'Bebas Neue',
  bold: false,
  italic: false,
  underline: false,
  allCaps: false,
  textAlign: 'center',
  letterSpacing: 0,
  lineSpacing: 1,
  fontSize: 72,
  translationFontSizeMode: 'bound',
  translationFontSize: 72,
  fontColor: '#FFFFFF',
  translationLineColor: '#FBBF24',
  borderColor: '#000000',
  borderSize: 0,
  dropShadowColor: '#000000',
  dropShadowOpacity: 4,
  dropShadowOffsetX: 0,
  dropShadowOffsetY: 8,
  dropShadowBlur: 10,
  backgroundColor: '#000000',
  backgroundPaint: { type: 'solid', color: '#000000' },
  backgroundOpacity: 0,
  backgroundBandVerticalPadding: 30,
  backgroundBandHeightMode: 'adaptive',
  backgroundBandCustomLines: 3,
  backgroundBandLockedToMaxLines: false,
  lyricsPosition: 'lower',
  fullScreenMode: false,
  fullScreenBackgroundType: 'color',
  fullScreenBackgroundColor: '#000000',
  fullScreenBackgroundPaint: { type: 'solid', color: '#000000' },
  fullScreenBackgroundMedia: null,
  fullScreenBackgroundMediaName: '',
  fullScreenElementEnabled: false,
  fullScreenElementMedia: null,
  fullScreenElementMediaName: '',
  fullScreenElementScale: 25,
  fullScreenElementPosition: 'center',
  fullScreenElementPaddingX: 0,
  fullScreenElementPaddingY: 0,
  fullScreenElementOpacity: 2.5,
  fullScreenElementBlur: 0,
  alwaysShowBackground: false,
  fullScreenRestorePosition: null,
  fullScreenRestoreFontSize: null,
  fullScreenRestoreMaxLinesEnabled: null,
  fullScreenRestoreMaxLines: null,
  fullScreenRestoreLetterSpacing: null,
  fullScreenRestoreLineSpacing: null,
  fullScreenRestoreXMargin: null,
  fullScreenRestoreYMargin: null,
  fullScreenRestoreFontColor: null,
  fullScreenRestoreTranslationLineColor: null,
  fullScreenRestoreTranslationFontSizeMode: null,
  fullScreenRestoreTranslationFontSize: null,
  fullScreenFontSize: null,
  fullScreenMaxLinesEnabled: null,
  fullScreenMaxLines: null,
  fullScreenLetterSpacing: null,
  fullScreenLineSpacing: null,
  fullScreenXMargin: null,
  fullScreenYMargin: null,
  fullScreenFontColor: null,
  fullScreenTranslationLineColor: null,
  fullScreenTranslationFontSizeMode: null,
  fullScreenTranslationFontSize: null,
  xMargin: 3.5,
  yMargin: 2,
  maxLinesEnabled: false,
  maxLines: 3,
  minFontSize: 24,
  autosizerActive: false,
  primaryViewportWidth: null,
  primaryViewportHeight: null,
  allInstances: null,
  instanceCount: 0,
  transitionAnimation: 'none',
  transitionSpeed: 150
};

export const createOutputSlice = (set, get, normalizePaintSettingUpdates) => ({
  isOutputOn: true,
  output1Enabled: true,
  output2Enabled: true,
  customOutputIds: [],
  previewCustomOutputId: null,
  output1Settings: defaultOutput1Settings,
  output2Settings: defaultOutput2Settings,

  setIsOutputOn: (state) => set({ isOutputOn: state }),
  setOutput1Enabled: (enabled) => set({ output1Enabled: enabled }),
  setOutput2Enabled: (enabled) => set({ output2Enabled: enabled }),
  setPreviewCustomOutputId: (outputId) =>
    set((state) => {
      if (outputId === null) return { previewCustomOutputId: null };
      if (typeof outputId !== 'string' || !outputId.startsWith('output')) return {};
      if (!state.customOutputIds.includes(outputId)) return {};
      return { previewCustomOutputId: outputId };
    }),

  updateOutputSettings: (output, newSettings) =>
    set((state) => {
      const key = `${output}Settings`;
      const currentSettings = state[key] || {};
      const normalizedSettings = normalizePaintSettingUpdates(newSettings);
      if (!settingsChanged(currentSettings, normalizedSettings)) return state;
      return {
        [key]: {
          ...currentSettings,
          ...normalizedSettings
        }
      };
    }),

  getAllOutputIds: () => {
    const state = get();
    return [...DEFAULT_OUTPUT_IDS, ...state.customOutputIds];
  },

  addCustomOutput: () => {
    const state = get();
    if (state.customOutputIds.length >= MAX_CUSTOM_OUTPUTS) return null;

    const allIds = [...DEFAULT_OUTPUT_IDS, ...state.customOutputIds];
    let nextNum = 3;
    while (allIds.includes(`output${nextNum}`)) nextNum++;
    const newId = `output${nextNum}`;

    set({
      customOutputIds: [...state.customOutputIds, newId],
      [`${newId}Settings`]: createDefaultOutputSettings(),
      [`${newId}Enabled`]: true,
    });

    return newId;
  },

  removeCustomOutput: (outputId) => {
    const state = get();
    if (outputId === 'output1' || outputId === 'output2') return false;
    if (!state.customOutputIds.includes(outputId)) return false;

    const nextCustomOutputIds = state.customOutputIds.filter(id => id !== outputId);
    const updates = {
      customOutputIds: nextCustomOutputIds,
    };

    if (state.previewCustomOutputId === outputId) {
      updates.previewCustomOutputId = null;
    }

    updates[`${outputId}Settings`] = undefined;
    updates[`${outputId}Enabled`] = undefined;

    set(updates);
    return true;
  },

  setCustomOutputs: (outputIds) =>
    set((state) => {
      const normalized = Array.from(
        new Set(
          (Array.isArray(outputIds) ? outputIds : [])
            .filter((id) => typeof id === 'string' && id.startsWith('output'))
            .filter((id) => id !== 'output1' && id !== 'output2')
        )
      ).sort((a, b) => {
        const numA = parseInt(a.replace('output', ''), 10);
        const numB = parseInt(b.replace('output', ''), 10);
        if (Number.isFinite(numA) && Number.isFinite(numB)) return numA - numB;
        return a.localeCompare(b);
      });

      const updates = {
        customOutputIds: normalized,
        previewCustomOutputId: normalized.includes(state.previewCustomOutputId)
          ? state.previewCustomOutputId
          : null,
      };

      for (const existingId of state.customOutputIds || []) {
        if (!normalized.includes(existingId)) {
          updates[`${existingId}Settings`] = undefined;
          updates[`${existingId}Enabled`] = undefined;
        }
      }

      for (const id of normalized) {
        if (!state[`${id}Settings`]) {
          updates[`${id}Settings`] = createDefaultOutputSettings();
        }
        if (typeof state[`${id}Enabled`] !== 'boolean') {
          updates[`${id}Enabled`] = true;
        }
      }

      return updates;
    }),

  setOutputEnabled: (outputId, enabled) =>
    set((state) => {
      if (typeof outputId !== 'string' || !outputId.startsWith('output')) return {};
      if (outputId !== 'output1' && outputId !== 'output2' && !state.customOutputIds.includes(outputId)) {
        return {};
      }
      return { [`${outputId}Enabled`]: enabled };
    }),
});

export const partializeOutputState = (state) => {
  const persisted = {
    isOutputOn: state.isOutputOn,
    output1Enabled: state.output1Enabled,
    output2Enabled: state.output2Enabled,
    previewCustomOutputId: state.previewCustomOutputId,
    output1Settings: state.output1Settings,
    output2Settings: state.output2Settings,
    customOutputIds: state.customOutputIds,
  };

  for (const id of (state.customOutputIds || [])) {
    if (state[`${id}Settings`]) persisted[`${id}Settings`] = state[`${id}Settings`];
    if (typeof state[`${id}Enabled`] === 'boolean') persisted[`${id}Enabled`] = state[`${id}Enabled`];
  }

  return persisted;
};

export const rehydrateOutputState = (state) => {
  if (state.previewCustomOutputId && !state.customOutputIds?.includes(state.previewCustomOutputId)) {
    state.previewCustomOutputId = null;
  }

  const allOutputIds = [...DEFAULT_OUTPUT_IDS, ...(state.customOutputIds || [])];
  for (const id of allOutputIds) {
    if (state[`${id}Settings`]) {
      state[`${id}Settings`] = {
        ...state[`${id}Settings`],
        autosizerActive: false,
        primaryViewportWidth: null,
        primaryViewportHeight: null,
        allInstances: null,
        instanceCount: 0,
      };
    }
  }
};
