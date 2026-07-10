import { randomUUID } from 'node:crypto';
import {
  MAX_SETLIST_FILE_BYTES,
  MAX_SETLIST_ITEM_CONTENT_BYTES,
  MAX_SETLIST_ITEMS,
  MAX_SETLIST_STRING_LENGTH,
} from '../../shared/setlistLimits.js';
import {
  isSupportedLyricFileType,
  normalizeLyricFileType,
  stripLyricImportExtension,
} from '../../shared/lyricImportRegistry.js';
import { isPlainObject } from './utils.js';

const byteLength = (value) => Buffer.byteLength(value, 'utf8');

const normalizeComparableName = (value = '') => (
  stripLyricImportExtension(String(value).trim()).toLowerCase()
);

const validateSerializedSize = (value) => {
  try {
    return byteLength(JSON.stringify(value)) <= MAX_SETLIST_FILE_BYTES;
  } catch {
    return false;
  }
};

const validateInputFile = (file, index) => {
  if (!isPlainObject(file)) {
    return { valid: false, error: `File ${index + 1} is invalid` };
  }

  const name = typeof file.name === 'string' ? file.name.trim() : '';
  if (!name) {
    return { valid: false, error: `File ${index + 1} is missing a name` };
  }
  if (name.length > MAX_SETLIST_STRING_LENGTH) {
    return { valid: false, error: `File ${index + 1} name is too long` };
  }
  if (typeof file.content !== 'string' || !file.content) {
    return { valid: false, error: `File ${index + 1} is missing content` };
  }
  if (byteLength(file.content) > MAX_SETLIST_ITEM_CONTENT_BYTES) {
    return { valid: false, error: `File "${name}" content is too large` };
  }
  if (file.metadata != null && !isPlainObject(file.metadata)) {
    return { valid: false, error: `File "${name}" metadata is invalid` };
  }

  const fileType = normalizeLyricFileType({ fileType: file.fileType, fileName: name, fallback: 'txt' });
  if (!isSupportedLyricFileType(fileType)) {
    return { valid: false, error: `File "${name}" has an unsupported file type` };
  }

  return {
    valid: true,
    file: {
      name,
      content: file.content,
      fileType,
      lastModified: Number.isFinite(file.lastModified) ? file.lastModified : null,
      metadata: file.metadata || null,
    },
  };
};

export function normalizeIncomingSetlistFiles(files, { existingFiles = [], actor = {}, now = Date.now() } = {}) {
  if (!Array.isArray(files)) {
    return { valid: false, error: 'Invalid file data', entries: [] };
  }
  if (files.length === 0) {
    return { valid: false, error: 'Setlist must contain at least one file', entries: [] };
  }
  if (existingFiles.length + files.length > MAX_SETLIST_ITEMS) {
    return {
      valid: false,
      error: `Cannot store ${existingFiles.length + files.length} files. Maximum ${MAX_SETLIST_ITEMS} files allowed.`,
      entries: [],
    };
  }
  if (!validateSerializedSize(files)) {
    return { valid: false, error: 'Setlist payload is too large', entries: [] };
  }

  const knownNames = new Set(existingFiles.map((existing) => (
    normalizeComparableName(existing?.displayName ?? existing?.originalName ?? '')
  )).filter(Boolean));
  const entries = [];

  for (const [index, file] of files.entries()) {
    const validation = validateInputFile(file, index);
    if (!validation.valid) return { ...validation, entries: [] };

    const normalizedName = normalizeComparableName(validation.file.name);
    if (knownNames.has(normalizedName)) {
      return {
        valid: false,
        error: `File "${stripLyricImportExtension(validation.file.name)}" already exists in setlist`,
        entries: [],
      };
    }
    knownNames.add(normalizedName);

    entries.push({
      id: `setlist_${now}_${randomUUID()}`,
      displayName: stripLyricImportExtension(validation.file.name),
      originalName: validation.file.name,
      content: validation.file.content,
      lastModified: validation.file.lastModified || now,
      addedAt: now,
      fileType: validation.file.fileType,
      metadata: validation.file.metadata,
      addedBy: {
        clientType: actor.clientType || null,
        deviceId: actor.deviceId || null,
        sessionId: actor.sessionId || null,
      },
    });
  }

  return { valid: true, entries };
}

export function validatePersistedSetlistFiles(files) {
  if (!Array.isArray(files) || files.length > MAX_SETLIST_ITEMS || !validateSerializedSize(files)) {
    return { valid: false, files: [] };
  }

  const normalized = [];
  const ids = new Set();
  for (const file of files) {
    if (!isPlainObject(file)
      || typeof file.id !== 'string'
      || !file.id
      || file.id.length > MAX_SETLIST_STRING_LENGTH
      || ids.has(file.id)
      || typeof file.displayName !== 'string'
      || file.displayName.length > MAX_SETLIST_STRING_LENGTH
      || typeof file.originalName !== 'string'
      || file.originalName.length > MAX_SETLIST_STRING_LENGTH
      || typeof file.content !== 'string'
      || byteLength(file.content) > MAX_SETLIST_ITEM_CONTENT_BYTES
      || (file.metadata != null && !isPlainObject(file.metadata))
      || (file.addedBy != null && !isPlainObject(file.addedBy))) {
      return { valid: false, files: [] };
    }

    const fileType = normalizeLyricFileType({
      fileType: file.fileType,
      fileName: file.originalName,
      fallback: 'txt',
    });
    if (!isSupportedLyricFileType(fileType)) {
      return { valid: false, files: [] };
    }

    ids.add(file.id);
    normalized.push({
      id: file.id,
      displayName: file.displayName,
      originalName: file.originalName,
      content: file.content,
      lastModified: Number.isFinite(file.lastModified) ? file.lastModified : null,
      addedAt: Number.isFinite(file.addedAt) ? file.addedAt : null,
      fileType,
      metadata: file.metadata || null,
      addedBy: file.addedBy || null,
    });
  }

  return { valid: true, files: normalized };
}
