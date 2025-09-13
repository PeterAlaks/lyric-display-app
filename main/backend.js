import path from 'path';
import { fork } from 'child_process';
import { resolveProductionPath } from './paths.js';
import { app } from 'electron';

let backendProcess = null;

export function startBackend() {
  return new Promise((resolve, reject) => {
    const serverPath = resolveProductionPath('server', 'index.js');
    backendProcess = fork(serverPath, [], {
      cwd: path.dirname(serverPath),
      env: { ...process.env, NODE_ENV: app.isPackaged ? 'production' : 'development' },
      stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
    });

    let isResolved = false;
    const timeout = setTimeout(() => {
      if (!isResolved) {
        console.log('Backend startup timeout, proceeding anyway...');
        isResolved = true;
        resolve();
      }
    }, 10000);

    backendProcess.on('error', (err) => {
      console.error('Backend process error:', err);
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeout);
        reject(err);
      }
    });

    backendProcess.on('exit', (code) => {
      if (code !== 0) {
        console.error('Backend process exited with code', code);
      }
    });

    backendProcess.on('message', (msg) => {
      if (msg?.status === 'ready' && !isResolved) {
        console.log('Backend reported ready');
        isResolved = true;
        clearTimeout(timeout);
        resolve();
      }
    });

    setTimeout(() => {
      if (!isResolved) {
        console.log('Backend ready message not received, proceeding...');
        isResolved = true;
        clearTimeout(timeout);
        resolve();
      }
    }, 5000);
  });
}

export function stopBackend() {
  if (backendProcess) {
    try { backendProcess.kill(); } catch {}
    backendProcess = null;
  }
}

