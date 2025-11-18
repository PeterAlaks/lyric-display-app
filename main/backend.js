import path from 'path';
import { fork } from 'child_process';
import { resolveProductionPath } from './paths.js';
import { app } from 'electron';

let backendProcess = null;

async function waitForBackendHealth(maxAttempts = 20, intervalMs = 500) {
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

export function startBackend() {
  return new Promise((resolve, reject) => {
    const serverPath = resolveProductionPath('server', 'index.js');
    const backendDataDir = path.join(app.getPath('userData'), 'backend');

    backendProcess = fork(serverPath, [], {
      cwd: path.dirname(serverPath),
      env: {
        ...process.env,
        NODE_ENV: app.isPackaged ? 'production' : 'development',
        LYRICDISPLAY_DATA_DIR: backendDataDir
      },
      stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
    });

    let isResolved = false;

    const timeout = setTimeout(async () => {
      if (!isResolved) {
        console.log('Backend process timeout, attempting health check...');

        const isHealthy = await waitForBackendHealth(10, 1000);

        if (isHealthy) {
          console.log('Backend is healthy despite missing ready signal');
          isResolved = true;
          resolve();
        } else {
          console.error('Backend failed to become ready within timeout');
          isResolved = true;
          reject(new Error('Backend startup timeout'));
        }
      }
    }, 15000);

    backendProcess.on('error', (err) => {
      console.error('Backend process error:', err);
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeout);
        reject(err);
      }
    });

    backendProcess.on('exit', (code, signal) => {
      console.log(`Backend process exited with code ${code}, signal: ${signal}`);
      if (!isResolved && code !== 0) {
        isResolved = true;
        clearTimeout(timeout);
        reject(new Error(`Backend process exited with code ${code}`));
      }
    });

    backendProcess.on('message', async (msg) => {
      if (msg?.status === 'error' && msg?.error === 'EADDRINUSE' && !isResolved) {
        console.error(`Backend failed: Port ${msg.port} is already in use`);
        isResolved = true;
        clearTimeout(timeout);
        reject(new Error('PORT_IN_USE'));
        return;
      }

      if (msg?.status === 'ready' && !isResolved) {
        console.log('Backend reported ready, verifying health...');

        const isHealthy = await waitForBackendHealth(5, 200);

        if (isHealthy) {
          console.log('Backend startup completed successfully');
          isResolved = true;
          clearTimeout(timeout);
          resolve();
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
          isResolved = true;
          clearTimeout(timeout);
          resolve();
        }
      }
    }, 3000);
  });
}

export function stopBackend() {
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