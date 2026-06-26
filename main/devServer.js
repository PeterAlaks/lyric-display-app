import { spawn } from 'child_process';
import path from 'path';
import { appRoot, isDev } from './paths.js';

let obsDockDevServerProcess = null;

const VITE_READY_URL = 'http://127.0.0.1:5173/?dock=obs&clientType=obsDock';

async function canReachViteDevServer() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1000);

  try {
    const response = await fetch(VITE_READY_URL, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function ensureObsDockDevServer() {
  if (!isDev) return false;

  if (await canReachViteDevServer()) {
    return true;
  }

  if (obsDockDevServerProcess && !obsDockDevServerProcess.killed) {
    return false;
  }

  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  console.log('[DevServer] Starting Vite for LyricDisplay Dock dev launcher');

  obsDockDevServerProcess = spawn(npmCommand, ['run', 'dev'], {
    cwd: appRoot,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  obsDockDevServerProcess.stdout?.on('data', (chunk) => {
    process.stdout.write(`[VITE] ${chunk}`);
  });

  obsDockDevServerProcess.stderr?.on('data', (chunk) => {
    process.stderr.write(`[VITE] ${chunk}`);
  });

  obsDockDevServerProcess.on('exit', (code, signal) => {
    console.log('[DevServer] Vite process exited', { code, signal });
    obsDockDevServerProcess = null;
  });

  obsDockDevServerProcess.on('error', (error) => {
    console.error('[DevServer] Failed to start Vite process:', error);
    obsDockDevServerProcess = null;
  });

  return false;
}

export function stopObsDockDevServer() {
  if (!obsDockDevServerProcess || obsDockDevServerProcess.killed) return;

  try {
    obsDockDevServerProcess.kill(process.platform === 'win32' ? 'SIGKILL' : 'SIGTERM');
  } catch (error) {
    console.warn('[DevServer] Failed to stop Vite process:', error);
  } finally {
    obsDockDevServerProcess = null;
  }
}
