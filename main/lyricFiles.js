import path from 'path';
import { readFile, stat, writeFile } from 'fs/promises';
import { createLdsongFromImportedText, extractLyricTextFromSource } from '../shared/documentTextExtraction.js';
import { isLdsongContent } from '../shared/lyricsParsing/ldsong.js';
import { extractSongMetadataHeader } from '../shared/lyricsParsing/songMetadata.js';
import {
  getLyricImportFormatForName,
  normalizeLyricFileType,
} from '../shared/lyricImportRegistry.js';
import {
  assertLyricImportSize,
  getConfiguredLyricImportByteLimit,
} from '../shared/lyricImportLimits.js';

const ALLOWED_WRITE_EXTENSIONS = new Set(['.ldsong', '.txt', '.lrc', '.ldsch']);
const MAX_WRITE_CONTENT_BYTES = 10 * 1024 * 1024;
const writeGrantPaths = new Map();

export async function getActiveLyricImportByteLimit() {
  try {
    const userPreferences = await import('./userPreferences.js');
    return getConfiguredLyricImportByteLimit(
      userPreferences.getPreference('fileHandling.maxFileSize')
    );
  } catch {
    return getConfiguredLyricImportByteLimit();
  }
}

export function normalizeLyricPath(filePath) {
  if (typeof filePath !== 'string' || !filePath.trim()) return null;
  const resolved = path.resolve(filePath.trim());
  return path.isAbsolute(resolved) ? resolved : null;
}

export async function validateLyricImportPath(filePath, expectedFileType = null) {
  const normalized = normalizeLyricPath(filePath);
  const format = normalized ? getLyricImportFormatForName(normalized) : null;
  if (!normalized || !format) throw new Error('Unsupported lyric file type');
  if (expectedFileType && format.fileType !== expectedFileType) {
    throw new Error('Lyric file type does not match its extension');
  }

  const fileStat = await stat(normalized);
  if (!fileStat.isFile()) throw new Error('Selected lyric path is not a file');
  assertLyricImportSize(fileStat.size, await getActiveLyricImportByteLimit());
  return { normalized, fileType: format.fileType, stat: fileStat };
}

export function grantLyricWritePath(filePath, { collisionPolicy = 'replace' } = {}) {
  const normalized = normalizeLyricPath(filePath);
  if (normalized) {
    const grantedPolicies = writeGrantPaths.get(normalized) || new Set();
    grantedPolicies.add(collisionPolicy === 'create' ? 'create' : 'replace');
    writeGrantPaths.set(normalized, grantedPolicies);
  }
  return normalized;
}

export function validateLyricWrite(filePath, content, { collisionPolicy = 'replace' } = {}) {
  const normalized = normalizeLyricPath(filePath);
  if (!normalized) return { valid: false, error: 'Invalid file path' };

  const extension = path.extname(normalized).toLowerCase();
  if (!ALLOWED_WRITE_EXTENSIONS.has(extension)) {
    return { valid: false, error: 'Only .ldsong, .txt, .lrc, and .ldsch files can be written here' };
  }
  const normalizedPolicy = collisionPolicy === 'create' ? 'create' : 'replace';
  if (!writeGrantPaths.get(normalized)?.has(normalizedPolicy)) {
    return {
      valid: false,
      error: normalizedPolicy === 'replace'
        ? 'File replacement was not confirmed by a LyricDisplay file workflow'
        : 'File creation was not granted by a LyricDisplay file workflow',
    };
  }
  if (typeof content !== 'string') {
    return { valid: false, error: 'File content must be text' };
  }
  if (Buffer.byteLength(content, 'utf8') > MAX_WRITE_CONTENT_BYTES) {
    return { valid: false, error: 'File content is too large' };
  }

  return { valid: true, normalized };
}

export async function readLyricsFileFromPath(filePath, {
  expectedFileType = null,
  remember = true,
  grantWrite = true,
} = {}) {
  const validated = await validateLyricImportPath(filePath, expectedFileType);
  const fileName = path.basename(validated.normalized);
  const fileType = normalizeLyricFileType({
    fileType: validated.fileType,
    fileName,
  });
  const content = await extractLyricTextFromSource({
    fileType,
    fileName,
    path: validated.normalized,
    readFile,
  });

  if (grantWrite) grantLyricWritePath(validated.normalized);
  if (remember) {
    try {
      const { addRecent } = await import('./recents.js');
      await addRecent(validated.normalized);
    } catch { }
  }

  return {
    content,
    fileName,
    filePath: validated.normalized,
    fileType,
  };
}

/**
 * Write a structured .ldsong copy of a plain-text song beside it. The original is never
 * changed, and an existing .ldsong of the same name is never overwritten.
 * @returns {Promise<{ status: 'converted' | 'skipped', reason?: string, sourcePath: string, targetPath?: string }>}
 */
export async function convertTextSongFileToLdsong(filePath, {
  parsingOptions = {},
  groupingPlan = null,
  convertedOn = null,
} = {}) {
  const sourcePath = normalizeLyricPath(filePath);
  if (!sourcePath || path.extname(sourcePath).toLowerCase() !== '.txt') {
    return { status: 'skipped', reason: 'unsupported', sourcePath: sourcePath || String(filePath || '') };
  }

  const targetPath = path.join(path.dirname(sourcePath), `${path.basename(sourcePath, path.extname(sourcePath))}.ldsong`);
  const fileStat = await stat(sourcePath);
  assertLyricImportSize(fileStat.size, await getActiveLyricImportByteLimit());
  const text = await readFile(sourcePath, 'utf8');
  if (isLdsongContent(text)) return { status: 'skipped', reason: 'structured', sourcePath };
  if (!text.trim()) return { status: 'skipped', reason: 'empty', sourcePath };

  const header = extractSongMetadataHeader(text).songMetadata || {};
  const content = createLdsongFromImportedText(text, {
    songMetadata: header.title ? {} : { title: path.basename(sourcePath, path.extname(sourcePath)) },
    provenance: { key: 'Converted from TXT', value: convertedOn || new Date().toISOString().split('T')[0] },
    parsingOptions: groupingPlan ? { ...parsingOptions, groupingPlan } : parsingOptions,
  });

  try {
    await writeFile(targetPath, content, { encoding: 'utf8', flag: 'wx' });
  } catch (error) {
    if (error?.code === 'EEXIST') return { status: 'skipped', reason: 'exists', sourcePath, targetPath };
    throw error;
  }
  return { status: 'converted', sourcePath, targetPath };
}
