import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
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
  assert.equal(requests[0].presentation, 'toast');
  assert.match(requests[0].message, /Sanctuary Projector/);
  assert.match(requests[0].message, /Output 2/);
  assert.equal(requests[0].dedupeKey, 'display-removed:42');
  assert.equal(requests[0].duration, 0);
  assert.equal(requests[0].actions.length, 1);
  assert.equal(requests[0].actions[0].label, 'Review Output Routing');
  assert.equal(requests[0].actions[0].modal.component, 'ProjectOutput');
  assert.equal(requests[0].actions[0].modal.triggerSource, 'manual');
});

test('display recovery toast acknowledges delivery and opens routing only on action', async () => {
  const source = await readFile(new URL('../src/components/bridges/ElectronModalBridge.jsx', import.meta.url), 'utf8');
  const toasts = [];
  const modals = [];
  const resolved = [];
  let onRequest;
  let cleanup;
  let unsubscribed = false;
  const api = {
    onModalRequest: (handler) => {
      onRequest = handler;
      return () => { unsubscribed = true; };
    },
    resolveModalRequest: async (...args) => { resolved.push(args); },
    rejectModalRequest: async (_id, error) => { assert.fail(error.message); },
  };
  vm.runInNewContext(
    source.replace(/^import .*;\r?\n/gm, '').replace('export default ', '') + '\nElectronModalBridge();',
    {
      useEffect: (effect) => { cleanup = effect(); },
      useModal: () => ({ showModal: async (config) => { modals.push(config); } }),
      useToast: () => ({ showToast: (config) => { toasts.push(config); } }),
      window: { electronAPI: api },
      console,
    },
  );

  await handleDisplayChange('removed', { id: 42 }, (config) => onRequest({ ...config, id: 'recovery' }));
  assert.equal(toasts.length, 1);
  assert.equal(modals.length, 0);
  assert.equal(resolved[0][0], 'recovery');
  assert.equal(resolved[0][1].presented, true);
  assert.match(toasts[0].message, /Display 42/);
  assert.equal(toasts[0].duration, 0);

  toasts[0].actions[0].onClick();
  assert.equal(modals.length, 1);
  assert.equal(modals[0].component, 'ProjectOutput');
  assert.equal(modals[0].triggerSource, 'manual');

  await onRequest({ id: 'regular', title: 'Ordinary modal', component: 'ProjectOutput' });
  assert.equal(modals.length, 2);
  assert.equal(modals[1].title, 'Ordinary modal');
  assert.equal(toasts.length, 1);
  cleanup();
  assert.equal(unsubscribed, true);
});
