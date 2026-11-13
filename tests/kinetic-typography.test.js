import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_KINETIC_SETTINGS,
  KINETIC_INTENSITY_PROFILES,
  KINETIC_LOOP_GAP_MS,
  KINETIC_LOOP_HOLD_LIMITS,
  KINETIC_PRESET_IDS,
  KINETIC_TRANSITION,
  createSeededRandom,
  getKineticLoopPosition,
  getKineticReplayKey,
  kineticSampleToStyle,
  normalizeKineticSettings,
  normalizeKineticSectionKey,
  pickKineticPreset,
  planKineticLine,
  resolveKineticSection,
  sampleKineticEnter,
  sampleKineticExit,
  sampleKineticHold,
  sampleKineticLive,
  segmentKineticText,
} from '../shared/kineticTypography.js';
import {
  LYRIC_TRANSITION_ANIMATION_OPTIONS,
  TRANSITION_ANIMATION_VALUES,
} from '../shared/transitionSettings.js';

const REST = { opacity: 1, x: 0, y: 0, rotate: 0, scale: 1, blur: 0 };
const SAMPLE_LINE = 'Amazing grace how sweet the sound';

const planFor = (overrides = {}) => planKineticLine({
  text: SAMPLE_LINE,
  lineKey: 3,
  songKey: 'amazing-grace.txt',
  settings: {},
  ...overrides,
});

test('kinetic is offered for lyric lines only, not for shared appearance transitions', () => {
  assert.equal(KINETIC_TRANSITION, 'kinetic');
  assert.ok(LYRIC_TRANSITION_ANIMATION_OPTIONS.some(({ value }) => value === KINETIC_TRANSITION));
  assert.ok(!TRANSITION_ANIMATION_VALUES.includes(KINETIC_TRANSITION));
});

test('normalizes kinetic settings and falls back to safe defaults', () => {
  assert.deepEqual(normalizeKineticSettings({}), {
    intensity: DEFAULT_KINETIC_SETTINGS.kineticIntensity,
    pool: KINETIC_PRESET_IDS,
    holdMotion: true,
    seed: 0,
    variation: 'section',
    loop: false,
    loopHoldMs: DEFAULT_KINETIC_SETTINGS.kineticLoopHoldMs,
  });
  assert.equal(normalizeKineticSettings({ kineticVariation: 'line' }).variation, 'line');
  assert.equal(normalizeKineticSettings({ kineticLoop: true }).loop, true);
  assert.equal(normalizeKineticSettings({ kineticLoopHoldMs: 50 }).loopHoldMs, KINETIC_LOOP_HOLD_LIMITS.min);
  assert.equal(normalizeKineticSettings({ kineticLoopHoldMs: 999999 }).loopHoldMs, KINETIC_LOOP_HOLD_LIMITS.max);
  assert.equal(normalizeKineticSettings({ kineticLoopHoldMs: 'soon' }).loopHoldMs, DEFAULT_KINETIC_SETTINGS.kineticLoopHoldMs);
  assert.equal(normalizeKineticSettings({ kineticVariation: 'chaos' }).variation, 'section');

  const normalized = normalizeKineticSettings({
    kineticIntensity: 'extreme',
    kineticPresetPool: ['wave', 'not-a-preset', 'cascade', 'wave'],
    kineticHoldMotion: false,
    kineticSeed: '42.9',
  });
  assert.equal(normalized.intensity, DEFAULT_KINETIC_SETTINGS.kineticIntensity);
  assert.deepEqual(normalized.pool, ['cascade', 'wave'], 'pool is filtered, de-duplicated and kept in registry order');
  assert.equal(normalized.holdMotion, false);
  assert.equal(normalized.seed, 42);

  assert.deepEqual(normalizeKineticSettings({ kineticPresetPool: [] }).pool, KINETIC_PRESET_IDS);
});

test('seeded random is deterministic and bounded', () => {
  const a = createSeededRandom(1234);
  const b = createSeededRandom(1234);
  const values = Array.from({ length: 50 }, () => a());
  assert.deepEqual(values, Array.from({ length: 50 }, () => b()));
  assert.ok(values.every((value) => value >= 0 && value < 1));
  assert.notDeepEqual(values, Array.from({ length: 50 }, createSeededRandom(1235)));
});

test('preset picking never repeats on consecutive lines and stays inside the pool', () => {
  for (const pool of [['cascade', 'wave'], ['cascade', 'drop', 'wave'], KINETIC_PRESET_IDS]) {
    for (const seed of [0, 7, 99991]) {
      let previous = null;
      for (let lineIndex = 0; lineIndex < 240; lineIndex += 1) {
        const picked = pickKineticPreset({ pool, seed, lineIndex });
        assert.ok(pool.includes(picked), `${picked} should be in the pool`);
        assert.notEqual(picked, previous, `line ${lineIndex} repeated ${picked} (seed ${seed}, pool ${pool.length})`);
        previous = picked;
      }
    }
  }

  assert.equal(pickKineticPreset({ pool: ['zoom'], seed: 5, lineIndex: 12 }), 'zoom');
});

test('preset picking uses the whole pool over a cycle', () => {
  const seen = new Set();
  for (let lineIndex = 0; lineIndex < KINETIC_PRESET_IDS.length; lineIndex += 1) {
    seen.add(pickKineticPreset({ pool: KINETIC_PRESET_IDS, seed: 3, lineIndex }));
  }
  assert.equal(seen.size, KINETIC_PRESET_IDS.length);
});

test('segments text into lines, words and whole graphemes', () => {
  const segmented = segmentKineticText('Café  👍🏽 joy\nSecond   line');
  assert.equal(segmented.length, 2);
  assert.deepEqual(segmented[0].map((word) => word.text), ['Café', '👍🏽', 'joy']);
  assert.deepEqual(segmented[0][0].letters, ['C', 'a', 'f', 'é']);
  assert.deepEqual(segmented[0][1].letters, ['👍🏽']);
  assert.deepEqual(segmented[1].map((word) => word.text), ['Second', 'line']);
  assert.deepEqual(segmentKineticText('   \n  '), [[], []]);
});

test('plans are deterministic for the same line and song', () => {
  assert.deepEqual(planFor(), planFor());
  const plans = Array.from({ length: 12 }, (_, lineKey) => planFor({ lineKey }).presetId);
  assert.ok(new Set(plans).size > 1, 'different lines should vary their recipe');
});

test('section keys group repeats of the same song part', () => {
  assert.equal(normalizeKineticSectionKey('Chorus'), 'chorus');
  assert.equal(normalizeKineticSectionKey('[Chorus 2]'), 'chorus');
  assert.equal(normalizeKineticSectionKey('Chorus x2'), 'chorus');
  assert.equal(normalizeKineticSectionKey('Verse 1'), 'verse');
  assert.equal(normalizeKineticSectionKey('Verse: Lead'), 'verse');
  assert.equal(normalizeKineticSectionKey('Pre-Chorus'), 'pre-chorus');
  assert.equal(normalizeKineticSectionKey('   '), '');
});

test('resolves the section of a line with a stable ordinal per song part', () => {
  const sections = [
    { id: 's0', label: 'Verse 1', startLine: 1, endLine: 2 },
    { id: 's1', label: 'Chorus', startLine: 4, endLine: 5 },
    { id: 's2', label: 'Verse 2', startLine: 7, endLine: 8 },
    { id: 's3', label: 'Chorus', startLine: 10, endLine: 11 },
    { id: 's4', label: 'Bridge', startLine: 13, endLine: 13 },
  ];
  const lineToSection = { 1: 's0', 2: 's0', 4: 's1', 5: 's1', 7: 's2', 8: 's2', 10: 's3', 11: 's3', 13: 's4' };
  const resolve = (lineIndex) => resolveKineticSection({ sections, lineToSection, lineIndex });

  assert.deepEqual(resolve(1), { key: 'verse', ordinal: 0 });
  assert.deepEqual(resolve(5), { key: 'chorus', ordinal: 1 });
  assert.deepEqual(resolve(8), { key: 'verse', ordinal: 0 });
  assert.deepEqual(resolve(10), { key: 'chorus', ordinal: 1 });
  assert.deepEqual(resolve(13), { key: 'bridge', ordinal: 2 });
  assert.equal(resolve(0), null);
  assert.equal(resolveKineticSection({ sections: [], lineToSection: {}, lineIndex: 3 }), null);
});

test('a song part keeps one recipe and repeated lines replay identically', () => {
  const chorus = { key: 'chorus', ordinal: 1 };
  const firstPass = planFor({ lineKey: 4, section: chorus });
  const secondPass = planFor({ lineKey: 10, section: chorus });
  assert.deepEqual(firstPass, secondPass, 'the same chorus line looks the same every time');

  const otherChorusLine = planFor({ lineKey: 5, section: chorus, text: 'That saved a wretch like me' });
  assert.equal(otherChorusLine.presetId, firstPass.presetId);
  assert.equal(otherChorusLine.exitId, firstPass.exitId);
  assert.equal(otherChorusLine.holdId, firstPass.holdId);
});

test('different song parts get different recipes while the pool allows it', () => {
  const presets = Array.from({ length: KINETIC_PRESET_IDS.length }, (_, ordinal) => (
    planFor({ section: { key: `part-${ordinal}`, ordinal } }).presetId
  ));
  assert.equal(new Set(presets).size, KINETIC_PRESET_IDS.length);
});

test('per-line variation ignores sections', () => {
  const chorus = { key: 'chorus', ordinal: 1 };
  const settings = { kineticVariation: 'line' };
  const presets = Array.from({ length: 6 }, (_, lineKey) => (
    planFor({ lineKey, section: chorus, settings }).presetId
  ));
  assert.ok(new Set(presets).size > 1);
});

test('plans return null when there is nothing to animate', () => {
  assert.equal(planFor({ text: '' }), null);
  assert.equal(planFor({ text: '   ' }), null);
});

test('plans expose one token per word or per letter and map words onto them', () => {
  for (const presetId of KINETIC_PRESET_IDS) {
    const plan = planFor({ settings: { kineticPresetPool: [presetId] } });
    assert.equal(plan.presetId, presetId);
    const words = plan.lines.flatMap((line) => line.words);
    const expectedTokens = plan.unit === 'letter'
      ? words.reduce((count, word) => count + word.letters.length, 0)
      : words.length;
    assert.equal(plan.tokens.length, expectedTokens, `${presetId} token count`);
    words.forEach((word) => {
      assert.ok(Number.isInteger(word.firstToken));
      assert.ok(word.firstToken >= 0 && word.firstToken < plan.tokens.length);
    });
  }
});

test('every preset settles fully within the intensity settle limit', () => {
  const longLine = 'Through many dangers toils and snares I have already come tis grace';
  for (const intensity of Object.keys(KINETIC_INTENSITY_PROFILES)) {
    for (const presetId of KINETIC_PRESET_IDS) {
      const plan = planFor({ text: longLine, settings: { kineticIntensity: intensity, kineticPresetPool: [presetId] } });
      assert.ok(
        plan.enterDurationMs <= KINETIC_INTENSITY_PROFILES[intensity].settleMs,
        `${presetId}/${intensity} settles in ${plan.enterDurationMs}ms`
      );
      plan.tokens.forEach((_, tokenIndex) => {
        assert.deepEqual(sampleKineticEnter(plan, tokenIndex, plan.enterDurationMs), REST);
        assert.deepEqual(sampleKineticEnter(plan, tokenIndex, plan.enterDurationMs + 5000), REST);
      });
      assert.notDeepEqual(sampleKineticEnter(plan, 0, 0), REST, `${presetId} should start away from rest`);
    }
  }
});

test('wild moves further than subtle for the same recipe', () => {
  const distance = (sample) => Math.abs(sample.x) + Math.abs(sample.y) + Math.abs(sample.rotate) / 10
    + Math.abs(sample.scale - 1) + sample.blur;
  const total = (intensity) => {
    const plan = planFor({ settings: { kineticIntensity: intensity, kineticPresetPool: ['scatter'] } });
    return plan.tokens.reduce((sum, _, index) => sum + distance(sampleKineticEnter(plan, index, 0)), 0);
  };
  assert.ok(total('wild') > total('medium'));
  assert.ok(total('medium') > total('subtle'));
});

test('exits start from the given state and finish invisible within the exit duration', () => {
  const plan = planFor();
  assert.ok(plan.exitDurationMs > 0 && plan.exitDurationMs <= 500);
  plan.tokens.forEach((_, tokenIndex) => {
    assert.deepEqual(sampleKineticExit(plan, tokenIndex, 0), REST);
    assert.equal(sampleKineticExit(plan, tokenIndex, plan.exitDurationMs).opacity, 0);
  });

  const midEnter = sampleKineticEnter(plan, 0, 10);
  assert.deepEqual(sampleKineticExit(plan, 0, 0, midEnter), midEnter);
});

test('hold motion is gentle and can be switched off', () => {
  const plan = planFor({ settings: { kineticIntensity: 'wild' } });
  for (let tMs = 0; tMs <= 60000; tMs += 750) {
    const hold = sampleKineticHold(plan, tMs);
    assert.ok(hold.scale >= 1 && hold.scale <= 1.08, `scale ${hold.scale}`);
    assert.ok(Math.abs(hold.x) <= 0.15 && Math.abs(hold.y) <= 0.15);
  }

  const still = planFor({ settings: { kineticHoldMotion: false } });
  assert.deepEqual(sampleKineticHold(still, 4000), { x: 0, y: 0, scale: 1 });
});

test('without replay a live line enters once and then holds at rest', () => {
  const plan = planFor();
  assert.equal(plan.loopHoldMs, null);
  assert.deepEqual(getKineticLoopPosition(plan, 0), { cycle: 0, cycleElapsedMs: 0, phase: 'enter' });
  assert.deepEqual(
    getKineticLoopPosition(plan, plan.enterDurationMs + 120000),
    { cycle: 0, cycleElapsedMs: plan.enterDurationMs + 120000, phase: 'hold' }
  );
  plan.tokens.forEach((_, index) => {
    assert.deepEqual(sampleKineticLive(plan, index, 5), sampleKineticEnter(plan, index, 5));
    assert.deepEqual(sampleKineticLive(plan, index, 120000), REST);
  });
});

test('replay while live cycles enter, hold, exit and a hidden gap with the same recipe', () => {
  const plan = planFor({ settings: { kineticLoop: true, kineticLoopHoldMs: 3000 } });
  assert.equal(plan.loopHoldMs, 3000);

  const holdEnd = plan.enterDurationMs + 3000;
  const exitEnd = holdEnd + plan.exitDurationMs;
  const cycleLength = exitEnd + KINETIC_LOOP_GAP_MS;

  assert.equal(getKineticLoopPosition(plan, 10).phase, 'enter');
  assert.equal(getKineticLoopPosition(plan, plan.enterDurationMs + 1).phase, 'hold');
  assert.equal(getKineticLoopPosition(plan, holdEnd + 1).phase, 'exit');
  assert.equal(getKineticLoopPosition(plan, exitEnd + 1).phase, 'gap');
  assert.deepEqual(getKineticLoopPosition(plan, cycleLength + 25), { cycle: 1, cycleElapsedMs: 25, phase: 'enter' });

  plan.tokens.forEach((_, index) => {
    assert.deepEqual(sampleKineticLive(plan, index, plan.enterDurationMs + 10), REST);
    assert.deepEqual(sampleKineticLive(plan, index, holdEnd + 40), sampleKineticExit(plan, index, 40));
    assert.equal(sampleKineticLive(plan, index, exitEnd + 1).opacity, 0);
    assert.deepEqual(sampleKineticLive(plan, index, cycleLength), sampleKineticEnter(plan, index, 0));
    assert.deepEqual(sampleKineticLive(plan, index, (cycleLength * 3) + 60), sampleKineticLive(plan, index, 60));
  });
});

test('samples convert to font-relative CSS and drop no-op properties', () => {
  assert.deepEqual(kineticSampleToStyle(REST), { opacity: '1', transform: 'none', filter: 'none' });
  const style = kineticSampleToStyle({ opacity: 0.5, x: 0.25, y: -1, rotate: 12, scale: 1.5, blur: 0.1 });
  assert.equal(style.opacity, '0.5');
  assert.equal(style.transform, 'translate(0.25em, -1em) rotate(12deg) scale(1.5)');
  assert.equal(style.filter, 'blur(0.1em)');
});

test('replay key changes only when kinetic settings change', () => {
  const base = getKineticReplayKey({ fontSize: 48 });
  assert.equal(base, getKineticReplayKey({ fontSize: 72 }));
  assert.notEqual(base, getKineticReplayKey({ kineticSeed: 9 }));
  assert.notEqual(base, getKineticReplayKey({ kineticIntensity: 'wild' }));
});
