import { BrowserWindow, dialog, ipcMain } from 'electron';
import { spawn } from 'child_process';
import { once } from 'events';
import path from 'path';
import { isDev, resolveProductionPath } from '../paths.js';

let activeExport = null;

const clampNumber = (value, fallback, min, max) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
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
  if (!stream.write(chunk)) {
    await once(stream, 'drain');
  }
};

const assertFfmpegAvailable = async (ffmpegPath) => new Promise((resolve, reject) => {
  const child = spawn(ffmpegPath, ['-version'], { windowsHide: true });
  child.once('error', () => reject(new Error('FFmpeg was not found. Install FFmpeg and make sure ffmpeg is available on PATH.')));
  child.once('exit', (code) => {
    if (code === 0) resolve();
    else reject(new Error('FFmpeg is not available or could not be started.'));
  });
});

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

const sanitizeExportPayload = (payload = {}) => {
  const settings = payload.exportSettings || {};
  const width = clampNumber(settings.width, 1920, 320, 7680);
  const height = clampNumber(settings.height, 1080, 180, 4320);
  const fps = clampNumber(settings.fps, 30, 1, 120);
  const introPaddingMs = clampNumber(settings.introPaddingMs, 0, 0, 300_000);
  const outroPaddingMs = clampNumber(settings.outroPaddingMs, 3000, 0, 300_000);
  const audioDurationMs = clampNumber(payload.audio?.durationMs, 0, 0, 24 * 60 * 60 * 1000);
  const totalDurationMs = Math.max(1000, introPaddingMs + audioDurationMs + outroPaddingMs);

  return {
    lyrics: Array.isArray(payload.lyrics) ? payload.lyrics : [],
    timestamps: Array.isArray(payload.timestamps) ? payload.timestamps : [],
    offsetMs: clampNumber(payload.offsetMs, 0, -600_000, 600_000),
    gapBehavior: payload.gapBehavior || 'background-only',
    clearAfterMs: clampNumber(payload.clearAfterMs, 2500, 0, 300_000),
    title: String(payload.title || 'Lyric Video'),
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

export function registerLyricVideoExportHandlers() {
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
    if (!normalized.lyrics.length || !normalized.timestamps.length) {
      return { success: false, error: 'Timed lyrics are required for export.' };
    }

    const win = event.sender ? BrowserWindow.fromWebContents(event.sender) : null;
    const saveResult = await dialog.showSaveDialog(win || undefined, {
      title: 'Export Lyric Video',
      defaultPath: `${normalized.title || 'lyric-video'}.mp4`,
      filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
    });

    if (saveResult.canceled || !saveResult.filePath) {
      return { success: false, canceled: true };
    }

    const outputPath = saveResult.filePath.toLowerCase().endsWith('.mp4')
      ? saveResult.filePath
      : `${saveResult.filePath}.mp4`;
    const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
    const { width, height, fps, introPaddingMs, totalDurationMs } = normalized.exportSettings;
    const frameCount = Math.max(1, Math.ceil((totalDurationMs / 1000) * fps));
    const frameDurationMs = 1000 / fps;

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

      await exportWindow.webContents.executeJavaScript(
        `window.__lyricVideoExportLoad(${JSON.stringify(normalized)})`,
        true
      );

      const ffmpegArgs = [
        '-y',
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
