import { BrowserWindow, dialog, ipcMain } from 'electron';
import { spawn } from 'child_process';
import { once } from 'events';
import { access, stat } from 'fs/promises';
import { constants as fsConstants } from 'fs';
import path from 'path';
import { isDev, resolveProductionPath } from '../paths.js';
import * as userPreferences from '../userPreferences.js';

let activeExport = null;

const MAX_EXPORT_FRAMES = 250_000;
const FFMPEG_READINESS_TIMEOUT_MS = 6000;
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

const sanitizeFileNamePart = (value, fallback = 'lyric-video') => {
  const cleaned = String(value || fallback)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return cleaned || fallback;
};

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
  if (!stream || stream.destroyed) {
    throw new Error('FFmpeg input stream is closed.');
  }

  await new Promise((resolve, reject) => {
    stream.write(chunk, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
};

const getFfmpegExecutableNames = () => (
  process.platform === 'win32' ? ['ffmpeg.exe', 'ffmpeg'] : ['ffmpeg']
);

const isFfmpegExecutableName = (filePath) => {
  const fileName = path.basename(String(filePath || '')).toLowerCase();
  return getFfmpegExecutableNames().includes(fileName);
};

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

const createExportWindow = ({ width, height }) => (
  new BrowserWindow({
    width,
    height,
    show: false,
    frame: false,
    resizable: false,
    transparent: false,
    backgroundColor: '#000000',
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

const sanitizeExportPayload = (payload = {}) => {
  const settings = payload.exportSettings || {};
  const width = clampNumber(settings.width, 1920, 320, 7680);
  const height = clampNumber(settings.height, 1080, 180, 4320);
  const fps = clampNumber(settings.fps, 30, 1, 120);
  const introPaddingMs = clampNumber(settings.introPaddingMs, 0, 0, 300_000);
  const outroPaddingMs = clampNumber(settings.outroPaddingMs, 3000, 0, 300_000);
  const audioDurationMs = clampNumber(payload.audio?.durationMs, 0, 0, 24 * 60 * 60 * 1000);
  const totalDurationMs = Math.max(1000, introPaddingMs + audioDurationMs + outroPaddingMs);
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
      title: 'Choose FFmpeg Executable',
      properties: ['openFile'],
      filters: process.platform === 'win32'
        ? [{ name: 'FFmpeg executable', extensions: ['exe'] }]
        : [{ name: 'All Files', extensions: ['*'] }],
    });

    if (result.canceled || !result.filePaths?.[0]) {
      return { success: false, canceled: true };
    }

    const ffmpegPath = result.filePaths[0];
    if (!isFfmpegExecutableName(ffmpegPath)) {
      return {
        success: false,
        ffmpegPath,
        error: process.platform === 'win32'
          ? 'Choose the actual FFmpeg executable named ffmpeg.exe, not an installer or source-code download.'
          : 'Choose the actual FFmpeg executable named ffmpeg, not an installer or source-code download.',
      };
    }

    try {
      await assertFfmpegAvailable(ffmpegPath);
      userPreferences.setPreference('advanced.ffmpegPath', ffmpegPath);
      return { success: true, ffmpegPath };
    } catch (error) {
      return {
        success: false,
        ffmpegPath,
        error: error?.message || 'Selected file could not be used as FFmpeg.',
      };
    }
  });

  ipcMain.handle('lyric-video:cancel-export', () => {
    if (!activeExport) {
      return { success: true };
    }

    activeExport.canceled = true;
    try {
      activeExport.ffmpeg?.kill('SIGTERM');
    } catch { }
    try {
      activeExport.window?.destroy();
    } catch { }

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
      defaultPath: `${sanitizeFileNamePart(normalized.title, 'lyric-video')}.mp4`,
      filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
    });

    if (saveResult.canceled || !saveResult.filePath) {
      return { success: false, canceled: true };
    }

    const outputPath = saveResult.filePath.toLowerCase().endsWith('.mp4')
      ? saveResult.filePath
      : `${saveResult.filePath}.mp4`;
    const ffmpegPath = await resolveFfmpegPath();
    const { width, height, fps, introPaddingMs, totalDurationMs } = normalized.exportSettings;
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

    activeExport = { canceled: false, window: null, ffmpeg: null };

    const sendProgress = (progress) => {
      try {
        event.sender.send('lyric-video:export-progress', progress);
      } catch { }
    };

    try {
      await assertFfmpegAvailable(ffmpegPath);

      exportWindow = createExportWindow({ width, height });
      activeExport.window = exportWindow;
      const loadPromise = waitForLoad(exportWindow);
      exportWindow.loadURL(getExportFrameUrl());
      await loadPromise;
      await waitForExportApi(exportWindow);

      await exportWindow.webContents.executeJavaScript(
        `window.__lyricVideoExportLoad(${JSON.stringify(normalized)})`,
        true
      );

      const ffmpegArgs = [
        '-y',
        '-hide_banner',
        '-f', 'image2pipe',
        '-framerate', String(fps),
        '-i', 'pipe:0',
        '-itsoffset', String(introPaddingMs / 1000),
        '-i', normalized.audio.filePath,
        '-map', '0:v:0',
        '-map', '1:a:0?',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-t', String(totalDurationMs / 1000),
        '-movflags', '+faststart',
        outputPath,
      ];

      ffmpeg = spawn(ffmpegPath, ffmpegArgs, {
        windowsHide: true,
        stdio: ['pipe', 'ignore', 'pipe'],
      });
      activeExport.ffmpeg = ffmpeg;

      let stderr = '';
      ffmpeg.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
        if (stderr.length > 8000) {
          stderr = stderr.slice(-8000);
        }
      });

      const ffmpegError = new Promise((_, reject) => {
        ffmpeg.once('error', reject);
      });

      sendProgress({ phase: 'rendering', frame: 0, frameCount, percent: 0 });

      for (let frame = 0; frame < frameCount; frame += 1) {
        if (activeExport?.canceled) {
          throw new Error('Export canceled');
        }

        const timelineTimeMs = Math.max(0, (frame * frameDurationMs) - introPaddingMs);
        await exportWindow.webContents.executeJavaScript(
          `window.__lyricVideoExportSeek(${timelineTimeMs})`,
          true
        );
        const image = await exportWindow.webContents.capturePage();
        await Promise.race([
          writeToStream(ffmpeg.stdin, image.toPNG()),
          ffmpegError,
        ]);

        if (frame === 0 || frame === frameCount - 1 || frame % Math.max(1, Math.floor(fps / 2)) === 0) {
          sendProgress({
            phase: 'rendering',
            frame: frame + 1,
            frameCount,
            percent: Math.round(((frame + 1) / frameCount) * 100),
          });
        }
      }

      ffmpeg.stdin.end();
      sendProgress({ phase: 'encoding', frame: frameCount, frameCount, percent: 100 });

      const [exitCode] = await once(ffmpeg, 'exit');
      if (activeExport?.canceled) {
        return { success: false, canceled: true };
      }
      if (exitCode !== 0) {
        throw new Error(`FFmpeg export failed.${stderr ? `\n${stderr}` : ''}`);
      }

      sendProgress({ phase: 'complete', frame: frameCount, frameCount, percent: 100, outputPath });
      return { success: true, outputPath };
    } catch (error) {
      if (activeExport?.canceled || error?.message === 'Export canceled') {
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
      activeExport = null;
    }
  });
}
