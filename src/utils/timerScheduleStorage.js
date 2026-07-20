import { normalizeTimerControlSettings } from './timerUtils.js';

export const TIMER_SCHEDULE_STORAGE_KEY = 'lyricdisplay_saved_timer_schedule_v1';

const getStorage = (storage) => {
  if (storage) return storage;
  if (typeof window === 'undefined') return null;
  return window.localStorage || null;
};

export const buildTimerScheduleSnapshot = (settings, savedAt = Date.now()) => {
  const normalized = normalizeTimerControlSettings(settings);
  return {
    version: 1,
    savedAt: Math.max(0, Number(savedAt) || Date.now()),
    useSets: true,
    sets: normalized.sets,
    scheduleTitle: normalized.scheduleTitle,
    scheduleEventStartTime: normalized.scheduleEventStartTime,
    scheduleIdealEndTime: normalized.scheduleIdealEndTime,
    scheduleNotificationsEnabled: normalized.scheduleNotificationsEnabled,
    autoStartNext: normalized.autoStartNext,
    indicatorEnabled: normalized.indicatorEnabled,
    indicatorSeconds: normalized.indicatorSeconds,
    indicatorLabel: normalized.indicatorLabel,
    warningSeconds: normalized.warningSeconds,
    criticalSeconds: normalized.criticalSeconds,
    targetHourFormat: normalized.targetHourFormat,
  };
};

export const saveTimerScheduleSnapshot = (settings, storage) => {
  const targetStorage = getStorage(storage);
  const snapshot = buildTimerScheduleSnapshot(settings);
  if (!targetStorage) return snapshot;

  try {
    if (snapshot.sets.length === 0) {
      targetStorage.removeItem(TIMER_SCHEDULE_STORAGE_KEY);
    } else {
      targetStorage.setItem(TIMER_SCHEDULE_STORAGE_KEY, JSON.stringify(snapshot));
    }
  } catch {
    // The existing persisted settings remain the fallback if local storage is unavailable.
  }

  return snapshot;
};

export const readTimerScheduleSnapshot = (storage) => {
  const targetStorage = getStorage(storage);
  if (!targetStorage) return null;

  try {
    const raw = targetStorage.getItem(TIMER_SCHEDULE_STORAGE_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw);
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
    const normalized = normalizeTimerControlSettings({
      ...snapshot,
      useSets: true,
      settingsUpdatedAt: snapshot.savedAt,
    });
    return normalized.sets.length > 0 ? normalized : null;
  } catch {
    return null;
  }
};
