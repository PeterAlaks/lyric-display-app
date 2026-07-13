import { useState } from 'react';
import { ModalActionButton, ModalFooter } from '@/components/modal/modalActions';

export default function TelemetryConsentModal({ darkMode = false, onDecision, onClose }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const choose = async (accepted) => {
    setSaving(true);
    setError('');
    try {
      await onDecision(accepted);
      onClose?.({ accepted });
    } catch (nextError) {
      setError(nextError?.message || 'Your choice could not be saved. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col" data-telemetry-consent="true">
      <div className="space-y-3 overflow-y-auto px-6 py-5 text-sm leading-relaxed text-gray-500 dark:text-gray-300">
        <p>
          Help improve LyricDisplay by sharing minor usage data.
        </p>
        <p>
          The payload does <strong className="font-semibold text-gray-700 dark:text-gray-100">not</strong>{' '}
          include your name, email, lyrics, files, settings, IP address or hardware IDs.
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-400">
          You can change this anytime in Preferences → Advanced.
        </p>

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>

      <ModalFooter darkMode={darkMode}>
        <ModalActionButton
          type="button"
          action={{ label: 'Decline', variant: 'secondary' }}
          actionIndex={0}
          actionCount={2}
          darkMode={darkMode}
          disabled={saving}
          onClick={() => choose(false)}
        >
          Decline
        </ModalActionButton>
        <ModalActionButton
          type="button"
          action={{ label: 'Accept', variant: 'default', autoFocus: true }}
          actionIndex={1}
          actionCount={2}
          darkMode={darkMode}
          disabled={saving}
          autoFocus
          onClick={() => choose(true)}
        >
          {saving ? 'Saving…' : 'Accept'}
        </ModalActionButton>
      </ModalFooter>
    </div>
  );
}
