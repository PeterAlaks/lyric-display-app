import { clearActionLog, getActionLogSnapshot } from '../actionLog.js';
import { REALTIME_EVENTS, REALTIME_PERMISSIONS } from '../../../shared/apiContractRegistry.js';

export function registerActionLogHandlers({ io, socket, hasPermission, clientType, deviceId, sessionId }) {
  socket.on(REALTIME_EVENTS.requestActionLog, (payload = {}) => {
    if (!hasPermission(socket, REALTIME_PERMISSIONS.requestActionLog)) {
      socket.emit('permissionError', 'Insufficient permissions to view operator action log');
      return;
    }

    socket.emit(REALTIME_EVENTS.actionLogSnapshot, getActionLogSnapshot({
      limit: Number(payload?.limit),
    }));
  });

  socket.on(REALTIME_EVENTS.actionLogClear, () => {
    if (!hasPermission(socket, REALTIME_PERMISSIONS.actionLogClear)) {
      socket.emit('permissionError', 'Insufficient permissions to clear operator action log');
      return;
    }

    clearActionLog(io, { clientType, deviceId, sessionId });
    socket.emit(REALTIME_EVENTS.actionLogSnapshot, getActionLogSnapshot());
  });
}
