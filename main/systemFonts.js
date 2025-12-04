import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { app } from 'electron';

let cachedFonts = null;
let cachedFontsPromise = null;
let prewarmPromise = null;

const CACHE_VERSION = 1;
const CACHE_FILENAME = 'system-fonts-cache.json';

const normalizeFonts = (fonts) => Array.from(
  new Set(
    (fonts || [])
      .map((font) => (typeof font === 'string' ? font.replace(/["']/g, '').trim() : ''))
      .filter(Boolean)
  )
).sort((a, b) => a.localeCompare(b));

const getCachePath = () => {
  try {
    return path.join(app.getPath('userData'), CACHE_FILENAME);
  } catch {
    return path.join(os.tmpdir(), CACHE_FILENAME);
  }
};

const getFontDirectories = () => {
  const platform = process.platform;
  const dirs = [];

  if (platform === 'win32') {
    dirs.push(
      path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts'),
      path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Windows', 'Fonts')
    );
  } else if (platform === 'darwin') {
    dirs.push(
      '/System/Library/Fonts',
      '/Library/Fonts',
      path.join(os.homedir(), 'Library', 'Fonts')
    );
  } else {
    dirs.push(
      '/usr/share/fonts',
      '/usr/local/share/fonts',
      path.join(os.homedir(), '.fonts'),
      path.join(os.homedir(), '.local', 'share', 'fonts')
    );
  }

  return Array.from(new Set(dirs.filter(Boolean)));
};

const computeDirFingerprint = async () => {
  const dirs = getFontDirectories();
  const entries = await Promise.all(
    dirs.map(async (dir) => {
      try {
        const stats = await fs.stat(dir);
        return `${dir}:${stats.mtimeMs || stats.mtime?.getTime?.() || 0}`;
      } catch {
        return null;
      }
    })
  );

  return entries.filter(Boolean).join('|');
};

const readCache = async (fingerprint) => {
  try {
    const cachePath = getCachePath();
    const raw = await fs.readFile(cachePath, 'utf8');
    const data = JSON.parse(raw);

    if (
      data
      && data.version === CACHE_VERSION
      && data.platform === process.platform
      && data.fingerprint === fingerprint
      && Array.isArray(data.fonts)
    ) {
      return normalizeFonts(data.fonts);
    }
  } catch {

  }
  return null;
};

const writeCache = async (fonts, fingerprint) => {
  try {
    const cachePath = getCachePath();
    await fs.mkdir(path.dirname(cachePath), { recursive: true });
    const payload = {
      version: CACHE_VERSION,
      platform: process.platform,
      fingerprint,
      fonts: Array.isArray(fonts) ? fonts : []
    };
    await fs.writeFile(cachePath, JSON.stringify(payload, null, 2), 'utf8');
  } catch {

  }
};

export const loadSystemFonts = async () => {
  if (cachedFonts && Array.isArray(cachedFonts)) return cachedFonts;
  if (cachedFontsPromise) return cachedFontsPromise;

  cachedFontsPromise = (async () => {
    try {
      const fingerprint = await computeDirFingerprint();

      const cached = await readCache(fingerprint);
      if (cached) {
        cachedFonts = cached;
        return cachedFonts;
      }

      const fontList = await import('font-list');
      const getFonts = fontList.getFonts || fontList.default?.getFonts;
      if (typeof getFonts !== 'function') {
        throw new Error('font-list getFonts not available');
      }
      const fonts = await getFonts({ disableQuoting: true });
      cachedFonts = normalizeFonts(fonts);
      writeCache(cachedFonts, fingerprint).catch(() => { /* non-blocking */ });
      return cachedFonts;
    } catch (error) {
      console.error('[SystemFonts] Error loading system fonts:', error);
      cachedFonts = [];
      return cachedFonts;
    } finally {
      cachedFontsPromise = null;
    }
  })();

  return cachedFontsPromise;
};

export const preloadSystemFonts = () => {
  if (prewarmPromise) return prewarmPromise;
  prewarmPromise = loadSystemFonts().catch(() => { /* logged inside loadSystemFonts */ });
  return prewarmPromise;
};

export const getCachedFonts = () => cachedFonts || [];