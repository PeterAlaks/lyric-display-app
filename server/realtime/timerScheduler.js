import { advanceAuthoritativeTimerBoundary } from '../../shared/timerAuthority.js';
import { appendActionLog } from './actionLog.js';
import { emitStageTimerUpdate } from './broadcast.js';
import { schedulePersistSessionState } from './sessionPersistence.js';
import { state } from './state.js';

let boundaryTimer = null;

export function scheduleStageTimerBoundary(io) {
  if (boundaryTimer) {
    clearTimeout(boundaryTimer);
    boundaryTimer = null;
  }

  const timerState = state.currentStageTimerState;
  if (!timerState?.running || timerState.paused || timerState.mode === 'countup') return;
  if (timerState.overrunMode && timerState.phase === 'timer' && timerState.overrunStartedAt) return;
  const endTime = Number(timerState.endTime);
  if (!Number.isFinite(endTime)) return;

  const delay = Math.max(0, Math.min(endTime - Date.now(), 2_147_000_000));
  boundaryTimer = setTimeout(() => {
    boundaryTimer = null;
    let next = advanceAuthoritativeTimerBoundary(state.currentStageTimerState, Date.now());
    let transitions = 0;
    while (next && transitions < 20) {
      state.currentStageTimerState = next;
      transitions += 1;
      next = advanceAuthoritativeTimerBoundary(state.currentStageTimerState, Date.now());
    }

    if (transitions > 0) {
      schedulePersistSessionState();
      emitStageTimerUpdate(io, state.currentStageTimerState);
      appendActionLog(io, {
        type: 'stage',
        label: 'Stage timer advanced',
        detail: `Stage timer ${state.currentStageTimerState.status || state.currentStageTimerState.phase || 'advanced'}`,
        actor: { clientType: 'server', deviceId: null, sessionId: null },
        target: 'stage timer',
        metadata: {
          revision: state.currentStageTimerState.revision,
          transitions,
        },
      });
    }
    scheduleStageTimerBoundary(io);
  }, delay);
  boundaryTimer.unref?.();
}

export function cancelStageTimerBoundary() {
  if (boundaryTimer) clearTimeout(boundaryTimer);
  boundaryTimer = null;
}
