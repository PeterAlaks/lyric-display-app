// Simple tones via Web Audio API. Call playTone(variant).
let audioCtx;

function ensureCtx() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
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
  // Simple ADSR envelope for smoother sound
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
  // Respect potential autoplay restrictions: first user gesture will start context.
  ensureCtx();
  switch (variant) {
    case 'success':
      // pleasant quick triad chime (~420ms)
      beep(523.25, 140, 'sine', 0.07, 0);      // C5
      beep(659.25, 140, 'sine', 0.07, 0.08);   // E5
      beep(783.99, 160, 'sine', 0.06, 0.16);   // G5
      break;
    case 'warn':
      // gentle double tone (~360ms)
      beep(392.00, 140, 'triangle', 0.06, 0);
      beep(392.00, 140, 'triangle', 0.06, 0.18);
      break;
    case 'error':
      // short descending buzz (~420ms)
      beep(329.63, 140, 'sawtooth', 0.06, 0);
      beep(277.18, 140, 'sawtooth', 0.06, 0.12);
      beep(246.94, 160, 'sawtooth', 0.06, 0.22);
      break;
    default:
      // soft single cue (~160ms)
      beep(523.25, 160, 'triangle', 0.05, 0);
  }
}
