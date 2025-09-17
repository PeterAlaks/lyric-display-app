import React, { useEffect, useState } from 'react';
import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom';
import ControlPanel from './pages/ControlPanel';
import Output1 from './pages/Output1';
import Output2 from './pages/Output2';
import NewSongCanvas from './components/NewSongCanvas';
import QRCodeDialog from './components/QRCodeDialog';
import ShortcutsHelpBridge from './components/ShortcutsHelpBridge';
import useLyricsStore from './context/LyricsStore';
import { ToastProvider } from '@/components/toast/ToastProvider';
import { ModalProvider } from '@/components/modal/ModalProvider';
import useToast from '@/hooks/useToast';
import ElectronModalBridge from './components/ElectronModalBridge';

const Router = import.meta.env.MODE === 'development' ? BrowserRouter : HashRouter;

// QR Dialog Page Component
const QRDialogPage = () => {
  const { darkMode } = useLyricsStore();
  return (
    <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <QRCodeDialog isOpen={true} onClose={() => window.close()} darkMode={darkMode} />
    </div>
  );
};

export default function App() {
  const { darkMode } = useLyricsStore();
  return (
    <ModalProvider isDark={!!darkMode}>
      <ToastProvider isDark={!!darkMode}>
        <AppErrorBoundary>
          <ElectronModalBridge />
          <UpdaterToastBridge />
          <ShortcutsHelpBridge />
          <Router>
            <Routes>
              <Route path="/" element={<ControlPanel />} />
              <Route path="/output1" element={<Output1 />} />
              <Route path="/output2" element={<Output2 />} />
              <Route path="/new-song" element={<NewSongCanvas />} />
              <Route path="/qr-dialog" element={<QRDialogPage />} />
            </Routes>
          </Router>
        </AppErrorBoundary>
      </ToastProvider>
    </ModalProvider>
  );
}

// Bridge updater events from main to toasts
function UpdaterToastBridge() {
  const { showToast } = useToast();
  useEffect(() => {
    if (!window.electronAPI) return;
    const offAvail = window.electronAPI.onUpdateAvailable?.((info) => {
      const version = info?.version || '';
      showToast({
        title: 'Update available',
        message: version ? `Version ${version} is available.` : 'A new version is available.',
        variant: 'info',
        duration: 7000,
        actions: [
          { label: 'Update Now', onClick: () => window.electronAPI.requestUpdateDownload?.() },
          { label: 'Later', onClick: () => {} },
        ],
      });
    });
    const offDownloaded = window.electronAPI.onUpdateDownloaded?.(() => {
      showToast({
        title: 'Update ready to install',
        message: 'Install and restart now?',
        variant: 'success',
        duration: 0,
        actions: [
          { label: 'Install and Restart', onClick: () => window.electronAPI.requestInstallAndRestart?.() },
          { label: 'Later', onClick: () => {} },
        ],
      });
    });
    const offErr = window.electronAPI.onUpdateError?.((msg) => {
      showToast({ title: 'Update error', message: msg || 'Something went wrong.', variant: 'error', duration: 6000 });
    });
    return () => { offAvail?.(); offDownloaded?.(); offErr?.(); };
  }, [showToast]);
  return null;
}

// Hard guard: prevents a render crash from blanking the UI in production
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    try { console.error('AppErrorBoundary', error, info); } catch {}
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16, fontFamily: 'system-ui, sans-serif', color: '#111827' }}>
          <h3 style={{ margin: 0, marginBottom: 8, color: '#b91c1c' }}>Something went wrong</h3>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: '#374151' }}>
            {String(this.state.error?.message || this.state.error || 'Unknown error')}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}


