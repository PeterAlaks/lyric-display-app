export const CONTROL_COMMAND_INTENTS = Object.freeze({
  operator: 'operator',
  background: 'background',
});

export function shouldNotifyRejectedControlCommand({
  hasCompletedInitialSync = false,
  intent = CONTROL_COMMAND_INTENTS.operator,
} = {}) {
  return Boolean(hasCompletedInitialSync) && intent === CONTROL_COMMAND_INTENTS.operator;
}
