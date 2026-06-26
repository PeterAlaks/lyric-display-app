import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useLyricsState, useOutputState, useOutputSettings, useOutputEnabled, useCustomOutputIds } from '../hooks/useStoreSelectors';
import useSocket from '../hooks/useSocket';
import { getLineOutputText } from '../utils/parseLyrics';
import { logDebug, logError } from '../utils/logger';
import { resolveBackendUrl } from '../utils/network';
import { calculateOptimalFontSize } from '../utils/maxLinesCalculator';
import { paintToCss } from '../utils/paint';
import ProjectionExitHint from '../components/ProjectionExitHint';

/**
 * Generic output page component. Renders lyrics with full styling support.
 *
 * @param {Object} props
 * @param {string} props.outputId - The output identifier (e.g. 'output1', 'output2').
 *   Used as the socket role, store settings key, and log label.
 */
const OutputPage = ({ outputId }) => {
  const label = outputId.charAt(0).toUpperCase() + outputId.slice(1);
  const location = useLocation();

  const isDefaultOutput = outputId === 'output1' || outputId === 'output2';
  const customOutputIds = useCustomOutputIds();
  const isOutputAvailable = isDefaultOutput || customOutputIds.includes(outputId);
  const discoveryEnabled = !isDefaultOutput && !isOutputAvailable;
  const searchParams = new URLSearchParams(location.search);
  const isPreviewMode = searchParams.get('preview') === 'true';
  const isProjectionMode = ['1', 'true'].includes((searchParams.get('projection') || '').toLowerCase());
  const showProjectionExitHint = ['1', 'true'].includes((searchParams.get('escapeHint') || '').toLowerCase());

  useSocket('output-discovery', {
    enabled: discoveryEnabled,
  });

  const { isConnected, isAuthenticated, emitOutputMetrics } = useSocket(outputId, {
    enabled: isOutputAvailable,
    preview: isPreviewMode,
  });
  const { settings: outputSettings, updateSettings: updateOutputSettings } = useOutputSettings(outputId);
  const outputEnabled = useOutputEnabled(outputId);
  const { lyrics, selectedLine } = useLyricsState();
  const { isOutputOn } = useOutputState();

  const [adjustedFontSize, setAdjustedFontSize] = useState(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const textContainerRef = useRef(null);


  const [preloadedVideoUrl, setPreloadedVideoUrl] = useState(null);
  const [isPreloading, setIsPreloading] = useState(false);
  const preloadAbortControllerRef = useRef(null);

  const currentLine = lyrics[selectedLine];
  const line = getLineOutputText(currentLine) || '';

  useEffect(() => {
    const modeStyle = isProjectionMode
      ? 'background: #000000 !important'
      : 'background: transparent !important';
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');

    if (html) html.setAttribute('style', modeStyle);
    if (body) body.setAttribute('style', modeStyle);
    if (root) root.setAttribute('style', modeStyle);

    return () => {
      if (html) html.removeAttribute('style');
      if (body) body.removeAttribute('style');
      if (root) root.removeAttribute('style');
    };
  }, [isProjectionMode]);


  const safeSettings = outputSettings || {};

  const {
    fontStyle,
    bold,
    italic,
    underline,
    allCaps,
    textAlign = 'center',
    letterSpacing = 0,
    lineSpacing = 1,
    fontSize = 48,
    translationFontSizeMode = 'bound',
    translationFontSize = 48,
    fontColor = '#FFFFFF',
    translationLineColor = '#FBBF24',
    borderColor = '#000000',
    borderSize = 0,
    dropShadowColor = '#000000',
    dropShadowOpacity = 0,
    dropShadowOffsetX = 0,
    dropShadowOffsetY = 8,
    dropShadowBlur = 10,
    backgroundColor = '#000000',
    backgroundPaint,
    backgroundOpacity = 0,
    backgroundBandVerticalPadding = 20,
    backgroundBandHeightMode = 'adaptive',
    backgroundBandCustomLines = 3,
    lyricsPosition = 'lower',
    fullScreenMode = false,
    fullScreenBackgroundType = 'color',
    fullScreenBackgroundColor = '#000000',
    fullScreenBackgroundPaint,
    fullScreenBackgroundMedia,
    fullScreenElementEnabled = false,
    fullScreenElementMedia,
    fullScreenElementScale = 25,
    fullScreenElementPosition = 'center',
    fullScreenElementPaddingX = 0,
    fullScreenElementPaddingY = 0,
    fullScreenElementOpacity = 2.5,
    fullScreenElementBlur = 0,
    alwaysShowBackground = false,
    xMargin = 0,
    yMargin = 0,
    maxLinesEnabled = false,
    maxLines = 3,
    minFontSize = 24,
    transitionAnimation = 'none',
    transitionSpeed = 150,
  } = safeSettings;

  const getAnimationVariants = () => {
    switch (transitionAnimation) {
      case 'fade':
        return {
          hidden: { opacity: 0 },
          visible: { opacity: 1 },
          exit: { opacity: 0 }
        };
      case 'scale':
        return {
          hidden: { opacity: 0, scale: 0.9 },
          visible: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 0.9 }
        };
      case 'slide':
        return {
          hidden: { opacity: 0, y: 30 },
          visible: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: -30 }
        };
      case 'blur':
        return {
          hidden: { opacity: 0, filter: 'blur(8px)' },
          visible: { opacity: 1, filter: 'blur(0px)' },
          exit: { opacity: 0, filter: 'blur(8px)' }
        };
      default:
        return null;
    }
  };

  const animationVariants = getAnimationVariants();
  const shouldAnimate = transitionAnimation !== 'none' && animationVariants !== null;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const toHexOpacity = (value) => clamp(Math.round((value / 10) * 255), 0, 255)
    .toString(16)
    .padStart(2, '0');

  const dropShadowStrength = clamp(Number(dropShadowOpacity) || 0, 0, 10);
  const backgroundStrength = clamp(Number(backgroundOpacity) || 0, 0, 10);
  const verticalMarginRem = clamp(Number(yMargin) || 0, 0, 20);
  const horizontalMarginRem = clamp(Number(xMargin) || 0, 0, 20);
  const horizontalPaddingStyle = {
    paddingLeft: `${horizontalMarginRem}rem`,
    paddingRight: `${horizontalMarginRem}rem`,
    boxSizing: 'border-box',
  };

  const getTextShadow = () => {
    if (!dropShadowColor || dropShadowStrength === 0) return 'none';
    const opacityHex = toHexOpacity(dropShadowStrength);
    return `${dropShadowOffsetX}px ${dropShadowOffsetY}px ${dropShadowBlur}px ${dropShadowColor}${opacityHex}`;
  };
  const dropShadowPadding = (maxLinesEnabled && dropShadowStrength > 0)
    ? Math.max(dropShadowBlur, Math.abs(dropShadowOffsetY))
    : 0;

  const getBandBackground = () => paintToCss(backgroundPaint, backgroundColor, backgroundStrength / 10);

  const BACKGROUND_VERTICAL_PADDING_REM = backgroundBandVerticalPadding / 16;

  const getBackgroundBandHeight = () => {
    if (backgroundBandHeightMode !== 'custom' || fullScreenMode) {
      return undefined;
    }

    const lineHeight = lineSpacing ?? 1;
    const effectiveFontSize = adjustedFontSize ?? fontSize;
    const textHeight = backgroundBandCustomLines * effectiveFontSize * lineHeight;
    const totalPadding = 2 * backgroundBandVerticalPadding;
    return `${textHeight + totalPadding}px`;
  };

  const positionJustifyMap = {
    upper: 'flex-start',
    center: 'center',
    lower: 'flex-end',
  };
  const effectiveLyricsPosition = positionJustifyMap[lyricsPosition] ? lyricsPosition : 'lower';
  const justifyContent = positionJustifyMap[effectiveLyricsPosition] || 'flex-end';

  const isOutputActive = Boolean(outputSettings)
    && (isPreviewMode || Boolean(isOutputOn && (outputEnabled !== false)));
  const isVisible = Boolean(isOutputActive && line);
  const shouldShowFullScreenBackground = fullScreenMode && (alwaysShowBackground || isOutputActive);

  const fullScreenBackgroundColorValue =
    shouldShowFullScreenBackground && fullScreenBackgroundType === 'color'
      ? paintToCss(fullScreenBackgroundPaint, fullScreenBackgroundColor || '#000000')
      : 'transparent';

  const windowBackgroundColor = isProjectionMode ? '#000000' : fullScreenBackgroundColorValue;

  useEffect(() => {
    const preloadVideo = async () => {
      if (isPreviewMode || !shouldShowFullScreenBackground || fullScreenBackgroundType !== 'media' || !fullScreenBackgroundMedia) {
        return;
      }

      const media = fullScreenBackgroundMedia;
      const isVideo = media.mimeType?.startsWith('video/') ||
        (!media.mimeType && typeof media.url === 'string' && /\.(mp4|webm|ogg|m4v|mov)$/i.test(media.url));

      if (!isVideo) {
        return;
      }

      if (media.bundled) {
        return;
      }

      const sourceUrl = media.url ? resolveBackendUrl(media.url) : null;
      if (!sourceUrl || isPreloading) {
        return;
      }

      const currentVideoId = `${media.url}-${media.uploadedAt}`;
      const preloadedVideoId = preloadedVideoUrl ? preloadedVideoUrl.split('#')[1] : null;
      if (preloadedVideoId === currentVideoId) {
        return;
      }

      if (preloadedVideoUrl) {
        URL.revokeObjectURL(preloadedVideoUrl);
        setPreloadedVideoUrl(null);
      }

      if (preloadAbortControllerRef.current) {
        preloadAbortControllerRef.current.abort();
      }

      setIsPreloading(true);
      const abortController = new AbortController();
      preloadAbortControllerRef.current = abortController;

      try {
        logDebug(`${label}: Preloading video into memory:`, sourceUrl);

        const response = await fetch(sourceUrl, {
          signal: abortController.signal,
          cache: 'force-cache',
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        const blobUrlWithId = `${blobUrl}#${currentVideoId}`;
        setPreloadedVideoUrl(blobUrlWithId);

        logDebug(`${label}: Video preloaded successfully, size:`, (blob.size / 1024 / 1024).toFixed(2), 'MB');
      } catch (error) {
        if (error.name === 'AbortError') {
          logDebug(`${label}: Video preload aborted`);
        } else {
          logError(`${label}: Failed to preload video:`, error.message);
        }
      } finally {
        setIsPreloading(false);
        if (preloadAbortControllerRef.current === abortController) {
          preloadAbortControllerRef.current = null;
        }
      }
    };

    preloadVideo();

    return () => {
      if (preloadAbortControllerRef.current) {
        preloadAbortControllerRef.current.abort();
        preloadAbortControllerRef.current = null;
      }
    };
  }, [fullScreenMode, fullScreenBackgroundType, fullScreenBackgroundMedia?.url, fullScreenBackgroundMedia?.uploadedAt, shouldShowFullScreenBackground, label, isPreviewMode]);

  useEffect(() => {
    return () => {
      if (preloadedVideoUrl) {
        const cleanUrl = preloadedVideoUrl.split('#')[0];
        URL.revokeObjectURL(cleanUrl);
      }
    };
  }, [preloadedVideoUrl]);

  const resolveBackgroundMediaSource = () => {
    if (!shouldShowFullScreenBackground || !fullScreenBackgroundMedia) return null;
    if (fullScreenBackgroundMedia.dataUrl) return fullScreenBackgroundMedia.dataUrl;
    if (fullScreenBackgroundMedia.url) {
      if (fullScreenBackgroundMedia.bundled) {
        return fullScreenBackgroundMedia.url;
      }

      const isVideo = fullScreenBackgroundMedia.mimeType?.startsWith('video/') ||
        (!fullScreenBackgroundMedia.mimeType && typeof fullScreenBackgroundMedia.url === 'string' &&
          /\.(mp4|webm|ogg|m4v|mov)$/i.test(fullScreenBackgroundMedia.url));

      if (isVideo && preloadedVideoUrl) {
        return preloadedVideoUrl.split('#')[0];
      }

      return resolveBackendUrl(fullScreenBackgroundMedia.url);
    }
    return null;
  };

  const renderFullScreenMedia = () => {
    if (!shouldShowFullScreenBackground || fullScreenBackgroundType !== 'media') {
      return null;
    }

    const media = fullScreenBackgroundMedia;
    const mediaSource = resolveBackgroundMediaSource();
    if (!media || !mediaSource) {
      return null;
    }

    const isVideo = media.mimeType?.startsWith('video/') ||
      (!media.mimeType && typeof media.url === 'string' && /\.(mp4|webm|ogg|m4v|mov)$/i.test(media.url));

    const cacheKey = media.uploadedAt || Date.now();

    if (isVideo) {
      return (
        <video
          key={`video-${cacheKey}`}
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          src={mediaSource}
          onError={(e) => {
            logError(`${label}: Failed to load background video:`, mediaSource);
          }}
        />
      );
    }

    return (
      <img
        key={`image-${cacheKey}`}
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover"
        src={mediaSource}
        alt="Full screen lyric background"
        onError={(e) => {
          logError(`${label}: Failed to load background image:`, mediaSource);
        }}
      />
    );
  };

  const resolveFullScreenElementSource = () => {
    if (!shouldShowFullScreenBackground || !fullScreenElementEnabled || !fullScreenElementMedia) return null;
    if (fullScreenElementMedia.dataUrl) return fullScreenElementMedia.dataUrl;
    if (fullScreenElementMedia.url) {
      return fullScreenElementMedia.bundled
        ? fullScreenElementMedia.url
        : resolveBackendUrl(fullScreenElementMedia.url);
    }
    return null;
  };

  const getElementPlacementStyles = () => {
    const safePaddingX = clamp(Number(fullScreenElementPaddingX) || 0, 0, 500);
    const safePaddingY = clamp(Number(fullScreenElementPaddingY) || 0, 0, 500);
    const position = fullScreenElementPosition || 'center';
    const [vertical = 'center', horizontal = 'center'] = position.split('-');

    const styles = {};
    const transforms = [];

    if (vertical === 'top') {
      styles.top = `${safePaddingY}px`;
    } else if (vertical === 'bottom') {
      styles.bottom = `${safePaddingY}px`;
    } else {
      styles.top = '50%';
      transforms.push('translateY(-50%)');
    }

    if (horizontal === 'left') {
      styles.left = `${safePaddingX}px`;
    } else if (horizontal === 'right') {
      styles.right = `${safePaddingX}px`;
    } else {
      styles.left = '50%';
      transforms.push('translateX(-50%)');
    }

    if (transforms.length > 0) {
      styles.transform = transforms.join(' ');
    }

    return { styles, safePaddingX, safePaddingY };
  };

  const renderFullScreenElement = () => {
    const source = resolveFullScreenElementSource();
    if (!source) return null;

    const scale = clamp(Number(fullScreenElementScale) || 25, 1, 100);
    const opacity = clamp(Number(fullScreenElementOpacity) || 2.5, 1, 10) / 10;
    const blur = clamp(Number(fullScreenElementBlur) || 0, 0, 100);
    const { styles, safePaddingX, safePaddingY } = getElementPlacementStyles();

    return (
      <img
        key={`fullscreen-element-${fullScreenElementMedia?.url || fullScreenElementMedia?.uploadedAt || 'media'}`}
        aria-hidden="true"
        src={source}
        alt=""
        className="absolute pointer-events-none select-none"
        style={{
          ...styles,
          zIndex: 5,
          width: `${scale}vw`,
          maxWidth: `calc(100vw - ${safePaddingX * 2}px)`,
          maxHeight: `calc(100vh - ${safePaddingY * 2}px)`,
          objectFit: 'contain',
          opacity,
          filter: blur > 0 ? `blur(${blur}px)` : undefined,
        }}
        onError={() => {
          logError(`${label}: Failed to load full screen image element:`, source);
        }}
      />
    );
  };

  const effectiveBorderSize = Math.min(10, Math.max(0, Number(borderSize) || 0));
  const textStrokeValue = effectiveBorderSize > 0
    ? `${effectiveBorderSize}px ${borderColor}`
    : '0px transparent';
  const textStrokeStyles = {
    WebkitTextStroke: textStrokeValue,
    textStroke: textStrokeValue,
    paintOrder: 'stroke fill',
    WebkitPaintOrder: 'stroke fill',
  };

  const processDisplayText = (text) => {
    return allCaps ? text.toUpperCase() : text;
  };

  useEffect(() => {
    if (!maxLinesEnabled) {
      if (adjustedFontSize !== null) {
        setAdjustedFontSize(null);
        setIsTruncated(false);
      }
      updateOutputSettings({ autosizerActive: false });

      if (!isPreviewMode && emitOutputMetrics && isConnected && isAuthenticated) {
        try {
          emitOutputMetrics(outputId, {
            adjustedFontSize: null,
            autosizerActive: false,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            timestamp: Date.now(),
          });
        } catch { }
      }
      return;
    }

    if (!line || !isVisible) {
      return;
    }

    const rafId = requestAnimationFrame(() => {
      const containerWidth = textContainerRef.current ? textContainerRef.current.clientWidth : null;
      const result = calculateOptimalFontSize({
        text: line,
        fontSize,
        maxLines,
        minFontSize,
        fontStyle,
        bold,
        italic,
        horizontalMarginRem,
        processDisplayText,
        currentAdjustedSize: adjustedFontSize,
        maxLinesEnabled,
        containerWidth,
      });

      const safeAdjusted = (result.adjustedSize === null)
        ? null
        : (Number.isFinite(result.adjustedSize) && result.adjustedSize > 0 ? result.adjustedSize : null);

      setAdjustedFontSize(safeAdjusted);
      setIsTruncated(Boolean(result.isTruncated));

      const autosizerActive = Boolean(maxLinesEnabled && safeAdjusted !== null && safeAdjusted !== fontSize);

      updateOutputSettings({ autosizerActive });

      if (!isPreviewMode && emitOutputMetrics && isConnected && isAuthenticated) {
        try {
          emitOutputMetrics(outputId, {
            adjustedFontSize: safeAdjusted,
            autosizerActive,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            timestamp: Date.now(),
          });
        } catch { }
      }
    });

    return () => cancelAnimationFrame(rafId);
  }, [
    maxLinesEnabled,
    line,
    fontSize,
    maxLines,
    minFontSize,
    fontStyle,
    bold,
    italic,
    horizontalMarginRem,
    allCaps,
    letterSpacing,
    isVisible,
    adjustedFontSize,
    isPreviewMode
  ]);

  const renderContent = () => {
    const processedText = processDisplayText(line);

    if (processedText.includes('\n')) {
      const lines = processedText.split('\n');

      const isTranslationGroup = currentLine?.type === 'group' && lines.length === 2;

      const effectiveTranslationSize = translationFontSizeMode === 'custom'
        ? translationFontSize
        : (adjustedFontSize ?? fontSize);

      return (
        <div className="space-y-1">
          {lines.map((lineText, index) => {
            const lineDisplayText = (isTranslationGroup && index > 0)
              ? lineText.replace(/^[\[({<]|[\])}>\s]*$/g, '').trim()
              : lineText;

            return (
              <div
                key={index}
                style={{
                  ...textStrokeStyles,
                  color: (isTranslationGroup && index > 0) ? translationLineColor : 'inherit',
                  fontSize: (isTranslationGroup && index > 0) ? `${effectiveTranslationSize}px` : 'inherit',
                  fontWeight: bold ? 'bold' : 'normal',
                }}
              >
                {lineDisplayText}
              </div>
            );
          })}
        </div>
      );
    }

    return processedText;
  };

  const textStyles = {
    fontFamily: fontStyle,
    fontSize: `${(adjustedFontSize ?? fontSize)}px`,
    fontWeight: bold ? 'bold' : 'normal',
    fontStyle: italic ? 'italic' : 'normal',
    textDecoration: underline ? 'underline' : 'none',
    color: fontColor,
    textShadow: getTextShadow(),
    ...textStrokeStyles,
    textAlign: textAlign,
    letterSpacing: letterSpacing ? `${letterSpacing}px` : undefined,
    width: '100%',
    maxWidth: '100%',
    lineHeight: lineSpacing ?? 1,
    display: maxLinesEnabled ? '-webkit-box' : 'block',
    WebkitBoxOrient: maxLinesEnabled ? 'vertical' : undefined,
    WebkitLineClamp: maxLinesEnabled ? String(maxLines) : undefined,
    overflow: maxLinesEnabled ? 'hidden' : 'visible',
    textOverflow: maxLinesEnabled ? 'ellipsis' : 'clip',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
    paddingBottom: dropShadowPadding ? `${dropShadowPadding}px` : undefined,
  };

  const renderTextBlock = (keyPrefix) => {
    if (shouldAnimate) {
      return (
        <AnimatePresence mode="wait">
          {isVisible && (
            <motion.div
              key={`text-${keyPrefix}-${selectedLine}-${line}`}
              ref={textContainerRef}
              variants={animationVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{
                duration: transitionSpeed / 1000,
                ease: [0.25, 0.46, 0.45, 0.94]
              }}
              style={textStyles}
            >
              {renderContent()}
            </motion.div>
          )}
        </AnimatePresence>
      );
    }

    return (
      <div
        ref={textContainerRef}
        style={{
          ...textStyles,
          transition: 'font-size 200ms ease-out, opacity 500ms ease-in-out',
        }}
      >
        {renderContent()}
      </div>
    );
  };

  return (
    <div
      className="relative w-screen h-screen overflow-hidden"
      style={{
        background: windowBackgroundColor,
      }}
    >
      {renderFullScreenMedia()}
      {renderFullScreenElement()}
      <ProjectionExitHint visible={isProjectionMode && showProjectionExitHint} />
      <div
        className="relative z-10 flex w-full h-full"
        style={{
          justifyContent,
          flexDirection: 'column',
          alignItems: 'stretch',
          paddingTop: `${verticalMarginRem}rem`,
          paddingBottom: `${verticalMarginRem}rem`,
        }}
      >
        <div className="flex w-full justify-center">
          {(!fullScreenMode && backgroundStrength > 0) ? (
            <div
              style={{
                background: getBandBackground(),
                paddingTop: `${BACKGROUND_VERTICAL_PADDING_REM}rem`,
                paddingBottom: `${BACKGROUND_VERTICAL_PADDING_REM}rem`,
                ...horizontalPaddingStyle,
                height: getBackgroundBandHeight(),
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                width: '100%',
                transition: 'opacity 300ms ease-in-out, background-color 200ms ease-in-out',
                opacity: isVisible ? 1 : 0,
                pointerEvents: isVisible ? 'auto' : 'none',
              }}
              className="leading-none"
            >
              {renderTextBlock('band')}
            </div>
          ) : (
            <div
              className="leading-none"
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                width: '100%',
                ...horizontalPaddingStyle,
                opacity: isVisible ? 1 : 0,
                transition: 'opacity 300ms ease-in-out',
                pointerEvents: isVisible ? 'auto' : 'none',
              }}
            >
              {renderTextBlock('full')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OutputPage;
