const MAX_REMEMBERED_POSITIONS = 24;
const positions = new Map();
let pendingRestoreKey = null;
let pendingRestoreApplied = false;
let pendingResetGuardObserved = false;

const normalizeKeyPart = (value) => String(value || '').trim();

export function createLyricsScrollKey({ lyricsSource, lyricsFileName } = {}) {
  const setlistItemId = normalizeKeyPart(lyricsSource?.setlistItemId);
  if (setlistItemId) return `setlist:${setlistItemId}`;

  const filePath = normalizeKeyPart(lyricsSource?.filePath).replace(/\\/g, '/').toLowerCase();
  if (filePath) return `path:${filePath}`;

  const sourceName = normalizeKeyPart(lyricsSource?.fileName).toLowerCase();
  if (sourceName) return `source:${sourceName}`;

  const displayName = normalizeKeyPart(lyricsFileName).toLowerCase();
  return displayName ? `name:${displayName}` : null;
}

const positionKey = (scope, lyricsKey) => `${scope || 'control'}::${lyricsKey}`;

export function rememberLyricsScrollPosition(scope, lyricsKey, scrollTop) {
  if (!lyricsKey || !Number.isFinite(scrollTop)) return;
  const key = positionKey(scope, lyricsKey);
  positions.delete(key);
  positions.set(key, Math.max(0, scrollTop));

  while (positions.size > MAX_REMEMBERED_POSITIONS) {
    positions.delete(positions.keys().next().value);
  }
}

export function getRememberedLyricsScrollPosition(scope, lyricsKey) {
  if (!lyricsKey) return null;
  const value = positions.get(positionKey(scope, lyricsKey));
  return Number.isFinite(value) ? value : null;
}

export function armLyricsScrollRestore(lyricsKey) {
  pendingRestoreKey = lyricsKey || null;
  pendingRestoreApplied = false;
  pendingResetGuardObserved = false;
}

export function isLyricsScrollRestorePending(lyricsKey) {
  return Boolean(lyricsKey) && pendingRestoreKey === lyricsKey;
}

export function consumeLyricsScrollRestore(lyricsKey) {
  if (isLyricsScrollRestorePending(lyricsKey)) {
    pendingRestoreKey = null;
    pendingRestoreApplied = false;
    pendingResetGuardObserved = false;
    return true;
  }
  return false;
}

export function markLyricsScrollRestoreApplied(lyricsKey) {
  if (!isLyricsScrollRestorePending(lyricsKey)) return false;
  pendingRestoreApplied = true;
  if (pendingResetGuardObserved) consumeLyricsScrollRestore(lyricsKey);
  return true;
}

export function observeLyricsScrollResetGuard(lyricsKey) {
  if (!isLyricsScrollRestorePending(lyricsKey)) return false;
  pendingResetGuardObserved = true;
  if (pendingRestoreApplied) consumeLyricsScrollRestore(lyricsKey);
  return true;
}

export function resetLyricsScrollMemoryForTests() {
  positions.clear();
  pendingRestoreKey = null;
  pendingRestoreApplied = false;
  pendingResetGuardObserved = false;
}
