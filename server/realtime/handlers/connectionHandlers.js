import {
  buildCurrentState,
  buildOutputList,
  buildPeriodicState,
  ensureOutputExists,
  state
} from '../state.js';
import { emitOutputMetricsUpdate } from '../broadcast.js';
import { getPrimaryOutputInstance, isOutputClientType, isOutputDiscoveryClientType, isPlainObject } from '../utils.js';

const normalizePurpose = (value) => (
  typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null
);

const describeStatePayload = (clientInfo, payload) => {
  let approxBytes = 0;
  try {
    approxBytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
  } catch {
    approxBytes = -1;
  }

  return {
    clientType: clientInfo?.type || 'unknown',
    purpose: clientInfo?.purpose || null,
    keys: Object.keys(payload || {}).length,
    lyrics: Array.isArray(payload?.lyrics) ? payload.lyrics.length : 0,
    setlistItems: Array.isArray(payload?.setlistFiles) ? payload.setlistFiles.length : 0,
    hasRawLyricsContent: Object.hasOwn(payload || {}, 'rawLyricsContent'),
    approxBytes,
  };
};

const emitCurrentState = (socket, clientInfo, reason, shouldLog = false) => {
  if (!clientInfo) {
    if (shouldLog) {
      console.warn(`Skipped current state for ${socket.id} (${reason}) because client metadata was not available`);
    }
    return null;
  }

  const payload = buildCurrentState(clientInfo);
  socket.emit('currentState', payload);
  if (shouldLog) {
    console.log(`Current state sent to: ${socket.id} (${reason})`, describeStatePayload(clientInfo, payload));
  }
  return payload;
};

export function registerConnectionHandlers({ io, socket, clientType, deviceId, sessionId, clientPurpose = null, isPreview = false }) {
  const purpose = normalizePurpose(clientPurpose);
  console.log(`Authenticated user connected: ${clientType}${purpose ? `/${purpose}` : ''} (${deviceId}) - Socket: ${socket.id}`);

  const isOutputClient = isOutputClientType(clientType) && !isOutputDiscoveryClientType(clientType);
  const tracksOutputPresence = isOutputClient && !isPreview;

  if (isOutputClient) {
    if (!state.registeredOutputs.has(clientType)) {
      socket.emit('outputUnavailable', { output: clientType });
      socket.disconnect(true);
      return false;
    }
    ensureOutputExists(clientType);
  }

  state.connectedClients.set(socket.id, {
    type: clientType,
    deviceId,
    sessionId,
    purpose,
    socket,
    permissions: socket.userData.permissions,
    connectedAt: socket.userData.connectedAt
  });

  if (tracksOutputPresence) {
    const connectedAt = Date.now();
    state.outputInstances.get(clientType).set(socket.id, {
      socketId: socket.id,
      connectedAt,
      lastUpdate: connectedAt
    });

    const allInstances = Array.from(state.outputInstances.get(clientType).values());
    const primaryInstance = getPrimaryOutputInstance(allInstances);
    emitOutputMetricsUpdate(io, {
      output: clientType,
      metrics: primaryInstance || {},
      allInstances,
      instanceCount: allInstances.length
    });
  }

  socket.on('clientConnect', (payload) => {
    if (!isPlainObject(payload) || typeof payload.type !== 'string') {
      socket.emit('authError', 'Invalid clientConnect payload');
      return;
    }
    const { type } = payload;
    if (type !== clientType) {
      console.warn(`Client ${socket.id} claimed type ${type} but authenticated as ${clientType}`);
      socket.emit('authError', 'Client type mismatch with authentication');
      return;
    }

    console.log(`Client ${socket.id} confirmed as: ${type}`);
    const nextPurpose = normalizePurpose(payload.purpose);
    if (nextPurpose) {
      const clientInfo = state.connectedClients.get(socket.id);
      if (clientInfo) {
        const wouldDowngradeSpecificPurpose =
          clientInfo.purpose && clientInfo.purpose !== nextPurpose && nextPurpose === clientInfo.type;
        if (!wouldDowngradeSpecificPurpose) {
          clientInfo.purpose = nextPurpose;
        }
      }
    }
    emitCurrentState(socket, state.connectedClients.get(socket.id), 'clientConnect', true);
    socket.emit('outputsRegistry', { outputs: buildOutputList() });
  });

  socket.on('heartbeat', () => {
    socket.emit('heartbeat_ack', { timestamp: Date.now() });
  });

  socket.on('disconnect', (reason) => {
    console.log(`Authenticated user disconnected: ${clientType} (${deviceId}) - Reason: ${reason}`);
    state.connectedClients.delete(socket.id);

    if (tracksOutputPresence && state.outputInstances.has(clientType)) {
      state.outputInstances.get(clientType).delete(socket.id);

      const remainingInstances = Array.from(state.outputInstances.get(clientType).values());
      if (remainingInstances.length > 0) {
        const primaryInstance = getPrimaryOutputInstance(remainingInstances);

        emitOutputMetricsUpdate(io, {
          output: clientType,
          metrics: primaryInstance,
          allInstances: remainingInstances,
          instanceCount: remainingInstances.length
        });
      } else {
        state.outputInstances.delete(clientType);
        emitOutputMetricsUpdate(io, {
          output: clientType,
          metrics: {},
          allInstances: [],
          instanceCount: 0
        });
      }
    }

    socket.broadcast.emit('clientDisconnected', {
      clientType,
      deviceId,
      disconnectedAt: Date.now(),
      reason
    });
  });

  setTimeout(() => {
    if (socket.connected) {
      const clientInfo = state.connectedClients.get(socket.id);
      if (!clientInfo) return;
      emitCurrentState(socket, clientInfo, 'initial-sync', true);
      socket.emit('outputsRegistry', { outputs: buildOutputList() });
    }
  }, 100);

  const stateBroadcastInterval = setInterval(() => {
    if (socket.connected) {
      const clientInfo = state.connectedClients.get(socket.id);
      if (!clientInfo) return;
      socket.emit('periodicStateSync', buildPeriodicState(clientInfo));
    }
  }, 30000);

  socket.on('disconnect', () => {
    clearInterval(stateBroadcastInterval);
  });

  return true;
}

export function registerCurrentStateHandler({ socket, hasPermission }) {
  socket.on('requestCurrentState', () => {
    if (!hasPermission(socket, 'lyrics:read')) {
      socket.emit('permissionError', 'Insufficient permissions to read current state');
      return;
    }

    console.log('State requested by authenticated client:', socket.id);
    const clientInfo = state.connectedClients.get(socket.id);
    if (!emitCurrentState(socket, clientInfo, 'requestCurrentState', true)) return;
    socket.emit('outputsRegistry', { outputs: buildOutputList() });
  });
}

export function startConnectionStatsLogger() {
  setInterval(() => {
    const stats = {
      totalConnections: state.connectedClients.size,
      clientTypes: {},
      clientPurposes: {},
      timestamp: Date.now()
    };

    state.connectedClients.forEach(client => {
      stats.clientTypes[client.type] = (stats.clientTypes[client.type] || 0) + 1;
      if (client.purpose) {
        const key = `${client.type}/${client.purpose}`;
        stats.clientPurposes[key] = (stats.clientPurposes[key] || 0) + 1;
      }
    });

    console.log('Connection statistics:', stats);
  }, 5 * 60 * 1000);
}
