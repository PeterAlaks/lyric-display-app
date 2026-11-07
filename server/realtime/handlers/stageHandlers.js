import { appendActionLog } from '../actionLog.js';
import { emitStageMessagesUpdate, emitStageTimerUpdate } from '../broadcast.js';
import { blockIfLiveSafety } from '../liveSafety.js';
import { schedulePersistSessionState } from '../sessionPersistence.js';
import { state } from '../state.js';
import { applyAuthoritativeTimerUpdate } from '../../../shared/timerAuthority.js';
import { normalizeStageMessages } from '../../../shared/stageMessages.js';
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

    // A controller dragging a slider or colour picker sends updates faster than the echoes
    // return, so they carry a revision it already superseded itself. Only treat an old
    // revision as a conflict when another controller or a timer boundary wrote since then.
    const currentRevision = Math.max(0, Number(state.currentStageTimerState?.revision) || 0);
    const writer = state.stageTimerWriter;
    const ownRun = writer && socket.id && writer.socketId === socket.id && writer.revision === currentRevision;
    const authoritative = applyAuthoritativeTimerUpdate(
      state.currentStageTimerState,
      timerData,
      Date.now(),
      { ownRunBaseRevision: ownRun ? writer.baseRevision : null }
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
    state.stageTimerWriter = {
      socketId: socket.id,
      baseRevision: ownRun ? writer.baseRevision : currentRevision,
      revision: authoritative.state.revision,
    };
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

    state.currentStageMessages = normalizeStageMessages(messages);
    schedulePersistSessionState();
    console.log(`Stage messages updated by ${clientType} client: ${state.currentStageMessages.length} messages`);
    appendActionLog(io, {
      type: 'stage',
      label: 'Stage messages updated',
      detail: `${state.currentStageMessages.length} stage message${state.currentStageMessages.length === 1 ? '' : 's'} saved`,
      actor,
      target: 'stage messages',
      metadata: { count: state.currentStageMessages.length },
    });
    emitStageMessagesUpdate(io, state.currentStageMessages);
  });
}
