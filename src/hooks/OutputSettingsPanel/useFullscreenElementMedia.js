import { useCallback, useMemo } from 'react';

const FULLSCREEN_ELEMENT_MEDIA_DESCRIPTION = 'For image/element overlays, transparent PNG images under 2MB are recommended. JPEG and other supported image formats can still be used.';

const useFullscreenElementMedia = ({
  applySettings,
  outputKey,
  settings,
  showModal,
  showToast,
}) => {
  const hasFullScreenElementMedia = useMemo(() => (
    Boolean(settings.fullScreenElementMedia?.url || settings.fullScreenElementMedia?.dataUrl)
  ), [settings.fullScreenElementMedia]);

  const fullScreenElementMediaName = useMemo(() => (
    settings.fullScreenElementMediaName || settings.fullScreenElementMedia?.name || ''
  ), [settings.fullScreenElementMedia, settings.fullScreenElementMediaName]);

  const applyFullScreenElementMedia = useCallback((media) => {
    if (!media?.url) {
      showToast({
        title: 'Media unavailable',
        message: 'Selected image could not be used.',
        variant: 'error',
      });
      return;
    }

    applySettings({
      fullScreenElementEnabled: true,
      fullScreenElementMedia: {
        url: media.url,
        mimeType: media.mimeType,
        name: media.name,
        size: media.size,
        uploadedAt: media.uploadedAt ?? Date.now(),
        bundled: media.bundled === true,
      },
      fullScreenElementMediaName: media.name,
      fullScreenElementScale: settings.fullScreenElementScale ?? 25,
      fullScreenElementPosition: settings.fullScreenElementPosition ?? 'center',
      fullScreenElementPaddingX: settings.fullScreenElementPaddingX ?? 0,
      fullScreenElementPaddingY: settings.fullScreenElementPaddingY ?? 0,
      fullScreenElementOpacity: settings.fullScreenElementOpacity ?? 2.5,
      fullScreenElementBlur: settings.fullScreenElementBlur ?? 0,
    });

    showToast({
      title: 'Image element ready',
      message: `${media.name} selected.`,
      variant: 'success',
    });
  }, [
    applySettings,
    settings.fullScreenElementBlur,
    settings.fullScreenElementOpacity,
    settings.fullScreenElementPaddingX,
    settings.fullScreenElementPaddingY,
    settings.fullScreenElementPosition,
    settings.fullScreenElementScale,
    showToast,
  ]);

  const openFullScreenElementMediaLibrary = useCallback((options = {}) => {
    showModal({
      title: 'User Media',
      headerDescription: 'Choose an image element from your library or upload a new file.',
      component: 'UserMedia',
      variant: 'info',
      size: 'lg',
      customLayout: true,
      scrollBehavior: 'none',
      modalKey: `user-media-element-${outputKey}`,
      actions: [],
      allowedTypes: ['image'],
      initialTab: 'image',
      mediaDescription: FULLSCREEN_ELEMENT_MEDIA_DESCRIPTION,
      onSelect: applyFullScreenElementMedia,
      onClose: (result) => {
        if (options.disableOnDismiss && result?.dismissed && !hasFullScreenElementMedia) {
          applySettings({ fullScreenElementEnabled: false });
        }
      },
    });
  }, [applyFullScreenElementMedia, applySettings, hasFullScreenElementMedia, outputKey, showModal]);

  const handleFullScreenElementToggle = useCallback((checked) => {
    if (!checked) {
      applySettings({ fullScreenElementEnabled: false });
      return;
    }

    applySettings({
      fullScreenElementEnabled: true,
      fullScreenElementScale: settings.fullScreenElementScale ?? 25,
      fullScreenElementPosition: settings.fullScreenElementPosition ?? 'center',
      fullScreenElementPaddingX: settings.fullScreenElementPaddingX ?? 0,
      fullScreenElementPaddingY: settings.fullScreenElementPaddingY ?? 0,
      fullScreenElementOpacity: settings.fullScreenElementOpacity ?? 2.5,
      fullScreenElementBlur: settings.fullScreenElementBlur ?? 0,
    });

    openFullScreenElementMediaLibrary({ disableOnDismiss: true });
  }, [
    applySettings,
    openFullScreenElementMediaLibrary,
    settings.fullScreenElementBlur,
    settings.fullScreenElementOpacity,
    settings.fullScreenElementPaddingX,
    settings.fullScreenElementPaddingY,
    settings.fullScreenElementPosition,
    settings.fullScreenElementScale,
  ]);

  return {
    fullScreenElementMediaName,
    handleFullScreenElementToggle,
    hasFullScreenElementMedia,
    openFullScreenElementMediaLibrary,
  };
};

export default useFullscreenElementMedia;
