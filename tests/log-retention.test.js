import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {
  LOG_RETENTION,
  buildLogPrunePlan,
  getLogSessionPath,
} from '../main/logRetention.js';

const MB = 1024 * 1024;

const sessionPath = (index) => path.join('logs', `lyricdisplay-2026-07-${String(index).padStart(2, '0')}_12-00-00-000-pid${index}.log`);

const makeFile = ({ sessionIndex, rotation = '', size = 1 * MB, mtimeMs }) => {
  const basePath = sessionPath(sessionIndex);
  return {
    filePath: `${basePath}${rotation}`,
    sessionPath: basePath,
    size,
    mtimeMs: mtimeMs ?? sessionIndex,
  };
};

test('log session path groups rotated files with their base session', () => {
  const basePath = sessionPath(1);

  assert.equal(getLogSessionPath(`${basePath}.1`), basePath);
  assert.equal(getLogSessionPath(`${basePath}.5`), basePath);
  assert.equal(getLogSessionPath(basePath), basePath);
});

test('retention does not delete sessions when count and size are under budget', () => {
  const files = Array.from({ length: LOG_RETENTION.maxSessions - 1 }, (_, index) => makeFile({
    sessionIndex: index + 1,
    size: 1 * MB,
  }));

  const plan = buildLogPrunePlan(files);

  assert.deepEqual(plan.deletePaths, []);
  assert.equal(plan.stats.totalSessions, LOG_RETENTION.maxSessions - 1);
});

test('retention keeps newest sessions and deletes only sessions beyond max session budget', () => {
  const extraSessions = 4;
  const files = Array.from({ length: LOG_RETENTION.maxSessions + extraSessions }, (_, index) => makeFile({
    sessionIndex: index + 1,
    size: 1 * MB,
  }));

  const plan = buildLogPrunePlan(files);

  assert.equal(plan.deletePaths.length, extraSessions);
  assert.deepEqual(plan.deletePaths, [
    sessionPath(1),
    sessionPath(2),
    sessionPath(3),
    sessionPath(4),
  ]);
});

test('retention treats rotations as one session for session-count pruning', () => {
  const files = [];
  for (let index = 1; index <= LOG_RETENTION.maxSessions; index += 1) {
    files.push(makeFile({ sessionIndex: index, rotation: '', size: 1 * MB }));
    files.push(makeFile({ sessionIndex: index, rotation: '.1', size: 1 * MB }));
    files.push(makeFile({ sessionIndex: index, rotation: '.2', size: 1 * MB }));
  }

  const plan = buildLogPrunePlan(files, {
    maxDirectoryBytes: 1000 * MB,
  });

  assert.deepEqual(plan.deletePaths, []);
  assert.equal(plan.stats.totalFiles, LOG_RETENTION.maxSessions * 3);
  assert.equal(plan.stats.totalSessions, LOG_RETENTION.maxSessions);
});

test('retention prunes oldest unprotected files until directory budget is reached', () => {
  const files = Array.from({ length: 12 }, (_, index) => makeFile({
    sessionIndex: index + 1,
    size: 10 * MB,
  }));

  const plan = buildLogPrunePlan(files, {
    maxSessions: 30,
    minProtectedSessions: 3,
    maxDirectoryBytes: 90 * MB,
  });

  assert.deepEqual(plan.deletePaths, [
    sessionPath(1),
    sessionPath(2),
    sessionPath(3),
  ]);
  assert.equal(plan.stats.totalBytesAfter, 90 * MB);
});

test('retention preserves protected newest sessions even when they exceed directory budget', () => {
  const files = Array.from({ length: 3 }, (_, index) => makeFile({
    sessionIndex: index + 1,
    size: 30 * MB,
  }));

  const plan = buildLogPrunePlan(files, {
    maxSessions: 10,
    minProtectedSessions: 3,
    maxDirectoryBytes: 50 * MB,
  });

  assert.deepEqual(plan.deletePaths, []);
  assert.equal(plan.stats.totalBytesAfter, 90 * MB);
});

test('retention always preserves the requested current session', () => {
  const currentSession = sessionPath(1);
  const files = Array.from({ length: LOG_RETENTION.maxSessions + 2 }, (_, index) => makeFile({
    sessionIndex: index + 1,
    size: 1 * MB,
  }));

  const plan = buildLogPrunePlan(files, {
    preservePaths: [currentSession],
  });

  assert.equal(plan.deletePaths.includes(currentSession), false);
  assert.equal(plan.deletePaths.includes(sessionPath(2)), true);
});
