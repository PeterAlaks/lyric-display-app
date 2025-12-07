import { useCallback } from 'react';
import useToast from '../useToast';
import useModal from '../useModal';

const useSetlistLoader = ({ setlistFiles, setSetlistFiles, emitSetlistAdd, emitSetlistClear }) => {
  const { showToast } = useToast();
  const { showModal } = useModal();

  const loadSetlist = useCallback(async (file) => {
    if (!window?.electronAPI?.setlist?.loadFromPath) {
      showToast({
        title: 'Not supported',
        message: 'Setlist loading is only available in desktop app',
        variant: 'warn',
      });
      return false;
    }

    try {
      const content = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
      });

      const setlistData = JSON.parse(content);

      if (setlistFiles && setlistFiles.length > 0) {
        const result = await showModal({
          title: 'Load Setlist',
          description: `Loading a setlist will clear the existing ${setlistFiles.length} ${setlistFiles.length === 1 ? 'song' : 'songs'} on the setlist. Do you want to proceed?`,
          variant: 'warn',
          actions: [
            {
              label: 'Cancel',
              value: 'cancel',
              variant: 'outline',
            },
            {
              label: 'Proceed',
              value: 'proceed',
              variant: 'default',
              autoFocus: true,
            },
          ],
        });

        if (result !== 'proceed') {
          return false;
        }
      }

      if (!setlistData || !Array.isArray(setlistData.items)) {
        throw new Error('Invalid setlist format');
      }

      const items = setlistData.items;
      if (items.length === 0) {
        showToast({
          title: 'Empty setlist',
          message: 'The setlist file contains no songs',
          variant: 'info',
        });
        return false;
      }

      if (items.length > 25) {
        showToast({
          title: 'Setlist too large',
          message: `Setlist contains ${items.length} songs. Maximum is 25.`,
          variant: 'error',
        });
        return false;
      }

      const processedFiles = items.map((item) => ({
        name: item.originalName || `${item.displayName}.${item.fileType || 'txt'}`,
        content: item.content,
        lastModified: item.lastModified || Date.now(),
        metadata: item.metadata || null
      }));

      emitSetlistClear();
      setSetlistFiles([]);

      const emitted = emitSetlistAdd(processedFiles);
      if (!emitted) {
        showToast({
          title: 'Load failed',
          message: 'Unable to load setlist. Check your connection and try again.',
          variant: 'error',
        });
        return false;
      }

      showToast({
        title: 'Setlist loaded',
        message: `Loaded ${items.length} ${items.length === 1 ? 'song' : 'songs'}`,
        variant: 'success',
      });

      return true;
    } catch (error) {
      console.error('Error loading setlist from drop:', error);
      showToast({
        title: 'Load failed',
        message: error.message || 'Could not load setlist file',
        variant: 'error',
      });
      return false;
    }
  }, [setlistFiles, setSetlistFiles, emitSetlistAdd, emitSetlistClear, showModal, showToast]);

  return loadSetlist;
};

export default useSetlistLoader;