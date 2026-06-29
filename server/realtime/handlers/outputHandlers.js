import {
  buildOutputList,
  ensureOutputExists,
  isKnownOrStageOutput,
  registerOutputs,
  state
} from '../state.js';
import { appendActionLog } from '../actionLog.js';
import {
  emitIndividualOutputEvent,
  emitOutputMetricsUpdate,
  emitOutputRegistry,
  emitOutputVisibilityEvent
} from '../broadcast.js';
import { blockIfLiveSafety } from '../liveSafety.js';
import { schedulePersistSessionState } from '../sessionPersistence.js';
import { getPrimaryOutputInstance, isOutputClientType, isPlainObject } from '../utils.js';

const areSettingValuesEqual = (left, right) => {
  if (Object.is(left, right)) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
};

const getChangedSettingKeys = (currentSettings = {}, nextSettings = {}) => {
  return Object.keys(nextSettings).filter((key) => !areSettingValuesEqual(currentSettings?.[key], nextSettings[key]));
};

export function registerOutputHandlers({ io, socket, hasPermission, clientType, deviceId, sessionId, isPreview = false }) {
  const actor = { clientType, deviceId, sessionId };

  socket.on('outputToggle', (nextState) => {
    if (blockIfLiveSafety({ io, socket, clientType, deviceId, sessionId, action: 'outputToggle' })) {
      return;
    }

    if (!hasPermission(socket, 'output:control')) {
      socket.emit('permissionError', 'Insufficient permissions to control output');
      return;
    }

    if (typeof nextState !== 'boolean') {
      socket.emit('permissionError', 'Invalid output toggle payload');
      return;
    }

    state.currentIsOutputOn = nextState;
    schedulePersistSessionState();
    console.log(`Output toggled to ${nextState} by ${clientType} client`);
    appendActionLog(io, {
      type: 'output',
      label: 'All outputs toggled',
      detail: `All outputs turned ${nextState ? 'on' : 'off'}`,
      actor,
      target: 'all outputs',
      metadata: { enabled: nextState },
    });
    emitOutputVisibilityEvent(io, 'outputToggle', nextState);
  });

  socket.on('individualOutputToggle', (payload) => {
    if (blockIfLiveSafety({ io, socket, clientType, deviceId, sessionId, action: 'individualOutputToggle' })) {
      return;
    }

    if (!hasPermission(socket, 'output:control')) {
      socket.emit('permissionError', 'Insufficient permissions to control individual outputs');
      return;
    }

    if (!isPlainObject(payload) || typeof payload.output !== 'string' || typeof payload.enabled !== 'boolean') {
      socket.emit('permissionError', 'Invalid individual output toggle payload');
      return;
    }

    const { output, enabled } = payload;
    if (!isKnownOrStageOutput(output)) {
      socket.emit('permissionError', 'Unknown output target');
      return;
    }

    if (isOutputClientType(output)) {
      state.outputEnabled.set(output, enabled);
    } else if (output === 'stage') {
      state.currentStageEnabled = enabled;
    }

    schedulePersistSessionState();
    console.log(`Individual output ${output} toggled to ${enabled} by ${clientType} client`);
    appendActionLog(io, {
      type: 'output',
      label: 'Output toggled',
      detail: `${output} turned ${enabled ? 'on' : 'off'}`,
      actor,
      target: output,
      metadata: { enabled },
    });
    emitIndividualOutputEvent(io, 'individualOutputToggle', { output, enabled });
  });

  socket.on('styleUpdate', (payload) => {
    if (blockIfLiveSafety({ io, socket, clientType, deviceId, sessionId, action: 'styleUpdate' })) {
      return;
    }

    if (!hasPermission(socket, 'settings:write')) {
      socket.emit('permissionError', 'Insufficient permissions to modify settings');
      return;
    }

    if (!isPlainObject(payload) || typeof payload.output !== 'string' || !isPlainObject(payload.settings)) {
      socket.emit('permissionError', 'Invalid style update payload');
      return;
    }

    const { output, settings } = payload;
    let changedKeys = [];
    if (isOutputClientType(output)) {
      if (!state.registeredOutputs.has(output)) {
        return;
      }
      ensureOutputExists(output);
      const currentSettings = state.outputSettings.get(output) || {};
      changedKeys = getChangedSettingKeys(currentSettings, settings);
      state.outputSettings.set(output, { ...currentSettings, ...settings });
    } else if (output === 'stage') {
      changedKeys = getChangedSettingKeys(state.currentStageSettings || {}, settings);
      state.currentStageSettings = { ...state.currentStageSettings, ...settings };
    }
    if (changedKeys.length > 0) {
      schedulePersistSessionState();
    }
    console.log(`Style updated for ${output} by ${clientType} client`);
    if (changedKeys.length > 0) {
      appendActionLog(io, {
        type: 'output',
        label: 'Output style updated',
        detail: `${output} style settings changed`,
        actor,
        target: output,
        metadata: { keys: changedKeys.slice(0, 12) },
      });
    }
    emitIndividualOutputEvent(io, 'styleUpdate', { output, settings });
  });

  socket.on('outputRemove', (payload) => {
    if (blockIfLiveSafety({ io, socket, clientType, deviceId, sessionId, action: 'outputRemove' })) {
      return;
    }

    if (!hasPermission(socket, 'settings:write')) {
      socket.emit('permissionError', 'Insufficient permissions to remove outputs');
      return;
    }

    if (!isPlainObject(payload) || typeof payload.output !== 'string') {
      socket.emit('permissionError', 'Invalid output remove payload');
      return;
    }

    const { output } = payload;
    if (!isOutputClientType(output)) {
      return;
    }

    if (output === 'output1' || output === 'output2') {
      return;
    }

    state.outputSettings.delete(output);
    state.outputEnabled.delete(output);
    state.outputInstances.delete(output);
    if (state.registeredOutputs.has(output)) {
      state.registeredOutputs.delete(output);
    }

    schedulePersistSessionState();
    console.log(`Output ${output} removed by ${clientType} client`);
    appendActionLog(io, {
      type: 'output',
      label: 'Output removed',
      detail: `${output} removed`,
      actor,
      target: output,
    });
    emitIndividualOutputEvent(io, 'outputRemoved', { output });
    emitOutputRegistry(io, { outputs: buildOutputList() });
  });

  socket.on('outputsRegister', (payload) => {
    if (blockIfLiveSafety({ io, socket, clientType, deviceId, sessionId, action: 'outputsRegister' })) {
      return;
    }

    if (!hasPermission(socket, 'settings:write')) {
      socket.emit('permissionError', 'Insufficient permissions to register outputs');
      return;
    }

    if (!isPlainObject(payload) || !Array.isArray(payload.outputs)) {
      socket.emit('permissionError', 'Invalid outputs register payload');
      return;
    }

    const outputs = payload.outputs.filter((id) => typeof id === 'string');
    registerOutputs(outputs);
    schedulePersistSessionState();
    appendActionLog(io, {
      type: 'output',
      label: 'Custom outputs registered',
      detail: `${outputs.length} custom output${outputs.length === 1 ? '' : 's'} registered`,
      actor,
      target: 'outputs',
      metadata: { outputs },
    });
    emitOutputRegistry(io, { outputs: buildOutputList() });
  });

  socket.on('outputMetrics', (payload) => {
    if (isPreview) {
      return;
    }

    if (!isOutputClientType(clientType)) {
      socket.emit('permissionError', 'Insufficient permissions to publish metrics');
      return;
    }
    if (!isPlainObject(payload) || !isOutputClientType(payload.output) || !isPlainObject(payload.metrics)) {
      return;
    }

    const { output, metrics } = payload;

    if (!state.outputSettings.has(output) && !state.outputEnabled.has(output)) {
      return;
    }

    if (!state.outputInstances.has(output)) {
      state.outputInstances.set(output, new Map());
    }

    const safe = {};
    if (Number.isFinite(metrics.adjustedFontSize) || metrics.adjustedFontSize === null) safe.adjustedFontSize = metrics.adjustedFontSize;
    if (typeof metrics.autosizerActive === 'boolean') safe.autosizerActive = metrics.autosizerActive;
    if (Number.isFinite(metrics.viewportWidth)) safe.viewportWidth = metrics.viewportWidth;
    if (Number.isFinite(metrics.viewportHeight)) safe.viewportHeight = metrics.viewportHeight;
    if (Number.isFinite(metrics.timestamp)) safe.timestamp = metrics.timestamp;

    state.outputInstances.get(output).set(socket.id, {
      ...safe,
      socketId: socket.id,
      lastUpdate: Date.now()
    });

    const allInstances = Array.from(state.outputInstances.get(output).values());
    const primaryInstance = getPrimaryOutputInstance(allInstances);

    emitOutputMetricsUpdate(io, {
      output,
      metrics: primaryInstance || safe,
      allInstances: allInstances,
      instanceCount: allInstances.length
    });
  });
}
