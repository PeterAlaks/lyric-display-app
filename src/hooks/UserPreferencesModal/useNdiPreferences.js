import { useCallback } from 'react';
import useNdiStore from '../../context/NdiStore';

export const useNdiPreferences = ({ showModal, showToast }) => {
  const ndiInstalled = useNdiStore((s) => s.installed);
  const ndiVersion = useNdiStore((s) => s.version);
  const ndiInstallPath = useNdiStore((s) => s.installPath);
  const downloadProgress = useNdiStore((s) => s.downloadProgress);
  const isDownloading = useNdiStore((s) => s.isDownloading);
  const companionRunning = useNdiStore((s) => s.companionRunning);
  const companionStarting = useNdiStore((s) => s.companionStarting);
  const companionReady = useNdiStore((s) => s.companionReady);
  const companionBootstrapError = useNdiStore((s) => s.companionBootstrapError);
  const ndiAutoLaunch = useNdiStore((s) => s.autoLaunch);
  const ndiUpdateInfo = useNdiStore((s) => s.updateInfo);
  const ndiCheckingUpdate = useNdiStore((s) => s.checkingUpdate);
  const ndiUpdating = useNdiStore((s) => s.isUpdating);
  const ndiTelemetry = useNdiStore((s) => s.telemetry);
  const ndiLastError = useNdiStore((s) => s.lastError);
  const ndiStatus = { installed: ndiInstalled, version: ndiVersion, installPath: ndiInstallPath };

  const handleNdiLaunch = useCallback(async () => {
    try {
      const result = await window.electronAPI?.ndi?.launchCompanion();
      if (result?.success) {
        showToast({ title: 'NDI Companion Launched', message: 'The NDI companion is now running.', variant: 'success' });
      } else {
        showToast({ title: 'Launch Failed', message: result?.error || 'Could not start the NDI companion.', variant: 'error' });
      }
    } catch (error) {
      console.error('NDI launch failed:', error);
      showToast({ title: 'Launch Failed', message: error?.message || 'An unexpected error occurred.', variant: 'error' });
    }
  }, [showToast]);

  const handleNdiStop = useCallback(async () => {
    try {
      const result = await window.electronAPI?.ndi?.stopCompanion();
      if (result?.success) {
        showToast({ title: 'NDI Companion Stopped', message: 'The NDI companion has been stopped.', variant: 'info' });
      } else {
        showToast({ title: 'Stop Failed', message: result?.error || 'Could not stop the NDI companion.', variant: 'error' });
      }
    } catch (error) {
      console.error('NDI stop failed:', error);
      showToast({ title: 'Stop Failed', message: error?.message || 'An unexpected error occurred.', variant: 'error' });
    }
  }, [showToast]);

  const handleNdiCheckForUpdate = useCallback(async () => {
    useNdiStore.getState().setCheckingUpdate(true);
    try {
      const result = await window.electronAPI?.ndi?.checkForUpdate();
      if (result) {
        useNdiStore.getState().setUpdateInfo(result);
        if (result.error) {
          useNdiStore.getState().setLastError({
            error: result.error,
            stage: result.errorStage || 'release-metadata',
            code: result.errorCode || 'RELEASE_CHECK_FAILED',
            host: result.errorHost || '',
          });
          showToast({ title: 'Check Failed', message: result.error, variant: 'warning' });
        } else if (!result.updateAvailable) {
          useNdiStore.getState().setLastError(null);
          showToast({ title: 'No Update Available', message: 'You are running the latest version of the NDI companion.', variant: 'success' });
        }
      }
    } catch (error) {
      console.error('NDI update check failed:', error);
      useNdiStore.getState().setLastError({ error: error?.message || 'Could not check for updates.', stage: 'renderer-request', code: 'IPC_REQUEST_FAILED' });
      showToast({ title: 'Check Failed', message: 'Could not check for updates.', variant: 'warning' });
    } finally {
      useNdiStore.getState().setCheckingUpdate(false);
    }
  }, [showToast]);

  const handleNdiUninstall = useCallback(async () => {
    const confirmation = await showModal({
      title: 'Uninstall NDI Companion',
      description: 'Are you sure you want to uninstall the NDI companion? This will remove all companion files and stop any running NDI broadcasts.',
      variant: 'destructive',
      actions: [
        {
          label: 'Cancel',
          value: 'cancel',
          variant: 'outline',
        },
        {
          label: 'Uninstall',
          value: 'uninstall',
          variant: 'destructive',
          autoFocus: true,
        },
      ],
    });

    if (confirmation !== 'uninstall') return;

    try {
      const result = await window.electronAPI?.ndi?.uninstall();
      if (result?.success) {
        if (result.status?.installed) {
          useNdiStore.getState().setInstallStatus(result.status);
          useNdiStore.getState().setCompanionRunning(false);
          useNdiStore.getState().setUpdateInfo(null);
          showToast({ title: 'NDI Release Removed', message: 'The managed Companion was removed. Development mode has returned to the local source checkout.', variant: 'success' });
        } else {
          useNdiStore.getState().resetAll();
          showToast({ title: 'NDI Uninstalled', message: 'The NDI companion has been removed.', variant: 'success' });
        }
      } else {
        showToast({ title: 'Uninstall Failed', message: result?.error || 'Could not uninstall the NDI companion.', variant: 'error' });
      }
    } catch (error) {
      console.error('NDI uninstall failed:', error);
      showToast({ title: 'Uninstall Failed', message: error?.message || 'An unexpected error occurred.', variant: 'error' });
    }
  }, [showModal, showToast]);

  const handleNdiDownload = useCallback(async () => {
    useNdiStore.getState().setLastError(null);
    useNdiStore.getState().setDownloading(true);
    useNdiStore.getState().setDownloadProgress({ percent: 0, status: 'downloading' });

    try {
      const result = await window.electronAPI.ndi.download();
      if (result?.success) {
        useNdiStore.getState().setUpdateInfo(null);
        useNdiStore.getState().setLastError(null);
        showToast({ title: 'NDI Installed', message: 'NDI companion has been downloaded and is ready to use.', variant: 'success' });
      } else if (result?.cancelled) {
        showToast({ title: 'Download Cancelled', message: 'NDI companion download was cancelled.', variant: 'info' });
      } else {
        useNdiStore.getState().setLastError(result || { error: 'The NDI companion could not be downloaded.' });
        showToast({ title: 'Download Failed', message: result?.error || 'The NDI companion could not be downloaded.', variant: 'error' });
      }
    } catch (error) {
      console.error('NDI download failed:', error);
      useNdiStore.getState().setLastError({ error: error?.message || 'An unexpected download error occurred.', stage: 'renderer-request', code: 'IPC_REQUEST_FAILED' });
      showToast({ title: 'Download Failed', message: error?.message || 'An unexpected error occurred while downloading the NDI companion.', variant: 'error' });
    } finally {
      useNdiStore.getState().resetOperationState();
    }
  }, [showToast]);

  const handleNdiInstallFromZip = useCallback(async () => {
    const wasInstalled = useNdiStore.getState().installed;
    useNdiStore.getState().setLastError(null);
    useNdiStore.getState().setDownloading(true);
    useNdiStore.getState().setDownloadProgress({ percent: 0, status: 'verifying' });

    try {
      const result = await window.electronAPI?.ndi?.installFromZip?.();
      if (result?.success) {
        useNdiStore.getState().setUpdateInfo(null);
        useNdiStore.getState().setLastError(null);
        useNdiStore.getState().setCompanionRunning(false);
        if (window.electronAPI?.ndi?.clearPendingUpdateInfo) {
          await window.electronAPI.ndi.clearPendingUpdateInfo();
        }
        showToast({
          title: wasInstalled ? 'NDI Companion Updated' : 'NDI Installed',
          message: `The downloaded NDI Companion ZIP was verified and installed${result.version ? ` as v${result.version}` : ''}.`,
          variant: 'success',
        });
      } else if (result?.selectionCancelled) {
        return;
      } else if (result?.cancelled) {
        showToast({ title: 'Installation Cancelled', message: 'NDI Companion installation was cancelled.', variant: 'info' });
      } else {
        useNdiStore.getState().setLastError(result || { error: 'The selected NDI Companion ZIP could not be installed.' });
        showToast({ title: 'Installation Failed', message: result?.error || 'The selected NDI Companion ZIP could not be installed.', variant: 'error' });
      }
    } catch (error) {
      console.error('NDI local ZIP install failed:', error);
      useNdiStore.getState().setLastError({ error: error?.message || 'An unexpected local installation error occurred.', stage: 'renderer-request', code: 'IPC_REQUEST_FAILED' });
      showToast({ title: 'Installation Failed', message: error?.message || 'An unexpected error occurred while installing the NDI Companion.', variant: 'error' });
    } finally {
      useNdiStore.getState().resetOperationState();
    }
  }, [showToast]);

  const handleNdiCancelDownload = useCallback(async () => {
    try {
      await window.electronAPI?.ndi?.cancelDownload();
    } catch (error) {
      console.error('NDI cancel download failed:', error);
    }
  }, []);

  const handleNdiAutoLaunchToggle = useCallback(async (checked) => {
    try {
      await window.electronAPI?.ndi?.setAutoLaunch(checked);
      useNdiStore.getState().setAutoLaunch(checked);
    } catch (error) {
      console.error('NDI auto-launch toggle failed:', error);
      showToast({ title: 'Setting Failed', message: 'Could not update the auto-launch setting.', variant: 'error' });
    }
  }, [showToast]);

  const handleNdiUpdate = useCallback(async () => {
    useNdiStore.getState().setLastError(null);
    useNdiStore.getState().setUpdating(true);
    useNdiStore.getState().setDownloadProgress({ percent: 0, status: 'downloading' });

    try {
      const result = await window.electronAPI.ndi.updateCompanion();
      if (result?.success) {
        useNdiStore.getState().setUpdateInfo(null);
        useNdiStore.getState().setLastError(null);
        useNdiStore.getState().setCompanionRunning(false);

        if (window.electronAPI?.ndi?.clearPendingUpdateInfo) {
          await window.electronAPI.ndi.clearPendingUpdateInfo();
        }
        showToast({ title: 'NDI Companion Updated', message: `Updated to v${result.version}. You can relaunch it now.`, variant: 'success' });
      } else if (result?.cancelled) {
        showToast({ title: 'Update Cancelled', message: 'NDI Companion update was cancelled.', variant: 'info' });
      } else {
        useNdiStore.getState().setLastError(result || { error: 'Could not update the NDI companion.' });
        showToast({ title: 'Update Failed', message: result?.error || 'Could not update the NDI companion.', variant: 'error' });
      }
    } catch (error) {
      console.error('NDI update failed:', error);
      useNdiStore.getState().setLastError({ error: error?.message || 'An unexpected update error occurred.', stage: 'renderer-request', code: 'IPC_REQUEST_FAILED' });
      showToast({ title: 'Update Failed', message: error?.message || 'An unexpected error occurred while updating.', variant: 'error' });
    } finally {
      useNdiStore.getState().resetOperationState();
    }
  }, [showToast]);

  return {
    companionRunning,
    companionStarting,
    companionReady,
    companionBootstrapError,
    downloadProgress,
    handleNdiAutoLaunchToggle,
    handleNdiCancelDownload,
    handleNdiCheckForUpdate,
    handleNdiDownload,
    handleNdiInstallFromZip,
    handleNdiLaunch,
    handleNdiStop,
    handleNdiUninstall,
    handleNdiUpdate,
    isDownloading,
    ndiAutoLaunch,
    ndiCheckingUpdate,
    ndiStatus,
    ndiLastError,
    ndiTelemetry,
    ndiUpdateInfo,
    ndiUpdating,
  };
};
