import path from 'path';
import { fork } from 'child_process';
import { resolveProductionPath } from './paths.js';
import { app } from 'electron';
import { mirrorStreamToLog } from './logging.js';

let backendProcess = null;
let backendStopRequested = false;
let backendRestartTimer = null;
let lastStartOptions = {};
let backendMessageHandler = null;

const BACKEND_TAIL_LIMIT = 64 * 1024;
const BACKEND_RESTART_WINDOW_MS = 5 * 60_000;
const BACKEND_SOFT_STARTUP_TIMEOUT_MS = 30_000;
const BACKEND_HARD_STARTUP_TIMEOUT_MS = 120_000;
const MAX_BACKEND_RESTARTS = 3;
let backendRestartAttempts = [];

function appendTail(current, chunk) {
  const next = `${current}${Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk)}`;
  return next.length > BACKEND_TAIL_LIMIT ? next.slice(-BACKEND_TAIL_LIMIT) : next;
}

function getRecentRestartAttempts() {
  const now = Date.now();
  backendRestartAttempts = backendRestartAttempts.filter((timestamp) => now - timestamp < BACKEND_RESTART_WINDOW_MS);
  return backendRestartAttempts;
}

function scheduleBackendRestart(reason) {
  if (backendStopRequested || backendRestartTimer) {
    return;
  }

  const attempts = getRecentRestartAttempts();
  if (attempts.length >= MAX_BACKEND_RESTARTS) {
    console.error('[Backend] Restart limit reached; backend will remain stopped until app restart', {
      reason,
      attempts: attempts.length,
      windowMs: BACKEND_RESTART_WINDOW_MS,
    });
    return;
  }

  const delayMs = 2000;
  backendRestartAttempts.push(Date.now());
  console.warn('[Backend] Scheduling runtime restart after unexpected exit', {
    reason,
    delayMs,
    attempt: backendRestartAttempts.length,
    maxAttempts: MAX_BACKEND_RESTARTS,
    windowMs: BACKEND_RESTART_WINDOW_MS,
  });

  backendRestartTimer = setTimeout(() => {
    backendRestartTimer = null;
    if (backendStopRequested || backendProcess) {
      return;
    }

    startBackend(lastStartOptions).catch((error) => {
      console.error('[Backend] Runtime restart failed:', error);
    });
  }, delayMs);
  backendRestartTimer.unref?.();
}

async function waitForBackendHealth(maxAttempts = 60, intervalMs = 500) {
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const response = await fetch('http://127.0.0.1:4000/api/health/ready', {
        method: 'GET',
        timeout: 2000,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'ready' && data.serverListening) {
          console.log(`Backend health check passed after ${attempts + 1} attempts`);
          return true;
        }
      }
    } catch (error) {
      console.log(`Health check attempt ${attempts + 1}/${maxAttempts}: ${error.message}`);
    }

    attempts++;
    const jitter = Math.random() * 200;
    await new Promise(resolve => setTimeout(resolve, intervalMs + jitter));
  }

  console.warn(`Backend health check failed after ${maxAttempts} attempts`);
  return false;
}

export function startBackend({ obsDockPairingToken = null, allowLocalObsDockAuth = false } = {}) {
  return new Promise((resolve, reject) => {
    if (backendProcess && !backendProcess.killed) {
      if (obsDockPairingToken) {
        registerObsDockPairingToken(obsDockPairingToken);
      }
      if (allowLocalObsDockAuth) {
        lastStartOptions = { ...lastStartOptions, allowLocalObsDockAuth: true };
        try {
          backendProcess.send({ type: 'obs-dock-local-auth', enabled: true });
        } catch (error) {
          console.warn('[Backend] Failed to enable LyricDisplay Dock local auth:', error);
        }
      }
      resolve();
      return;
    }

    lastStartOptions = { allowLocalObsDockAuth };
    backendStopRequested = false;
    if (backendRestartTimer) {
      clearTimeout(backendRestartTimer);
      backendRestartTimer = null;
    }

    const serverPath = resolveProductionPath('server', 'index.js');
    const userDataDir = app.getPath('userData');
    const backendDataDir = path.join(userDataDir, 'backend');

    const child = fork(serverPath, [], {
      cwd: path.dirname(serverPath),
      env: {
        ...process.env,
        NODE_ENV: app.isPackaged ? 'production' : 'development',
        LYRICDISPLAY_DATA_DIR: backendDataDir,
        LYRICDISPLAY_USER_DATA_DIR: userDataDir,
        LYRICDISPLAY_OBS_DOCK_PAIRING_TOKEN: obsDockPairingToken || process.env.LYRICDISPLAY_OBS_DOCK_PAIRING_TOKEN || '',
        LYRICDISPLAY_OBS_DOCK_LOCAL_AUTH: allowLocalObsDockAuth || process.env.LYRICDISPLAY_OBS_DOCK_LOCAL_AUTH === '1' ? '1' : ''
      },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });

    backendProcess = child;

    let stdoutTail = '';
    let stderrTail = '';

    mirrorStreamToLog(child.stdout, 'BACKEND', process.stdout);
    mirrorStreamToLog(child.stderr, 'BACKEND_ERROR', process.stderr);
    child.stdout?.on('data', (chunk) => {
      stdoutTail = appendTail(stdoutTail, chunk);
    });
    child.stderr?.on('data', (chunk) => {
      stderrTail = appendTail(stderrTail, chunk);
    });

    let isResolved = false;
    let softStartupTimeout = null;
    let hardStartupTimeout = null;

    const clearStartupTimers = () => {
      if (softStartupTimeout) {
        clearTimeout(softStartupTimeout);
        softStartupTimeout = null;
      }
      if (hardStartupTimeout) {
        clearTimeout(hardStartupTimeout);
        hardStartupTimeout = null;
      }
    };

    const resolveStartup = () => {
      if (isResolved) {
        return false;
      }
      isResolved = true;
      clearStartupTimers();
      resolve();
      return true;
    };

    const rejectStartup = (error) => {
      if (isResolved) {
        return false;
      }
      isResolved = true;
      clearStartupTimers();
      reject(error);
      return true;
    };

    softStartupTimeout = setTimeout(async () => {
      if (isResolved) return;

      console.log('Backend process soft timeout, attempting health check...');

      const isHealthy = await waitForBackendHealth(10, 1000);

      if (isHealthy) {
        console.log('Backend is healthy despite missing ready signal');
        resolveStartup();
      } else {
        console.warn('Backend still not ready after soft timeout; continuing to wait for ready signal');
      }
    }, BACKEND_SOFT_STARTUP_TIMEOUT_MS);

    hardStartupTimeout = setTimeout(async () => {
      if (isResolved) return;

      console.error('Backend startup hard timeout, performing final health check...');

      const isHealthy = await waitForBackendHealth(10, 1000);

      if (isHealthy) {
        console.log('Backend is healthy after extended startup wait');
        resolveStartup();
      } else {
        console.error('Backend failed to become ready within extended timeout');
        rejectStartup(new Error('Backend startup timeout'));
      }
    }, BACKEND_HARD_STARTUP_TIMEOUT_MS);

    child.on('error', (err) => {
      console.error('Backend process error:', err);
      if (backendProcess === child) {
        backendProcess = null;
      }
      if (!isResolved) {
        rejectStartup(err);
      } else {
        scheduleBackendRestart(err?.message || 'process error');
      }
    });

    child.on('exit', (code, signal) => {
      if (backendProcess === child) {
        backendProcess = null;
      }
      const unexpectedExit = !backendStopRequested && (isResolved || code !== 0 || signal);
      const exitContext = {
        code,
        signal,
        stopRequested: backendStopRequested,
        stdoutTail: stdoutTail.trim().slice(-4000),
        stderrTail: stderrTail.trim().slice(-4000),
      };

      if (unexpectedExit) {
        console.error('Backend process exited unexpectedly:', exitContext);
      } else {
        console.log(`Backend process exited with code ${code}, signal: ${signal}`);
      }

      if (!isResolved) {
        rejectStartup(new Error(`Backend process exited before ready with code ${code}, signal ${signal}`));
        return;
      }

      if (isResolved && unexpectedExit) {
        scheduleBackendRestart(`exit code ${code}, signal ${signal}`);
      }
    });

    child.on('message', async (msg) => {
      if (backendMessageHandler) {
        try {
          const result = await backendMessageHandler(msg);
          if (msg?.requestId) {
            try {
              child.send({
                type: 'app-control-response',
                requestId: msg.requestId,
                success: result?.success !== false,
                error: result?.error || null,
              });
            } catch (error) {
              console.warn('[Backend] Failed to send app-control response:', error);
            }
          }
        } catch (error) {
          console.warn('[Backend] Message handler failed:', error);
          if (msg?.requestId) {
            try {
              child.send({
                type: 'app-control-response',
                requestId: msg.requestId,
                success: false,
                error: error?.message || 'Main process failed to handle request',
              });
            } catch (sendError) {
              console.warn('[Backend] Failed to send app-control error response:', sendError);
            }
          }
        }
      }

      if (msg?.status === 'error' && msg?.error === 'EADDRINUSE' && !isResolved) {
        console.error(`Backend failed: Port ${msg.port} is already in use`);
        rejectStartup(new Error('PORT_IN_USE'));
        return;
      }

      if (msg?.status === 'ready' && !isResolved) {
        console.log('Backend reported ready, verifying health...');

        const isHealthy = await waitForBackendHealth(5, 200);

        if (isHealthy) {
          console.log('Backend startup completed successfully');
          resolveStartup();
        } else {
          console.warn('Backend reported ready but health check failed, retrying...');
        }
      }
    });

    setTimeout(async () => {
      if (!isResolved) {
        console.log('Attempting early health check...');
        const isHealthy = await waitForBackendHealth(3, 500);

        if (isHealthy) {
          console.log('Early health check succeeded');
          resolveStartup();
        }
      }
    }, 3000);
  });
}

export function registerObsDockPairingToken(token) {
  if (!backendProcess || !token) return false;

  try {
    backendProcess.send({ type: 'obs-dock-pairing-token', token });
    return true;
  } catch (error) {
    console.warn('[Backend] Failed to send LyricDisplay Dock pairing token:', error);
    return false;
  }
}

export function setBackendMessageHandler(handler) {
  backendMessageHandler = typeof handler === 'function' ? handler : null;
}

export function stopBackend() {
  backendStopRequested = true;
  if (backendRestartTimer) {
    clearTimeout(backendRestartTimer);
    backendRestartTimer = null;
  }

  if (backendProcess) {
    console.log('[Backend] Stopping backend process...');
    try {
      if (process.platform === 'win32') {
        console.log('[Backend] Using SIGKILL for Windows');
        backendProcess.kill('SIGKILL');
      } else {
        backendProcess.kill('SIGTERM');

        setTimeout(() => {
          if (backendProcess && !backendProcess.killed) {
            console.log('[Backend] Force killing backend process');
            backendProcess.kill('SIGKILL');
          }
        }, 2000);
      }
    } catch (error) {
      console.error('[Backend] Error stopping backend:', error);
      try {
        if (backendProcess && !backendProcess.killed) {
          backendProcess.kill('SIGKILL');
        }
      } catch (killError) {
        console.error('[Backend] Error force killing backend:', killError);
      }
    }
    backendProcess = null;
  }
}
