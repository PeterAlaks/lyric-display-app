import net from 'node:net';
import { isValidBackendPort, normalizeBackendPort } from '../shared/backendPort.js';

const closeProbeServer = (server, result, resolve) => {
  server.close((error) => {
    if (error) {
      resolve({
        available: false,
        code: error.code || 'PORT_CHECK_FAILED',
        error: error.message || 'The port availability probe could not be closed cleanly.',
      });
      return;
    }
    resolve(result);
  });
};

export function probeBackendPort(port) {
  if (!isValidBackendPort(port)) {
    return Promise.resolve({
      available: false,
      code: 'INVALID_PORT',
      error: 'The backend port must be an integer between 1024 and 65535.',
    });
  }

  const normalizedPort = normalizeBackendPort(port);
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once('error', (error) => {
      resolve({
        available: false,
        code: error.code || 'PORT_CHECK_FAILED',
        error: error.message || `Port ${normalizedPort} could not be checked.`,
      });
    });
    server.listen({ port: normalizedPort, exclusive: true }, () => {
      closeProbeServer(server, { available: true, port: normalizedPort }, resolve);
    });
  });
}

const allocateEphemeralPort = () => new Promise((resolve) => {
  const server = net.createServer();
  server.unref();
  server.once('error', (error) => {
    resolve({
      success: false,
      code: error.code || 'PORT_CHECK_FAILED',
      error: error.message || 'An available recovery port could not be allocated.',
    });
  });
  server.listen({ port: 0, exclusive: true }, () => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : null;
    closeProbeServer(server, isValidBackendPort(port)
      ? { success: true, port }
      : {
        success: false,
        code: 'INVALID_PORT',
        error: 'The operating system returned an invalid recovery port.',
      }, resolve);
  });
});

export async function findAvailableBackendPort({
  preferredPort,
  excludedPorts = [],
  maxAttempts = 5,
} = {}) {
  const excluded = new Set(excludedPorts.map(Number));
  if (isValidBackendPort(preferredPort) && !excluded.has(Number(preferredPort))) {
    const preferred = await probeBackendPort(preferredPort);
    if (preferred.available) {
      return { success: true, port: preferred.port, source: 'preferred' };
    }
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = await allocateEphemeralPort();
    if (!candidate.success) continue;
    if (excluded.has(candidate.port)) continue;
    return { ...candidate, source: 'automatic' };
  }

  return {
    success: false,
    code: 'NO_AVAILABLE_PORT',
    error: 'LyricDisplay could not find an available recovery port.',
  };
}
