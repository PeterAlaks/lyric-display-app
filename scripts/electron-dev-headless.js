import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const binName = process.platform === 'win32' ? 'concurrently.cmd' : 'concurrently';
const concurrentlyBin = path.join(projectRoot, 'node_modules', '.bin', binName);

const child = spawn(
  concurrentlyBin,
  [
    'npm run dev',
    'wait-on http://localhost:5173 && electron . --headless',
  ],
  {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      LYRICDISPLAY_HEADLESS: '1',
      LYRICDISPLAY_OBS_DOCK_LOCAL_AUTH: '1',
    },
  }
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error('Failed to start headless Electron dev workflow:', error);
  process.exit(1);
});
