import { DEFAULT_TIMER_CONTROL_SETTINGS, DEFAULT_TIMER_DISPLAY, normalizeTimerControlSettings } from '../../utils/timerUtils';

export const createTimerSlice = (set, normalizePaintSettingUpdates) => ({
  timerControlSettings: { ...DEFAULT_TIMER_CONTROL_SETTINGS },
  timerDisplaySettings: { ...DEFAULT_TIMER_DISPLAY },

  updateTimerControlSettings: (settings, options = {}) => set((state) => {
    const incomingSettings = settings && typeof settings === 'object' ? settings : {};
    const currentSettings = normalizeTimerControlSettings(state.timerControlSettings);
    const currentUpdatedAt = Number(currentSettings.settingsUpdatedAt) || 0;
    const incomingUpdatedAt = Number(incomingSettings.settingsUpdatedAt) || 0;

    if (options?.touch === false && incomingUpdatedAt > 0 && currentUpdatedAt > incomingUpdatedAt) {
      return {};
    }
    if (options?.touch === false && incomingUpdatedAt === 0 && currentUpdatedAt > 0) {
      return {};
    }

    const nextSettings = normalizeTimerControlSettings({
      ...currentSettings,
      ...incomingSettings,
      settingsUpdatedAt: options?.touch === false
        ? (incomingUpdatedAt || currentUpdatedAt)
        : Date.now(),
    });

    if (JSON.stringify(currentSettings) === JSON.stringify(nextSettings)) {
      return {};
    }

    return {
      timerControlSettings: nextSettings,
    };
  }),

  updateTimerDisplaySettings: (settings, options = {}) => set((state) => {
    const incomingSettings = settings && typeof settings === 'object'
      ? normalizePaintSettingUpdates(settings)
      : {};
    const currentUpdatedAt = Number(state.timerDisplaySettings?.displayUpdatedAt) || 0;
    const incomingUpdatedAt = Number(incomingSettings.displayUpdatedAt) || 0;

    if (incomingUpdatedAt > 0 && currentUpdatedAt > incomingUpdatedAt) {
      return {};
    }
    if (options?.touch === false && incomingUpdatedAt === 0 && currentUpdatedAt > 0) {
      return {};
    }

    const shouldTouch = options?.touch !== false && incomingUpdatedAt === 0;

    return {
      timerDisplaySettings: {
        ...state.timerDisplaySettings,
        ...incomingSettings,
        displayUpdatedAt: incomingUpdatedAt || (shouldTouch ? Date.now() : currentUpdatedAt),
      },
    };
  }),
});
