import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ControlSocketProvider } from '../../context/ControlSocketProvider';
import ConditionalDesktopShell from './ConditionalDesktopShell';

const ElectronModalBridge = React.lazy(() => import('../bridges/ElectronModalBridge'));
const JoinCodePromptBridge = React.lazy(() => import('../bridges/JoinCodePromptBridge'));
const NdiBridge = React.lazy(() => import('../bridges/NdiBridge'));
const NdiUpdaterBridge = React.lazy(() => import('../bridges/NdiUpdaterBridge'));
const QRCodeDialogBridge = React.lazy(() => import('../bridges/QRCodeDialogBridge'));
const ShortcutsHelpBridge = React.lazy(() => import('../bridges/ShortcutsHelpBridge'));
const SupportDevelopmentBridge = React.lazy(() => import('../bridges/SupportDevelopmentBridge'));
const UpdaterBridge = React.lazy(() => import('../bridges/UpdaterBridge'));
const WelcomeSplashBridge = React.lazy(() => import('../bridges/WelcomeSplashBridge'));

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
        <MainWindowBridges />
        <Outlet />
      </ControlSocketProvider>
    </ConditionalDesktopShell>
  );
}
