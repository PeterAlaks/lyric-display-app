import electron from 'electron';
import fs from 'fs';
import path from 'path';

const { app } = typeof electron === 'object' && electron ? electron : {};

export const APP_NAME = 'LyricDisplay';
export const LEGACY_APP_NAME = 'lyric-display-app';
export const NDI_FOLDER_NAME = 'NDI';
export const NDI_INSTALL_FOLDER_NAME = 'Companion';
export const NDI_USER_DATA_FOLDER_NAME = 'User Data';
export const NDI_MANAGED_INSTALL_MARKER = '.managed-install-complete';
export const LEGACY_NDI_FOLDER_NAME = 'lyricdisplay-ndi';

const MIGRATION_MARKER = 'user-data-migration.json';
const NDI_RUNTIME_ENTRY_NAMES = new Set([
  'blob_storage',
  'cache',
  'code cache',
  'cookies',
  'cookies-journal',
  'crashpad',
  'dawncache',
  'dawngraphitecache',
  'dawnwebgpucache',
  'dictionaries',
  'dips',
  'dips-journal',
  'gpucache',
  'grshadercache',
  'local state',
  'local storage',
  'ndi-companion-settings.json',
  'network',
  'preferences',
  'session storage',
  'shared dictionary',
  'sharedstorage',
  'sharedstorage-wal',
  'transportsecurity',
  'trust tokens',
  'trust tokens-journal',
  'webstorage',
]);
const NDI_INSTALL_ENTRY_NAMES = new Set([
  NDI_MANAGED_INSTALL_MARKER,
  'chrome-sandbox',
  'icudtl.dat',
  'locales',
  'lyricdisplay ndi',
  'lyricdisplay ndi.app',
  'lyricdisplay ndi.exe',
  'lyricdisplay-ndi',
  'package.json',
  'resources',
  'resources.pak',
  'snapshot_blob.bin',
  'swiftshader',
  'v8_context_snapshot.bin',
  'version',
  'vk_swiftshader_icd.json',
]);

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

function isNdiInstallEntry(entryName) {
  const normalizedName = String(entryName || '').toLowerCase();
  return NDI_INSTALL_ENTRY_NAMES.has(normalizedName) ||
    normalizedName.startsWith('license') ||
    normalizedName.endsWith('.dll') ||
    normalizedName.endsWith('.dylib') ||
    normalizedName.endsWith('.exe') ||
    normalizedName.endsWith('.pak') ||
    normalizedName.endsWith('.so') ||
    normalizedName.includes('.so.');
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
  const targetNdiInstallPath = path.join(targetNdiPath, NDI_INSTALL_FOLDER_NAME);
  const targetNdiUserDataPath = path.join(targetNdiPath, NDI_USER_DATA_FOLDER_NAME);

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
    legacyNdi: createLegacyNdiSummary(legacyNdiPath, targetNdiUserDataPath),
    legacyUserDataNdi: createLegacyNdiSummary(legacyUserDataNdiPath, targetNdiInstallPath),
    flatNdiInstall: createLegacyNdiSummary(targetNdiPath, targetNdiInstallPath),
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
    movedEntries: 0,
    supersededEntries: 0,
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
  migrateFlatNdiInstall(
    summary.flatNdiInstall,
    summary.legacyNdi?.targetPath,
    Boolean(summary.legacyNdi?.attempted && summary.legacyNdi?.deletedLegacy)
  );
}

function migrateFlatNdiInstall(ndi, userDataPath, managedUserDataIsAuthoritative = false) {
  if (!ndi || !pathExists(ndi.sourcePath)) {
    if (ndi) {
      ndi.deletedLegacy = true;
      ndi.legacyDeleteSkippedReason = null;
      ndi.conflicts = [];
      ndi.errors = [];
    }
    return;
  }

  let entries;
  try {
    const reservedNames = new Set([
      path.basename(ndi.targetPath).toLowerCase(),
      path.basename(userDataPath || '').toLowerCase(),
    ]);
    entries = fs.readdirSync(ndi.sourcePath, { withFileTypes: true })
      .filter((entry) => !reservedNames.has(entry.name.toLowerCase()));
  } catch (error) {
    ndi.attempted = true;
    ndi.deletedLegacy = false;
    ndi.legacyDeleteSkippedReason = 'Could not inspect the flat NDI install directory';
    ndi.errors = [{ path: ndi.sourcePath, message: error.message }];
    return;
  }

  if (entries.length === 0) {
    ndi.deletedLegacy = true;
    ndi.legacyDeleteSkippedReason = null;
    ndi.conflicts = [];
    ndi.errors = [];
    return;
  }

  ndi.previouslyAttempted = Boolean(ndi.previouslyAttempted || ndi.attempted);
  ndi.attempted = true;
  ndi.movedEntries = 0;
  ndi.supersededEntries = 0;
  ndi.copiedFiles = 0;
  ndi.skippedExisting = 0;
  ndi.skippedSymlinks = 0;
  ndi.skippedOther = 0;
  ndi.deletedLegacy = false;
  ndi.legacyDeleteSkippedReason = null;
  ndi.conflicts = [];
  ndi.errors = [];
  const managedInstallIsAuthoritative = pathExists(
    path.join(ndi.targetPath, NDI_MANAGED_INSTALL_MARKER)
  );

  for (const entry of entries) {
    const normalizedName = entry.name.toLowerCase();
    const isRuntimeEntry = NDI_RUNTIME_ENTRY_NAMES.has(normalizedName) ||
      normalizedName.startsWith('singleton') ||
      !isNdiInstallEntry(normalizedName);
    const entryTargetRoot = isRuntimeEntry && userDataPath
      ? userDataPath
      : ndi.targetPath;

    if (!isRuntimeEntry && managedInstallIsAuthoritative) {
      const supersededPath = path.join(ndi.sourcePath, entry.name);
      try {
        withAsarDisabled(() => {
          fs.rmSync(supersededPath, { recursive: true, force: true });
        });
        if (pathExists(supersededPath)) {
          throw new Error('Path still exists after removal');
        }
        ndi.supersededEntries += 1;
      } catch (error) {
        ndi.errors.push({ path: supersededPath, message: error.message });
      }
      continue;
    }

    const entryMigration = createLegacyNdiSummary(
      path.join(ndi.sourcePath, entry.name),
      path.join(entryTargetRoot, entry.name)
    );
    migrateLegacyNdiFolder(entryMigration);

    const canDiscardSupersededRuntimeEntry = isRuntimeEntry &&
      managedUserDataIsAuthoritative &&
      !entryMigration.deletedLegacy &&
      entryMigration.conflicts.length > 0 &&
      entryMigration.errors.length === 0 &&
      entryMigration.skippedSymlinks === 0 &&
      entryMigration.skippedOther === 0 &&
      pathExists(entryMigration.targetPath);
    if (canDiscardSupersededRuntimeEntry) {
      try {
        withAsarDisabled(() => {
          fs.rmSync(entryMigration.sourcePath, { recursive: true, force: true });
        });
        if (!pathExists(entryMigration.sourcePath)) {
          entryMigration.deletedLegacy = true;
          entryMigration.legacyDeleteSkippedReason = null;
          entryMigration.conflicts = [];
          ndi.supersededEntries += 1;
        }
      } catch (error) {
        entryMigration.errors.push({ path: entryMigration.sourcePath, message: error.message });
      }
    }

    ndi.movedEntries += entryMigration.movedEntries;
    ndi.copiedFiles += entryMigration.copiedFiles;
    ndi.skippedExisting += entryMigration.skippedExisting;
    ndi.skippedSymlinks += entryMigration.skippedSymlinks;
    ndi.skippedOther += entryMigration.skippedOther;
    ndi.conflicts.push(...entryMigration.conflicts);
    ndi.errors.push(...entryMigration.errors);
  }

  const remainingEntries = entries.filter((entry) => (
    pathExists(path.join(ndi.sourcePath, entry.name))
  ));
  ndi.deletedLegacy = remainingEntries.length === 0;
  if (!ndi.deletedLegacy) {
    ndi.legacyDeleteSkippedReason = ndi.conflicts.length > 0
      ? 'Flat NDI install contains files that conflict with the Companion directory'
      : 'Flat NDI install migration did not complete cleanly';
  }
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

  ndi.previouslyAttempted = Boolean(ndi.previouslyAttempted || ndi.attempted);
  ndi.attempted = true;
  ndi.movedEntries = 0;
  ndi.copiedFiles = 0;
  ndi.skippedExisting = 0;
  ndi.skippedSymlinks = 0;
  ndi.skippedOther = 0;
  ndi.deletedLegacy = false;
  ndi.legacyDeleteSkippedReason = null;
  ndi.conflicts = [];
  ndi.errors = [];

  try {
    if (!pathExists(ndi.targetPath)) {
      try {
        fs.mkdirSync(path.dirname(ndi.targetPath), { recursive: true });
        withAsarDisabled(() => {
          fs.renameSync(ndi.sourcePath, ndi.targetPath);
        });
        ndi.movedEntries = 1;
        ndi.deletedLegacy = true;
        return;
      } catch {
        // Locked files and interrupted migrations fall back to copy/verify/delete.
      }
    }

    const sourceStat = fs.lstatSync(ndi.sourcePath);
    fs.mkdirSync(
      sourceStat.isDirectory() ? ndi.targetPath : path.dirname(ndi.targetPath),
      { recursive: true }
    );
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
    if (marker.flatNdiInstall && typeof marker.flatNdiInstall === 'object') {
      applyLegacyNdiMarker(summary.flatNdiInstall, marker.flatNdiInstall);
    }
  } catch (error) {
    summary.errors.push({ path: markerPath, message: error.message });
    summary.legacyDeleteSkippedReason = 'Could not verify existing migration marker';
  }
}

function applyLegacyNdiMarker(targetSummary, marker) {
  targetSummary.previouslyAttempted = Boolean(marker.previouslyAttempted || marker.attempted);
  targetSummary.movedEntries = Number(marker.movedEntries) || 0;
  targetSummary.supersededEntries = Number(marker.supersededEntries) || 0;
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
        flatNdiInstall: summary.flatNdiInstall,
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
