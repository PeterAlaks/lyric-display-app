import { appendActionLog } from '../actionLog.js';
import { getLiveSafetySnapshot, setLiveSafety } from '../liveSafety.js';
import { schedulePersistSessionState } from '../sessionPersistence.js';
import { REALTIME_EVENTS, REALTIME_PERMISSIONS } from '../../../shared/apiContractRegistry.js';

export function registerLiveSafetyHandlers({ io, socket, hasPermission, clientType, deviceId, sessionId }) {
  socket.on(REALTIME_EVENTS.liveSafetySet, (payload = {}) => {
    if (!hasPermission(socket, REALTIME_PERMISSIONS.liveSafetySet)) {
      socket.emit('permissionError', 'Only the desktop controller can change live safety mode');
      return;
    }

    const enabled = typeof payload === 'boolean' ? payload : payload?.enabled;
    if (typeof enabled !== 'boolean') {
      socket.emit('permissionError', 'Invalid live safety payload');
      return;
    }

    const snapshot = setLiveSafety(enabled, { clientType, deviceId, sessionId });
    schedulePersistSessionState();
    console.log(`Live safety mode ${enabled ? 'enabled' : 'disabled'} by ${clientType} client`);
    appendActionLog(io, {
      type: 'safety',
      label: 'Live safety changed',
      detail: `Live safety mode ${enabled ? 'enabled' : 'disabled'}`,
      actor: { clientType, deviceId, sessionId },
      target: 'live safety',
      metadata: { enabled },
    });
    io.emit(REALTIME_EVENTS.liveSafetyUpdate, snapshot);
  });

  socket.on(REALTIME_EVENTS.requestLiveSafetyState, () => {
    socket.emit(REALTIME_EVENTS.liveSafetyUpdate, getLiveSafetySnapshot());
  });
}
