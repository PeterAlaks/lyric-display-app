import path from 'path';
import { randomUUID } from 'crypto';
import {
  MAX_SETLIST_FILE_BYTES,
  hasSetlistExtension,
  normalizeSetlistPath,
  validateSetlistData,
} from './setlistValidation.js';

export const SETLIST_BACKUP_SUFFIX = '.bak';

function temporaryPathFor(filePath) {
  return `${filePath}.${process.pid}.${randomUUID()}.tmp`;
}

async function syncDirectoryBestEffort(fs, directoryPath) {
  let handle;
  try {
    handle = await fs.open(directoryPath, 'r');
    await handle.sync();
  } catch {
    // Directory fsync is unsupported on some platforms/filesystems.
  } finally {
    await handle?.close().catch(() => {});
  }
}

async function writeAtomicFile(fs, filePath, content) {
  const temporaryPath = temporaryPathFor(filePath);
  let handle;
  try {
    handle = await fs.open(temporaryPath, 'wx', 0o600);
    await handle.writeFile(content, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await fs.rename(temporaryPath, filePath);
    await syncDirectoryBestEffort(fs, path.dirname(filePath));
  } finally {
    await handle?.close().catch(() => {});
    await fs.rm(temporaryPath, { force: true }).catch(() => {});
  }
}

async function readSetlistCandidate(fs, filePath) {
  const stats = await fs.stat(filePath);
  if (!stats.isFile()) {
    throw new Error('Setlist path is not a file');
  }
  if (stats.size > MAX_SETLIST_FILE_BYTES) {
    throw new Error('Setlist file is too large');
  }

  const content = await fs.readFile(filePath, 'utf8');
  const parsed = JSON.parse(content);
  const validation = validateSetlistData(parsed);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  return { content, setlistData: validation.setlistData };
}

export async function saveSetlistFile(fs, filePath, setlistData) {
  const validation = validateSetlistData(setlistData);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const jsonContent = JSON.stringify(validation.setlistData, null, 2);
  if (Buffer.byteLength(jsonContent, 'utf8') > MAX_SETLIST_FILE_BYTES) {
    return { success: false, error: 'Setlist file is too large' };
  }

  const backupPath = `${filePath}${SETLIST_BACKUP_SUFFIX}`;
  try {
    const current = await readSetlistCandidate(fs, filePath);
    await writeAtomicFile(fs, backupPath, current.content);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      // Never replace a valid backup with unreadable or invalid current data.
      console.warn('[Setlist] Existing setlist was not eligible for backup:', error.message);
    }
  }

  await writeAtomicFile(fs, filePath, jsonContent);
  return { success: true, filePath, backupPath };
}

export async function readValidatedSetlistFile(fs, filePath) {
  const normalizedPath = normalizeSetlistPath(filePath);
  if (!normalizedPath || !hasSetlistExtension(normalizedPath)) {
    return { success: false, error: 'Only .ldset files can be loaded as setlists' };
  }

  let primaryError;
  try {
    const loaded = await readSetlistCandidate(fs, normalizedPath);
    return { success: true, setlistData: loaded.setlistData, filePath: normalizedPath };
  } catch (error) {
    primaryError = error;
  }

  const backupPath = `${normalizedPath}${SETLIST_BACKUP_SUFFIX}`;
  try {
    const recovered = await readSetlistCandidate(fs, backupPath);
    return {
      success: true,
      setlistData: recovered.setlistData,
      filePath: normalizedPath,
      backupPath,
      recoveredFromBackup: true,
      recoveryWarning: `The setlist could not be read (${primaryError.message}). LyricDisplay loaded its last-known-good backup. Save it again to repair the primary file.`,
    };
  } catch (backupError) {
    const backupDetail = backupError?.code === 'ENOENT'
      ? ''
      : ` The backup also failed: ${backupError.message}`;
    return { success: false, error: `${primaryError.message}.${backupDetail}`.trim() };
  }
}
