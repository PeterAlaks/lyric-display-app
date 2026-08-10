import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fork, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { listPackage } from '@electron/asar';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, '..');
const releaseDir = path.join(appRoot, 'release');
const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
const requestedPlatform = process.argv[2]?.replace(/^--/, '');
const shouldStartServer = process.argv.includes('--start-server');

const platformMap = {
  windows: 'win32',
  macos: 'darwin',
  linux: 'linux',
};

if (!platformMap[requestedPlatform]) {
  console.error('Usage: node scripts/verify-packaged-runtime.js --windows|--macos|--linux [--start-server]');
  process.exit(1);
}

if (platformMap[requestedPlatform] !== process.platform) {
  console.error(`Cannot execute a ${requestedPlatform} package on ${process.platform}.`);
  process.exit(1);
}

const findFiles = (root, targetName, maxDepth = 7, depth = 0, matches = []) => {
  if (depth > maxDepth || !fs.existsSync(root)) return matches;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isFile() && entry.name === targetName) {
      matches.push(entryPath);
    } else if (entry.isDirectory()) {
      findFiles(entryPath, targetName, maxDepth, depth + 1, matches);
    }
  }
  return matches;
};

const findExecutable = (asarPath) => {
  const productName = packageJson.build?.productName || packageJson.productName || packageJson.name;
  if (requestedPlatform === 'macos') {
    const contentsDir = path.dirname(path.dirname(asarPath));
    return path.join(contentsDir, 'MacOS', productName);
  }

  const packageDir = path.dirname(path.dirname(asarPath));
  if (requestedPlatform === 'windows') {
    return path.join(packageDir, `${productName}.exe`);
  }

  const candidates = [
    packageJson.build?.executableName,
    packageJson.name,
    productName,
    String(productName).toLowerCase().replace(/\s+/g, '-'),
  ].filter(Boolean);
  return candidates
    .map((name) => path.join(packageDir, name))
    .find((candidate) => fs.existsSync(candidate)) || null;
};

const asarPaths = findFiles(releaseDir, 'app.asar')
  .filter((candidate) => !candidate.includes(`${path.sep}node_modules${path.sep}`));

if (asarPaths.length === 0) {
  console.error(`No packaged app.asar found under ${releaseDir}.`);
  process.exit(1);
}

const requiredArchiveEntries = [
  'server/index.js',
  'dist/index.html',
  'preload.js',
  'shared/data/openhymnal-bundle.json',
];

const packageCandidates = asarPaths.map((asarPath) => {
  const entries = new Set(listPackage(asarPath).map((entry) => entry.replaceAll('\\', '/').replace(/^\//, '')));
  for (const requiredEntry of requiredArchiveEntries) {
    if (!entries.has(requiredEntry)) {
      throw new Error(`${asarPath} is missing ${requiredEntry}`);
    }
  }
  if ([...entries].some((entry) => entry === 'release' || entry.startsWith('release/'))) {
    throw new Error(`${asarPath} recursively contains release output`);
  }

  const unpackedRoot = `${asarPath}.unpacked`;
  const unpackedFiles = findFiles(unpackedRoot, 'better_sqlite3.node', 8)
    .concat(findFiles(unpackedRoot, 'midi.node', 8))
    .concat(findFiles(unpackedRoot, 'keytar.node', 8));
  for (const nativeName of ['better_sqlite3.node', 'midi.node', 'keytar.node']) {
    if (!unpackedFiles.some((filePath) => path.basename(filePath) === nativeName)) {
      throw new Error(`${asarPath} is missing unpacked native runtime ${nativeName}`);
    }
  }

  const executable = findExecutable(asarPath);
  if (!executable || !fs.existsSync(executable)) {
    throw new Error(`Could not find the packaged executable for ${asarPath}`);
  }
  return { asarPath, executable };
});

const selectHostCandidate = () => {
  if (requestedPlatform !== 'macos' || packageCandidates.length === 1) {
    return packageCandidates[0];
  }
  const wantsArm64 = process.arch === 'arm64';
  return packageCandidates.find(({ asarPath }) => (
    asarPath.toLowerCase().includes('arm64') === wantsArm64
  )) || packageCandidates[0];
};

const hostCandidate = selectHostCandidate();
const runtimeProbe = String.raw`
  const path = require('node:path');
  const asarRoot = process.env.LYRICDISPLAY_ASAR_ROOT;
  const modulesRoot = path.join(asarRoot, 'node_modules');
  const Database = require(path.join(modulesRoot, 'better-sqlite3'));
  const database = new Database(':memory:');
  const row = database.prepare('select 42 as answer').get();
  database.close();
  if (row.answer !== 42) throw new Error('Packaged SQLite query failed');
  const midi = require(path.join(modulesRoot, '@julusian/midi'));
  if (typeof midi.Input !== 'function' || typeof midi.Output !== 'function') throw new Error('Packaged MIDI exports are unavailable');
  const keytar = require(path.join(modulesRoot, 'keytar'));
  if (typeof keytar.getPassword !== 'function') throw new Error('Packaged keytar exports are unavailable');
  const fontList = require(path.join(modulesRoot, 'font-list'));
  if (typeof fontList.getFonts !== 'function') throw new Error('Packaged font-list exports are unavailable');
  console.log('Native runtime modules loaded from ASAR package');
`;

const runtimeResult = spawnSync(hostCandidate.executable, ['-e', runtimeProbe], {
  cwd: path.dirname(hostCandidate.executable),
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    LYRICDISPLAY_ASAR_ROOT: hostCandidate.asarPath,
  },
  encoding: 'utf8',
  timeout: 30000,
});

if (runtimeResult.status !== 0) {
  throw new Error(`Packaged runtime module probe failed:\n${runtimeResult.stdout}\n${runtimeResult.stderr}`);
}
process.stdout.write(runtimeResult.stdout);
if (runtimeResult.stderr) process.stderr.write(runtimeResult.stderr);

const reservePort = () => new Promise((resolve, reject) => {
  const listener = net.createServer();
  listener.once('error', reject);
  listener.listen(0, '127.0.0.1', () => {
    const address = listener.address();
    const port = typeof address === 'object' && address ? address.port : null;
    listener.close((error) => (error ? reject(error) : resolve(port)));
  });
});

const requestText = (port, pathname) => new Promise((resolve, reject) => {
  const request = http.get({ hostname: '127.0.0.1', port, path: pathname, timeout: 5000 }, (response) => {
    let body = '';
    response.setEncoding('utf8');
    response.on('data', (chunk) => { body += chunk; });
    response.on('end', () => resolve({ statusCode: response.statusCode, body }));
  });
  request.once('timeout', () => request.destroy(new Error(`Timed out requesting ${pathname}`)));
  request.once('error', reject);
});

const startPackagedServerProbe = async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lyricdisplay-packaged-smoke-'));
  const port = await reservePort();
  const child = fork(path.join(hostCandidate.asarPath, 'server', 'index.js'), [], {
    execPath: hostCandidate.executable,
    cwd: tempRoot,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      PORT: String(port),
      LYRICDISPLAY_DISABLE_KEYTAR: '1',
      LYRICDISPLAY_DATA_DIR: path.join(tempRoot, 'backend'),
      LYRICDISPLAY_USER_DATA_DIR: tempRoot,
      HOME: tempRoot,
      USERPROFILE: tempRoot,
      LOCALAPPDATA: tempRoot,
      XDG_CONFIG_HOME: path.join(tempRoot, 'config'),
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout = `${stdout}${chunk}`.slice(-12000); });
  child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-12000); });

  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Packaged server startup timed out.\n${stdout}\n${stderr}`)), 20000);
      child.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once('exit', (code, signal) => {
        clearTimeout(timer);
        reject(new Error(`Packaged server exited before readiness (${code ?? signal}).\n${stdout}\n${stderr}`));
      });
      child.on('message', (message) => {
        if (message?.status === 'ready') {
          clearTimeout(timer);
          resolve();
        } else if (message?.status === 'error') {
          clearTimeout(timer);
          reject(new Error(`Packaged server reported ${message.error}: ${message.message}`));
        }
      });
    });

    const health = await requestText(port, '/api/health');
    if (health.statusCode !== 200 || JSON.parse(health.body)?.status !== 'healthy') {
      throw new Error(`Packaged health endpoint failed: ${health.statusCode} ${health.body}`);
    }
    const renderer = await requestText(port, '/');
    if (renderer.statusCode !== 200 || !renderer.body.includes('id="root"')) {
      throw new Error(`Packaged renderer serving failed: ${renderer.statusCode}`);
    }
    const projectionRenderer = await requestText(port, '/output1?projection=1&escapeHint=1');
    if (projectionRenderer.statusCode !== 200 || !projectionRenderer.body.includes('id="root"')) {
      throw new Error(`Packaged projection renderer serving failed: ${projectionRenderer.statusCode}`);
    }
    console.log(`Packaged ASAR server listened and served health/root/projection routes on ${requestedPlatform}`);
  } finally {
    child.kill();
    await new Promise((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) return resolve();
      const timer = setTimeout(resolve, 5000);
      child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
};

if (shouldStartServer) {
  await startPackagedServerProbe();
}

console.log(`Verified ${packageCandidates.length} ${requestedPlatform} ASAR package(s); executed ${hostCandidate.executable}.`);
