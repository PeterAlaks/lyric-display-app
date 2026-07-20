import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateScheduleItemStartTimes,
  calculateScheduleProjection,
  parseScheduleDocument,
  parseScheduleText,
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
