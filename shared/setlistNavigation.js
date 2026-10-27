// Locate the live song inside a setlist. The loaded setlist item ID is authoritative, so
// the same song can appear more than once; name matching only covers lyrics loaded from
// outside the setlist that happen to match an entry.

const stripExtension = (name) => String(name || '').replace(/\.[a-z0-9]{1,10}$/i, '');
const comparableName = (name) => stripExtension(name).trim().toLowerCase();

export function findActiveSetlistIndex(setlistFiles, { setlistItemId = null, lyricsFileName = '' } = {}) {
  if (!Array.isArray(setlistFiles) || setlistFiles.length === 0) return -1;

  if (setlistItemId) {
    const byId = setlistFiles.findIndex((file) => file?.id === setlistItemId);
    if (byId !== -1) return byId;
  }

  const target = comparableName(lyricsFileName);
  if (!target) return -1;
  return setlistFiles.findIndex((file) => (
    comparableName(file?.displayName) === target || comparableName(file?.originalName) === target
  ));
}

/**
 * @param {Array} setlistFiles
 * @param {{ setlistItemId?: string|null, lyricsFileName?: string }} current
 * @param {1|-1} direction
 * @returns {{ currentIndex: number, index: number, item: object|null, atBoundary: boolean }}
 */
export function getAdjacentSetlistItem(setlistFiles, current, direction) {
  const currentIndex = findActiveSetlistIndex(setlistFiles, current);
  if (currentIndex === -1) {
    return { currentIndex, index: -1, item: null, atBoundary: false };
  }

  const index = currentIndex + (direction < 0 ? -1 : 1);
  if (index < 0 || index >= setlistFiles.length) {
    return { currentIndex, index: -1, item: null, atBoundary: true };
  }

  return { currentIndex, index, item: setlistFiles[index], atBoundary: false };
}
