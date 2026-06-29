import { state, summarizeSetlistForDisplay } from './state.js';
import { isOutputClientType, isOutputDiscoveryClientType } from './utils.js';

const CONTROLLER_TYPES = new Set(['desktop', 'web', 'mobile', 'obsDock']);

export const isTimerDisplayClient = (client) => (
  client?.purpose === 'timer-control' || client?.purpose === 'time-display'
);

export const isControllerClient = (client) => (
  CONTROLLER_TYPES.has(client?.type) && !isTimerDisplayClient(client)
);

export const isOutputDisplayClient = (client) => (
  isOutputClientType(client?.type) && !isOutputDiscoveryClientType(client?.type)
);

export const isOutputDiscoveryClient = (client) => isOutputDiscoveryClientType(client?.type);

export const isStageDisplayClient = (client) => (
  client?.type === 'stage' && client?.purpose !== 'time-display'
);

const isConnectedSocket = (socket) => socket && socket.connected !== false && typeof socket.emit === 'function';

export const emitToClients = (io, eventName, payloadOrFactory, predicate = () => true) => {
  let delivered = 0;

  state.connectedClients.forEach((client) => {
    if (!predicate(client) || !isConnectedSocket(client.socket)) return;
    const payload = typeof payloadOrFactory === 'function'
      ? payloadOrFactory(client)
      : payloadOrFactory;
    client.socket.emit(eventName, payload);
    delivered += 1;
  });

  if (delivered === 0 && state.connectedClients.size === 0) {
    const fallbackPayload = typeof payloadOrFactory === 'function'
      ? payloadOrFactory(null)
      : payloadOrFactory;
    io?.emit?.(eventName, fallbackPayload);
  }

  return delivered;
};

export const renderLyricsPayload = (payload = {}) => ({
  lyrics: Array.isArray(payload.lyrics) ? payload.lyrics : [],
  fileName: payload.fileName || '',
});

export const emitLyricsLoad = (io, payload = {}) => {
  if (state.connectedClients.size === 0) {
    io?.emit?.('lyricsLoad', payload);
    return 0;
  }

  const displayPayload = renderLyricsPayload(payload);
  return emitToClients(io, 'lyricsLoad', (client) => (
    isControllerClient(client) ? payload : displayPayload
  ), (client) => (
    isControllerClient(client) ||
    isOutputDisplayClient(client) ||
    isStageDisplayClient(client)
  ));
};

export const emitLyricsRenderEvent = (io, eventName, payload) => (
  emitToClients(io, eventName, payload, (client) => (
    isControllerClient(client) ||
    (
      eventName !== 'lyricsTimestampsUpdate' &&
      eventName !== 'lyricsSectionsUpdate' &&
      (isOutputDisplayClient(client) || isStageDisplayClient(client))
    )
  ))
);

export const emitControllerEvent = (io, eventName, payload) => (
  emitToClients(io, eventName, payload, isControllerClient)
);

export const emitSetlistUpdate = (io, files) => {
  if (state.connectedClients.size === 0) {
    io?.emit?.('setlistUpdate', files);
    return 0;
  }

  const displayFiles = summarizeSetlistForDisplay(files);
  return emitToClients(io, 'setlistUpdate', (client) => (
    isControllerClient(client) ? files : displayFiles
  ), (client) => (
    isControllerClient(client) || isStageDisplayClient(client)
  ));
};

export const emitStageTimerUpdate = (io, timerState) => (
  emitToClients(io, 'stageTimerUpdate', timerState, (client) => (
    isControllerClient(client) ||
    isStageDisplayClient(client) ||
    isTimerDisplayClient(client)
  ))
);

export const emitStageMessagesUpdate = (io, messages) => (
  emitToClients(io, 'stageMessagesUpdate', messages, (client) => (
    isControllerClient(client) || isStageDisplayClient(client)
  ))
);

export const emitOutputVisibilityEvent = (io, eventName, payload) => (
  emitToClients(io, eventName, payload, (client) => (
    isControllerClient(client) ||
    isOutputDisplayClient(client) ||
    isStageDisplayClient(client)
  ))
);

export const emitIndividualOutputEvent = (io, eventName, payload = {}) => (
  emitToClients(io, eventName, payload, (client) => {
    if (isControllerClient(client)) return true;
    if (payload.output === 'stage') return isStageDisplayClient(client);
    return isOutputDisplayClient(client) && client.type === payload.output;
  })
);

export const emitOutputRegistry = (io, payload) => (
  emitToClients(io, 'outputsRegistry', payload, (client) => (
    isControllerClient(client) ||
    isOutputDisplayClient(client) ||
    isOutputDiscoveryClient(client)
  ))
);

export const emitOutputMetricsUpdate = (io, payload = {}) => (
  emitToClients(io, 'outputMetrics', payload, (client) => (
    isControllerClient(client) ||
    (isOutputDisplayClient(client) && client.type === payload.output)
  ))
);
