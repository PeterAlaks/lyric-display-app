import React from 'react';
import { AlertTriangle } from 'lucide-react';

const formatDuration = (ms) => {
  const totalSeconds = Math.ceil(ms / 1000);
  if (totalSeconds <= 0) return 'moments';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  return `${seconds}s`;
};

const ConnectionBackoffBanner = ({ darkMode = false }) => {
  const [detail, setDetail] = React.useState(null);
  const [, forceTick] = React.useState(0);

  React.useEffect(() => {
    const handleWarning = (event) => {
      const payload = event?.detail || {};
      const remainingMs = Math.max(0, Number(payload.remainingMs) || 0);
      const expiresAt = Date.now() + remainingMs;
      setDetail({
        scope: payload.scope === 'global' ? 'global' : 'client',
        reason: payload.reason || 'client_backoff',
        clientId: payload.clientId || null,
        attempts: Number.isFinite(payload.attempts) ? payload.attempts : null,
        expiresAt,
      });
    };

    const handleClear = () => setDetail(null);

    window.addEventListener('connection-backoff-warning', handleWarning);
    window.addEventListener('connection-backoff-clear', handleClear);
    return () => {
      window.removeEventListener('connection-backoff-warning', handleWarning);
      window.removeEventListener('connection-backoff-clear', handleClear);
    };
  }, []);

  React.useEffect(() => {
    if (!detail) return undefined;
    const interval = setInterval(() => {
      const remaining = Math.max(0, (detail.expiresAt ?? 0) - Date.now());
      if (remaining <= 0) {
        setDetail(null);
      } else {
        forceTick((tick) => (tick + 1) % 1000);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [detail]);

  if (!detail) return null;

  const remainingMs = Math.max(0, (detail.expiresAt ?? 0) - Date.now());
  const variantClasses = darkMode
    ? 'bg-amber-500/15 text-amber-100 border border-amber-500/40 shadow-lg shadow-amber-500/20'
    : 'bg-amber-50 text-amber-900 border border-amber-200 shadow-lg shadow-amber-200/80';

  const headline = detail.scope === 'global'
    ? 'Server connection paused'
    : 'Reconnection delayed';

  const subtitle = detail.scope === 'global'
    ? `All clients are waiting to retry. Next attempt in ${formatDuration(remainingMs)}.`
    : `Next attempt in ${formatDuration(remainingMs)}.`;

  const attemptsText = detail.attempts && detail.attempts > 1
    ? `Attempts so far: ${detail.attempts}`
    : null;

  return (
    <div className={`pointer-events-none fixed top-4 left-1/2 z-[1100] flex -translate-x-1/2 rounded-xl px-4 py-3 transition-opacity duration-300 ${variantClasses}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 flex-shrink-0" />
        <div className="flex flex-col text-sm">
          <span className="font-semibold leading-5">{headline}</span>
          <span className="leading-5 opacity-90">{subtitle}</span>
          {attemptsText ? (
            <span className="mt-1 text-xs opacity-70">{attemptsText}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ConnectionBackoffBanner;
