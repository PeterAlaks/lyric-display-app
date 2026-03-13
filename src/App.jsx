import React from 'react';
import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom';
import ControlPanel from './pages/ControlPanel';
import Output1 from './pages/Output1';
import Output2 from './pages/Output2';
import Stage from './pages/Stage';
import NewSongCanvas from './components/NewSongCanvas';
import { useDarkModeState, useIsDesktopApp } from './hooks/useStoreSelectors';
import { ToastProvider } from '@/components/toast/ToastProvider';
import { ModalProvider } from '@/components/modal/ModalProvider';
import { ControlSocketProvider } from './context/ControlSocketProvider';
import DesktopShell from './components/WindowChrome/DesktopShell';
import AppErrorBoundary from './components/AppErrorBoundary';
import { ElectronModalBridge, JoinCodePromptBridge, NdiBridge, NdiUpdaterBridge, PreferencesLoaderBridge, QRCodeDialogBridge, ShortcutsHelpBridge, SupportDevelopmentBridge, UpdaterBridge, WelcomeSplashBridge, } from './components/bridges';

const Router = import.meta.env.MODE === 'development' ? BrowserRouter : HashRouter;

function ConditionalDesktopShell({ children }) {
  const isDesktopApp = useIsDesktopApp();

  if (isDesktopApp) {
    return <DesktopShell>{children}</DesktopShell>;
  }

  return <>{children}</>;
}

export default function App() {
  const { darkMode } = useDarkModeState();
  return (
    <ModalProvider isDark={!!darkMode}>
      <ToastProvider isDark={!!darkMode}>
        <AppErrorBoundary>
          <PreferencesLoaderBridge />
          <NdiBridge />
          <ElectronModalBridge />
          <JoinCodePromptBridge />
          <WelcomeSplashBridge />
          <UpdaterBridge />
          <NdiUpdaterBridge />
          <QRCodeDialogBridge />
          <ShortcutsHelpBridge />
          <SupportDevelopmentBridge />
          <Router>
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
              <Route path="/stage" element={<Stage />} />
              <Route path="/new-song" element={
                <ConditionalDesktopShell>
                  <ControlSocketProvider>
                    <NewSongCanvas />
                  </ControlSocketProvider>
                </ConditionalDesktopShell>
              } />
            </Routes>
          </Router>
        </AppErrorBoundary>
      </ToastProvider>
    </ModalProvider>
  );
}