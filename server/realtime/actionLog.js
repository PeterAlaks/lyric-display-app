const DEFAULT_LIMIT = 750;
const MAX_TEXT_LENGTH = 240;

const entries = [];
let nextId = 1;

function sanitizeText(value, fallback = '') {
  const text = typeof value === 'string' ? value : String(value ?? fallback);
  return text.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_LENGTH);
}

function sanitizeMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const safe = {};
  Object.entries(value).forEach(([key, raw]) => {
    if (raw == null) return;
    if (typeof raw === 'string') safe[key] = sanitizeText(raw);
    else if (typeof raw === 'number' || typeof raw === 'boolean') safe[key] = raw;
    else if (Array.isArray(raw)) safe[key] = raw.slice(0, 12).map((item) => sanitizeText(item));
  });
  return Object.keys(safe).length > 0 ? safe : null;
}

export function createActor({ clientType, deviceId, sessionId } = {}) {
  return {
    clientType: clientType || 'unknown',
    deviceId: deviceId || null,
    sessionId: sessionId || null,
  };
}

export function appendActionLog(io, entry = {}) {
  const type = sanitizeText(entry.type, 'unknown') || 'unknown';
  const nextEntry = {
    id: `action_${Date.now()}_${nextId++}`,
    type,
    label: sanitizeText(entry.label, type),
    detail: sanitizeText(entry.detail, ''),
    actor: createActor(entry.actor),
    target: entry.target ? sanitizeText(entry.target) : null,
    metadata: sanitizeMetadata(entry.metadata),
    createdAt: Date.now(),
  };

  entries.push(nextEntry);
  while (entries.length > DEFAULT_LIMIT) {
    entries.shift();
  }

  io?.emit?.('actionLogUpdate', nextEntry);
  return nextEntry;
}

export function getActionLogSnapshot({ limit = DEFAULT_LIMIT } = {}) {
  const resolvedLimit = Number.isFinite(limit)
    ? Math.max(1, Math.min(DEFAULT_LIMIT, Math.floor(limit)))
    : DEFAULT_LIMIT;
  return entries.slice(-resolvedLimit);
}

export function clearActionLog(io, actor = {}) {
  entries.length = 0;
  appendActionLog(io, {
    type: 'system',
    label: 'Action log cleared',
    detail: 'Operator action log was cleared',
    actor,
  });
}

export function resetActionLogForTests() {
  entries.length = 0;
  nextId = 1;
}
