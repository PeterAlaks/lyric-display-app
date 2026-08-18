import { OUTPUT_METRICS_FRESH_MS } from '../../shared/productionReadiness.js';
import { enrichOutputMetricsPayload, emitOutputMetricsUpdate } from './broadcast.js';
import {
  buildOutputList,
  notifyOutputPresenceChange,
  state,
} from './state.js';
import { getPrimaryOutputInstance } from './utils.js';

export const OUTPUT_PRESENCE_STALE_MS = Math.max(30000, OUTPUT_METRICS_FRESH_MS * 2);
const OUTPUT_PRESENCE_SWEEP_INTERVAL_MS = 5000;

const getPresenceOutputIds = () => [...buildOutputList(), 'stage', 'time'];
const getOrCreateInstances = (output) => {
  if (!state.outputInstances.has(output)) {
    state.outputInstances.set(output, new Map());
  }
  return state.outputInstances.get(output);
};

const buildOutputPresencePayload = (output) => {
  const allInstances = Array.from(state.outputInstances.get(output)?.values() || []);
  const primaryInstance = getPrimaryOutputInstance(allInstances);

  return {
    output,
    metrics: primaryInstance || {},
    allInstances,
    instanceCount: allInstances.length,
  };
};

const emitOutputPresenceUpdate = (io, output) => (
  emitOutputMetricsUpdate(io, buildOutputPresencePayload(output))
);

export const emitOutputPresenceSnapshot = (socket) => {
  for (const output of getPresenceOutputIds()) {
    socket.emit('outputMetrics', enrichOutputMetricsPayload(buildOutputPresencePayload(output)));
  }
};

export const registerOutputPresenceInstance = ({
  io,
  output,
  socket,
  clientInstanceId = null,
  connectionScope = 'unknown',
  now = Date.now(),
}) => {
  const instances = getOrCreateInstances(output);
  const supersededSocketIds = [];

  if (clientInstanceId) {
    for (const [existingSocketId, instance] of instances) {
      if (existingSocketId !== socket.id && instance?.clientInstanceId === clientInstanceId) {
        instances.delete(existingSocketId);
        supersededSocketIds.push(existingSocketId);
      }
    }
  }

  instances.set(socket.id, {
    socketId: socket.id,
    clientInstanceId,
    connectedAt: now,
    lastUpdate: now,
    connectionScope,
  });

  emitOutputPresenceUpdate(io, output);
  notifyOutputPresenceChange();
  return supersededSocketIds;
};

export const refreshOutputPresenceInstance = ({
  io,
  output,
  socket,
  metrics = {},
  now = Date.now(),
}) => {
  const instances = getOrCreateInstances(output);
  const existingInstance = instances.get(socket.id);
  const clientInfo = state.connectedClients.get(socket.id);
  instances.set(socket.id, {
    ...existingInstance,
    ...metrics,
    socketId: socket.id,
    clientInstanceId: existingInstance?.clientInstanceId || clientInfo?.clientInstanceId || null,
    connectedAt: existingInstance?.connectedAt || clientInfo?.connectedAt || now,
    lastUpdate: now,
    connectionScope: existingInstance?.connectionScope || clientInfo?.connectionScope || 'unknown',
  });

  emitOutputPresenceUpdate(io, output);
  if (!existingInstance) notifyOutputPresenceChange();
};

export const removeOutputPresenceInstance = ({ io, output, socketId }) => {
  const instances = state.outputInstances.get(output);
  if (!instances?.delete(socketId)) return false;

  if (instances.size === 0) {
    state.outputInstances.delete(output);
  }

  emitOutputPresenceUpdate(io, output);
  notifyOutputPresenceChange();
  return true;
};

const isPresenceInstanceStale = ({ output, socketId, instance, now }) => {
  const client = state.connectedClients.get(socketId);
  if (!client || client.socket?.connected === false) return true;
  if (client.isPreview || client.presenceOutputId !== output) return true;

  const lastUpdate = Number(instance?.lastUpdate);
  if (!Number.isFinite(lastUpdate)) return true;
  const age = now - lastUpdate;
  return age < 0 || age > OUTPUT_PRESENCE_STALE_MS;
};

export const pruneStaleOutputPresence = (io, { now = Date.now() } = {}) => {
  const changedOutputs = [];

  for (const output of getPresenceOutputIds()) {
    const instances = state.outputInstances.get(output);
    if (!instances) continue;

    let changed = false;
    for (const [socketId, instance] of instances) {
      if (isPresenceInstanceStale({ output, socketId, instance, now })) {
        instances.delete(socketId);
        changed = true;
      }
    }

    if (!changed) continue;
    if (instances.size === 0) state.outputInstances.delete(output);
    changedOutputs.push(output);
  }

  for (const output of changedOutputs) {
    emitOutputPresenceUpdate(io, output);
  }
  if (changedOutputs.length > 0) notifyOutputPresenceChange();

  return changedOutputs;
};

let presenceMonitor = null;

export const startOutputPresenceMonitor = (io) => {
  if (presenceMonitor) return presenceMonitor;
  presenceMonitor = setInterval(() => {
    pruneStaleOutputPresence(io);
  }, OUTPUT_PRESENCE_SWEEP_INTERVAL_MS);
  presenceMonitor.unref?.();
  return presenceMonitor;
};
