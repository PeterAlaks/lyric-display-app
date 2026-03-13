import React from 'react';

const useOutputSettings = ({
  emitStyleUpdate,
}) => {
  const [activeTab, setActiveTab] = React.useState(() => {
    try {
      const saved = localStorage.getItem('lyricdisplay_activeOutputTab');
      if (saved && (saved.startsWith('output') || saved === 'stage')) return saved;
      return 'output1';
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

  return { activeTab, setActiveTab };
};

export default useOutputSettings;
