import { clearActionLog, getActionLogSnapshot } from '../actionLog.js';

export function registerActionLogHandlers({ io, socket, hasPermission, clientType, deviceId, sessionId }) {
  socket.on('requestActionLog', (payload = {}) => {
    if (!hasPermission(socket, 'admin:full')) {
      socket.emit('permissionError', 'Insufficient permissions to view operator action log');
      return;
    }

    socket.emit('actionLogSnapshot', getActionLogSnapshot({
      limit: Number(payload?.limit),
    }));
  });

  socket.on('actionLogClear', () => {
    if (!hasPermission(socket, 'admin:full')) {
      socket.emit('permissionError', 'Insufficient permissions to clear operator action log');
      return;
    }

    clearActionLog(io, { clientType, deviceId, sessionId });
    socket.emit('actionLogSnapshot', getActionLogSnapshot());
  });
}
