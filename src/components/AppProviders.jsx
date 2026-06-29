import React, { useEffect } from 'react';
import useLyricsStore, { loadPreferencesIntoStore } from '../context/LyricsStore';
import { useDarkModeState } from '../hooks/useStoreSelectors';
import { loadAdvancedSettings } from '../utils/connectionManager';
import { loadDebugLoggingPreference } from '../utils/logger';
import { ToastProvider } from './toast/ToastProvider';
import { ModalProvider } from './modal/ModalProvider';
import { REQUEST_MODAL_CLOSE_EVENT } from '../constants/modalEvents';

export default function AppProviders({ children, effectiveDarkMode, isDockRuntime }) {
  const { setDarkMode } = useDarkModeState();

  useEffect(() => {
    if (!window.electronAPI) return;

    loadPreferencesIntoStore(useLyricsStore);
    loadAdvancedSettings();
    loadDebugLoggingPreference();
  }, []);

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onThemeUpdated?.((payload) => {
      if (typeof payload?.darkMode === 'boolean') {
        setDarkMode(payload.darkMode);
      }
    });

    return () => unsubscribe?.();
  }, [setDarkMode]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key !== 'lyrics-store' || !event.newValue) return;
      try {
        const nextState = JSON.parse(event.newValue)?.state;
        if (nextState?.timerDisplaySettings && typeof nextState.timerDisplaySettings === 'object') {
          useLyricsStore.getState().updateTimerDisplaySettings(nextState.timerDisplaySettings, { touch: false });
        }
        if (nextState?.timerControlSettings && typeof nextState.timerControlSettings === 'object') {
          useLyricsStore.getState().updateTimerControlSettings(nextState.timerControlSettings, { touch: false });
        }
      } catch {
        // Ignore malformed persisted store updates.
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    const handleGlobalEscape = (event) => {
      if (event.key !== 'Escape' || event.repeat) return;

      const detail = { candidates: [] };
      window.dispatchEvent(new CustomEvent(REQUEST_MODAL_CLOSE_EVENT, { detail }));

      const candidates = Array.isArray(detail.candidates) ? detail.candidates : [];
      if (candidates.length === 0) return;

      let selected = null;
      candidates.forEach((candidate, idx) => {
        if (!candidate || typeof candidate.close !== 'function') return;
        const priority = Number.isFinite(candidate.priority) ? candidate.priority : 0;
        if (!selected || priority > selected.priority || (priority === selected.priority && idx > selected.idx)) {
          selected = { close: candidate.close, priority, idx };
        }
      });

      if (!selected) return;

      try {
        selected.close();
      } catch (error) {
        console.error('Failed to close modal on Escape:', error);
      }
      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener('keydown', handleGlobalEscape, true);
    return () => window.removeEventListener('keydown', handleGlobalEscape, true);
  }, []);

  return (
    <ModalProvider isDark={!!effectiveDarkMode}>
      <ToastProvider
        isDark={!!effectiveDarkMode}
        density={isDockRuntime ? 'dock' : 'default'}
        position={isDockRuntime ? 'top-right' : 'bottom-right'}
        offset={isDockRuntime ? 8 : 32}
      >
        {children}
      </ToastProvider>
    </ModalProvider>
  );
}
