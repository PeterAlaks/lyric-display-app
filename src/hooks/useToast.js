import { useContext } from 'react';
import { ToastContext } from '@/components/toast/ToastProvider';
import { playTone } from '@/utils/toastSounds';

export default function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback: no provider available; return no-op API to avoid crashes
    return { showToast: () => {}, removeToast: () => {} };
  }
  const { show, remove } = ctx;
  const showToast = (opts) => show({ playTone, ...opts });
  return { showToast, removeToast: remove };
}
