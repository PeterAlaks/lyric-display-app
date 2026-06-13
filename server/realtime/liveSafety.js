import { appendActionLog } from './actionLog.js';
import { state } from './state.js';

const LIVE_SAFETY_BLOCK_REASON = 'Live safety mode is active. Secondary controllers can only change lyric lines.';

export function getLiveSafetySnapshot() {
  return {
    enabled: Boolean(state.liveSafety?.enabled),
    updatedAt: state.liveSafety?.updatedAt || null,
    updatedBy: state.liveSafety?.updatedBy || null,
  };
}

export function setLiveSafety(enabled, actor = {}) {
  state.liveSafety = {
    enabled: Boolean(enabled),
    updatedAt: Date.now(),
    updatedBy: {
      clientType: actor.clientType || null,
      deviceId: actor.deviceId || null,
      sessionId: actor.sessionId || null,
    },
  };

  return getLiveSafetySnapshot();
}

export function isSecondaryController(clientType) {
  return clientType === 'mobile' || clientType === 'web';
}

export function blockIfLiveSafety({ io, socket, clientType, deviceId, sessionId, action, reason = LIVE_SAFETY_BLOCK_REASON }) {
  if (!state.liveSafety?.enabled || !isSecondaryController(clientType)) {
    return false;
  }

  const payload = {
    action,
    reason,
    liveSafety: getLiveSafetySnapshot(),
    timestamp: Date.now(),
  };

  socket.emit('liveSafetyBlocked', payload);
  appendActionLog(io, {
    type: 'safety',
    label: 'Live safety blocked action',
    detail: `${action || 'Action'} blocked for ${clientType || 'secondary'} controller`,
    actor: {
      clientType,
      deviceId: deviceId || socket?.userData?.deviceId,
      sessionId: sessionId || socket?.userData?.sessionId,
    },
    target: action,
    metadata: { reason },
  });
  return true;
}
