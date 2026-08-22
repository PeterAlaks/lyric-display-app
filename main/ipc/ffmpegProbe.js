import { spawn } from 'node:child_process';

// The executable path is resolved internally by resolveFfmpegPath() (the trust boundary):
// a validated configured/bundled path, or the intentional bare `ffmpeg` for OS PATH lookup.
// It is never supplied by the lyric-video export IPC request, so no path.resolve/sanitization
// is applied here — doing so (e.g. path.resolve('ffmpeg') -> <cwd>/ffmpeg) would break PATH
// discovery. shell:false is set explicitly and args are passed as a separate array.
export const runProbeProcess = async (executablePath, args, timeoutMs, label) => new Promise((resolve) => {
  const startedAt = Date.now();
  // nosemgrep: javascript.lang.security.detect-child-process.detect-child-process -- executable resolved at the resolveFfmpegPath() trust boundary, not from IPC input; shell:false with array args
  const child = spawn(executablePath, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'], shell: false });
  let stderr = '';
  let settled = false;
  const finish = (result) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    resolve({
      ...result,
      durationMs: Date.now() - startedAt,
      stderr: stderr.trim().slice(-1200),
    });
  };
  const timeout = setTimeout(() => {
    try {
      child.kill('SIGTERM');
    } catch { }
    finish({ ok: false, reason: `${label} timed out` });
  }, timeoutMs);

  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
    if (stderr.length > 3000) stderr = stderr.slice(-3000);
  });
  child.once('error', (error) => {
    finish({ ok: false, reason: error?.message || `${label} failed to start` });
  });
  child.once('exit', (code) => {
    finish({
      ok: code === 0,
      reason: code === 0 ? 'ok' : `${label} exited with code ${code}`,
    });
  });
});
