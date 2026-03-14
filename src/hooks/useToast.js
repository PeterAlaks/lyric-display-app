import { useContext, useCallback } from 'react';
import { ToastContext, globalToastRef } from '@/components/toast/ToastProvider';
import { playTone } from '@/utils/toastSounds';

export default function useToast() {
  const ctx = useContext(ToastContext);

  const showToast = useCallback((opts) => {
    const target = ctx || globalToastRef.current;
    if (target) {
      target.show({ playTone, ...opts });
    }
  }, [ctx]);

  const removeToast = useCallback((id) => {
    const target = ctx || globalToastRef.current;
    if (target) {
      target.remove(id);
    }
  }, [ctx]);

  return { showToast, removeToast };
}
