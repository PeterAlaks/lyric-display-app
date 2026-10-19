import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { handleDisplayChange } from '../main/displayDetection.js';
import { isIPv4AddressAssigned, selectStableLocalIPAddress } from '../main/utils.js';

test('display removal alerts the operator with a short, self-dismissing toast', async () => {
  const requests = [];
  await handleDisplayChange('removed', {
    id: 42,
    label: 'Sanctuary Projector',
    removedAssignment: { outputKey: 'output2' },
  }, async (config) => {
    requests.push(config);
    return { data: 'dismiss' };
  }, { now: 1_000_000 });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].title, 'Display disconnected');
  assert.equal(requests[0].presentation, 'toast');
  assert.equal(requests[0].message, 'Sanctuary Projector (Output 2)');
  assert.equal(requests[0].dedupeKey, 'display-removed');
  assert.ok(requests[0].duration > 0, 'toast must expire on its own');
  assert.equal(requests[0].actions.length, 1);
  assert.equal(requests[0].actions[0].label, 'Review routing');
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

  await handleDisplayChange('removed', { id: 42 }, (config) => onRequest({ ...config, id: 'recovery' }), { now: 2_000_000 });
  assert.equal(toasts.length, 1);
  assert.equal(modals.length, 0);
  assert.equal(resolved[0][0], 'recovery');
  assert.equal(resolved[0][1].presented, true);
  assert.match(toasts[0].message, /Display 42/);
  assert.ok(toasts[0].duration > 0);

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

test('displays disconnected together share one toast instead of stacking', async () => {
  const requests = [];
  const request = async (config) => { requests.push(config); return {}; };
  const now = 3_000_000;

  await handleDisplayChange('removed', { id: 7, label: 'Projector', removedAssignment: { outputKey: 'output1' } }, request, { now });
  await handleDisplayChange('removed', { id: 8, label: 'Stage Monitor' }, request, { now: now + 500 });
  await handleDisplayChange('removed', { id: 9, label: 'Lobby TV' }, request, { now: now + 900 });

  assert.equal(new Set(requests.map((config) => config.dedupeKey)).size, 1);
  assert.equal(requests[2].title, '3 displays disconnected');
  assert.equal(requests[2].message, 'Projector (Output 1), Stage Monitor and 1 more');

  await handleDisplayChange('removed', { id: 10, label: 'Overflow Room' }, request, { now: now + 60_000 });
  assert.equal(requests[3].title, 'Display disconnected');
  assert.equal(requests[3].message, 'Overflow Room');
});

test('a second static address on the same adapter is not treated as a network address change', () => {
  const nets = {
    Ethernet: [
      { family: 'IPv4', internal: false, address: '192.168.0.50' },
      { family: 'IPv4', internal: false, address: '192.168.1.50' },
    ],
    Loopback: [{ family: 'IPv4', internal: true, address: '127.0.0.1' }],
  };

  // Windows can switch which address it uses for outbound traffic when an adapter has two
  // default gateways; the previously reported address is still assigned and reachable.
  assert.equal(selectStableLocalIPAddress({ activeIP: '192.168.0.50', preferredAddress: '192.168.1.50', nets }), '192.168.1.50');
  assert.equal(selectStableLocalIPAddress({ activeIP: '192.168.0.50', preferredAddress: '10.0.0.5', nets }), '192.168.0.50');
  assert.equal(selectStableLocalIPAddress({ activeIP: '192.168.0.50', preferredAddress: '', nets }), '192.168.0.50');
  assert.equal(selectStableLocalIPAddress({ activeIP: 'localhost', preferredAddress: '192.168.1.50', nets }), '192.168.1.50');
  assert.equal(selectStableLocalIPAddress({ activeIP: 'localhost', preferredAddress: '', nets }), 'localhost');

  assert.equal(isIPv4AddressAssigned('192.168.1.50', nets), true);
  assert.equal(isIPv4AddressAssigned('192.168.1.51', nets), false);
  assert.equal(isIPv4AddressAssigned('127.0.0.1', nets), false);
});
