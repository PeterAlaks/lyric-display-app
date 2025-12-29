import React, { useEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom';
import ControlPanel from './pages/ControlPanel';
import Output1 from './pages/Output1';
import Output2 from './pages/Output2';
import Stage from './pages/Stage';
import NewSongCanvas from './components/NewSongCanvas';
import ShortcutsHelpBridge from './components/ShortcutsHelpBridge';
import JoinCodePromptBridge from './components/JoinCodePromptBridge';
import { useDarkModeState } from './hooks/useStoreSelectors';
import useLyricsStore from './context/LyricsStore';
import { ToastProvider } from '@/components/toast/ToastProvider';
import { ModalProvider } from '@/components/modal/ModalProvider';
import useToast from '@/hooks/useToast';
import useModal from '@/hooks/useModal';
import ElectronModalBridge from './components/ElectronModalBridge';
import QRCodeDialogBridge from './components/QRCodeDialogBridge';
import { ControlSocketProvider } from './context/ControlSocketProvider';
import { convertMarkdownToHTML, trimReleaseNotes, formatReleaseNotes } from './utils/markdownParser';
import DesktopShell from './components/WindowChrome/DesktopShell';

const Router = import.meta.env.MODE === 'development' ? BrowserRouter : HashRouter;

export default function App() {
  const { darkMode } = useDarkModeState();
  return (
    <ModalProvider isDark={!!darkMode}>
      <ToastProvider isDark={!!darkMode}>
        <AppErrorBoundary>
          <ElectronModalBridge />
          <JoinCodePromptBridge />
          <WelcomeSplashBridge />
          <UpdaterBridge />
          <QRCodeDialogBridge />
          <ShortcutsHelpBridge />
          <Router>
            <Routes>
              <Route path="/" element={
                <DesktopShell>
                  <ControlSocketProvider>
                    <ControlPanel />
                  </ControlSocketProvider>
                </DesktopShell>
              } />
              <Route path="/output1" element={<Output1 />} />
              <Route path="/output2" element={<Output2 />} />
              <Route path="/stage" element={<Stage />} />
              <Route path="/new-song" element={
                <DesktopShell>
                  <ControlSocketProvider>
                    <NewSongCanvas />
                  </ControlSocketProvider>
                </DesktopShell>
              } />
            </Routes>
          </Router>
        </AppErrorBoundary>
      </ToastProvider>
    </ModalProvider>
  );
}

function WelcomeSplashBridge() {
  const hasSeenWelcome = useLyricsStore((state) => state.hasSeenWelcome);
  const setHasSeenWelcome = useLyricsStore((state) => state.setHasSeenWelcome);
  const { showModal } = useModal();
  const { darkMode } = useDarkModeState();

  useEffect(() => {
    if (hasSeenWelcome || !window.electronAPI) return;

    const timer = setTimeout(() => {
      showModal({
        title: 'Welcome to LyricDisplay',
        component: 'WelcomeSplash',
        variant: 'info',
        size: 'lg',
        dismissible: true,
        actions: [
          {
            label: 'View Integration Guide',
            variant: 'default',
            onSelect: () => {
              showModal({
                title: 'Streaming Software Integration',
                headerDescription: 'Connect LyricDisplay to OBS, vMix, Wirecast and more',
                component: 'IntegrationInstructions',
                variant: 'info',
                size: 'lg',
                dismissLabel: 'Close'
              });
            }
          },
          {
            label: 'Get Started',
            variant: 'outline',
            onSelect: () => { }
          }
        ]
      });
      setHasSeenWelcome(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, [hasSeenWelcome, setHasSeenWelcome, showModal, darkMode]);

  return null;
}

function UpdaterBridge() {
  const { showToast } = useToast();
  const { showModal } = useModal();

  useEffect(() => {
    if (!window.electronAPI) return;

    const offAvail = window.electronAPI.onUpdateAvailable?.((info) => {
      const version = info?.version || '';
      const releaseName = info?.releaseName || '';
      const releaseNotes = info?.releaseNotes || '';
      const releaseDate = info?.releaseDate || '';
      let formattedNotes = formatReleaseNotes(releaseNotes);
      formattedNotes = trimReleaseNotes(formattedNotes);
      formattedNotes = convertMarkdownToHTML(formattedNotes);

      const descriptionParts = [];

      if (version) {
        descriptionParts.push(`Version ${version} is available.`);
      } else {
        descriptionParts.push('A new version is available.');
      }

      if (releaseName && releaseName !== version) {
        descriptionParts.push(releaseName);
      }

      if (releaseDate) {
        try {
          const date = new Date(releaseDate);
          const formattedDate = date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
          descriptionParts.push(`Released: ${formattedDate}`);
        } catch (e) {
        }
      }

      const description = descriptionParts.join('\n');

      showModal({
        title: 'Update Available',
        description: description,
        body: ({ isDark }) => (
          <div className="space-y-4">
            {formattedNotes && (
              <div className={`rounded-lg overflow-hidden border ${isDark
                ? 'bg-gray-800/50 border-gray-700'
                : 'bg-gray-50 border-gray-200'
                }`}>
                <div className={`px-4 py-2.5 border-b ${isDark
                  ? 'bg-gray-800 border-gray-700'
                  : 'bg-gray-100 border-gray-200'
                  }`}>
                  <h4 className={`text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'
                    }`}>Release Notes</h4>
                </div>
                <div className="px-4 py-3 max-h-64 overflow-y-auto">
                  <div
                    className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
                    style={{
                      lineHeight: '1.6',
                      color: isDark ? '#d1d5db' : '#374151'
                    }}
                    dangerouslySetInnerHTML={{ __html: formattedNotes }}
                  />
                </div>
              </div>
            )}
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'
              }`}>
              Would you like to download and install this update now?
            </p>
          </div>
        ),
        variant: 'info',
        dismissible: true,
        size: 'lg',
        actions: [
          {
            label: 'Later',
            variant: 'outline',
            value: 'later'
          },
          {
            label: 'Update Now',
            variant: 'default',
            value: 'update',
            onSelect: async () => {
              window.electronAPI.requestUpdateDownload?.();
            }
          },
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
          { label: 'Later', onClick: () => { } },
        ],
      });
    });
    const offErr = window.electronAPI.onUpdateError?.((msg) => {
      const detail = msg ? String(msg) : '';
      try { console.warn('Update check failed:', detail); } catch { }
      showToast({
        title: 'Unable to check for updates',
        message: 'We could not reach the update service. Please check your internet connection and try again later.',
        variant: 'warning',
        duration: 7000,
      });
    });
    return () => { offAvail?.(); offDownloaded?.(); offErr?.(); };
  }, [showToast, showModal]);
  return null;
}

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    try { console.error('AppErrorBoundary', error, info); } catch { }
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