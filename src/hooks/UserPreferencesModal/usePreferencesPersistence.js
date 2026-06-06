import { useCallback, useEffect, useRef, useState } from 'react';
import useLyricsStore, { loadPreferencesIntoStore } from '../../context/LyricsStore';
import { loadAdvancedSettings } from '../../utils/connectionManager';
import { loadDebugLoggingPreference } from '../../utils/logger';
import { LIVE_SAFETY_PREFERENCE_EVENT } from '../useLiveSafetyBridge';

export const usePreferencesPersistence = ({ showToast }) => {
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [midiStatus, setMidiStatus] = useState(null);
  const [oscStatus, setOscStatus] = useState(null);
  const saveTimeoutRef = useRef(null);
  const confirmationTimeoutRef = useRef(null);

  useEffect(() => {
    const loadPreferences = async () => {
      setLoading(true);
      try {
        if (window.electronAPI?.preferences?.getAll) {
          const result = await window.electronAPI.preferences.getAll();
          if (result.success) {
            setPreferences(result.preferences);
          }
        }

        if (window.electronAPI?.externalControl?.getStatus) {
          const statusResult = await window.electronAPI.externalControl.getStatus();
          if (statusResult.success) {
            setMidiStatus(statusResult.midi);
            setOscStatus(statusResult.osc);
          }
        }
      } catch (error) {
        console.error('Failed to load preferences:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (confirmationTimeoutRef.current) clearTimeout(confirmationTimeoutRef.current);
    };
  }, []);

  const savePreferences = useCallback(async (newPreferences) => {
    setSaving(true);
    try {
      if (window.electronAPI?.preferences?.saveAll) {
        const result = await window.electronAPI.preferences.saveAll(newPreferences);
        if (result.success) {
          setLastSaved(new Date());

          await loadPreferencesIntoStore(useLyricsStore);
          await loadAdvancedSettings();
          await loadDebugLoggingPreference();

          if (confirmationTimeoutRef.current) clearTimeout(confirmationTimeoutRef.current);
          confirmationTimeoutRef.current = setTimeout(() => {
            setLastSaved(null);
          }, 3000);
        }
      }
    } catch (error) {
      console.error('Failed to save preferences:', error);
    } finally {
      setSaving(false);
    }
  }, []);

  const updatePreference = useCallback((category, key, value) => {
    setPreferences(prev => {
      const newPreferences = {
        ...prev,
        [category]: {
          ...prev[category],
          [key]: value
        }
      };

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        savePreferences(newPreferences);
      }, 300);

      return newPreferences;
    });

    if (category === 'parsing' && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('parsing-preferences-updated', {
        detail: { [key]: value }
      }));
    }
  }, [savePreferences]);

  const updateNestedPreference = useCallback((category, subcategory, key, value) => {
    setPreferences(prev => {
      const newPreferences = {
        ...prev,
        [category]: {
          ...prev[category],
          [subcategory]: {
            ...prev[category]?.[subcategory],
            [key]: value
          }
        }
      };

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        savePreferences(newPreferences);
      }, 300);

      return newPreferences;
    });
  }, [savePreferences]);

  const handleResetCategory = useCallback(async (category) => {
    try {
      if (window.electronAPI?.preferences?.resetCategory) {
        await window.electronAPI.preferences.resetCategory(category);
        const result = await window.electronAPI.preferences.getAll();
        if (result.success) {
          setPreferences(result.preferences);
          await loadPreferencesIntoStore(useLyricsStore);
          await loadAdvancedSettings();
          await loadDebugLoggingPreference();
          setLastSaved(new Date());
          if (confirmationTimeoutRef.current) clearTimeout(confirmationTimeoutRef.current);
          confirmationTimeoutRef.current = setTimeout(() => {
            setLastSaved(null);
          }, 3000);
        }
      }
    } catch (error) {
      console.error('Failed to reset category:', error);
    }
  }, []);

  useEffect(() => {
    const handleLiveSafetyPreferenceUpdated = (event) => {
      const enabled = event?.detail?.enabled;
      if (typeof enabled !== 'boolean') return;

      setPreferences((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          general: {
            ...prev.general,
            liveSafetyMode: enabled,
          },
        };
      });
    };

    window.addEventListener(LIVE_SAFETY_PREFERENCE_EVENT, handleLiveSafetyPreferenceUpdated);
    return () => window.removeEventListener(LIVE_SAFETY_PREFERENCE_EVENT, handleLiveSafetyPreferenceUpdated);
  }, []);

  useEffect(() => {
    const handleParsingPreferencesUpdated = (event) => {
      const parsing = event?.detail;
      if (!parsing || typeof parsing !== 'object') return;
      setPreferences((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          parsing: {
            ...prev.parsing,
            ...parsing,
          }
        };
      });
    };

    window.addEventListener('parsing-preferences-updated', handleParsingPreferencesUpdated);
    return () => window.removeEventListener('parsing-preferences-updated', handleParsingPreferencesUpdated);
  }, []);

  useEffect(() => {
    const handleTutorialPreferenceUpdated = (event) => {
      const value = event?.detail?.showTutorialPopovers;
      if (typeof value !== 'boolean') return;

      setPreferences((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          appearance: {
            ...prev.appearance,
            showTutorialPopovers: value,
          },
        };
      });
    };

    window.addEventListener('tutorial-popovers-preference-updated', handleTutorialPreferenceUpdated);
    return () => window.removeEventListener('tutorial-popovers-preference-updated', handleTutorialPreferenceUpdated);
  }, []);

  const handleBrowseDefaultPath = useCallback(async () => {
    try {
      if (window.electronAPI?.preferences?.browseDefaultPath) {
        const result = await window.electronAPI.preferences.browseDefaultPath();
        if (result.success && result.path) {
          updatePreference('fileHandling', 'defaultLyricsPath', result.path);
        }
      }
    } catch (error) {
      console.error('Failed to browse for path:', error);
    }
  }, [updatePreference]);

  return {
    handleBrowseDefaultPath,
    handleResetCategory,
    lastSaved,
    loading,
    midiStatus,
    oscStatus,
    preferences,
    saving,
    setMidiStatus,
    setOscStatus,
    setPreferences,
    updateNestedPreference,
    updatePreference,
  };
};
