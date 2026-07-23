import React from 'react';
import { useNavigate } from 'react-router-dom';
import useLyricsStore from '../../context/LyricsStore';
import useToast from '../../hooks/useToast';
import { saveTimerScheduleSnapshot } from '../../utils/timerScheduleStorage.js';
import { normalizeScheduleDocument, resolveScheduleOccurrence } from '../../../shared/scheduleUtils.js';

export default function ScheduleFileOpenBridge() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  React.useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onOpenScheduleFromPath) return undefined;

    const offOpen = api.onOpenScheduleFromPath(async (payload = {}) => {
      try {
        const schedule = normalizeScheduleDocument(payload.schedule);
        if (schedule.items.length === 0) throw new Error('This schedule does not contain any items');

        const scheduleSettings = {
          useSets: true,
          sets: schedule.items,
          scheduleTitle: schedule.title,
          scheduleEventStartTime: schedule.eventStartTime,
          scheduleEventDate: schedule.eventDate,
          scheduleScheduledStartAt: resolveScheduleOccurrence({
            eventStartTime: schedule.eventStartTime,
            eventDate: schedule.eventDate,
          }),
          scheduleIdealEndTime: schedule.idealEndTime,
          scheduleShowGlobalTimeDuringManualItems: schedule.showGlobalTimeDuringManualItems,
          scheduleNotificationsEnabled: schedule.notificationsEnabled,
          autoStartNext: schedule.autoStartNext,
          indicatorEnabled: schedule.indicator.enabled,
          indicatorSeconds: schedule.indicator.durationSeconds,
          indicatorLabel: schedule.indicator.label,
        };
        useLyricsStore.getState().updateTimerControlSettings(scheduleSettings);
        saveTimerScheduleSnapshot(useLyricsStore.getState().timerControlSettings);

        if (api.display?.openTimerControlWindow) {
          try {
            const result = await api.display.openTimerControlWindow();
            if (result?.success === false) navigate('/timer-control');
          } catch {
            navigate('/timer-control');
          }
        } else {
          navigate('/timer-control');
        }
        showToast({
          title: 'Schedule opened',
          message: `${schedule.title} is ready in Timer Control.`,
          variant: 'success',
        });
      } catch (error) {
        showToast({
          title: 'Could not open schedule',
          message: error?.message || 'The schedule file is invalid.',
          variant: 'error',
        });
      }
    });

    const offError = api.onOpenScheduleFromPathError?.((payload = {}) => {
      showToast({
        title: 'Could not open schedule',
        message: payload.error || 'The schedule file could not be read.',
        variant: 'error',
      });
    });

    return () => {
      try { offOpen?.(); } catch { }
      try { offError?.(); } catch { }
    };
  }, [navigate, showToast]);

  return null;
}
