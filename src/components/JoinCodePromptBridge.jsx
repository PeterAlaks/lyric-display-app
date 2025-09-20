import React, { useEffect, useState, useRef } from 'react';
import { KeyRound, Lock } from 'lucide-react';
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
      const lockInfo = detail.lockInfo || null;
      let settled = false;

            const settle = (value) => {
        if (settled) return;
        settled = true;
        if (typeof value === 'string') {
          const trimmed = value.trim();
          resolver(trimmed.length > 0 ? trimmed : null);
        } else {
          resolver(null);
        }
      };

      const isLocked = reason === 'locked';
      const descriptionText = isLocked
        ? ''
        : reason === 'invalid'
          ? 'The previous join code was rejected. Enter the new 6-digit code displayed on the desktop control panel.'
          : 'Enter the 6-digit join code displayed on the desktop control panel to authorize this device.';

      try {
        const result = await showModal({
          title: isLocked ? 'Join Code Locked' : 'Enter Controller Join Code',
          description: descriptionText,
          variant: isLocked || reason === 'invalid' ? 'warning' : 'info',
          dismissible: !isLocked,
          allowBackdropClose: !isLocked,
          icon: isLocked
            ? <Lock className="h-6 w-6" aria-hidden />
            : <KeyRound className="h-6 w-6" aria-hidden />,
          actions: isLocked
            ? []
            : [
                {
                  label: 'Hidden dismiss',
                  variant: 'secondary',
                  className: 'hidden',
                  closeOnClick: true,
                },
              ],
          body: ({ close }) => (
            isLocked ? (
              <JoinCodeLockView
                lockInfo={lockInfo}
                onUnlock={() => {
                  settle(null);
                  close({ unlocked: true });
                }}
              />
            ) : (
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
            )
          ),
        });

        if (!settled) {
          if (result && typeof result.joinCode === 'string') {
            settle(result.joinCode);
          } else {
            settle(null);
          }
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
  const initialError = reason === 'invalid' ? 'That join code was rejected. Try again.' : '';
  const [value, setValue] = useState(defaultValue ?? '');
  const [error, setError] = useState(initialError);

  useEffect(() => {
    setValue(defaultValue ?? '');
    setError(reason === 'invalid' ? 'That join code was rejected. Try again.' : '');
  }, [defaultValue, reason]);

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

const JoinCodeLockView = ({ lockInfo, onUnlock }) => {
  const retryAfterMs = Math.max(0, Number(lockInfo?.retryAfterMs) || 0);
  const [remainingMs, setRemainingMs] = useState(retryAfterMs);
  const unlockedRef = useRef(false);

  useEffect(() => {
    setRemainingMs(retryAfterMs);
    unlockedRef.current = false;

    if (retryAfterMs <= 0) {
      unlockedRef.current = true;
      onUnlock?.();
      return;
    }

    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, retryAfterMs - elapsed);
      setRemainingMs(remaining);
      if (remaining <= 0) {
        window.clearInterval(interval);
        if (!unlockedRef.current) {
          unlockedRef.current = true;
          onUnlock?.();
        }
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [retryAfterMs, onUnlock]);

  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  const formattedCountdown = `${minutes}:${seconds}`;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Too many invalid join code attempts. Please wait for the timer to complete before trying again.
      </p>
      <div className="flex justify-center">
        <span className="text-3xl font-semibold text-gray-800 dark:text-gray-100 tabular-nums">
          {formattedCountdown}
        </span>
      </div>
    </div>
  );
};

export default JoinCodePromptBridge;
