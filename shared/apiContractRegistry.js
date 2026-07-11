export const REALTIME_EVENTS = Object.freeze({
  outputRemove: 'outputRemove',
  outputsRegister: 'outputsRegister',
  outputsRegistry: 'outputsRegistry',
  outputRemoved: 'outputRemoved',
  outputUnavailable: 'outputUnavailable',
  liveSafetySet: 'liveSafetySet',
  requestLiveSafetyState: 'requestLiveSafetyState',
  liveSafetyUpdate: 'liveSafetyUpdate',
  liveSafetyBlocked: 'liveSafetyBlocked',
  requestActionLog: 'requestActionLog',
  actionLogClear: 'actionLogClear',
  actionLogSnapshot: 'actionLogSnapshot',
  actionLogUpdate: 'actionLogUpdate',
});

export const REALTIME_PERMISSIONS = Object.freeze({
  outputRemove: 'settings:write',
  outputsRegister: 'settings:write',
  liveSafetySet: 'admin:full',
  requestActionLog: 'admin:full',
  actionLogClear: 'admin:full',
});

export const ACTION_LOG_MAX_ENTRIES = 750;

export const AUDITED_REALTIME_CONTRACTS = Object.freeze([
  { name: REALTIME_EVENTS.outputRemove, direction: 'client', permissions: [REALTIME_PERMISSIONS.outputRemove] },
  { name: REALTIME_EVENTS.outputsRegister, direction: 'client', permissions: [REALTIME_PERMISSIONS.outputsRegister] },
  { name: REALTIME_EVENTS.liveSafetySet, direction: 'client', permissions: [REALTIME_PERMISSIONS.liveSafetySet] },
  { name: REALTIME_EVENTS.requestLiveSafetyState, direction: 'client', permissions: ['lyrics:read'] },
  { name: REALTIME_EVENTS.requestActionLog, direction: 'client', permissions: [REALTIME_PERMISSIONS.requestActionLog] },
  { name: REALTIME_EVENTS.actionLogClear, direction: 'client', permissions: [REALTIME_PERMISSIONS.actionLogClear] },
  { name: REALTIME_EVENTS.outputsRegistry, direction: 'server' },
  { name: REALTIME_EVENTS.outputRemoved, direction: 'server' },
  { name: REALTIME_EVENTS.outputUnavailable, direction: 'server' },
  { name: REALTIME_EVENTS.liveSafetyUpdate, direction: 'server' },
  { name: REALTIME_EVENTS.liveSafetyBlocked, direction: 'server' },
  { name: REALTIME_EVENTS.actionLogSnapshot, direction: 'server' },
  { name: REALTIME_EVENTS.actionLogUpdate, direction: 'server' },
]);

export const AUDITED_REST_CONTRACTS = Object.freeze([
  { method: 'get', path: '/api/app/capabilities' },
  { method: 'post', path: '/api/app/switch-to-desktop-mode' },
  { method: 'post', path: '/api/app/switch-to-dock-mode' },
  { method: 'post', path: '/api/app/quit' },
  { method: 'get', path: '/api/outputs' },
  { method: 'get', path: '/api/outputs/{outputId}' },
]);
