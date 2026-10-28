import { promises as fs } from 'fs';
import path from 'path';

const comparisonKey = (value) => (
  process.platform === 'win32' ? String(value || '').toLowerCase() : String(value || '')
);

const isWithin = (candidate, parent) => {
  const relative = path.relative(comparisonKey(parent), comparisonKey(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

/**
 * Indexed folders with the song library first. Folders inside the library are folded into it,
 * and a user folder that already contains the library keeps covering it.
 */
export function arrangeRootsWithLibrary(roots, libraryPath) {
  if (!libraryPath) return roots;
  const libraryKey = comparisonKey(libraryPath);
  if (roots.some((root) => comparisonKey(root) !== libraryKey && isWithin(libraryPath, root))) return roots;
  return [libraryPath, ...roots.filter((root) => !isWithin(root, libraryPath))];
}

/** Indexed folders the user added; the library does not count toward the folder limit. */
export function countUserRoots(roots, libraryPath) {
  const libraryKey = libraryPath ? comparisonKey(libraryPath) : null;
  return roots.filter((root) => comparisonKey(root) !== libraryKey).length;
}

export async function ensureNavigatorDirectory(directoryPath, label) {
  try {
    const fileStat = await fs.stat(directoryPath);
    if (!fileStat.isDirectory()) {
      throw new Error(`${label} already exists but is not a folder. Rename or remove it, then try again.`);
    }
    return false;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      // Created below.
    } else if (error?.code === 'EACCES' || error?.code === 'EPERM') {
      throw new Error(`${label} could not be accessed. Check access to your Documents folder and try again.`);
    } else if (error?.code === 'ENOTDIR') {
      throw new Error(`${label} could not be created because part of that path is not a folder.`);
    } else {
      throw error;
    }
  }

  try {
    await fs.mkdir(directoryPath, { recursive: true });
    const fileStat = await fs.stat(directoryPath);
    if (!fileStat.isDirectory()) {
      throw new Error(`${label} could not be created because that path is not a folder.`);
    }
    return true;
  } catch (error) {
    if (error?.message?.startsWith(label)) throw error;
    if (error?.code === 'EACCES' || error?.code === 'EPERM') {
      throw new Error(`${label} could not be created. Check access to your Documents folder and try again.`);
    }
    if (error?.code === 'EEXIST' || error?.code === 'ENOTDIR') {
      throw new Error(`${label} could not be created because part of that path is not a folder.`);
    }
    throw new Error(`${label} could not be created. ${error?.message || 'Please try again.'}`);
  }
}
