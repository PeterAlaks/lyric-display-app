import React from 'react';
import useLyricsStore from '../../context/LyricsStore';
import { readPersistentStorageItem, writePersistentStorageItem } from '../../utils/persistentStorage';

const useOutputSettings = ({
  availableTabs = ['output1', 'output2', 'stage'],
}) => {
  const [hasHydrated, setHasHydrated] = React.useState(() => {
    try {
      return useLyricsStore.persist?.hasHydrated?.() ?? true;
    } catch {
      return true;
    }
  });

  React.useEffect(() => {
    const persistApi = useLyricsStore.persist;
    if (!persistApi) return;

    if (persistApi.hasHydrated?.()) {
      setHasHydrated(true);
    }

    const unsubStart = persistApi.onHydrate?.(() => setHasHydrated(false));
    const unsubFinish = persistApi.onFinishHydration?.(() => setHasHydrated(true));

    return () => {
      if (typeof unsubStart === 'function') unsubStart();
      if (typeof unsubFinish === 'function') unsubFinish();
    };
  }, []);

  const isPotentialTab = React.useCallback((tab) => {
    return typeof tab === 'string' && (tab === 'stage' || tab.startsWith('output'));
  }, []);

  const getFallbackTab = React.useCallback(() => {
    if (availableTabs.includes('output1')) return 'output1';
    if (availableTabs.length > 0) return availableTabs[0];
    return 'output1';
  }, [availableTabs]);

  const isValidTab = React.useCallback((tab) => {
    return typeof tab === 'string' && availableTabs.includes(tab);
  }, [availableTabs]);

  const [activeTab, setActiveTab] = React.useState(() => {
    const fallbackTab = availableTabs.includes('output1') ? 'output1' : (availableTabs[0] || 'output1');

    try {
      const saved = readPersistentStorageItem('lyricdisplay_activeOutputTab');
      if (isPotentialTab(saved)) return saved;
      return fallbackTab;
    } catch {
      return fallbackTab;
    }
  });

  const resolvedActiveTab = React.useMemo(() => {
    if (isValidTab(activeTab)) return activeTab;
    if (!hasHydrated && isPotentialTab(activeTab)) return activeTab;
    return getFallbackTab();
  }, [activeTab, getFallbackTab, hasHydrated, isPotentialTab, isValidTab]);

  React.useEffect(() => {
    if (!hasHydrated) return;
    if (activeTab !== resolvedActiveTab) {
      setActiveTab(resolvedActiveTab);
    }
  }, [activeTab, hasHydrated, resolvedActiveTab]);

  React.useEffect(() => {
    if (!hasHydrated) return;
    if (!isValidTab(resolvedActiveTab)) return;
    try {
      writePersistentStorageItem('lyricdisplay_activeOutputTab', resolvedActiveTab);
    } catch (error) {
      console.warn('Failed to persist active tab:', error);
    }
  }, [hasHydrated, isValidTab, resolvedActiveTab]);

  return { activeTab: resolvedActiveTab, setActiveTab };
};

export default useOutputSettings;
