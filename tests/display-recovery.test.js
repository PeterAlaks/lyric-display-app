import assert from 'node:assert/strict';
import test from 'node:test';
import { handleDisplayChange } from '../main/displayDetection.js';

test('display removal alerts the operator with the affected output assignment', async () => {
  const requests = [];
  await handleDisplayChange('removed', {
    id: 42,
    label: 'Sanctuary Projector',
    removedAssignment: { outputKey: 'output2' },
  }, async (config) => {
    requests.push(config);
    return { data: 'dismiss' };
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].title, 'Display disconnected');
  assert.match(requests[0].description, /Sanctuary Projector/);
  assert.match(requests[0].description, /Output 2/);
  assert.equal(requests[0].dedupeKey, 'display-removed:42');
});
