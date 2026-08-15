export const MAIN_RENDERER_READY_CHANNEL = 'app:renderer-ready';
export const MAIN_RENDERER_READY_TIMEOUT_MS = 15_000;

const DURATION_KEYS = [
  'rendererReadyMs',
  'tokenMs',
  'socketMs',
  'stateSyncMs',
  'totalConnectionMs',
];

const normalizeDuration = (value) => {
  const duration = Number(value);
  if (!Number.isFinite(duration) || duration < 0) return null;
  return Math.round(Math.min(duration, 10 * 60_000));
};

export const normalizeRendererReadyPayload = (payload = {}) => {
  const timings = {};
  for (const key of DURATION_KEYS) {
    const duration = normalizeDuration(payload?.timings?.[key] ?? payload?.[key]);
    if (duration !== null) timings[key] = duration;
  }

  return {
    fontStatus: ['loaded', 'failed', 'unsupported'].includes(payload?.fontStatus)
      ? payload.fontStatus
      : 'unknown',
    authStatus: typeof payload?.authStatus === 'string' ? payload.authStatus.slice(0, 32) : 'unknown',
    connectionStatus: typeof payload?.connectionStatus === 'string'
      ? payload.connectionStatus.slice(0, 32)
      : 'unknown',
    ready: payload?.ready === true,
    timings,
  };
};

export function waitForRendererStartup(webContents, { timeoutMs = MAIN_RENDERER_READY_TIMEOUT_MS } = {}) {
  const startedAt = Date.now();

  return new Promise((resolve) => {
    if (!webContents || webContents.isDestroyed?.()) {
      resolve({ outcome: 'destroyed', elapsedMs: 0, payload: null });
      return;
    }

    let settled = false;
    let timeoutId = null;

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      webContents.removeListener?.('ipc-message', handleIpcMessage);
      webContents.removeListener?.('destroyed', handleDestroyed);
    };

    const settle = (outcome, payload = null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({
        outcome,
        elapsedMs: Date.now() - startedAt,
        payload: payload ? normalizeRendererReadyPayload(payload) : null,
      });
    };

    const handleIpcMessage = (_event, channel, payload) => {
      if (channel !== MAIN_RENDERER_READY_CHANNEL) return;
      settle('ready', payload);
    };

    const handleDestroyed = () => settle('destroyed');

    webContents.on('ipc-message', handleIpcMessage);
    webContents.once?.('destroyed', handleDestroyed);

    timeoutId = setTimeout(() => settle('timeout'), Math.max(1, Number(timeoutMs) || MAIN_RENDERER_READY_TIMEOUT_MS));
  });
}
