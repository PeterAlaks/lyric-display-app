import React from 'react';

const useOutputSettings = ({
  output1Settings,
  output2Settings,
  updateOutputSettings,
  emitStyleUpdate,
}) => {
  const [activeTab, setActiveTab] = React.useState(() => {
    try {
      const saved = localStorage.getItem('lyricdisplay_activeOutputTab');
      return (saved === 'output1' || saved === 'output2') ? saved : 'output1';
    } catch {
      return 'output1';
    }
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('lyricdisplay_activeOutputTab', activeTab);
    } catch (error) {
      console.warn('Failed to persist active tab:', error);
    }
  }, [activeTab]);

  const getCurrentSettings = React.useCallback(() => (
    activeTab === 'output1' ? output1Settings : output2Settings
  ), [activeTab, output1Settings, output2Settings]);

  const updateSettings = React.useCallback((newSettings) => {
    const outputKey = activeTab === 'output1' ? 'output1' : 'output2';
    updateOutputSettings(outputKey, newSettings);
    emitStyleUpdate(outputKey, newSettings);
  }, [activeTab, updateOutputSettings, emitStyleUpdate]);

  return { activeTab, setActiveTab, getCurrentSettings, updateSettings };
};

export default useOutputSettings;