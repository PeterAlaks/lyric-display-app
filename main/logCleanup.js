import fs from 'node:fs/promises';
import path from 'node:path';

const resolveSafeLogDirectory = (logDirectory) => {
  const value = String(logDirectory || '').trim();
  if (!value) throw new Error('Log directory is unavailable');

  const resolvedDirectory = path.resolve(value);
  if (resolvedDirectory === path.parse(resolvedDirectory).root) {
    throw new Error('Refusing to clear a filesystem root');
  }
  return resolvedDirectory;
};

const assertDirectChild = (parentDirectory, targetPath) => {
  const relativePath = path.relative(parentDirectory, targetPath);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('Refusing to clear a path outside the log directory');
  }
};

export async function clearLogDirectoryContents(logDirectory) {
  const resolvedDirectory = resolveSafeLogDirectory(logDirectory);
  let entries;
  try {
    entries = await fs.readdir(resolvedDirectory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { removedEntries: 0 };
    }
    throw error;
  }

  let removedEntries = 0;
  for (const entry of entries) {
    const targetPath = path.resolve(resolvedDirectory, entry.name);
    assertDirectChild(resolvedDirectory, targetPath);
    await fs.rm(targetPath, { recursive: true, force: true });
    removedEntries += 1;
  }

  return { removedEntries };
}

export default clearLogDirectoryContents;
