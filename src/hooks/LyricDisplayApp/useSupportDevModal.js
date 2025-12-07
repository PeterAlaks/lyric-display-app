import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY = 'lyricdisplay_support_dev_modal';
const MIN_ACTIONS_BEFORE_SHOW = 50;
const MIN_TIME_BEFORE_SHOW = 5 * 60 * 1000;
const MIN_INTERVAL_BETWEEN_SHOWS = 7 * 24 * 60 * 60 * 1000;
const ACTION_THRESHOLD_MIN = 30;
const ACTION_THRESHOLD_MAX = 80;


const TRACKED_ACTIONS = [
  'song_loaded',
  'lyrics_edited',
  'output_opened',
  'settings_changed',
  'search_performed',
  'file_saved',
  'template_applied',
];

function getStoredData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (error) {
    console.error('Failed to parse support dev modal data:', error);
    return null;
  }
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save support dev modal data:', error);
  }
}

function initializeData() {
  const existing = getStoredData();
  if (existing) return existing;

  const data = {
    firstInstallTime: Date.now(),
    lastShownTime: null,
    actionCount: 0,
    nextShowThreshold: Math.floor(
      Math.random() * (ACTION_THRESHOLD_MAX - ACTION_THRESHOLD_MIN + 1) + ACTION_THRESHOLD_MIN
    ),
    totalShows: 0,
  };

  saveData(data);
  return data;
}

export function useSupportDevModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState(() => initializeData());
  const hasCheckedInitialShow = useRef(false);

  const checkShouldShow = useCallback(() => {
    const currentData = getStoredData() || data;
    const now = Date.now();

    if (currentData.lastShownTime) {
      const timeSinceLastShow = now - currentData.lastShownTime;
      if (timeSinceLastShow < MIN_INTERVAL_BETWEEN_SHOWS) {
        return false;
      }
    }

    const timeSinceInstall = now - currentData.firstInstallTime;
    if (timeSinceInstall < MIN_TIME_BEFORE_SHOW) {
      return false;
    }

    if (currentData.actionCount < MIN_ACTIONS_BEFORE_SHOW) {
      return false;
    }

    if (currentData.actionCount >= currentData.nextShowThreshold) {
      return true;
    }

    return false;
  }, [data]);

  const trackAction = useCallback((actionType) => {
    if (!TRACKED_ACTIONS.includes(actionType)) return;

    const currentData = getStoredData() || data;
    const newActionCount = currentData.actionCount + 1;

    const updatedData = {
      ...currentData,
      actionCount: newActionCount,
    };

    setData(updatedData);
    saveData(updatedData);

    if (checkShouldShow()) {
      setIsOpen(true);
    }
  }, [data, checkShouldShow]);

  const openModal = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);

    const currentData = getStoredData() || data;
    const updatedData = {
      ...currentData,
      lastShownTime: Date.now(),
      actionCount: 0,
      nextShowThreshold: Math.floor(
        Math.random() * (ACTION_THRESHOLD_MAX - ACTION_THRESHOLD_MIN + 1) + ACTION_THRESHOLD_MIN
      ),
      totalShows: currentData.totalShows + 1,
    };

    setData(updatedData);
    saveData(updatedData);
  }, [data]);

  useEffect(() => {
    if (hasCheckedInitialShow.current) return;
    hasCheckedInitialShow.current = true;

    const timer = setTimeout(() => {
      if (checkShouldShow()) {
        const randomDelay = Math.random() * 30000;
        setTimeout(() => {
          setIsOpen(true);
        }, randomDelay);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [checkShouldShow]);

  return {
    isOpen,
    openModal,
    closeModal,
    trackAction,
  };
}

export default useSupportDevModal;