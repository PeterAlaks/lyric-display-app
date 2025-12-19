import { useEffect, useMemo, useRef, useState } from 'react';

const useAdvancedSectionPersistence = (storageKeyPrefix, options = {}) => {
  const { autoOpenTriggers = {} } = options;

  const getKey = (key) => `${storageKeyPrefix}_${key}`;

  const [fontSizeAdvancedExpanded, setFontSizeAdvancedExpanded] = useState(() => {
    const stored = sessionStorage.getItem(getKey('fontSizeAdvancedExpanded'));
    return stored === 'true';
  });

  const [fontColorAdvancedExpanded, setFontColorAdvancedExpanded] = useState(() => {
    const stored = sessionStorage.getItem(getKey('fontColorAdvancedExpanded'));
    return stored === 'true';
  });

  const [dropShadowAdvancedExpanded, setDropShadowAdvancedExpanded] = useState(() => {
    const stored = sessionStorage.getItem(getKey('dropShadowAdvancedExpanded'));
    return stored === 'true';
  });

  const [backgroundAdvancedExpanded, setBackgroundAdvancedExpanded] = useState(() => {
    const stored = sessionStorage.getItem(getKey('backgroundAdvancedExpanded'));
    return stored === 'true';
  });

  const [transitionAdvancedExpanded, setTransitionAdvancedExpanded] = useState(() => {
    const stored = sessionStorage.getItem(getKey('transitionAdvancedExpanded'));
    return stored === 'true';
  });

  const [fullScreenAdvancedExpanded, setFullScreenAdvancedExpanded] = useState(() => {
    const stored = sessionStorage.getItem(getKey('fullScreenAdvancedExpanded'));
    return stored === 'true';
  });

  const stateMap = useMemo(() => ({
    fontSizeAdvancedExpanded,
    fontColorAdvancedExpanded,
    dropShadowAdvancedExpanded,
    backgroundAdvancedExpanded,
    transitionAdvancedExpanded,
    fullScreenAdvancedExpanded,
  }), [
    fontSizeAdvancedExpanded,
    fontColorAdvancedExpanded,
    dropShadowAdvancedExpanded,
    backgroundAdvancedExpanded,
    transitionAdvancedExpanded,
    fullScreenAdvancedExpanded
  ]);

  const setterMap = useMemo(() => ({
    fontSizeAdvancedExpanded: setFontSizeAdvancedExpanded,
    fontColorAdvancedExpanded: setFontColorAdvancedExpanded,
    dropShadowAdvancedExpanded: setDropShadowAdvancedExpanded,
    backgroundAdvancedExpanded: setBackgroundAdvancedExpanded,
    transitionAdvancedExpanded: setTransitionAdvancedExpanded,
    fullScreenAdvancedExpanded: setFullScreenAdvancedExpanded,
  }), []);

  useEffect(() => {
    sessionStorage.setItem(getKey('fontSizeAdvancedExpanded'), fontSizeAdvancedExpanded);
  }, [fontSizeAdvancedExpanded]);

  useEffect(() => {
    sessionStorage.setItem(getKey('fontColorAdvancedExpanded'), fontColorAdvancedExpanded);
  }, [fontColorAdvancedExpanded]);

  useEffect(() => {
    sessionStorage.setItem(getKey('dropShadowAdvancedExpanded'), dropShadowAdvancedExpanded);
  }, [dropShadowAdvancedExpanded]);

  useEffect(() => {
    sessionStorage.setItem(getKey('backgroundAdvancedExpanded'), backgroundAdvancedExpanded);
  }, [backgroundAdvancedExpanded]);

  useEffect(() => {
    sessionStorage.setItem(getKey('transitionAdvancedExpanded'), transitionAdvancedExpanded);
  }, [transitionAdvancedExpanded]);

  useEffect(() => {
    sessionStorage.setItem(getKey('fullScreenAdvancedExpanded'), fullScreenAdvancedExpanded);
  }, [fullScreenAdvancedExpanded]);

  const normalizedTriggers = useMemo(() => {
    const normalized = {};
    Object.entries(autoOpenTriggers || {}).forEach(([key, val]) => {
      normalized[key] = Boolean(val);
    });
    return normalized;
  }, [autoOpenTriggers]);

  const prevTriggersRef = useRef(normalizedTriggers);
  useEffect(() => {
    Object.entries(normalizedTriggers).forEach(([key, current]) => {
      const prev = prevTriggersRef.current?.[key] ?? false;
      if (current && !prev && stateMap[key] === false) {
        const setter = setterMap[key];
        if (setter) setter(true);
      }
    });
    prevTriggersRef.current = normalizedTriggers;
  }, [normalizedTriggers, stateMap, setterMap]);

  return {
    fontSizeAdvancedExpanded,
    setFontSizeAdvancedExpanded,
    fontColorAdvancedExpanded,
    setFontColorAdvancedExpanded,
    dropShadowAdvancedExpanded,
    setDropShadowAdvancedExpanded,
    backgroundAdvancedExpanded,
    setBackgroundAdvancedExpanded,
    transitionAdvancedExpanded,
    setTransitionAdvancedExpanded,
    fullScreenAdvancedExpanded,
    setFullScreenAdvancedExpanded
  };
};

export default useAdvancedSectionPersistence;