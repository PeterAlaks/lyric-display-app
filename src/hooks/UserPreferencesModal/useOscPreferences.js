import { useCallback } from 'react';

export const useOscPreferences = ({ oscStatus, setOscStatus, updateNestedPreference, showToast }) => {
  const handleOscToggle = useCallback(async () => {
    try {
      if (oscStatus?.enabled) {
        const result = await window.electronAPI?.osc?.disable();
        if (!result?.success) throw new Error(result?.error || 'Could not disable OSC');
        setOscStatus(prev => ({ ...prev, enabled: false }));
        updateNestedPreference('externalControl', 'osc', 'enabled', false);
      } else {
        const result = await window.electronAPI?.osc?.enable();
        if (!result?.success) throw new Error(result?.error || 'Could not enable OSC');
        setOscStatus(prev => ({ ...prev, enabled: true }));
        updateNestedPreference('externalControl', 'osc', 'enabled', true);
      }
    } catch (error) {
      console.error('Failed to toggle OSC:', error);
      showToast?.({ title: 'OSC setting failed', message: error.message, variant: 'error' });
    }
  }, [oscStatus?.enabled, setOscStatus, showToast, updateNestedPreference]);

  const handleOscPortChange = useCallback(async (port) => {
    try {
      const parsedPort = Number.parseInt(port, 10);
      const result = await window.electronAPI?.osc?.setPort(parsedPort);
      if (!result?.success) throw new Error(result?.error || 'Could not update OSC port');
      setOscStatus(prev => ({ ...prev, port: parsedPort }));
      updateNestedPreference('externalControl', 'osc', 'port', parsedPort);
    } catch (error) {
      console.error('Failed to set OSC port:', error);
      showToast?.({ title: 'OSC setting failed', message: error.message, variant: 'error' });
    }
  }, [setOscStatus, showToast, updateNestedPreference]);

  const handleOscFeedbackPortChange = useCallback(async (port) => {
    try {
      const parsedPort = Number.parseInt(port, 10);
      const result = await window.electronAPI?.osc?.setFeedbackPort(parsedPort);
      if (!result?.success) throw new Error(result?.error || 'Could not update OSC feedback port');
      setOscStatus(prev => ({ ...prev, feedbackPort: parsedPort }));
      updateNestedPreference('externalControl', 'osc', 'feedbackPort', parsedPort);
    } catch (error) {
      console.error('Failed to set OSC feedback port:', error);
      showToast?.({ title: 'OSC setting failed', message: error.message, variant: 'error' });
    }
  }, [setOscStatus, showToast, updateNestedPreference]);

  const handleOscFeedbackToggle = useCallback(async () => {
    try {
      const newValue = !oscStatus?.feedbackEnabled;
      const result = await window.electronAPI?.osc?.setFeedbackEnabled(newValue);
      if (!result?.success) throw new Error(result?.error || 'Could not update OSC feedback');
      setOscStatus(prev => ({ ...prev, feedbackEnabled: newValue }));
      updateNestedPreference('externalControl', 'osc', 'feedbackEnabled', newValue);
    } catch (error) {
      console.error('Failed to toggle OSC feedback:', error);
      showToast?.({ title: 'OSC setting failed', message: error.message, variant: 'error' });
    }
  }, [oscStatus?.feedbackEnabled, setOscStatus, showToast, updateNestedPreference]);

  const handleOscRemoteAccessToggle = useCallback(async () => {
    try {
      const enabled = !oscStatus?.remoteAccessEnabled;
      const result = await window.electronAPI?.osc?.setRemoteAccessEnabled(enabled);
      if (!result?.success) throw new Error(result?.error || 'Could not update OSC network access');
      setOscStatus((previous) => ({
        ...previous,
        remoteAccessEnabled: enabled,
        bindAddress: result.bindAddress,
      }));
      updateNestedPreference('externalControl', 'osc', 'remoteAccessEnabled', enabled);
      showToast?.({
        title: 'OSC network setting updated',
        message: 'Restart LyricDisplay for the listening interface change to take effect.',
        variant: 'info',
      });
    } catch (error) {
      showToast?.({ title: 'OSC setting failed', message: error.message, variant: 'error' });
    }
  }, [oscStatus?.remoteAccessEnabled, setOscStatus, showToast, updateNestedPreference]);

  const handleOscAllowedSourcesChange = useCallback(async (sources) => {
    try {
      const result = await window.electronAPI?.osc?.setAllowedSources(sources);
      if (!result?.success) throw new Error(result?.error || 'Could not update OSC source allowlist');
      setOscStatus((previous) => ({ ...previous, allowedSources: result.allowedSources }));
      updateNestedPreference('externalControl', 'osc', 'allowedSources', result.allowedSources);
    } catch (error) {
      showToast?.({ title: 'Invalid OSC source list', message: error.message, variant: 'error' });
    }
  }, [setOscStatus, showToast, updateNestedPreference]);

  const handleOscRateLimitChange = useCallback(async (rateLimit) => {
    try {
      const result = await window.electronAPI?.osc?.setRateLimit(Number.parseInt(rateLimit, 10));
      if (!result?.success) throw new Error(result?.error || 'Could not update OSC rate limit');
      setOscStatus((previous) => ({ ...previous, rateLimit: result.rateLimit }));
      updateNestedPreference('externalControl', 'osc', 'rateLimit', result.rateLimit);
    } catch (error) {
      showToast?.({ title: 'OSC setting failed', message: error.message, variant: 'error' });
    }
  }, [setOscStatus, showToast, updateNestedPreference]);

  return {
    handleOscFeedbackPortChange,
    handleOscFeedbackToggle,
    handleOscAllowedSourcesChange,
    handleOscPortChange,
    handleOscRateLimitChange,
    handleOscRemoteAccessToggle,
    handleOscToggle,
  };
};
