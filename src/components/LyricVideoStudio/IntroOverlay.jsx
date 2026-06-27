import React from 'react';

const getIntroDurationMs = (intro = {}) => (
  intro?.enabled ? Math.max(0, Number(intro.durationMs) || 0) : 0
);

export const isIntroActive = (intro, currentTimeMs) => (
  Boolean(intro?.enabled) && Math.max(0, Number(currentTimeMs) || 0) < getIntroDurationMs(intro)
);

export default function IntroOverlay({
  intro,
  title,
  currentTimeMs,
  canvasHeight = 1080,
}) {
  const durationMs = getIntroDurationMs(intro);
  const safeTimeMs = Math.max(0, Number(currentTimeMs) || 0);
  if (!intro?.enabled || safeTimeMs >= durationMs) return null;

  const safeCanvasHeight = Math.max(180, Number(canvasHeight) || 1080);
  const fadeMs = Math.max(250, Math.min(900, durationMs / 3));
  const remainingMs = Math.max(0, durationMs - safeTimeMs);
  const opacity = Math.max(0, Math.min(1, safeTimeMs / fadeMs, remainingMs / fadeMs));
  const titleFontSize = Math.round(Math.min(104, Math.max(42, safeCanvasHeight * 0.078)));
  const subtitleFontSize = Math.round(Math.min(54, Math.max(24, safeCanvasHeight * 0.04)));
  const detailsFontSize = Math.round(Math.min(32, Math.max(18, safeCanvasHeight * 0.024)));

  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-white"
      style={{ opacity, paddingLeft: '8%', paddingRight: '8%' }}
    >
      <div style={{ maxWidth: '78%' }}>
        <div
          className="font-bold leading-tight drop-shadow-[0_8px_22px_rgba(0,0,0,0.55)]"
          style={{ fontSize: titleFontSize }}
        >
          {intro.title || title || 'Untitled Video 1'}
        </div>
        {intro.subtitle && (
          <div
            className="font-semibold leading-tight text-white/90 drop-shadow-[0_6px_18px_rgba(0,0,0,0.55)]"
            style={{ marginTop: Math.round(safeCanvasHeight * 0.024), fontSize: subtitleFontSize }}
          >
            {intro.subtitle}
          </div>
        )}
        {intro.details && (
          <div
            className="mx-auto whitespace-pre-line font-medium leading-snug text-white/85 drop-shadow-[0_5px_16px_rgba(0,0,0,0.55)]"
            style={{ marginTop: Math.round(safeCanvasHeight * 0.03), maxWidth: '82%', fontSize: detailsFontSize }}
          >
            {intro.details}
          </div>
        )}
      </div>
    </div>
  );
}
