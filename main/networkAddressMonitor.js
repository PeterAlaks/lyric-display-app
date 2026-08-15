import Store from 'electron-store';
import './appIdentity.js';
import { getLocalIPAddress } from './utils.js';

const CHECK_INTERVAL_MS = 15_000;
const DEFAULT_SERVER_PORT = 4000;
const IPV4_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/;

const networkStateStore = new Store({
  name: 'network-address-state',
  defaults: {
    lastKnownLocalIPAddress: '',
    externalOutputObservedForCurrentAddress: false,
    lastObservedRemoteOutputCount: 0,
    lastRemoteOutputSeenAt: null,
  },
});

let monitorTimer = null;
let checkInProgress = false;
let warningInProgress = false;
let remoteOutputInstanceCount = 0;

const isUsableNetworkAddress = (value) => (
  typeof value === 'string'
  && IPV4_PATTERN.test(value)
  && value !== '0.0.0.0'
  && !value.startsWith('127.')
);

async function checkNetworkAddress(requestRendererModal) {
  if (checkInProgress) return;
  checkInProgress = true;

  try {
    const currentAddress = await getLocalIPAddress();
    if (!isUsableNetworkAddress(currentAddress)) return;

    const previousAddress = networkStateStore.get('lastKnownLocalIPAddress');
    if (!isUsableNetworkAddress(previousAddress)) {
      networkStateStore.set('lastKnownLocalIPAddress', currentAddress);
      return;
    }
    if (previousAddress === currentAddress) return;

    const externalOutputWasObserved = networkStateStore.get('externalOutputObservedForCurrentAddress') === true;
    const affectedRemoteOutputCount = Math.max(
      remoteOutputInstanceCount,
      Number(networkStateStore.get('lastObservedRemoteOutputCount')) || 0
    );
    networkStateStore.set('lastKnownLocalIPAddress', currentAddress);
    networkStateStore.set(
      'externalOutputObservedForCurrentAddress',
      remoteOutputInstanceCount > 0
    );
    networkStateStore.set('lastObservedRemoteOutputCount', remoteOutputInstanceCount);
    if (!externalOutputWasObserved) return;
    if (warningInProgress || typeof requestRendererModal !== 'function') return;

    warningInProgress = true;
    try {
      const serverPort = Number(process.env.PORT) || DEFAULT_SERVER_PORT;
      await requestRendererModal({
        title: 'Network address changed',
        headerDescription: 'Review the new address and reconnect remote outputs.',
        component: 'NetworkAddressChanged',
        previousIPAddress: previousAddress,
        newIPAddress: currentAddress,
        serverPort,
        affectedRemoteOutputCount,
        variant: 'warning',
        size: 'md',
        dedupeKey: 'network-address-changed',
        dismissible: true,
        actions: [
          { label: 'Got it', value: 'dismiss', variant: 'default', autoFocus: true },
        ],
      }, {
        timeout: false,
        fallback: () => ({ dismissed: true }),
      });
    } finally {
      warningInProgress = false;
    }
  } catch (error) {
    console.warn('[NetworkAddress] Could not check the local network address:', error?.message || error);
  } finally {
    checkInProgress = false;
  }
}

export function updateNetworkOutputPresence(summary = {}) {
  const nextCount = Number(summary.remoteInstanceCount);
  if (!Number.isInteger(nextCount) || nextCount < 0) return false;

  remoteOutputInstanceCount = nextCount;
  if (nextCount > 0) {
    networkStateStore.set('externalOutputObservedForCurrentAddress', true);
    networkStateStore.set(
      'lastObservedRemoteOutputCount',
      Math.max(nextCount, Number(networkStateStore.get('lastObservedRemoteOutputCount')) || 0)
    );
    networkStateStore.set('lastRemoteOutputSeenAt', Date.now());
  }
  return true;
}

export function startNetworkAddressMonitor({ requestRendererModal } = {}) {
  if (monitorTimer) return;
  void checkNetworkAddress(requestRendererModal);
  monitorTimer = setInterval(() => {
    void checkNetworkAddress(requestRendererModal);
  }, CHECK_INTERVAL_MS);
  monitorTimer.unref?.();
}

export function stopNetworkAddressMonitor() {
  if (monitorTimer) clearInterval(monitorTimer);
  monitorTimer = null;
  checkInProgress = false;
  remoteOutputInstanceCount = 0;
}
