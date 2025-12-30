import { useEffect, useState } from 'react';
import { useDarkModeState } from '@/hooks/useStoreSelectors';
import SupportDevelopmentModal from './SupportDevelopmentModal';

export default function SupportDevelopmentBridge() {
  const { darkMode } = useDarkModeState();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handler = () => setIsOpen(true);
    let unsubscribe;

    try {
      if (window?.electronAPI?.onOpenSupportDevModal) {
        unsubscribe = window.electronAPI.onOpenSupportDevModal(handler);
      }
    } catch (error) {
      console.warn('Failed to register support dev modal listener:', error);
    }

    window.addEventListener('open-support-dev-modal', handler);

    return () => {
      try {
        if (typeof unsubscribe === 'function') unsubscribe();
      } catch (error) {
        console.warn('Failed to unsubscribe support dev modal listener:', error);
      }
      window.removeEventListener('open-support-dev-modal', handler);
    };
  }, []);

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <SupportDevelopmentModal
      isOpen={isOpen}
      onClose={handleClose}
      isDark={darkMode}
    />
  );
}
