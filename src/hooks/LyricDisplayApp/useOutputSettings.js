import React from 'react';

const useOutputSettings = ({
  output1Settings,
  output2Settings,
  stageSettings,
  updateOutputSettings,
  emitStyleUpdate,
}) => {
  const [activeTab, setActiveTab] = React.useState(() => {
    try {
      const saved = localStorage.getItem('lyricdisplay_activeOutputTab');
      return (saved === 'output1' || saved === 'output2' || saved === 'stage') ? saved : 'output1';
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

  const getCurrentSettings = React.useCallback(() => {
    if (activeTab === 'output1') return output1Settings;
    if (activeTab === 'output2') return output2Settings;
    if (activeTab === 'stage') return stageSettings;
    return output1Settings;
  }, [activeTab, output1Settings, output2Settings, stageSettings]);

  const updateSettings = React.useCallback((newSettings) => {
    const outputKey = activeTab === 'output1' ? 'output1' : activeTab === 'output2' ? 'output2' : 'stage';
    updateOutputSettings(outputKey, newSettings);
    emitStyleUpdate(outputKey, newSettings);
  }, [activeTab, updateOutputSettings, emitStyleUpdate]);

  return { activeTab, setActiveTab, getCurrentSettings, updateSettings };
};

export default useOutputSettings;