let audioCtx;

const MASTER_LEVEL = 0.085;
const MIN_GAIN = 0.0001;

function ensureCtx() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return null;
    }
  }

  if (audioCtx.state === 'suspended') {
    const resumePromise = audioCtx.resume();
    resumePromise?.catch?.(() => {});
  }

  return audioCtx;
}

function createTone({
  time,
  frequency,
  duration = 0.22,
  type = 'sine',
  gain = 0.45,
  attack = 0.012,
  release = 0.12,
  detune = 0,
  filterFrequency = 3200,
  pan = 0
}) {
  const ctx = ensureCtx();
  if (!ctx) return;

  const start = Math.max(ctx.currentTime, time);
  const end = start + duration;
  const peak = MASTER_LEVEL * gain;
  const releaseStart = Math.max(start + attack, end - release);

  const oscillator = ctx.createOscillator();
  const envelope = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.detune.setValueAtTime(detune, start);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(filterFrequency, start);
  filter.Q.setValueAtTime(0.7, start);

  envelope.gain.setValueAtTime(MIN_GAIN, start);
  envelope.gain.exponentialRampToValueAtTime(Math.max(MIN_GAIN, peak), start + attack);
  envelope.gain.exponentialRampToValueAtTime(Math.max(MIN_GAIN, peak * 0.62), releaseStart);
  envelope.gain.exponentialRampToValueAtTime(MIN_GAIN, end);

  oscillator.connect(filter);
  filter.connect(envelope);

  if (panner) {
    panner.pan.setValueAtTime(pan, start);
    envelope.connect(panner).connect(ctx.destination);
  } else {
    envelope.connect(ctx.destination);
  }

  oscillator.start(start);
  oscillator.stop(end + 0.02);
}

function scheduleNote(ctx, offset, frequency, options = {}) {
  const time = ctx.currentTime + offset;
  const {
    duration = 0.22,
    gain = 0.46,
    type = 'triangle',
    filterFrequency = 3000,
    pan = 0
  } = options;

  createTone({ time, frequency, duration, gain, type, filterFrequency, pan });

  if (options.shimmer !== false) {
    createTone({
      time: time + 0.012,
      frequency: frequency * 2,
      duration: duration * 0.72,
      gain: gain * 0.16,
      type: 'sine',
      filterFrequency: filterFrequency + 1200,
      pan: -pan * 0.5
    });
  }
}

function playSuccess(ctx) {
  scheduleNote(ctx, 0, 523.25, { duration: 0.18, gain: 0.38, pan: -0.1 });
  scheduleNote(ctx, 0.065, 659.25, { duration: 0.2, gain: 0.4, pan: 0.04 });
  scheduleNote(ctx, 0.135, 880, { duration: 0.26, gain: 0.36, pan: 0.12, filterFrequency: 3600 });
}

function playInfo(ctx) {
  scheduleNote(ctx, 0, 587.33, { duration: 0.17, gain: 0.34, pan: -0.05, filterFrequency: 2800 });
  scheduleNote(ctx, 0.055, 783.99, { duration: 0.24, gain: 0.3, pan: 0.08, filterFrequency: 3400 });
}

function playWarn(ctx) {
  scheduleNote(ctx, 0, 440, { duration: 0.2, gain: 0.34, type: 'sine', pan: -0.04, shimmer: false });
  scheduleNote(ctx, 0.14, 587.33, { duration: 0.22, gain: 0.34, type: 'sine', pan: 0.05, shimmer: false });
  createTone({
    time: ctx.currentTime + 0.14,
    frequency: 293.66,
    duration: 0.22,
    gain: 0.12,
    type: 'triangle',
    filterFrequency: 1800
  });
}

function playError(ctx) {
  scheduleNote(ctx, 0, 392, { duration: 0.19, gain: 0.38, type: 'triangle', pan: -0.06, shimmer: false });
  scheduleNote(ctx, 0.095, 349.23, { duration: 0.2, gain: 0.36, type: 'triangle', pan: 0.02, shimmer: false });
  scheduleNote(ctx, 0.19, 261.63, { duration: 0.28, gain: 0.34, type: 'sine', pan: 0.08, shimmer: false });
}

export function playTone(variant = 'info') {
  const ctx = ensureCtx();
  if (!ctx) return;

  const normalizedVariant = variant === 'warning' ? 'warn' : variant;

  switch (normalizedVariant) {
    case 'success':
      playSuccess(ctx);
      break;
    case 'warn':
      playWarn(ctx);
      break;
    case 'error':
      playError(ctx);
      break;
    default:
      playInfo(ctx);
  }
}
