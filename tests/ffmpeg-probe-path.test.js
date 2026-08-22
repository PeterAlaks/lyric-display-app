import assert from 'node:assert/strict';
import { chmod, copyFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { after, before } from 'node:test';
import { runProbeProcess } from '../main/ipc/ffmpegProbe.js';

// These tests exercise the hardware-encoder probe helper against a fake `ffmpeg` binary placed
// on PATH. They guard the regression from commit 27a5bc3, where path.resolve('ffmpeg') turned
// the intentional bare PATH fallback into <cwd>/ffmpeg and broke hardware-encoder detection.
//
// The fixture is a real, self-contained executable that exits 0 regardless of args, so the
// test verifies PATH resolution on every platform (no skips):
//   * Windows: a copy of the Node binary named ffmpeg.exe (the Windows node.exe is
//     self-contained), driven with `-e process.exit(0)`. The bare `ffmpeg` lookup then
//     resolves via PATH + PATHEXT, mirroring resolveFfmpegPath()'s bare fallback.
//   * POSIX: a tiny `#!/bin/sh` stub named ffmpeg that exits 0, avoiding any dependency on the
//     Node runtime's (possibly shared-library) install layout.
const IS_WINDOWS = process.platform === 'win32';
const EXE_NAME = IS_WINDOWS ? 'ffmpeg.exe' : 'ffmpeg';
const PROBE_ARGS = IS_WINDOWS ? ['-e', 'process.exit(0)'] : ['-version'];
const PROBE_TIMEOUT_MS = 10_000;

let fixtureDir = null;
let originalPath = null;

before(async () => {
  fixtureDir = await mkdtemp(path.join(os.tmpdir(), 'lyricdisplay-ffmpeg-probe-'));
  const fakeFfmpeg = path.join(fixtureDir, EXE_NAME);
  if (IS_WINDOWS) {
    await copyFile(process.execPath, fakeFfmpeg);
  } else {
    await writeFile(fakeFfmpeg, '#!/bin/sh\nexit 0\n', 'utf8');
  }
  await chmod(fakeFfmpeg, 0o755);
  originalPath = process.env.PATH;
  process.env.PATH = `${fixtureDir}${path.delimiter}${originalPath || ''}`;
});

after(async () => {
  process.env.PATH = originalPath;
  if (fixtureDir) await rm(fixtureDir, { recursive: true, force: true });
});

test('runProbeProcess resolves a bare ffmpeg command through PATH', async () => {
  const result = await runProbeProcess('ffmpeg', PROBE_ARGS, PROBE_TIMEOUT_MS, 'ffmpeg probe');
  assert.equal(result.ok, true, `bare "ffmpeg" should resolve via PATH, got: ${result.reason}`);
});

test('runProbeProcess with a path.resolve()d bare command bypasses PATH and fails', async () => {
  // path.resolve('ffmpeg') yields <cwd>/ffmpeg (the repo root, which has no ffmpeg binary), so
  // it can never reach the fixture on PATH — exactly the behavior the reverted hardening
  // introduced, breaking PATH-based hardware detection.
  const resolved = path.resolve('ffmpeg');
  const result = await runProbeProcess(resolved, PROBE_ARGS, PROBE_TIMEOUT_MS, 'ffmpeg probe');
  assert.equal(result.ok, false, 'resolving the bare command to <cwd>/ffmpeg should bypass PATH and fail');
});
