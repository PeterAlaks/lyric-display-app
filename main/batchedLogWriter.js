const DEFAULT_MAX_QUEUED_BYTES = 1024 * 1024;
const DEFAULT_MAX_BATCH_BYTES = 256 * 1024;
const DEFAULT_MAX_ENTRY_BYTES = 64 * 1024;
const DEFAULT_MAX_QUEUED_ENTRIES = 5000;
const DEFAULT_FLUSH_INTERVAL_MS = 50;

const byteLength = (value) => Buffer.byteLength(value, 'utf8');

export function formatStructuredLogRecord({
  timestamp,
  level,
  message,
  context = {},
  maxBytes = DEFAULT_MAX_ENTRY_BYTES,
}) {
  const limit = Math.max(1024, Number(maxBytes) || DEFAULT_MAX_ENTRY_BYTES);
  const truncationSuffix = '… [truncated]';
  let normalizedMessage = String(message || '');
  const buildRecord = () => `${JSON.stringify({
    ...context,
    timestamp,
    level,
    message: normalizedMessage,
  })}\n`;
  let record = buildRecord();

  while (byteLength(record) > limit && normalizedMessage.length > truncationSuffix.length) {
    const ratio = Math.max(0.1, Math.min(0.9, (limit / byteLength(record)) * 0.85));
    normalizedMessage = `${normalizedMessage.slice(0, Math.floor(normalizedMessage.length * ratio))}${truncationSuffix}`;
    record = buildRecord();
  }

  if (byteLength(record) <= limit) return record;
  return `${JSON.stringify({
    timestamp,
    level,
    message: '[log record exceeded structured logging limit]',
  })}\n`;
}

function truncateUtf8(value, maxBytes) {
  if (byteLength(value) <= maxBytes) return value;
  const suffix = '\n';
  const available = Math.max(0, maxBytes - byteLength(suffix));
  const truncated = Buffer.from(value, 'utf8')
    .subarray(0, available)
    .toString('utf8')
    .replace(/\uFFFD$/u, '');
  return `${truncated}${suffix}`;
}

export class BatchedLogWriter {
  constructor(options = {}) {
    if (typeof options.writeBatch !== 'function') {
      throw new TypeError('BatchedLogWriter requires a writeBatch function');
    }

    this.writeBatch = options.writeBatch;
    this.onError = typeof options.onError === 'function' ? options.onError : () => {};
    this.formatDropNotice = typeof options.formatDropNotice === 'function'
      ? options.formatDropNotice
      : (count) => `[Logging] Dropped ${count} buffered log entr${count === 1 ? 'y' : 'ies'} during overload\n`;
    this.maxQueuedBytes = Math.max(1024, Number(options.maxQueuedBytes) || DEFAULT_MAX_QUEUED_BYTES);
    this.maxBatchBytes = Math.max(1024, Number(options.maxBatchBytes) || DEFAULT_MAX_BATCH_BYTES);
    this.maxEntryBytes = Math.min(
      this.maxQueuedBytes,
      Math.max(256, Number(options.maxEntryBytes) || DEFAULT_MAX_ENTRY_BYTES)
    );
    this.maxQueuedEntries = Math.max(10, Number(options.maxQueuedEntries) || DEFAULT_MAX_QUEUED_ENTRIES);
    this.flushIntervalMs = Math.max(0, Number(options.flushIntervalMs) || DEFAULT_FLUSH_INTERVAL_MS);
    this.queue = [];
    this.queuedBytes = 0;
    this.droppedEntries = 0;
    this.totalDroppedEntries = 0;
    this.timer = null;
    this.activeFlush = null;
    this.failed = false;
  }

  enqueue(value, { critical = false } = {}) {
    if (this.failed) return false;
    const text = truncateUtf8(String(value || ''), this.maxEntryBytes);
    const bytes = byteLength(text);
    if (bytes === 0) return true;

    const canFit = () => (
      this.queuedBytes + bytes <= this.maxQueuedBytes
      && this.queue.length < this.maxQueuedEntries
    );

    if (!canFit() && critical) {
      for (let index = 0; index < this.queue.length && !canFit();) {
        if (this.queue[index].critical) {
          index += 1;
          continue;
        }
        const [removed] = this.queue.splice(index, 1);
        this.queuedBytes -= removed.bytes;
        this._recordDrop();
      }
    }

    while (critical && this.queue.length > 0 && !canFit()) {
      const removed = this.queue.shift();
      this.queuedBytes -= removed.bytes;
      this._recordDrop();
    }

    if (!canFit()) {
      this._recordDrop();
      this._scheduleFlush();
      return false;
    }

    this.queue.push({ text, bytes, critical: Boolean(critical) });
    this.queuedBytes += bytes;
    this._scheduleFlush();
    return true;
  }

  _recordDrop() {
    this.droppedEntries += 1;
    this.totalDroppedEntries += 1;
  }

  _scheduleFlush(delay = this.flushIntervalMs) {
    if (this.failed || this.timer || this.activeFlush || (!this.queue.length && !this.droppedEntries)) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, delay);
    this.timer.unref?.();
  }

  _clearTimer() {
    if (!this.timer) return;
    clearTimeout(this.timer);
    this.timer = null;
  }

  _takeBatch() {
    const parts = [];
    let batchBytes = 0;

    if (this.droppedEntries > 0) {
      const dropped = this.droppedEntries;
      this.droppedEntries = 0;
      const notice = truncateUtf8(this.formatDropNotice(dropped), this.maxBatchBytes);
      parts.push(notice);
      batchBytes += byteLength(notice);
    }

    while (this.queue.length > 0) {
      const entry = this.queue[0];
      if (parts.length > 0 && batchBytes + entry.bytes > this.maxBatchBytes) break;
      this.queue.shift();
      this.queuedBytes -= entry.bytes;
      parts.push(entry.text);
      batchBytes += entry.bytes;
      if (batchBytes >= this.maxBatchBytes) break;
    }

    return parts.join('');
  }

  async flush() {
    if (this.failed) return false;
    if (this.activeFlush) return this.activeFlush;
    this._clearTimer();
    const batch = this._takeBatch();
    if (!batch) return true;

    this.activeFlush = Promise.resolve()
      .then(() => this.writeBatch(batch))
      .then(() => true)
      .catch((error) => {
        this.failed = true;
        this.queue = [];
        this.queuedBytes = 0;
        this.droppedEntries = 0;
        this.onError(error);
        return false;
      })
      .finally(() => {
        this.activeFlush = null;
        this._scheduleFlush(0);
      });

    return this.activeFlush;
  }

  async flushAll() {
    this._clearTimer();
    while (!this.failed && (this.activeFlush || this.queue.length > 0 || this.droppedEntries > 0)) {
      if (this.activeFlush) {
        await this.activeFlush;
      } else {
        await this.flush();
      }
      this._clearTimer();
    }
    return !this.failed;
  }

  getStats() {
    return {
      queuedBytes: this.queuedBytes,
      queuedEntries: this.queue.length,
      droppedEntries: this.droppedEntries,
      totalDroppedEntries: this.totalDroppedEntries,
      flushing: Boolean(this.activeFlush),
      failed: this.failed,
    };
  }
}

export const BATCHED_LOG_DEFAULTS = Object.freeze({
  maxQueuedBytes: DEFAULT_MAX_QUEUED_BYTES,
  maxBatchBytes: DEFAULT_MAX_BATCH_BYTES,
  maxEntryBytes: DEFAULT_MAX_ENTRY_BYTES,
  maxQueuedEntries: DEFAULT_MAX_QUEUED_ENTRIES,
  flushIntervalMs: DEFAULT_FLUSH_INTERVAL_MS,
});
