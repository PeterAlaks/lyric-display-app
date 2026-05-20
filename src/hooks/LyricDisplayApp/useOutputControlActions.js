import { useCallback } from 'react';

export const useOutputControlActions = ({
  allOutputIds,
  emitLineUpdate,
  emitOutputToggle,
  isAuthenticated,
  isConnected,
  isOutputOn,
  ready,
  scrollableSettingsRef,
  selectLine,
  setActiveTab,
  setIsOutputOn,
  showToast,
  trackAction,
}) => {
  const handleToggle = useCallback(() => {
    if (!isConnected || !isAuthenticated || !ready) {
      showToast({
        title: 'Connection Required',
        message: 'Cannot control output - not connected or authenticated.',
        variant: 'warning'
      });
      return;
    }

    setIsOutputOn(!isOutputOn);
    emitOutputToggle(!isOutputOn);
    if (!isOutputOn) {
      trackAction('output_opened');
    }
  }, [emitOutputToggle, isAuthenticated, isConnected, isOutputOn, ready, setIsOutputOn, showToast, trackAction]);

  const handleClearOutput = useCallback(() => {
    selectLine(null);
    emitLineUpdate(null);
  }, [emitLineUpdate, selectLine]);

  const handleOutputTabSwitch = useCallback((tab) => {
    if (tab === 'stage') {
      setActiveTab(tab);
      if (scrollableSettingsRef.current) {
        scrollableSettingsRef.current.scrollTop = 0;
      }
      return;
    }
    if (!tab.startsWith('output') || !allOutputIds.includes(tab)) return;
    setActiveTab(tab);
    if (scrollableSettingsRef.current) {
      scrollableSettingsRef.current.scrollTop = 0;
    }
  }, [allOutputIds, scrollableSettingsRef, setActiveTab]);

  return { handleClearOutput, handleOutputTabSwitch, handleToggle };
};
