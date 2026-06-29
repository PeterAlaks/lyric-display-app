import { getOutputRegistry, hasOutput } from './realtime/state.js';
import {
  registerConnectionHandlers,
  registerCurrentStateHandler,
  startConnectionStatsLogger
} from './realtime/handlers/connectionHandlers.js';
import { registerSetlistHandlers } from './realtime/handlers/setlistHandlers.js';
import { registerLyricsHandlers } from './realtime/handlers/lyricsHandlers.js';
import { registerOutputHandlers } from './realtime/handlers/outputHandlers.js';
import { registerStageHandlers } from './realtime/handlers/stageHandlers.js';
import { registerDraftHandlers } from './realtime/handlers/draftHandlers.js';
import { registerLiveSafetyHandlers } from './realtime/handlers/liveSafetyHandlers.js';
import { registerActionLogHandlers } from './realtime/handlers/actionLogHandlers.js';

export { getOutputRegistry, hasOutput };

export default function registerSocketEvents(io, { hasPermission }) {
  io.on('connection', (socket) => {
    const { clientType, deviceId, sessionId, clientPurpose, isPreview } = socket.userData;
    const connected = registerConnectionHandlers({ io, socket, clientType, deviceId, sessionId, clientPurpose, isPreview });

    if (!connected) {
      return;
    }

    const context = {
      io,
      socket,
      hasPermission,
      clientType,
      deviceId,
      sessionId,
      isPreview,
    };

    registerCurrentStateHandler(context);
    registerSetlistHandlers(context);
    registerLyricsHandlers(context);
    registerOutputHandlers(context);
    registerStageHandlers(context);
    registerDraftHandlers(context);
    registerLiveSafetyHandlers(context);
    registerActionLogHandlers(context);
  });

  startConnectionStatsLogger();
}
