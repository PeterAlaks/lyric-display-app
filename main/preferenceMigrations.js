import {
  DEFAULT_CAPITALIZED_WORDS,
  normalizeCapitalizedWords,
} from '../shared/capitalizedWords.js';
import {
  DEFAULT_SECTION_TAG_PHRASES,
  normalizeSectionTagPhrases,
} from '../shared/sectionTagPhrases.js';
import {
  DEFAULT_APPEARANCE_TRANSITIONS,
  normalizeAppearanceTransitions,
} from '../shared/transitionSettings.js';
import {
  DEFAULT_PREVIEW_SETTINGS,
  normalizePreviewSettings,
} from '../shared/previewSettings.js';
import { DEFAULT_BACKEND_PORT, normalizeBackendPort } from '../shared/backendPort.js';

export const CURRENT_PREFERENCES_SCHEMA_VERSION = 11;

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

  if (sourceVersion < 5) {
    const formatting = isPlainObject(migrated.formatting) ? migrated.formatting : {};
    migrated = {
      ...migrated,
      formatting: {
        ...formatting,
        capitalizedWords: Array.isArray(formatting.capitalizedWords)
          ? normalizeCapitalizedWords(formatting.capitalizedWords)
          : [...DEFAULT_CAPITALIZED_WORDS],
      },
      _schemaVersion: 5,
    };
  }

  if (sourceVersion < 6) {
    const parsing = isPlainObject(migrated.parsing) ? migrated.parsing : {};
    migrated = {
      ...migrated,
      parsing: {
        ...parsing,
        sectionTagPhrases: Array.isArray(parsing.sectionTagPhrases)
          ? normalizeSectionTagPhrases(parsing.sectionTagPhrases)
          : [...DEFAULT_SECTION_TAG_PHRASES],
      },
      _schemaVersion: 6,
    };
  }

  if (sourceVersion < 7) {
    const fileHandling = isPlainObject(migrated.fileHandling) ? migrated.fileHandling : {};
    const nextFileHandling = { ...fileHandling };
    delete nextFileHandling.defaultLyricsPath;
    migrated = {
      ...migrated,
      fileHandling: nextFileHandling,
      _schemaVersion: 7,
    };
  }

  if (sourceVersion < 8) {
    const appearance = isPlainObject(migrated.appearance) ? migrated.appearance : {};
    migrated = {
      ...migrated,
      appearance: {
        ...appearance,
        ...DEFAULT_APPEARANCE_TRANSITIONS,
        ...normalizeAppearanceTransitions(appearance),
      },
      _schemaVersion: 8,
    };
  }

  if (sourceVersion < 9) {
    const appearance = isPlainObject(migrated.appearance) ? migrated.appearance : {};
    migrated = {
      ...migrated,
      appearance: {
        ...appearance,
        preview: normalizePreviewSettings(
          isPlainObject(appearance.preview)
            ? appearance.preview
            : DEFAULT_PREVIEW_SETTINGS
        ),
      },
      _schemaVersion: 9,
    };
  }

  if (sourceVersion < 10) {
    const appearance = isPlainObject(migrated.appearance) ? migrated.appearance : {};
    migrated = {
      ...migrated,
      appearance: {
        ...appearance,
        preview: normalizePreviewSettings(
          isPlainObject(appearance.preview)
            ? appearance.preview
            : DEFAULT_PREVIEW_SETTINGS
        ),
      },
      _schemaVersion: 10,
    };
  }

  if (sourceVersion < 11) {
    const advanced = isPlainObject(migrated.advanced) ? migrated.advanced : {};
    migrated = {
      ...migrated,
      advanced: {
        ...advanced,
        serverPort: normalizeBackendPort(advanced.serverPort, DEFAULT_BACKEND_PORT),
      },
      _schemaVersion: 11,
    };
  }

  return { success: true, changed: true, sourceVersion, preferences: migrated };
}
