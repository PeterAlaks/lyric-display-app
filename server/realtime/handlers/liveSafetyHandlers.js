import { appendActionLog } from '../actionLog.js';
import { getLiveSafetySnapshot, setLiveSafety } from '../liveSafety.js';
import { schedulePersistSessionState } from '../sessionPersistence.js';

export function registerLiveSafetyHandlers({ io, socket, hasPermission, clientType, deviceId, sessionId }) {
  socket.on('liveSafetySet', (payload = {}) => {
    if (!hasPermission(socket, 'admin:full')) {
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
    io.emit('liveSafetyUpdate', snapshot);
  });

  socket.on('requestLiveSafetyState', () => {
    socket.emit('liveSafetyUpdate', getLiveSafetySnapshot());
  });
}
