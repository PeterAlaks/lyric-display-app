import { useState, useEffect } from 'react';

export const useSyncTimer = (lastSyncTime) => {
  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    if (!lastSyncTime) {
      setSecondsAgo(0);
      return;
    }

    const updateTimer = () => {
      setSecondsAgo(Math.floor((Date.now() - lastSyncTime) / 1000));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [lastSyncTime]);

  return secondsAgo;
};