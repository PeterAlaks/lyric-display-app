export const CURRENT_PREFERENCES_SCHEMA_VERSION = 4;

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

  if (sourceVersion < 2) {
    const general = isPlainObject(migrated.general) ? migrated.general : {};
    migrated = {
      ...migrated,
      general: {
        ...general,
        shareAnonymousUsageData: typeof general.shareAnonymousUsageData === 'boolean'
          ? general.shareAnonymousUsageData
          : true,
      },
      _schemaVersion: 2,
    };
  }

  if (sourceVersion < 3) {
    const general = isPlainObject(migrated.general) ? migrated.general : {};
    const advanced = isPlainObject(migrated.advanced) ? migrated.advanced : {};
    const { shareAnonymousUsageData: legacyUsageSharing, ...nextGeneral } = general;
    const hasExplicitAdvancedDecision = advanced.telemetryConsentDecided === true;

    migrated = {
      ...migrated,
      general: nextGeneral,
      advanced: {
        ...advanced,
        shareAnonymousUsageData: hasExplicitAdvancedDecision
          ? advanced.shareAnonymousUsageData === true
          : false,
        telemetryConsentDecided: hasExplicitAdvancedDecision || legacyUsageSharing === false,
      },
      _schemaVersion: 3,
    };
  }

  if (sourceVersion < 4) {
    const general = isPlainObject(migrated.general) ? migrated.general : {};
    migrated = {
      ...migrated,
      general: {
        ...general,
        previewLines: typeof general.previewLines === 'boolean'
          ? general.previewLines
          : false,
      },
      _schemaVersion: 4,
    };
  }

  return { success: true, changed: true, sourceVersion, preferences: migrated };
}
