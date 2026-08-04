import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONTROL_COMMAND_INTENTS,
  shouldNotifyRejectedControlCommand,
} from '../shared/controlCommandFeedback.js';

test('control command rejections stay silent until the first authenticated state sync', () => {
  assert.equal(shouldNotifyRejectedControlCommand({
    hasCompletedInitialSync: false,
    intent: CONTROL_COMMAND_INTENTS.operator,
  }), false);

  assert.equal(shouldNotifyRejectedControlCommand({
    hasCompletedInitialSync: true,
    intent: CONTROL_COMMAND_INTENTS.operator,
  }), true);
});

test('background control emissions never create operator-facing rejection feedback', () => {
  assert.equal(shouldNotifyRejectedControlCommand({
    hasCompletedInitialSync: true,
    intent: CONTROL_COMMAND_INTENTS.background,
  }), false);
});
