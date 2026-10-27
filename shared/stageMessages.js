export const MAX_STAGE_MESSAGES = 50;
export const MAX_STAGE_MESSAGE_LENGTH = 220;

export const createStageMessageId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `msg_${crypto.randomUUID()}`;
  }
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

export const normalizeStageMessageText = (value, maxLength = MAX_STAGE_MESSAGE_LENGTH) => {
  if (typeof value !== 'string') return '';
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';
  return trimmed.slice(0, maxLength);
};

export const normalizeStageMessages = (
  value,
  { maxCount = MAX_STAGE_MESSAGES, maxLength = MAX_STAGE_MESSAGE_LENGTH } = {}
) => {
  if (!Array.isArray(value) || value.length === 0) return [];

  const normalized = [];
  const seenIds = new Set();

  for (let i = 0; i < value.length; i += 1) {
    const item = value[i];
    const rawText = typeof item === 'string' ? item : item?.text;
    const text = normalizeStageMessageText(rawText, maxLength);
    if (!text) continue;

    const existingId = typeof item?.id === 'string' ? item.id.trim() : '';
    let id = existingId || createStageMessageId();
    while (seenIds.has(id)) {
      id = createStageMessageId();
    }
    seenIds.add(id);
    normalized.push({ id, text });

    if (normalized.length >= maxCount) break;
  }

  return normalized;
};
