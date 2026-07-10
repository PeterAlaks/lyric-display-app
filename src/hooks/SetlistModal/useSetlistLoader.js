import { useCallback } from 'react';
import useToast from '../useToast';
import useModal from '../useModal';
import useLyricsStore from '../../context/LyricsStore';
import {
  MAX_SETLIST_FILE_BYTES,
  normalizeSetlistItemLimit,
} from '../../../shared/setlistLimits.js';

const readSetlistData = async (source) => {
  if (source && typeof source === 'object' && !Array.isArray(source) && Array.isArray(source.items)) {
    return source;
  }

  if (!(source instanceof File)) {
    throw new Error('Invalid setlist source');
  }
  if (source.size > MAX_SETLIST_FILE_BYTES) {
    throw new Error('Setlist file is too large');
  }

  const content = await source.text();
  return JSON.parse(content);
};

const useSetlistLoader = ({ setlistFiles, replaceSetlist }) => {
  const { showToast } = useToast();
  const { showModal } = useModal();
  const configuredMaxSetlistFiles = useLyricsStore((state) => state.maxSetlistFilesLimit);
  const maxSetlistFiles = normalizeSetlistItemLimit(configuredMaxSetlistFiles);

  const loadSetlist = useCallback(async (source) => {
    if (typeof replaceSetlist !== 'function') {
      showToast({
        title: 'Not supported',
        message: 'Setlist replacement is not available',
        variant: 'warn',
      });
      return false;
    }

    try {
      const setlistData = await readSetlistData(source);

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

      if (items.length > maxSetlistFiles) {
        showToast({
          title: 'Setlist too large',
          message: `Setlist contains ${items.length} songs. Maximum is ${maxSetlistFiles}.`,
          variant: 'error',
        });
        return false;
      }

      const processedFiles = items.map((item) => ({
        name: item.originalName || `${item.displayName}.${item.fileType || 'txt'}`,
        content: item.content,
        fileType: item.fileType || 'txt',
        lastModified: item.lastModified || Date.now(),
        metadata: item.metadata || null
      }));

      if (setlistFiles && setlistFiles.length > 0) {
        const result = await showModal({
          title: 'Load Setlist',
          description: `Loading a saved setlist will clear the ${setlistFiles.length} ${setlistFiles.length === 1 ? 'song' : 'songs'} currently on the setlist. Do you want to proceed?`,
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

      const result = await replaceSetlist(processedFiles);
      if (!result?.success) {
        showToast({
          title: 'Load failed',
          message: result?.error || 'Unable to load setlist. Check your connection and try again.',
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
  }, [setlistFiles, replaceSetlist, showModal, showToast, maxSetlistFiles]);

  return loadSetlist;
};

export default useSetlistLoader;
