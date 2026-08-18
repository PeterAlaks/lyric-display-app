import { networkInterfaces } from 'node:os';

export const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
export const isOutputClientType = (type) => typeof type === 'string' && type.startsWith('output');
export const isOutputDiscoveryClientType = (type) => type === 'output-discovery';
export const getOutputPresenceId = (clientType, clientPurpose = null) => {
  if (isOutputClientType(clientType) && !isOutputDiscoveryClientType(clientType)) return clientType;
  if (clientType === 'stage') return clientPurpose === 'time-display' ? 'time' : 'stage';
  return null;
};
export const isValidLineIndex = (index, lineCount) => {
  if (index === null) return true;
  return Number.isInteger(index)
    && index >= 0
    && Number.isInteger(lineCount)
    && index < lineCount;
};

export const getPrimaryOutputInstance = (instances = []) => {
  return instances.reduce((largest, current) => {
    if (!largest) return current;
    const largestArea = (largest.viewportWidth || 0) * (largest.viewportHeight || 0);
    const currentArea = (current.viewportWidth || 0) * (current.viewportHeight || 0);
    return currentArea > largestArea ? current : largest;
  }, null);
};

const normalizeNetworkAddress = (value) => {
  let address = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!address) return '';
  if (address.startsWith('[') && address.endsWith(']')) address = address.slice(1, -1);
  address = address.split('%')[0];
  if (address.startsWith('::ffff:')) address = address.slice('::ffff:'.length);
  return address;
};

const isLoopbackAddress = (address) => (
  address === 'localhost'
  || address === '::1'
  || address === '0:0:0:0:0:0:0:1'
  || address.startsWith('127.')
);

const getHostNetworkAddresses = () => {
  const addresses = new Set(['localhost', '::1', '0:0:0:0:0:0:0:1']);
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries || []) {
      const address = normalizeNetworkAddress(entry?.address);
      if (address) addresses.add(address);
    }
  }
  return addresses;
};

export const getSocketConnectionScope = (socket) => {
  const peerAddress = normalizeNetworkAddress(
    socket?.handshake?.address
    || socket?.conn?.remoteAddress
    || socket?.request?.socket?.remoteAddress
  );
  if (!peerAddress) return 'unknown';
  if (isLoopbackAddress(peerAddress) || getHostNetworkAddresses().has(peerAddress)) return 'local';
  return 'remote';
};
