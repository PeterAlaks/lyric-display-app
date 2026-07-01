import { DEFAULT_OUTPUT_IDS } from '../../shared/outputRegistry.js';

export const state = {
  currentLyrics: [],
  currentLyricsTimestamps: [],
  currentLyricsEnhancedTimestamps: [],
  currentLyricsFileName: '',
  currentRawLyricsContent: '',
  currentLyricsSource: {
    content: '',
    fileType: 'txt',
    filePath: null,
    fileName: '',
  },
  currentSongMetadata: {
    title: '',
    artists: [],
    album: '',
    year: null,
    origin: '',
    filePath: '',
  },
  currentSelectedLine: null,
  currentLyricsSections: [],
  currentLineToSection: {},
  outputSettings: new Map([
    ['output1', {}],
    ['output2', {}],
  ]),
  outputEnabled: new Map([
    ['output1', true],
    ['output2', true],
  ]),
  currentStageSettings: {},
  currentIsOutputOn: false,
  currentStageEnabled: true,
  setlistFiles: [],
  connectedClients: new Map(),
  outputInstances: new Map([
    ['output1', new Map()],
    ['output2', new Map()],
    ['stage', new Map()],
  ]),
  currentStageTimerState: { running: false, paused: false, endTime: null, remaining: null },
  currentStageMessages: [],
  pendingDrafts: new Map(),
  registeredOutputs: new Set(DEFAULT_OUTPUT_IDS),
  liveSafety: {
    enabled: false,
    updatedAt: null,
    updatedBy: null,
  },
};

export const ensureOutputExists = (outputId) => {
  if (!state.outputSettings.has(outputId)) {
    state.outputSettings.set(outputId, {});
  }
  if (!state.outputEnabled.has(outputId)) {
    state.outputEnabled.set(outputId, true);
  }
  if (!state.outputInstances.has(outputId)) {
    state.outputInstances.set(outputId, new Map());
  }
};

const normalizeCustomOutputs = (outputs = []) => {
  if (!Array.isArray(outputs)) return [];
  return outputs
    .filter((id) => typeof id === 'string' && id.startsWith('output'))
    .filter((id) => id !== 'output1' && id !== 'output2');
};

export const registerOutputs = (customOutputs = []) => {
  const normalized = normalizeCustomOutputs(customOutputs);
  const next = new Set([...DEFAULT_OUTPUT_IDS, ...normalized]);

  for (const id of Array.from(state.registeredOutputs)) {
    if (id !== 'output1' && id !== 'output2' && !next.has(id)) {
      state.outputSettings.delete(id);
      state.outputEnabled.delete(id);
      state.outputInstances.delete(id);
    }
  }

  for (const id of next) {
    if (id !== 'output1' && id !== 'output2') {
      ensureOutputExists(id);
    }
  }

  state.registeredOutputs = next;
};

export const buildOutputList = () => {
  const custom = Array.from(state.registeredOutputs)
    .filter((id) => id !== 'output1' && id !== 'output2' && typeof id === 'string' && id.startsWith('output'))
    .sort((a, b) => {
      const numA = parseInt(a.replace('output', ''), 10);
      const numB = parseInt(b.replace('output', ''), 10);
      if (Number.isFinite(numA) && Number.isFinite(numB)) return numA - numB;
      return a.localeCompare(b);
    });

  return [...DEFAULT_OUTPUT_IDS, ...custom];
};

export const getOutputRegistry = () => ({
  outputs: buildOutputList(),
  stageEnabled: state.currentStageEnabled,
});

export const hasOutput = (outputId) => {
  if (outputId === 'output1' || outputId === 'output2') return true;
  if (outputId === 'stage') return true;
  if (!outputId || typeof outputId !== 'string') return false;
  return state.registeredOutputs.has(outputId);
};

export const isKnownOutput = (output) => output === 'output1' || output === 'output2' || state.registeredOutputs.has(output);
export const isKnownOrStageOutput = (output) => output === 'stage' || isKnownOutput(output);

const isOutputClientType = (type) => typeof type === 'string' && type.startsWith('output');

const buildBaseState = (clientInfo, timestamp) => ({
  isDesktopClient: clientInfo?.type === 'desktop',
  clientPermissions: clientInfo?.permissions || [],
  liveSafety: state.liveSafety,
  timestamp,
  syncTimestamp: timestamp,
});

const appendOutputState = (target, outputId) => {
  if (!isOutputClientType(outputId)) return target;
  target[`${outputId}Settings`] = state.outputSettings.get(outputId) || {};
  target[`${outputId}Enabled`] = state.outputEnabled.has(outputId)
    ? state.outputEnabled.get(outputId)
    : true;
  return target;
};

export const summarizeSetlistForDisplay = (files = []) => {
  if (!Array.isArray(files)) return [];
  return files.map((file) => ({
    id: file?.id || '',
    displayName: file?.displayName || '',
    originalName: file?.originalName || '',
  }));
};

export function buildCurrentState(clientInfo) {
  const timestamp = Date.now();
  const clientType = clientInfo?.type;
  const clientPurpose = typeof clientInfo?.purpose === 'string' ? clientInfo.purpose : '';
  const baseState = buildBaseState(clientInfo, timestamp);

  if (clientPurpose === 'timer-control') {
    return {
      ...baseState,
      stageTimerState: state.currentStageTimerState,
    };
  }

  if (clientPurpose === 'time-display') {
    return {
      ...baseState,
      stageTimerState: state.currentStageTimerState,
    };
  }

  if (isOutputClientType(clientType)) {
    return appendOutputState({
      ...baseState,
      lyrics: state.currentLyrics,
      selectedLine: state.currentSelectedLine,
      isOutputOn: state.currentIsOutputOn,
      lyricsFileName: state.currentLyricsFileName || '',
      stageTimerState: state.currentStageTimerState,
    }, clientType);
  }

  if (clientType === 'stage') {
    return {
      ...baseState,
      lyrics: state.currentLyrics,
      selectedLine: state.currentSelectedLine,
      stageSettings: state.currentStageSettings,
      isOutputOn: state.currentIsOutputOn,
      stageEnabled: state.currentStageEnabled,
      setlistFiles: summarizeSetlistForDisplay(state.setlistFiles),
      lyricsFileName: state.currentLyricsFileName || '',
      stageTimerState: state.currentStageTimerState,
      stageMessages: state.currentStageMessages,
    };
  }

  const currentState = {
    ...baseState,
    lyrics: state.currentLyrics,
    lyricsTimestamps: state.currentLyricsTimestamps,
    lyricsEnhancedTimestamps: state.currentLyricsEnhancedTimestamps,
    selectedLine: state.currentSelectedLine,
    lyricsSections: state.currentLyricsSections,
    lineToSection: state.currentLineToSection,
    stageSettings: state.currentStageSettings,
    isOutputOn: state.currentIsOutputOn,
    stageEnabled: state.currentStageEnabled,
    setlistFiles: state.setlistFiles,
    lyricsFileName: state.currentLyricsFileName || '',
    rawLyricsContent: state.currentRawLyricsContent || '',
    lyricsSource: state.currentLyricsSource || null,
    songMetadata: state.currentSongMetadata || null,
  };

  for (const [outputId, settings] of state.outputSettings) {
    currentState[`${outputId}Settings`] = settings;
  }
  for (const [outputId, enabled] of state.outputEnabled) {
    currentState[`${outputId}Enabled`] = enabled;
  }

  currentState.stageTimerState = state.currentStageTimerState;

  if (clientInfo?.type === 'stage') {
    currentState.stageMessages = state.currentStageMessages;
  }

  return currentState;
}

export function buildPeriodicState(clientInfo) {
  const timestamp = Date.now();
  const clientType = clientInfo?.type;
  const clientPurpose = typeof clientInfo?.purpose === 'string' ? clientInfo.purpose : '';
  const baseState = buildBaseState(clientInfo, timestamp);

  if (clientPurpose === 'timer-control' || clientPurpose === 'time-display') {
    return {
      ...baseState,
      stageTimerState: state.currentStageTimerState,
    };
  }

  if (isOutputClientType(clientType)) {
    return appendOutputState({
      ...baseState,
      selectedLine: state.currentSelectedLine,
      isOutputOn: state.currentIsOutputOn,
    }, clientType);
  }

  if (clientType === 'stage') {
    return {
      ...baseState,
      isOutputOn: state.currentIsOutputOn,
      stageEnabled: state.currentStageEnabled,
      stageTimerState: state.currentStageTimerState,
    };
  }

  return buildCurrentState(clientInfo);
}

export function getConnectedClients() {
  const clients = [];
  const sessionMap = new Map();

  state.connectedClients.forEach((client, socketId) => {
    const key = `${client.type}_${client.sessionId}`;

    if (!sessionMap.has(key)) {
      sessionMap.set(key, {
        id: socketId,
        type: client.type,
        sessionId: client.sessionId,
        deviceId: client.deviceId,
        connectedAt: client.connectedAt,
        permissions: client.permissions,
        socketCount: 1
      });
    } else {
      sessionMap.get(key).socketCount++;
    }
  });

  sessionMap.forEach((client) => {
    clients.push(client);
  });

  return clients;
}

if (typeof global !== 'undefined') {
  global.getConnectedClients = getConnectedClients;
}
