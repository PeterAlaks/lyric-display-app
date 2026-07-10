/**
 * NdiBridge
 * Singleton bridge component that initializes the global NDI store,
 * subscribes to all main-process NDI events, and keeps the store in sync.
 */
import { useEffect } from 'react';
import useNdiStore from '../../context/NdiStore';
import useToast from '../../hooks/useToast';

export default function NdiBridge() {
  const { showToast } = useToast();
  const initialize = useNdiStore((s) => s.initialize);
  const setCompanionStatus = useNdiStore((s) => s.setCompanionStatus);
  const setDownloadProgress = useNdiStore((s) => s.setDownloadProgress);
  const setTelemetry = useNdiStore((s) => s.setTelemetry);
  const setUpdateInfo = useNdiStore((s) => s.setUpdateInfo);
  const setInstallStatus = useNdiStore((s) => s.setInstallStatus);
  const resetOperationState = useNdiStore((s) => s.resetOperationState);
  const refreshInstallStatus = useNdiStore((s) => s.refreshInstallStatus);

  useEffect(() => {
    initialize();

    const api = window.electronAPI?.ndi;
    if (!api) return;

    const cleanups = [];

    if (api.onCompanionStatus) {
      cleanups.push(api.onCompanionStatus((status) => {
        setCompanionStatus(status || {});
        if (status?.restartExhausted) {
          showToast({
            title: 'NDI output stopped',
            message: status.error || 'The NDI companion could not be restarted. Relaunch it from Preferences before continuing.',
            variant: 'error',
            duration: 12000,
            dedupeKey: 'ndi-companion-recovery',
          });
        } else if (status?.restartScheduled) {
          showToast({
            title: 'NDI output interrupted',
            message: `The NDI companion stopped unexpectedly. Recovery attempt ${status.restartAttempt}/${status.maxRestartAttempts} is starting.`,
            variant: 'warn',
            duration: 8000,
            dedupeKey: 'ndi-companion-recovery',
          });
        } else if (status?.recovered) {
          showToast({
            title: 'NDI output recovered',
            message: 'The NDI companion restarted and completed synchronization.',
            variant: 'success',
            dedupeKey: 'ndi-companion-recovery',
          });
        }
      }));
    }

    if (api.onDownloadProgress) {
      cleanups.push(api.onDownloadProgress((progress) => {
        setDownloadProgress(progress);
      }));
    }

    if (api.onDownloadComplete) {
      cleanups.push(api.onDownloadComplete((result) => {
        resetOperationState();
        if (result?.success) {
          refreshInstallStatus();
        }
      }));
    }

    if (api.onDownloadFailed) {
      cleanups.push(api.onDownloadFailed((result) => {
        resetOperationState();
        if (result?.error) {
          useNdiStore.getState().setLastError(result.cancelled ? null : result.error);
        }
      }));
    }

    if (api.onCompanionTelemetry) {
      cleanups.push(api.onCompanionTelemetry((payload) => {
        setTelemetry(payload);
      }));
    }

    if (api.onUpdateAvailable) {
      cleanups.push(api.onUpdateAvailable((info) => {
        if (info?.updateAvailable) {
          setUpdateInfo(info);
        }
      }));
    }

    return () => {
      cleanups.forEach((cleanup) => {
        if (typeof cleanup === 'function') cleanup();
      });
    };
  }, [initialize, refreshInstallStatus, resetOperationState, setCompanionStatus, setDownloadProgress, setTelemetry, setUpdateInfo, showToast]);

  return null;
}
