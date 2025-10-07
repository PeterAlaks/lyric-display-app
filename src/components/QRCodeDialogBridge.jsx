import React, { useCallback, useEffect, useState } from 'react';
import QRCodeDialog from './QRCodeDialog';
import { useDarkModeState } from '../hooks/useStoreSelectors';

export default function QRCodeDialogBridge() {
  const { darkMode } = useDarkModeState();
  const [isOpen, setIsOpen] = useState(false);

  const openDialog = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    const handler = () => openDialog();
    let unsubscribe;

    try {
      if (window?.electronAPI?.onOpenQRCodeDialog) {
        unsubscribe = window.electronAPI.onOpenQRCodeDialog(handler);
      }
    } catch (_) {
      // no-op: continue with DOM listener fallback
    }

    window.addEventListener('open-qr-dialog', handler);

    return () => {
      if (typeof unsubscribe === 'function') {
        try { unsubscribe(); } catch (_) { /* ignore */ }
      }
      window.removeEventListener('open-qr-dialog', handler);
    };
  }, [openDialog]);

  return (
    <QRCodeDialog
      isOpen={isOpen}
      onClose={closeDialog}
      darkMode={darkMode}
    />
  );
}
