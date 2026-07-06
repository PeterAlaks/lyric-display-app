import { useCallback, useEffect, useRef, useState } from 'react';
import { useControlSocket } from '../../context/ControlSocketProvider';
import useToast from '../useToast';
import { sanitizeIntegerInput } from '../../utils/numberInput';
import {
  createStageMessageId,
  normalizeStageMessages,
  normalizeStageMessageText,
  MAX_STAGE_MESSAGES
} from '../../utils/stageMessages';
import {
  TIMER_STORAGE_KEY,
  formatDuration,
  getTimerDisplay,
  normalizeTimerState,
  resetActiveTimerRuntime,
} from '../../utils/timerUtils';

const STORAGE_KEYS = {
  customUpcomingSongName: 'stage_custom_upcoming_song_name',
  customMessages: 'stage_custom_messages',
  timerDuration: 'stage_timer_duration',
  timerEndTime: 'stage_timer_end_time',
  timerRemainingMs: 'stage_timer_remaining_ms',
  timerRunning: 'stage_timer_running',
  timerPaused: 'stage_timer_paused'
};

const useStageDisplayControls = ({ settings, applySettings, update, showModal }) => {
  const { emitStageTimerUpdate, emitStageMessagesUpdate } = useControlSocket();
  const { showToast } = useToast();

  const [customMessages, setCustomMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [timerDuration, setTimerDuration] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);
  const [timerEndTime, setTimerEndTime] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [pausedRemainingMs, setPausedRemainingMs] = useState(null);
  const [customUpcomingSongName, setCustomUpcomingSongName] = useState('');
  const [upcomingSongAdvancedExpanded, setUpcomingSongAdvancedExpanded] = useState(false);
  const [hasUnsavedUpcomingSongName, setHasUnsavedUpcomingSongName] = useState(false);
  const [timerAdvancedExpanded, setTimerAdvancedExpanded] = useState(false);
  const [customMessagesAdvancedExpanded, setCustomMessagesAdvancedExpanded] = useState(false);
  const latestTimerSnapshotRef = useRef(null);

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEYS.customUpcomingSongName);
    if (stored) {
      setCustomUpcomingSongName(stored);
    }
  }, []);

  useEffect(() => {
    if (settings.upcomingSongMode === 'custom') {
      setUpcomingSongAdvancedExpanded(true);
    }
  }, [settings.upcomingSongMode]);

  const handleCustomUpcomingSongNameChange = (value) => {
    setCustomUpcomingSongName(value);
    setHasUnsavedUpcomingSongName(true);
  };

  const handleConfirmUpcomingSongName = () => {
    sessionStorage.setItem(STORAGE_KEYS.customUpcomingSongName, customUpcomingSongName);
    setHasUnsavedUpcomingSongName(false);

    if (emitStageTimerUpdate) {
      const payload = {
        type: 'upcomingSongUpdate',
        customName: customUpcomingSongName,
        mode: settings.upcomingSongMode,
      };
      if (typeof emitStageTimerUpdate === 'function') {
        emitStageTimerUpdate(payload);
      }
    }

    window.dispatchEvent(new CustomEvent('stage-upcoming-song-update', {
      detail: { customName: customUpcomingSongName }
    }));

    showToast({
      title: 'Upcoming Song Updated',
      message: 'Custom upcoming song name has been set',
      variant: 'success',
    });
  };

  const handleFullScreenToggle = (type, checked) => {
    if (checked) {
      const updates = {
        upcomingSongFullScreen: type === 'upcomingSong',
        timerFullScreen: type === 'timer',
        customMessagesFullScreen: type === 'customMessages',
      };
      applySettings(updates);
      return;
    }
    update(`${type}FullScreen`, false);
  };

  const getStoredTimerState = useCallback(() => {
    try {
      const raw = window.localStorage.getItem(TIMER_STORAGE_KEY);
      return raw ? normalizeTimerState(JSON.parse(raw)) : normalizeTimerState({});
    } catch {
      return normalizeTimerState({});
    }
  }, []);

  const publishTimerState = useCallback((updates) => {
    const normalized = normalizeTimerState({
      ...getStoredTimerState(),
      ...updates,
      updatedAt: Date.now(),
    });

    try {
      window.localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(normalized));
      window.dispatchEvent(new CustomEvent('shared-timer-state', { detail: normalized }));
      window.dispatchEvent(new CustomEvent('stage-timer-update', { detail: normalized }));
    } catch {
      window.dispatchEvent(new CustomEvent('stage-timer-update', { detail: normalized }));
    }

    if (emitStageTimerUpdate) {
      emitStageTimerUpdate(normalized);
    }

    return normalized;
  }, [emitStageTimerUpdate, getStoredTimerState]);

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEYS.customMessages);
    if (stored) {
      try {
        const messages = normalizeStageMessages(JSON.parse(stored));
        setCustomMessages(messages);
        if (emitStageMessagesUpdate) {
          emitStageMessagesUpdate(messages);
        }
      } catch {
        setCustomMessages([]);
      }
    }
  }, [emitStageMessagesUpdate]);

  const applyTimerState = useCallback((timerData) => {
    if (!timerData || timerData.type === 'upcomingSongUpdate') return;

    const nextTimer = normalizeTimerState(timerData);
    const nextRunning = Boolean(nextTimer.running);
    const nextPaused = Boolean(nextTimer.paused);
    const nextEndTime = nextTimer.endTime || null;
    const nextPausedRemainingMs = Number.isFinite(nextTimer.pausedRemainingMs)
      ? nextTimer.pausedRemainingMs
      : null;
    const nextSnapshot = {
      running: nextRunning,
      paused: nextPaused,
      endTime: nextEndTime,
      pausedRemainingMs: nextPausedRemainingMs,
      durationMs: nextTimer.durationMs,
      remaining: nextTimer.remaining || null,
      finished: Boolean(nextTimer.finished),
      displayFormat: nextTimer.display?.format || 'auto',
    };

    if (JSON.stringify(nextSnapshot) === JSON.stringify(latestTimerSnapshotRef.current)) {
      return;
    }
    latestTimerSnapshotRef.current = nextSnapshot;

    setTimerRunning(nextRunning);
    setTimerPaused(nextPaused);
    setTimerEndTime(nextEndTime);
    setPausedRemainingMs(nextPausedRemainingMs);

    if (nextTimer.durationMs > 0) {
      const durationMinutes = Math.round(nextTimer.durationMs / 60000);
      setTimerDuration(durationMinutes);
      sessionStorage.setItem(STORAGE_KEYS.timerDuration, durationMinutes.toString());
    }

    if (nextPaused && Number.isFinite(nextPausedRemainingMs)) {
      setTimeRemaining(formatDuration(nextPausedRemainingMs, nextTimer.display?.format || 'auto'));
    } else if (nextRunning || nextTimer.finished || nextTimer.remaining) {
      setTimeRemaining(getTimerDisplay(nextTimer, Date.now()));
    } else {
      setTimeRemaining(null);
    }

    if (nextRunning) {
      sessionStorage.setItem(STORAGE_KEYS.timerRunning, 'true');
      sessionStorage.setItem(STORAGE_KEYS.timerPaused, nextPaused ? 'true' : 'false');
      if (nextEndTime) {
        sessionStorage.setItem(STORAGE_KEYS.timerEndTime, String(nextEndTime));
      } else {
        sessionStorage.removeItem(STORAGE_KEYS.timerEndTime);
      }
      if (Number.isFinite(nextPausedRemainingMs)) {
        sessionStorage.setItem(STORAGE_KEYS.timerRemainingMs, String(Math.floor(nextPausedRemainingMs)));
      } else {
        sessionStorage.removeItem(STORAGE_KEYS.timerRemainingMs);
      }
    } else {
      sessionStorage.removeItem(STORAGE_KEYS.timerEndTime);
      sessionStorage.removeItem(STORAGE_KEYS.timerRemainingMs);
      sessionStorage.removeItem(STORAGE_KEYS.timerRunning);
      sessionStorage.removeItem(STORAGE_KEYS.timerPaused);
    }
  }, []);

  const applyStoredSharedTimerState = useCallback(() => {
    try {
      const raw = window.localStorage.getItem(TIMER_STORAGE_KEY);
      if (!raw) return false;
      applyTimerState(resetActiveTimerRuntime(JSON.parse(raw)));
      return true;
    } catch {
      return false;
    }
  }, [applyTimerState]);

  useEffect(() => {
    const handleExternalTimerUpdate = (event) => {
      applyTimerState(event?.detail);
    };

    const handleSharedTimerState = (event) => {
      applyTimerState(event?.detail);
    };

    const handleStorage = (event) => {
      if (event.key !== TIMER_STORAGE_KEY || !event.newValue) return;
      try {
        applyTimerState(JSON.parse(event.newValue));
      } catch {
        // Ignore malformed timer storage updates.
      }
    };

    applyStoredSharedTimerState();
    window.addEventListener('stage-timer-update', handleExternalTimerUpdate);
    window.addEventListener('shared-timer-state', handleSharedTimerState);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('stage-timer-update', handleExternalTimerUpdate);
      window.removeEventListener('shared-timer-state', handleSharedTimerState);
      window.removeEventListener('storage', handleStorage);
    };
  }, [applyStoredSharedTimerState, applyTimerState]);

  useEffect(() => {
    const formatRemaining = (remainingMs) => {
      const safeRemaining = Math.max(0, remainingMs);
      const minutes = Math.floor(safeRemaining / 60000);
      const seconds = Math.floor((safeRemaining % 60000) / 1000);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const storedDuration = sessionStorage.getItem(STORAGE_KEYS.timerDuration);
    const storedEndTime = sessionStorage.getItem(STORAGE_KEYS.timerEndTime);
    const storedRemainingMs = sessionStorage.getItem(STORAGE_KEYS.timerRemainingMs);
    const storedRunning = sessionStorage.getItem(STORAGE_KEYS.timerRunning);
    const storedPaused = sessionStorage.getItem(STORAGE_KEYS.timerPaused);

    if (storedDuration) {
      setTimerDuration(sanitizeIntegerInput(storedDuration, 0, { min: 0, max: 180 }));
    }

    if (applyStoredSharedTimerState()) return;

    if (storedRunning === 'true') {
      const isPaused = storedPaused === 'true';
      const now = Date.now();

      if (isPaused) {
        let remainingMs = Number.parseInt(storedRemainingMs || '', 10);

        if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
          const parsedEndTime = Number.parseInt(storedEndTime || '', 10);
          if (Number.isFinite(parsedEndTime) && parsedEndTime > now) {
            remainingMs = parsedEndTime - now;
          }
        }

        if (Number.isFinite(remainingMs) && remainingMs > 0) {
          setTimerRunning(true);
          setTimerPaused(true);
          setTimerEndTime(null);
          setPausedRemainingMs(remainingMs);
          setTimeRemaining(formatRemaining(remainingMs));
          sessionStorage.setItem(STORAGE_KEYS.timerRemainingMs, Math.floor(remainingMs).toString());
          sessionStorage.removeItem(STORAGE_KEYS.timerEndTime);
        } else {
          sessionStorage.removeItem(STORAGE_KEYS.timerEndTime);
          sessionStorage.removeItem(STORAGE_KEYS.timerRemainingMs);
          sessionStorage.removeItem(STORAGE_KEYS.timerRunning);
          sessionStorage.removeItem(STORAGE_KEYS.timerPaused);
        }
      } else if (storedEndTime) {
        const endTime = Number.parseInt(storedEndTime, 10);
        if (Number.isFinite(endTime) && endTime > now) {
          setTimerEndTime(endTime);
          setTimerRunning(true);
          setTimerPaused(false);
          setPausedRemainingMs(null);
        } else {
          sessionStorage.removeItem(STORAGE_KEYS.timerEndTime);
          sessionStorage.removeItem(STORAGE_KEYS.timerRemainingMs);
          sessionStorage.removeItem(STORAGE_KEYS.timerRunning);
          sessionStorage.removeItem(STORAGE_KEYS.timerPaused);
        }
      } else {
        sessionStorage.removeItem(STORAGE_KEYS.timerEndTime);
        sessionStorage.removeItem(STORAGE_KEYS.timerRemainingMs);
        sessionStorage.removeItem(STORAGE_KEYS.timerRunning);
        sessionStorage.removeItem(STORAGE_KEYS.timerPaused);
      }
    } else {
      sessionStorage.removeItem(STORAGE_KEYS.timerRemainingMs);
    }
  }, [applyStoredSharedTimerState]);

  const saveMessages = useCallback((messages) => {
    const normalized = normalizeStageMessages(messages);
    setCustomMessages(normalized);
    sessionStorage.setItem(STORAGE_KEYS.customMessages, JSON.stringify(normalized));
    if (emitStageMessagesUpdate) {
      emitStageMessagesUpdate(normalized);
    }
  }, [emitStageMessagesUpdate]);

  const handleAddMessage = () => {
    const sanitizedText = normalizeStageMessageText(newMessage);
    if (!sanitizedText) return;

    if (customMessages.some((msg) => msg.text.toLowerCase() === sanitizedText.toLowerCase())) {
      showToast({
        title: 'Message Already Exists',
        message: 'This custom message is already in your list',
        variant: 'info',
      });
      return;
    }

    if (customMessages.length >= MAX_STAGE_MESSAGES) {
      showToast({
        title: 'Message Limit Reached',
        message: `You can save up to ${MAX_STAGE_MESSAGES} custom messages`,
        variant: 'error',
      });
      return;
    }

    const updatedMessages = [...customMessages, { id: createStageMessageId(), text: sanitizedText }];
    saveMessages(updatedMessages);
    setNewMessage('');

    showToast({
      title: 'Message Added',
      message: 'Custom message has been added to stage display',
      variant: 'success',
    });
  };

  const handleRemoveMessage = (id) => {
    const updatedMessages = customMessages.filter(msg => msg.id !== id);
    saveMessages(updatedMessages);

    showToast({
      title: 'Message Removed',
      message: 'Custom message has been removed from stage display',
      variant: 'success',
    });
  };

  const handleUpdateMessage = (id, nextText) => {
    const sanitizedText = normalizeStageMessageText(nextText);
    if (!sanitizedText) {
      showToast({
        title: 'Invalid Message',
        message: 'Message text cannot be empty',
        variant: 'error',
      });
      return false;
    }

    if (customMessages.some((msg) => msg.id !== id && msg.text.toLowerCase() === sanitizedText.toLowerCase())) {
      showToast({
        title: 'Message Already Exists',
        message: 'Another message already has the same text',
        variant: 'info',
      });
      return false;
    }

    const current = customMessages.find((msg) => msg.id === id);
    if (!current) return false;
    if (current.text === sanitizedText) return true;

    const updatedMessages = customMessages.map((msg) => (
      msg.id === id ? { ...msg, text: sanitizedText } : msg
    ));
    saveMessages(updatedMessages);

    showToast({
      title: 'Message Updated',
      message: 'Custom message has been updated',
      variant: 'success',
    });
    return true;
  };

  const handleClearMessages = () => {
    if (customMessages.length === 0) return;
    saveMessages([]);

    showToast({
      title: 'Messages Cleared',
      message: 'All custom messages have been removed',
      variant: 'success',
    });
  };

  useEffect(() => {
    if (!timerRunning) return;

    if (timerPaused) {
      return;
    }

    if (!timerEndTime) return;

    const finishTimerIfExpired = () => {
      const now = Date.now();
      const remaining = timerEndTime - now;

      if (remaining <= 0) {
        setTimerRunning(false);
        setTimerPaused(false);
        setTimerEndTime(null);
        setPausedRemainingMs(null);
        setTimeRemaining('0:00');
        sessionStorage.removeItem(STORAGE_KEYS.timerEndTime);
        sessionStorage.removeItem(STORAGE_KEYS.timerRemainingMs);
        sessionStorage.removeItem(STORAGE_KEYS.timerRunning);
        sessionStorage.removeItem(STORAGE_KEYS.timerPaused);
        publishTimerState({
          status: 'finished',
          running: false,
          paused: false,
          finished: true,
          endTime: null,
          pausedRemainingMs: null,
          remaining: '0:00',
        });
      }
    };

    finishTimerIfExpired();
    const interval = setInterval(finishTimerIfExpired, 1000);
    return () => clearInterval(interval);
  }, [publishTimerState, timerEndTime, timerPaused, timerRunning]);

  const handleStartTimer = () => {
    if (timerDuration <= 0) return;

    const startTime = Date.now();
    const durationMs = timerDuration * 60000;
    const endTime = startTime + durationMs;
    setTimerEndTime(endTime);
    setTimerRunning(true);
    setTimerPaused(false);
    setPausedRemainingMs(null);
    setTimeRemaining(`${timerDuration}:00`);

    sessionStorage.setItem(STORAGE_KEYS.timerEndTime, endTime.toString());
    sessionStorage.removeItem(STORAGE_KEYS.timerRemainingMs);
    sessionStorage.setItem(STORAGE_KEYS.timerRunning, 'true');
    sessionStorage.setItem(STORAGE_KEYS.timerPaused, 'false');

    publishTimerState({
      status: 'running',
      running: true,
      paused: false,
      finished: false,
      mode: 'countdown',
      phase: 'timer',
      durationMs,
      startTime,
      endTime,
      targetTime: null,
      elapsedBeforePauseMs: 0,
      pausedRemainingMs: null,
      remaining: null,
      overrunStartedAt: null,
      sets: [],
      activeSetIndex: 0,
    });
  };

  const handlePauseTimer = () => {
    if (!timerRunning || timerPaused) return;
    if (!timerEndTime) return;

    const remainingMs = Math.max(0, timerEndTime - Date.now());
    const minutes = Math.floor(remainingMs / 60000);
    const seconds = Math.floor((remainingMs % 60000) / 1000);
    const formattedRemaining = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    setTimerPaused(true);
    setTimerEndTime(null);
    setPausedRemainingMs(remainingMs);
    setTimeRemaining(formattedRemaining);

    sessionStorage.removeItem(STORAGE_KEYS.timerEndTime);
    sessionStorage.setItem(STORAGE_KEYS.timerRemainingMs, Math.floor(remainingMs).toString());
    sessionStorage.setItem(STORAGE_KEYS.timerPaused, 'true');

    const currentTimer = getStoredTimerState();
    publishTimerState({
      status: 'paused',
      running: true,
      paused: true,
      finished: false,
      endTime: null,
      elapsedBeforePauseMs: Math.max(0, (currentTimer.durationMs || 0) - remainingMs),
      pausedRemainingMs: remainingMs,
      remaining: formattedRemaining,
    });
  };

  const handleResumeTimer = () => {
    if (!timerRunning || !timerPaused) return;

    const remainingMs = Number.isFinite(pausedRemainingMs) ? pausedRemainingMs : 0;
    if (remainingMs <= 0) {
      handleStopTimer();
      return;
    }

    const resumedEndTime = Date.now() + remainingMs;
    setTimerPaused(false);
    setPausedRemainingMs(null);
    setTimerEndTime(resumedEndTime);

    sessionStorage.setItem(STORAGE_KEYS.timerEndTime, resumedEndTime.toString());
    sessionStorage.removeItem(STORAGE_KEYS.timerRemainingMs);
    sessionStorage.setItem(STORAGE_KEYS.timerPaused, 'false');

    publishTimerState({
      status: 'running',
      running: true,
      paused: false,
      finished: false,
      startTime: Date.now(),
      endTime: resumedEndTime,
      pausedRemainingMs: null,
      remaining: null,
    });
  };

  const handleStopTimer = () => {
    setTimerRunning(false);
    setTimerPaused(false);
    setTimerEndTime(null);
    setPausedRemainingMs(null);
    setTimeRemaining(null);

    sessionStorage.removeItem(STORAGE_KEYS.timerEndTime);
    sessionStorage.removeItem(STORAGE_KEYS.timerRemainingMs);
    sessionStorage.removeItem(STORAGE_KEYS.timerRunning);
    sessionStorage.removeItem(STORAGE_KEYS.timerPaused);

    publishTimerState({
      status: 'idle',
      running: false,
      paused: false,
      finished: false,
      phase: 'timer',
      durationMs: 0,
      startTime: null,
      endTime: null,
      targetTime: null,
      elapsedBeforePauseMs: 0,
      pausedRemainingMs: null,
      remaining: null,
      overrunStartedAt: null,
      sets: [],
      activeSetIndex: 0,
    });
  };

  const handleTimerDurationChange = (value) => {
    const duration = sanitizeIntegerInput(value, timerDuration ?? 0, { min: 0, max: 180 });
    setTimerDuration(duration);
    sessionStorage.setItem(STORAGE_KEYS.timerDuration, duration.toString());
  };

  return {
    state: {
      customMessages,
      newMessage,
      timerDuration,
      timerRunning,
      timerPaused,
      timerEndTime,
      timeRemaining,
      pausedRemainingMs,
      customUpcomingSongName,
      upcomingSongAdvancedExpanded,
      hasUnsavedUpcomingSongName,
      timerAdvancedExpanded,
      customMessagesAdvancedExpanded
    },
    setters: {
      setNewMessage,
      setCustomUpcomingSongName,
      setUpcomingSongAdvancedExpanded,
      setTimerAdvancedExpanded,
      setCustomMessagesAdvancedExpanded
    },
    handlers: {
      handleCustomUpcomingSongNameChange,
      handleConfirmUpcomingSongName,
      handleFullScreenToggle,
      handleAddMessage,
      handleRemoveMessage,
      handleUpdateMessage,
      handleClearMessages,
      handleStartTimer,
      handlePauseTimer,
      handleResumeTimer,
      handleStopTimer,
      handleTimerDurationChange
    }
  };
};

export default useStageDisplayControls;
