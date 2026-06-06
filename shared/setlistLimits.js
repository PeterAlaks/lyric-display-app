export const MIN_SETLIST_ITEMS = 10;
export const DEFAULT_SETLIST_ITEMS = 50;
export const MAX_SETLIST_ITEMS = 100;
export const SETLIST_PERFORMANCE_WARNING_ITEMS = 75;

export function normalizeSetlistItemLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_SETLIST_ITEMS;
  }
  return Math.min(MAX_SETLIST_ITEMS, Math.max(MIN_SETLIST_ITEMS, parsed));
}
