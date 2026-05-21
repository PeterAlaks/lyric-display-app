import { useEffect } from 'react';
import { useDarkModeState } from '@/hooks/useStoreSelectors';
import useSupportDevModal from '@/hooks/LyricDisplayApp/useSupportDevModal';
import SupportDevelopmentModal from '../SupportDevelopmentModal';

export default function SupportDevelopmentBridge() {
  const { darkMode } = useDarkModeState();
  const {
    isOpen,
    openModal,
    closeModal,
    trackAction,
  } = useSupportDevModal();

  useEffect(() => {
    const handler = () => openModal();
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
  }, [openModal]);

  useEffect(() => {
    const handler = (event) => {
      trackAction(event?.detail?.actionType);
    };

    window.addEventListener('support-dev:track-action', handler);
    return () => window.removeEventListener('support-dev:track-action', handler);
  }, [trackAction]);

  return (
    <SupportDevelopmentModal
      isOpen={isOpen}
      onClose={closeModal}
      isDark={darkMode}
    />
  );
}
