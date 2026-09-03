import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import electronPath from 'electron';

const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;

const createServer = () => new Promise((resolve, reject) => {
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end('<!doctype html><html><body>renderer storage smoke test</body></html>');
  });
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => resolve(server));
});

const closeServer = (server) => new Promise((resolve) => server.close(resolve));
const getOrigin = (server) => `http://127.0.0.1:${server.address().port}`;

const runElectronPhase = (phase, phaseEnvironment) => new Promise((resolve, reject) => {
  const electronSwitches = process.platform === 'linux' ? ['--no-sandbox'] : [];
  const child = spawn(
    electronPath,
    [...electronSwitches, 'tests/renderer-storage-portability.smoke.cjs'],
    {
      cwd: process.cwd(),
      env: {
        ...environment,
        ...phaseEnvironment,
        LYRICDISPLAY_STORAGE_SMOKE_PHASE: phase,
      },
      stdio: 'inherit',
    },
  );

  let settled = false;
  child.once('error', (error) => {
    if (settled) return;
    settled = true;
    reject(new Error(`Could not launch renderer storage smoke phase "${phase}": ${error.message}`));
  });
  child.once('exit', (code, signal) => {
    if (settled) return;
    settled = true;
    if (signal) {
      reject(new Error(`Renderer storage smoke phase "${phase}" stopped with signal ${signal}.`));
      return;
    }
    if (code !== 0) {
      reject(new Error(`Renderer storage smoke phase "${phase}" exited with code ${code}.`));
      return;
    }
    resolve();
  });
});

const run = async () => {
  const temporaryAppData = fs.mkdtempSync(path.join(os.tmpdir(), 'lyricdisplay-renderer-storage-'));
  const sourceServer = await createServer();
  const targetServer = await createServer();
  const phaseEnvironment = {
    LYRICDISPLAY_STORAGE_SMOKE_APP_DATA: temporaryAppData,
    LYRICDISPLAY_STORAGE_SMOKE_SOURCE_ORIGIN: getOrigin(sourceServer),
    LYRICDISPLAY_STORAGE_SMOKE_TARGET_ORIGIN: getOrigin(targetServer),
  };

  try {
    await runElectronPhase('source-upgrade', phaseEnvironment);
    await runElectronPhase('target-restart', phaseEnvironment);
    await runElectronPhase('source-return', phaseEnvironment);
    process.stdout.write('Renderer storage survived two port-origin changes across three Electron launches.\n');
  } finally {
    await Promise.all([closeServer(sourceServer), closeServer(targetServer)]);
    try { fs.rmSync(temporaryAppData, { recursive: true, force: true }); } catch { }
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
