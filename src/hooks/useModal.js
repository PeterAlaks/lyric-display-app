import { useContext } from 'react';
import { ModalContext } from '@/components/modal/ModalProvider';

export default function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) {
    const fallback = async ({ title, description, message }) => {
      const parts = [title, description ?? message].filter(Boolean);
      if (typeof window !== 'undefined' && parts.length > 0) {
        window.alert(parts.join('\n\n'));
      }
      return 'dismiss';
    };
    return {
      showModal: fallback,
      closeModal: () => { },
    };
  }
  return ctx;
}
