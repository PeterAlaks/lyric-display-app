import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BatchedLogWriter,
  formatStructuredLogRecord,
} from '../main/batchedLogWriter.js';
import { correlateExternalAction } from '../main/externalControlCorrelation.js';

test('batched writer combines queued entries into one asynchronous write', async () => {
  const writes = [];
  const writer = new BatchedLogWriter({
    writeBatch: async (batch) => { writes.push(batch); },
    flushIntervalMs: 10_000,
  });

  writer.enqueue('first\n');
  writer.enqueue('second\n');
  assert.deepEqual(writes, []);

  assert.equal(await writer.flushAll(), true);
  assert.deepEqual(writes, ['first\nsecond\n']);
  assert.equal(writer.getStats().queuedBytes, 0);
});

test('batched writer keeps memory bounded and reports dropped flood entries', async () => {
  const writes = [];
  const writer = new BatchedLogWriter({
    writeBatch: async (batch) => { writes.push(batch); },
    formatDropNotice: (count) => `dropped=${count}\n`,
    maxQueuedBytes: 1024,
    maxBatchBytes: 1024,
    maxEntryBytes: 512,
    flushIntervalMs: 10_000,
  });

  for (let index = 0; index < 20; index += 1) {
    writer.enqueue(`${index}:${'x'.repeat(180)}\n`);
  }

  const beforeFlush = writer.getStats();
  assert.ok(beforeFlush.queuedBytes <= 1024);
  assert.ok(beforeFlush.totalDroppedEntries > 0);
  await writer.flushAll();
  assert.match(writes.join(''), /dropped=\d+/);
});

test('batched writer also bounds queue bookkeeping for tiny flood entries', async () => {
  const writes = [];
  const writer = new BatchedLogWriter({
    writeBatch: async (batch) => { writes.push(batch); },
    formatDropNotice: (count) => `dropped=${count}\n`,
    maxQueuedBytes: 64 * 1024,
    maxQueuedEntries: 10,
    flushIntervalMs: 10_000,
  });

  for (let index = 0; index < 100; index += 1) writer.enqueue('x');

  assert.equal(writer.getStats().queuedEntries, 10);
  assert.equal(writer.getStats().totalDroppedEntries, 90);
  await writer.flushAll();
  assert.match(writes.join(''), /dropped=90/);
});

test('critical entries evict routine entries when the bounded queue is full', async () => {
  const writes = [];
  const writer = new BatchedLogWriter({
    writeBatch: async (batch) => { writes.push(batch); },
    formatDropNotice: (count) => `dropped=${count}\n`,
    maxQueuedBytes: 1024,
    maxBatchBytes: 2048,
    maxEntryBytes: 700,
    flushIntervalMs: 10_000,
  });

  writer.enqueue(`routine:${'r'.repeat(600)}\n`);
  writer.enqueue(`fatal:${'f'.repeat(600)}\n`, { critical: true });
  await writer.flushAll();

  const output = writes.join('');
  assert.doesNotMatch(output, /routine:/);
  assert.match(output, /fatal:/);
  assert.match(output, /dropped=1/);
});

test('write failures disable the queue and release buffered memory', async () => {
  const errors = [];
  const writer = new BatchedLogWriter({
    writeBatch: async () => { throw new Error('disk unavailable'); },
    onError: (error) => { errors.push(error.message); },
    flushIntervalMs: 10_000,
  });

  writer.enqueue('first\n');
  writer.enqueue('second\n');

  assert.equal(await writer.flushAll(), false);
  assert.deepEqual(errors, ['disk unavailable']);
  assert.equal(writer.getStats().failed, true);
  assert.equal(writer.getStats().queuedBytes, 0);
  assert.equal(writer.enqueue('ignored after failure\n'), false);
});

test('structured records remain valid JSON and carry cross-process context', () => {
  const record = formatStructuredLogRecord({
    timestamp: '2026-07-11T20:00:00.000Z',
    level: 'BACKEND',
    message: 'server ready',
    context: {
      sessionId: 'session-test',
      process: 'backend',
      pid: 42,
      source: 'child-process',
    },
  });

  assert.deepEqual(JSON.parse(record), {
    timestamp: '2026-07-11T20:00:00.000Z',
    level: 'BACKEND',
    sessionId: 'session-test',
    process: 'backend',
    pid: 42,
    source: 'child-process',
    message: 'server ready',
  });
});

test('oversized structured messages are truncated without producing invalid JSON', () => {
  const record = formatStructuredLogRecord({
    timestamp: '2026-07-11T20:00:00.000Z',
    level: 'INFO',
    message: 'x'.repeat(100_000),
    context: { sessionId: 'session-test', process: 'main' },
    maxBytes: 4096,
  });

  assert.ok(Buffer.byteLength(record, 'utf8') <= 4096);
  assert.match(JSON.parse(record).message, /truncated/);
});

test('external-control IPC actions receive stable bounded correlation metadata', () => {
  const generatedId = '11111111-1111-4111-8111-111111111111';
  const action = correlateExternalAction(
    { type: 'next-line', source: 'osc', commandId: 'invalid-unbounded-id' },
    { now: () => 1234, createId: () => generatedId }
  );

  assert.equal(action.commandId, generatedId);
  assert.equal(action.sentAt, 1234);
  assert.equal(action.type, 'next-line');
  assert.equal(action.source, 'osc');
});
