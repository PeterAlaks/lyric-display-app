import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';
const protocol = 'lyricdisplay-dev';

function runReg(args) {
  const result = spawnSync('reg', args, {
    stdio: 'pipe',
    windowsHide: true,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    const message = result.stderr || result.stdout || `reg exited with ${result.status}`;
    throw new Error(message.trim());
  }
}

export function registerDevProtocol() {
  if (!isWindows) {
    console.log(`[DevProtocol] ${protocol} registration is currently only automated on Windows.`);
    return false;
  }

  const electronPath = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
  const commandValue = `"${electronPath}" "${projectRoot}" "%1"`;
  const protocolRoot = `HKCU\\Software\\Classes\\${protocol}`;

  runReg(['add', protocolRoot, '/ve', '/d', `URL:${protocol}`, '/f']);
  runReg(['add', protocolRoot, '/v', 'URL Protocol', '/d', '', '/f']);
  runReg(['add', `${protocolRoot}\\shell\\open\\command`, '/ve', '/d', commandValue, '/f']);

  console.log(`[DevProtocol] Registered ${protocol} -> ${commandValue}`);
  return true;
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  try {
    registerDevProtocol();
  } catch (error) {
    console.error(`[DevProtocol] Failed to register ${protocol}:`, error);
    process.exit(1);
  }
}
