import crypto from 'crypto';
import path from 'path';
import Store from 'electron-store';

const MAX_ENTRIES = 250;
const MAX_STORE_BYTES = 25 * 1024 * 1024;
const groupingStore = new Store({
  name: 'lyrics-grouping-metadata',
  defaults: { entries: {} },
});

function normalizePath(filePath) {
  if (typeof filePath !== 'string' || !filePath.trim()) return null;
  const resolved = path.resolve(filePath);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function digest(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function getPathKey(filePath) {
  const normalized = normalizePath(filePath);
  return normalized ? digest(normalized) : null;
}

function pruneEntries(entries) {
  const sorted = Object.entries(entries)
    .sort(([, left], [, right]) => (right?.updatedAt || 0) - (left?.updatedAt || 0));
  const retained = [];
  let retainedBytes = 0;

  for (const entry of sorted) {
    if (retained.length >= MAX_ENTRIES) break;
    const entryBytes = Buffer.byteLength(JSON.stringify(entry), 'utf8');
    if (retainedBytes + entryBytes > MAX_STORE_BYTES) continue;
    retained.push(entry);
    retainedBytes += entryBytes;
  }

  return Object.fromEntries(retained);
}

export function rememberLyricsGrouping(filePath, content, groupingPlan) {
  const key = getPathKey(filePath);
  if (!key || typeof content !== 'string' || !groupingPlan) return false;

  const entries = groupingStore.get('entries', {});
  entries[key] = {
    contentHash: digest(content),
    groupingPlan,
    updatedAt: Date.now(),
  };
  groupingStore.set('entries', pruneEntries(entries));
  return true;
}

export function getRememberedLyricsGrouping(filePath, content) {
  const key = getPathKey(filePath);
  if (!key || typeof content !== 'string') return null;

  const entry = groupingStore.get(`entries.${key}`);
  if (!entry || entry.contentHash !== digest(content)) return null;
  return entry.groupingPlan || null;
}
