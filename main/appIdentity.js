import electron from 'electron';
import fs from 'fs';
import path from 'path';

const { app } = typeof electron === 'object' && electron ? electron : {};

export const APP_NAME = 'LyricDisplay';
export const LEGACY_APP_NAME = 'lyric-display-app';
export const NDI_FOLDER_NAME = 'NDI';
export const LEGACY_NDI_FOLDER_NAME = 'lyricdisplay-ndi';

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

function recordConflict(summary, sourcePath, targetPath, message) {
  if (!Array.isArray(summary.conflicts)) {
    summary.conflicts = [];
  }
  summary.conflicts.push({ sourcePath, targetPath, message });
}

function filesHaveSameContent(sourcePath, targetPath, sourceStat) {
  let targetStat;
  try {
    targetStat = fs.lstatSync(targetPath);
  } catch {
    return false;
  }

  if (!targetStat.isFile() || sourceStat.size !== targetStat.size) {
    return false;
  }

  if (sourceStat.size === 0) {
    return true;
  }

  try {
    return fs.readFileSync(sourcePath).equals(fs.readFileSync(targetPath));
  } catch {
    return false;
  }
}

function symlinksHaveSameTarget(sourcePath, targetPath) {
  try {
    const targetStat = fs.lstatSync(targetPath);
    return targetStat.isSymbolicLink() &&
      fs.readlinkSync(sourcePath) === fs.readlinkSync(targetPath);
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
    if (pathExists(targetPath)) {
      if (symlinksHaveSameTarget(sourcePath, targetPath)) {
        summary.skippedExisting += 1;
      } else {
        recordConflict(
          summary,
          sourcePath,
          targetPath,
          'Target path already exists for a different symbolic link'
        );
      }
      return;
    }

    try {
      const linkTarget = fs.readlinkSync(sourcePath);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.symlinkSync(linkTarget, targetPath);
      summary.copiedFiles += 1;
    } catch (error) {
      summary.errors.push({ path: sourcePath, message: error.message });
    }
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
    if (filesHaveSameContent(sourcePath, targetPath, stat)) {
      summary.skippedExisting += 1;
    } else {
      recordConflict(
        summary,
        sourcePath,
        targetPath,
        'Target file already exists with different contents'
      );
    }
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
  const legacyNdiPath = path.join(appDataPath, LEGACY_NDI_FOLDER_NAME);
  const legacyUserDataNdiPath = path.join(targetPath, LEGACY_NDI_FOLDER_NAME);
  const targetNdiPath = path.join(targetPath, NDI_FOLDER_NAME);

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
    migratedAt: null,
    reconciliationAttempted: false,
    conflicts: [],
    legacyNdi: createLegacyNdiSummary(legacyNdiPath, targetNdiPath),
    legacyUserDataNdi: createLegacyNdiSummary(legacyUserDataNdiPath, targetNdiPath),
    errors: [],
  };

  if (sourcePath === targetPath) {
    migrateLegacyNdiFolders(summary);
    return summary;
  }

  if (!pathExists(sourcePath)) {
    if (pathExists(markerPath)) {
      applyExistingMarker(markerPath, summary);
      summary.deletedLegacy = true;
      summary.legacyDeleteSkippedReason = null;
      summary.conflicts = [];
      summary.errors = getMigrationErrors(summary);
    }
    migrateLegacyNdiFolders(summary);
    if (pathExists(markerPath)) {
      updateMigrationMarker(markerPath, summary);
    }
    return summary;
  }

  if (pathExists(markerPath)) {
    applyExistingMarker(markerPath, summary);
    summary.reconciliationAttempted = true;
    summary.legacyDeleteSkippedReason = null;
    summary.conflicts = [];
    try {
      fs.mkdirSync(targetPath, { recursive: true });
      withAsarDisabled(() => {
        copyMissingRecursive(sourcePath, targetPath, summary);
      });
    } catch (error) {
      summary.errors.push({ path: targetPath, message: error.message });
      summary.legacyDeleteSkippedReason = 'Migration reconciliation failed';
    }
    deleteLegacyUserData(sourcePath, summary);
    updateMigrationMarker(markerPath, summary);
    migrateLegacyNdiFolders(summary);
    updateMigrationMarker(markerPath, summary);
    return summary;
  }

  summary.attempted = true;
  try {
    fs.mkdirSync(targetPath, { recursive: true });
    withAsarDisabled(() => {
      copyMissingRecursive(sourcePath, targetPath, summary);
    });

    if (isMigrationComplete(summary)) {
      summary.migratedAt = new Date().toISOString();
      updateMigrationMarker(markerPath, summary);
      deleteLegacyUserData(sourcePath, summary);
      migrateLegacyNdiFolders(summary);
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

function createLegacyNdiSummary(sourcePath, targetPath) {
  return {
    sourcePath,
    targetPath,
    attempted: false,
    copiedFiles: 0,
    skippedExisting: 0,
    skippedSymlinks: 0,
    skippedOther: 0,
    deletedLegacy: false,
    legacyDeleteSkippedReason: null,
    previouslyAttempted: false,
    conflicts: [],
    errors: [],
  };
}

function migrateLegacyNdiFolders(summary) {
  migrateLegacyNdiFolder(summary.legacyNdi);
  migrateLegacyNdiFolder(summary.legacyUserDataNdi);
}

function migrateLegacyNdiFolder(ndi) {
  if (!ndi || ndi.sourcePath === ndi.targetPath || !pathExists(ndi.sourcePath)) {
    if (ndi && !pathExists(ndi.sourcePath)) {
      ndi.deletedLegacy = true;
      ndi.legacyDeleteSkippedReason = null;
      ndi.conflicts = [];
      ndi.errors = [];
    }
    return;
  }

  ndi.attempted = true;

  try {
    fs.mkdirSync(ndi.targetPath, { recursive: true });
    withAsarDisabled(() => {
      copyMissingRecursive(ndi.sourcePath, ndi.targetPath, ndi);
    });

    if (isLegacyNdiMigrationComplete(ndi)) {
      deleteLegacyNdiFolder(ndi);
    } else if (!ndi.legacyDeleteSkippedReason) {
      ndi.legacyDeleteSkippedReason = 'Legacy NDI migration did not complete cleanly';
    }
  } catch (error) {
    ndi.errors.push({ path: ndi.targetPath, message: error.message });
    if (!ndi.legacyDeleteSkippedReason) {
      ndi.legacyDeleteSkippedReason = 'Legacy NDI migration failed';
    }
  }
}

function isLegacyNdiMigrationComplete(ndi) {
  return getLegacyNdiMigrationErrors(ndi).length === 0 &&
    (!Array.isArray(ndi.conflicts) || ndi.conflicts.length === 0) &&
    ndi.skippedSymlinks === 0 &&
    ndi.skippedOther === 0;
}

function getLegacyNdiMigrationErrors(ndi) {
  return ndi.errors.filter((error) => error?.path !== ndi.sourcePath);
}

function deleteLegacyNdiFolder(ndi) {
  if (!isLegacyNdiMigrationComplete(ndi)) {
    if (!ndi.legacyDeleteSkippedReason) {
      ndi.legacyDeleteSkippedReason = 'Legacy NDI migration did not complete cleanly';
    }
    return;
  }

  try {
    ndi.errors = getLegacyNdiMigrationErrors(ndi);
    withAsarDisabled(() => {
      fs.rmSync(ndi.sourcePath, { recursive: true, force: true });
    });
    ndi.deletedLegacy = !pathExists(ndi.sourcePath);
    if (!ndi.deletedLegacy) {
      ndi.legacyDeleteSkippedReason = 'Legacy NDI folder still exists after delete attempt';
    } else {
      ndi.legacyDeleteSkippedReason = null;
    }
  } catch (error) {
    ndi.legacyDeleteSkippedReason = 'Failed to delete legacy NDI folder';
    ndi.errors.push({ path: ndi.sourcePath, message: error.message });
  }
}

function withAsarDisabled(callback) {
  const previousNoAsar = process.noAsar;
  process.noAsar = true;
  try {
    return callback();
  } finally {
    process.noAsar = previousNoAsar;
  }
}

function isMigrationComplete(summary) {
  return getMigrationErrors(summary).length === 0 &&
    (!Array.isArray(summary.conflicts) || summary.conflicts.length === 0) &&
    summary.skippedSymlinks === 0 &&
    summary.skippedOther === 0;
}

function getMigrationErrors(summary) {
  return summary.errors.filter((error) => error?.path !== summary.sourcePath);
}

function applyExistingMarker(markerPath, summary) {
  try {
    const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    summary.migratedAt = marker.migratedAt || null;
    summary.copiedFiles = Number(marker.copiedFiles) || 0;
    summary.skippedExisting = Number(marker.skippedExisting) || 0;
    summary.skippedSymlinks = Number(marker.skippedSymlinks) || 0;
    summary.skippedOther = Number(marker.skippedOther) || 0;
    summary.deletedLegacy = Boolean(marker.deletedLegacy);
    summary.legacyDeleteSkippedReason = marker.legacyDeleteSkippedReason || null;
    summary.conflicts = Array.isArray(marker.conflicts) ? marker.conflicts : [];
    summary.errors = Array.isArray(marker.errors) ? marker.errors : [];
    if (marker.legacyNdi && typeof marker.legacyNdi === 'object') {
      applyLegacyNdiMarker(summary.legacyNdi, marker.legacyNdi);
    }
    if (marker.legacyUserDataNdi && typeof marker.legacyUserDataNdi === 'object') {
      applyLegacyNdiMarker(summary.legacyUserDataNdi, marker.legacyUserDataNdi);
    }
  } catch (error) {
    summary.errors.push({ path: markerPath, message: error.message });
    summary.legacyDeleteSkippedReason = 'Could not verify existing migration marker';
  }
}

function applyLegacyNdiMarker(targetSummary, marker) {
  targetSummary.previouslyAttempted = Boolean(marker.previouslyAttempted || marker.attempted);
  targetSummary.copiedFiles = Number(marker.copiedFiles) || 0;
  targetSummary.skippedExisting = Number(marker.skippedExisting) || 0;
  targetSummary.skippedSymlinks = Number(marker.skippedSymlinks) || 0;
  targetSummary.skippedOther = Number(marker.skippedOther) || 0;
  targetSummary.deletedLegacy = Boolean(marker.deletedLegacy);
  targetSummary.legacyDeleteSkippedReason = marker.legacyDeleteSkippedReason || null;
  targetSummary.conflicts = Array.isArray(marker.conflicts) ? marker.conflicts : [];
  targetSummary.errors = Array.isArray(marker.errors) ? marker.errors : [];
}

function deleteLegacyUserData(sourcePath, summary) {
  if (pathExists(sourcePath)) {
    summary.deletedLegacy = false;
  }

  if (!isMigrationComplete(summary)) {
    if (!summary.legacyDeleteSkippedReason) {
      summary.legacyDeleteSkippedReason = 'Migration did not complete cleanly';
    }
    return;
  }

  try {
    summary.errors = getMigrationErrors(summary);
    withAsarDisabled(() => {
      fs.rmSync(sourcePath, { recursive: true, force: true });
    });
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
    const updatedAt = new Date().toISOString();
    fs.writeFileSync(
      markerPath,
      JSON.stringify({
        migratedAt: summary.migratedAt || updatedAt,
        updatedAt,
        sourcePath: summary.sourcePath,
        targetPath: summary.targetPath,
        attempted: summary.attempted,
        reconciliationAttempted: summary.reconciliationAttempted,
        copiedFiles: summary.copiedFiles,
        skippedExisting: summary.skippedExisting,
        skippedSymlinks: summary.skippedSymlinks,
        skippedOther: summary.skippedOther,
        deletedLegacy: summary.deletedLegacy,
        legacyDeleteSkippedReason: summary.legacyDeleteSkippedReason,
        conflicts: summary.conflicts,
        legacyNdi: summary.legacyNdi,
        legacyUserDataNdi: summary.legacyUserDataNdi,
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

  if (!app?.setName || !app?.getPath || !app?.setPath) {
    migrationResult = {
      attempted: false,
      copiedFiles: 0,
      skippedExisting: 0,
      skippedSymlinks: 0,
      skippedOther: 0,
      skippedReason: 'Electron app API is unavailable.',
      errors: [],
    };
    return migrationResult;
  }

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

export function migrateUserDataForTests(appDataPath) {
  return migrateUserData(appDataPath);
}

configureAppIdentity();
