import { useCallback, useState } from 'react';
import { normalizeNumberPreferenceValue } from './numberPreferenceValues.js';

export const useNumberPreferenceDrafts = ({ preferences, updatePreference }) => {
  const [numberDrafts, setNumberDrafts] = useState({});

  const getNumberDraftKey = useCallback((category, key) => `${category}.${key}`, []);

  const getNumberInputValue = useCallback((category, key, fallbackValue, currentValue) => {
    const draftKey = getNumberDraftKey(category, key);
    if (Object.prototype.hasOwnProperty.call(numberDrafts, draftKey)) {
      return numberDrafts[draftKey];
    }

    const prefValue = currentValue ?? preferences?.[category]?.[key];
    const resolved = prefValue ?? fallbackValue;
    return resolved === null || resolved === undefined ? '' : String(resolved);
  }, [getNumberDraftKey, numberDrafts, preferences]);

  const setNumberInputDraft = useCallback((category, key, value) => {
    const draftKey = getNumberDraftKey(category, key);
    setNumberDrafts((prev) => ({
      ...prev,
      [draftKey]: value,
    }));
  }, [getNumberDraftKey]);

  const persistNumberPreferenceValue = useCallback((category, key, rawValue, options, customCommit, useFallback = false) => {
    const normalized = normalizeNumberPreferenceValue(rawValue, options, useFallback);
    if (normalized === null) return;

    const savedValue = options.currentValue ?? preferences?.[category]?.[key];
    if (Object.is(savedValue, normalized)) return;

    if (typeof customCommit === 'function') {
      customCommit(normalized);
    } else {
      updatePreference(category, key, normalized);
    }
  }, [preferences, updatePreference]);

  const handleNumberInputChange = useCallback((category, key, value, options = {}, customCommit) => {
    setNumberInputDraft(category, key, value);
    persistNumberPreferenceValue(category, key, value, options, customCommit);
  }, [persistNumberPreferenceValue, setNumberInputDraft]);

  const commitNumberPreference = useCallback((category, key, options = {}, customCommit) => {
    const draftKey = getNumberDraftKey(category, key);
    if (!Object.prototype.hasOwnProperty.call(numberDrafts, draftKey)) return;

    const rawValue = numberDrafts[draftKey];
    persistNumberPreferenceValue(category, key, rawValue, options, customCommit, true);

    setNumberDrafts((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, draftKey)) return prev;
      const next = { ...prev };
      delete next[draftKey];
      return next;
    });
  }, [getNumberDraftKey, numberDrafts, persistNumberPreferenceValue]);

  const handleNumberInputKeyDown = useCallback((event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur();
    }
  }, []);

  const getNumberPreferenceInputProps = useCallback((category, key, options = {}, customCommit) => ({
    value: getNumberInputValue(category, key, options.fallbackValue, options.currentValue),
    onChange: (event) => handleNumberInputChange(category, key, event.target.value, options, customCommit),
    onBlur: () => commitNumberPreference(category, key, options, customCommit),
    onKeyDown: handleNumberInputKeyDown,
  }), [commitNumberPreference, getNumberInputValue, handleNumberInputChange, handleNumberInputKeyDown]);

  return {
    getNumberPreferenceInputProps,
  };
};
