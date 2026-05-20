import { useCallback, useEffect, useRef } from 'react';

const findScrollableParent = (node) => {
  let current = node?.parentElement;
  while (current) {
    const style = window.getComputedStyle(current);
    const canScroll = current.scrollHeight > current.clientHeight &&
      /(auto|scroll|overlay)/i.test(style.overflowY || '');
    if (canScroll) return current;
    current = current.parentElement;
  }
  return null;
};

const useFullscreenAdvancedAutoExpand = ({
  fullScreenAdvancedExpanded,
  fullScreenModeChecked,
  handleFullScreenToggle,
  setFullScreenAdvancedExpanded,
}) => {
  const prevFullScreenRef = useRef(fullScreenModeChecked);
  const fullScreenAdvancedRef = useRef(null);
  const prevFullScreenAdvancedExpandedRef = useRef(fullScreenAdvancedExpanded);

  useEffect(() => {
    const wasFullScreen = prevFullScreenRef.current;
    if (!wasFullScreen && fullScreenModeChecked) {
      setFullScreenAdvancedExpanded(true);
    }
    prevFullScreenRef.current = fullScreenModeChecked;
  }, [fullScreenModeChecked, setFullScreenAdvancedExpanded]);

  const fullScreenAdvancedVisible = fullScreenAdvancedExpanded;
  const fullScreenControlsDisabled = !fullScreenModeChecked && fullScreenAdvancedExpanded;

  useEffect(() => {
    const wasExpanded = prevFullScreenAdvancedExpandedRef.current;
    const isNowExpanded = fullScreenAdvancedVisible;

    if (!wasExpanded && isNowExpanded) {
      const scrollTarget = fullScreenAdvancedRef.current;
      if (!scrollTarget) {
        prevFullScreenAdvancedExpandedRef.current = isNowExpanded;
        return undefined;
      }

      const scrollToReveal = () => {
        const container = findScrollableParent(scrollTarget);
        const padding = 24;
        if (container) {
          const containerRect = container.getBoundingClientRect();
          const targetRect = scrollTarget.getBoundingClientRect();
          const overflowBottom = targetRect.bottom - containerRect.bottom + padding;
          if (overflowBottom > 0) {
            container.scrollTo({
              top: container.scrollTop + overflowBottom,
              behavior: 'smooth'
            });
          }
          return;
        }

        const targetRect = scrollTarget.getBoundingClientRect();
        const overflowWindow = targetRect.bottom - window.innerHeight + padding;
        if (overflowWindow > 0) {
          window.scrollBy({ top: overflowWindow, behavior: 'smooth' });
        }
      };

      const timeout = window.setTimeout(scrollToReveal, 120);
      prevFullScreenAdvancedExpandedRef.current = isNowExpanded;
      return () => window.clearTimeout(timeout);
    }

    prevFullScreenAdvancedExpandedRef.current = isNowExpanded;
    return undefined;
  }, [fullScreenAdvancedVisible]);

  const handleFullScreenToggleWithExpand = useCallback((checked) => {
    handleFullScreenToggle(checked);
    if (checked) {
      setFullScreenAdvancedExpanded(true);
    }
  }, [handleFullScreenToggle, setFullScreenAdvancedExpanded]);

  return {
    fullScreenAdvancedRef,
    fullScreenAdvancedVisible,
    fullScreenControlsDisabled,
    handleFullScreenToggleWithExpand,
  };
};

export default useFullscreenAdvancedAutoExpand;
