import React, { useCallback, useEffect } from 'react';
import { Keyboard } from 'lucide-react';
import { useModalContext } from './modal/ModalProvider';

const SHORTCUTS = [
  { label: 'Open Lyrics File', combo: 'Ctrl/Cmd + O' },
  { label: 'New Lyrics', combo: 'Ctrl/Cmd + N' },
  { label: 'Preview Output 1', combo: 'Ctrl/Cmd + 1' },
  { label: 'Preview Output 2', combo: 'Ctrl/Cmd + 2' },
  { label: 'Add Translation Line in Canvas', combo: 'Ctrl/Cmd + T' },
  { label: 'Duplicate Line in Canvas', combo: 'Ctrl/Cmd + D' },
  { label: 'Select Line in Canvas', combo: 'Ctrl/Cmd + L' },
  { label: 'Navigate Previous Search Results', combo: 'Shift + Up Arrow' },
  { label: 'Navigate Next Search Results', combo: 'Shift + Down Arrow' },
];

export default function ShortcutsHelpBridge() {
  const { showModal } = useModalContext();

  const openShortcutsModal = useCallback(() => {
    showModal({
      title: 'Keyboard Shortcuts',
      variant: 'info',
      size: 'auto',
      icon: <Keyboard className="h-6 w-6" aria-hidden />,
      dismissLabel: 'Close',
      allowBackdropClose: true,
      className: 'sm:min-w-[360px] max-w-lg',
      body: <ShortcutsList />,
    });
  }, [showModal]);

  useEffect(() => {
    const handler = () => openShortcutsModal();
    if (window?.electronAPI?.onOpenShortcutsHelp) {
      const off = window.electronAPI.onOpenShortcutsHelp(handler);
      return () => off?.();
    }
    return undefined;
  }, [openShortcutsModal]);

  useEffect(() => {
    const handler = () => openShortcutsModal();
    window.addEventListener('show-keyboard-shortcuts', handler);
    return () => window.removeEventListener('show-keyboard-shortcuts', handler);
  }, [openShortcutsModal]);

  return null;
}

function ShortcutsList() {
  return (
    <div className="space-y-3">
      {SHORTCUTS.map(({ label, combo }) => (
        <div key={combo} className="flex items-center justify-between gap-4">
          <span className="truncate text-gray-600 dark:text-gray-200">{label}</span>
          <span className="whitespace-nowrap font-semibold text-gray-900 dark:text-gray-100">{combo}</span>
        </div>
      ))}
    </div>
  );
}
