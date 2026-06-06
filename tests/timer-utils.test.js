import assert from 'node:assert/strict';
import test from 'node:test';
import { getTimerProgress } from '../src/utils/timerUtils.js';

test('timer progress advances for normalized stage panel countdown state', () => {
  const startTime = 1_000_000;
  const durationMs = 5 * 60_000;
  const timerState = {
    status: 'running',
    running: true,
    paused: false,
    mode: 'countdown',
    phase: 'timer',
    durationMs,
    startTime,
    endTime: startTime + durationMs,
  };

  assert.equal(getTimerProgress(timerState, startTime), 0);
  assert.equal(getTimerProgress(timerState, startTime + (durationMs / 2)), 0.5);
  assert.equal(getTimerProgress(timerState, startTime + durationMs), 1);
});

test('timer progress is zero for legacy stage payload without duration', () => {
  const now = 1_000_000;
  assert.equal(getTimerProgress({
    running: true,
    paused: false,
    endTime: now + 60_000,
    remaining: null,
  }, now), 0);
});
