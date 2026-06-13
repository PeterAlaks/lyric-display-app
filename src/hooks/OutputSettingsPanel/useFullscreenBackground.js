import { useMemo } from 'react';
import { resolveBackendUrl } from '../../utils/network';
import { logWarn } from '../../utils/logger';

const useFullscreenBackground = ({
  outputKey,
  settings,
  applySettings,
  showModal,
  showToast
}) => {
  const hasBackgroundMedia = useMemo(() => {
    const backgroundMedia = settings.fullScreenBackgroundMedia;
    return Boolean(backgroundMedia && (backgroundMedia.url || backgroundMedia.dataUrl));
  }, [settings.fullScreenBackgroundMedia]);

  const uploadedMediaName = useMemo(() => {
    const media = settings.fullScreenBackgroundMedia;
    return settings.fullScreenBackgroundMediaName || media?.name || '';
  }, [settings.fullScreenBackgroundMedia, settings.fullScreenBackgroundMediaName]);

  const applyBackgroundMedia = (media) => {
    if (!media?.url) {
      showToast({
        title: 'Media unavailable',
        message: 'Selected media could not be used.',
        variant: 'error',
      });
      return;
    }

    applySettings({
      fullScreenBackgroundMedia: {
        url: media.url,
        mimeType: media.mimeType,
        name: media.name,
        size: media.size,
        uploadedAt: media.uploadedAt ?? Date.now(),
        bundled: media.bundled === true,
      },
      fullScreenBackgroundMediaName: media.name,
    });

    showToast({
      title: 'Background ready',
      message: `${media.name} selected.`,
      variant: 'success',
    });
  };

  const openMediaLibrary = () => {
    if (typeof showModal !== 'function') {
      return;
    }
    showModal({
      title: 'User Media',
      headerDescription: 'Choose media from your library or upload a new file.',
      component: 'UserMedia',
      variant: 'info',
      size: 'lg',
      customLayout: true,
      scrollBehavior: 'none',
      modalKey: `user-media-background-${outputKey}`,
      actions: [],
      allowedTypes: ['image', 'video'],
      initialTab: 'image',
      onSelect: applyBackgroundMedia,
    });
  };

  const validateExistingMedia = async () => {
    if (!settings.fullScreenMode || !settings.fullScreenBackgroundMedia?.url) return;
    if (settings.fullScreenBackgroundMedia?.bundled) return;

    const mediaUrl = resolveBackendUrl(settings.fullScreenBackgroundMedia.url);
    try {
      const response = await fetch(mediaUrl, { method: 'HEAD' });
      if (!response.ok) {
        logWarn(`${outputKey}: Background media not found, clearing reference`);
        applySettings({
          fullScreenBackgroundMedia: null,
          fullScreenBackgroundMediaName: '',
        });
      }
    } catch (error) {
      logWarn(`${outputKey}: Could not validate background media:`, error.message);
    }
  };

  return {
    openMediaLibrary,
    hasBackgroundMedia,
    uploadedMediaName,
    validateExistingMedia,
  };
};

export default useFullscreenBackground;
