import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACTIVE_TIMER_RENDER_POLL_MS,
  TIMER_RENDER_STALL_LOG_COOLDOWN_MS,
  TIMER_RENDER_STALL_THRESHOLD_MS,
  createTimerRenderClock,
  getTimerRenderBucket,
  getTimerRenderSchedule,
} from '../src/utils/timerRenderClock.js';

const runningCountdown = (overrides = {}) => ({
  status: 'running',
  running: true,
  paused: false,
  mode: 'countdown',
  startTime: 0,
  endTime: 20_500,
  ...overrides,
});

test('active timer rendering polls defensively but advances React only on timer-second boundaries', () => {
  let wallNow = 10_100;
  let monotonicNow = 0;
  let intervalCallback = null;
  let intervalDelay = null;
  let clearedInterval = null;
  const renders = [];

  const stop = createTimerRenderClock({
    getTimerState: () => runningCountdown(),
    activeRenderIntervalMs: 1_000,
    now: () => wallNow,
    monotonicNow: () => monotonicNow,
    setIntervalFn(callback, delay) {
      intervalCallback = callback;
      intervalDelay = delay;
      return 42;
    },
    clearIntervalFn(intervalId) {
      clearedInterval = intervalId;
    },
    onRender: (timestamp) => renders.push(timestamp),
  });

  assert.equal(intervalDelay, ACTIVE_TIMER_RENDER_POLL_MS);
  assert.deepEqual(renders, [10_100]);

  wallNow = 10_499;
  monotonicNow = 249;
  intervalCallback();
  assert.deepEqual(renders, [10_100]);

  wallNow = 10_501;
  monotonicNow = 401;
  intervalCallback();
  assert.deepEqual(renders, [10_100, 10_501]);

  wallNow = 10_750;
  monotonicNow = 650;
  intervalCallback();
  assert.deepEqual(renders, [10_100, 10_501]);

  stop();
  assert.equal(clearedInterval, 42);
});

test('timer render buckets follow countdown, count-up, and wall-clock boundaries', () => {
  assert.equal(getTimerRenderBucket(runningCountdown(), 10_499, 1_000), 10);
  assert.equal(getTimerRenderBucket(runningCountdown(), 10_501, 1_000), 9);

  const countup = runningCountdown({ mode: 'countup', startTime: 10_500, endTime: null });
  assert.equal(getTimerRenderBucket(countup, 11_499, 1_000), 0);
  assert.equal(getTimerRenderBucket(countup, 11_500, 1_000), 1);

  const paused = runningCountdown({ status: 'paused', paused: true });
  assert.equal(getTimerRenderBucket(paused, 11_999, 1_000), 11);
  assert.equal(getTimerRenderBucket(paused, 12_000, 1_000), 12);
});

test('paused and idle clocks retain a low-frequency schedule', () => {
  const paused = getTimerRenderSchedule(runningCountdown({ status: 'paused', paused: true }), 1_000);
  const idle = getTimerRenderSchedule({ status: 'idle', running: false }, 1_000);

  assert.deepEqual(paused, {
    advancing: false,
    renderIntervalMs: 1_000,
    pollIntervalMs: 1_000,
  });
  assert.deepEqual(idle, paused);
});

test('active timer stalls are measured with a bounded warning rate', () => {
  let wallNow = 100_000;
  let monotonicNow = 0;
  let intervalCallback = null;
  const delays = [];

  const stop = createTimerRenderClock({
    getTimerState: () => runningCountdown({ endTime: 200_000 }),
    now: () => wallNow,
    monotonicNow: () => monotonicNow,
    setIntervalFn(callback) {
      intervalCallback = callback;
      return 7;
    },
    clearIntervalFn() {},
    onRender() {},
    onDelay: (details) => delays.push(details),
  });

  wallNow += TIMER_RENDER_STALL_THRESHOLD_MS;
  monotonicNow += TIMER_RENDER_STALL_THRESHOLD_MS;
  intervalCallback();
  assert.equal(delays.length, 1);
  assert.equal(delays[0].delayMs, TIMER_RENDER_STALL_THRESHOLD_MS);

  wallNow += TIMER_RENDER_STALL_THRESHOLD_MS;
  monotonicNow += TIMER_RENDER_STALL_THRESHOLD_MS;
  intervalCallback();
  assert.equal(delays.length, 1);

  wallNow += TIMER_RENDER_STALL_LOG_COOLDOWN_MS;
  monotonicNow += TIMER_RENDER_STALL_LOG_COOLDOWN_MS;
  intervalCallback();
  assert.equal(delays.length, 2);

  stop();
});

test('sub-second render intervals never poll faster than their requested cadence', () => {
  assert.deepEqual(getTimerRenderSchedule(runningCountdown(), 100), {
    advancing: true,
    renderIntervalMs: 100,
    pollIntervalMs: 100,
  });
});
