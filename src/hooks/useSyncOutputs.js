import { useCallback } from 'react';

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
  output1Settings,
  output2Settings,
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

        if (output1Settings && emitStyleUpdate) {
          if (!emitStyleUpdate('output1', output1Settings)) {
            syncSuccess = false;
          }
        }
        if (output2Settings && emitStyleUpdate) {
          if (!emitStyleUpdate('output2', output2Settings)) {
            syncSuccess = false;
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
    output1Settings,
    output2Settings,
    showToast
  ]);

  return { handleSyncOutputs };
};