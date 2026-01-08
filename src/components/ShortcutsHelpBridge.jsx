import React, { useCallback, useEffect } from 'react';
import { Keyboard } from 'lucide-react';
import useModal from '../hooks/useModal';
import { useDarkModeState } from '../hooks/useStoreSelectors';
import { SHORTCUTS } from '../constants/shortcuts';

export default function ShortcutsHelpBridge() {
  const { showModal } = useModal();
  const { darkMode } = useDarkModeState();

  const openShortcutsModal = useCallback(() => {
    showModal({
      title: 'Keyboard Shortcuts',
      headerDescription: 'Master these shortcuts to navigate and control the app efficiently',
      variant: 'info',
      size: 'auto',
      icon: <Keyboard className="h-6 w-6" aria-hidden />,
      dismissLabel: 'Got it',
      allowBackdropClose: true,
      className: 'sm:min-w-[700px] max-w-4xl',
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
      {SHORTCUTS.map(({ category, items }) => (
        <div
          key={category}
          className={`rounded-xl border p-4 ${darkMode
            ? 'bg-gray-800/30 border-gray-700/50'
            : 'bg-gray-50/50 border-gray-200'
            }`}
        >
          <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 pb-2 border-b ${darkMode
            ? 'text-blue-400 border-gray-700'
            : 'text-blue-600 border-gray-200'
            }`}>
            {category}
          </h3>
          <div className="space-y-2.5">
            {items.map(({ label, combo }) => (
              <div
                key={combo}
                className="flex items-center justify-between gap-4"
              >
                <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                  {label}
                </span>
                <kbd className={`inline-flex items-center px-2.5 py-1 text-xs font-mono font-semibold rounded-md border shadow-sm whitespace-nowrap ${darkMode
                  ? 'bg-gray-900 text-blue-300 border-gray-600'
                  : 'bg-white text-gray-700 border-gray-300'
                  }`}>
                  {combo}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}