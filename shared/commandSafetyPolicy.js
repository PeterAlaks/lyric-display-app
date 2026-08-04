const CUE_ACTIONS = new Set([
  'lineUpdate',
  'select-line',
  'next-line',
  'prev-line',
  'clear-output',
  'scroll-lines',
]);

const PRIMARY_OPERATOR_SOURCES = new Set([
  'desktop',
  'keyboard',
  'menu',
  'midi',
  'internal',
]);

const PROTECTED_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'BUTTON', 'A']);
const PROTECTED_ROLES = new Set([
  'textbox',
  'searchbox',
  'combobox',
  'button',
  'checkbox',
  'link',
  'menuitem',
  'option',
  'slider',
  'spinbutton',
  'switch',
]);

const TEXT_EDITING_ROLES = new Set([
  'textbox',
  'searchbox',
  'combobox',
  'spinbutton',
]);

const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

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

function isProtectedNode(node) {
  if (!node || typeof node !== 'object') return false;
  const tagName = typeof node.tagName === 'string' ? node.tagName.toUpperCase() : '';
  if (PROTECTED_TAGS.has(tagName) || node.isContentEditable === true) return true;
  if (typeof node.getAttribute !== 'function') return false;
  const role = String(node.getAttribute('role') || '').toLowerCase();
  const contentEditable = String(node.getAttribute('contenteditable') || '').toLowerCase();
  return node.getAttribute('data-modal-root') === 'true'
    || PROTECTED_ROLES.has(role)
    || (contentEditable !== '' && contentEditable !== 'false');
}

function isTextEditingNode(node) {
  if (!node || typeof node !== 'object') return false;
  const tagName = typeof node.tagName === 'string' ? node.tagName.toUpperCase() : '';
  if (tagName === 'TEXTAREA' || node.isContentEditable === true) return true;
  if (typeof node.getAttribute !== 'function') return tagName === 'INPUT';

  const contentEditable = String(node.getAttribute('contenteditable') || '').toLowerCase();
  if (contentEditable !== '' && contentEditable !== 'false') return true;

  if (tagName === 'INPUT') {
    const inputType = String(node.getAttribute('type') || 'text').toLowerCase();
    return !NON_TEXT_INPUT_TYPES.has(inputType);
  }

  const role = String(node.getAttribute('role') || '').toLowerCase();
  return TEXT_EDITING_ROLES.has(role);
}

function isModalNode(node) {
  return Boolean(
    node
      && typeof node.getAttribute === 'function'
      && node.getAttribute('data-modal-root') === 'true'
  );
}

function hasMatchingNode(candidates, predicate) {
  for (const candidate of candidates) {
    let node = candidate;
    for (let depth = 0; node && depth < 32; depth += 1) {
      if (predicate(node)) return true;
      node = node.parentElement || node.parentNode || null;
    }
  }
  return false;
}

export function isCommandFocusProtected(...candidates) {
  return hasMatchingNode(candidates, isProtectedNode);
}

export function isTextEditingFocusProtected(...candidates) {
  return hasMatchingNode(candidates, isTextEditingNode);
}

export function isModalFocusProtected(...candidates) {
  return hasMatchingNode(candidates, isModalNode);
}

export function evaluateCommandSafety({
  action,
  source,
  liveSafetyEnabled = false,
  focusTarget = null,
  fallbackFocusTarget = null,
  enforceFocus = false,
} = {}) {
  if (typeof action !== 'string' || !action) {
    return { allowed: false, reason: 'invalid-action' };
  }

  if (enforceFocus && isCommandFocusProtected(focusTarget, fallbackFocusTarget)) {
    return { allowed: false, reason: 'protected-focus' };
  }

  if (!liveSafetyEnabled || CUE_ACTIONS.has(action) || PRIMARY_OPERATOR_SOURCES.has(source)) {
    return { allowed: true, reason: null };
  }

  return { allowed: false, reason: 'live-safety' };
}

export function dispatchCommand({ execute, onBlocked, ...policyInput } = {}) {
  const decision = evaluateCommandSafety(policyInput);
  if (!decision.allowed) {
    onBlocked?.(decision);
    return { ...decision, executed: false, value: undefined };
  }
  if (typeof execute !== 'function') {
    return { allowed: false, reason: 'missing-executor', executed: false, value: undefined };
  }
  return { ...decision, executed: true, value: execute() };
}
