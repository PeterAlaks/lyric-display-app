import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function TelemetryConsentModal({ darkMode = false, onDecision }) {
  const dialogRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();

    const keepFocusInside = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const controls = Array.from(dialogRef.current.querySelectorAll('button:not(:disabled)'));
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', keepFocusInside, true);
    return () => {
      document.removeEventListener('keydown', keepFocusInside, true);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  const choose = async (accepted) => {
    setSaving(true);
    setError('');
    try {
      await onDecision(accepted);
    } catch (nextError) {
      setError(nextError?.message || 'Your choice could not be saved. Please try again.');
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[10020] grid place-items-center bg-black/55 p-4" data-telemetry-consent="true">
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="telemetry-consent-title"
        aria-describedby="telemetry-consent-description"
        tabIndex={-1}
        className={`w-full max-w-[440px] rounded-xl border p-5 shadow-2xl outline-none ${
          darkMode
            ? 'border-slate-700 bg-slate-900 text-slate-100'
            : 'border-slate-200 bg-white text-slate-950'
        }`}
      >
        <h2 id="telemetry-consent-title" className="m-0 text-lg font-semibold tracking-tight">
          Share minimal app activity?
        </h2>
        <div
          id="telemetry-consent-description"
          className={`mt-3 space-y-2 text-sm leading-6 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}
        >
          <p>
            If you accept, LyricDisplay sends a random installation ID, your operating-system family,
            app version, and successful launch or update events for analytics only.
          </p>
          <p>
            The payload does not include your name, email, lyrics, files, settings, IP address, or hardware IDs.
            You can opt out later in Preferences → Advanced.
          </p>
        </div>

        {error && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => choose(false)}
            className={`min-h-9 rounded-lg border px-4 text-sm font-medium disabled:opacity-60 ${
              darkMode
                ? 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            Decline
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => choose(true)}
            className="min-h-9 rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Accept'}
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}
