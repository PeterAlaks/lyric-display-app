import path from 'path';

export const LOG_RETENTION = Object.freeze({
  maxLogBytes: 10 * 1024 * 1024,
  maxRotatedLogs: 5,
  minProtectedSessions: 10,
  maxSessions: 30,
  maxDirectoryBytes: 500 * 1024 * 1024,
});

export const MANAGED_LOG_FILE_PATTERN = /^lyricdisplay-.+\.log(?:\.\d+)?$/;

export const getLogSessionPath = (filePath) => filePath.replace(/\.\d+$/, '');

const resolvePath = (filePath) => path.resolve(filePath);

const normalizeRetentionOptions = (options = {}) => ({
  maxSessions: Math.max(1, Number(options.maxSessions) || LOG_RETENTION.maxSessions),
  minProtectedSessions: Math.max(1, Number(options.minProtectedSessions) || LOG_RETENTION.minProtectedSessions),
  maxDirectoryBytes: Math.max(0, Number(options.maxDirectoryBytes) || LOG_RETENTION.maxDirectoryBytes),
});

const normalizeFiles = (files = []) => files
  .filter((file) => file?.filePath)
  .map((file) => {
    const filePath = String(file.filePath);
    const sessionPath = String(file.sessionPath || getLogSessionPath(filePath));
    const size = Math.max(0, Number(file.size) || 0);
    const mtimeMs = Number.isFinite(Number(file.mtimeMs)) ? Number(file.mtimeMs) : 0;

    return {
      ...file,
      filePath,
      sessionPath,
      resolvedFilePath: resolvePath(filePath),
      resolvedSessionPath: resolvePath(sessionPath),
      size,
      mtimeMs,
    };
  });

export function buildLogPrunePlan(files, options = {}) {
  const normalizedFiles = normalizeFiles(files);
  const {
    maxSessions,
    minProtectedSessions,
    maxDirectoryBytes,
  } = normalizeRetentionOptions(options);
  const preservedPaths = new Set(
    (options.preservePaths || [])
      .filter(Boolean)
      .map((filePath) => resolvePath(String(filePath)))
  );
  const preservedSessions = new Set();

  normalizedFiles.forEach((file) => {
    if (preservedPaths.has(file.resolvedFilePath) || preservedPaths.has(file.resolvedSessionPath)) {
      preservedSessions.add(file.resolvedSessionPath);
    }
  });

  const sessions = new Map();
  normalizedFiles.forEach((file) => {
    const previous = sessions.get(file.resolvedSessionPath);
    sessions.set(file.resolvedSessionPath, {
      sessionPath: file.sessionPath,
      resolvedSessionPath: file.resolvedSessionPath,
      latestMtimeMs: Math.max(previous?.latestMtimeMs || 0, file.mtimeMs),
    });
  });

  const newestSessions = [...sessions.values()]
    .sort((a, b) => b.latestMtimeMs - a.latestMtimeMs || a.sessionPath.localeCompare(b.sessionPath));
  const keptSessions = new Set([
    ...newestSessions.slice(0, maxSessions).map((session) => session.resolvedSessionPath),
    ...preservedSessions,
  ]);
  const protectedSessions = new Set([
    ...newestSessions
      .slice(0, Math.min(minProtectedSessions, maxSessions))
      .map((session) => session.resolvedSessionPath),
    ...preservedSessions,
  ]);
  const deletePaths = [];
  const deleted = new Set();

  const markForDeletion = (file) => {
    if (deleted.has(file.resolvedFilePath)) return false;
    if (preservedPaths.has(file.resolvedFilePath)) return false;
    if (protectedSessions.has(file.resolvedSessionPath)) return false;
    deleted.add(file.resolvedFilePath);
    deletePaths.push(file.filePath);
    return true;
  };

  normalizedFiles
    .filter((file) => !keptSessions.has(file.resolvedSessionPath))
    .forEach(markForDeletion);

  let remainingFiles = normalizedFiles.filter((file) => !deleted.has(file.resolvedFilePath));
  let totalBytes = remainingFiles.reduce((sum, file) => sum + file.size, 0);

  remainingFiles = remainingFiles
    .slice()
    .sort((a, b) => a.mtimeMs - b.mtimeMs || a.filePath.localeCompare(b.filePath));

  for (const file of remainingFiles) {
    if (totalBytes <= maxDirectoryBytes) break;
    if (markForDeletion(file)) {
      totalBytes -= file.size;
    }
  }

  return {
    deletePaths,
    stats: {
      totalFiles: normalizedFiles.length,
      totalSessions: sessions.size,
      deletedFiles: deletePaths.length,
      keptSessions: keptSessions.size,
      protectedSessions: protectedSessions.size,
      totalBytesBefore: normalizedFiles.reduce((sum, file) => sum + file.size, 0),
      totalBytesAfter: totalBytes,
      maxSessions,
      minProtectedSessions,
      maxDirectoryBytes,
    },
  };
}
