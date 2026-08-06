import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ControlSocketProvider, useControlSocket } from '../../context/ControlSocketProvider';
import { usePreviewSettings } from '../../hooks/useStoreSelectors';
import ConditionalDesktopShell from './ConditionalDesktopShell';
import StartupReadinessReporter from './StartupReadinessReporter';

const ElectronModalBridge = React.lazy(() => import('../bridges/ElectronModalBridge'));
const JoinCodePromptBridge = React.lazy(() => import('../bridges/JoinCodePromptBridge'));
const NdiBridge = React.lazy(() => import('../bridges/NdiBridge'));
const NdiUpdaterBridge = React.lazy(() => import('../bridges/NdiUpdaterBridge'));
const QRCodeDialogBridge = React.lazy(() => import('../bridges/QRCodeDialogBridge'));
const ShortcutsHelpBridge = React.lazy(() => import('../bridges/ShortcutsHelpBridge'));
const SupportDevelopmentBridge = React.lazy(() => import('../bridges/SupportDevelopmentBridge'));
const UpdaterBridge = React.lazy(() => import('../bridges/UpdaterBridge'));
const FirstRunTourBridge = React.lazy(() => import('../bridges/FirstRunTourBridge'));
const FileNavigatorModal = React.lazy(() => import('../FileNavigatorModal'));
const FileSaveNavigatorModal = React.lazy(() => import('../FileSaveNavigatorModal'));

function PreviewSettingsSyncBridge() {
  const previewSettings = usePreviewSettings();
  const {
    emitStyleUpdate,
    isAuthenticated,
    isConnected,
    ready,
    socket,
  } = useControlSocket();
  const lastSentSignatureRef = React.useRef('');

  React.useEffect(() => {
    if (!isConnected || !isAuthenticated || !ready || !previewSettings) {
      lastSentSignatureRef.current = '';
      return;
    }

    const signature = `${socket?.id || 'socket'}:${JSON.stringify(previewSettings)}`;
    if (signature === lastSentSignatureRef.current) return;
    if (emitStyleUpdate('preview', previewSettings)) {
      lastSentSignatureRef.current = signature;
    }
  }, [emitStyleUpdate, isAuthenticated, isConnected, previewSettings, ready, socket?.id]);

  return null;
}

function MainWindowBridges() {
  return (
    <React.Suspense fallback={null}>
      <NdiBridge />
      <ElectronModalBridge />
      <JoinCodePromptBridge />
      <FirstRunTourBridge />
      <UpdaterBridge />
      <NdiUpdaterBridge />
      <QRCodeDialogBridge />
      <ShortcutsHelpBridge />
      <SupportDevelopmentBridge />
    </React.Suspense>
  );
}

export default function MainWindowShell() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search || '');
  const isObsDockEntry = location.pathname === '/' && searchParams.get('dock') === 'obs';

  if (isObsDockEntry) {
    return <Outlet />;
  }

  return (
    <ConditionalDesktopShell>
      <ControlSocketProvider>
        <StartupReadinessReporter />
        <PreviewSettingsSyncBridge />
        <MainWindowBridges />
        <React.Suspense fallback={null}>
          <FileNavigatorModal />
          <FileSaveNavigatorModal />
        </React.Suspense>
        <Outlet />
      </ControlSocketProvider>
    </ConditionalDesktopShell>
  );
}
