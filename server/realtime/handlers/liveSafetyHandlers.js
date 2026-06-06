import { getLiveSafetySnapshot, setLiveSafety } from '../liveSafety.js';

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
    console.log(`Live safety mode ${enabled ? 'enabled' : 'disabled'} by ${clientType} client`);
    io.emit('liveSafetyUpdate', snapshot);
  });

  socket.on('requestLiveSafetyState', () => {
    socket.emit('liveSafetyUpdate', getLiveSafetySnapshot());
  });
}

