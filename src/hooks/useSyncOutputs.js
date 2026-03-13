import { useCallback } from 'react';
import useLyricsStore from '../context/LyricsStore';

export const useSyncOutputs = ({
  isConnected,
  isAuthenticated,
  ready,
  lyrics,
  selectedLine,
  isOutputOn,
  emitLyricsLoad,
  emitLineUpdate,
  emitOutputToggle,
  emitStyleUpdate,
  showToast
}) => {
  const handleSyncOutputs = useCallback(() => {
    if (!isConnected || !isAuthenticated || !ready) {
      showToast({
        title: 'Cannot Sync',
        message: 'Not connected or authenticated.',
        variant: 'warning',
      });
      return;
    }

    try {
      let syncSuccess = true;

      if (lyrics && lyrics.length > 0) {
        if (!emitLyricsLoad(lyrics)) {
          syncSuccess = false;
        }
        if (selectedLine !== null && selectedLine !== undefined) {
          if (!emitLineUpdate(selectedLine)) {
            syncSuccess = false;
          }
        }

        // Dynamically sync all output settings from the store
        const storeState = useLyricsStore.getState();
        const allOutputIds = ['output1', 'output2', ...(storeState.customOutputIds || [])];
        for (const outputId of allOutputIds) {
          const settings = storeState[`${outputId}Settings`];
          if (settings && emitStyleUpdate) {
            if (!emitStyleUpdate(outputId, settings)) {
              syncSuccess = false;
            }
          }
        }
      }

      if (!emitOutputToggle(isOutputOn)) {
        syncSuccess = false;
      }

      if (syncSuccess) {
        window.dispatchEvent(new CustomEvent('sync-completed', { detail: { source: 'manual' } }));
        showToast({
          title: 'Outputs Synced',
          message: 'Output displays updated successfully.',
          variant: 'success',
        });
      } else {
        showToast({
          title: 'Sync Failed',
          message: 'Outputs were not updated. Check the connection and try again.',
          variant: 'error',
        });
      }
    } catch (error) {
      console.error('Manual sync failed:', error);
      showToast({
        title: 'Sync Failed',
        message: 'An unexpected error occurred while syncing outputs.',
        variant: 'error',
      });
    }
  }, [
    isConnected,
    isAuthenticated,
    ready,
    lyrics,
    selectedLine,
    isOutputOn,
    emitLyricsLoad,
    emitLineUpdate,
    emitOutputToggle,
    emitStyleUpdate,
    showToast
  ]);

  return { handleSyncOutputs };
};
