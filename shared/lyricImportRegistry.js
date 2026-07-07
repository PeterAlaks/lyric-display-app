export const LYRIC_IMPORT_FORMATS = [
  {
    fileType: 'txt',
    parserType: 'txt',
    label: 'Text',
    extensions: ['txt'],
  },
  {
    fileType: 'lrc',
    parserType: 'lrc',
    label: 'LRC',
    extensions: ['lrc'],
  },
  {
    fileType: 'md',
    parserType: 'txt',
    label: 'Markdown',
    extensions: ['md', 'markdown'],
  },
  {
    fileType: 'rtf',
    parserType: 'txt',
    label: 'Rich Text',
    extensions: ['rtf'],
  },
  {
    fileType: 'docx',
    parserType: 'txt',
    label: 'Word Document',
    extensions: ['docx'],
  },
];

const FORMATS_BY_TYPE = new Map(LYRIC_IMPORT_FORMATS.map((format) => [format.fileType, format]));
const FORMATS_BY_EXTENSION = new Map(
  LYRIC_IMPORT_FORMATS.flatMap((format) => format.extensions.map((extension) => [extension, format]))
);

export const LYRIC_IMPORT_EXTENSIONS = LYRIC_IMPORT_FORMATS.flatMap((format) => format.extensions);
export const LYRIC_IMPORT_EXTENSION_PATTERN = new RegExp(
  `\\.(${LYRIC_IMPORT_EXTENSIONS.slice().sort((a, b) => b.length - a.length).join('|')})$`,
  'i'
);

export function normalizeLyricExtension(value = '') {
  return String(value || '').trim().replace(/^\./, '').toLowerCase();
}

export function getExtensionFromName(fileName = '') {
  const match = String(fileName || '').trim().match(/\.([^.\\/]+)$/);
  return match ? normalizeLyricExtension(match[1]) : '';
}

export function getLyricImportFormatForExtension(extension) {
  return FORMATS_BY_EXTENSION.get(normalizeLyricExtension(extension)) || null;
}

export function getLyricImportFormatForName(fileName) {
  return getLyricImportFormatForExtension(getExtensionFromName(fileName));
}

export function getLyricImportFormatForType(fileType) {
  return FORMATS_BY_TYPE.get(String(fileType || '').toLowerCase()) || null;
}

export function getLyricImportFormat(input = {}) {
  return getLyricImportFormatForType(input.fileType)
    || getLyricImportFormatForName(input.fileName || input.name || input.path || input.filePath)
    || null;
}

export function isSupportedLyricsImportFile(fileName) {
  return Boolean(getLyricImportFormatForName(fileName));
}

export function isSupportedLyricFileType(fileType) {
  return Boolean(getLyricImportFormatForType(fileType));
}

export function stripLyricImportExtension(fileName = '') {
  return String(fileName || '').replace(LYRIC_IMPORT_EXTENSION_PATTERN, '');
}

export function getLyricParserType(fileType) {
  return getLyricImportFormatForType(fileType)?.parserType || 'txt';
}

export function getLyricFormatLabel(fileType, fallback = 'Text') {
  return getLyricImportFormatForType(fileType)?.label || fallback;
}

export function getLyricOriginLabel() {
  return 'Local';
}

export function getLyricsAcceptAttribute({ includeSetlist = false } = {}) {
  const lyricExtensions = LYRIC_IMPORT_EXTENSIONS.map((extension) => `.${extension}`);
  return includeSetlist ? [...lyricExtensions, '.ldset'].join(',') : lyricExtensions.join(',');
}

export function getLyricOpenDialogFilters() {
  return [
    { name: 'Lyric Files', extensions: LYRIC_IMPORT_EXTENSIONS },
    { name: 'Text and LRC', extensions: ['txt', 'lrc'] },
    { name: 'Documents', extensions: ['docx', 'rtf', 'md', 'markdown'] },
  ];
}

export function normalizeLyricFileType({ fileType, fileName, fallback = 'txt' } = {}) {
  const explicitFormat = getLyricImportFormatForType(fileType);
  if (explicitFormat) return explicitFormat.fileType;

  const inferredFormat = getLyricImportFormatForName(fileName);
  if (inferredFormat) return inferredFormat.fileType;

  return getLyricImportFormatForType(fallback)?.fileType || 'txt';
}
