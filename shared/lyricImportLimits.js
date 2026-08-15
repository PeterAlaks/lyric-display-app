export const DEFAULT_MAX_LYRIC_IMPORT_BYTES = 2 * 1024 * 1024;
export const HARD_MAX_LYRIC_IMPORT_BYTES = 10 * 1024 * 1024;
export const MAX_EXTRACTED_LYRIC_TEXT_BYTES = 10 * 1024 * 1024;
export const MAX_DOCX_ARCHIVE_ENTRIES = 4096;
export const MAX_DOCX_UNCOMPRESSED_BYTES = 64 * 1024 * 1024;
export const MAX_DOCX_ENTRY_BYTES = 16 * 1024 * 1024;

export function getConfiguredLyricImportByteLimit(maxFileSizeMb) {
  const numeric = Number(maxFileSizeMb);
  if (!Number.isFinite(numeric)) return DEFAULT_MAX_LYRIC_IMPORT_BYTES;
  const clampedMb = Math.max(1, Math.min(10, numeric));
  return Math.round(clampedMb * 1024 * 1024);
}

export function getBinaryByteLength(value) {
  if (value instanceof ArrayBuffer) return value.byteLength;
  if (ArrayBuffer.isView(value)) return value.byteLength;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer?.(value)) return value.byteLength;
  return null;
}

export function assertLyricImportSize(byteLength, maxBytes = HARD_MAX_LYRIC_IMPORT_BYTES) {
  if (!Number.isFinite(byteLength) || byteLength < 0) {
    throw new Error('Lyric file size is unavailable');
  }
  if (byteLength > maxBytes) {
    throw new Error(`Lyric file exceeds the ${Math.round(maxBytes / (1024 * 1024))} MB limit`);
  }
}
