import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildScheduleTimeline,
  calculateScheduleItemStartTimes,
  calculateScheduleProjection,
  inferSchedulePosition,
  normalizeScheduleDocument,
  parseScheduleDocument,
  parseScheduleText,
  resolveActualScheduleStart,
  resolveScheduleOccurrence,
  serializeScheduleDocument,
} from '../shared/scheduleUtils.js';

test('schedule parser handles the supplied mixed timed and manual service format', () => {
  const parsed = parseScheduleText(`Tomorrow's service schedule.

1. Opening prayer: Min Joy
2. Praise/worship: 30mins
3. 1st prayer: Min Elect Worship. 4mins
4. 2nd prayer: Min George 4mins
5. Welcome Address/Bible reading: Mama`);

  assert.equal(parsed.schedule.title, "Tomorrow's service schedule");
  assert.equal(parsed.schedule.items.length, 5);
  assert.equal(parsed.schedule.items[0].label, 'Opening prayer: Min Joy');
  assert.equal(parsed.schedule.items[0].timed, false);
  assert.equal(parsed.schedule.items[1].durationMs, 30 * 60_000);
  assert.equal(parsed.schedule.items[2].label, '1st prayer: Min Elect Worship');
  assert.equal(parsed.schedule.items[2].durationMs, 4 * 60_000);
  assert.equal(parsed.stats.manualCount, 2);
});

test('schedule parser accepts flexible minute spacing, casing, and hour combinations', () => {
  const parsed = parseScheduleText(`Service schedule
1. One 4Mins
2. Two 4 minutes
3. Three 4 min
4. Four 4min
5. Five 4  min
6. Six 4  minutes
7. Seven 1 hour
8. Eight 2hrs 30 minutes`);

  assert.deepEqual(
    parsed.schedule.items.map((item) => item.durationMs),
    [4, 4, 4, 4, 4, 4, 60, 150].map((minutes) => minutes * 60_000)
  );
  assert.deepEqual(
    parsed.schedule.items.map((item) => item.label),
    ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight']
  );
});

test('schedule parser does not confuse minister abbreviations with minutes', () => {
  const parsed = parseScheduleText(`Order of service
1. Opening prayer: Min Joy
2. Message: Minister George
3. Response: Min. Ada 5 min`);

  assert.equal(parsed.schedule.items[0].timed, false);
  assert.equal(parsed.schedule.items[1].timed, false);
  assert.equal(parsed.schedule.items[2].durationMs, 5 * 60_000);
  assert.equal(parsed.schedule.items[2].label, 'Response: Min. Ada');
});

test('schedule parser reads Markdown tables and infers durations from consecutive start times', () => {
  const parsed = parseScheduleText(`## Sunday programme

| Time | Item |
| --- | --- |
| 9:00 AM | Welcome |
| 9:15 AM | Worship |
| 10:00 AM | Message |`);

  assert.equal(parsed.schedule.items.length, 3);
  assert.equal(parsed.schedule.eventStartTime, '09:00');
  assert.equal(parsed.schedule.items[0].plannedStartTime, '09:00');
  assert.equal(parsed.schedule.items[0].durationMs, 15 * 60_000);
  assert.equal(parsed.schedule.items[1].durationMs, 45 * 60_000);
  assert.equal(parsed.schedule.items[2].timed, false);
  assert.equal(parsed.stats.inferredDurationCount, 2);
});

test('schedule parser accepts hour-only AM/PM clock ranges', () => {
  const parsed = parseScheduleText(`Event timeline
9 AM - 10 AM Doors open
10 AM - 11:30 AM Main session`);

  assert.equal(parsed.schedule.items[0].plannedStartTime, '09:00');
  assert.equal(parsed.schedule.eventStartTime, '09:00');
  assert.equal(parsed.schedule.items[0].durationMs, 60 * 60_000);
  assert.equal(parsed.schedule.items[1].durationMs, 90 * 60_000);
});

test('schedule parser accepts untimed plain lines after an explicit schedule title', () => {
  const parsed = parseScheduleText(`Order of service
Opening prayer
Worship
Message`);

  assert.deepEqual(parsed.schedule.items.map((item) => item.label), ['Opening prayer', 'Worship', 'Message']);
  assert.equal(parsed.stats.manualCount, 3);
});

test('LyricDisplay schedules round-trip through the versioned document format', () => {
  const serialized = serializeScheduleDocument({
    title: 'Evening Service',
    eventStartTime: '18:00',
    idealEndTime: '20:30',
    indicator: { enabled: true, durationSeconds: 15, label: 'Coming up' },
    items: [
      { id: 'welcome', label: 'Welcome', durationMs: 10 * 60_000, timed: true },
      { id: 'response', label: 'Open response', durationMs: null, timed: false },
    ],
  });
  const schedule = parseScheduleDocument(serialized);

  assert.equal(schedule.format, 'lyricdisplay-schedule');
  assert.equal(schedule.version, 1);
  assert.equal(schedule.eventStartTime, '18:00');
  assert.equal(schedule.idealEndTime, '20:30');
  assert.equal(schedule.items[1].timed, false);
  assert.equal(schedule.indicator.durationSeconds, 15);
  assert.equal(schedule.showGlobalTimeDuringManualItems, true);
});

test('schedule documents can keep the count-up timer visible for manual items', () => {
  const schedule = parseScheduleDocument(serializeScheduleDocument({
    title: 'Manual timer schedule',
    showGlobalTimeDuringManualItems: false,
    items: [{ id: 'response', label: 'Open response', durationMs: null, timed: false }],
  }));

  assert.equal(schedule.showGlobalTimeDuringManualItems, false);
});

test('schedule documents preserve an optional event date only when a start time exists', () => {
  const dated = normalizeScheduleDocument({ eventStartTime: '09:00', eventDate: '2026-07-22' });
  const undated = normalizeScheduleDocument({ eventDate: '2026-07-22' });

  assert.equal(dated.eventDate, '2026-07-22');
  assert.equal(undated.eventDate, '');
  assert.equal(parseScheduleDocument(serializeScheduleDocument({
    ...dated,
    items: [{ label: 'Welcome', durationMs: 60_000 }],
  })).eventDate, '2026-07-22');
});

test('schedule occurrence resolution binds local dates and replaces stale time-only bindings', () => {
  const now = new Date(2026, 6, 22, 10, 30, 0, 0).getTime();
  const today = resolveScheduleOccurrence({ eventStartTime: '09:00', now });
  const dated = resolveScheduleOccurrence({ eventStartTime: '09:00', eventDate: '2026-07-24', now });
  const stale = resolveScheduleOccurrence({
    eventStartTime: '11:00',
    boundStartAt: now - (19 * 60 * 60_000),
    now,
  });
  const nextMorning = new Date(2026, 6, 23, 2, 0, 0, 0).getTime();
  const previousMorningBinding = new Date(2026, 6, 22, 9, 0, 0, 0).getTime();
  const reboundBeforeEvent = resolveScheduleOccurrence({
    eventStartTime: '09:00',
    boundStartAt: previousMorningBinding,
    now: nextMorning,
  });

  assert.equal(new Date(today).getDate(), 22);
  assert.equal(new Date(today).getHours(), 9);
  assert.equal(new Date(dated).getDate(), 24);
  assert.equal(new Date(stale).getDate(), 22);
  assert.equal(new Date(stale).getHours(), 11);
  assert.equal(new Date(reboundBeforeEvent).getDate(), 23);
  assert.equal(new Date(reboundBeforeEvent).getHours(), 9);
});

test('actual start resolution handles overnight events without accepting a future same-day time', () => {
  const scheduled = new Date(2026, 6, 22, 23, 30, 0, 0).getTime();
  const afterMidnight = new Date(2026, 6, 23, 0, 10, 0, 0).getTime();
  const actual = resolveActualScheduleStart('00:05', scheduled, afterMidnight);
  const future = resolveActualScheduleStart(
    '11:00',
    new Date(2026, 6, 22, 9, 0, 0, 0).getTime(),
    new Date(2026, 6, 22, 10, 0, 0, 0).getTime()
  );

  assert.equal(new Date(actual).getDate(), 23);
  assert.equal(new Date(actual).getHours(), 0);
  assert.equal(future, null);
});

test('timeline inference catches an on-time schedule up to the correct item and transition', () => {
  const startAt = new Date(2026, 6, 22, 9, 0, 0, 0).getTime();
  const items = [
    { id: 'welcome', label: 'Welcome', durationMs: 10 * 60_000 },
    { id: 'worship', label: 'Worship', durationMs: 20 * 60_000 },
  ];
  const duringTransition = inferSchedulePosition({
    items,
    scheduledStartAt: startAt,
    actualStartAt: startAt,
    transitionMs: 60_000,
    now: startAt + (10 * 60_000) + 30_000,
  });
  const duringWorship = inferSchedulePosition({
    items,
    scheduledStartAt: startAt,
    actualStartAt: startAt,
    transitionMs: 0,
    now: startAt + (28 * 60_000),
  });

  assert.equal(duringTransition.kind, 'transition');
  assert.equal(duringTransition.suggestedItemIndex, 1);
  assert.equal(duringTransition.remainingMs, 30_000);
  assert.equal(duringWorship.kind, 'item');
  assert.equal(duringWorship.suggestedItemIndex, 1);
  assert.equal(duringWorship.remainingMs, 2 * 60_000);
});

test('timeline inference stops at an unbounded manual item and can resume from a fixed anchor', () => {
  const startAt = new Date(2026, 6, 22, 9, 0, 0, 0).getTime();
  const unbounded = buildScheduleTimeline({
    scheduledStartAt: startAt,
    actualStartAt: startAt,
    items: [
      { id: 'manual', label: 'Open ministry', timed: false, durationMs: null },
      { id: 'message', label: 'Message', durationMs: 20 * 60_000 },
    ],
  });
  const anchored = inferSchedulePosition({
    scheduledStartAt: startAt,
    actualStartAt: startAt,
    now: startAt + (35 * 60_000),
    items: [
      { id: 'manual', label: 'Open ministry', timed: false, durationMs: null },
      { id: 'message', label: 'Message', durationMs: 20 * 60_000, plannedStartTime: '09:30' },
    ],
  });

  assert.equal(unbounded.complete, false);
  assert.equal(unbounded.itemTimings[1], null);
  assert.equal(anchored.kind, 'item');
  assert.equal(anchored.suggestedItemIndex, 1);
  assert.equal(anchored.remainingMs, 15 * 60_000);
});

test('schedule documents reject unsupported future versions instead of down-converting them', () => {
  assert.throws(() => parseScheduleDocument({
    format: 'lyricdisplay-schedule',
    version: 2,
    items: [{ id: 'welcome', label: 'Welcome', durationMs: 60_000 }],
  }), /newer LyricDisplay version/i);
});

test('schedule normalization assigns stable unique ids and safe text defaults', () => {
  const schedule = normalizeScheduleDocument({
    title: '   ',
    indicator: { label: '   ' },
    items: [
      { id: 'duplicate', label: 'First', durationMs: 60_000 },
      { id: 'duplicate', label: 'Second', durationMs: 60_000 },
      { id: 'duplicate-2', label: 'Third', durationMs: 60_000 },
    ],
  });

  assert.equal(schedule.title, 'Service Schedule');
  assert.equal(schedule.indicator.label, 'Next item starts in');
  assert.deepEqual(schedule.items.map((item) => item.id), ['duplicate', 'duplicate-2', 'duplicate-2-2']);
  assert.equal(new Set(schedule.items.map((item) => item.id)).size, schedule.items.length);
});

test('derived item starts include transitions and stop after a manual item', () => {
  const starts = calculateScheduleItemStartTimes({
    eventStartTime: '23:50',
    transitionMs: 2 * 60_000,
    items: [
      { label: 'Welcome', durationMs: 10 * 60_000, timed: true },
      { label: 'Open ministry', durationMs: null, timed: false },
      { label: 'Message', durationMs: 20 * 60_000, timed: true },
    ],
  });

  assert.deepEqual(starts, ['23:50', '00:02', '']);
});

test('schedule projections identify minimum finish estimates when manual items remain', () => {
  const now = new Date('2026-07-20T10:00:00Z').getTime();
  const projection = calculateScheduleProjection({
    now,
    items: [
      { label: 'Timed', durationMs: 30 * 60_000, timed: true },
      { label: 'Manual', durationMs: null, timed: false },
      { label: 'Timed 2', durationMs: 15 * 60_000, timed: true },
    ],
    transitionMs: 5_000,
    idealEndAt: now + (40 * 60_000),
  });

  assert.equal(projection.knownRemainingMs, 45 * 60_000);
  assert.equal(projection.transitionRemainingMs, 10_000);
  assert.equal(projection.manualItemCount, 1);
  assert.equal(projection.isEstimate, true);
  assert.equal(projection.status, 'behind');
});

test('schedule projections remain unconfigured when no ideal end is set', () => {
  const now = new Date('2026-07-20T10:00:00Z').getTime();

  for (const idealEndAt of [null, undefined, '']) {
    const projection = calculateScheduleProjection({
      now,
      items: [{ label: 'Timed', durationMs: 30 * 60_000, timed: true }],
      idealEndAt,
      idealEndTime: '',
    });

    assert.equal(projection.projectedEndAt, now + (30 * 60_000));
    assert.equal(projection.idealEndAt, null);
    assert.equal(projection.varianceMs, null);
    assert.equal(projection.status, 'unconfigured');
  }
});

test('schedule projections normalize fractional active indexes to an existing item', () => {
  const now = 1_000_000;
  const projection = calculateScheduleProjection({
    now,
    active: true,
    activeIndex: 1.75,
    currentRemainingMs: 30_000,
    items: [
      { id: 'first', label: 'First', durationMs: 60_000 },
      { id: 'second', label: 'Second', durationMs: 60_000 },
      { id: 'third', label: 'Third', durationMs: 60_000 },
    ],
  });

  assert.equal(projection.remainingItemCount, 2);
  assert.equal(projection.knownRemainingMs, 90_000);
});
