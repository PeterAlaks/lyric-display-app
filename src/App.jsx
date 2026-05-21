import React, { useEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useDarkModeState, useIsDesktopApp } from './hooks/useStoreSelectors';
import useLyricsStore from './context/LyricsStore';
import { ToastProvider } from '@/components/toast/ToastProvider';
import { ModalProvider } from '@/components/modal/ModalProvider';
import { ControlSocketProvider } from './context/ControlSocketProvider';
import DesktopShell from './components/WindowChrome/DesktopShell';
import AppErrorBoundary from './components/AppErrorBoundary';
import PreferencesLoaderBridge from './components/bridges/PreferencesLoaderBridge';
import { REQUEST_MODAL_CLOSE_EVENT } from './constants/modalEvents';

const Router = import.meta.env.MODE === 'development' ? BrowserRouter : HashRouter;

const ControlPanel = React.lazy(() => import('./pages/ControlPanel'));
const Output1 = React.lazy(() => import('./pages/Output1'));
const Output2 = React.lazy(() => import('./pages/Output2'));
const Stage = React.lazy(() => import('./pages/Stage'));
const TimeDisplay = React.lazy(() => import('./pages/TimeDisplay'));
const OutputPage = React.lazy(() => import('./pages/OutputPage'));
const ObsSetup = React.lazy(() => import('./pages/ObsSetup'));
const NewSongCanvas = React.lazy(() => import('./components/NewSongCanvas'));
const TimerControlModule = React.lazy(() => import('./components/TimerControlModule'));

const ElectronModalBridge = React.lazy(() => import('./components/bridges/ElectronModalBridge'));
const JoinCodePromptBridge = React.lazy(() => import('./components/bridges/JoinCodePromptBridge'));
const NdiBridge = React.lazy(() => import('./components/bridges/NdiBridge'));
const NdiUpdaterBridge = React.lazy(() => import('./components/bridges/NdiUpdaterBridge'));
const QRCodeDialogBridge = React.lazy(() => import('./components/bridges/QRCodeDialogBridge'));
const ShortcutsHelpBridge = React.lazy(() => import('./components/bridges/ShortcutsHelpBridge'));
const SupportDevelopmentBridge = React.lazy(() => import('./components/bridges/SupportDevelopmentBridge'));
const UpdaterBridge = React.lazy(() => import('./components/bridges/UpdaterBridge'));
const WelcomeSplashBridge = React.lazy(() => import('./components/bridges/WelcomeSplashBridge'));

function ConditionalDesktopShell({ children }) {
  const isDesktopApp = useIsDesktopApp();

  if (isDesktopApp) {
    return <DesktopShell>{children}</DesktopShell>;
  }

  return <>{children}</>;
}

function MainWindowBridges() {
  return (
    <React.Suspense fallback={null}>
      <NdiBridge />
      <ElectronModalBridge />
      <JoinCodePromptBridge />
      <WelcomeSplashBridge />
      <UpdaterBridge />
      <NdiUpdaterBridge />
      <QRCodeDialogBridge />
      <ShortcutsHelpBridge />
      <SupportDevelopmentBridge />
    </React.Suspense>
  );
}

function AppRoutes() {
  const location = useLocation();
  const isMainWindowRoute = location.pathname === '/' || location.pathname.startsWith('/new-song');

  return (
    <>
      {isMainWindowRoute && <MainWindowBridges />}
      <React.Suspense fallback={null}>
        <Routes>
          <Route path="/" element={
            <ConditionalDesktopShell>
              <ControlSocketProvider>
                <ControlPanel />
              </ControlSocketProvider>
            </ConditionalDesktopShell>
          } />
          <Route path="/output1" element={<Output1 />} />
          <Route path="/output2" element={<Output2 />} />
          <Route path="/output3" element={<OutputPage outputId="output3" />} />
          <Route path="/output4" element={<OutputPage outputId="output4" />} />
          <Route path="/output5" element={<OutputPage outputId="output5" />} />
          <Route path="/output6" element={<OutputPage outputId="output6" />} />
          <Route path="/stage" element={<Stage />} />
          <Route path="/time" element={<TimeDisplay />} />
          <Route path="/obs-setup" element={
            <ConditionalDesktopShell>
              <ObsSetup />
            </ConditionalDesktopShell>
          } />
          <Route path="/new-song" element={
            <ConditionalDesktopShell>
              <ControlSocketProvider>
                <NewSongCanvas />
              </ControlSocketProvider>
            </ConditionalDesktopShell>
          } />
          <Route path="/timer-control" element={
            <ConditionalDesktopShell>
              <ControlSocketProvider role="timer-control">
                <TimerControlModule />
              </ControlSocketProvider>
            </ConditionalDesktopShell>
          } />
        </Routes>
      </React.Suspense>
    </>
  );
}

export default function App() {
  const { darkMode, setDarkMode } = useDarkModeState();

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

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
        const nextSettings = JSON.parse(event.newValue)?.state?.timerDisplaySettings;
        if (nextSettings && typeof nextSettings === 'object') {
          useLyricsStore.getState().updateTimerDisplaySettings(nextSettings, { touch: false });
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
    <ModalProvider isDark={!!darkMode}>
      <ToastProvider isDark={!!darkMode}>
        <AppErrorBoundary>
          <PreferencesLoaderBridge />
          <Router>
            <AppRoutes />
          </Router>
        </AppErrorBoundary>
      </ToastProvider>
    </ModalProvider>
  );
}
