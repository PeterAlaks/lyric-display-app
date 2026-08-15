import { appendActionLog } from '../actionLog.js';
import { emitStageMessagesUpdate, emitStageTimerUpdate } from '../broadcast.js';
import { blockIfLiveSafety } from '../liveSafety.js';
import { schedulePersistSessionState } from '../sessionPersistence.js';
import { state } from '../state.js';
import { applyAuthoritativeTimerUpdate } from '../../../shared/timerAuthority.js';
import { scheduleStageTimerBoundary } from '../timerScheduler.js';

export function registerStageHandlers({ io, socket, hasPermission, clientType, deviceId, sessionId }) {
  const actor = { clientType, deviceId, sessionId };

  socket.on('stageTimerUpdate', (timerData) => {
    if (blockIfLiveSafety({ io, socket, clientType, deviceId, sessionId, action: 'stageTimerUpdate' })) {
      return;
    }

    if (!hasPermission(socket, 'output:control')) {
      socket.emit('permissionError', 'Insufficient permissions to control stage timer');
      return;
    }

    if (timerData?.type === 'upcomingSongUpdate') {
      emitStageTimerUpdate(io, {
        type: 'upcomingSongUpdate',
        customName: String(timerData.customName || '').slice(0, 240),
        mode: String(timerData.mode || '').slice(0, 32),
      });
      return;
    }

    const authoritative = applyAuthoritativeTimerUpdate(
      state.currentStageTimerState,
      timerData,
      Date.now()
    );
    if (!authoritative.accepted) {
      socket.emit('stageTimerRejected', {
        reason: authoritative.error,
        stale: Boolean(authoritative.stale),
        timerState: { ...state.currentStageTimerState, serverNow: Date.now() },
      });
      socket.emit('stageTimerUpdate', { ...state.currentStageTimerState, serverNow: Date.now() });
      return;
    }
    state.currentStageTimerState = authoritative.state;
    schedulePersistSessionState();
    scheduleStageTimerBoundary(io);
    console.log(`Stage timer updated by ${clientType} client:`, state.currentStageTimerState);
    appendActionLog(io, {
      type: 'stage',
      label: 'Stage timer updated',
      detail: `Stage timer ${state.currentStageTimerState.status || 'updated'}`,
      actor,
      target: 'stage timer',
      metadata: {
        status: state.currentStageTimerState.status,
        running: Boolean(state.currentStageTimerState.running),
        revision: state.currentStageTimerState.revision,
      },
    });
    emitStageTimerUpdate(io, state.currentStageTimerState);
  });

  socket.on('stageMessagesUpdate', (messages) => {
    if (blockIfLiveSafety({ io, socket, clientType, deviceId, sessionId, action: 'stageMessagesUpdate' })) {
      return;
    }

    if (!hasPermission(socket, 'output:control')) {
      socket.emit('permissionError', 'Insufficient permissions to update stage messages');
      return;
    }

    state.currentStageMessages = Array.isArray(messages) ? [...messages] : [];
    schedulePersistSessionState();
    console.log(`Stage messages updated by ${clientType} client: ${messages?.length || 0} messages`);
    appendActionLog(io, {
      type: 'stage',
      label: 'Stage messages updated',
      detail: `${state.currentStageMessages.length} stage message${state.currentStageMessages.length === 1 ? '' : 's'} saved`,
      actor,
      target: 'stage messages',
      metadata: { count: state.currentStageMessages.length },
    });
    emitStageMessagesUpdate(io, messages);
  });
}
