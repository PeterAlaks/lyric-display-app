import React, { useEffect, useState } from 'react';
import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom';
import ControlPanel from './pages/ControlPanel';
import Output1 from './pages/Output1';
import Output2 from './pages/Output2';
import NewSongCanvas from './components/NewSongCanvas';
import QRCodeDialog from './components/QRCodeDialog';
import useLyricsStore from './context/LyricsStore';
import { ToastProvider } from '@/components/toast/ToastProvider';
import useToast from '@/hooks/useToast';

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
    <ToastProvider isDark={!!darkMode}>
      <AppErrorBoundary>
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

// Keyboard shortcuts modal bridge
function ShortcutsHelpBridge() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!window.electronAPI) return;
    const off = window.electronAPI.onOpenShortcutsHelp?.(() => setOpen(true));
    return () => off?.();
  }, []);
  return open ? <ShortcutsHelpModal onClose={() => setOpen(false)} /> : null;
}

function ShortcutsHelpModal({ onClose }) {
  const { darkMode } = useLyricsStore();
  const [exiting, setExiting] = useState(false);
  const [entering, setEntering] = useState(true);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntering(false));
    return () => cancelAnimationFrame(raf);
  }, []);
  const handleClose = () => { setExiting(true); setTimeout(onClose, 300); };
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center" onClick={handleClose}>
      <div className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${exiting || entering ? 'opacity-0' : 'opacity-100'}`} />
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-md mx-4 rounded-xl shadow-2xl p-6 transition-all duration-300 ease-out ${
          darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
        } ${exiting || entering ? 'opacity-0 translate-y-1 scale-95' : 'opacity-100 translate-y-0 scale-100'}`}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Keyboard Shortcuts</h3>
          <button onClick={handleClose} className={`${darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors`} aria-label="Close">
            ×
          </button>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>Open Lyrics File</span>
            <span className="opacity-90">Ctrl/Cmd + O</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>New Lyrics</span>
            <span className="opacity-90">Ctrl/Cmd + N</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>Preview Output 1</span>
            <span className="opacity-90">Ctrl/Cmd + 1</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>Preview Output 2</span>
            <span className="opacity-90">Ctrl/Cmd + 2</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>Close Modals</span>
            <span className="opacity-90">Esc</span>
          </div>
        </div>
      </div>
    </div>
  );
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
