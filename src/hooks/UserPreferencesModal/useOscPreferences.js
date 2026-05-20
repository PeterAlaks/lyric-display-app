import { useCallback } from 'react';

export const useOscPreferences = ({ oscStatus, setOscStatus, updateNestedPreference }) => {
  const handleOscToggle = useCallback(async () => {
    try {
      if (oscStatus?.enabled) {
        await window.electronAPI?.osc?.disable();
        setOscStatus(prev => ({ ...prev, enabled: false }));
        updateNestedPreference('externalControl', 'osc', 'enabled', false);
      } else {
        await window.electronAPI?.osc?.enable();
        setOscStatus(prev => ({ ...prev, enabled: true }));
        updateNestedPreference('externalControl', 'osc', 'enabled', true);
      }
    } catch (error) {
      console.error('Failed to toggle OSC:', error);
    }
  }, [oscStatus?.enabled, setOscStatus, updateNestedPreference]);

  const handleOscPortChange = useCallback(async (port) => {
    try {
      const result = await window.electronAPI?.osc?.setPort(parseInt(port));
      if (result.success) {
        setOscStatus(prev => ({ ...prev, port: parseInt(port) }));
        updateNestedPreference('externalControl', 'osc', 'port', parseInt(port));
      }
    } catch (error) {
      console.error('Failed to set OSC port:', error);
    }
  }, [setOscStatus, updateNestedPreference]);

  const handleOscFeedbackPortChange = useCallback(async (port) => {
    try {
      const result = await window.electronAPI?.osc?.setFeedbackPort(parseInt(port));
      if (result.success) {
        setOscStatus(prev => ({ ...prev, feedbackPort: parseInt(port) }));
        updateNestedPreference('externalControl', 'osc', 'feedbackPort', parseInt(port));
      }
    } catch (error) {
      console.error('Failed to set OSC feedback port:', error);
    }
  }, [setOscStatus, updateNestedPreference]);

  const handleOscFeedbackToggle = useCallback(async () => {
    try {
      const newValue = !oscStatus?.feedbackEnabled;
      await window.electronAPI?.osc?.setFeedbackEnabled(newValue);
      setOscStatus(prev => ({ ...prev, feedbackEnabled: newValue }));
      updateNestedPreference('externalControl', 'osc', 'feedbackEnabled', newValue);
    } catch (error) {
      console.error('Failed to toggle OSC feedback:', error);
    }
  }, [oscStatus?.feedbackEnabled, setOscStatus, updateNestedPreference]);

  return {
    handleOscFeedbackPortChange,
    handleOscFeedbackToggle,
    handleOscPortChange,
    handleOscToggle,
  };
};
