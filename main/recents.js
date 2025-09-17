import { app, dialog } from 'electron';
import { requestRendererModal } from './modalBridge.js';
import path from 'path';
import { promises as fs } from 'fs';

let recents = [];
const subscribers = new Set();
let loaded = false;

function getStorePath() {
  try {
    return path.join(app.getPath('userData'), 'recent-files.json');
  } catch {
    // Fallback to current working dir if userData is unavailable
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
    // ignore
  } finally {
    loaded = true;
  }
  return recents;
}

async function persist() {
  try {
    const p = getStorePath();
    await fs.writeFile(p, JSON.stringify(recents, null, 2), 'utf8');
  } catch (e) {
    // Best effort — do not crash app on failure
    try {
      await requestRendererModal({
        title: 'Recent files error',
        description: 'Could not persist recent files list.',
        variant: 'error',
        actions: [
          { label: 'Dismiss', value: { response: 0 }, variant: 'destructive' },
        ],
      }, {
        fallback: () => {
          dialog.showErrorBox('Recent Files Error', 'Could not persist recent files list.');
          return { response: 0 };
        },
      });
    } catch {
      try { dialog.showErrorBox('Recent Files Error', 'Could not persist recent files list.'); } catch {}
    }
  }
}

function notify() {
  for (const fn of subscribers) {
    try { fn([...recents]); } catch {}
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
  // De-duplicate and move to front
  recents = [normalized, ...recents.filter(p => p !== normalized)].slice(0, 10);
  await persist();
  notify();
  return [...recents];
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
  return () => {};
}


