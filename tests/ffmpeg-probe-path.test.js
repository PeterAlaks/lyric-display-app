import assert from 'node:assert/strict';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runProbeProcess } from '../main/ipc/ffmpegProbe.js';

// These tests exercise the hardware-encoder probe helper against a fake `ffmpeg` binary placed
// on PATH. They guard the regression from commit 27a5bc3, where path.resolve('ffmpeg') turned
// the intentional bare PATH fallback into <cwd>/ffmpeg and broke hardware-encoder detection.
//
// The fake binary is a POSIX shell script, so the test is skipped on Windows (PATH/PATHEXT
// resolution for real executables is covered by the platform-build workflow instead).
const skip = process.platform === 'win32' ? 'POSIX fake executable is not runnable on Windows' : false;

async function withFakeFfmpegOnPath(run) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'lyricdisplay-ffmpeg-probe-'));
  const fakeFfmpeg = path.join(dir, 'ffmpeg');
  await writeFile(fakeFfmpeg, '#!/bin/sh\nexit 0\n', 'utf8');
  await chmod(fakeFfmpeg, 0o755);

  const originalPath = process.env.PATH;
  process.env.PATH = `${dir}${path.delimiter}${originalPath || ''}`;
  try {
    return await run({ dir });
  } finally {
    process.env.PATH = originalPath;
    await rm(dir, { recursive: true, force: true });
  }
}

test('runProbeProcess resolves a bare ffmpeg command through PATH', { skip }, async () => {
  await withFakeFfmpegOnPath(async () => {
    const result = await runProbeProcess('ffmpeg', ['-version'], 5000, 'ffmpeg probe');
    assert.equal(result.ok, true, `bare "ffmpeg" should be found via PATH, got: ${result.reason}`);
  });
});

test('runProbeProcess with a path.resolve()d bare command fails (documents the fixed regression)', { skip }, async () => {
  await withFakeFfmpegOnPath(async () => {
    // path.resolve('ffmpeg') yields <cwd>/ffmpeg, which does not exist — this is exactly the
    // behavior the reverted hardening introduced, breaking PATH-based hardware detection.
    const resolved = path.resolve('ffmpeg');
    const result = await runProbeProcess(resolved, ['-version'], 5000, 'ffmpeg probe');
    assert.equal(result.ok, false, 'resolving the bare command to <cwd>/ffmpeg should fail to spawn');
  });
});
