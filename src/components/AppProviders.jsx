import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import useLyricsStore, { loadPreferencesIntoStore } from '../context/LyricsStore';
import { useDarkModeState } from '../hooks/useStoreSelectors';
import useSharedTimer from '../hooks/useSharedTimer';
import useToast from '../hooks/useToast';
import { loadAdvancedSettings } from '../utils/connectionManager';
import { loadDebugLoggingPreference } from '../utils/logger';
import { getRemainingMs, getTimerIntensity } from '../utils/timerUtils';
import { calculateScheduleProjection, isTimedScheduleItem } from '../../shared/scheduleUtils.js';
import { ToastProvider } from './toast/ToastProvider';
import { ModalProvider } from './modal/ModalProvider';
import { REQUEST_MODAL_CLOSE_EVENT } from '../constants/modalEvents';

const ScheduleFileOpenBridge = React.lazy(() => import('./bridges/ScheduleFileOpenBridge'));

const formatScheduleVariance = (varianceMs) => {
  const minutes = Math.max(1, Math.ceil(Math.abs(Number(varianceMs) || 0) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
};

const ScheduleAlertBridge = () => {
  const { showToast } = useToast();
  const { timerState, now } = useSharedTimer({ renderTickIntervalMs: 1000 });
  const lastManualItemNoticeRef = React.useRef('');
  const lastBehindNoticeRef = React.useRef({ runKey: '', bucket: -1 });
  const criticalTimerAlertKeysRef = React.useRef(new Set());
  const activeSchedule = timerState.running && Array.isArray(timerState.sets) && timerState.sets.length > 0;
  const currentItem = activeSchedule ? timerState.sets[timerState.activeSetIndex] : null;
  const currentRemainingMs = activeSchedule && timerState.mode !== 'countup'
    ? getRemainingMs(timerState, now)
    : null;
  const projection = React.useMemo(() => calculateScheduleProjection({
    items: timerState.sets,
    active: activeSchedule,
    activeIndex: timerState.activeSetIndex,
    now,
    currentRemainingMs,
    currentIsTransition: timerState.phase === 'indicator',
    transitionMs: timerState.indicatorEnabled ? timerState.indicatorDurationMs : 0,
    idealEndAt: timerState.scheduleIdealEndAt,
  }), [
    activeSchedule,
    currentRemainingMs,
    now,
    timerState.activeSetIndex,
    timerState.indicatorDurationMs,
    timerState.indicatorEnabled,
    timerState.phase,
    timerState.scheduleIdealEndAt,
    timerState.sets,
  ]);

  const surfaceNotice = React.useCallback((title, message, variant = 'warning') => {
    const appWindowActive = document.visibilityState !== 'hidden' && document.hasFocus();
    showToast({ title, message, variant });
    if (!appWindowActive && typeof window.Notification === 'function' && window.Notification.permission === 'granted') {
      try { new window.Notification(title, { body: message }); } catch { /* The in-app alert remains available. */ }
    }
  }, [showToast]);

  React.useEffect(() => {
    if (!activeSchedule || timerState.phase !== 'timer' || timerState.scheduleNotificationsEnabled === false) return;
    if (!currentItem || isTimedScheduleItem(currentItem)) return;
    const noticeKey = `${timerState.scheduleStartedAt || ''}:${currentItem.id}`;
    if (lastManualItemNoticeRef.current === noticeKey) return;
    lastManualItemNoticeRef.current = noticeKey;
    surfaceNotice('Manual schedule item', `${currentItem.label} has no duration. Select Next when it is complete.`, 'info');
  }, [activeSchedule, currentItem, surfaceNotice, timerState.phase, timerState.scheduleNotificationsEnabled, timerState.scheduleStartedAt]);

  React.useEffect(() => {
    const varianceMs = projection.varianceMs;
    const notificationsEnabled = activeSchedule && timerState.scheduleNotificationsEnabled !== false;
    const hasIdealEnd = projection.status !== 'unconfigured' && Number.isFinite(projection.idealEndAt);
    const runKey = String(timerState.scheduleStartedAt || '');
    if (lastBehindNoticeRef.current.runKey !== runKey) {
      lastBehindNoticeRef.current = { runKey, bucket: -1 };
    }
    if (!notificationsEnabled || !hasIdealEnd || !Number.isFinite(varianceMs) || varianceMs < 60_000) {
      lastBehindNoticeRef.current.bucket = -1;
      return;
    }
    const bucket = Math.floor(varianceMs / (5 * 60_000));
    if (lastBehindNoticeRef.current.bucket >= bucket) return;
    lastBehindNoticeRef.current.bucket = bucket;
    const qualifier = projection.isEstimate ? 'at least ' : '';
    surfaceNotice(
      'Schedule running behind',
      `${timerState.scheduleTitle || 'The schedule'} is ${qualifier}${formatScheduleVariance(varianceMs)} behind the ideal end time.`
    );
  }, [activeSchedule, projection, surfaceNotice, timerState.scheduleNotificationsEnabled, timerState.scheduleStartedAt, timerState.scheduleTitle]);

  React.useEffect(() => {
    const intensity = getTimerIntensity(timerState, now);
    const canAlert = activeSchedule
      && timerState.scheduleNotificationsEnabled !== false
      && timerState.phase === 'timer'
      && isTimedScheduleItem(currentItem)
      && intensity === 'critical'
      && Number(timerState.criticalMs) > 0;
    if (!canAlert) return;
    const alertKey = `${timerState.scheduleStartedAt || ''}:${currentItem.id}`;
    if (criticalTimerAlertKeysRef.current.has(alertKey)) return;
    criticalTimerAlertKeysRef.current.add(alertKey);
    const remainingSeconds = Math.max(0, Math.ceil((getRemainingMs(timerState, now) || 0) / 1000));
    surfaceNotice(
      'Timer critical',
      `${currentItem.label} has ${remainingSeconds} ${remainingSeconds === 1 ? 'second' : 'seconds'} remaining.`,
      'error'
    );
  }, [activeSchedule, currentItem, now, surfaceNotice, timerState]);

  React.useEffect(() => {
    if (criticalTimerAlertKeysRef.current.size <= 500) return;
    criticalTimerAlertKeysRef.current = new Set(Array.from(criticalTimerAlertKeysRef.current).slice(-250));
  }, [timerState.scheduleStartedAt]);

  return null;
};

export default function AppProviders({ children, effectiveDarkMode, isDockRuntime }) {
  const { setDarkMode } = useDarkModeState();
  const location = useLocation();
  const ownsScheduleAlerts = !isDockRuntime && (
    !window.electronAPI
    || location.pathname === '/'
    || location.pathname.startsWith('/new-song')
    || location.pathname.startsWith('/lyric-video-studio')
  );

  useEffect(() => {
    if (!window.electronAPI) return;

    loadPreferencesIntoStore(useLyricsStore);
    loadAdvancedSettings();
    loadDebugLoggingPreference();
  }, []);

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onThemeUpdated?.((payload) => {
      if (typeof payload?.darkMode === 'boolean') {
        setDarkMode(payload.darkMode);
      }
    });

    return () => unsubscribe?.();
  }, [setDarkMode]);

  useEffect(() => {
    const handleGlobalEscape = (event) => {
      if (event.key !== 'Escape' || event.repeat) return;

      const detail = { candidates: [] };
      window.dispatchEvent(new CustomEvent(REQUEST_MODAL_CLOSE_EVENT, { detail }));

      const candidates = Array.isArray(detail.candidates) ? detail.candidates : [];
      if (candidates.length === 0) return;

      let selected = null;
      candidates.forEach((candidate, idx) => {
        if (!candidate || typeof candidate.close !== 'function') return;
        const priority = Number.isFinite(candidate.priority) ? candidate.priority : 0;
        if (!selected || priority > selected.priority || (priority === selected.priority && idx > selected.idx)) {
          selected = { close: candidate.close, priority, idx };
        }
      });

      if (!selected) return;

      try {
        selected.close();
      } catch (error) {
        console.error('Failed to close modal on Escape:', error);
      }
      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener('keydown', handleGlobalEscape, true);
    return () => window.removeEventListener('keydown', handleGlobalEscape, true);
  }, []);

  return (
    <ModalProvider isDark={!!effectiveDarkMode}>
      <ToastProvider
        isDark={!!effectiveDarkMode}
        density={isDockRuntime ? 'dock' : 'default'}
        position={isDockRuntime ? 'top-right' : 'bottom-right'}
        offset={isDockRuntime ? 8 : 32}
      >
        <React.Suspense fallback={null}>
          <ScheduleFileOpenBridge />
        </React.Suspense>
        {ownsScheduleAlerts && <ScheduleAlertBridge />}
        {children}
      </ToastProvider>
    </ModalProvider>
  );
}
