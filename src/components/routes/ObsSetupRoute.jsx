import React from 'react';
import ObsSetup from '../../pages/ObsSetup';
import ConditionalDesktopShell from './ConditionalDesktopShell';

export default function ObsSetupRoute() {
  return (
    <ConditionalDesktopShell>
      <ObsSetup />
    </ConditionalDesktopShell>
  );
}
