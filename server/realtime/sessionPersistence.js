import fs from 'fs/promises';
import path from 'path';
import { state, registerOutputs } from './state.js';

const SESSION_FILE_NAME = 'realtime-session-state.json';
const SAVE_DEBOUNCE_MS = 250;

let sessionFilePath = null;
let saveTimer = null;
let saveInFlight = null;
let saveQueued = false;

const mapToObject = (map) => Object.fromEntries(map instanceof Map ? map.entries() : []);

const objectToMap = (value, fallback = []) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return new Map(fallback);
  }
  return new Map(Object.entries(value));
};

export const sanitizePersistedStageTimerState = (timerState) => {
  if (!timerState || typeof timerState !== 'object' || Array.isArray(timerState)) {
    return timerState;
  }

  const status = typeof timerState.status === 'string' ? timerState.status : '';
  const isActiveRuntime = Boolean(timerState.running)
    || Boolean(timerState.paused)
    || status === 'running'
    || status === 'paused';

  if (!isActiveRuntime) return timerState;

  return {
    ...timerState,
    status: 'idle',
    running: false,
    paused: false,
    finished: false,
    phase: 'timer',
    durationMs: 0,
    startTime: null,
    endTime: null,
    targetTime: null,
    elapsedBeforePauseMs: 0,
    pausedRemainingMs: null,
    remaining: null,
    overrunStartedAt: null,
    sets: [],
    activeSetIndex: 0,
    updatedAt: Date.now(),
  };
};

const createSnapshot = () => ({
  version: 1,
  savedAt: Date.now(),
  currentLyrics: Array.isArray(state.currentLyrics) ? state.currentLyrics : [],
  currentLyricsTimestamps: Array.isArray(state.currentLyricsTimestamps) ? state.currentLyricsTimestamps : [],
  currentLyricsEnhancedTimestamps: Array.isArray(state.currentLyricsEnhancedTimestamps) ? state.currentLyricsEnhancedTimestamps : [],
  currentLyricsFileName: state.currentLyricsFileName || '',
  currentRawLyricsContent: state.currentRawLyricsContent || '',
  currentLyricsSource: state.currentLyricsSource || null,
  currentSongMetadata: state.currentSongMetadata || null,
  currentSelectedLine: Number.isInteger(state.currentSelectedLine) ? state.currentSelectedLine : null,
  currentLyricsSections: Array.isArray(state.currentLyricsSections) ? state.currentLyricsSections : [],
  currentLineToSection: state.currentLineToSection || {},
  outputSettings: mapToObject(state.outputSettings),
  outputEnabled: mapToObject(state.outputEnabled),
  currentStageSettings: state.currentStageSettings || {},
  currentIsOutputOn: Boolean(state.currentIsOutputOn),
  currentStageEnabled: state.currentStageEnabled !== false,
  currentStageTimerState: sanitizePersistedStageTimerState(state.currentStageTimerState || null),
  currentStageMessages: Array.isArray(state.currentStageMessages) ? state.currentStageMessages : [],
  registeredOutputs: Array.from(state.registeredOutputs || []),
  liveSafety: state.liveSafety || null,
});

const applySnapshot = (snapshot) => {
  if (!snapshot || typeof snapshot !== 'object') return false;

  state.currentLyrics = Array.isArray(snapshot.currentLyrics) ? snapshot.currentLyrics : [];
  state.currentLyricsTimestamps = Array.isArray(snapshot.currentLyricsTimestamps) ? snapshot.currentLyricsTimestamps : [];
  state.currentLyricsEnhancedTimestamps = Array.isArray(snapshot.currentLyricsEnhancedTimestamps) ? snapshot.currentLyricsEnhancedTimestamps : [];
  state.currentLyricsFileName = typeof snapshot.currentLyricsFileName === 'string' ? snapshot.currentLyricsFileName : '';
  state.currentRawLyricsContent = typeof snapshot.currentRawLyricsContent === 'string' ? snapshot.currentRawLyricsContent : '';
  state.currentLyricsSource = snapshot.currentLyricsSource && typeof snapshot.currentLyricsSource === 'object'
    ? snapshot.currentLyricsSource
    : {
      content: state.currentRawLyricsContent || '',
      fileType: 'txt',
      filePath: null,
      fileName: state.currentLyricsFileName || '',
    };
  state.currentSongMetadata = snapshot.currentSongMetadata && typeof snapshot.currentSongMetadata === 'object'
    ? snapshot.currentSongMetadata
    : state.currentSongMetadata;
  state.currentSelectedLine = Number.isInteger(snapshot.currentSelectedLine) ? snapshot.currentSelectedLine : null;
  state.currentLyricsSections = Array.isArray(snapshot.currentLyricsSections) ? snapshot.currentLyricsSections : [];
  state.currentLineToSection = snapshot.currentLineToSection && typeof snapshot.currentLineToSection === 'object'
    ? snapshot.currentLineToSection
    : {};
  state.outputSettings = objectToMap(snapshot.outputSettings, [['output1', {}], ['output2', {}]]);
  state.outputEnabled = objectToMap(snapshot.outputEnabled, [['output1', true], ['output2', true]]);
  state.currentStageSettings = snapshot.currentStageSettings && typeof snapshot.currentStageSettings === 'object'
    ? snapshot.currentStageSettings
    : {};
  state.currentIsOutputOn = typeof snapshot.currentIsOutputOn === 'boolean' ? snapshot.currentIsOutputOn : false;
  state.currentStageEnabled = typeof snapshot.currentStageEnabled === 'boolean' ? snapshot.currentStageEnabled : true;
  state.currentStageTimerState = snapshot.currentStageTimerState && typeof snapshot.currentStageTimerState === 'object'
    ? sanitizePersistedStageTimerState(snapshot.currentStageTimerState)
    : state.currentStageTimerState;
  state.currentStageMessages = Array.isArray(snapshot.currentStageMessages) ? snapshot.currentStageMessages : [];
  if (Array.isArray(snapshot.registeredOutputs)) {
    registerOutputs(snapshot.registeredOutputs);
    for (const [outputId, settings] of objectToMap(snapshot.outputSettings)) {
      state.outputSettings.set(outputId, settings || {});
    }
    for (const [outputId, enabled] of objectToMap(snapshot.outputEnabled)) {
      state.outputEnabled.set(outputId, enabled !== false);
    }
  }
  if (snapshot.liveSafety && typeof snapshot.liveSafety === 'object') {
    state.liveSafety = {
      enabled: Boolean(snapshot.liveSafety.enabled),
      updatedAt: snapshot.liveSafety.updatedAt || null,
      updatedBy: snapshot.liveSafety.updatedBy || null,
    };
  }

  return true;
};

export async function loadPersistedSessionState({ dataRoot } = {}) {
  if (!dataRoot) return false;

  sessionFilePath = path.join(dataRoot, SESSION_FILE_NAME);

  try {
    const raw = await fs.readFile(sessionFilePath, 'utf8');
    const snapshot = JSON.parse(raw);
    const applied = applySnapshot(snapshot);
    if (applied) {
      console.log(`Loaded persisted realtime session state from ${sessionFilePath}`);
    }
    return applied;
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      console.warn('Failed to load persisted realtime session state:', error);
    }
    return false;
  }
}

async function writeSnapshot() {
  if (!sessionFilePath) return;
  if (saveInFlight) {
    saveQueued = true;
    return;
  }

  saveInFlight = (async () => {
    const snapshot = createSnapshot();
    await fs.mkdir(path.dirname(sessionFilePath), { recursive: true });
    const tmpPath = `${sessionFilePath}.${process.pid}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(snapshot), 'utf8');
    await fs.rename(tmpPath, sessionFilePath);
  })();

  try {
    await saveInFlight;
  } catch (error) {
    console.warn('Failed to persist realtime session state:', error);
  } finally {
    saveInFlight = null;
    if (saveQueued) {
      saveQueued = false;
      schedulePersistSessionState();
    }
  }
}

export function schedulePersistSessionState() {
  if (!sessionFilePath) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    writeSnapshot();
  }, SAVE_DEBOUNCE_MS);
  saveTimer.unref?.();
}
