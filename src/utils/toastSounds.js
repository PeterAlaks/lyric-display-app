// Simple tones via Web Audio API
let audioCtx;

function ensureCtx() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch { }
  }
  return audioCtx;
}

function beep(freq = 440, duration = 180, type = 'sine', gainLevel = 0.07, when = 0) {
  const ctx = ensureCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const attack = 0.01;
  const release = 0.08;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gainLevel, t0 + attack);
  g.gain.setValueAtTime(gainLevel, t0 + duration / 1000 - release);
  g.gain.linearRampToValueAtTime(0.0001, t0 + duration / 1000);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration / 1000);
}

export function playTone(variant = 'info') {
  ensureCtx();
  switch (variant) {
    case 'success':
      beep(523.25, 140, 'sine', 0.07, 0);
      beep(659.25, 140, 'sine', 0.07, 0.08);
      beep(783.99, 160, 'sine', 0.06, 0.16);
      break;
    case 'warn':
      beep(392.00, 140, 'triangle', 0.06, 0);
      beep(392.00, 140, 'triangle', 0.06, 0.18);
      break;
    case 'error':
      beep(329.63, 140, 'sawtooth', 0.06, 0);
      beep(277.18, 140, 'sawtooth', 0.06, 0.12);
      beep(246.94, 160, 'sawtooth', 0.06, 0.22);
      break;
    default:
      beep(523.25, 160, 'triangle', 0.05, 0);
  }
}
