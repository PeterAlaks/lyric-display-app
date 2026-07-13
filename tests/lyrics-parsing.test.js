import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildLyricsParsingOptions,
  createGroupingPlan,
  extractExplicitGroupingDirective,
  isManualNormalGroupCandidate,
  normalizeLyricsParsingOptions,
  parseLrcContent,
  parseTxtContent,
} from '../shared/lyricsParsing.js';
import { formatLyrics, formatLyricsWithStats, reconstructEditableText } from '../src/utils/lyricsFormat.js';

test('persisted parsing preferences map to the same parser options on every load path', () => {
  const options = buildLyricsParsingOptions({
    enableSplitting: false,
    normalGroupConfig: {
      ENABLED: true,
      MAX_LINE_LENGTH: 60,
      MAX_LINES_PER_GROUP: 2,
      CROSS_BLANK_LINE_GROUPING: true,
    },
    enableTranslationGrouping: false,
    structureTagsConfig: { MODE: 'keep' },
  });

  assert.equal(options.enableSplitting, false);
  assert.deepEqual(options.groupingConfig, {
    enableAutoLineGrouping: true,
    enableTranslationGrouping: false,
    maxLineLength: 60,
    maxLinesPerGroup: 2,
    enableCrossBlankLineGrouping: true,
    structureTagMode: 'keep',
  });
});

test('the complete parsing profile normalizes every exposed splitting value and its relationships', () => {
  const options = normalizeLyricsParsingOptions({
    enableSplitting: false,
    splitConfig: {
      targetLength: 120,
      minLength: 80,
      maxLength: 50,
      overflowTolerance: 30,
    },
    groupingConfig: {
      enableAutoLineGrouping: false,
      enableTranslationGrouping: false,
      maxLineLength: 60,
      maxLinesPerGroup: 4,
      enableCrossBlankLineGrouping: false,
      structureTagMode: 'keep',
    },
  });

  assert.equal(options.enableSplitting, false);
  assert.deepEqual(options.splitConfig, {
    TARGET_LENGTH: 50,
    MIN_LENGTH: 50,
    MAX_LENGTH: 50,
    OVERFLOW_TOLERANCE: 30,
  });
  assert.deepEqual(options.groupingConfig, {
    enableAutoLineGrouping: false,
    enableTranslationGrouping: false,
    maxLineLength: 60,
    maxLinesPerGroup: 4,
    enableCrossBlankLineGrouping: false,
    structureTagMode: 'keep',
  });
});

const SPLIT_GROUPING_OPTIONS = {
  enableSplitting: true,
  splitConfig: {
    TARGET_LENGTH: 60,
    MIN_LENGTH: 40,
    MAX_LENGTH: 80,
    OVERFLOW_TOLERANCE: 15,
  },
  groupingConfig: {
    enableAutoLineGrouping: true,
    enableTranslationGrouping: true,
    maxLineLength: 60,
    maxLinesPerGroup: 2,
    enableCrossBlankLineGrouping: true,
    structureTagMode: 'isolate',
  },
};

test('TXT split siblings group only when eligible and never absorb an unrelated lyric', () => {
  const twoPartLine = 'This deliberately extended lyric sentence carries enough carefully chosen words to split near the configured boundary';
  const eligible = parseTxtContent(`${twoPartLine}\n\nREADY TO DO YOUR WILL`, SPLIT_GROUPING_OPTIONS);

  assert.equal(eligible.processedLines[0].type, 'normal-group');
  assert.deepEqual(eligible.processedLines[0].lines.map((line) => line.length), [56, 60]);
  assert.equal(eligible.processedLines[1], 'READY TO DO YOUR WILL');

  const threePartLine = `${twoPartLine} extra words beyond here`;
  const overflow = parseTxtContent(`${threePartLine}\n\nREADY TO DO YOUR WILL`, SPLIT_GROUPING_OPTIONS);

  assert.equal(overflow.processedLines[0].type, 'normal-group');
  assert.equal(overflow.processedLines[1], 'Extra words beyond here');
  assert.equal(overflow.processedLines[2], 'READY TO DO YOUR WILL');
});

test('LRC splitting preserves one cue timestamp and leaves oversized cues atomic', () => {
  const twoPartLine = 'This deliberately extended lyric sentence carries enough carefully chosen words to split near the configured boundary';
  const eligible = parseLrcContent(`[00:01.00]${twoPartLine}`, SPLIT_GROUPING_OPTIONS);

  assert.equal(eligible.processedLines.length, 1);
  assert.equal(eligible.processedLines[0].type, 'normal-group');
  assert.deepEqual(eligible.timestamps, [100]);

  const threePartLine = `${twoPartLine} extra words beyond here`;
  const oversized = parseLrcContent(`[00:01.00]${threePartLine}`, SPLIT_GROUPING_OPTIONS);
  assert.deepEqual(oversized.processedLines, [threePartLine]);
  assert.deepEqual(oversized.timestamps, [100]);

  const groupingDisabled = parseLrcContent(`[00:01.00]${twoPartLine}`, {
    ...SPLIT_GROUPING_OPTIONS,
    groupingConfig: {
      ...SPLIT_GROUPING_OPTIONS.groupingConfig,
      enableAutoLineGrouping: false,
    },
  });
  assert.deepEqual(groupingDisabled.processedLines, [twoPartLine]);
  assert.deepEqual(groupingDisabled.timestamps, [100]);
});

test('main lines followed by translations remain atomic in TXT and LRC parsing', () => {
  const main = 'This deliberately extended lyric sentence carries enough carefully chosen words to split near the configured boundary';
  const translation = '[A translated lyric remains attached to the complete source line]';
  const txt = parseTxtContent(`${main}\n${translation}`, SPLIT_GROUPING_OPTIONS);
  const lrc = parseLrcContent(`[00:01.00]${main}\n[00:01.00]${translation}`, SPLIT_GROUPING_OPTIONS);

  for (const parsed of [txt, lrc]) {
    assert.equal(parsed.processedLines.length, 1);
    assert.equal(parsed.processedLines[0].type, 'group');
    assert.equal(parsed.processedLines[0].mainLine, main);
    assert.equal(parsed.processedLines[0].translation, translation);
  }
  assert.deepEqual(lrc.timestamps, [100]);
});

test('manual grouping eligibility uses the configured line-length channel', () => {
  const candidate = 'I CHOOSE TO BE HOLY SET APART FOR YOU MY MASTER';

  assert.equal(candidate.length, 47);
  assert.equal(isManualNormalGroupCandidate(candidate, { maxLineLength: 45 }), false);
  assert.equal(isManualNormalGroupCandidate(candidate, { maxLineLength: 60 }), true);
  assert.equal(isManualNormalGroupCandidate(candidate, {
    enableAutoLineGrouping: false,
    maxLineLength: 60,
  }), true);
});

test('editor cleanup uses the same configured grouping line length', () => {
  const content = 'I CHOOSE TO BE HOLY SET APART FOR YOU MY MASTER\nREADY TO DO YOUR WILL';
  const max45 = formatLyrics(content, {
    groupingConfig: { maxLineLength: 45 },
  });
  const max60 = formatLyrics(content, {
    groupingConfig: { maxLineLength: 60 },
  });

  assert.equal(max45.includes('\n\n'), true);
  assert.equal(max60.includes('\n\n'), false);
});

test('LRC parsing sorts timestamps, strips metadata, and deduplicates repeated timed lines', () => {
  const parsed = parseLrcContent([
    '[ar:Example Artist]',
    '[00:20.00]Second line',
    '[00:10.50]First line',
    '[00:10.50]First line',
    'Untimed refrain',
  ].join('\n'), { enableSplitting: false });

  assert.deepEqual(parsed.processedLines, [
    'First line',
    'Second line',
    'Untimed refrain',
  ]);
  assert.deepEqual(parsed.timestamps, [1050, 2000, null]);
  assert.equal(parsed.rawText, 'First line\nSecond line\nUntimed refrain');
});

test('LRC parsing preserves blank timestamped lines without visible placeholders', () => {
  const parsed = parseLrcContent([
    '[00:01.00]',
    '[00:02.00]First line',
    '[00:03.00]   ',
    '[00:04.00]Second line',
  ].join('\n'));

  assert.deepEqual(parsed.processedLines, [
    '',
    'First line',
    '',
    'Second line',
  ]);
  assert.deepEqual(parsed.timestamps, [100, 200, 300, 400]);
  assert.equal(parsed.rawText, '\nFirst line\n\nSecond line');
});

test('plain text parsing keeps section metadata aligned with processed lines', () => {
  const parsed = parseTxtContent([
    '[Verse 1]',
    'Amazing grace',
    'How sweet the sound',
    '',
    '[Chorus]',
    'I once was lost',
  ].join('\n'), { enableSplitting: false });

  assert.equal(parsed.processedLines[0], '[Verse 1]');
  assert.equal(parsed.processedLines[1].type, 'normal-group');
  assert.deepEqual(parsed.processedLines[1].lines, ['Amazing grace', 'How sweet the sound']);
  assert.equal(parsed.processedLines[2], '[Chorus]');
  assert.equal(parsed.processedLines[3], 'I once was lost');
  assert.equal(parsed.sections.length, 2);
  assert.equal(parsed.sections[0].label, 'Verse 1');
  assert.equal(parsed.sections[1].label, 'Chorus');
  assert.equal(parsed.lineToSection[1], parsed.sections[0].id);
  assert.equal(parsed.lineToSection[3], parsed.sections[1].id);
});

test('app-owned grouping plans round-trip editor group and ungroup boundaries without modifying TXT', () => {
  const manuallyGrouped = [{
    type: 'normal-group',
    id: 'manual-group',
    lines: ['First line', 'Second line', 'Third line'],
    line1: 'First line',
    line2: 'Second line',
    displayText: 'First line\nSecond line\nThird line',
    searchText: 'First line Second line Third line',
  }, 'Standalone line'];
  const groupedPayload = reconstructEditableText(manuallyGrouped);
  const groupedReload = parseTxtContent(groupedPayload, {
    enableSplitting: false,
    groupingPlan: createGroupingPlan(manuallyGrouped),
  });

  assert.equal(groupedReload.processedLines[0].type, 'normal-group');
  assert.deepEqual(groupedReload.processedLines[0].lines, ['First line', 'Second line', 'Third line']);
  assert.equal(groupedReload.processedLines[1], 'Standalone line');
  assert.equal(groupedPayload.includes('LyricDisplay grouping=explicit'), false);
  assert.equal(groupedReload.groupingPlanApplied, true);

  const manuallyUngrouped = ['First line', 'Second line'];
  const ungroupedPayload = reconstructEditableText(manuallyUngrouped);
  const ungroupedReload = parseTxtContent(ungroupedPayload, {
    enableSplitting: false,
    groupingPlan: createGroupingPlan(manuallyUngrouped),
  });

  assert.deepEqual(ungroupedReload.processedLines, manuallyUngrouped);
  assert.equal(ungroupedReload.groupingPlanApplied, true);
});

test('grouping plans are ignored safely when lyric content no longer matches', () => {
  const plan = createGroupingPlan(['First line', 'Second line']);
  const parsed = parseTxtContent('First line\n\nChanged line', {
    enableSplitting: false,
    groupingPlan: plan,
  });

  assert.equal(parsed.groupingPlanApplied, false);
});

test('legacy grouping directives remain readable but are removable during migration', () => {
  const legacy = '[#:LyricDisplay grouping=explicit]\nFirst line\n\nSecond line';
  const extracted = extractExplicitGroupingDirective(legacy);
  const parsed = parseTxtContent(legacy, { enableSplitting: false });

  assert.equal(extracted.explicitGrouping, true);
  assert.equal(extracted.content, 'First line\n\nSecond line');
  assert.deepEqual(parsed.processedLines, ['First line', 'Second line']);
});

test('legacy TXT files retain cross-blank auto-grouping without the explicit directive', () => {
  const parsed = parseTxtContent('First line\n\nSecond line', { enableSplitting: false });

  assert.equal(parsed.processedLines.length, 1);
  assert.equal(parsed.processedLines[0].type, 'normal-group');
  assert.deepEqual(parsed.processedLines[0].lines, ['First line', 'Second line']);
});

test('formatter splits long lines without inserting blank separators between split segments', () => {
  const formatted = formatLyrics(
    'this is a very long lyric line that should split into multiple display lines without becoming separate lyric blocks',
    {
      enableSplitting: true,
      splitConfig: {
        TARGET_LENGTH: 44,
        MIN_LENGTH: 25,
        MAX_LENGTH: 52,
        OVERFLOW_TOLERANCE: 4,
      },
    }
  );

  assert.equal(formatted.includes('\n\n'), false);
  assert.equal(formatted.split('\n').length > 1, true);
});

test('formatter normalizes spaced metadata tags before lyric cleanup', () => {
  const { text, stats } = formatLyricsWithStats('[ ti : Song ]\nhello lord');

  assert.equal(text, '[ti:Song]\n\nHello Lord');
  assert.equal(stats.metadataTagsNormalized, 1);
});

test('formatter capitalizes lyric text after leading LRC timestamps', () => {
  assert.equal(formatLyrics('[00:01.00] hello god', { enableSplitting: false }), '[00:01.00] Hello God');
});

test('LRC parsing strips enhanced word timestamps from visible lyric text', () => {
  const parsed = parseLrcContent('[ti:Example]\n[00:01.00]Hello <00:01.25>world', { enableSplitting: false });

  assert.deepEqual(parsed.processedLines, ['Hello world']);
  assert.deepEqual(parsed.timestamps, [100]);
  assert.deepEqual(parsed.enhancedTimestamps, [[{ time: 125, text: 'world' }]]);
  assert.equal(parsed.rawText, 'Hello world');
});

test('LRC parsing uses enhanced-only timestamps as line timestamps for autoplay', () => {
  const parsed = parseLrcContent([
    '<00:01.00>Hello <00:01.25>world',
    '<00:03.00>Next <00:03.50>line',
  ].join('\n'), { enableSplitting: false });

  assert.deepEqual(parsed.processedLines, ['Hello world', 'Next line']);
  assert.deepEqual(parsed.timestamps, [100, 300]);
  assert.deepEqual(parsed.enhancedTimestamps, [
    [{ time: 100, text: 'Hello' }, { time: 125, text: 'world' }],
    [{ time: 300, text: 'Next' }, { time: 350, text: 'line' }],
  ]);
});

test('LRC parsing ignores metadata tags with inconsistent spacing', () => {
  const parsed = parseLrcContent('[ ti : Example Song ]\n[00:01.00]First line', { enableSplitting: false });

  assert.deepEqual(parsed.processedLines, ['First line']);
  assert.deepEqual(parsed.timestamps, [100]);
});

test('plain text parser recognizes section descriptors separated by en dash', () => {
  const parsed = parseTxtContent('[Chorus \u2013 Leader]\nSing it again', { enableSplitting: false });

  assert.equal(parsed.processedLines[0], '[Chorus \u2013 Leader]');
  assert.equal(parsed.sections.length, 1);
  assert.equal(parsed.sections[0].label, 'Chorus \u2013 Leader');
});
