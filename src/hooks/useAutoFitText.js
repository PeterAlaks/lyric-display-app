import React from 'react';

const AUTO_FIT_CACHE_LIMIT = 80;
const autoFitCache = new Map();

export const getTextFitShape = (text) => String(text || '')
  .replace(/[0-9]/g, '0')
  .replace(/[A-Z]/g, 'A')
  .replace(/[a-z]/g, 'a');

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
  const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 });

  React.useLayoutEffect(() => {
    if (!enabled || !containerEl) return undefined;

    const updateSize = () => {
      const width = Math.round(containerEl.clientWidth);
      const height = Math.round(containerEl.clientHeight);
      setContainerSize((current) => (
        current.width === width && current.height === height
          ? current
          : { width, height }
      ));
    };

    let frame = null;
    const scheduleSize = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = null;
        updateSize();
      });
    };

    updateSize();
    const observer = new ResizeObserver(scheduleSize);
    observer.observe(containerEl);
    window.addEventListener('resize', scheduleSize);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', scheduleSize);
    };
  }, [containerEl, enabled]);

  React.useLayoutEffect(() => {
    if (!enabled || !containerEl || !textEl) return undefined;
    if (containerSize.width <= 0 || containerSize.height <= 0) return undefined;

    const fit = ({ ignoreCache = false } = {}) => {
      const availableWidth = containerSize.width * 0.995;
      const availableHeight = containerSize.height * 0.98;
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
        const rect = textEl.getBoundingClientRect();
        if (rect.width <= availableWidth && rect.height <= availableHeight) {
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
    let cancelled = false;
    const scheduleFit = (options) => {
      if (cancelled) return;
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = null;
        if (!cancelled) fit(options);
      });
    };

    frame = window.requestAnimationFrame(() => {
      frame = null;
      fit();
    });

    const fontsReady = document.fonts?.ready;
    fontsReady?.then?.(() => scheduleFit({ ignoreCache: true })).catch?.(() => {});

    return () => {
      cancelled = true;
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [containerEl, containerSize.height, containerSize.width, enabled, fitKey, textEl]);

  return {
    containerRef: setContainerEl,
    textRef: setTextEl,
    fontSize,
  };
};

export default useAutoFitText;
