import React from 'react';
import { ControlSocketProvider } from '../../context/ControlSocketProvider';
import TimerControlModule from '../TimerControlModule';
import ConditionalDesktopShell from './ConditionalDesktopShell';

export default function TimerControlRoute() {
  return (
    <ConditionalDesktopShell>
      <ControlSocketProvider role="timer-control">
        <TimerControlModule />
      </ControlSocketProvider>
    </ConditionalDesktopShell>
  );
}
