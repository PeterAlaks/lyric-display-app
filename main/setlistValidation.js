import path from 'path';
import {
  MAX_SETLIST_FILE_BYTES,
  MAX_SETLIST_ITEM_CONTENT_BYTES,
  MAX_SETLIST_ITEMS,
  MAX_SETLIST_STRING_LENGTH,
} from '../shared/setlistLimits.js';
import { isSupportedLyricFileType } from '../shared/lyricImportRegistry.js';

export const SETLIST_FILE_EXTENSION = '.ldset';
export const CURRENT_SETLIST_SCHEMA_VERSION = '1.0';
export {
  MAX_SETLIST_FILE_BYTES,
  MAX_SETLIST_ITEM_CONTENT_BYTES,
  MAX_SETLIST_STRING_LENGTH,
};

export function normalizeSetlistPath(filePath) {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    return null;
  }

  const resolved = path.resolve(filePath);
  if (!path.isAbsolute(resolved)) {
    return null;
  }

  return resolved;
}

export function hasSetlistExtension(filePath) {
  const normalized = normalizeSetlistPath(filePath);
  return Boolean(normalized && path.extname(normalized).toLowerCase() === SETLIST_FILE_EXTENSION);
}

export function sanitizeSetlistDefaultName(defaultName) {
  const raw = typeof defaultName === 'string' && defaultName.trim()
    ? defaultName.trim()
    : 'Setlist.ldset';

  const safeBase = path.basename(raw).replace(/[<>:"/\\|?*\x00-\x1F]+/g, '').trim() || 'Setlist.ldset';
  return safeBase.toLowerCase().endsWith(SETLIST_FILE_EXTENSION)
    ? safeBase
    : `${safeBase}${SETLIST_FILE_EXTENSION}`;
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function validateShortString(value, fieldName, { required = false } = {}) {
  if (value == null || value === '') {
    return required ? `${fieldName} is required` : null;
  }

  if (typeof value !== 'string') {
    return `${fieldName} must be text`;
  }

  if (value.length > MAX_SETLIST_STRING_LENGTH) {
    return `${fieldName} is too long`;
  }

  return null;
}

export function validateSetlistData(setlistData) {
  if (!isPlainObject(setlistData)) {
    return { valid: false, error: 'Invalid setlist format' };
  }

  const versionResult = normalizeSetlistSchemaVersion(setlistData.version);
  if (!versionResult.valid) {
    return versionResult;
  }

  const normalizedData = versionResult.migrated
    ? { ...setlistData, version: CURRENT_SETLIST_SCHEMA_VERSION }
    : setlistData;

  if (!Array.isArray(normalizedData.items)) {
    return { valid: false, error: 'Setlist must contain an items array' };
  }

  if (normalizedData.items.length > MAX_SETLIST_ITEMS) {
    return { valid: false, error: `Setlist cannot contain more than ${MAX_SETLIST_ITEMS} items` };
  }

  for (const [index, item] of normalizedData.items.entries()) {
    if (!isPlainObject(item)) {
      return { valid: false, error: `Setlist item ${index + 1} is invalid` };
    }

    const displayNameError = validateShortString(item.displayName, `Setlist item ${index + 1} display name`);
    if (displayNameError) return { valid: false, error: displayNameError };

    const originalNameError = validateShortString(item.originalName, `Setlist item ${index + 1} original name`);
    if (originalNameError) return { valid: false, error: originalNameError };

    const fileType = item.fileType || 'txt';
    if (!isSupportedLyricFileType(fileType)) {
      return { valid: false, error: `Setlist item ${index + 1} has an unsupported file type` };
    }

    if (typeof item.content !== 'string') {
      return { valid: false, error: `Setlist item ${index + 1} content must be text` };
    }

    if (Buffer.byteLength(item.content, 'utf8') > MAX_SETLIST_ITEM_CONTENT_BYTES) {
      return { valid: false, error: `Setlist item ${index + 1} content is too large` };
    }

    if (item.metadata != null && !isPlainObject(item.metadata)) {
      return { valid: false, error: `Setlist item ${index + 1} metadata is invalid` };
    }
  }

  return {
    valid: true,
    setlistData: normalizedData,
    migrated: versionResult.migrated,
    sourceVersion: versionResult.sourceVersion,
  };
}

function normalizeSetlistSchemaVersion(version) {
  if (version == null || version === '') {
    return { valid: true, migrated: true, sourceVersion: 'legacy' };
  }

  const versionText = typeof version === 'number' && Number.isInteger(version)
    ? `${version}.0`
    : String(version).trim();
  const match = /^(\d+)\.(\d+)$/.exec(versionText);
  if (!match) {
    return {
      valid: false,
      error: `Unsupported setlist schema version "${versionText}". Open a valid .ldset file or re-save it with LyricDisplay.`,
    };
  }

  const [currentMajor, currentMinor] = CURRENT_SETLIST_SCHEMA_VERSION.split('.').map(Number);
  const major = Number(match[1]);
  const minor = Number(match[2]);
  if (major > currentMajor || (major === currentMajor && minor > currentMinor)) {
    return {
      valid: false,
      error: `This setlist uses schema ${versionText}, which requires a newer LyricDisplay version. Update LyricDisplay before opening it.`,
    };
  }
  if (major !== currentMajor) {
    return {
      valid: false,
      error: `Setlist schema ${versionText} is no longer supported. Open and re-save it with a compatible LyricDisplay version first.`,
    };
  }

  return {
    valid: true,
    migrated: version !== CURRENT_SETLIST_SCHEMA_VERSION,
    sourceVersion: versionText,
  };
}
