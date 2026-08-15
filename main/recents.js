import { app, dialog } from 'electron';
import { requestRendererModal } from './modalBridge.js';
import path from 'path';
import { promises as fs } from 'fs';
import * as userPreferences from './userPreferences.js';
import { isStorageCapacityError, toStorageWriteFailure } from '../shared/storageErrors.js';
import { saveTextFileAtomically } from './atomicFileSave.js';

let recents = [];
const subscribers = new Set();
let loaded = false;

function getStorePath() {
  try {
    return path.join(app.getPath('userData'), 'recent-files.json');
  } catch {

    return path.join(process.cwd(), 'recent-files.json');
  }
}

async function loadRecents() {
  if (loaded) return recents;
  try {
    const p = getStorePath();
    const data = await fs.readFile(p, 'utf8');
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      recents = parsed.filter(Boolean);
    }
  } catch {

  } finally {
    loaded = true;
  }
  return recents;
}

async function persist() {
  try {
    const p = getStorePath();
    await saveTextFileAtomically(p, JSON.stringify(recents, null, 2));
  } catch (e) {
    const storageFailure = isStorageCapacityError(e)
      ? toStorageWriteFailure(e, { subject: 'the recent-files list' })
      : null;
    const title = storageFailure ? 'Storage is full' : 'Recent files error';
    const description = storageFailure?.error || 'Could not persist recent files list.';
    try {
      await requestRendererModal({
        title,
        description,
        variant: 'error',
        dedupeKey: storageFailure ? 'user-data-storage-full' : 'recent-files-write-error',
        actions: [
          { label: 'Dismiss', value: { response: 0 }, variant: 'destructive' },
        ],
      }, {
        fallback: () => {
          dialog.showErrorBox(title, description);
          return { response: 0 };
        },
      });
    } catch {
      try { dialog.showErrorBox(title, description); } catch { }
    }
  }
}

function notify() {
  for (const fn of subscribers) {
    try { fn([...recents]); } catch { }
  }
}

export async function getRecents() {
  await loadRecents();
  return [...recents];
}

export async function addRecent(filePath) {
  if (!filePath || typeof filePath !== 'string') return getRecents();
  await loadRecents();
  const normalized = filePath.trim();

  // Get max recent files from user preferences
  const maxRecentFiles = userPreferences.getPreference('fileHandling.maxRecentFiles') ?? 10;
  
  recents = [normalized, ...recents.filter(p => p !== normalized)].slice(0, maxRecentFiles);
  await persist();
  notify();
  return [...recents];
}

/**
 * Get the most recent file's directory path
 * @returns {string|null} Directory path of the most recent file, or null if no recents
 */
export async function getLastOpenedDirectory() {
  await loadRecents();
  if (recents.length > 0) {
    return path.dirname(recents[0]);
  }
  return null;
}

export async function clearRecents() {
  await loadRecents();
  recents = [];
  await persist();
  notify();
  return [];
}

export function subscribe(callback) {
  if (typeof callback === 'function') {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
  }
  return () => { };
}
