import { app } from 'electron';
import fs from 'fs';
import path from 'path';

export const APP_NAME = 'LyricDisplay';
export const LEGACY_APP_NAME = 'lyric-display-app';

const MIGRATION_MARKER = 'user-data-migration.json';

let configured = false;
let migrationResult = null;

function pathExists(filePath) {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function copyMissingRecursive(sourcePath, targetPath, summary) {
  let stat;
  try {
    stat = fs.lstatSync(sourcePath);
  } catch (error) {
    summary.errors.push({ path: sourcePath, message: error.message });
    return;
  }

  if (stat.isSymbolicLink()) {
    summary.skippedSymlinks += 1;
    return;
  }

  if (stat.isDirectory()) {
    try {
      fs.mkdirSync(targetPath, { recursive: true });
    } catch (error) {
      summary.errors.push({ path: targetPath, message: error.message });
      return;
    }

    let entries = [];
    try {
      entries = fs.readdirSync(sourcePath, { withFileTypes: true });
    } catch (error) {
      summary.errors.push({ path: sourcePath, message: error.message });
      return;
    }

    for (const entry of entries) {
      copyMissingRecursive(
        path.join(sourcePath, entry.name),
        path.join(targetPath, entry.name),
        summary
      );
    }
    return;
  }

  if (!stat.isFile()) {
    summary.skippedOther += 1;
    return;
  }

  if (pathExists(targetPath)) {
    summary.skippedExisting += 1;
    return;
  }

  try {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
    fs.chmodSync(targetPath, stat.mode);
    summary.copiedFiles += 1;
  } catch (error) {
    summary.errors.push({ path: sourcePath, message: error.message });
  }
}

function migrateUserData(appDataPath) {
  const sourcePath = path.join(appDataPath, LEGACY_APP_NAME);
  const targetPath = path.join(appDataPath, APP_NAME);
  const markerPath = path.join(targetPath, MIGRATION_MARKER);

  const summary = {
    sourcePath,
    targetPath,
    markerPath,
    attempted: false,
    copiedFiles: 0,
    skippedExisting: 0,
    skippedSymlinks: 0,
    skippedOther: 0,
    deletedLegacy: false,
    legacyDeleteSkippedReason: null,
    errors: [],
  };

  if (sourcePath === targetPath || !pathExists(sourcePath)) {
    return summary;
  }

  if (pathExists(markerPath)) {
    summary.attempted = false;
    applyExistingMarker(markerPath, summary);
    if (!summary.legacyDeleteSkippedReason) {
      summary.legacyDeleteSkippedReason = 'Migration marker already exists';
    }
    deleteLegacyUserData(sourcePath, summary);
    return summary;
  }

  summary.attempted = true;
  try {
    fs.mkdirSync(targetPath, { recursive: true });
    copyMissingRecursive(sourcePath, targetPath, summary);

    if (isMigrationComplete(summary)) {
      fs.writeFileSync(
        markerPath,
        JSON.stringify({
          migratedAt: new Date().toISOString(),
          sourcePath,
          targetPath,
          copiedFiles: summary.copiedFiles,
          skippedExisting: summary.skippedExisting,
          skippedSymlinks: summary.skippedSymlinks,
          skippedOther: summary.skippedOther,
          deletedLegacy: false,
          errors: summary.errors,
        }, null, 2),
        'utf8'
      );
      deleteLegacyUserData(sourcePath, summary);
      updateMigrationMarker(markerPath, summary);
    } else if (!summary.legacyDeleteSkippedReason) {
      summary.legacyDeleteSkippedReason = 'Migration did not complete cleanly';
    }
  } catch (error) {
    summary.errors.push({ path: targetPath, message: error.message });
    if (!summary.legacyDeleteSkippedReason) {
      summary.legacyDeleteSkippedReason = 'Migration failed';
    }
  }

  return summary;
}

function isMigrationComplete(summary) {
  return summary.errors.length === 0 &&
    summary.skippedSymlinks === 0 &&
    summary.skippedOther === 0;
}

function applyExistingMarker(markerPath, summary) {
  try {
    const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    summary.copiedFiles = Number(marker.copiedFiles) || 0;
    summary.skippedExisting = Number(marker.skippedExisting) || 0;
    summary.skippedSymlinks = Number(marker.skippedSymlinks) || 0;
    summary.skippedOther = Number(marker.skippedOther) || 0;
    summary.deletedLegacy = Boolean(marker.deletedLegacy);
    summary.legacyDeleteSkippedReason = marker.legacyDeleteSkippedReason || null;
    summary.errors = Array.isArray(marker.errors) ? marker.errors : [];
  } catch (error) {
    summary.errors.push({ path: markerPath, message: error.message });
    summary.legacyDeleteSkippedReason = 'Could not verify existing migration marker';
  }
}

function deleteLegacyUserData(sourcePath, summary) {
  if (!isMigrationComplete(summary)) {
    if (!summary.legacyDeleteSkippedReason) {
      summary.legacyDeleteSkippedReason = 'Migration did not complete cleanly';
    }
    return;
  }

  try {
    fs.rmSync(sourcePath, { recursive: true, force: true });
    summary.deletedLegacy = !pathExists(sourcePath);
    if (!summary.deletedLegacy) {
      summary.legacyDeleteSkippedReason = 'Legacy folder still exists after delete attempt';
    } else {
      summary.legacyDeleteSkippedReason = null;
    }
  } catch (error) {
    summary.legacyDeleteSkippedReason = 'Failed to delete legacy folder';
    summary.errors.push({ path: sourcePath, message: error.message });
  }
}

function updateMigrationMarker(markerPath, summary) {
  try {
    fs.writeFileSync(
      markerPath,
      JSON.stringify({
        migratedAt: new Date().toISOString(),
        sourcePath: summary.sourcePath,
        targetPath: summary.targetPath,
        copiedFiles: summary.copiedFiles,
        skippedExisting: summary.skippedExisting,
        skippedSymlinks: summary.skippedSymlinks,
        skippedOther: summary.skippedOther,
        deletedLegacy: summary.deletedLegacy,
        legacyDeleteSkippedReason: summary.legacyDeleteSkippedReason,
        errors: summary.errors,
      }, null, 2),
      'utf8'
    );
  } catch (error) {
    summary.errors.push({ path: markerPath, message: error.message });
  }
}

export function configureAppIdentity() {
  if (configured) return migrationResult;
  configured = true;

  app.setName(APP_NAME);

  try {
    const appDataPath = app.getPath('appData');
    const userDataPath = path.join(appDataPath, APP_NAME);

    migrationResult = migrateUserData(appDataPath);
    fs.mkdirSync(userDataPath, { recursive: true });
    app.setPath('userData', userDataPath);
  } catch (error) {
    migrationResult = {
      attempted: false,
      copiedFiles: 0,
      skippedExisting: 0,
      skippedSymlinks: 0,
      skippedOther: 0,
      errors: [{ message: error.message }],
    };
  }

  return migrationResult;
}

export function getUserDataMigrationResult() {
  return migrationResult;
}

configureAppIdentity();
