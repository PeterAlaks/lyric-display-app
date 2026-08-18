import {
  buildCurrentState,
  buildOutputList,
  buildPeriodicState,
  ensureOutputExists,
  state
} from '../state.js';
import { isControllerClient } from '../broadcast.js';
import {
  getOutputPresenceId,
  getSocketConnectionScope,
  isOutputClientType,
  isPlainObject,
} from '../utils.js';
import {
  emitOutputPresenceSnapshot,
  pruneStaleOutputPresence,
  registerOutputPresenceInstance,
  removeOutputPresenceInstance,
} from '../outputPresence.js';
import { performance } from 'node:perf_hooks';
import {
  describeStatePayload,
  isStatePayloadNoteworthy,
  shouldSamplePeriodicState,
} from '../stateDiagnostics.js';
import { REALTIME_EVENTS } from '../../../shared/apiContractRegistry.js';

const normalizePurpose = (value) => (
  typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null
);

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

export function registerConnectionHandlers({
  io,
  socket,
  clientType,
  deviceId,
  sessionId,
  clientPurpose = null,
  clientInstanceId = null,
  isPreview = false,
}) {
  const purpose = normalizePurpose(clientPurpose);
  console.log(`Authenticated user connected: ${clientType}${purpose ? `/${purpose}` : ''} (${deviceId}) - Socket: ${socket.id}`);

  const presenceOutputId = getOutputPresenceId(clientType, purpose);
  const isOutputClient = isOutputClientType(clientType) && presenceOutputId === clientType;
  const tracksOutputPresence = Boolean(presenceOutputId) && !isPreview;
  const connectionScope = getSocketConnectionScope(socket);

  if (isOutputClient) {
    if (!state.registeredOutputs.has(clientType)) {
      socket.emit(REALTIME_EVENTS.outputUnavailable, { output: clientType });
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
    connectedAt: socket.userData.connectedAt,
    connectionScope,
    clientInstanceId,
    presenceOutputId,
    isPreview,
  });

  if (tracksOutputPresence) {
    const supersededSocketIds = registerOutputPresenceInstance({
      io,
      output: presenceOutputId,
      socket,
      clientInstanceId,
      connectionScope,
    });

    for (const supersededSocketId of supersededSocketIds) {
      const supersededSocket = state.connectedClients.get(supersededSocketId)?.socket;
      if (supersededSocket?.connected !== false && typeof supersededSocket?.disconnect === 'function') {
        supersededSocket.disconnect(true);
      }
    }
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
    socket.emit(REALTIME_EVENTS.outputsRegistry, { outputs: buildOutputList() });
    const clientInfo = state.connectedClients.get(socket.id);
    if (isControllerClient(clientInfo)) {
      pruneStaleOutputPresence(io);
      emitOutputPresenceSnapshot(socket);
    }
  });

  socket.on('heartbeat', () => {
    socket.emit('heartbeat_ack', { timestamp: Date.now() });
  });

  socket.on('disconnect', (reason) => {
    console.log(`Authenticated user disconnected: ${clientType} (${deviceId}) - Reason: ${reason}`);
    state.connectedClients.delete(socket.id);

    if (tracksOutputPresence) {
      removeOutputPresenceInstance({ io, output: presenceOutputId, socketId: socket.id });
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
      socket.emit(REALTIME_EVENTS.outputsRegistry, { outputs: buildOutputList() });
    }
  }, 100);

  let periodicStateCount = 0;
  const stateBroadcastInterval = setInterval(() => {
    if (socket.connected) {
      const clientInfo = state.connectedClients.get(socket.id);
      if (!clientInfo) return;
      const buildStartedAt = performance.now();
      const payload = buildPeriodicState(clientInfo);
      const buildMs = performance.now() - buildStartedAt;
      socket.emit('periodicStateSync', payload);
      if (isControllerClient(clientInfo)) {
        emitOutputPresenceSnapshot(socket);
      }

      periodicStateCount += 1;
      if (shouldSamplePeriodicState(periodicStateCount, buildMs)) {
        const diagnostics = describeStatePayload(clientInfo, payload, { buildMs });
        const log = isStatePayloadNoteworthy(diagnostics) ? console.warn : console.log;
        log(`Periodic state diagnostics for ${socket.id}`, diagnostics);
      }
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
    socket.emit(REALTIME_EVENTS.outputsRegistry, { outputs: buildOutputList() });
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
