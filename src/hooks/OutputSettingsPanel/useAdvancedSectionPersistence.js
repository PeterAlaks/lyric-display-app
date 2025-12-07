import { useEffect, useState } from 'react';

const useAdvancedSectionPersistence = (storageKeyPrefix) => {
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
    setTransitionAdvancedExpanded
  };
};

export default useAdvancedSectionPersistence;