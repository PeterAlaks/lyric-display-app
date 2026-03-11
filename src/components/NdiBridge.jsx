/**
 * NdiBridge
 * Singleton bridge component that initializes the global NDI store,
 * subscribes to all main-process NDI events, and keeps the store in sync.
 */
import { useEffect } from 'react';
import useNdiStore from '../context/NdiStore';

export default function NdiBridge() {
  const initialize = useNdiStore((s) => s.initialize);
  const setCompanionRunning = useNdiStore((s) => s.setCompanionRunning);
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
        if (typeof status?.running === 'boolean') {
          setCompanionRunning(status.running);
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
      cleanups.push(api.onDownloadFailed(() => {
        resetOperationState();
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
  }, []);

  return null;
}
