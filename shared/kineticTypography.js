/**
 * Kinetic typography engine for lyric lines.
 *
 * A line is split into word or letter tokens and given a recipe (entry preset, exit and hold
 * motion). Recipes are chosen deterministically from a seed so every surface that renders the
 * same output (projector window, control-panel preview, NDI capture, video export) shows the
 * same animation. By default each song part keeps one recipe, so a chorus looks the same every
 * time it comes back.
 *
 * Everything here is pure: sampling functions take a plan and a time in milliseconds and return
 * the token's state, which lets live outputs drive them from a frame clock and video export seek
 * them frame by frame. Distances are in `em` so previews scale with the font size.
 */

export const KINETIC_TRANSITION = 'kinetic';

export const KINETIC_INTENSITY_PROFILES = Object.freeze({
  subtle: Object.freeze({ label: 'Subtle', amplitude: 0.45, settleMs: 700, holdAmplitude: 0.5 }),
  medium: Object.freeze({ label: 'Medium', amplitude: 1, settleMs: 1000, holdAmplitude: 1 }),
  wild: Object.freeze({ label: 'Wild', amplitude: 1.6, settleMs: 1400, holdAmplitude: 1.6 }),
});

export const KINETIC_INTENSITY_OPTIONS = Object.freeze(
  Object.entries(KINETIC_INTENSITY_PROFILES).map(([value, { label }]) => ({ value, label }))
);

export const KINETIC_VARIATION_OPTIONS = Object.freeze([
  { value: 'section', label: 'Per song part' },
  { value: 'line', label: 'Every line' },
]);

const KINETIC_VARIATION_VALUES = KINETIC_VARIATION_OPTIONS.map(({ value }) => value);
const EXIT_LIMIT_MS = 450;

/** Hidden pause between a replayed line leaving and entering again. */
export const KINETIC_LOOP_GAP_MS = 200;
/** How long a replaying line rests on screen between plays. */
export const KINETIC_LOOP_HOLD_LIMITS = Object.freeze({ min: 1000, max: 30000 });

const REST = Object.freeze({ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1, blur: 0 });
const NO_HOLD = Object.freeze({ x: 0, y: 0, scale: 1 });

const signed = (rng) => (rng() * 2) - 1;
const state = (overrides) => ({ ...REST, ...overrides });

const ENTRY_PRESETS = Object.freeze([
  {
    id: 'cascade',
    label: 'Cascade',
    unit: 'word',
    durationMs: 520,
    staggerMs: 70,
    ease: 'easeOutCubic',
    from: ({ amp }) => state({ opacity: 0, y: 0.55 * amp, blur: 0.1 * amp }),
  },
  {
    id: 'scatter',
    label: 'Scatter',
    unit: 'word',
    durationMs: 650,
    staggerMs: 45,
    ease: 'easeOutQuint',
    from: ({ amp, rng }) => state({
      opacity: 0,
      x: signed(rng) * 2.4 * amp,
      y: signed(rng) * 1.4 * amp,
      rotate: signed(rng) * 28 * amp,
      scale: 0.6,
      blur: 0.08 * amp,
    }),
  },
  {
    id: 'punch',
    label: 'Punch',
    unit: 'word',
    durationMs: 420,
    staggerMs: 90,
    ease: 'easeOutBack',
    from: ({ amp, emphasis }) => state({
      opacity: 0,
      scale: 1 + ((emphasis ? 1.6 : 0.9) * amp),
      blur: 0.04 * amp,
    }),
  },
  {
    id: 'drop',
    label: 'Drop',
    unit: 'word',
    durationMs: 560,
    staggerMs: 80,
    ease: 'easeOutBack',
    from: ({ amp, rng }) => state({ opacity: 0, y: -1.1 * amp, rotate: signed(rng) * 10 * amp }),
  },
  {
    id: 'zoom',
    label: 'Zoom',
    unit: 'word',
    durationMs: 600,
    staggerMs: 60,
    ease: 'easeOutExpo',
    from: ({ amp }) => state({ opacity: 0, scale: 0.3, blur: 0.18 * amp }),
  },
  {
    id: 'typewriter',
    label: 'Typewriter',
    unit: 'letter',
    durationMs: 70,
    staggerMs: 38,
    ease: 'linear',
    from: () => state({ opacity: 0 }),
  },
  {
    id: 'wave',
    label: 'Wave',
    unit: 'letter',
    durationMs: 480,
    staggerMs: 26,
    ease: 'easeOutBack',
    from: ({ amp }) => state({ opacity: 0, y: 0.6 * amp, scale: 0.85 }),
  },
  {
    id: 'converge',
    label: 'Converge',
    unit: 'letter',
    durationMs: 560,
    staggerMs: 10,
    ease: 'easeOutCubic',
    from: ({ amp, position }) => state({ opacity: 0, x: position * 1.4 * amp, blur: 0.08 * amp }),
  },
]);

const EXIT_PRESETS = Object.freeze([
  { id: 'fade', durationMs: 260, staggerMs: 18, to: ({ amp }) => state({ opacity: 0, y: -0.35 * amp }) },
  {
    id: 'scatter',
    durationMs: 320,
    staggerMs: 10,
    to: ({ amp, rng }) => state({
      opacity: 0,
      x: signed(rng) * 1.6 * amp,
      y: signed(rng) * 0.9 * amp,
      rotate: signed(rng) * 22 * amp,
      scale: 0.8,
    }),
  },
  { id: 'blur', durationMs: 300, staggerMs: 8, to: ({ amp }) => state({ opacity: 0, blur: 0.22 * amp, scale: 1 + (0.12 * amp) }) },
  { id: 'sink', durationMs: 280, staggerMs: 14, to: ({ amp }) => state({ opacity: 0, y: 0.55 * amp }) },
]);

const HOLD_IDS = Object.freeze(['drift', 'float']);

export const KINETIC_PRESETS = Object.freeze(
  ENTRY_PRESETS.map(({ id, label, unit }) => Object.freeze({ id, label, unit }))
);
export const KINETIC_PRESET_IDS = Object.freeze(ENTRY_PRESETS.map(({ id }) => id));

const ENTRY_PRESETS_BY_ID = new Map(ENTRY_PRESETS.map((preset) => [preset.id, preset]));

export const DEFAULT_KINETIC_SETTINGS = Object.freeze({
  kineticIntensity: 'medium',
  // An empty pool means "every preset", so presets added later reach existing outputs.
  kineticPresetPool: Object.freeze([]),
  kineticHoldMotion: true,
  kineticSeed: 0,
  kineticVariation: 'section',
  // Replay the line's animation for as long as it stays live.
  kineticLoop: false,
  kineticLoopHoldMs: 4000,
});

const EASINGS = {
  linear: (p) => p,
  easeOutCubic: (p) => 1 - ((1 - p) ** 3),
  easeOutQuint: (p) => 1 - ((1 - p) ** 5),
  easeOutExpo: (p) => (p >= 1 ? 1 : 1 - (2 ** (-10 * p))),
  easeOutBack: (p) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + (c3 * ((p - 1) ** 3)) + (c1 * ((p - 1) ** 2));
  },
  easeInCubic: (p) => p ** 3,
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (from, to, eased) => {
  if (eased === 0) return from;
  if (eased === 1) return to;
  return from + ((to - from) * eased);
};
const roundDown = (value) => Math.floor(value * 100) / 100;

/** FNV-1a over the joined parts; returns an unsigned 32-bit integer. */
export const hashKineticSeed = (...parts) => {
  const input = parts.map((part) => String(part ?? '')).join('␟');
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

/** Mulberry32: a small deterministic PRNG returning values in [0, 1). */
export const createSeededRandom = (seed) => {
  let value = (Number(seed) >>> 0) || 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
};

const normalizePool = (pool) => {
  const requested = Array.isArray(pool) ? new Set(pool) : new Set();
  const filtered = KINETIC_PRESET_IDS.filter((id) => requested.has(id));
  return filtered.length > 0 ? filtered : [...KINETIC_PRESET_IDS];
};

export const normalizeKineticSettings = (settings = {}) => {
  const safe = settings && typeof settings === 'object' ? settings : {};
  const seed = Math.trunc(Number(safe.kineticSeed));
  const loopHoldMs = Number(safe.kineticLoopHoldMs);
  return {
    intensity: Object.prototype.hasOwnProperty.call(KINETIC_INTENSITY_PROFILES, safe.kineticIntensity)
      ? safe.kineticIntensity
      : DEFAULT_KINETIC_SETTINGS.kineticIntensity,
    pool: normalizePool(safe.kineticPresetPool),
    holdMotion: safe.kineticHoldMotion !== false,
    seed: Number.isFinite(seed) ? clamp(seed, 0, 0x7fffffff) : 0,
    variation: KINETIC_VARIATION_VALUES.includes(safe.kineticVariation)
      ? safe.kineticVariation
      : DEFAULT_KINETIC_SETTINGS.kineticVariation,
    loop: safe.kineticLoop === true,
    loopHoldMs: Number.isFinite(loopHoldMs)
      ? Math.round(clamp(loopHoldMs, KINETIC_LOOP_HOLD_LIMITS.min, KINETIC_LOOP_HOLD_LIMITS.max))
      : DEFAULT_KINETIC_SETTINGS.kineticLoopHoldMs,
  };
};

/** Identifies the kinetic settings so the renderer can replay a line when they change. */
export const getKineticReplayKey = (settings = {}) => JSON.stringify(normalizeKineticSettings(settings));

/** Groups repeats of a song part: "Chorus 2", "[Chorus]" and "Chorus x2" all become "chorus". */
export const normalizeKineticSectionKey = (label) => String(label ?? '')
  .split(':')[0]
  .replace(/[[\](){}<>]/g, ' ')
  .toLowerCase()
  .replace(/\b(?:x\s*\d+|\d+\s*x|repeat)\b/g, ' ')
  .replace(/\d+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/**
 * Finds the song part a line belongs to. Each distinct part gets an ordinal in order of first
 * appearance, which keeps neighbouring parts on different recipes.
 * @returns {{key: string, ordinal: number}|null}
 */
export const resolveKineticSection = ({ sections, lineToSection, lineIndex } = {}) => {
  const sectionId = lineToSection?.[lineIndex];
  if (!sectionId || !Array.isArray(sections)) return null;

  const ordinals = new Map();
  let match = null;
  sections.forEach((section) => {
    const key = normalizeKineticSectionKey(section?.label);
    if (!key) return;
    if (!ordinals.has(key)) ordinals.set(key, ordinals.size);
    if (section.id === sectionId) match = key;
  });

  return match ? { key: match, ordinal: ordinals.get(match) } : null;
};

const shuffled = (items, rng) => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
};

/**
 * Picks an entry preset for a position in a sequence (a line index or a song-part ordinal).
 * Positions walk through seeded permutations of the pool, so consecutive positions never repeat
 * and every preset is used once per cycle.
 */
export const pickKineticPreset = ({ pool, seed = 0, lineIndex = 0 } = {}) => {
  const safePool = normalizePool(pool);
  const count = safePool.length;
  if (count === 1) return safePool[0];

  const position = Math.trunc(Number(lineIndex) || 0);
  if (count === 2) {
    const offset = hashKineticSeed(seed, 'pair') & 1;
    return safePool[(((position + offset) % 2) + 2) % 2];
  }

  const permutation = (cycle) => shuffled(safePool, createSeededRandom(hashKineticSeed(seed, 'cycle', cycle)));
  const cycle = Math.floor(position / count);
  const slot = position - (cycle * count);
  const current = permutation(cycle);

  // With three or more presets the fix-up below only touches slots 0 and 1, so the previous
  // cycle's last slot is unaffected and can be read without recursion.
  if (slot <= 1 && current[0] === permutation(cycle - 1)[count - 1]) {
    [current[0], current[1]] = [current[1], current[0]];
  }

  return current[slot];
};

const splitGraphemes = (text) => {
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), ({ segment }) => segment);
  }
  return Array.from(text);
};

/** Splits display text into lines of words, keeping each word's graphemes intact. */
export const segmentKineticText = (text) => String(text ?? '')
  .split('\n')
  .map((line) => line
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => ({ text: word, letters: splitGraphemes(word) })));

const toLineIndex = (lineKey) => {
  if (typeof lineKey === 'number' && Number.isFinite(lineKey)) return Math.trunc(lineKey);
  if (typeof lineKey === 'string' && /^-?\d+$/.test(lineKey)) return Number(lineKey);
  return hashKineticSeed('line', lineKey);
};

const fitTimings = (count, durationMs, staggerMs, limitMs) => {
  const duration = Math.min(durationMs, limitMs);
  const stagger = count > 1 ? roundDown(Math.min(staggerMs, (limitMs - duration) / (count - 1))) : 0;
  return { duration, stagger };
};

/**
 * Plans the animation for one displayed line.
 *
 * @param {Object} params
 * @param {string} params.text - Display text; `\n` separates stacked lines such as translations.
 * @param {number|string} params.lineKey - Position of the line in the song.
 * @param {string} [params.songKey] - Identifies the song so different songs get different looks.
 * @param {{key: string, ordinal: number}|null} [params.section] - From resolveKineticSection.
 * @param {Object} [params.settings] - Output settings holding the kinetic* keys.
 * @returns {Object|null} A serializable plan, or null when there is nothing to animate.
 */
export const planKineticLine = ({
  text,
  lineKey = 0,
  songKey = '',
  section = null,
  settings = {},
} = {}) => {
  const segmented = segmentKineticText(text);
  const words = segmented.flat();
  if (words.length === 0) return null;

  const normalized = normalizeKineticSettings(settings);
  const profile = KINETIC_INTENSITY_PROFILES[normalized.intensity];
  const amp = profile.amplitude;
  const useSection = normalized.variation === 'section' && Boolean(section?.key);
  const recipeKey = useSection ? `section:${section.key}` : `line:${String(lineKey)}`;
  const baseSeed = hashKineticSeed(normalized.seed, songKey);

  const presetId = pickKineticPreset({
    pool: normalized.pool,
    seed: baseSeed,
    lineIndex: useSection ? section.ordinal : toLineIndex(lineKey),
  });
  const preset = ENTRY_PRESETS_BY_ID.get(presetId);

  const recipeRng = createSeededRandom(hashKineticSeed(baseSeed, 'recipe', recipeKey));
  const exit = EXIT_PRESETS[Math.floor(recipeRng() * EXIT_PRESETS.length)];
  const holdId = normalized.holdMotion ? HOLD_IDS[Math.floor(recipeRng() * HOLD_IDS.length)] : 'none';

  let emphasisWord = words[0];
  words.forEach((word) => {
    if (word.letters.length > emphasisWord.letters.length) emphasisWord = word;
  });

  let tokenCount = 0;
  const tokenWords = [];
  const lines = segmented.map((lineWords) => ({
    words: lineWords.map((word) => {
      const firstToken = tokenCount;
      const span = preset.unit === 'letter' ? word.letters.length : 1;
      for (let offset = 0; offset < span; offset += 1) tokenWords.push(word);
      tokenCount += span;
      return { text: word.text, letters: word.letters, firstToken };
    }),
  }));

  const enter = fitTimings(tokenCount, preset.durationMs, preset.staggerMs, profile.settleMs);
  const leave = fitTimings(tokenCount, exit.durationMs, exit.staggerMs, EXIT_LIMIT_MS);
  // Seeded by the recipe and text, never the line position, so a repeated chorus line replays
  // exactly the same motion.
  const tokenRng = createSeededRandom(hashKineticSeed(baseSeed, 'tokens', recipeKey, presetId, text));
  const middle = (tokenCount - 1) / 2;

  const tokens = tokenWords.map((word, index) => {
    const context = {
      amp,
      rng: tokenRng,
      emphasis: word === emphasisWord,
      position: middle > 0 ? (index - middle) / middle : 0,
    };
    return {
      delayMs: roundDown(index * enter.stagger),
      durationMs: enter.duration,
      from: preset.from(context),
      exitDelayMs: roundDown(index * leave.stagger),
      exitDurationMs: leave.duration,
      to: exit.to(context),
    };
  });

  return {
    presetId,
    unit: preset.unit,
    ease: preset.ease,
    exitId: exit.id,
    holdId,
    holdAmplitude: profile.holdAmplitude,
    loopHoldMs: normalized.loop ? normalized.loopHoldMs : null,
    lines,
    tokens,
    enterDurationMs: Math.max(...tokens.map((token) => token.delayMs + token.durationMs)),
    exitDurationMs: Math.max(...tokens.map((token) => token.exitDelayMs + token.exitDurationMs)),
  };
};

const interpolate = (from, to, eased, opacityEased) => ({
  opacity: clamp(lerp(from.opacity, to.opacity, opacityEased), 0, 1),
  x: lerp(from.x, to.x, eased),
  y: lerp(from.y, to.y, eased),
  rotate: lerp(from.rotate, to.rotate, eased),
  scale: lerp(from.scale, to.scale, eased),
  blur: Math.max(0, lerp(from.blur, to.blur, eased)),
});

/** State of a token `tMs` after its line started entering. */
export const sampleKineticEnter = (plan, tokenIndex, tMs) => {
  const token = plan?.tokens?.[tokenIndex];
  if (!token || tMs >= token.delayMs + token.durationMs) return { ...REST };

  const progress = Math.max(0, (tMs - token.delayMs) / token.durationMs);
  const eased = (EASINGS[plan.ease] || EASINGS.easeOutCubic)(progress);
  // Opacity arrives ahead of motion so words are readable while they settle.
  const opacityEased = EASINGS.easeOutCubic(Math.min(1, progress * 1.5));
  return interpolate(token.from, REST, eased, opacityEased);
};

/** State of a token `tMs` after its line started leaving, starting from `from`. */
export const sampleKineticExit = (plan, tokenIndex, tMs, from = REST) => {
  const token = plan?.tokens?.[tokenIndex];
  if (!token) return { ...from };
  if (tMs >= token.exitDelayMs + token.exitDurationMs) return { ...token.to };

  const progress = Math.max(0, (tMs - token.exitDelayMs) / token.exitDurationMs);
  const eased = EASINGS.easeInCubic(progress);
  return interpolate({ ...REST, ...from }, token.to, eased, eased);
};

// Cycle arithmetic on fractional plan timings would otherwise drift by float noise.
const roundTime = (value) => Math.round(value * 1000) / 1000;

/**
 * Where a live line is in its animation `elapsedMs` after it first started entering.
 * Without replay a line enters once and then holds; with replay it cycles
 * enter → hold → exit → gap and starts again with the same recipe.
 * @returns {{cycle: number, cycleElapsedMs: number, phase: 'enter'|'hold'|'exit'|'gap'}}
 */
export const getKineticLoopPosition = (plan, elapsedMs) => {
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  const enterEnd = plan?.enterDurationMs ?? 0;

  if (!plan || plan.loopHoldMs === null || plan.loopHoldMs === undefined) {
    return { cycle: 0, cycleElapsedMs: elapsed, phase: elapsed < enterEnd ? 'enter' : 'hold' };
  }

  const holdEnd = enterEnd + plan.loopHoldMs;
  const exitEnd = holdEnd + plan.exitDurationMs;
  const cycleLength = exitEnd + KINETIC_LOOP_GAP_MS;
  const cycle = Math.floor(elapsed / cycleLength);
  const cycleElapsedMs = roundTime(elapsed - (cycle * cycleLength));

  let phase = 'gap';
  if (cycleElapsedMs < enterEnd) phase = 'enter';
  else if (cycleElapsedMs < holdEnd) phase = 'hold';
  else if (cycleElapsedMs < exitEnd) phase = 'exit';

  return { cycle, cycleElapsedMs, phase };
};

/** State of a token on a live line, including replay cycles when they are enabled. */
export const sampleKineticLive = (plan, tokenIndex, elapsedMs) => {
  const { phase, cycleElapsedMs } = getKineticLoopPosition(plan, elapsedMs);
  if (phase === 'enter') return sampleKineticEnter(plan, tokenIndex, cycleElapsedMs);
  if (phase === 'hold') return { ...REST };

  const holdEnd = plan.enterDurationMs + plan.loopHoldMs;
  return sampleKineticExit(plan, tokenIndex, roundTime(cycleElapsedMs - holdEnd));
};

/** Slow whole-line motion while a line is held on screen. */
export const sampleKineticHold = (plan, tMs) => {
  if (!plan || plan.holdId === 'none') return { ...NO_HOLD };

  const time = Math.max(0, Number(tMs) || 0);
  const amplitude = plan.holdAmplitude;
  const settle = 1 - Math.exp(-time / 6000);

  if (plan.holdId === 'float') {
    return {
      x: 0,
      y: 0.045 * amplitude * Math.sin((time / 3600) * Math.PI * 2),
      scale: 1 + (0.01 * amplitude * settle),
    };
  }

  return {
    x: 0.04 * amplitude * Math.sin((time / 9000) * Math.PI * 2),
    y: 0,
    scale: 1 + (0.025 * amplitude * settle),
  };
};

const formatNumber = (value) => String(Number(value.toFixed(4)));

/** Converts a token or hold sample to inline style values. */
export const kineticSampleToStyle = ({
  opacity = 1,
  x = 0,
  y = 0,
  rotate = 0,
  scale = 1,
  blur = 0,
} = {}) => {
  const transforms = [];
  if (Math.abs(x) > 0.0001 || Math.abs(y) > 0.0001) {
    transforms.push(`translate(${formatNumber(x)}em, ${formatNumber(y)}em)`);
  }
  if (Math.abs(rotate) > 0.001) transforms.push(`rotate(${formatNumber(rotate)}deg)`);
  if (Math.abs(scale - 1) > 0.0001) transforms.push(`scale(${formatNumber(scale)})`);

  return {
    opacity: formatNumber(opacity),
    transform: transforms.length > 0 ? transforms.join(' ') : 'none',
    filter: blur > 0.0005 ? `blur(${formatNumber(blur)}em)` : 'none',
  };
};
