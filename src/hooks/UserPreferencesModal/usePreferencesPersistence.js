import { useCallback, useEffect, useRef, useState } from 'react';
import useLyricsStore, { loadPreferencesIntoStore } from '../../context/LyricsStore';
import { loadAdvancedSettings } from '../../utils/connectionManager';
import { loadDebugLoggingPreference } from '../../utils/logger';
import { LIVE_SAFETY_PREFERENCE_EVENT } from '../useLiveSafetyBridge';
import { normalizeLyricsParsingOptions } from '../../../shared/lyricsParsing.js';
import { requestLyricsReloadWithCurrentParser } from '../../utils/lyricsReloadEvents.js';

export const usePreferencesPersistence = ({ showToast }) => {
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [saveError, setSaveError] = useState(false);
  const [midiStatus, setMidiStatus] = useState(null);
  const [oscStatus, setOscStatus] = useState(null);
  const saveTimeoutRef = useRef(null);
  const confirmationTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);
  const pendingPreferencesRef = useRef(null);
  const savePreferencesRef = useRef(null);
  const lyricsLayoutChangedRef = useRef(false);
  const showToastRef = useRef(showToast);

  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  useEffect(() => {
    if (!preferences) return;
    useLyricsStore.getState().setLyricsParsingOptions(normalizeLyricsParsingOptions({
      enableSplitting: preferences.lineSplitting?.enabled,
      splitConfig: preferences.lineSplitting,
      groupingConfig: preferences.parsing,
    }));
  }, [preferences?.lineSplitting, preferences?.parsing]);

  useEffect(() => {
    isMountedRef.current = true;

    const loadPreferences = async () => {
      if (isMountedRef.current) setLoading(true);
      try {
        if (window.electronAPI?.preferences?.getAll) {
          const result = await window.electronAPI.preferences.getAll();
          if (result.success && isMountedRef.current) {
            setPreferences(result.preferences);
          }
        }

        if (window.electronAPI?.externalControl?.getStatus) {
          const statusResult = await window.electronAPI.externalControl.getStatus();
          if (statusResult.success && isMountedRef.current) {
            setMidiStatus(statusResult.midi);
            setOscStatus(statusResult.osc);
          }
        }
      } catch (error) {
        console.error('Failed to load preferences:', error);
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    };

    loadPreferences();

    return () => {
      isMountedRef.current = false;

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }

      const pendingPreferences = pendingPreferencesRef.current;
      pendingPreferencesRef.current = null;
      if (pendingPreferences) {
        if (savePreferencesRef.current) {
          void savePreferencesRef.current(pendingPreferences);
        } else if (window.electronAPI?.preferences?.saveAll) {
          void window.electronAPI.preferences.saveAll(pendingPreferences).catch((error) => {
            console.error('Failed to flush preferences while closing:', error);
          });
        }
      }

      if (confirmationTimeoutRef.current) clearTimeout(confirmationTimeoutRef.current);

      if (lyricsLayoutChangedRef.current) {
        const hasLoadedLyrics = (useLyricsStore.getState().lyrics?.length || 0) > 0;
        showToastRef.current?.({
          title: 'Lyrics parsing updated',
          message: hasLoadedLyrics
            ? 'Apply changes to this song?'
            : 'Applies on the next lyric load.',
          variant: 'info',
          duration: 6500,
          dedupeKey: 'lyrics-parsing-settings-changed',
          actions: hasLoadedLyrics
            ? [{ label: 'Reload Lyrics', onClick: requestLyricsReloadWithCurrentParser }]
            : [],
        });
      }
    };
  }, []);

  const savePreferences = useCallback(async (newPreferences) => {
    if (isMountedRef.current) {
      setSaving(true);
      setSaveError(false);
    }
    try {
      if (!window.electronAPI?.preferences?.saveAll) {
        throw new Error('Preferences API is unavailable');
      }

      const result = await window.electronAPI.preferences.saveAll(newPreferences);
      if (!result?.success) {
        throw new Error(result?.error || 'Preference save was rejected');
      }

      if (isMountedRef.current) {
        setLastSaved(new Date());
        setSaveError(false);
      }

      await loadPreferencesIntoStore(useLyricsStore);
      await loadAdvancedSettings();
      await loadDebugLoggingPreference();

      if (isMountedRef.current) {
        if (confirmationTimeoutRef.current) clearTimeout(confirmationTimeoutRef.current);
        confirmationTimeoutRef.current = setTimeout(() => {
          setLastSaved(null);
        }, 3000);
      }
    } catch (error) {
      console.error('Failed to save preferences:', error);
      if (isMountedRef.current) {
        setLastSaved(null);
        setSaveError(true);
      }
    } finally {
      if (isMountedRef.current) setSaving(false);
    }
  }, []);

  useEffect(() => {
    savePreferencesRef.current = savePreferences;
  }, [savePreferences]);

  const updatePreference = useCallback((category, key, value) => {
    setPreferences(prev => {
      if (Object.is(prev?.[category]?.[key], value)) return prev;

      const newPreferences = {
        ...prev,
        [category]: {
          ...prev[category],
          [key]: value
        }
      };

      pendingPreferencesRef.current = newPreferences;
      if (category === 'parsing' || category === 'lineSplitting') {
        lyricsLayoutChangedRef.current = true;
      }

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveTimeoutRef.current = null;
        if (pendingPreferencesRef.current === newPreferences) {
          pendingPreferencesRef.current = null;
        }
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

  const updatePreferenceGroup = useCallback((category, values) => {
    if (!values || typeof values !== 'object' || Array.isArray(values)) return;

    setPreferences((prev) => {
      const hasChanges = Object.entries(values).some(
        ([key, value]) => !Object.is(prev?.[category]?.[key], value)
      );
      if (!hasChanges) return prev;

      const newPreferences = {
        ...prev,
        [category]: {
          ...prev?.[category],
          ...values,
        },
      };

      pendingPreferencesRef.current = newPreferences;
      if (category === 'parsing' || category === 'lineSplitting') {
        lyricsLayoutChangedRef.current = true;
      }

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveTimeoutRef.current = null;
        if (pendingPreferencesRef.current === newPreferences) {
          pendingPreferencesRef.current = null;
        }
        savePreferences(newPreferences);
      }, 300);

      return newPreferences;
    });
  }, [savePreferences]);

  const updateNestedPreference = useCallback((category, subcategory, key, value) => {
    setPreferences(prev => {
      if (Object.is(prev?.[category]?.[subcategory]?.[key], value)) return prev;

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

      pendingPreferencesRef.current = newPreferences;

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveTimeoutRef.current = null;
        if (pendingPreferencesRef.current === newPreferences) {
          pendingPreferencesRef.current = null;
        }
        savePreferences(newPreferences);
      }, 300);

      return newPreferences;
    });
  }, [savePreferences]);

  const handleResetCategory = useCallback(async (category) => {
    try {
      if (window.electronAPI?.preferences?.resetCategory) {
        if (category === 'parsing' || category === 'lineSplitting') {
          lyricsLayoutChangedRef.current = true;
        }

        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = null;
        }
        const pendingPreferences = pendingPreferencesRef.current;
        pendingPreferencesRef.current = null;
        if (pendingPreferences) {
          await savePreferences(pendingPreferences);
        }

        await window.electronAPI.preferences.resetCategory(category);
        const result = await window.electronAPI.preferences.getAll();
        if (result.success) {
          if (isMountedRef.current) setPreferences(result.preferences);
          await loadPreferencesIntoStore(useLyricsStore);
          await loadAdvancedSettings();
          await loadDebugLoggingPreference();
          if (isMountedRef.current) {
            setLastSaved(new Date());
            if (confirmationTimeoutRef.current) clearTimeout(confirmationTimeoutRef.current);
            confirmationTimeoutRef.current = setTimeout(() => {
              setLastSaved(null);
            }, 3000);
          }
        }
      }
    } catch (error) {
      console.error('Failed to reset category:', error);
    }
  }, [savePreferences]);

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
    saveError,
    saving,
    setMidiStatus,
    setOscStatus,
    setPreferences,
    updateNestedPreference,
    updatePreference,
    updatePreferenceGroup,
  };
};
