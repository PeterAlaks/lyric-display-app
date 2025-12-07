import { useMemo, useRef } from 'react';
import { resolveBackendUrl } from '../../utils/network';
import { logWarn } from '../../utils/logger';

const MAX_MEDIA_SIZE_BYTES = 200 * 1024 * 1024;

const useFullscreenBackground = ({
  outputKey,
  settings,
  applySettings,
  ensureValidToken,
  showToast
}) => {
  const fileInputRef = useRef(null);
  const clientTypeRef = useRef(typeof window !== 'undefined' && window.electronAPI ? 'desktop' : 'web');

  const hasBackgroundMedia = useMemo(() => {
    const backgroundMedia = settings.fullScreenBackgroundMedia;
    return Boolean(backgroundMedia && (backgroundMedia.url || backgroundMedia.dataUrl));
  }, [settings.fullScreenBackgroundMedia]);

  const uploadedMediaName = useMemo(() => {
    const media = settings.fullScreenBackgroundMedia;
    return settings.fullScreenBackgroundMediaName || media?.name || '';
  }, [settings.fullScreenBackgroundMedia, settings.fullScreenBackgroundMediaName]);

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleMediaSelection = async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!(file.type.startsWith('image/') || file.type.startsWith('video/'))) {
      showToast({
        title: 'Unsupported file',
        message: 'Please choose an image or video.',
        variant: 'error',
      });
      resetFileInput();
      return;
    }

    if (file.size > MAX_MEDIA_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      showToast({
        title: 'File too large',
        message: `Files must be ${Math.round(MAX_MEDIA_SIZE_BYTES / (1024 * 1024))}MB or smaller. Selected file is ${sizeMB}MB.`,
        variant: 'error',
      });
      resetFileInput();
      return;
    }

    try {
      const token = await ensureValidToken(clientTypeRef.current);
      const uploadUrl = resolveBackendUrl('/api/media/backgrounds');
      const formData = new FormData();
      formData.append('background', file);
      formData.append('outputKey', outputKey);

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = 'Upload failed';
        try {
          const errorBody = await response.json();
          if (errorBody?.error) errorMessage = errorBody.error;
        } catch {
        }
        throw new Error(errorMessage);
      }

      const payload = await response.json();

      applySettings({
        fullScreenBackgroundMedia: {
          url: payload.url,
          mimeType: payload.mimeType ?? file.type,
          name: payload.originalName ?? file.name,
          size: payload.size ?? file.size,
          uploadedAt: payload.uploadedAt ?? Date.now(),
        },
        fullScreenBackgroundMediaName: payload.originalName ?? file.name,
      });

      showToast({
        title: 'Background ready',
        message: `${payload.originalName ?? file.name} uploaded successfully.`,
        variant: 'success',
      });
    } catch (error) {
      showToast({
        title: 'Upload failed',
        message: error?.message || 'Could not upload the media file.',
        variant: 'error',
      });
    } finally {
      resetFileInput();
    }
  };

  const triggerFileDialog = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
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
    fileInputRef,
    handleMediaSelection,
    triggerFileDialog,
    hasBackgroundMedia,
    uploadedMediaName,
    validateExistingMedia,
  };
};

export default useFullscreenBackground;