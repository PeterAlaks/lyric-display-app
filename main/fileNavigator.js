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
  getActiveLyricImportByteLimit,
  grantLyricWritePath,
  normalizeLyricPath,
} from './lyricFiles.js';
import { getLastOpenedDirectory, getRecents } from './recents.js';
import * as userPreferences from './userPreferences.js';

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
let status = {
  scanning: false,
  indexedFiles: 0,
  scannedFiles: 0,
  truncated: false,
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

function broadcast(payload = {}) {
  const next = { ...status, ...payload };
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win || win.isDestroyed()) continue;
    try { win.webContents.send('file-navigator:update', next); } catch { }
  }
}

async function pathIsDirectory(candidate) {
  try {
    return (await fs.stat(candidate)).isDirectory();
  } catch {
    return false;
  }
}

async function persistConfig() {
  const payload = JSON.stringify({
    version: CONFIG_VERSION,
    initialized: true,
    roots,
  }, null, 2);
  await fs.writeFile(getConfigPath(), payload, 'utf8');
}

async function loadConfig() {
  let parsed = null;
  try {
    parsed = JSON.parse(await fs.readFile(getConfigPath(), 'utf8'));
  } catch { }

  if (parsed?.initialized === true && Array.isArray(parsed.roots)) {
    roots = [...new Set(parsed.roots
      .map((entry) => normalizeLyricPath(entry))
      .filter(Boolean))];
    return;
  }

  const rememberLastPath = userPreferences.getPreference('fileHandling.rememberLastOpenedPath') ?? true;
  const configuredPath = normalizeLyricPath(
    userPreferences.getPreference('fileHandling.defaultLyricsPath') || ''
  );
  const lastOpenedDirectory = rememberLastPath
    ? normalizeLyricPath(await getLastOpenedDirectory())
    : null;
  const seed = lastOpenedDirectory || configuredPath;
  roots = seed && await pathIsDirectory(seed) ? [seed] : [];
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
    const cached = database.prepare('SELECT * FROM navigator_files').all();
    records = new Map(cached
      .filter((record) => rootForPath(record.filePath))
      .map((record) => [normalizeComparisonPath(record.filePath), hydrateRecord(record)]));
    status = { ...status, indexedFiles: records.size };
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

async function collectCandidates(sourceRoots) {
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
        if (candidates.length >= MAX_INDEX_FILES) {
          truncated = true;
          break;
        }
      }
    }
    if (truncated) break;
  }

  return { candidates, directories, truncated };
}

async function createRecord(candidate, previousRecord = null, contentByteLimit = MAX_INDEX_TEXT_BYTES) {
  const fileStat = await fs.stat(candidate.filePath);
  if (!fileStat.isFile()) return null;
  if (
    previousRecord
    && previousRecord.size === fileStat.size
    && previousRecord.modifiedMs === fileStat.mtimeMs
    && previousRecord.rootPath === candidate.rootPath
  ) {
    return previousRecord;
  }

  const format = getLyricImportFormatForName(candidate.filePath);
  if (!format) return null;
  let contentText = '';
  if (
    (format.fileType === 'txt' || format.fileType === 'lrc')
    && fileStat.size <= contentByteLimit
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
  status = { ...status, scanning: true, scannedFiles: 0, error: null };
  broadcast();

  try {
    const availableRoots = [];
    for (const rootPath of sourceRoots) {
      if (await pathIsDirectory(rootPath)) availableRoots.push(rootPath);
    }
    const { candidates, directories, truncated } = await collectCandidates(availableRoots);
    const previous = records;
    const contentByteLimit = Math.min(MAX_INDEX_TEXT_BYTES, await getActiveLyricImportByteLimit());
    const nextItems = await mapWithConcurrency(candidates, 16, async (candidate, index) => {
      if (generation !== rebuildGeneration) return null;
      const previousRecord = previous.get(normalizeComparisonPath(candidate.filePath));
      const next = await createRecord(candidate, previousRecord, contentByteLimit);
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
      scanning: false,
      indexedFiles: records.size,
      scannedFiles: candidates.length,
      truncated,
      lastIndexedAt: Date.now(),
      error: null,
    };
  } catch (error) {
    status = {
      ...status,
      scanning: false,
      error: error?.message || 'Could not index lyric folders',
    };
  }
  broadcast();
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
  return Promise.all(roots.map(async (rootPath) => ({
    path: rootPath,
    name: path.basename(rootPath) || rootPath,
    available: await pathIsDirectory(rootPath),
  })));
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

export async function addFileNavigatorRoot(rootPath) {
  await ensureInitialized();
  const normalized = normalizeLyricPath(rootPath);
  if (!normalized || !await pathIsDirectory(normalized)) {
    throw new Error('Selected folder is not available');
  }

  const realRoot = await fs.realpath(normalized);
  const comparisonRoot = normalizeComparisonPath(realRoot);
  if (roots.some((entry) => isWithinPath(comparisonRoot, normalizeComparisonPath(entry)))) {
    return getFileNavigatorState();
  }
  roots = roots.filter((entry) => !isWithinPath(normalizeComparisonPath(entry), comparisonRoot));
  roots.push(realRoot);
  await persistConfig();
  void queueRebuild();
  return getFileNavigatorState();
}

export async function removeFileNavigatorRoot(rootPath) {
  await ensureInitialized();
  const normalized = normalizeComparisonPath(normalizeLyricPath(rootPath));
  roots = roots.filter((entry) => normalizeComparisonPath(entry) !== normalized);
  records = new Map([...records.entries()].filter(([, record]) => rootForPath(record.filePath)));
  await persistConfig();
  void queueRebuild();
  broadcast();
  return getFileNavigatorState();
}

export async function rebuildFileNavigatorIndex() {
  await ensureInitialized();
  void queueRebuild();
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
      const next = await createRecord(
        { filePath: entryPath, rootPath: resolved.rootPath },
        null,
        contentByteLimit
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

  if (!exists || overwrite === true) grantLyricWritePath(targetPath);

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
  const key = normalizeComparisonPath(normalized);
  try {
    const contentByteLimit = Math.min(MAX_INDEX_TEXT_BYTES, await getActiveLyricImportByteLimit());
    const next = await createRecord(
      { filePath: normalized, rootPath: sourceRoot },
      null,
      contentByteLimit
    );
    if (!next) return false;
    records.set(key, next);
    persistSingleRecord(next);
    status = { ...status, indexedFiles: records.size };
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
