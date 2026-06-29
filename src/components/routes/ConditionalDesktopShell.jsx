import React from 'react';
import { useIsDesktopApp } from '../../hooks/useStoreSelectors';
import DesktopShell from '../WindowChrome/DesktopShell';

export default function ConditionalDesktopShell({ children }) {
  const isDesktopApp = useIsDesktopApp();

  if (isDesktopApp) {
    return <DesktopShell>{children}</DesktopShell>;
  }

  return <>{children}</>;
}
