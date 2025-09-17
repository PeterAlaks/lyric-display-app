import { useEffect } from 'react';
import useModal from '@/hooks/useModal';

export default function ElectronModalBridge() {
  const { showModal } = useModal();

  useEffect(() => {
    const api = window?.electronAPI;
    if (!api?.onModalRequest || !api?.resolveModalRequest || !api?.rejectModalRequest) {
      return undefined;
    }

    const unsubscribe = api.onModalRequest(async (payload) => {
      const { id, ...config } = payload || {};
      if (!id) {
        return;
      }
      try {
        const result = await showModal(config);
        await api.resolveModalRequest(id, result ?? {});
      } catch (error) {
        await api.rejectModalRequest(id, { message: error?.message || String(error) });
      }
    });

    return () => {
      try { unsubscribe?.(); } catch {}
    };
  }, [showModal]);

  return null;
}
