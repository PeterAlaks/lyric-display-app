export const CURRENT_PREFERENCES_SCHEMA_VERSION = 1;

const isPlainObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));

export function migratePreferences(input) {
  const preferences = isPlainObject(input) ? input : {};
  const rawVersion = preferences._schemaVersion;
  const sourceVersion = rawVersion == null ? 0 : Number(rawVersion);

  if (!Number.isInteger(sourceVersion) || sourceVersion < 0) {
    return { success: false, error: 'Preferences schema version is invalid', preferences };
  }
  if (sourceVersion > CURRENT_PREFERENCES_SCHEMA_VERSION) {
    return {
      success: false,
      futureVersion: true,
      error: `Preferences schema ${sourceVersion} requires a newer LyricDisplay version`,
      preferences,
    };
  }
  if (sourceVersion === CURRENT_PREFERENCES_SCHEMA_VERSION) {
    return { success: true, changed: false, sourceVersion, preferences };
  }

  let migrated = { ...preferences };
  if (sourceVersion < 1) {
    const general = isPlainObject(migrated.general) ? migrated.general : {};
    migrated = {
      ...migrated,
      general: {
        ...general,
        autoCheckForUpdates: typeof general.autoCheckForUpdates === 'boolean'
          ? general.autoCheckForUpdates
          : true,
        liveSafetyMode: typeof general.liveSafetyMode === 'boolean'
          ? general.liveSafetyMode
          : false,
      },
      _schemaVersion: 1,
    };
  }

  return { success: true, changed: true, sourceVersion, preferences: migrated };
}
