import { useEffect } from 'react';

export const useDraftEvents = ({ showModal, showToast }) => {
  useEffect(() => {
    const handleDraftSubmitted = (event) => {
      showToast({
        title: 'Draft submitted',
        message: `"${event.detail?.title}" sent for approval`,
        variant: 'success'
      });
    };

    const handleDraftError = (event) => {
      showToast({
        title: 'Draft submission failed',
        message: event.detail?.message || 'Could not send draft',
        variant: 'error'
      });
    };

    const handleDraftRejected = (event) => {
      const { title, reason } = event.detail;
      showModal({
        title: 'Draft Rejected',
        headerDescription: `Your draft "${title}" was rejected by the control panel`,
        description: reason || 'No reason provided',
        variant: 'error',
        dismissLabel: 'Understood',
      });
    };

    window.addEventListener('draft-submitted', handleDraftSubmitted);
    window.addEventListener('draft-error', handleDraftError);
    window.addEventListener('draft-rejected', handleDraftRejected);

    return () => {
      window.removeEventListener('draft-submitted', handleDraftSubmitted);
      window.removeEventListener('draft-error', handleDraftError);
      window.removeEventListener('draft-rejected', handleDraftRejected);
    };
  }, [showModal, showToast]);
};
