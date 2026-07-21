export const LDSCH_FORMAT = 'lyricdisplay-schedule';
export const LDSCH_VERSION = 1;
export const MAX_SCHEDULE_ITEMS = 100;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const MAX_ITEM_DURATION_MS = 24 * HOUR_MS;
const MAX_SCHEDULE_TEXT_LENGTH = 500_000;

const isPlainObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));

const clamp = (value, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(max, Math.max(min, numeric)) : fallback;
};

const boundedText = (value, fallback = '', maxLength = 240) => String(value ?? fallback)
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, maxLength);

const makeItemId = (value, index) => {
  const supplied = boundedText(value, '', 96);
  if (supplied) return supplied;
  return `schedule-item-${index + 1}`;
};

export const isTimedScheduleItem = (item) => (
  item?.timed !== false && Number.isFinite(Number(item?.durationMs)) && Number(item.durationMs) > 0
);

export function normalizeScheduleItem(raw, index = 0) {
  const item = isPlainObject(raw) ? raw : {};
  const rawDuration = item.durationMs ?? (
    Number.isFinite(Number(item.durationMinutes)) ? Number(item.durationMinutes) * MINUTE_MS : null
  );
  const timed = item.timed !== false && Number.isFinite(Number(rawDuration)) && Number(rawDuration) > 0;

  return {
    id: makeItemId(item.id, index),
    label: boundedText(item.label ?? item.title, `Schedule item ${index + 1}`, 160),
    durationMs: timed ? clamp(rawDuration, 5 * MINUTE_MS, 1_000, MAX_ITEM_DURATION_MS) : null,
    timed,
    notes: boundedText(item.notes, '', 500),
    plannedStartTime: normalizeTimeOfDay(item.plannedStartTime ?? item.startTime),
  };
}

export function normalizeScheduleItems(rawItems = []) {
  if (!Array.isArray(rawItems)) return [];

  const seenIds = new Set();
  return rawItems
    .slice(0, MAX_SCHEDULE_ITEMS)
    .map((item, index) => normalizeScheduleItem(item, index))
    .filter((item) => item.label)
    .map((item, index) => {
      const baseId = item.id || `schedule-item-${index + 1}`;
      let uniqueId = baseId;
      let suffix = 2;
      while (seenIds.has(uniqueId)) {
        const suffixText = `-${suffix}`;
        uniqueId = `${baseId.slice(0, Math.max(1, 96 - suffixText.length))}${suffixText}`;
        suffix += 1;
      }
      seenIds.add(uniqueId);
      return uniqueId === item.id ? item : { ...item, id: uniqueId };
    });
}

export function normalizeTimeOfDay(value) {
  if (typeof value !== 'string') return '';
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return '';
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return '';
  }
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function normalizeScheduleDocument(raw = {}) {
  const document = isPlainObject(raw) ? raw : {};
  const rawItems = Array.isArray(document.items)
    ? document.items
    : (Array.isArray(document.sets) ? document.sets : []);
  const eventStartTime = normalizeTimeOfDay(document.eventStartTime ?? document.scheduleStartTime)
    || normalizeTimeOfDay(rawItems[0]?.plannedStartTime ?? rawItems[0]?.startTime);
  const items = normalizeScheduleItems(rawItems);
  const indicator = isPlainObject(document.indicator) ? document.indicator : {};

  return {
    format: LDSCH_FORMAT,
    version: LDSCH_VERSION,
    title: boundedText(document.title, 'Service Schedule', 160) || 'Service Schedule',
    eventStartTime,
    idealEndTime: normalizeTimeOfDay(document.idealEndTime),
    autoStartNext: document.autoStartNext !== false,
    notificationsEnabled: document.notificationsEnabled !== false,
    indicator: {
      enabled: indicator.enabled !== false,
      durationSeconds: clamp(indicator.durationSeconds, 10, 0, 86_400),
      label: boundedText(indicator.label, 'Next item starts in', 160) || 'Next item starts in',
    },
    items,
    createdAt: typeof document.createdAt === 'string' ? document.createdAt : null,
    updatedAt: typeof document.updatedAt === 'string' ? document.updatedAt : null,
  };
}

export function parseScheduleDocument(raw) {
  let value = raw;
  if (typeof raw === 'string') {
    if (raw.length > MAX_SCHEDULE_TEXT_LENGTH) throw new Error('Schedule file is too large');
    try {
      value = JSON.parse(raw.replace(/^\uFEFF/, ''));
    } catch {
      throw new Error('This is not a valid LyricDisplay schedule file');
    }
  }
  if (!isPlainObject(value)) throw new Error('Schedule file must contain an object');
  if (value.format && value.format !== LDSCH_FORMAT) throw new Error('This file is not a LyricDisplay schedule');
  if (value.version !== null && value.version !== undefined) {
    const sourceVersion = Number(value.version);
    if (!Number.isInteger(sourceVersion) || sourceVersion < 0) {
      throw new Error('Schedule file has an invalid format version');
    }
    if (sourceVersion > LDSCH_VERSION) {
      throw new Error(`Schedule version ${sourceVersion} requires a newer LyricDisplay version`);
    }
  }
  const schedule = normalizeScheduleDocument(value);
  if (schedule.items.length === 0) throw new Error('Schedule file does not contain any items');
  return schedule;
}

export function serializeScheduleDocument(raw) {
  const schedule = normalizeScheduleDocument({
    ...raw,
    createdAt: raw?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return `${JSON.stringify(schedule, null, 2)}\n`;
}

const DURATION_TOKEN = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|hr|h|minutes?|mins?|min|m|seconds?|secs?|sec|s)\b/gi;
const CLOCK_TOKEN_SOURCE = '(\\d{1,2}:\\d{2}(?:\\s*(?:a\\.?m\\.?|p\\.?m\\.?))?|\\d{1,2}\\s*(?:a\\.?m\\.?|p\\.?m\\.?))';
const TIME_RANGE = new RegExp(`${CLOCK_TOKEN_SOURCE}\\s*(?:-|–|—|to)\\s*${CLOCK_TOKEN_SOURCE}`, 'i');
const LEADING_CLOCK = new RegExp(`^\\s*${CLOCK_TOKEN_SOURCE}(?=\\s|[|:–—-])`, 'i');

const durationUnitToMs = (amount, unit) => {
  const normalizedUnit = unit.toLowerCase();
  if (normalizedUnit.startsWith('h')) return amount * HOUR_MS;
  if (normalizedUnit.startsWith('s')) return amount * 1_000;
  return amount * MINUTE_MS;
};

function extractDuration(text) {
  let totalMs = 0;
  let count = 0;
  const tokens = [];
  DURATION_TOKEN.lastIndex = 0;
  for (const match of String(text || '').matchAll(DURATION_TOKEN)) {
    const amount = Number(match[1]);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    totalMs += durationUnitToMs(amount, match[2]);
    count += 1;
    tokens.push(match[0]);
  }

  if (count === 0) {
    const labelledClockDuration = String(text || '').match(/(?:duration|for)\s*[:=-]?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\b/i);
    if (labelledClockDuration) {
      const first = Number(labelledClockDuration[1]);
      const second = Number(labelledClockDuration[2]);
      const third = Number(labelledClockDuration[3] || 0);
      totalMs = labelledClockDuration[3]
        ? ((first * 3600) + (second * 60) + third) * 1_000
        : ((first * 60) + second) * 1_000;
      tokens.push(labelledClockDuration[0]);
    }
  }

  return {
    durationMs: totalMs > 0 ? Math.min(MAX_ITEM_DURATION_MS, Math.round(totalMs)) : null,
    tokens,
  };
}

function parseClockMinutes(value) {
  const match = String(value || '').trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || minutes > 59) return null;
  const period = match[3]?.replace(/\./g, '');
  if (!match[2] && !period) return null;
  if (period) {
    if (hours < 1 || hours > 12) return null;
    hours = hours % 12;
    if (period === 'pm') hours += 12;
  } else if (hours > 23) {
    return null;
  }
  return (hours * 60) + minutes;
}

const minutesToTimeOfDay = (minutes) => {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
};

function extractTimeRange(text) {
  const match = String(text || '').match(TIME_RANGE);
  if (!match) return null;
  const startMinutes = parseClockMinutes(match[1]);
  const endMinutes = parseClockMinutes(match[2]);
  if (startMinutes === null || endMinutes === null) return null;
  let durationMinutes = endMinutes - startMinutes;
  if (durationMinutes <= 0) durationMinutes += 1440;
  if (durationMinutes > 12 * 60) return null;
  return {
    token: match[0],
    startMinutes,
    endMinutes,
    durationMs: durationMinutes * MINUTE_MS,
  };
}

function extractLeadingClock(text) {
  const match = String(text || '').match(LEADING_CLOCK);
  if (!match) return null;
  const minutes = parseClockMinutes(match[1]);
  return minutes === null ? null : { token: match[0], minutes };
}

const stripMarkdown = (line) => line
  .replace(/^\s{0,3}#{1,6}\s+/, '')
  .replace(/^\s*>\s?/, '')
  .replace(/\*\*([^*]+)\*\*/g, '$1')
  .replace(/__([^_]+)__/g, '$1')
  .replace(/`([^`]+)`/g, '$1')
  .trim();

const stripListMarker = (line) => {
  const numbered = line.match(/^\s*(?:\(\d{1,3}\)|\d{1,3}[.)]|[A-Za-z][.)])\s+/);
  if (numbered) return { text: line.slice(numbered[0].length), structured: true };
  const bullet = line.match(/^\s*[-*+•]\s+/);
  if (bullet) return { text: line.slice(bullet[0].length), structured: true };
  return { text: line, structured: false };
};

const normalizeTableRow = (line) => String(line || '')
  .replace(/^\s*\|\s*/, '')
  .replace(/\s*\|\s*$/, '')
  .replace(/\s*\|\s*/g, ' | ')
  .trim();

const looksLikeTableSeparator = (line) => /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
const looksLikeColumnHeader = (line) => {
  const normalized = line.toLowerCase().replace(/[|:_-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return true;
  const words = normalized.split(' ');
  const headerWords = new Set(['no', 'number', 'time', 'start', 'end', 'duration', 'item', 'activity', 'event', 'program', 'programme', 'person', 'minister', 'leader', 'notes']);
  return words.length <= 8 && words.every((word) => headerWords.has(word));
};

const looksLikeMetadata = (line) => /^(?:date|venue|location|theme|host|prepared by|service date)\s*:/i.test(line.trim());
const looksLikeScheduleTitle = (line) => /\b(?:schedule|run of show|order of service|programme|program|agenda|timeline|itinerary)\b/i.test(line);

function cleanItemLabel(text, { range, leadingClock, durationTokens }) {
  let label = String(text || '');
  if (range?.token) label = label.replace(range.token, ' ');
  if (leadingClock?.token) label = label.replace(leadingClock.token, ' ');
  durationTokens.forEach((token) => { label = label.replace(token, ' '); });
  label = label
    .replace(/\b(?:duration|time)\s*[:=-]?\s*(?=$|[|])/gi, ' ')
    .replace(/^\s*\|+|\|+\s*$/g, '')
    .replace(/\s*\|\s*/g, ' · ')
    .replace(/^[\s:;,./–—-]+|[\s:;,./|–—-]+$/g, '')
    .replace(/\s+([:;,.)])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return boundedText(label, '', 160);
}

export function parseScheduleText(rawText, options = {}) {
  const sourceText = String(rawText || '').replace(/^\uFEFF/, '');
  if (sourceText.length > MAX_SCHEDULE_TEXT_LENGTH) throw new Error('Schedule text is too large');
  const rawLines = sourceText.split(/\r?\n/);
  const lines = rawLines.map((raw, index) => ({
    index,
    raw,
    text: stripMarkdown(raw).trim(),
  }));
  const meaningful = lines.filter((line) => line.text && !looksLikeTableSeparator(line.text));
  const structureSignals = meaningful.filter((line) => {
    const marker = stripListMarker(normalizeTableRow(line.text));
    return marker.structured || Boolean(extractTimeRange(marker.text)) || Boolean(extractLeadingClock(marker.text)) || Boolean(extractDuration(marker.text).durationMs);
  }).length;
  const documentLooksStructured = structureSignals >= 2;
  let title = '';
  let sawTitle = false;
  const candidates = [];
  const ignoredLines = [];

  for (const line of meaningful) {
    if (looksLikeTableSeparator(line.text) || looksLikeColumnHeader(line.text) || looksLikeMetadata(line.text)) {
      ignoredLines.push(line.raw);
      continue;
    }
    const marker = stripListMarker(normalizeTableRow(line.text));
    const range = extractTimeRange(marker.text);
    const leadingClock = range ? null : extractLeadingClock(marker.text);
    const duration = extractDuration(marker.text);
    const isTitle = looksLikeScheduleTitle(marker.text) && !marker.structured && !range && !leadingClock && !duration.durationMs;
    if (isTitle && candidates.length === 0) {
      title = boundedText(marker.text.replace(/[.:]+$/, ''), 'Service Schedule', 160);
      sawTitle = true;
      continue;
    }

    const temporal = Boolean(range || leadingClock || duration.durationMs);
    const candidate = marker.structured || temporal || sawTitle || (documentLooksStructured && candidates.length > 0);
    if (!candidate) {
      ignoredLines.push(line.raw);
      continue;
    }

    const label = cleanItemLabel(marker.text, {
      range,
      leadingClock,
      durationTokens: duration.tokens,
    });
    if (!label) {
      ignoredLines.push(line.raw);
      continue;
    }

    candidates.push({
      id: `schedule-item-${candidates.length + 1}`,
      label,
      durationMs: range?.durationMs || duration.durationMs,
      timed: Boolean(range?.durationMs || duration.durationMs),
      notes: '',
      plannedStartTime: range
        ? minutesToTimeOfDay(range.startMinutes)
        : (leadingClock ? minutesToTimeOfDay(leadingClock.minutes) : ''),
      clockStartMinutes: range?.startMinutes ?? leadingClock?.minutes ?? null,
      sourceLine: line.index + 1,
      structured: marker.structured || temporal,
      inferredDuration: false,
    });
  }

  for (let index = 0; index < candidates.length - 1; index += 1) {
    const item = candidates[index];
    const next = candidates[index + 1];
    if (item.durationMs || item.clockStartMinutes === null || next.clockStartMinutes === null) continue;
    let deltaMinutes = next.clockStartMinutes - item.clockStartMinutes;
    if (deltaMinutes <= 0) deltaMinutes += 1440;
    if (deltaMinutes <= 0 || deltaMinutes > 12 * 60) continue;
    item.durationMs = deltaMinutes * MINUTE_MS;
    item.timed = true;
    item.inferredDuration = true;
  }

  const items = normalizeScheduleItems(candidates);
  if (items.length === 0) {
    return {
      schedule: normalizeScheduleDocument({ title: title || options.title, items: [] }),
      confidence: 0,
      confidenceLabel: 'low',
      warnings: ['No schedule items could be identified. Try numbered lines, bullets, clock times, or durations such as “10 min”.'],
      ignoredLines: ignoredLines.filter(Boolean),
      stats: { itemCount: 0, timedCount: 0, manualCount: 0, inferredDurationCount: 0 },
    };
  }

  const timedCount = items.filter(isTimedScheduleItem).length;
  const manualCount = items.length - timedCount;
  const inferredDurationCount = candidates.filter((item) => item.inferredDuration).length;
  const structuredCount = candidates.filter((item) => item.structured).length;
  const itemConfidence = items.length >= 3 ? 0.25 : (items.length === 2 ? 0.15 : 0.05);
  const structureConfidence = Math.min(0.4, (structuredCount / items.length) * 0.4);
  const timingConfidence = Math.min(0.25, (timedCount / items.length) * 0.25);
  const titleConfidence = title ? 0.1 : 0;
  const confidence = Math.min(1, Math.round((itemConfidence + structureConfidence + timingConfidence + titleConfidence) * 100) / 100);
  const warnings = [];
  if (manualCount > 0) warnings.push(`${manualCount} ${manualCount === 1 ? 'item has' : 'items have'} no duration and will wait for manual advance.`);
  if (ignoredLines.filter(Boolean).length > 0) warnings.push(`${ignoredLines.filter(Boolean).length} ${ignoredLines.filter(Boolean).length === 1 ? 'line was' : 'lines were'} not recognized as schedule items.`);
  if (items.length === MAX_SCHEDULE_ITEMS && candidates.length > MAX_SCHEDULE_ITEMS) warnings.push(`Only the first ${MAX_SCHEDULE_ITEMS} items were imported.`);

  return {
    schedule: normalizeScheduleDocument({
      title: title || options.title || 'Imported Schedule',
      items,
    }),
    confidence,
    confidenceLabel: confidence >= 0.75 ? 'high' : (confidence >= 0.5 ? 'medium' : 'low'),
    warnings,
    ignoredLines: ignoredLines.filter(Boolean),
    stats: { itemCount: items.length, timedCount, manualCount, inferredDurationCount },
  };
}

export function resolveScheduleTime(value, referenceMs = Date.now()) {
  const normalized = normalizeTimeOfDay(value);
  if (!normalized) return null;
  const [hours, minutes] = normalized.split(':').map(Number);
  const candidate = new Date(referenceMs);
  candidate.setHours(hours, minutes, 0, 0);
  if (candidate.getTime() <= referenceMs) candidate.setDate(candidate.getDate() + 1);
  return candidate.getTime();
}

export function calculateScheduleItemStartTimes({
  items: rawItems = [],
  eventStartTime = '',
  transitionMs = 0,
} = {}) {
  const normalizedStart = normalizeTimeOfDay(eventStartTime);
  const items = normalizeScheduleItems(rawItems);
  const starts = Array(items.length).fill('');
  if (!normalizedStart) return starts;

  const [startHours, startMinutes] = normalizedStart.split(':').map(Number);
  const startMs = ((startHours * 60) + startMinutes) * MINUTE_MS;
  const safeTransitionMs = clamp(transitionMs, 0, 0, HOUR_MS);
  let elapsedMs = 0;
  let timelineKnown = true;

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (timelineKnown) {
      const minutesOfDay = Math.round((startMs + elapsedMs) / MINUTE_MS) % (24 * 60);
      starts[index] = `${String(Math.floor(minutesOfDay / 60)).padStart(2, '0')}:${String(minutesOfDay % 60).padStart(2, '0')}`;
    }

    if (!timelineKnown || !isTimedScheduleItem(item)) {
      timelineKnown = false;
      continue;
    }

    elapsedMs += Number(item.durationMs);
    if (index < items.length - 1) elapsedMs += safeTransitionMs;
  }

  return starts;
}

export function calculateScheduleProjection({
  items: rawItems = [],
  active = false,
  activeIndex = 0,
  now = Date.now(),
  currentRemainingMs = null,
  currentIsTransition = false,
  transitionMs = 0,
  idealEndAt = null,
  idealEndTime = '',
} = {}) {
  const items = normalizeScheduleItems(rawItems);
  const safeIndex = Math.trunc(clamp(activeIndex, 0, 0, Math.max(0, items.length - 1)));
  const startIndex = active
    ? Math.min(items.length, safeIndex + (currentIsTransition ? 1 : 0))
    : 0;
  let knownRemainingMs = active && currentIsTransition && Number.isFinite(Number(currentRemainingMs))
    ? Math.max(0, Number(currentRemainingMs))
    : 0;
  let manualItemCount = 0;

  for (let index = startIndex; index < items.length; index += 1) {
    const item = items[index];
    if (!isTimedScheduleItem(item)) {
      manualItemCount += 1;
      continue;
    }
    if (active && !currentIsTransition && index === safeIndex && Number.isFinite(Number(currentRemainingMs))) {
      knownRemainingMs += Math.max(0, Number(currentRemainingMs));
    } else {
      knownRemainingMs += Number(item.durationMs);
    }
  }

  const remainingItemCount = items.length > 0 ? items.length - startIndex : 0;
  const transitionCount = Math.max(0, remainingItemCount - 1);
  const transitionRemainingMs = transitionCount * clamp(transitionMs, 0, 0, HOUR_MS);
  const projectedEndAt = now + knownRemainingMs + transitionRemainingMs;
  const numericIdealEndAt = Number(idealEndAt);
  const hasExplicitIdealEndAt = idealEndAt !== null
    && idealEndAt !== undefined
    && idealEndAt !== ''
    && Number.isFinite(numericIdealEndAt)
    && numericIdealEndAt > 0;
  const normalizedIdealEndAt = hasExplicitIdealEndAt
    ? numericIdealEndAt
    : resolveScheduleTime(idealEndTime, now);
  const varianceMs = normalizedIdealEndAt === null ? null : projectedEndAt - normalizedIdealEndAt;

  return {
    itemCount: items.length,
    remainingItemCount,
    knownRemainingMs,
    transitionRemainingMs,
    manualItemCount,
    projectedEndAt,
    idealEndAt: normalizedIdealEndAt,
    varianceMs,
    isEstimate: manualItemCount > 0,
    status: varianceMs === null ? 'unconfigured' : (varianceMs > 0 ? 'behind' : 'on-track'),
  };
}
