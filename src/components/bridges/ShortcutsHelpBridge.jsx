import React, { useCallback, useEffect } from 'react';
import { Keyboard } from 'lucide-react';
import useModal from '../../hooks/useModal';
import { useDarkModeState } from '../../hooks/useStoreSelectors';
import { SHORTCUTS } from '../../constants/shortcuts';

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
      className: 'sm:min-w-175 max-w-4xl',
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
    <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-xs md:grid-cols-2">
      {SHORTCUTS.map(({ category, items }) => (
        <div
          key={category}
          className={`rounded-xl border p-3.5 ${darkMode
            ? 'bg-gray-800/30 border-gray-700/50'
            : 'bg-gray-50/50 border-gray-200'
            }`}
        >
          <h3 className={`mb-2.5 border-b pb-1.5 text-[10px] font-bold uppercase tracking-wider ${darkMode
            ? 'text-blue-400 border-gray-700'
            : 'text-blue-600 border-gray-200'
            }`}>
            {category}
          </h3>
          <div className="space-y-2">
            {items.map(({ label, combo }) => (
              <div
                key={`${label}-${combo}`}
                className="flex items-center justify-between gap-3"
              >
                <span className={`text-xs leading-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                  {label}
                </span>
                <kbd className={`inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold leading-4 shadow-sm ${darkMode
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
