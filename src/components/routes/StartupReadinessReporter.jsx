import { useEffect, useRef, useState } from 'react';
import { useControlSocket } from '../../context/ControlSocketProvider';

export default function StartupReadinessReporter() {
  const {
    authStatus,
    connectionStatus,
    getStartupTimings,
    isAuthenticated,
    ready,
  } = useControlSocket();
  const [fontStatus, setFontStatus] = useState('pending');
  const reportedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const waitForDocumentFonts = async () => {
      if (!document.fonts?.ready) {
        if (!cancelled) setFontStatus('unsupported');
        return;
      }

      try {
        await document.fonts.ready;
        if (cancelled) return;
        setFontStatus(document.fonts.status === 'loaded' ? 'loaded' : 'failed');
      } catch (error) {
        console.warn('[StartupReadiness] Document fonts failed to settle:', error);
        if (!cancelled) setFontStatus('failed');
      }
    };

    waitForDocumentFonts();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const signalStartupReady = window.electronAPI?.signalStartupReady;
    const fontSettled = fontStatus !== 'pending';
    if (
      reportedRef.current
      || typeof signalStartupReady !== 'function'
      || !fontSettled
      || !isAuthenticated
      || connectionStatus !== 'connected'
      || !ready
    ) {
      return;
    }

    reportedRef.current = true;
    signalStartupReady({
      authStatus,
      connectionStatus,
      fontStatus,
      ready,
      timings: {
        rendererReadyMs: typeof performance !== 'undefined' ? performance.now() : null,
        ...getStartupTimings(),
      },
    });
  }, [authStatus, connectionStatus, fontStatus, getStartupTimings, isAuthenticated, ready]);

  return null;
}
