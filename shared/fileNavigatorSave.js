const SAVE_EXTENSIONS = new Set(['txt', 'lrc']);
const INVALID_PORTABLE_NAME_PATTERN = /[<>:"/\\|?*\u0000-\u001f]/;
const WINDOWS_RESERVED_NAME_PATTERN = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
const MAX_PORTABLE_BASE_NAME_LENGTH = 200;

export function normalizeNavigatorSaveExtension(value) {
  const normalized = String(value || '').trim().replace(/^\./, '').toLowerCase();
  return SAVE_EXTENSIONS.has(normalized) ? normalized : null;
}

export function validateNavigatorSaveName(value, requestedExtension) {
  const extension = normalizeNavigatorSaveExtension(requestedExtension);
  if (!extension) return { valid: false, error: 'Only TXT and LRC lyric files can be saved here.' };

  let baseName = String(value || '').normalize('NFC').trim();
  baseName = baseName.replace(/\.(?:txt|lrc)$/i, '').trim();

  if (!baseName) return { valid: false, error: 'Enter a file name.' };
  if (baseName === '.' || baseName === '..') {
    return { valid: false, error: 'Enter a valid file name.' };
  }
  if (INVALID_PORTABLE_NAME_PATTERN.test(baseName)) {
    return { valid: false, error: 'File names cannot contain < > : " / \\ | ? * or control characters.' };
  }
  if (/[. ]$/.test(baseName)) {
    return { valid: false, error: 'File names cannot end with a space or period.' };
  }
  if (WINDOWS_RESERVED_NAME_PATTERN.test(baseName)) {
    return { valid: false, error: 'That file name is reserved by the operating system.' };
  }
  if (baseName.length > MAX_PORTABLE_BASE_NAME_LENGTH) {
    return { valid: false, error: `Keep the file name under ${MAX_PORTABLE_BASE_NAME_LENGTH + 1} characters.` };
  }

  return {
    valid: true,
    baseName,
    extension,
    fileName: `${baseName}.${extension}`,
  };
}

export function createPortableNavigatorSaveName(value, fallback = 'lyrics') {
  let baseName = String(value || '').normalize('NFC').trim().replace(/\.(?:txt|lrc)$/i, '');
  baseName = baseName
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '-')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, MAX_PORTABLE_BASE_NAME_LENGTH);
  if (!baseName || baseName === '.' || baseName === '..') baseName = fallback;
  if (WINDOWS_RESERVED_NAME_PATTERN.test(baseName)) baseName = `_${baseName}`;
  return baseName;
}

