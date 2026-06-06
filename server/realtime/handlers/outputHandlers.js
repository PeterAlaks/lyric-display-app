import {
  buildOutputList,
  ensureOutputExists,
  isKnownOrStageOutput,
  registerOutputs,
  state
} from '../state.js';
import { blockIfLiveSafety } from '../liveSafety.js';
import { getPrimaryOutputInstance, isOutputClientType, isPlainObject } from '../utils.js';

export function registerOutputHandlers({ io, socket, hasPermission, clientType }) {
  socket.on('outputToggle', (nextState) => {
    if (blockIfLiveSafety({ socket, clientType, action: 'outputToggle' })) {
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
    console.log(`Output toggled to ${nextState} by ${clientType} client`);
    io.emit('outputToggle', nextState);
  });

  socket.on('individualOutputToggle', (payload) => {
    if (blockIfLiveSafety({ socket, clientType, action: 'individualOutputToggle' })) {
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

    console.log(`Individual output ${output} toggled to ${enabled} by ${clientType} client`);
    io.emit('individualOutputToggle', { output, enabled });
  });

  socket.on('styleUpdate', (payload) => {
    if (blockIfLiveSafety({ socket, clientType, action: 'styleUpdate' })) {
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
    if (isOutputClientType(output)) {
      if (!state.registeredOutputs.has(output)) {
        return;
      }
      ensureOutputExists(output);
      state.outputSettings.set(output, { ...state.outputSettings.get(output), ...settings });
    } else if (output === 'stage') {
      state.currentStageSettings = { ...state.currentStageSettings, ...settings };
    }
    console.log(`Style updated for ${output} by ${clientType} client`);
    io.emit('styleUpdate', { output, settings });
  });

  socket.on('outputRemove', (payload) => {
    if (blockIfLiveSafety({ socket, clientType, action: 'outputRemove' })) {
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

    console.log(`Output ${output} removed by ${clientType} client`);
    io.emit('outputRemoved', { output });
    io.emit('outputsRegistry', { outputs: buildOutputList() });
  });

  socket.on('outputsRegister', (payload) => {
    if (blockIfLiveSafety({ socket, clientType, action: 'outputsRegister' })) {
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
    io.emit('outputsRegistry', { outputs: buildOutputList() });
  });

  socket.on('outputMetrics', (payload) => {
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

    io.emit('outputMetrics', {
      output,
      metrics: primaryInstance || safe,
      allInstances: allInstances,
      instanceCount: allInstances.length
    });
  });
}
