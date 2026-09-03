import React from 'react';
import {
  PROJECTION_STATE_CHANGED_MESSAGE,
  PROJECTION_SYNC_CHANNEL,
} from '../../shared/outputRegistry.js';

const AUTO_FIT_CACHE_LIMIT = 80;
const autoFitCache = new Map();

export const getTextFitShape = (text) => String(text || '')
  .replace(/[0-9]/g, '0')
  .replace(/[A-Z]/g, 'A')
  .replace(/[a-z]/g, 'a');

export const doesTextElementFit = (textEl, availableWidth, availableHeight) => {
  if (!textEl) return false;
  const measuredWidth = Math.max(
    Number(textEl.scrollWidth) || 0,
    Number(textEl.offsetWidth) || 0,
  );
  const measuredHeight = Math.max(
    Number(textEl.scrollHeight) || 0,
    Number(textEl.offsetHeight) || 0,
  );
  return measuredWidth <= availableWidth && measuredHeight <= availableHeight;
};

export const createLatestElementRef = (setElement) => (element) => {
  if (!element) return undefined;
  setElement(element);
  return () => {
    // AnimatePresence can release an exiting node after its replacement is already attached.
    setElement((current) => (current === element ? null : current));
  };
};

const rememberAutoFit = (key, value) => {
  if (autoFitCache.has(key)) {
    autoFitCache.delete(key);
  }
  autoFitCache.set(key, value);
  while (autoFitCache.size > AUTO_FIT_CACHE_LIMIT) {
    autoFitCache.delete(autoFitCache.keys().next().value);
  }
};

const useAutoFitText = ({ enabled = true, fitKey }) => {
  const [containerEl, setContainerEl] = React.useState(null);
  const [textEl, setTextEl] = React.useState(null);
  const [fontSize, setFontSize] = React.useState(null);
  const containerRef = React.useMemo(() => createLatestElementRef(setContainerEl), []);
  const textRef = React.useMemo(() => createLatestElementRef(setTextEl), []);

  React.useLayoutEffect(() => {
    if (!enabled || !containerEl || !textEl) return undefined;

    const fit = ({ ignoreCache = false } = {}) => {
      const availableWidth = Math.round(containerEl.clientWidth) * 0.995;
      const availableHeight = Math.round(containerEl.clientHeight) * 0.98;
      if (availableWidth <= 0 || availableHeight <= 0) return;

      const cacheKey = `${fitKey}|${Math.round(availableWidth)}x${Math.round(availableHeight)}`;
      const cached = ignoreCache ? null : autoFitCache.get(cacheKey);
      if (cached) {
        setFontSize((current) => (current === cached ? current : cached));
        return;
      }

      const previousFontSize = textEl.style.fontSize;
      let low = 24;
      let high = 1000;
      let best = low;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        textEl.style.fontSize = `${mid}px`;
        if (doesTextElementFit(textEl, availableWidth, availableHeight)) {
          best = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      textEl.style.fontSize = previousFontSize;
      rememberAutoFit(cacheKey, best);
      setFontSize(best);
    };

    let frame = null;
    let recoveryTimer = null;
    let cancelled = false;
    let ignoreCacheOnNextFit = false;
    const scheduleFit = ({ ignoreCache = false } = {}) => {
      if (cancelled) return;
      ignoreCacheOnNextFit = ignoreCacheOnNextFit || ignoreCache;
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = null;
        const shouldIgnoreCache = ignoreCacheOnNextFit;
        ignoreCacheOnNextFit = false;
        if (!cancelled) fit({ ignoreCache: shouldIgnoreCache });
      });
    };

    const scheduleRecoveryFit = () => {
      scheduleFit({ ignoreCache: true });
      if (recoveryTimer) window.clearTimeout(recoveryTimer);
      recoveryTimer = window.setTimeout(() => {
        recoveryTimer = null;
        scheduleFit({ ignoreCache: true });
      }, 200);
    };

    const recoverWhenVisible = () => {
      if (document.visibilityState === 'visible') scheduleRecoveryFit();
    };

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(scheduleRecoveryFit);
    resizeObserver?.observe(containerEl);
    window.addEventListener('resize', scheduleRecoveryFit);
    window.addEventListener('pageshow', scheduleRecoveryFit);
    document.addEventListener('visibilitychange', recoverWhenVisible);

    let projectionChannel = null;
    if (typeof BroadcastChannel !== 'undefined') {
      projectionChannel = new BroadcastChannel(PROJECTION_SYNC_CHANNEL);
      projectionChannel.onmessage = (event) => {
        if (event?.data?.type === PROJECTION_STATE_CHANGED_MESSAGE) {
          scheduleRecoveryFit();
        }
      };
    }

    scheduleFit();

    const fontsReady = document.fonts?.ready;
    fontsReady?.then?.(scheduleRecoveryFit).catch?.(() => {});

    return () => {
      cancelled = true;
      if (frame) window.cancelAnimationFrame(frame);
      if (recoveryTimer) window.clearTimeout(recoveryTimer);
      resizeObserver?.disconnect();
      projectionChannel?.close();
      window.removeEventListener('resize', scheduleRecoveryFit);
      window.removeEventListener('pageshow', scheduleRecoveryFit);
      document.removeEventListener('visibilitychange', recoverWhenVisible);
    };
  }, [containerEl, enabled, fitKey, textEl]);

  return {
    containerRef,
    textRef,
    fontSize,
  };
};

export default useAutoFitText;
