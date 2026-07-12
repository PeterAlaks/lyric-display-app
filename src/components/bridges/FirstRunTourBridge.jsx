import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import useLyricsStore from '../../context/LyricsStore';
import { useDarkModeState } from '../../hooks/useStoreSelectors';
import { START_FIRST_RUN_TOUR_EVENT } from '../../utils/firstRunTour';
import FirstRunTour from '../FirstRunTour';

const FIRST_RUN_DELAY_MS = 900;

export default function FirstRunTourBridge() {
  const hasSeenWelcome = useLyricsStore((state) => state.hasSeenWelcome);
  const setHasSeenWelcome = useLyricsStore((state) => state.setHasSeenWelcome);
  const { darkMode } = useDarkModeState();
  const [tourSession, setTourSession] = useState(null);
  const location = useLocation();
  const isControlPanel = location.pathname === '/';

  useEffect(() => {
    const startTour = () => setTourSession(Date.now());
    window.addEventListener(START_FIRST_RUN_TOUR_EVENT, startTour);
    return () => window.removeEventListener(START_FIRST_RUN_TOUR_EVENT, startTour);
  }, []);

  useEffect(() => {
    if (hasSeenWelcome || !window.electronAPI || tourSession || !isControlPanel) return undefined;

    const timer = window.setTimeout(() => setTourSession(Date.now()), FIRST_RUN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [hasSeenWelcome, isControlPanel, tourSession]);

  const closeAndRemember = useCallback(() => {
    setHasSeenWelcome(true);
    setTourSession(null);
  }, [setHasSeenWelcome]);

  if (!tourSession) return null;

  return (
    <FirstRunTour
      key={tourSession}
      darkMode={darkMode}
      onFinish={closeAndRemember}
      onSkip={closeAndRemember}
    />
  );
}
