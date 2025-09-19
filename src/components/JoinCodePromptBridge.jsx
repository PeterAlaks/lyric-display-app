import React, { useEffect } from 'react';
import { KeyRound } from 'lucide-react';
import useModal from '@/hooks/useModal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const JoinCodePromptBridge = () => {
  const { showModal } = useModal();

  useEffect(() => {
    const handler = async (event) => {
      const detail = event.detail || {};
      const resolver = typeof detail.resolve === 'function' ? detail.resolve : null;
      if (!resolver) return;

      const reason = detail.reason || 'missing';
      const prefill = typeof detail.prefill === 'string' ? detail.prefill : '';
      let settled = false;

      const settle = (value) => {
        if (settled) return;
        settled = true;
        resolver(typeof value === 'string' ? value : null);
      };

      try {
        const result = await showModal({
          title: 'Enter Controller Join Code',
          description: reason === 'invalid'
            ? 'The previous join code was rejected. Enter the new 6-digit code displayed on the desktop control panel.'
            : 'Enter the 6-digit join code displayed on the desktop control panel to authorize this device.',
          variant: reason === 'invalid' ? 'warning' : 'info',
          dismissible: true,
          allowBackdropClose: false,
          icon: <KeyRound className="h-6 w-6" aria-hidden />,
          actions: [
            {
              label: 'Hidden dismiss',
              variant: 'secondary',
              className: 'hidden',
              closeOnClick: true,
            },
          ],
          body: ({ close }) => (
            <JoinCodeForm
              defaultValue={prefill}
              reason={reason}
              onSubmit={(code) => {
                settle(code);
                close({ joinCode: code });
              }}
              onCancel={() => {
                settle(null);
                close({ cancelled: true });
              }}
            />
          ),
        });

        if (!settled) {
          settle(result && typeof result.joinCode === 'string' ? result.joinCode : null);
        }
      } catch (error) {
        console.warn('Join code modal closed with error:', error);
        settle(null);
      }
    };

    window.addEventListener('request-join-code', handler);
    return () => window.removeEventListener('request-join-code', handler);
  }, [showModal]);

  return null;
};

const JoinCodeForm = ({ defaultValue = '', reason, onSubmit, onCancel }) => {
  const [value, setValue] = React.useState(defaultValue ?? '');
  const [error, setError] = React.useState('');

  useEffect(() => {
    setValue(defaultValue ?? '');
  }, [defaultValue]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmed = (value || '').trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setError('Enter the 6-digit code shown on the desktop app.');
      return;
    }
    setError('');
    onSubmit?.(trimmed);
  };

  const handleCancel = () => {
    setError('');
    onCancel?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-300">
        {reason === 'invalid'
          ? 'The previous join code was rejected. Enter the new 6-digit code displayed on the desktop controller.'
          : 'Enter the 6-digit join code displayed on the desktop control panel to authorize this device.'}
      </p>
      <div className="space-y-2">
        <Input
          value={value}
          onChange={(event) => {
            if (error) setError('');
            setValue(event.target.value);
          }}
          inputMode="numeric"
          maxLength={6}
          placeholder="123456"
          autoFocus
        />
        {error && (
          <p className="text-sm text-red-500" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!value || value.trim().length === 0}>
          Submit
        </Button>
      </div>
    </form>
  );
};

export default JoinCodePromptBridge;



