import { useCallback } from 'react';
import useNdiStore from '../../context/NdiStore';

export const useNdiPreferences = ({ showModal, showToast }) => {
  const ndiInstalled = useNdiStore((s) => s.installed);
  const ndiVersion = useNdiStore((s) => s.version);
  const ndiInstallPath = useNdiStore((s) => s.installPath);
  const downloadProgress = useNdiStore((s) => s.downloadProgress);
  const isDownloading = useNdiStore((s) => s.isDownloading);
  const companionRunning = useNdiStore((s) => s.companionRunning);
  const ndiAutoLaunch = useNdiStore((s) => s.autoLaunch);
  const ndiUpdateInfo = useNdiStore((s) => s.updateInfo);
  const ndiCheckingUpdate = useNdiStore((s) => s.checkingUpdate);
  const ndiUpdating = useNdiStore((s) => s.isUpdating);
  const ndiTelemetry = useNdiStore((s) => s.telemetry);
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
        if (!result.updateAvailable) {
          showToast({ title: 'No Update Available', message: 'You are running the latest version of the NDI companion.', variant: 'success' });
        }
      }
    } catch (error) {
      console.error('NDI update check failed:', error);
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
        useNdiStore.getState().resetAll();
        showToast({ title: 'NDI Uninstalled', message: 'The NDI companion has been removed.', variant: 'success' });
      } else {
        showToast({ title: 'Uninstall Failed', message: result?.error || 'Could not uninstall the NDI companion.', variant: 'error' });
      }
    } catch (error) {
      console.error('NDI uninstall failed:', error);
      showToast({ title: 'Uninstall Failed', message: error?.message || 'An unexpected error occurred.', variant: 'error' });
    }
  }, [showModal, showToast]);

  const handleNdiDownload = useCallback(async () => {
    useNdiStore.getState().setDownloading(true);
    useNdiStore.getState().setDownloadProgress({ percent: 0, status: 'downloading' });

    try {
      const result = await window.electronAPI.ndi.download();
      if (result?.success) {
        useNdiStore.getState().setUpdateInfo(null);
        showToast({ title: 'NDI Installed', message: 'NDI companion has been downloaded and is ready to use.', variant: 'success' });
      } else if (result?.cancelled) {
        showToast({ title: 'Download Cancelled', message: 'NDI companion download was cancelled.', variant: 'info' });
      } else {
        showToast({ title: 'Download Failed', message: result?.error || 'The NDI companion could not be downloaded.', variant: 'error' });
      }
    } catch (error) {
      console.error('NDI download failed:', error);
      showToast({ title: 'Download Failed', message: error?.message || 'An unexpected error occurred while downloading the NDI companion.', variant: 'error' });
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
    useNdiStore.getState().setUpdating(true);
    useNdiStore.getState().setDownloadProgress({ percent: 0, status: 'downloading' });

    try {
      const result = await window.electronAPI.ndi.updateCompanion();
      if (result?.success) {
        useNdiStore.getState().setUpdateInfo(null);
        useNdiStore.getState().setCompanionRunning(false);

        if (window.electronAPI?.ndi?.clearPendingUpdateInfo) {
          await window.electronAPI.ndi.clearPendingUpdateInfo();
        }
        showToast({ title: 'NDI Companion Updated', message: `Updated to v${result.version}. You can relaunch it now.`, variant: 'success' });
      } else {
        showToast({ title: 'Update Failed', message: result?.error || 'Could not update the NDI companion.', variant: 'error' });
      }
    } catch (error) {
      console.error('NDI update failed:', error);
      showToast({ title: 'Update Failed', message: error?.message || 'An unexpected error occurred while updating.', variant: 'error' });
    } finally {
      useNdiStore.getState().resetOperationState();
    }
  }, [showToast]);

  return {
    companionRunning,
    downloadProgress,
    handleNdiAutoLaunchToggle,
    handleNdiCancelDownload,
    handleNdiCheckForUpdate,
    handleNdiDownload,
    handleNdiLaunch,
    handleNdiStop,
    handleNdiUninstall,
    handleNdiUpdate,
    isDownloading,
    ndiAutoLaunch,
    ndiCheckingUpdate,
    ndiStatus,
    ndiTelemetry,
    ndiUpdateInfo,
    ndiUpdating,
  };
};
