export class TTLCache {
  constructor({ max = 50, ttlMs = 300_000 } = {}) {
    this.max = max;
    this.ttlMs = ttlMs;
    this.store = new Map();
  }

  _now() {
    return Date.now();
  }

  _prune() {
    if (this.store.size <= this.max) return;
    const entries = Array.from(this.store.entries()).sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    const excess = this.store.size - this.max;
    for (let i = 0; i < excess; i += 1) {
      const [key] = entries[i];
      this.store.delete(key);
    }
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt < this._now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key, value, ttlOverride) {
    const ttl = typeof ttlOverride === 'number' ? ttlOverride : this.ttlMs;
    this.store.set(key, { value, expiresAt: this._now() + ttl });
    this._prune();
  }

  delete(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}
