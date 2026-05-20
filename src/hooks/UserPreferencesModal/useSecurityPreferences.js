import { useCallback, useEffect, useState } from 'react';

export const useSecurityPreferences = ({ activeCategory, showModal, showToast }) => {
  const [securityStatus, setSecurityStatus] = useState(null);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityRotating, setSecurityRotating] = useState(false);

  const loadSecurityStatus = useCallback(async () => {
    if (!window.electronAPI?.security?.getJwtStatus) return;

    setSecurityLoading(true);
    try {
      const result = await window.electronAPI.security.getJwtStatus();
      if (result?.status) {
        setSecurityStatus(result.status);
      }
      if (result && !result.success) {
        showToast({
          title: 'Security Status Unavailable',
          message: result.error || 'Could not load security token key status.',
          variant: 'warning',
        });
      }
    } catch (error) {
      console.error('Failed to load security status:', error);
      showToast({
        title: 'Security Status Unavailable',
        message: error?.message || 'Could not load security token key status.',
        variant: 'warning',
      });
    } finally {
      setSecurityLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (activeCategory === 'advanced') {
      loadSecurityStatus();
    }
  }, [activeCategory, loadSecurityStatus]);

  const formatSecurityDate = useCallback((value) => {
    if (!value) return 'Not available';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not available';
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }, []);

  const handleRotateSecurityTokenKey = useCallback(async () => {
    if (!window.electronAPI?.security?.rotateJwtAndRestart) {
      showToast({
        title: 'Rotation Unavailable',
        message: 'This build does not expose security token key rotation.',
        variant: 'warning',
      });
      return;
    }

    const confirmation = await showModal({
      title: 'Rotate Security Token Key',
      description: 'The app will rotate the local security token key, clear cached authentication tokens, and restart. Connected controllers may need to reconnect after the restart.',
      variant: 'warning',
      actions: [
        {
          label: 'Cancel',
          value: 'cancel',
          variant: 'outline',
        },
        {
          label: 'Rotate and Restart',
          value: 'rotate',
          variant: 'destructive',
          autoFocus: true,
        },
      ],
    });

    if (confirmation !== 'rotate') return;

    setSecurityRotating(true);
    try {
      const result = await window.electronAPI.security.rotateJwtAndRestart();
      if (!result?.success) {
        throw new Error(result?.error || 'Security token key rotation failed.');
      }

      showToast({
        title: 'Restarting App',
        message: 'The security token key was rotated. LyricDisplay will restart now.',
        variant: 'success',
      });
    } catch (error) {
      console.error('Security token key rotation failed:', error);
      setSecurityRotating(false);
      showToast({
        title: 'Rotation Failed',
        message: error?.message || 'Could not rotate the security token key.',
        variant: 'error',
      });
      loadSecurityStatus();
    }
  }, [loadSecurityStatus, showModal, showToast]);

  return {
    formatSecurityDate,
    handleRotateSecurityTokenKey,
    loadSecurityStatus,
    securityLoading,
    securityRotating,
    securityStatus,
  };
};
