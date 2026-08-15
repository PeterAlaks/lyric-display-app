const MIB = 1024 * 1024;

export const FILE_NAVIGATOR_LIMITS = Object.freeze({
  maxRoots: 20,
  maxFilesPerRoot: 25_000,
  maxSourceBytesPerRoot: 512 * MIB,
  maxSearchableContentBytesPerRoot: 32 * MIB,
  maxSearchableContentBytesTotal: 64 * MIB,
});

export function formatFileNavigatorBytes(value) {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes < MIB) return `${Math.ceil(bytes / 1024)} KB`;
  const mebibytes = bytes / MIB;
  return `${Number.isInteger(mebibytes) ? mebibytes : mebibytes.toFixed(1)} MB`;
}

export function getFileNavigatorRootLimitError({ fileCount = 0, sourceBytes = 0 } = {}) {
  if (Number(fileCount) > FILE_NAVIGATOR_LIMITS.maxFilesPerRoot) {
    return `This folder contains more than ${FILE_NAVIGATOR_LIMITS.maxFilesPerRoot.toLocaleString()} supported lyric files. Choose a more focused folder.`;
  }
  if (Number(sourceBytes) > FILE_NAVIGATOR_LIMITS.maxSourceBytesPerRoot) {
    return `This folder contains more than ${formatFileNavigatorBytes(FILE_NAVIGATOR_LIMITS.maxSourceBytesPerRoot)} of supported lyric files. Choose a smaller folder.`;
  }
  return null;
}
