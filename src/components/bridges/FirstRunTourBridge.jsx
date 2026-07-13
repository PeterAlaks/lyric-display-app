import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import useLyricsStore from '../../context/LyricsStore';
import { useDarkModeState } from '../../hooks/useStoreSelectors';
import useModal from '../../hooks/useModal';
import { shouldShowTelemetryConsent, START_FIRST_RUN_TOUR_EVENT } from '../../utils/firstRunTour';
import FirstRunTour from '../FirstRunTour';

const FIRST_RUN_DELAY_MS = 900;

export default function FirstRunTourBridge() {
  const hasSeenWelcome = useLyricsStore((state) => state.hasSeenWelcome);
  const setHasSeenWelcome = useLyricsStore((state) => state.setHasSeenWelcome);
  const { darkMode } = useDarkModeState();
  const { showModal } = useModal();
  const [tourSession, setTourSession] = useState(null);
  const [telemetryConsentDecided, setTelemetryConsentDecided] = useState(null);
  const [showTelemetryConsent, setShowTelemetryConsent] = useState(false);
  const location = useLocation();
  const isControlPanel = location.pathname === '/';

  useEffect(() => {
    const startTour = () => setTourSession(Date.now());
    window.addEventListener(START_FIRST_RUN_TOUR_EVENT, startTour);
    return () => window.removeEventListener(START_FIRST_RUN_TOUR_EVENT, startTour);
  }, []);

  useEffect(() => {
    if (!isControlPanel || !window.electronAPI?.preferences?.get) return undefined;
    let cancelled = false;

    window.electronAPI.preferences.get('advanced.telemetryConsentDecided')
      .then((result) => {
        if (!cancelled) setTelemetryConsentDecided(result?.success && result.value === true);
      })
      .catch(() => {
        if (!cancelled) setTelemetryConsentDecided(false);
      });

    return () => { cancelled = true; };
  }, [isControlPanel]);

  useEffect(() => {
    if (shouldShowTelemetryConsent({
      consentDecided: telemetryConsentDecided,
      hasSeenWelcome,
      isControlPanel,
      tourActive: Boolean(tourSession),
    })) {
      setShowTelemetryConsent(true);
    }
  }, [hasSeenWelcome, isControlPanel, telemetryConsentDecided, tourSession]);

  useEffect(() => {
    if (hasSeenWelcome || !window.electronAPI || tourSession || !isControlPanel) return undefined;

    const timer = window.setTimeout(() => setTourSession(Date.now()), FIRST_RUN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [hasSeenWelcome, isControlPanel, tourSession]);

  const closeAndRemember = useCallback(() => {
    setHasSeenWelcome(true);
    setTourSession(null);
  }, [setHasSeenWelcome]);

  const saveTelemetryDecision = useCallback(async (accepted) => {
    const preferences = window.electronAPI?.preferences;
    if (!preferences?.set) throw new Error('Preferences are unavailable. Please restart LyricDisplay.');

    const sharingResult = await preferences.set('advanced.shareAnonymousUsageData', accepted);
    if (!sharingResult?.success) throw new Error(sharingResult?.error || 'Your data-sharing choice could not be saved.');

    const decisionResult = await preferences.set('advanced.telemetryConsentDecided', true);
    if (!decisionResult?.success) throw new Error(decisionResult?.error || 'Your data-sharing choice could not be saved.');

    setTelemetryConsentDecided(true);
    setShowTelemetryConsent(false);
  }, []);

  useEffect(() => {
    if (!showTelemetryConsent) return;

    showModal({
      modalKey: 'telemetry-consent',
      title: 'Share anonymous usage data?',
      component: 'TelemetryConsent',
      variant: 'info',
      size: 'sm',
      customLayout: true,
      dismissible: false,
      actions: [],
      onDecision: saveTelemetryDecision,
    });
  }, [saveTelemetryDecision, showModal, showTelemetryConsent]);

  return (
    <>
      {tourSession && (
        <FirstRunTour
          key={tourSession}
          darkMode={darkMode}
          onFinish={closeAndRemember}
          onSkip={closeAndRemember}
        />
      )}
    </>
  );
}
