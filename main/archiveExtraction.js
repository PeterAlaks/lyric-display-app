import { createWriteStream } from 'node:fs';
import {
  chmod,
  lstat,
  mkdir,
  realpath,
  symlink,
} from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

const FILE_TYPE_MASK = 0o170000;
const DIRECTORY_TYPE = 0o040000;
const SYMLINK_TYPE = 0o120000;

function archiveEntryMode(entry) {
  return (entry.externalFileAttributes >>> 16) & 0xffff;
}

function archiveEntryType(entry) {
  const mode = archiveEntryMode(entry);
  if ((mode & FILE_TYPE_MASK) === SYMLINK_TYPE) return 'symlink';
  if ((mode & FILE_TYPE_MASK) === DIRECTORY_TYPE || entry.type === 'Directory') return 'directory';
  return 'file';
}

function normalizeArchivePath(entryPath) {
  if (typeof entryPath !== 'string' || entryPath.includes('\0')) {
    throw new Error('ZIP archive contains an invalid entry path');
  }

  const portablePath = entryPath.replace(/\\/g, '/');
  if (
    portablePath.startsWith('/')
    || portablePath.startsWith('//')
    || /^[a-zA-Z]:\//.test(portablePath)
  ) {
    throw new Error(`ZIP archive entry uses an absolute path: ${entryPath}`);
  }

  const segments = portablePath.split('/').filter((segment) => segment && segment !== '.');
  if (segments.includes('..')) {
    throw new Error(`ZIP archive entry escapes the destination: ${entryPath}`);
  }

  return segments;
}

function normalizedPathKey(segments) {
  const value = segments.join('/');
  return process.platform === 'win32' ? value.toLowerCase() : value;
}

function assertInsideDirectory(rootPath, candidatePath, entryPath) {
  const relativePath = path.relative(rootPath, candidatePath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`ZIP archive entry escapes the destination: ${entryPath}`);
  }
}

async function assertPathIsNotSymlink(targetPath, entryPath) {
  try {
    const targetStat = await lstat(targetPath);
    if (targetStat.isSymbolicLink()) {
      throw new Error(`ZIP archive entry targets an existing symlink: ${entryPath}`);
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

async function prepareParentDirectory(rootPath, targetPath, entryPath) {
  const parentPath = path.dirname(targetPath);
  await mkdir(parentPath, { recursive: true });
  const canonicalParentPath = await realpath(parentPath);
  assertInsideDirectory(rootPath, canonicalParentPath, entryPath);
  return path.join(canonicalParentPath, path.basename(targetPath));
}

function validateSymlinkAncestors(entries) {
  const symlinkPaths = new Set(
    entries
      .filter((entry) => entry.type === 'symlink')
      .map((entry) => normalizedPathKey(entry.segments)),
  );

  for (const entry of entries) {
    for (let length = 1; length < entry.segments.length; length += 1) {
      const ancestorKey = normalizedPathKey(entry.segments.slice(0, length));
      if (symlinkPaths.has(ancestorKey)) {
        throw new Error(`ZIP archive entry traverses an archive symlink: ${entry.entry.path}`);
      }
    }
  }
}

/**
 * Extract a ZIP without allowing entries or symlinks to escape the destination.
 * The callback shape intentionally matches extract-zip for existing callers.
 */
export async function extractZipArchive(zipPath, options = {}) {
  if (!options.dir || !path.isAbsolute(options.dir)) {
    throw new Error('ZIP extraction destination must be an absolute path');
  }

  await mkdir(options.dir, { recursive: true });
  const rootPath = await realpath(options.dir);
  const { default: unzipper } = await import('unzipper');
  const directory = await unzipper.Open.file(zipPath);
  const entries = directory.files
    .map((entry) => {
      const segments = normalizeArchivePath(entry.path);
      return {
        entry,
        segments,
        type: archiveEntryType(entry),
        mode: archiveEntryMode(entry) & 0o777,
      };
    })
    .filter(({ segments }) => segments.length > 0 && segments[0] !== '__MACOSX');

  validateSymlinkAncestors(entries);

  let activeStream = null;
  let closed = false;
  const archiveControl = {
    entryCount: directory.files.length,
    close() {
      closed = true;
      activeStream?.destroy(new Error('ZIP extraction was cancelled'));
    },
  };
  const pendingSymlinks = [];
  const pendingDirectoryModes = [];

  for (const record of entries) {
    if (closed) throw new Error('ZIP extraction was cancelled');
    options.onEntry?.(record.entry, archiveControl);
    if (closed) throw new Error('ZIP extraction was cancelled');

    const targetPath = path.resolve(rootPath, ...record.segments);
    assertInsideDirectory(rootPath, targetPath, record.entry.path);

    if (record.type === 'symlink') {
      pendingSymlinks.push({ ...record, targetPath });
      continue;
    }

    if (record.type === 'directory') {
      await mkdir(targetPath, { recursive: true });
      const canonicalDirectoryPath = await realpath(targetPath);
      assertInsideDirectory(rootPath, canonicalDirectoryPath, record.entry.path);
      if (record.mode) pendingDirectoryModes.push([canonicalDirectoryPath, record.mode]);
      continue;
    }

    const outputPath = await prepareParentDirectory(rootPath, targetPath, record.entry.path);
    await assertPathIsNotSymlink(outputPath, record.entry.path);
    activeStream = record.entry.stream();
    await pipeline(activeStream, createWriteStream(outputPath));
    activeStream = null;
    if (record.mode) await chmod(outputPath, record.mode);
  }

  for (const record of pendingSymlinks) {
    if (closed) throw new Error('ZIP extraction was cancelled');
    const outputPath = await prepareParentDirectory(rootPath, record.targetPath, record.entry.path);
    await assertPathIsNotSymlink(outputPath, record.entry.path);
    const linkTarget = (await record.entry.buffer()).toString('utf8');
    if (linkTarget.includes('\0') || path.isAbsolute(linkTarget) || path.win32.isAbsolute(linkTarget)) {
      throw new Error(`ZIP archive symlink escapes the destination: ${record.entry.path}`);
    }
    const resolvedLinkTarget = path.resolve(path.dirname(outputPath), linkTarget.replace(/\\/g, '/'));
    assertInsideDirectory(rootPath, resolvedLinkTarget, record.entry.path);
    await symlink(linkTarget, outputPath);
  }

  pendingDirectoryModes.sort(([left], [right]) => right.length - left.length);
  for (const [directoryPath, mode] of pendingDirectoryModes) {
    await chmod(directoryPath, mode);
  }
}
