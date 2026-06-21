import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { registerDevProtocol } from './register-dev-protocol.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';
const viteBin = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const electronCommand = isWindows
  ? path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe')
  : path.join(projectRoot, 'node_modules', '.bin', 'electron');
const readyUrl = 'http://127.0.0.1:5173/?dock=obs&clientType=obsDock';

let viteProcess = null;
let electronProcess = null;
let shuttingDown = false;

const childEnv = {
  ...process.env,
  LYRICDISPLAY_HEADLESS: '1',
  LYRICDISPLAY_OBS_DOCK_LOCAL_AUTH: '1',
};

registerDevProtocol();

function spawnChild(command, args, label) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    env: childEnv,
    stdio: 'inherit',
    windowsHide: true,
    shell: false,
  });

  child.on('error', (error) => {
    console.error(`[${label}] Failed to start:`, error);
    shutdown(1);
  });

  return child;
}

async function waitForReady(timeoutMs = 60_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(readyUrl, { cache: 'no-store' });
      if (response.ok) return true;
    } catch {
      // Vite is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return false;
}

function killChild(child) {
  if (!child || child.killed) return;

  try {
    child.kill(isWindows ? 'SIGKILL' : 'SIGTERM');
  } catch {
  }
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  killChild(electronProcess);
  killChild(viteProcess);
  process.exit(code);
}

process.on('SIGINT', () => shutdown(130));
process.on('SIGTERM', () => shutdown(143));

if (!(await waitForReady(1000))) {
  viteProcess = spawnChild(process.execPath, [viteBin, '--host'], 'vite');
}

const viteReady = await waitForReady();
if (!viteReady) {
  console.error(`Timed out waiting for Vite at ${readyUrl}`);
  shutdown(1);
}

electronProcess = spawnChild(electronCommand, ['.', '--headless'], 'electron');

electronProcess.on('exit', (code, signal) => {
  if (shuttingDown) return;
  if (signal) {
    console.log(`[electron] Exited with signal ${signal}`);
    shutdown(1);
    return;
  }
  shutdown(code ?? 0);
});
