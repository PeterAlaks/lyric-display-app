import { randomUUID } from 'crypto';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function correlateExternalAction(action, options = {}) {
  const source = action && typeof action === 'object' ? action : {};
  const now = typeof options.now === 'function' ? options.now() : Date.now();
  const createId = typeof options.createId === 'function' ? options.createId : randomUUID;
  const suppliedCommandId = typeof source.commandId === 'string' ? source.commandId.trim() : '';

  return {
    ...source,
    commandId: UUID_PATTERN.test(suppliedCommandId) ? suppliedCommandId.toLowerCase() : createId(),
    sentAt: Number.isFinite(source.sentAt) && source.sentAt > 0 ? source.sentAt : now,
  };
}
