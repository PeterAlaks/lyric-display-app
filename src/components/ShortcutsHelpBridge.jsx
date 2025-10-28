import React, { useCallback, useEffect } from 'react';
import { Keyboard } from 'lucide-react';
import { useModalContext } from './modal/ModalProvider';
import { useDarkModeState } from '../hooks/useStoreSelectors';

const SHORTCUTS = [
  { label: 'Open Lyrics File', combo: 'Ctrl/Cmd + O' },
  { label: 'New Lyrics', combo: 'Ctrl/Cmd + N' },
  { label: 'Focus Search Bar', combo: 'Ctrl/Cmd + F' },
  { label: 'Clear Search', combo: 'Escape' },
  { label: 'Jump to First Match (in search)', combo: 'Enter' },
  { label: 'Navigate to Previous Lyric Line', combo: 'Up Arrow / Numpad ↑' },
  { label: 'Navigate to Next Lyric Line', combo: 'Down Arrow / Numpad ↓' },
  { label: 'Jump to First Lyric Line', combo: 'Home' },
  { label: 'Jump to Last Lyric Line', combo: 'End' },
  { label: 'Toggle Display Output', combo: 'Spacebar' },
  { label: 'Add Translation Line in Canvas', combo: 'Ctrl/Cmd + T' },
  { label: 'Duplicate Line in Canvas', combo: 'Ctrl/Cmd + D' },
  { label: 'Select Line in Canvas', combo: 'Ctrl/Cmd + L' },
  { label: 'Navigate Previous Search Results', combo: 'Shift + Up Arrow' },
  { label: 'Navigate Next Search Results', combo: 'Shift + Down Arrow' },
];

export default function ShortcutsHelpBridge() {
  const { showModal } = useModalContext();
  const { darkMode } = useDarkModeState();

  const openShortcutsModal = useCallback(() => {
    showModal({
      title: 'Keyboard Shortcuts',
      headerDescription: 'Helpful keyboard shortcuts for faster navigation and actions',
      variant: 'info',
      size: 'auto',
      icon: <Keyboard className="h-6 w-6" aria-hidden />,
      dismissLabel: 'Close',
      allowBackdropClose: true,
      className: 'sm:min-w-[500px] max-w-2xl',
      body: <ShortcutsList darkMode={darkMode} />,
    });
  }, [showModal, darkMode]);

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

function ShortcutsList({ darkMode }) {
  return (
    <div className="space-y-3">
      {SHORTCUTS.map(({ label, combo }) => (
        <div key={combo} className="flex items-center justify-between gap-4">
          <span className={`truncate ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{label}</span>
          <span className={`whitespace-nowrap font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{combo}</span>
        </div>
      ))}
    </div>
  );
}
