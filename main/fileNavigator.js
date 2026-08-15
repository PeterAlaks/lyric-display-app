import { app, BrowserWindow } from 'electron';
import path from 'path';
import { promises as fs, watch as watchFileSystem } from 'fs';
import {
  getLyricImportFormatForName,
  isSupportedLyricsImportFile,
} from '../shared/lyricImportRegistry.js';
import {
  createNavigatorMatchSnippet,
  createNavigatorPreview,
  parseFileNavigatorQuery,
  prepareNavigatorSearchRecord,
  scoreNavigatorSearchRecord,
} from '../shared/fileNavigatorSearch.js';
import { validateNavigatorSaveName } from '../shared/fileNavigatorSave.js';
import {
  FILE_NAVIGATOR_LIMITS,
  getFileNavigatorRootLimitError,
} from '../shared/fileNavigatorLimits.js';
import {
  getActiveLyricImportByteLimit,
  grantLyricWritePath,
  normalizeLyricPath,
} from './lyricFiles.js';
import { getRecents } from './recents.js';
import { ensureNavigatorDirectory } from './fileNavigatorDirectories.js';
import {
  APP_NAME,
  EASYWORSHIP_IMPORT_FOLDER_NAME,
  PRESENTATION_IMPORT_FOLDER_NAME,
} from './appIdentity.js';
import { saveTextFileAtomically } from './atomicFileSave.js';

const CONFIG_VERSION = 1;
const MAX_INDEX_FILES = 100_000;
const MAX_INDEX_TEXT_BYTES = 2 * 1024 * 1024;
const MAX_SEARCH_RESULTS = 200;
const MAX_FALLBACK_WATCHERS = 2048;
const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.svn',
  'node_modules',
  '$recycle.bin',
  'system volume information',
]);

let initializedPromise = null;
let roots = [];
let records = new Map();
let database = null;
let rebuildPromise = null;
let rebuildRequested = false;
let rebuildGeneration = 0;
let watcherTimer = null;
let watchers = [];
let rootIssues = new Map();
let rootMutationTail = Promise.resolve();
let indexingHoldCount = 0;
let indexingHoldBaseStatus = null;
let indexingHoldHadRebuild = false;
let indexingHoldError = null;
let status = {
  scanning: false,
  scanId: 0,
  indexedFiles: 0,
  scannedFiles: 0,
  truncated: false,
  contentTruncated: false,
  lastIndexedAt: null,
  error: null,
};

const naturalCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const normalizeComparisonPath = (value) => (
  process.platform === 'win32' ? String(value || '').toLowerCase() : String(value || '')
);

function getConfigPath() {
  return path.join(app.getPath('userData'), 'file-navigator.json');
}

function getDatabasePath() {
  return path.join(app.getPath('userData'), 'file-navigator-index.sqlite3');
}

function isWithinPath(candidate, parent) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function rootForPath(filePath, sourceRoots = roots) {
  const normalized = normalizeComparisonPath(path.resolve(filePath));
  return sourceRoots
    .slice()
    .sort((a, b) => b.length - a.length)
    .find((rootPath) => isWithinPath(normalized, normalizeComparisonPath(rootPath))) || null;
}

function createContentBudget(sourceRoots = roots) {
  return {
    remainingTotal: FILE_NAVIGATOR_LIMITS.maxSearchableContentBytesTotal,
    remainingByRoot: new Map(sourceRoots.map((rootPath) => [
      normalizeComparisonPath(rootPath),
      FILE_NAVIGATOR_LIMITS.maxSearchableContentBytesPerRoot,
    ])),
    truncated: false,
  };
}

function reserveContentBytes(budget, rootPath, byteLength) {
  if (!budget || byteLength <= 0) return true;
  const key = normalizeComparisonPath(rootPath);
  const remainingForRoot = budget.remainingByRoot.get(key)
    ?? FILE_NAVIGATOR_LIMITS.maxSearchableContentBytesPerRoot;
  if (byteLength > budget.remainingTotal || byteLength > remainingForRoot) {
    budget.truncated = true;
    return false;
  }
  budget.remainingTotal -= byteLength;
  budget.remainingByRoot.set(key, remainingForRoot - byteLength);
  return true;
}

function broadcast(payload = {}) {
  const next = { ...status, ...payload };
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win || win.isDestroyed()) continue;
    try { win.webContents.send('file-navigator:update', next); } catch { }
  }
}

function beginIndexingActivity() {
  if (status.scanning) return false;
  status = {
    ...status,
    scanning: true,
    scanId: (Number(status.scanId) || 0) + 1,
    scannedFiles: 0,
    error: null,
  };
  broadcast();
  return true;
}

function acquireIndexingHold() {
  if (indexingHoldCount === 0) {
    indexingHoldBaseStatus = status;
    indexingHoldHadRebuild = Boolean(rebuildPromise);
    indexingHoldError = null;
  }
  indexingHoldCount += 1;
  beginIndexingActivity();

  let released = false;
  return (error = null) => {
    if (released) return;
    released = true;
    if (error) indexingHoldError = error?.message || String(error);
    indexingHoldCount = Math.max(0, indexingHoldCount - 1);
    if (indexingHoldCount > 0) return;

    const baseStatus = indexingHoldBaseStatus;
    const hadRebuild = indexingHoldHadRebuild;
    const heldError = indexingHoldError;
    indexingHoldBaseStatus = null;
    indexingHoldHadRebuild = false;
    indexingHoldError = null;

    if (rebuildPromise || !status.scanning) return;
    status = hadRebuild
      ? { ...status, scanning: false, ...(heldError ? { error: heldError } : {}) }
      : {
        ...(baseStatus || status),
        scanning: false,
        scanId: status.scanId,
        ...(heldError ? { error: heldError } : {}),
      };
    broadcast();
  };
}

function withRootMutationLock(operation) {
  const result = rootMutationTail.then(operation, operation);
  rootMutationTail = result.then(() => undefined, () => undefined);
  return result;
}

async function pathIsDirectory(candidate) {
  try {
    return (await fs.stat(candidate)).isDirectory();
  } catch {
    return false;
  }
}

async function folderContainsSupportedLyrics(rootPath) {
  const pending = [rootPath];
  let inspectedEntries = 0;
  while (pending.length > 0 && inspectedEntries < 10_000) {
    const current = pending.shift();
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      inspectedEntries += 1;
      if (entry.isSymbolicLink()) continue;
      const entryPath = path.join(current, entry.name);
      if (entry.isFile() && isSupportedLyricsImportFile(entryPath)) return true;
      if (entry.isDirectory() && !IGNORED_DIRECTORIES.has(entry.name.toLowerCase())) {
        pending.push(entryPath);
      }
      if (inspectedEntries >= 10_000) break;
    }
  }
  return false;
}

async function addAutomaticImportRoots() {
  const importRoot = path.join(app.getPath('documents'), APP_NAME);
  const candidates = [EASYWORSHIP_IMPORT_FOLDER_NAME, PRESENTATION_IMPORT_FOLDER_NAME]
    .map((folderName) => path.join(importRoot, folderName));
  let changed = false;

  for (const candidate of candidates) {
    if (rootForPath(candidate)) continue;
    if (!await pathIsDirectory(candidate) || !await folderContainsSupportedLyrics(candidate)) continue;
    try {
      const realRoot = await fs.realpath(candidate);
      if (rootForPath(realRoot)) continue;
      const inspection = await inspectRootLimits(realRoot);
      if (inspection.error) continue;
      const realRootKey = normalizeComparisonPath(realRoot);
      const retainedRoots = roots.filter((entry) => (
        !isWithinPath(normalizeComparisonPath(entry), realRootKey)
      ));
      if (retainedRoots.length >= FILE_NAVIGATOR_LIMITS.maxRoots) continue;
      roots = [...retainedRoots, realRoot];
      changed = true;
    } catch { }
  }

  if (changed) await persistConfig();
}

async function persistConfig() {
  const payload = JSON.stringify({
    version: CONFIG_VERSION,
    initialized: true,
    roots,
  }, null, 2);
  await saveTextFileAtomically(getConfigPath(), payload);
}

async function loadConfig() {
  let parsed = null;
  try {
    parsed = JSON.parse(await fs.readFile(getConfigPath(), 'utf8'));
  } catch { }

  if (parsed?.initialized === true && Array.isArray(parsed.roots)) {
    const configuredRoots = [...new Set(parsed.roots
      .map((entry) => normalizeLyricPath(entry))
      .filter(Boolean))];
    roots = configuredRoots.slice(0, FILE_NAVIGATOR_LIMITS.maxRoots);
    if (configuredRoots.length > roots.length) {
      status = {
        ...status,
        truncated: true,
        error: `Only the first ${FILE_NAVIGATOR_LIMITS.maxRoots} indexed folders were loaded.`,
      };
      await persistConfig();
    }
    return;
  }

  roots = [];
  await persistConfig();
}

async function openDatabase() {
  try {
    const imported = await import('better-sqlite3');
    const Database = imported.default || imported;
    database = new Database(getDatabasePath());
    database.pragma('journal_mode = WAL');
    database.pragma('synchronous = NORMAL');
    database.exec(`
      CREATE TABLE IF NOT EXISTS navigator_files (
        filePath TEXT PRIMARY KEY,
        rootPath TEXT NOT NULL,
        fileName TEXT NOT NULL,
        fileType TEXT NOT NULL,
        relativePath TEXT NOT NULL,
        parentPath TEXT NOT NULL,
        size INTEGER NOT NULL,
        modifiedMs REAL NOT NULL,
        contentText TEXT NOT NULL DEFAULT ''
      )
    `);
  } catch (error) {
    database = null;
    console.warn('[FileNavigator] Persistent index unavailable; using memory:', error?.message || error);
  }
}

function hydrateRecord(record) {
  return prepareNavigatorSearchRecord({
    filePath: record.filePath,
    rootPath: record.rootPath,
    fileName: record.fileName,
    fileType: record.fileType,
    relativePath: record.relativePath,
    parentPath: record.parentPath,
    size: Number(record.size) || 0,
    modifiedMs: Number(record.modifiedMs) || 0,
    contentText: record.contentText || '',
  });
}

function loadCachedRecords() {
  if (!database || roots.length === 0) return;
  try {
    const budget = createContentBudget();
    const nextRecords = new Map();
    for (const cached of database.prepare('SELECT * FROM navigator_files').iterate()) {
      const sourceRoot = rootForPath(cached.filePath);
      if (!sourceRoot) continue;
      const contentBytes = cached.contentText
        ? Buffer.byteLength(cached.contentText, 'utf8')
        : 0;
      const boundedRecord = contentBytes > 0 && !reserveContentBytes(budget, sourceRoot, contentBytes)
        ? { ...cached, contentText: '' }
        : cached;
      nextRecords.set(normalizeComparisonPath(cached.filePath), hydrateRecord(boundedRecord));
    }
    records = nextRecords;
    status = {
      ...status,
      indexedFiles: records.size,
      contentTruncated: budget.truncated,
    };
  } catch (error) {
    console.warn('[FileNavigator] Could not load persistent index:', error?.message || error);
  }
}

function persistRecords(nextRecords) {
  if (!database) return;
  const insert = database.prepare(`
    INSERT INTO navigator_files (
      filePath, rootPath, fileName, fileType, relativePath, parentPath, size, modifiedMs, contentText
    ) VALUES (
      @filePath, @rootPath, @fileName, @fileType, @relativePath, @parentPath, @size, @modifiedMs, @contentText
    )
  `);
  const replaceAll = database.transaction((items) => {
    database.prepare('DELETE FROM navigator_files').run();
    for (const item of items) insert.run(item);
  });

  try {
    replaceAll([...nextRecords.values()].map((record) => ({
      filePath: record.filePath,
      rootPath: record.rootPath,
      fileName: record.fileName,
      fileType: record.fileType,
      relativePath: record.relativePath,
      parentPath: record.parentPath,
      size: record.size,
      modifiedMs: record.modifiedMs,
      contentText: record.contentText || '',
    })));
  } catch (error) {
    console.warn('[FileNavigator] Could not persist index:', error?.message || error);
  }
}

function persistSingleRecord(record) {
  if (!database) return;
  try {
    database.prepare(`
      INSERT INTO navigator_files (
        filePath, rootPath, fileName, fileType, relativePath, parentPath, size, modifiedMs, contentText
      ) VALUES (
        @filePath, @rootPath, @fileName, @fileType, @relativePath, @parentPath, @size, @modifiedMs, @contentText
      )
      ON CONFLICT(filePath) DO UPDATE SET
        rootPath = excluded.rootPath,
        fileName = excluded.fileName,
        fileType = excluded.fileType,
        relativePath = excluded.relativePath,
        parentPath = excluded.parentPath,
        size = excluded.size,
        modifiedMs = excluded.modifiedMs,
        contentText = excluded.contentText
    `).run({
      filePath: record.filePath,
      rootPath: record.rootPath,
      fileName: record.fileName,
      fileType: record.fileType,
      relativePath: record.relativePath,
      parentPath: record.parentPath,
      size: record.size,
      modifiedMs: record.modifiedMs,
      contentText: record.contentText || '',
    });
  } catch (error) {
    console.warn('[FileNavigator] Could not update persistent index:', error?.message || error);
  }
}

async function collectCandidates(sourceRoots, { fileLimit = MAX_INDEX_FILES } = {}) {
  const candidates = [];
  const directories = [];
  let truncated = false;

  for (const rootPath of sourceRoots) {
    const queue = [rootPath];
    let queueIndex = 0;
    while (queueIndex < queue.length && !truncated) {
      const directoryPath = queue[queueIndex];
      queueIndex += 1;
      let entries;
      try {
        entries = await fs.readdir(directoryPath, { withFileTypes: true });
      } catch {
        continue;
      }
      directories.push(directoryPath);

      for (const entry of entries) {
        if (entry.isSymbolicLink()) continue;
        const entryPath = path.join(directoryPath, entry.name);
        if (entry.isDirectory()) {
          if (!IGNORED_DIRECTORIES.has(entry.name.toLowerCase())) queue.push(entryPath);
          continue;
        }
        if (!entry.isFile() || !isSupportedLyricsImportFile(entry.name)) continue;
        candidates.push({ filePath: entryPath, rootPath });
        if (candidates.length >= fileLimit) {
          truncated = true;
          break;
        }
      }
    }
    if (truncated) break;
  }

  return { candidates, directories, truncated };
}

async function createRecord(
  candidate,
  previousRecord = null,
  contentByteLimit = MAX_INDEX_TEXT_BYTES,
  contentBudget = null
) {
  const fileStat = candidate.stat || await fs.stat(candidate.filePath);
  if (!fileStat.isFile()) return null;
  const format = getLyricImportFormatForName(candidate.filePath);
  if (!format) return null;

  if (
    previousRecord
    && previousRecord.size === fileStat.size
    && previousRecord.modifiedMs === fileStat.mtimeMs
    && previousRecord.rootPath === candidate.rootPath
  ) {
    const previousContentBytes = previousRecord.contentText
      ? Buffer.byteLength(previousRecord.contentText, 'utf8')
      : 0;
    if (previousContentBytes === 0 || reserveContentBytes(
      contentBudget,
      candidate.rootPath,
      previousContentBytes
    )) {
      return previousRecord;
    }
    return hydrateRecord({ ...previousRecord, contentText: '' });
  }

  let contentText = '';
  if (
    (format.fileType === 'txt' || format.fileType === 'lrc')
    && fileStat.size <= contentByteLimit
    && reserveContentBytes(contentBudget, candidate.rootPath, fileStat.size)
  ) {
    try { contentText = await fs.readFile(candidate.filePath, 'utf8'); } catch { }
  }

  return hydrateRecord({
    filePath: candidate.filePath,
    rootPath: candidate.rootPath,
    fileName: path.basename(candidate.filePath),
    fileType: format.fileType,
    relativePath: path.relative(candidate.rootPath, candidate.filePath),
    parentPath: path.dirname(candidate.filePath),
    size: fileStat.size,
    modifiedMs: fileStat.mtimeMs,
    contentText,
  });
}

async function statCandidates(candidates) {
  return mapWithConcurrency(candidates, 16, async (candidate) => {
    const fileStat = await fs.stat(candidate.filePath);
    return fileStat.isFile() ? { ...candidate, stat: fileStat } : null;
  }).then((items) => items.filter(Boolean));
}

async function inspectRootLimits(rootPath) {
  const { candidates, truncated } = await collectCandidates([rootPath], {
    fileLimit: FILE_NAVIGATOR_LIMITS.maxFilesPerRoot + 1,
  });
  if (truncated || candidates.length > FILE_NAVIGATOR_LIMITS.maxFilesPerRoot) {
    return {
      fileCount: candidates.length,
      sourceBytes: 0,
      error: getFileNavigatorRootLimitError({ fileCount: candidates.length }),
    };
  }

  const measured = await statCandidates(candidates);
  const sourceBytes = measured.reduce((total, candidate) => total + candidate.stat.size, 0);
  return {
    fileCount: measured.length,
    sourceBytes,
    error: getFileNavigatorRootLimitError({
      fileCount: measured.length,
      sourceBytes,
    }),
  };
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const output = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, Math.max(1, items.length)) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try { output[index] = await mapper(items[index], index); } catch { output[index] = null; }
    }
  });
  await Promise.all(workers);
  return output;
}

function closeWatchers() {
  for (const watcher of watchers) {
    try { watcher.close(); } catch { }
  }
  watchers = [];
}

function scheduleWatchedRebuild() {
  if (watcherTimer) clearTimeout(watcherTimer);
  watcherTimer = setTimeout(() => {
    watcherTimer = null;
    void queueRebuild();
  }, 450);
}

function watchDirectories(sourceRoots, directories) {
  closeWatchers();
  const recursiveSupported = ['win32', 'darwin', 'linux'].includes(process.platform);
  const recursivelyWatchedRoots = new Set();

  if (recursiveSupported) {
    for (const target of sourceRoots) {
      try {
        const watcher = watchFileSystem(target, { recursive: true }, scheduleWatchedRebuild);
        watcher.on('error', () => { });
        watcher.unref?.();
        watchers.push(watcher);
        recursivelyWatchedRoots.add(normalizeComparisonPath(target));
      } catch { }
    }
  }

  const fallbackTargets = directories
    .filter((directoryPath) => ![...recursivelyWatchedRoots].some((rootPath) => (
      isWithinPath(normalizeComparisonPath(directoryPath), rootPath)
    )))
    .slice(0, MAX_FALLBACK_WATCHERS);
  for (const target of fallbackTargets) {
    try {
      const watcher = watchFileSystem(target, { recursive: false }, scheduleWatchedRebuild);
      watcher.on('error', () => { });
      watcher.unref?.();
      watchers.push(watcher);
    } catch { }
  }
}

async function performRebuild() {
  const generation = ++rebuildGeneration;
  const sourceRoots = roots.slice();
  beginIndexingActivity();
  if (indexingHoldCount > 0) indexingHoldHadRebuild = true;

  try {
    const availableRoots = [];
    for (const rootPath of sourceRoots) {
      if (await pathIsDirectory(rootPath)) availableRoots.push(rootPath);
    }
    const { candidates, directories, truncated: fileLimitReached } = await collectCandidates(availableRoots);
    const measuredCandidates = await statCandidates(candidates);
    const rootTotals = new Map(availableRoots.map((rootPath) => [
      normalizeComparisonPath(rootPath),
      { fileCount: 0, sourceBytes: 0 },
    ]));
    for (const candidate of measuredCandidates) {
      const key = normalizeComparisonPath(candidate.rootPath);
      const total = rootTotals.get(key) || { fileCount: 0, sourceBytes: 0 };
      total.fileCount += 1;
      total.sourceBytes += candidate.stat.size;
      rootTotals.set(key, total);
    }

    const nextRootIssues = new Map();
    for (const rootPath of availableRoots) {
      const total = rootTotals.get(normalizeComparisonPath(rootPath));
      const limitError = getFileNavigatorRootLimitError(total);
      if (limitError) nextRootIssues.set(normalizeComparisonPath(rootPath), limitError);
    }
    rootIssues = nextRootIssues;
    const eligibleCandidates = measuredCandidates.filter((candidate) => (
      !rootIssues.has(normalizeComparisonPath(candidate.rootPath))
    ));
    const previous = records;
    const contentByteLimit = Math.min(MAX_INDEX_TEXT_BYTES, await getActiveLyricImportByteLimit());
    const contentBudget = createContentBudget(availableRoots);
    const nextItems = await mapWithConcurrency(eligibleCandidates, 16, async (candidate, index) => {
      if (generation !== rebuildGeneration) return null;
      const previousRecord = previous.get(normalizeComparisonPath(candidate.filePath));
      const next = await createRecord(candidate, previousRecord, contentByteLimit, contentBudget);
      if ((index + 1) % 250 === 0) {
        status = { ...status, scannedFiles: index + 1 };
        broadcast();
      }
      return next;
    });
    if (generation !== rebuildGeneration) return;

    const nextRecords = new Map(nextItems
      .filter(Boolean)
      .map((record) => [normalizeComparisonPath(record.filePath), record]));
    records = nextRecords;
    persistRecords(nextRecords);
    watchDirectories(availableRoots, directories);
    status = {
      scanning: rebuildRequested || indexingHoldCount > 0,
      scanId: status.scanId,
      indexedFiles: records.size,
      scannedFiles: measuredCandidates.length,
      truncated: fileLimitReached || rootIssues.size > 0,
      contentTruncated: contentBudget.truncated,
      limitedRoots: [...rootIssues.keys()],
      lastIndexedAt: Date.now(),
      error: null,
    };
  } catch (error) {
    status = {
      ...status,
      scanning: rebuildRequested || indexingHoldCount > 0,
      error: error?.message || 'Could not index lyric folders',
    };
  }
  // A queued pass is part of the same indexing transaction. Do not announce a
  // false completion between passes or renderers will briefly expose stale data.
  if (!rebuildRequested && indexingHoldCount === 0) broadcast();
}

async function queueRebuild() {
  if (rebuildPromise) {
    rebuildRequested = true;
    return rebuildPromise;
  }
  rebuildPromise = (async () => {
    do {
      rebuildRequested = false;
      await performRebuild();
    } while (rebuildRequested);
  })().finally(() => {
    rebuildPromise = null;
  });
  return rebuildPromise;
}

async function initialize() {
  await loadConfig();
  await addAutomaticImportRoots();
  await openDatabase();
  loadCachedRecords();
  void queueRebuild();
}

async function ensureInitialized() {
  if (!initializedPromise) initializedPromise = initialize();
  await initializedPromise;
}

function publicRecord(record, { query = '', matchedField = null } = {}) {
  return {
    kind: 'file',
    filePath: record.filePath,
    rootPath: record.rootPath,
    fileName: record.fileName,
    fileType: record.fileType,
    relativePath: record.relativePath,
    parentPath: record.parentPath,
    size: record.size,
    modifiedMs: record.modifiedMs,
    previewAvailable: record.fileType === 'txt' || record.fileType === 'lrc',
    matchedField,
    matchSnippet: matchedField === 'content'
      ? createNavigatorMatchSnippet(record.contentText, query, record.fileType)
      : '',
  };
}

async function describeRoots() {
  return Promise.all(roots.map(async (rootPath) => {
    const issue = rootIssues.get(normalizeComparisonPath(rootPath)) || null;
    return {
      path: rootPath,
      name: path.basename(rootPath) || rootPath,
      available: await pathIsDirectory(rootPath),
      indexable: !issue,
      issue,
    };
  }));
}

async function recentEntries() {
  const recentPaths = await getRecents();
  return Promise.all(recentPaths.map(async (filePath) => {
    const normalized = normalizeLyricPath(filePath);
    const cached = normalized ? records.get(normalizeComparisonPath(normalized)) : null;
    if (cached) return { ...publicRecord(cached), recent: true };
    const format = normalized ? getLyricImportFormatForName(normalized) : null;
    if (!normalized || !format) return null;
    try {
      const fileStat = await fs.stat(normalized);
      if (!fileStat.isFile()) throw new Error('not a file');
      return {
        kind: 'file',
        filePath: normalized,
        rootPath: rootForPath(normalized),
        fileName: path.basename(normalized),
        fileType: format.fileType,
        relativePath: rootForPath(normalized)
          ? path.relative(rootForPath(normalized), normalized)
          : normalized,
        parentPath: path.dirname(normalized),
        size: fileStat.size,
        modifiedMs: fileStat.mtimeMs,
        previewAvailable: format.fileType === 'txt' || format.fileType === 'lrc',
        recent: true,
        missing: false,
      };
    } catch {
      return {
        kind: 'file',
        filePath: normalized,
        rootPath: null,
        fileName: path.basename(normalized),
        fileType: format.fileType,
        relativePath: normalized,
        parentPath: path.dirname(normalized),
        size: 0,
        modifiedMs: 0,
        previewAvailable: false,
        recent: true,
        missing: true,
      };
    }
  })).then((items) => items.filter(Boolean));
}

export async function getFileNavigatorState() {
  await ensureInitialized();
  return {
    roots: await describeRoots(),
    recents: await recentEntries(),
    status: { ...status, indexedFiles: records.size },
    limits: { ...FILE_NAVIGATOR_LIMITS },
  };
}

export async function getFileNavigatorSaveDestinations(preferredDirectory = null) {
  await ensureInitialized();
  const destinations = [];
  const seen = new Set();

  if (preferredDirectory) {
    try {
      const preferred = await resolveDirectoryWithinRoots(preferredDirectory);
      const key = normalizeComparisonPath(preferred.directoryPath);
      seen.add(key);
      destinations.push({
        path: preferred.directoryPath,
        name: path.basename(preferred.directoryPath) || preferred.directoryPath,
        detail: 'Current song folder',
        available: true,
        preferred: true,
      });
    } catch { }
  }

  for (const root of await describeRoots()) {
    const key = normalizeComparisonPath(root.path);
    if (seen.has(key)) continue;
    seen.add(key);
    destinations.push({
      ...root,
      detail: 'Indexed lyrics folder',
      preferred: false,
    });
  }

  return destinations;
}

async function addFileNavigatorRootsUnlocked(rootPaths) {
  const allRequested = (Array.isArray(rootPaths) ? rootPaths : [rootPaths])
    .filter((entry) => typeof entry === 'string' && entry.trim());
  if (allRequested.length === 0) throw new Error('No folders were selected');
  const requestProcessingLimit = FILE_NAVIGATOR_LIMITS.maxRoots * 2;
  const requested = allRequested.slice(0, requestProcessingLimit);

  const skipped = allRequested.slice(requestProcessingLimit).map((selectedPath) => ({
    path: selectedPath,
    name: path.basename(selectedPath) || selectedPath,
    reason: `Only ${requestProcessingLimit} folders can be evaluated at once.`,
  }));
  const resolvedSelections = [];
  const resolvedKeys = new Set();

  try {
    for (const selectedPath of requested) {
      const normalized = normalizeLyricPath(selectedPath);
      if (!normalized || !await pathIsDirectory(normalized)) {
        skipped.push({
          path: selectedPath,
          name: path.basename(selectedPath) || selectedPath,
          reason: 'Folder is not available.',
        });
        continue;
      }
      try {
        const realRoot = await fs.realpath(normalized);
        const key = normalizeComparisonPath(realRoot);
        if (resolvedKeys.has(key)) continue;
        resolvedKeys.add(key);
        resolvedSelections.push({ path: realRoot, key });
      } catch {
        skipped.push({
          path: selectedPath,
          name: path.basename(selectedPath) || selectedPath,
          reason: 'Folder could not be accessed.',
        });
      }
    }

    // Parents are evaluated first so selecting both a parent and one of its
    // children produces one focused source regardless of picker ordering.
    resolvedSelections.sort((a, b) => (
      a.path.length - b.path.length || naturalCollator.compare(a.path, b.path)
    ));

    let nextRoots = roots.slice();
    const addedPaths = [];
    for (const selection of resolvedSelections) {
      const coveredBy = nextRoots.find((entry) => (
        isWithinPath(selection.key, normalizeComparisonPath(entry))
      ));
      if (coveredBy) {
        skipped.push({
          path: selection.path,
          name: path.basename(selection.path) || selection.path,
          reason: normalizeComparisonPath(coveredBy) === selection.key
            ? 'Folder is already indexed.'
            : 'Folder is already covered by an indexed parent folder.',
        });
        continue;
      }

      const retainedRoots = nextRoots.filter((entry) => (
        !isWithinPath(normalizeComparisonPath(entry), selection.key)
      ));
      if (retainedRoots.length >= FILE_NAVIGATOR_LIMITS.maxRoots) {
        skipped.push({
          path: selection.path,
          name: path.basename(selection.path) || selection.path,
          reason: `The ${FILE_NAVIGATOR_LIMITS.maxRoots}-folder indexing limit was reached.`,
        });
        continue;
      }

      const inspection = await inspectRootLimits(selection.path);
      if (inspection.error) {
        skipped.push({
          path: selection.path,
          name: path.basename(selection.path) || selection.path,
          reason: inspection.error,
        });
        continue;
      }

      nextRoots = [...retainedRoots, selection.path];
      addedPaths.push(selection.path);
    }

    if (addedPaths.length > 0) {
      roots = nextRoots;
      for (const addedPath of addedPaths) {
        rootIssues.delete(normalizeComparisonPath(addedPath));
      }
      await persistConfig();
      await queueRebuild();
    } else if (rebuildPromise) {
      await rebuildPromise;
    }

    return {
      selection: {
        requestedCount: allRequested.length,
        addedCount: addedPaths.length,
        addedPaths,
        skipped,
      },
    };
  } catch (error) {
    throw error;
  }
}

export async function addFileNavigatorRoots(rootPaths) {
  await ensureInitialized();
  const releaseIndexingHold = acquireIndexingHold();
  return withRootMutationLock(async () => {
    try {
      const result = await addFileNavigatorRootsUnlocked(rootPaths);
      releaseIndexingHold();
      return { ...(await getFileNavigatorState()), ...result };
    } catch (error) {
      releaseIndexingHold(error);
      throw error;
    }
  });
}

export async function addFileNavigatorRoot(rootPath) {
  return addFileNavigatorRoots([rootPath]);
}

export async function createFileNavigatorLyricsFolder() {
  const documentsPath = app.getPath('documents');
  const appDocumentsPath = path.join(documentsPath, 'LyricDisplay');
  const lyricsFolderPath = path.join(appDocumentsPath, 'Lyrics');
  await ensureNavigatorDirectory(documentsPath, 'Your Documents folder');
  await ensureNavigatorDirectory(appDocumentsPath, 'The LyricDisplay Documents folder');
  const folderCreated = await ensureNavigatorDirectory(lyricsFolderPath, 'The Lyrics folder');
  const resolvedLyricsFolderPath = await fs.realpath(lyricsFolderPath);
  const result = await addFileNavigatorRoots([resolvedLyricsFolderPath]);
  const indexedRoot = rootForPath(resolvedLyricsFolderPath);
  const indexedRootIssue = indexedRoot
    ? rootIssues.get(normalizeComparisonPath(indexedRoot))
    : null;
  if (!indexedRoot || indexedRootIssue) {
    const reason = result.selection?.skipped?.find((entry) => (
      normalizeComparisonPath(entry.path) === normalizeComparisonPath(resolvedLyricsFolderPath)
    ))?.reason || indexedRootIssue;
    throw new Error(folderCreated
      ? `The Lyrics folder was created but could not be indexed. ${reason || 'Add it from Preferences after resolving the folder issue.'}`
      : `The existing Lyrics folder could not be indexed. ${reason || 'Resolve the folder issue and try again.'}`);
  }
  return {
    ...result,
    createdFolderPath: resolvedLyricsFolderPath,
    folderCreated,
  };
}

export async function removeFileNavigatorRoot(rootPath) {
  await ensureInitialized();
  const releaseIndexingHold = acquireIndexingHold();
  return withRootMutationLock(async () => {
    try {
      const normalized = normalizeComparisonPath(normalizeLyricPath(rootPath));
      roots = roots.filter((entry) => normalizeComparisonPath(entry) !== normalized);
      rootIssues.delete(normalized);
      records = new Map([...records.entries()].filter(([, record]) => rootForPath(record.filePath)));
      await persistConfig();
      await queueRebuild();
      releaseIndexingHold();
      return getFileNavigatorState();
    } catch (error) {
      releaseIndexingHold(error);
      throw error;
    }
  });
}

export async function rebuildFileNavigatorIndex() {
  await ensureInitialized();
  await queueRebuild();
  return getFileNavigatorState();
}

export async function searchFileNavigator({ query = '', fileTypes = [], limit = 80 } = {}) {
  await ensureInitialized();
  const parsed = parseFileNavigatorQuery(query);
  const queryHadTypeFilters = parsed.fileTypes.length > 0;
  const requestedTypes = [...new Set((Array.isArray(fileTypes) ? fileTypes : [])
    .map((value) => String(value || '').toLowerCase())
    .filter((value) => ['txt', 'lrc', 'md', 'rtf', 'docx'].includes(value)))];
  if (requestedTypes.length > 0) {
    parsed.fileTypes = parsed.fileTypes.length > 0
      ? parsed.fileTypes.filter((value) => requestedTypes.includes(value))
      : requestedTypes;
  }
  if (queryHadTypeFilters && requestedTypes.length > 0 && parsed.fileTypes.length === 0) return [];

  const scored = [];
  for (const record of records.values()) {
    if (!parsed.terms.length) {
      if (parsed.fileTypes.length > 0 && !parsed.fileTypes.includes(record.fileType)) continue;
      scored.push({ record, score: 0, matchedField: null });
    } else {
      const match = scoreNavigatorSearchRecord(record, parsed);
      if (!match) continue;
      scored.push({ record, ...match });
    }
  }
  scored.sort((a, b) => (
    b.score - a.score
    || (parsed.terms.length ? b.record.modifiedMs - a.record.modifiedMs : 0)
    || naturalCollator.compare(a.record.fileName, b.record.fileName)
  ));
  const safeLimit = Math.max(1, Math.min(MAX_SEARCH_RESULTS, Number(limit) || 80));
  return scored.slice(0, safeLimit).map(({ record, matchedField }) => (
    publicRecord(record, { query, matchedField })
  ));
}

async function resolveDirectoryWithinRoots(directoryPath) {
  const normalized = normalizeLyricPath(directoryPath);
  if (!normalized) throw new Error('Invalid folder path');
  const realDirectory = await fs.realpath(normalized);
  const matchingRoot = rootForPath(realDirectory);
  if (!matchingRoot) throw new Error('Folder is outside indexed sources');
  const directoryStat = await fs.stat(realDirectory);
  if (!directoryStat.isDirectory()) throw new Error('Path is not a folder');
  return { directoryPath: realDirectory, rootPath: matchingRoot };
}

export async function browseFileNavigator(directoryPath) {
  await ensureInitialized();
  const resolved = await resolveDirectoryWithinRoots(directoryPath);
  const entries = await fs.readdir(resolved.directoryPath, { withFileTypes: true });
  const items = [];
  const contentByteLimit = Math.min(MAX_INDEX_TEXT_BYTES, await getActiveLyricImportByteLimit());

  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const entryPath = path.join(resolved.directoryPath, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name.toLowerCase())) continue;
      items.push({
        kind: 'folder',
        filePath: entryPath,
        rootPath: resolved.rootPath,
        fileName: entry.name,
        relativePath: path.relative(resolved.rootPath, entryPath),
        parentPath: resolved.directoryPath,
      });
      continue;
    }
    if (!entry.isFile() || !isSupportedLyricsImportFile(entry.name)) continue;
    const cached = records.get(normalizeComparisonPath(entryPath));
    if (cached) {
      items.push(publicRecord(cached));
      continue;
    }
    try {
      const metadataOnlyBudget = createContentBudget([resolved.rootPath]);
      metadataOnlyBudget.remainingTotal = 0;
      metadataOnlyBudget.remainingByRoot.set(normalizeComparisonPath(resolved.rootPath), 0);
      const next = await createRecord(
        { filePath: entryPath, rootPath: resolved.rootPath },
        null,
        contentByteLimit,
        metadataOnlyBudget
      );
      if (next) items.push(publicRecord(next));
    } catch { }
  }

  items.sort((a, b) => (
    (a.kind === b.kind ? 0 : a.kind === 'folder' ? -1 : 1)
    || naturalCollator.compare(a.fileName, b.fileName)
  ));

  return {
    directoryPath: resolved.directoryPath,
    rootPath: resolved.rootPath,
    parentPath: normalizeComparisonPath(resolved.directoryPath) === normalizeComparisonPath(resolved.rootPath)
      ? null
      : path.dirname(resolved.directoryPath),
    items,
  };
}

export async function prepareFileNavigatorSave({
  directoryPath,
  fileName,
  extension,
  overwrite = false,
} = {}) {
  await ensureInitialized();
  const resolved = await resolveDirectoryWithinRoots(directoryPath);
  const validatedName = validateNavigatorSaveName(fileName, extension);
  if (!validatedName.valid) throw new Error(validatedName.error);

  const targetPath = path.join(resolved.directoryPath, validatedName.fileName);
  if (!isWithinPath(
    normalizeComparisonPath(targetPath),
    normalizeComparisonPath(resolved.directoryPath)
  )) {
    throw new Error('Invalid save destination');
  }

  let exists = false;
  try {
    const targetStat = await fs.lstat(targetPath);
    exists = true;
    if (targetStat.isSymbolicLink()) throw new Error('Symbolic-link destinations cannot be replaced');
    if (!targetStat.isFile()) throw new Error('A folder already uses that name');
    const realTarget = await fs.realpath(targetPath);
    if (!rootForPath(realTarget)) throw new Error('Save destination is outside indexed sources');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  if (!exists || overwrite === true) {
    grantLyricWritePath(targetPath, {
      collisionPolicy: overwrite === true ? 'replace' : 'create',
    });
  }

  return {
    directoryPath: resolved.directoryPath,
    filePath: targetPath,
    fileName: validatedName.fileName,
    baseName: validatedName.baseName,
    extension: validatedName.extension,
    exists,
    writeGranted: !exists || overwrite === true,
  };
}

async function resolveFileWithinRoots(filePath) {
  const normalized = normalizeLyricPath(filePath);
  if (!normalized || !isSupportedLyricsImportFile(normalized)) {
    throw new Error('Unsupported lyric file');
  }
  const realFilePath = await fs.realpath(normalized);
  if (!rootForPath(realFilePath)) {
    const recentPaths = (await getRecents()).map((entry) => normalizeComparisonPath(normalizeLyricPath(entry)));
    if (
      !recentPaths.includes(normalizeComparisonPath(normalized))
      && !recentPaths.includes(normalizeComparisonPath(realFilePath))
    ) {
      throw new Error('File is outside indexed sources');
    }
  }
  const fileStat = await fs.stat(realFilePath);
  if (!fileStat.isFile()) throw new Error('Lyrics path is not a file');
  return realFilePath;
}

export async function resolveFileNavigatorSelection(filePath) {
  await ensureInitialized();
  return resolveFileWithinRoots(filePath);
}

export async function getFileNavigatorPreview(filePath) {
  await ensureInitialized();
  const resolved = await resolveFileWithinRoots(filePath);
  const format = getLyricImportFormatForName(resolved);
  if (!format || (format.fileType !== 'txt' && format.fileType !== 'lrc')) {
    return { available: false, content: '' };
  }
  const fileStat = await fs.stat(resolved);
  if (fileStat.size > Math.min(MAX_INDEX_TEXT_BYTES, await getActiveLyricImportByteLimit())) {
    return { available: false, content: '', reason: 'File is too large to preview' };
  }
  const cached = records.get(normalizeComparisonPath(resolved));
  const content = cached?.contentText || await fs.readFile(resolved, 'utf8');
  return {
    available: true,
    content: createNavigatorPreview(content, format.fileType),
    truncated: content.length > 20_000,
  };
}

export async function refreshFileInNavigator(filePath) {
  if (!initializedPromise) return false;
  await ensureInitialized();
  const normalized = normalizeLyricPath(filePath);
  const sourceRoot = normalized ? rootForPath(normalized) : null;
  if (!normalized || !sourceRoot || !isSupportedLyricsImportFile(normalized)) return false;
  if (rootIssues.has(normalizeComparisonPath(sourceRoot))) return false;
  const key = normalizeComparisonPath(normalized);
  try {
    const contentByteLimit = Math.min(MAX_INDEX_TEXT_BYTES, await getActiveLyricImportByteLimit());
    const contentBudget = createContentBudget();
    for (const [recordKey, record] of records) {
      if (recordKey === key || !record.contentText) continue;
      reserveContentBytes(
        contentBudget,
        record.rootPath,
        Buffer.byteLength(record.contentText, 'utf8')
      );
    }
    const next = await createRecord(
      { filePath: normalized, rootPath: sourceRoot },
      null,
      contentByteLimit,
      contentBudget
    );
    if (!next) return false;
    records.set(key, next);
    persistSingleRecord(next);
    status = {
      ...status,
      indexedFiles: records.size,
      contentTruncated: contentBudget.truncated,
    };
    broadcast({ changedFilePath: normalized });
    return true;
  } catch {
    records.delete(key);
    try { database?.prepare('DELETE FROM navigator_files WHERE filePath = ?').run(normalized); } catch { }
    status = { ...status, indexedFiles: records.size };
    broadcast({ changedFilePath: normalized });
    return false;
  }
}

export function cleanupFileNavigator() {
  if (watcherTimer) clearTimeout(watcherTimer);
  watcherTimer = null;
  closeWatchers();
  try { database?.close(); } catch { }
  database = null;
}
