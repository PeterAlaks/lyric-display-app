import React from 'react';

const useOutputSettings = ({
  output1Settings,
  output2Settings,
  updateOutputSettings,
  emitStyleUpdate,
}) => {
  const [activeTab, setActiveTab] = React.useState('output1');

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
