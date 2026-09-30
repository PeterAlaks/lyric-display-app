import { useEffect } from 'react';
import useModal from '@/hooks/useModal';
import useToast from '@/hooks/useToast';

export default function ElectronModalBridge() {
  const { showModal } = useModal();
  const { showToast } = useToast();

  useEffect(() => {
    const api = window?.electronAPI;
    if (!api?.onModalRequest || !api?.resolveModalRequest || !api?.rejectModalRequest) {
      return undefined;
    }

    const unsubscribe = api.onModalRequest(async (payload) => {
      const { id, component, presentation, ...config } = payload || {};
      if (!id) {
        return;
      }
      try {
        if (presentation === 'toast') {
          showToast({
            ...config,
            actions: (config.actions || []).map(({ label, modal }) => ({
              label,
              onClick: () => {
                if (modal) {
                  void showModal(modal).catch((error) => {
                    console.error('[ElectronModalBridge] Failed to open toast action:', error);
                  });
                }
              },
            })),
          });
          // Acknowledge delivery now; dismissing or replacing a toast must not
          // leave a pending request in the main process.
          await api.resolveModalRequest(id, { presented: true });
          return;
        }
        if (component) {
          const result = await showModal({
            ...config,
            component,
          });
          await api.resolveModalRequest(id, result ?? {});
        } else {
          const result = await showModal(config);
          await api.resolveModalRequest(id, result ?? {});
        }
      } catch (error) {
        await api.rejectModalRequest(id, { message: error?.message || String(error) });
      }
    });

    return () => {
      try { unsubscribe?.(); } catch { }
    };
  }, [showModal, showToast]);

  return null;
}
