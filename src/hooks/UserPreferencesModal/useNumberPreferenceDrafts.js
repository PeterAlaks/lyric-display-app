import { useCallback, useState } from 'react';

export const useNumberPreferenceDrafts = ({ preferences, updatePreference }) => {
  const [numberDrafts, setNumberDrafts] = useState({});

  const getNumberDraftKey = useCallback((category, key) => `${category}.${key}`, []);

  const getNumberInputValue = useCallback((category, key, fallbackValue) => {
    const draftKey = getNumberDraftKey(category, key);
    if (Object.prototype.hasOwnProperty.call(numberDrafts, draftKey)) {
      return numberDrafts[draftKey];
    }

    const prefValue = preferences?.[category]?.[key];
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

  const commitNumberPreference = useCallback((category, key, options = {}, customCommit) => {
    const {
      min,
      max,
      fallbackValue,
      parse = 'int',
    } = options;

    const draftKey = getNumberDraftKey(category, key);
    if (!Object.prototype.hasOwnProperty.call(numberDrafts, draftKey)) return;

    const rawValue = numberDrafts[draftKey];
    const parsedValue = parse === 'float'
      ? parseFloat(rawValue)
      : parseInt(rawValue, 10);

    let normalized = Number.isFinite(parsedValue) ? parsedValue : fallbackValue;
    if (typeof min === 'number') normalized = Math.max(min, normalized);
    if (typeof max === 'number') normalized = Math.min(max, normalized);

    const currentValue = preferences?.[category]?.[key];
    if (currentValue !== normalized) {
      if (typeof customCommit === 'function') {
        customCommit(normalized);
      } else {
        updatePreference(category, key, normalized);
      }
    }

    setNumberDrafts((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, draftKey)) return prev;
      const next = { ...prev };
      delete next[draftKey];
      return next;
    });
  }, [getNumberDraftKey, numberDrafts, preferences, updatePreference]);

  const handleNumberInputKeyDown = useCallback((event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur();
    }
  }, []);

  return {
    commitNumberPreference,
    getNumberInputValue,
    handleNumberInputKeyDown,
    setNumberInputDraft,
  };
};
