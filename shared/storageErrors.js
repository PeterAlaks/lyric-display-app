const STORAGE_CAPACITY_ERROR_CODES = new Set(['ENOSPC', 'EDQUOT']);
const STORAGE_CAPACITY_MESSAGE = /(no space left|disk(?: quota)? (?:is )?(?:full|exceeded)|not enough space)/i;

export function getStorageCapacityErrorCode(error) {
  const pending = [error];
  const visited = new Set();

  while (pending.length > 0) {
    const current = pending.shift();
    if (!current || visited.has(current)) continue;
    if (typeof current === 'object') visited.add(current);

    const code = String(current?.code || '').toUpperCase();
    if (STORAGE_CAPACITY_ERROR_CODES.has(code)) return code;
    if (STORAGE_CAPACITY_MESSAGE.test(String(current?.message || current || ''))) return 'ENOSPC';

    if (current?.cause) pending.push(current.cause);
    if (Array.isArray(current?.errors)) pending.push(...current.errors);
    if (Array.isArray(current?.storageErrors)) pending.push(...current.storageErrors);
  }

  return null;
}

export const isStorageCapacityError = (error) => Boolean(getStorageCapacityErrorCode(error));

export function toStorageWriteFailure(error, {
  subject = 'LyricDisplay data',
  fallback = 'The data could not be saved.',
} = {}) {
  const capacityCode = getStorageCapacityErrorCode(error);
  if (capacityCode) {
    return {
      code: 'STORAGE_FULL',
      error: `LyricDisplay could not save ${subject} because the drive is full. Free some disk space and try again.`,
      systemCode: capacityCode,
    };
  }

  return {
    code: error?.code || 'WRITE_FAILED',
    error: error?.message || fallback,
  };
}
