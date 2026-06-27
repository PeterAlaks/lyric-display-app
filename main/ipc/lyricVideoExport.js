import { BrowserWindow, app, dialog, ipcMain } from 'electron';
import { spawn } from 'child_process';
import { createHash } from 'crypto';
import { access, mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'fs/promises';
import { constants as fsConstants } from 'fs';
import path from 'path';
import { isDev, resolveProductionPath } from '../paths.js';
import * as userPreferences from '../userPreferences.js';

let activeExport = null;
let captureRawFormatCache = null;
const hardwareEncoderProbeCache = new Map();

const MAX_EXPORT_FRAMES = 250_000;
const FFMPEG_READINESS_TIMEOUT_MS = 6000;
const ENCODER_PROBE_TIMEOUT_MS = 8000;
const FFMPEG_DISCOVERY_MAX_ENTRIES = 2500;
const FFMPEG_DISCOVERY_MAX_DEPTH = 5;
const RAW_CAPTURE_FORMATS = ['bgra', 'rgba', 'argb', 'abgr'];
const EXPORT_PERFORMANCE_MODES = new Set(['balanced', 'faster', 'best']);
const VALID_GAP_BEHAVIORS = new Set([
  'background-only',
  'blank',
  'show-title',
  'keep-previous-line',
]);

const clampNumber = (value, fallback, min, max) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const nowMs = () => Number(process.hrtime.bigint()) / 1_000_000;

const sanitizeFileNamePart = (value, fallback = 'lyric-video') => {
  const cleaned = String(value || fallback)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return cleaned || fallback;
};

const ensureMp4FileName = (fileName) => (
  String(fileName || '').toLowerCase().endsWith('.mp4') ? fileName : `${fileName}.mp4`
);

const waitForLoad = (win) => new Promise((resolve, reject) => {
  const timeout = setTimeout(() => {
    cleanup();
    reject(new Error('Export renderer did not finish loading'));
  }, 20_000);

  const cleanup = () => {
    clearTimeout(timeout);
    win.webContents.removeListener('did-finish-load', onLoad);
    win.webContents.removeListener('did-fail-load', onFail);
  };

  const onLoad = () => {
    cleanup();
    resolve();
  };

  const onFail = (_event, _code, description) => {
    cleanup();
    reject(new Error(description || 'Export renderer failed to load'));
  };

  win.webContents.once('did-finish-load', onLoad);
  win.webContents.once('did-fail-load', onFail);
});

const writeToStream = async (stream, chunk) => {
  if (!stream || stream.destroyed || stream.writableEnded || stream.closed) {
    throw new Error('FFmpeg input stream is closed.');
  }

  await new Promise((resolve, reject) => {
    stream.write(chunk, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
};

const runProbeProcess = async (command, args, timeoutMs, label) => new Promise((resolve) => {
  const startedAt = Date.now();
  const child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  let settled = false;
  const finish = (result) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    resolve({
      ...result,
      durationMs: Date.now() - startedAt,
      stderr: stderr.trim().slice(-1200),
    });
  };
  const timeout = setTimeout(() => {
    try {
      child.kill('SIGTERM');
    } catch { }
    finish({ ok: false, reason: `${label} timed out` });
  }, timeoutMs);

  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
    if (stderr.length > 3000) stderr = stderr.slice(-3000);
  });
  child.once('error', (error) => {
    finish({ ok: false, reason: error?.message || `${label} failed to start` });
  });
  child.once('exit', (code) => {
    finish({
      ok: code === 0,
      reason: code === 0 ? 'ok' : `${label} exited with code ${code}`,
    });
  });
});

const getFfmpegExecutableNames = () => (
  process.platform === 'win32' ? ['ffmpeg.exe', 'ffmpeg'] : ['ffmpeg']
);

const isFfmpegExecutableName = (filePath) => {
  const fileName = path.basename(String(filePath || '')).toLowerCase();
  return getFfmpegExecutableNames().includes(fileName);
};

const isZipFile = (filePath) => String(filePath || '').toLowerCase().endsWith('.zip');

const isVideoMedia = (media = {}) => (
  media?.mimeType?.startsWith?.('video/')
  || (!media?.mimeType && typeof media?.url === 'string' && /\.(mp4|webm|ogg|m4v|mov)$/i.test(media.url))
);

const isImageMedia = (media = {}) => (
  media?.mimeType?.startsWith?.('image/')
  || (!media?.mimeType && typeof media?.url === 'string' && /\.(png|jpe?g|webp|gif|bmp)$/i.test(media.url))
);

const fileExists = async (filePath) => {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const getBundledFfmpegCandidates = () => {
  const names = getFfmpegExecutableNames();
  const roots = [
    resolveProductionPath('ffmpeg'),
    resolveProductionPath('bin'),
    resolveProductionPath('vendor', 'ffmpeg'),
    path.join(process.resourcesPath || '', 'ffmpeg'),
    path.join(process.resourcesPath || '', 'bin'),
  ].filter(Boolean);

  return roots.flatMap((root) => names.map((name) => path.join(root, name)));
};

const resolveFfmpegPath = async () => {
  const savedPath = userPreferences.getPreference('advanced.ffmpegPath');
  if (typeof savedPath === 'string' && savedPath.trim()) {
    const normalizedSavedPath = savedPath.trim();
    if (isFfmpegExecutableName(normalizedSavedPath) && await fileExists(normalizedSavedPath)) {
      return normalizedSavedPath;
    }
    console.warn('[LyricVideoExport] Ignoring saved FFmpeg path because it is not an ffmpeg executable', {
      ffmpegPath: normalizedSavedPath,
    });
  }

  if (process.env.FFMPEG_PATH && process.env.FFMPEG_PATH.trim()) {
    return process.env.FFMPEG_PATH.trim();
  }

  for (const candidate of getBundledFfmpegCandidates()) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  return 'ffmpeg';
};

const getFfmpegDiscoveryDirectory = () => path.join(app.getPath('userData'), 'ffmpeg');

const scoreFfmpegCandidate = (filePath) => {
  const normalized = String(filePath || '').replace(/\\/g, '/').toLowerCase();
  let score = 0;
  if (normalized.endsWith('/bin/ffmpeg.exe') || normalized.endsWith('/bin/ffmpeg')) score += 100;
  if (normalized.includes('/bin/')) score += 20;
  if (normalized.includes('ffmpeg')) score += 5;
  return score;
};

const findFfmpegExecutableInDirectory = async (rootPath) => {
  const rootStat = await stat(rootPath);
  if (rootStat.isFile()) {
    return isFfmpegExecutableName(rootPath) ? rootPath : null;
  }
  if (!rootStat.isDirectory()) return null;

  const queue = [{ dirPath: rootPath, depth: 0 }];
  const candidates = [];
  let visitedEntries = 0;

  while (queue.length > 0 && visitedEntries < FFMPEG_DISCOVERY_MAX_ENTRIES) {
    const { dirPath, depth } = queue.shift();
    let entries = [];
    try {
      entries = await readdir(dirPath, { withFileTypes: true });
    } catch {
      continue;
    }

    const orderedEntries = entries.sort((left, right) => {
      const leftName = left.name.toLowerCase();
      const rightName = right.name.toLowerCase();
      if (leftName === 'bin') return -1;
      if (rightName === 'bin') return 1;
      return leftName.localeCompare(rightName);
    });

    for (const entry of orderedEntries) {
      visitedEntries += 1;
      if (visitedEntries > FFMPEG_DISCOVERY_MAX_ENTRIES) break;

      const entryPath = path.join(dirPath, entry.name);
      if (entry.isFile() && isFfmpegExecutableName(entry.name)) {
        candidates.push(entryPath);
        continue;
      }
      if (entry.isDirectory() && depth < FFMPEG_DISCOVERY_MAX_DEPTH) {
        queue.push({ dirPath: entryPath, depth: depth + 1 });
      }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((left, right) => scoreFfmpegCandidate(right) - scoreFfmpegCandidate(left));
  return candidates[0];
};

const extractAndFindFfmpegExecutable = async (zipPath) => {
  const zipStat = await stat(zipPath);
  if (!zipStat.isFile()) return null;

  const hash = createHash('sha256')
    .update(`${zipPath}:${zipStat.size}:${zipStat.mtimeMs}`)
    .digest('hex')
    .slice(0, 16);
  const targetDir = path.join(getFfmpegDiscoveryDirectory(), hash);
  const markerPath = path.join(targetDir, '.lyricdisplay-ffmpeg-extracted');

  if (!await fileExists(markerPath)) {
    await rm(targetDir, { recursive: true, force: true });
    await mkdir(targetDir, { recursive: true });
    const extractZip = (await import('extract-zip')).default;
    await extractZip(zipPath, { dir: targetDir });
    await writeFile(markerPath, new Date().toISOString(), 'utf8');
  }

  return findFfmpegExecutableInDirectory(targetDir);
};

const resolveSelectedFfmpegPath = async (selectedPath) => {
  const selectedStat = await stat(selectedPath);
  if (selectedStat.isFile() && isFfmpegExecutableName(selectedPath)) {
    return {
      ffmpegPath: selectedPath,
      sourceType: 'executable',
    };
  }

  if (selectedStat.isFile() && isZipFile(selectedPath)) {
    const ffmpegPath = await extractAndFindFfmpegExecutable(selectedPath);
    return ffmpegPath
      ? { ffmpegPath, sourceType: 'zip', selectedPath }
      : { ffmpegPath: null, sourceType: 'zip', selectedPath };
  }

  if (selectedStat.isDirectory()) {
    const ffmpegPath = await findFfmpegExecutableInDirectory(selectedPath);
    return ffmpegPath
      ? { ffmpegPath, sourceType: 'directory', selectedPath }
      : { ffmpegPath: null, sourceType: 'directory', selectedPath };
  }

  return { ffmpegPath: null, sourceType: 'unknown', selectedPath };
};

const assertFfmpegAvailable = async (ffmpegPath) => new Promise((resolve, reject) => {
  console.info('[LyricVideoExport] FFmpeg availability probe spawning', { ffmpegPath });
  const child = spawn(ffmpegPath, ['-version'], { windowsHide: true, stdio: ['ignore', 'ignore', 'ignore'] });
  let settled = false;
  const timeout = setTimeout(() => {
    try {
      child.kill('SIGTERM');
    } catch { }
    console.warn('[LyricVideoExport] FFmpeg availability probe timed out', {
      ffmpegPath,
      timeoutMs: FFMPEG_READINESS_TIMEOUT_MS,
    });
    settle(reject, new Error('FFmpeg did not respond in time. Choose a valid ffmpeg executable or install FFmpeg on PATH.'));
  }, FFMPEG_READINESS_TIMEOUT_MS);

  const settle = (callback, value) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    callback(value);
  };

  child.once('error', (error) => {
    console.warn('[LyricVideoExport] FFmpeg availability probe failed to spawn', {
      ffmpegPath,
      error: error?.message || String(error),
    });
    settle(reject, new Error('FFmpeg was not found. Choose the FFmpeg executable in Lyric Video Studio, set FFMPEG_PATH, or install FFmpeg so it is available on PATH.'));
  });
  child.once('exit', (code) => {
    if (code === 0) {
      console.info('[LyricVideoExport] FFmpeg availability probe exited successfully', { ffmpegPath, code });
      settle(resolve);
    } else {
      console.warn('[LyricVideoExport] FFmpeg availability probe exited with failure', { ffmpegPath, code });
      settle(reject, new Error('FFmpeg is not available or could not be started.'));
    }
  });
});

const getFfmpegReadiness = async () => {
  const ffmpegPath = await resolveFfmpegPath();
  try {
    await assertFfmpegAvailable(ffmpegPath);
    return { available: true, ffmpegPath };
  } catch (error) {
    return {
      available: false,
      ffmpegPath,
      error: error?.message || 'FFmpeg is not available.',
    };
  }
};

const getExportFrameUrl = () => (
  isDev
    ? 'http://localhost:5173/lyric-video-export-frame'
    : 'http://127.0.0.1:4000#/lyric-video-export-frame'
);

const getHardwareEncoderCandidates = async () => {
  if (process.platform === 'win32') {
    return [
      { encoder: 'h264_nvenc', label: 'NVIDIA NVENC' },
      { encoder: 'h264_qsv', label: 'Intel Quick Sync' },
      { encoder: 'h264_amf', label: 'AMD AMF' },
    ];
  }

  if (process.platform === 'darwin') {
    return [{ encoder: 'h264_videotoolbox', label: 'Apple VideoToolbox' }];
  }

  if (process.platform === 'linux') {
    console.info('[LyricVideoExport] Hardware encoder probe skipped', {
      encoder: 'h264_vaapi',
      reason: 'VAAPI is disabled for the compositor export path until the hardware-upload graph is verified.',
    });
  }

  return [];
};

const getEncoderQualityArgs = ({ encoder, mode, width, height, fps }) => {
  if (encoder === 'libx264') {
    if (mode === 'best') return ['-preset', 'slow', '-crf', '18'];
    if (mode === 'faster') return ['-preset', 'ultrafast', '-crf', '23'];
    return ['-preset', 'veryfast', '-crf', '20'];
  }

  const pixelsPerSecond = Math.max(1, width * height * fps);
  const targetMbps = Math.round(Math.min(24, Math.max(4, (pixelsPerSecond * 0.07) / 1_000_000)));
  const maxrateMbps = Math.round(targetMbps * 1.5);
  const bufsizeMbps = Math.round(targetMbps * 2);

  if (encoder === 'h264_nvenc') return ['-preset', 'fast', '-b:v', `${targetMbps}M`, '-maxrate', `${maxrateMbps}M`, '-bufsize', `${bufsizeMbps}M`];
  if (encoder === 'h264_amf') return ['-quality', 'speed', '-b:v', `${targetMbps}M`, '-maxrate', `${maxrateMbps}M`, '-bufsize', `${bufsizeMbps}M`];
  if (encoder === 'h264_qsv') return ['-preset', 'veryfast', '-b:v', `${targetMbps}M`, '-maxrate', `${maxrateMbps}M`, '-bufsize', `${bufsizeMbps}M`];
  if (encoder === 'h264_videotoolbox') return ['-b:v', `${targetMbps}M`, '-maxrate', `${maxrateMbps}M`, '-bufsize', `${bufsizeMbps}M`];
  if (encoder === 'h264_vaapi') return ['-b:v', `${targetMbps}M`, '-maxrate', `${maxrateMbps}M`, '-bufsize', `${bufsizeMbps}M`];
  return [];
};

const getEncoderOutputArgs = ({ encoder, mode, width, height, fps }) => [
  '-c:v', encoder,
  ...getEncoderQualityArgs({ encoder, mode, width, height, fps }),
  '-pix_fmt', 'yuv420p',
];

const probeHardwareEncoder = async (ffmpegPath, candidate, exportSettings) => {
  const args = [
    '-hide_banner',
    '-loglevel', 'error',
    ...(candidate.extraInputArgs || []),
    '-f', 'lavfi',
    '-i', 'testsrc2=size=64x64:rate=1',
    '-frames:v', '1',
    '-an',
    ...(candidate.extraOutputArgs || []),
    ...getEncoderOutputArgs({
      encoder: candidate.encoder,
      mode: 'faster',
      width: exportSettings.width,
      height: exportSettings.height,
      fps: exportSettings.fps,
    }),
    '-f', 'null',
    '-',
  ];

  const result = await runProbeProcess(ffmpegPath, args, ENCODER_PROBE_TIMEOUT_MS, `${candidate.encoder} probe`);
  console.info('[LyricVideoExport] Hardware encoder probe result', {
    encoder: candidate.encoder,
    label: candidate.label,
    ok: result.ok,
    reason: result.reason,
    durationMs: result.durationMs,
    stderr: result.stderr,
  });
  return result;
};

const getVerifiedHardwareEncoder = async (ffmpegPath, exportSettings) => {
  const cacheKey = `${ffmpegPath}|${process.platform}`;
  if (!hardwareEncoderProbeCache.has(cacheKey)) {
    const candidates = await getHardwareEncoderCandidates();
    const results = [];
    let selected = null;

    for (const candidate of candidates) {
      const result = await probeHardwareEncoder(ffmpegPath, candidate, exportSettings);
      const entry = {
        encoder: candidate.encoder,
        label: candidate.label,
        ok: result.ok,
        reason: result.reason,
        durationMs: result.durationMs,
        stderr: result.stderr,
      };
      results.push(entry);
      if (result.ok && !selected) {
        selected = candidate;
        break;
      }
    }

    hardwareEncoderProbeCache.set(cacheKey, { selected, results });
  } else {
    console.info('[LyricVideoExport] Hardware encoder probe cache hit', { cacheKey });
  }

  return hardwareEncoderProbeCache.get(cacheKey);
};

const getSoftwareEncoderPlan = (mode) => ({
  encoder: 'libx264',
  label: mode === 'best' ? 'libx264 best quality' : mode === 'faster' ? 'libx264 faster fallback' : 'libx264 balanced',
  hardware: false,
  mode,
});

const resolveEncoderPlan = async ({ ffmpegPath, mode, exportSettings }) => {
  if (mode !== 'faster') {
    return {
      plan: getSoftwareEncoderPlan(mode),
      probe: null,
      fallbackReason: mode === 'best' ? 'Best quality mode uses libx264 for predictable quality.' : 'Balanced mode uses libx264 for broad compatibility.',
    };
  }

  const probe = await getVerifiedHardwareEncoder(ffmpegPath, exportSettings);
  if (probe?.selected) {
    return {
      plan: {
        ...probe.selected,
        hardware: true,
        mode,
      },
      probe,
      fallbackReason: null,
    };
  }

  return {
    plan: getSoftwareEncoderPlan(mode),
    probe,
    fallbackReason: 'No verified hardware H.264 encoder was available; using libx264.',
  };
};

const identifyPixelFormat = (samples) => {
  const expected = [
    [255, 0, 0, 255],
    [0, 255, 0, 255],
    [0, 0, 255, 255],
    [255, 255, 255, 255],
  ];
  const formatToBytes = {
    rgba: ([r, g, b, a]) => [r, g, b, a],
    bgra: ([r, g, b, a]) => [b, g, r, a],
    argb: ([r, g, b, a]) => [a, r, g, b],
    abgr: ([r, g, b, a]) => [a, b, g, r],
  };
  const matches = (actual, expectedBytes) => actual.every((value, index) => Math.abs(value - expectedBytes[index]) <= 2);
  return RAW_CAPTURE_FORMATS.find((format) => (
    samples.every((sample, index) => matches(sample, formatToBytes[format](expected[index])))
  )) || null;
};

const detectCaptureRawFormat = async (win) => {
  if (captureRawFormatCache) return captureRawFormatCache;

  const probeId = `lyric-video-raw-probe-${Date.now()}`;
  try {
    await win.webContents.executeJavaScript(`
      (() => {
        const existing = document.getElementById(${JSON.stringify(probeId)});
        if (existing) existing.remove();
        const overlay = document.createElement('div');
        overlay.id = ${JSON.stringify(probeId)};
        overlay.style.cssText = 'position:fixed;left:0;top:0;width:4px;height:1px;display:flex;z-index:2147483647;pointer-events:none;transform:none;opacity:1;';
        ['#ff0000', '#00ff00', '#0000ff', '#ffffff'].forEach((color) => {
          const pixel = document.createElement('div');
          pixel.style.cssText = 'width:1px;height:1px;background:' + color + ';flex:0 0 1px;';
          overlay.appendChild(pixel);
        });
        document.body.appendChild(overlay);
        return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      })()
    `, true);

    const image = await win.webContents.capturePage({ x: 0, y: 0, width: 4, height: 1 });
    const size = image.getSize();
    const bitmap = image.toBitmap();
    await win.webContents.executeJavaScript(`
      (() => {
        const probe = document.getElementById(${JSON.stringify(probeId)});
        if (probe) probe.remove();
        return true;
      })()
    `, true).catch(() => { });

    if (!size.width || !size.height || bitmap.length < size.width * size.height * 4) {
      captureRawFormatCache = { supported: false, reason: 'Unexpected bitmap dimensions from capture probe.' };
      console.warn('[LyricVideoExport] Raw capture probe failed', captureRawFormatCache);
      return captureRawFormatCache;
    }

    const samples = [0, 1, 2, 3].map((index) => {
      const x = Math.min(size.width - 1, Math.max(0, Math.floor(((index + 0.5) * size.width) / 4)));
      const offset = x * 4;
      return [bitmap[offset], bitmap[offset + 1], bitmap[offset + 2], bitmap[offset + 3]];
    });
    const pixelFormat = identifyPixelFormat(samples);
    captureRawFormatCache = pixelFormat
      ? { supported: true, pixelFormat, sampleWidth: size.width, sampleHeight: size.height }
      : { supported: false, reason: 'Captured bitmap channel order did not match a known raw video pixel format.', samples };

    const log = captureRawFormatCache.supported ? console.info : console.warn;
    log('[LyricVideoExport] Raw capture probe completed', captureRawFormatCache);
    return captureRawFormatCache;
  } catch (error) {
    try {
      await win.webContents.executeJavaScript(`
        (() => {
          const probe = document.getElementById(${JSON.stringify(probeId)});
          if (probe) probe.remove();
          return true;
        })()
      `, true);
    } catch { }
    captureRawFormatCache = {
      supported: false,
      reason: error?.message || 'Raw capture probe failed.',
    };
    console.warn('[LyricVideoExport] Raw capture probe failed', captureRawFormatCache);
    return captureRawFormatCache;
  }
};

const captureFrame = async ({ win, pipeline, rawPixelFormat }) => {
  const captureStarted = nowMs();
  const image = await win.webContents.capturePage();
  const captureMs = nowMs() - captureStarted;
  const size = image.getSize();
  const convertStarted = nowMs();
  let buffer;
  let nextPipeline = pipeline;
  let fallbackReason = null;

  if (pipeline === 'raw') {
    buffer = image.toBitmap();
    const expectedLength = size.width * size.height * 4;
    if (!rawPixelFormat || !size.width || !size.height || buffer.length !== expectedLength) {
      fallbackReason = `Raw frame was ${buffer.length} bytes; expected ${expectedLength} bytes for ${size.width}x${size.height}.`;
      buffer = image.toPNG();
      nextPipeline = 'png';
    }
  } else {
    buffer = image.toPNG();
  }

  const convertMs = nowMs() - convertStarted;
  return {
    buffer,
    size,
    pipeline: nextPipeline,
    fallbackReason,
    captureMs,
    convertMs,
  };
};

const getUploadDataRoots = () => {
  const userData = app.getPath('userData');
  return [
    path.join(userData, 'backend'),
    userData,
  ];
};

const getMediaUrlPathname = (urlPath) => {
  const text = String(urlPath || '').trim();
  if (!text) return '';
  try {
    if (/^[a-z][a-z\d+.-]*:\/\//i.test(text)) {
      return new URL(text).pathname;
    }
  } catch { }
  return text.split(/[?#]/)[0];
};

const getUploadedMediaPath = (urlPath) => {
  const pathname = getMediaUrlPathname(urlPath);
  const decoded = decodeURIComponent(pathname);
  const mappings = getUploadDataRoots().flatMap((dataRoot) => [
    {
      prefix: '/media/user-media/images/',
      dir: path.join(dataRoot, 'uploads', 'user-media', 'images'),
    },
    {
      prefix: '/media/user-media/videos/',
      dir: path.join(dataRoot, 'uploads', 'user-media', 'videos'),
    },
    {
      prefix: '/media/backgrounds/',
      dir: path.join(dataRoot, 'uploads', 'backgrounds'),
    },
  ]);

  const match = mappings.find(({ prefix }) => decoded.startsWith(prefix));
  if (!match) return null;

  const filename = path.basename(decoded.slice(match.prefix.length));
  if (!filename || filename !== decoded.slice(match.prefix.length)) return null;
  return path.join(match.dir, filename);
};

const resolveMediaFilePath = async (media = {}) => {
  if (!media?.url || media.dataUrl) return null;

  const candidates = [];
  if (media.bundled && typeof media.url === 'string') {
    candidates.push(resolveProductionPath('public', media.url.replace(/^[/\\]+/, '')));
  }

  const uploadedPath = getUploadedMediaPath(media.url);
  if (uploadedPath) candidates.push(uploadedPath);

  for (const candidate of candidates) {
    if (candidate && await fileExists(candidate)) {
      return candidate;
    }
  }

  return null;
};

const normalizeHexColor = (value, fallback = '#000000') => {
  const text = String(value || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(text)) return text;
  if (/^#[0-9a-f]{3}$/i.test(text)) {
    const [, r, g, b] = text;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return fallback;
};

const getBackgroundPlan = async (settings = {}) => {
  const fullScreenMode = settings.fullScreenMode !== false;
  const backgroundType = settings.fullScreenBackgroundType || 'color';
  const media = settings.fullScreenBackgroundMedia;

  if (fullScreenMode && backgroundType === 'media' && media) {
    const filePath = await resolveMediaFilePath(media);
    if (filePath && isVideoMedia(media)) {
      return { type: 'video', filePath, source: media.url };
    }
    if (filePath && isImageMedia(media)) {
      return { type: 'image', filePath, source: media.url };
    }
    if (isVideoMedia(media)) {
      throw new Error('The selected background video could not be resolved to a local media file for export. Re-select it from User Media and try again.');
    }
  }

  const paint = settings.fullScreenBackgroundPaint;
  if (fullScreenMode && backgroundType === 'color' && (!paint || paint.type !== 'linear')) {
    return {
      type: 'color',
      color: normalizeHexColor(paint?.color || settings.fullScreenBackgroundColor || '#000000'),
    };
  }

  return { type: 'capture' };
};

const setExportRenderMode = async (win, mode) => {
  await win.webContents.executeJavaScript(
    `window.__lyricVideoExportSetRenderMode(${JSON.stringify(mode)})`,
    true
  );
};

const captureStaticBackground = async ({ win, exportState }) => {
  const tempDir = await mkdtemp(path.join(app.getPath('temp'), 'lyric-video-background-'));
  exportState.tempDirs.push(tempDir);
  const backgroundPath = path.join(tempDir, 'background.png');
  await setExportRenderMode(win, 'background');
  const image = await win.webContents.capturePage();
  await writeFile(backgroundPath, image.toPNG());
  return backgroundPath;
};

const createBackgroundInput = ({ plan, width, height, fps }) => {
  if (plan.type === 'video') {
    return {
      inputArgs: ['-stream_loop', '-1', '-i', plan.filePath],
      filterInput: '[1:v]',
    };
  }

  if (plan.type === 'image' || plan.type === 'capture') {
    return {
      inputArgs: ['-loop', '1', '-framerate', String(fps), '-i', plan.filePath],
      filterInput: '[1:v]',
    };
  }

  return {
    inputArgs: ['-f', 'lavfi', '-i', `color=c=${String(plan.color || '#000000').replace('#', '0x')}:s=${width}x${height}:r=${fps}`],
    filterInput: '[1:v]',
  };
};

const createExportWindow = ({ width, height }) => (
  new BrowserWindow({
    width,
    height,
    show: false,
    frame: false,
    resizable: false,
    transparent: true,
    backgroundColor: '#00000000',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: resolveProductionPath('preload.js'),
    },
  })
);

const waitForExportApi = async (win) => {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (!win || win.isDestroyed()) {
      throw new Error('Export renderer was closed before it initialized.');
    }

    const ready = await win.webContents.executeJavaScript(
      'typeof window.__lyricVideoExportLoad === "function" && typeof window.__lyricVideoExportSeek === "function"',
      true
    ).catch(() => false);

    if (ready) return;
    await sleep(50);
  }

  throw new Error('Export renderer did not initialize.');
};

const sanitizeIntro = (intro = {}) => {
  const enabled = Boolean(intro?.enabled);
  return {
    enabled,
    title: String(intro?.title || '').slice(0, 120),
    subtitle: String(intro?.subtitle || '').slice(0, 160),
    details: String(intro?.details || '').slice(0, 400),
    durationMs: enabled
      ? clampNumber(intro?.durationMs, 3000, 500, 30_000)
      : 0,
  };
};

const sanitizeExportPayload = (payload = {}) => {
  const settings = payload.exportSettings || {};
  const width = clampNumber(settings.width, 1920, 320, 7680);
  const height = clampNumber(settings.height, 1080, 180, 4320);
  const fps = clampNumber(settings.fps, 30, 1, 120);
  const introPaddingMs = clampNumber(settings.introPaddingMs, 0, 0, 300_000);
  const outroPaddingMs = clampNumber(settings.outroPaddingMs, 3000, 0, 300_000);
  const intro = sanitizeIntro(payload.intro || payload.openingScreen);
  const performanceMode = EXPORT_PERFORMANCE_MODES.has(settings.performanceMode)
    ? settings.performanceMode
    : 'balanced';
  const audioDurationMs = clampNumber(payload.audio?.durationMs, 0, 0, 24 * 60 * 60 * 1000);
  const totalDurationMs = Math.max(1000, intro.durationMs + introPaddingMs + audioDurationMs + outroPaddingMs);
  const lyrics = Array.isArray(payload.lyrics)
    ? payload.lyrics.slice(0, 5000).map((line) => String(line ?? '').slice(0, 1000))
    : [];
  const timestamps = Array.isArray(payload.timestamps)
    ? payload.timestamps.slice(0, lyrics.length).map((timestamp) => {
        const parsed = Number(timestamp);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
      })
    : [];
  const gapBehavior = VALID_GAP_BEHAVIORS.has(payload.gapBehavior)
    ? payload.gapBehavior
    : 'background-only';

  return {
    lyrics,
    timestamps,
    offsetMs: clampNumber(payload.offsetMs, 0, -600_000, 600_000),
    gapBehavior,
    clearAfterMs: clampNumber(payload.clearAfterMs, 2500, 0, 300_000),
    title: sanitizeFileNamePart(payload.title || 'Lyric Video', 'Lyric Video'),
    settings: payload.settings || {},
    intro,
    audio: {
      filePath: typeof payload.audio?.filePath === 'string' ? payload.audio.filePath : '',
      durationMs: audioDurationMs,
    },
    exportSettings: {
      format: 'mp4',
      width: Math.round(width / 2) * 2,
      height: Math.round(height / 2) * 2,
      fps,
      introPaddingMs,
      outroPaddingMs,
      introDurationMs: intro.durationMs,
      performanceMode,
      totalDurationMs,
    },
  };
};

const hasUsableTimedLyrics = (payload) => (
  payload.lyrics.length > 0
  && payload.timestamps.some((timestamp, index) => (
    index < payload.lyrics.length
    && typeof timestamp === 'number'
    && Number.isFinite(timestamp)
    && timestamp >= 0
  ))
);

export function registerLyricVideoExportHandlers() {
  ipcMain.handle('lyric-video:get-export-readiness', async (_event, payload = {}) => {
    const requestId = payload?.requestId || `main-${Date.now()}`;
    const source = payload?.source || 'unknown';
    console.info('[LyricVideoExport] FFmpeg readiness check started', { requestId, source });
    const result = await getFfmpegReadiness();
    const log = result.available ? console.info : console.warn;
    log('[LyricVideoExport] FFmpeg readiness check completed', {
      requestId,
      source,
      available: result.available,
      ffmpegPath: result.ffmpegPath,
      error: result.error,
    });
    return result;
  });

  ipcMain.handle('lyric-video:select-ffmpeg', async (event) => {
    const win = event.sender ? BrowserWindow.fromWebContents(event.sender) : null;
    const result = await dialog.showOpenDialog(win || undefined, {
      title: 'Choose FFmpeg Executable, Folder, or Zip',
      properties: ['openFile', 'openDirectory'],
      filters: process.platform === 'win32'
        ? [
            { name: 'FFmpeg executable or zip', extensions: ['exe', 'zip'] },
            { name: 'All Files', extensions: ['*'] },
          ]
        : [
            { name: 'FFmpeg archive', extensions: ['zip'] },
            { name: 'All Files', extensions: ['*'] },
          ],
    });

    if (result.canceled || !result.filePaths?.[0]) {
      return { success: false, canceled: true };
    }

    const selectedPath = result.filePaths[0];
    let resolved;
    try {
      resolved = await resolveSelectedFfmpegPath(selectedPath);
    } catch (error) {
      return {
        success: false,
        selectedPath,
        error: error?.message || 'The selected FFmpeg file, folder, or zip could not be inspected.',
      };
    }

    const ffmpegPath = resolved.ffmpegPath;
    if (!ffmpegPath) {
      return {
        success: false,
        selectedPath,
        sourceType: resolved.sourceType,
        error: process.platform === 'win32'
          ? 'Choose ffmpeg.exe directly, the extracted FFmpeg folder, or the downloaded FFmpeg zip. Installers and source-code archives do not contain a usable ffmpeg.exe.'
          : 'Choose ffmpeg directly, the extracted FFmpeg folder, or a downloaded FFmpeg zip. Installers and source-code archives do not contain a usable ffmpeg binary.',
      };
    }

    try {
      await assertFfmpegAvailable(ffmpegPath);
      userPreferences.setPreference('advanced.ffmpegPath', ffmpegPath);
      return {
        success: true,
        ffmpegPath,
        selectedPath,
        sourceType: resolved.sourceType,
      };
    } catch (error) {
      return {
        success: false,
        ffmpegPath,
        selectedPath,
        sourceType: resolved.sourceType,
        error: error?.message || 'Selected file could not be used as FFmpeg.',
      };
    }
  });

  ipcMain.handle('lyric-video:cancel-export', async () => {
    if (!activeExport) {
      return { success: true };
    }

    const exportState = activeExport;
    const exportDonePromise = exportState.donePromise;
    exportState.canceled = true;
    try {
      exportState.ffmpeg?.stdin?.destroy?.();
    } catch { }
    try {
      exportState.ffmpeg?.kill('SIGTERM');
    } catch { }
    try {
      exportState.window?.destroy();
    } catch { }

    if (exportDonePromise) {
      const timedOut = await Promise.race([
        exportDonePromise,
        sleep(8000).then(() => 'timeout'),
      ]);
      if (timedOut === 'timeout' && activeExport === exportState) {
        console.warn('[LyricVideoExport] Force-clearing stale export after cancellation timeout');
        activeExport = null;
        exportState.resolveDone?.('forced');
      }
    }

    return { success: true };
  });

  ipcMain.handle('lyric-video:export-video', async (event, payload = {}) => {
    if (activeExport) {
      return { success: false, error: 'A lyric video export is already running' };
    }

    const normalized = sanitizeExportPayload(payload);
    if (!normalized.audio.filePath || !path.isAbsolute(normalized.audio.filePath)) {
      return { success: false, error: 'Select an audio file from the desktop app before exporting.' };
    }
    if (!normalized.audio.durationMs) {
      return { success: false, error: 'Audio metadata is not ready yet. Wait for the audio duration to load before exporting.' };
    }
    if (!hasUsableTimedLyrics(normalized)) {
      return { success: false, error: 'Timed lyrics are required for export.' };
    }

    try {
      const audioStat = await stat(normalized.audio.filePath);
      if (!audioStat.isFile()) {
        return { success: false, error: 'The selected audio path is not a file.' };
      }
    } catch {
      return { success: false, error: 'The selected audio file could not be read. It may have been moved or deleted.' };
    }

    const win = event.sender ? BrowserWindow.fromWebContents(event.sender) : null;
    const saveResult = await dialog.showSaveDialog(win || undefined, {
      title: 'Export Lyric Video',
      defaultPath: ensureMp4FileName(sanitizeFileNamePart(normalized.title, 'lyric-video')),
      filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
    });

    if (saveResult.canceled || !saveResult.filePath) {
      return { success: false, canceled: true };
    }

    const outputPath = saveResult.filePath.toLowerCase().endsWith('.mp4')
      ? saveResult.filePath
      : `${saveResult.filePath}.mp4`;
    const ffmpegPath = await resolveFfmpegPath();
    const { width, height, fps, introPaddingMs, introDurationMs, totalDurationMs } = normalized.exportSettings;
    const frameCount = Math.max(1, Math.ceil((totalDurationMs / 1000) * fps));
    const frameDurationMs = 1000 / fps;

    if (frameCount > MAX_EXPORT_FRAMES) {
      return {
        success: false,
        error: `Export is too long for the selected frame rate (${frameCount.toLocaleString()} frames). Lower FPS or shorten the audio/outro before exporting.`,
      };
    }

    let exportWindow = null;
    let ffmpeg = null;

    let resolveExportDone = null;
    const donePromise = new Promise((resolve) => {
      resolveExportDone = resolve;
    });
    const exportState = {
      canceled: false,
      window: null,
      ffmpeg: null,
      donePromise,
      resolveDone: resolveExportDone,
      tempDirs: [],
    };
    activeExport = exportState;

    const sendProgress = (progress) => {
      try {
        event.sender.send('lyric-video:export-progress', progress);
      } catch { }
    };

    try {
      await assertFfmpegAvailable(ffmpegPath);

      exportWindow = createExportWindow({ width, height });
      exportState.window = exportWindow;
      const loadPromise = waitForLoad(exportWindow);
      exportWindow.loadURL(getExportFrameUrl());
      await loadPromise;
      await waitForExportApi(exportWindow);

      await exportWindow.webContents.executeJavaScript(
        `window.__lyricVideoExportLoad(${JSON.stringify(normalized)})`,
        true
      );

      let backgroundPlan = await getBackgroundPlan(normalized.settings);
      if (backgroundPlan.type === 'capture') {
        const filePath = await captureStaticBackground({ win: exportWindow, exportState });
        backgroundPlan = { ...backgroundPlan, filePath };
      }
      await setExportRenderMode(exportWindow, 'overlay');
      console.info('[LyricVideoExport] Background compositor plan selected', {
        type: backgroundPlan.type,
        filePath: backgroundPlan.filePath,
        source: backgroundPlan.source,
        color: backgroundPlan.color,
      });

      const requestedMode = normalized.exportSettings.performanceMode;
      const encoderSelection = await resolveEncoderPlan({
        ffmpegPath,
        mode: requestedMode,
        exportSettings: normalized.exportSettings,
      });

      if (encoderSelection.fallbackReason) {
        console.info('[LyricVideoExport] Encoder fallback selected before export', {
          mode: requestedMode,
          reason: encoderSelection.fallbackReason,
        });
      }

      const runExportAttempt = async ({ encoderPlan, attempt, retryReason = null }) => {
        const attemptStartedAt = nowMs();
        const metrics = {
          seekMs: 0,
          captureMs: 0,
          convertMs: 0,
          writeWaitMs: 0,
          framesCaptured: 0,
          framesWritten: 0,
          inputBytes: 0,
        };
        let stderr = '';
        let pipeline = 'png';
        let rawProbe = null;
        let firstFrame = null;

        if (exportState.canceled) {
          throw new Error('Export canceled');
        }

        const allowRawPipeline = requestedMode === 'faster' && Boolean(encoderPlan.hardware);
        if (allowRawPipeline) {
          rawProbe = await detectCaptureRawFormat(exportWindow);
          if (rawProbe.supported) {
            pipeline = 'raw';
          }
        }

        const seekAndCapture = async (frame, desiredPipeline) => {
          const timelineTimeMs = Math.max(0, frame * frameDurationMs);
          const seekStarted = nowMs();
          await exportWindow.webContents.executeJavaScript(
            `window.__lyricVideoExportSeek(${timelineTimeMs})`,
            true
          );
          metrics.seekMs += nowMs() - seekStarted;
          const captured = await captureFrame({
            win: exportWindow,
            pipeline: desiredPipeline,
            rawPixelFormat: rawProbe?.pixelFormat,
          });
          metrics.captureMs += captured.captureMs;
          metrics.convertMs += captured.convertMs;
          metrics.framesCaptured += 1;
          return captured;
        };

        sendProgress({ phase: attempt > 1 ? 'retrying' : 'rendering', frame: 0, frameCount, percent: 0 });
        firstFrame = await seekAndCapture(0, pipeline);
        if (firstFrame.fallbackReason) {
          console.warn('[LyricVideoExport] Raw frame pipeline disabled after first capture', {
            reason: firstFrame.fallbackReason,
          });
        }
        pipeline = firstFrame.pipeline;

        const inputArgs = pipeline === 'raw'
          ? [
              '-f', 'rawvideo',
              '-pix_fmt', rawProbe.pixelFormat,
              '-video_size', `${firstFrame.size.width}x${firstFrame.size.height}`,
              '-framerate', String(fps),
              '-i', 'pipe:0',
            ]
          : [
              '-f', 'image2pipe',
              '-framerate', String(fps),
              '-i', 'pipe:0',
            ];
        const backgroundInput = createBackgroundInput({
          plan: backgroundPlan,
          width: firstFrame.size.width,
          height: firstFrame.size.height,
          fps,
        });
        const filterComplex = [
          `${backgroundInput.filterInput}scale=${firstFrame.size.width}:${firstFrame.size.height}:force_original_aspect_ratio=increase,crop=${firstFrame.size.width}:${firstFrame.size.height},setsar=1,fps=${fps},format=rgba[bg]`,
          '[0:v]format=rgba[ov]',
          '[bg][ov]overlay=0:0:format=auto,format=yuv420p[v]',
        ].join(';');

        const ffmpegArgs = [
          '-y',
          '-hide_banner',
          ...(encoderPlan.extraInputArgs || []),
          ...inputArgs,
          ...backgroundInput.inputArgs,
          '-itsoffset', String((introDurationMs + introPaddingMs) / 1000),
          '-i', normalized.audio.filePath,
          '-filter_complex', filterComplex,
          '-map', '[v]',
          '-map', '2:a:0?',
          ...(encoderPlan.extraOutputArgs || []),
          ...getEncoderOutputArgs({
            encoder: encoderPlan.encoder,
            mode: encoderPlan.mode,
            width: firstFrame.size.width,
            height: firstFrame.size.height,
            fps,
          }),
          '-c:a', 'aac',
          '-t', String(totalDurationMs / 1000),
          '-movflags', '+faststart',
          outputPath,
        ];

        console.info('[LyricVideoExport] Export attempt starting', {
          attempt,
          retryReason,
          mode: requestedMode,
          encoder: encoderPlan.encoder,
          encoderLabel: encoderPlan.label,
          hardware: Boolean(encoderPlan.hardware),
          pipeline,
          backgroundType: backgroundPlan.type,
          introDurationMs,
          rawPixelFormat: pipeline === 'raw' ? rawProbe.pixelFormat : null,
          frameCount,
          fps,
          requestedResolution: `${width}x${height}`,
          captureResolution: `${firstFrame.size.width}x${firstFrame.size.height}`,
          outputPath,
        });

        ffmpeg = spawn(ffmpegPath, ffmpegArgs, {
          windowsHide: true,
          stdio: ['pipe', 'ignore', 'pipe'],
        });
        exportState.ffmpeg = ffmpeg;
        const ffmpegExit = new Promise((resolve) => {
          ffmpeg.once('exit', (...args) => resolve(args));
        });

        ffmpeg.stderr.on('data', (chunk) => {
          stderr += chunk.toString();
          if (stderr.length > 12000) {
            stderr = stderr.slice(-12000);
          }
        });

        let ffmpegFailure = null;
        ffmpeg.once('error', (error) => {
          ffmpegFailure = error;
        });
        ffmpeg.stdin?.on('error', (error) => {
          ffmpegFailure = error;
          if (!exportState.canceled) {
            console.warn('[LyricVideoExport] FFmpeg stdin error', {
              error: error?.message || String(error),
              code: error?.code,
            });
          }
        });
        ffmpeg.once('exit', (code) => {
          if (code !== 0 && !ffmpegFailure) {
            ffmpegFailure = new Error(`FFmpeg exited with code ${code}`);
          }
        });

        const writeFrame = async (frameBuffer) => {
          if (ffmpegFailure) {
            throw ffmpegFailure;
          }
          const writeStarted = nowMs();
          await writeToStream(ffmpeg.stdin, frameBuffer);
          if (ffmpegFailure) {
            throw ffmpegFailure;
          }
          metrics.writeWaitMs += nowMs() - writeStarted;
          metrics.framesWritten += 1;
          metrics.inputBytes += frameBuffer.length;
        };

        try {
          await writeFrame(firstFrame.buffer);
          sendProgress({
            phase: 'rendering',
            frame: 1,
            frameCount,
            percent: Math.round((1 / frameCount) * 100),
          });

          for (let frame = 1; frame < frameCount; frame += 1) {
            if (exportState.canceled) {
              throw new Error('Export canceled');
            }

            const captured = await seekAndCapture(frame, pipeline);
            if (captured.pipeline !== pipeline) {
              throw new Error('Frame pipeline changed during export. Try again with the PNG compatibility path.');
            }
            await writeFrame(captured.buffer);

            if (frame === frameCount - 1 || frame % Math.max(1, Math.floor(fps / 2)) === 0) {
              sendProgress({
                phase: 'rendering',
                frame: frame + 1,
                frameCount,
                percent: Math.round(((frame + 1) / frameCount) * 100),
              });
            }
          }

          ffmpeg.stdin.end();
          const inputEndedAt = nowMs();
          sendProgress({ phase: 'encoding', frame: frameCount, frameCount, percent: 100 });

          const [exitCode] = await ffmpegExit;
          const completedAt = nowMs();
          if (exportState.canceled) {
            return { canceled: true };
          }
          if (exitCode !== 0) {
            const error = new Error(`FFmpeg export failed.${stderr ? `\n${stderr}` : ''}`);
            error.encoderPlan = encoderPlan;
            error.stderr = stderr;
            throw error;
          }

          const durationMs = completedAt - attemptStartedAt;
          console.info('[LyricVideoExport] Export attempt completed', {
            attempt,
            mode: requestedMode,
            encoder: encoderPlan.encoder,
            hardware: Boolean(encoderPlan.hardware),
            pipeline,
            durationMs: Math.round(durationMs),
            postInputEncodeMs: Math.round(completedAt - inputEndedAt),
            frameCount,
            framesCaptured: metrics.framesCaptured,
            framesWritten: metrics.framesWritten,
            fps,
            resolution: `${firstFrame.size.width}x${firstFrame.size.height}`,
            avgSeekMs: Math.round(metrics.seekMs / Math.max(1, metrics.framesCaptured)),
            avgCaptureMs: Math.round(metrics.captureMs / Math.max(1, metrics.framesCaptured)),
            avgConvertMs: Math.round(metrics.convertMs / Math.max(1, metrics.framesCaptured)),
            avgWriteWaitMs: Math.round(metrics.writeWaitMs / Math.max(1, metrics.framesWritten)),
            inputMb: Number((metrics.inputBytes / 1024 / 1024).toFixed(1)),
          });

          return { success: true, outputPath };
        } catch (error) {
          try {
            if (ffmpeg && !ffmpeg.killed) {
              ffmpeg.stdin?.destroy?.();
              ffmpeg.kill('SIGTERM');
            }
          } catch { }
          error.encoderPlan = error.encoderPlan || encoderPlan;
          error.stderr = error.stderr || stderr;
          console.warn('[LyricVideoExport] Export attempt failed', {
            attempt,
            mode: requestedMode,
            encoder: encoderPlan.encoder,
            hardware: Boolean(encoderPlan.hardware),
            pipeline,
            frameCount,
            framesCaptured: metrics.framesCaptured,
            framesWritten: metrics.framesWritten,
            error: error?.message || String(error),
            stderr: stderr.slice(-2000),
          });
          throw error;
        } finally {
          if (activeExport === exportState) {
            exportState.ffmpeg = null;
          }
          ffmpeg = null;
        }
      };

      let attemptResult;
      try {
        attemptResult = await runExportAttempt({
          encoderPlan: encoderSelection.plan,
          attempt: 1,
        });
      } catch (error) {
        if (exportState.canceled || error?.message === 'Export canceled') {
          return { success: false, canceled: true };
        }
        if (encoderSelection.plan.hardware) {
          const retryReason = error?.message || 'Hardware encoder failed.';
          console.warn('[LyricVideoExport] Retrying export with libx264 after hardware encoder failure', {
            failedEncoder: encoderSelection.plan.encoder,
            retryReason,
          });
          attemptResult = await runExportAttempt({
            encoderPlan: getSoftwareEncoderPlan('faster'),
            attempt: 2,
            retryReason,
          });
        } else {
          throw error;
        }
      }

      if (attemptResult?.canceled || exportState.canceled) {
        return { success: false, canceled: true };
      }

      sendProgress({ phase: 'complete', frame: frameCount, frameCount, percent: 100, outputPath });
      return { success: true, outputPath };
    } catch (error) {
      if (exportState.canceled || error?.message === 'Export canceled') {
        return { success: false, canceled: true };
      }
      return { success: false, error: error?.message || 'Failed to export lyric video' };
    } finally {
      try {
        if (ffmpeg && !ffmpeg.killed) {
          ffmpeg.stdin?.destroy?.();
        }
      } catch { }
      try {
        exportWindow?.destroy();
      } catch { }
      await Promise.allSettled((exportState.tempDirs || []).map((tempDir) => (
        rm(tempDir, { recursive: true, force: true })
      )));
      if (activeExport === exportState) {
        activeExport = null;
      }
      resolveExportDone?.();
    }
  });
}
