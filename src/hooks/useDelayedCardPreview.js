import { useCallback, useEffect, useRef, useState } from 'react';
import {
  calculateExpandedCardLayout,
  TEMPLATE_CARD_HOVER_DELAY,
  TEMPLATE_CARD_PREVIEW_ANIMATION_MS,
} from '../utils/templateCardPreview';

const clearTimer = (timerRef) => {
  if (timerRef.current) {
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }
};

const useDelayedCardPreview = ({ delay = TEMPLATE_CARD_HOVER_DELAY } = {}) => {
  const [expandedCard, setExpandedCard] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const hoverTimerRef = useRef(null);
  const handoffTimerRef = useRef(null);
  const removalTimerRef = useRef(null);

  const closeExpandedCard = useCallback(() => {
    clearTimer(hoverTimerRef);
    clearTimer(handoffTimerRef);
    setIsExpanded(false);
    clearTimer(removalTimerRef);
    removalTimerRef.current = window.setTimeout(() => {
      setExpandedCard(null);
      removalTimerRef.current = null;
    }, TEMPLATE_CARD_PREVIEW_ANIMATION_MS);
  }, []);

  const beginCardHover = useCallback((key, payload, element) => {
    clearTimer(hoverTimerRef);
    clearTimer(handoffTimerRef);

    hoverTimerRef.current = window.setTimeout(() => {
      if (!element?.isConnected) return;
      const rect = element.getBoundingClientRect();
      const sourceRect = {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };

      setExpandedCard({
        key,
        payload,
        sourceRect,
        layout: calculateExpandedCardLayout({
          sourceRect,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        }),
      });
      hoverTimerRef.current = null;
    }, delay);
  }, [delay]);

  const cancelCardHover = useCallback(() => {
    clearTimer(hoverTimerRef);
  }, []);

  const endCardHover = useCallback((key) => {
    clearTimer(hoverTimerRef);
    if (expandedCard?.key !== key) return;

    clearTimer(handoffTimerRef);
    handoffTimerRef.current = window.setTimeout(() => {
      closeExpandedCard();
      handoffTimerRef.current = null;
    }, 120);
  }, [closeExpandedCard, expandedCard]);

  const keepExpandedCardOpen = useCallback(() => {
    clearTimer(handoffTimerRef);
  }, []);

  useEffect(() => {
    if (!expandedCard) return undefined;
    setIsExpanded(false);
    const animationFrame = window.requestAnimationFrame(() => setIsExpanded(true));
    return () => window.cancelAnimationFrame(animationFrame);
  }, [expandedCard]);

  useEffect(() => () => {
    clearTimer(hoverTimerRef);
    clearTimer(handoffTimerRef);
    clearTimer(removalTimerRef);
  }, []);

  const expandedCardStyle = expandedCard ? {
    position: 'fixed',
    left: expandedCard.layout.left,
    top: expandedCard.layout.top,
    width: expandedCard.layout.width,
    height: expandedCard.layout.height,
    opacity: isExpanded ? 1 : 0.62,
    transform: isExpanded
      ? 'translate3d(0, 0, 0) scale(1)'
      : `translate3d(${expandedCard.layout.initialTranslateX}px, ${expandedCard.layout.initialTranslateY}px, 0) scale(${expandedCard.layout.initialScale})`,
    transformOrigin: 'center center',
    transition: [
      `transform ${TEMPLATE_CARD_PREVIEW_ANIMATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
      `opacity ${Math.round(TEMPLATE_CARD_PREVIEW_ANIMATION_MS * 0.65)}ms ease`,
    ].join(', '),
    zIndex: 2700,
  } : null;

  return {
    beginCardHover,
    cancelCardHover,
    closeExpandedCard,
    endCardHover,
    expandedCard,
    expandedCardStyle,
    isExpanded,
    keepExpandedCardOpen,
  };
};

export default useDelayedCardPreview;
