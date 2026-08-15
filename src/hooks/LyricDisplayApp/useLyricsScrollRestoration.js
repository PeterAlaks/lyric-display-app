import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import {
  armLyricsScrollRestore,
  getRememberedLyricsScrollPosition,
  isLyricsScrollRestorePending,
  markLyricsScrollRestoreApplied,
  rememberLyricsScrollPosition,
} from '../../utils/lyricsScrollMemory.js';

export const useResetLyricsScroll = (lyricsContainerRef) => {
  useEffect(() => {
    const handleResetScroll = () => {
      if (lyricsContainerRef.current) lyricsContainerRef.current.scrollTop = 0;
    };

    window.addEventListener('reset-lyrics-scroll', handleResetScroll);
    return () => window.removeEventListener('reset-lyrics-scroll', handleResetScroll);
  }, [lyricsContainerRef]);
};

export function useArmLyricsScrollRestoreOnUnmount(lyricsKey) {
  const latestKeyRef = useRef(lyricsKey);
  latestKeyRef.current = lyricsKey;

  useLayoutEffect(() => () => {
    armLyricsScrollRestore(latestKeyRef.current);
  }, []);
}

export function useLyricsScrollRestoration({
  enabled = true,
  getElement,
  lyricsKey,
  scope = 'control',
}) {
  const stableGetElement = useCallback(() => getElement?.() || null, [getElement]);

  useLayoutEffect(() => {
    if (!enabled || !lyricsKey) return undefined;

    let element = null;
    let frameId = null;
    let attempts = 0;
    let disposed = false;

    const handleScroll = () => {
      if (element) {
        rememberLyricsScrollPosition(scope, lyricsKey, element.scrollTop);
      }
    };

    const attach = () => {
      if (disposed) return;
      element = stableGetElement();
      if (!element) {
        attempts += 1;
        if (attempts < 6) frameId = window.requestAnimationFrame(attach);
        return;
      }

      if (isLyricsScrollRestorePending(lyricsKey)) {
        const remembered = getRememberedLyricsScrollPosition(scope, lyricsKey);
        if (remembered !== null) {
          const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
          element.scrollTop = Math.min(remembered, maxScrollTop);
        }
        markLyricsScrollRestoreApplied(lyricsKey);
      }

      element.addEventListener('scroll', handleScroll, { passive: true });
    };

    attach();

    return () => {
      disposed = true;
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      if (element) {
        rememberLyricsScrollPosition(scope, lyricsKey, element.scrollTop);
        element.removeEventListener('scroll', handleScroll);
      }
    };
  }, [enabled, lyricsKey, scope, stableGetElement]);
}
