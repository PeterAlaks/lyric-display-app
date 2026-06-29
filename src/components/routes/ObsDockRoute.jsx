import React from 'react';
import { ControlSocketProvider } from '../../context/ControlSocketProvider';
import ObsDockLayout from '../ObsDockLayout';

export default function ObsDockRoute() {
  return (
    <ControlSocketProvider>
      <ObsDockLayout />
    </ControlSocketProvider>
  );
}
