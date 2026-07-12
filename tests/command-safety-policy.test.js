import assert from 'node:assert/strict';
import test from 'node:test';
import {
  dispatchCommand,
  evaluateCommandSafety,
  isCommandFocusProtected,
} from '../shared/commandSafetyPolicy.js';

function element(tagName, attributes = {}, parentElement = null) {
  return {
    tagName,
    parentElement,
    isContentEditable: attributes.isContentEditable === true,
    getAttribute(name) {
      return attributes[name] ?? null;
    },
  };
}

test('Live Safety policy permits cueing from every source', () => {
  for (const source of ['desktop', 'keyboard', 'menu', 'midi', 'osc', 'web', 'mobile', 'unknown']) {
    for (const action of ['select-line', 'next-line', 'prev-line', 'clear-output', 'scroll-lines', 'lineUpdate']) {
      assert.equal(evaluateCommandSafety({ action, source, liveSafetyEnabled: true }).allowed, true, `${source}:${action}`);
    }
  }
});

test('Live Safety blocks production mutations from network and secondary controllers', () => {
  for (const source of ['osc', 'web', 'mobile', 'unknown']) {
    for (const action of ['toggle-output', 'toggle-autoplay', 'setlistLoad', 'styleUpdate', 'lyricsDraftApprove']) {
      const result = evaluateCommandSafety({ action, source, liveSafetyEnabled: true });
      assert.equal(result.allowed, false, `${source}:${action}`);
      assert.equal(result.reason, 'live-safety');
    }
  }
});

test('primary desktop controls remain fast and Live Safety has no effect when disabled', () => {
  for (const source of ['desktop', 'keyboard', 'menu', 'midi', 'internal']) {
    assert.equal(evaluateCommandSafety({ action: 'toggle-output', source, liveSafetyEnabled: true }).allowed, true, source);
  }
  assert.equal(evaluateCommandSafety({
    action: 'setlistReplace',
    source: 'mobile',
    liveSafetyEnabled: false,
  }).allowed, true);
});

test('global shortcut focus policy covers native, ARIA, nested, and modal controls', () => {
  const body = element('DIV');
  const input = element('INPUT', {}, body);
  const select = element('SELECT', {}, body);
  const button = element('BUTTON', {}, body);
  const editable = element('DIV', { contenteditable: 'true' }, body);
  const textbox = element('DIV', { role: 'textbox' }, body);
  const nestedInEditable = element('SPAN', {}, editable);
  const modal = element('DIV', { 'data-modal-root': 'true' }, body);
  const modalText = element('P', {}, modal);

  assert.equal(isCommandFocusProtected(body), false);
  for (const target of [input, select, button, editable, textbox, nestedInEditable, modalText]) {
    assert.equal(isCommandFocusProtected(target), true, target.tagName);
  }
});

test('the shared dispatcher executes allowed commands once and reports blocked commands', () => {
  let executions = 0;
  let blockedReason = null;
  const blocked = dispatchCommand({
    action: 'toggle-output',
    source: 'osc',
    liveSafetyEnabled: true,
    execute: () => { executions += 1; },
    onBlocked: (decision) => { blockedReason = decision.reason; },
  });
  assert.equal(blocked.executed, false);
  assert.equal(blockedReason, 'live-safety');
  assert.equal(executions, 0);

  const allowed = dispatchCommand({
    action: 'toggle-output',
    source: 'midi',
    liveSafetyEnabled: true,
    execute: () => { executions += 1; return 'done'; },
  });
  assert.equal(allowed.executed, true);
  assert.equal(allowed.value, 'done');
  assert.equal(executions, 1);
});

test('the dispatcher refuses keyboard commands while an interactive control has focus', () => {
  const result = dispatchCommand({
    action: 'toggle-output',
    source: 'keyboard',
    enforceFocus: true,
    focusTarget: element('BUTTON'),
    execute: () => assert.fail('protected-focus command executed'),
  });
  assert.equal(result.executed, false);
  assert.equal(result.reason, 'protected-focus');
});
