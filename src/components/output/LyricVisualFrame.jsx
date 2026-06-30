import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getLineOutputText } from '../../utils/parseLyrics';
import { resolveBackendUrl } from '../../utils/network';
import { calculateOptimalFontSize } from '../../utils/maxLinesCalculator';
import { paintToCss } from '../../utils/paint';
import { logError } from '../../utils/logger';
import ProjectionExitHint from '../ProjectionExitHint';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const toHexOpacity = (value) => clamp(Math.round((value / 10) * 255), 0, 255)
  .toString(16)
  .padStart(2, '0');

const positionJustifyMap = {
  upper: 'flex-start',
  center: 'center',
  lower: 'flex-end',
};

const VIDEO_MEDIA_EXTENSION_PATTERN = /\.(mp4|webm|ogg|ogv|m4v|mov)$/i;

const isVideoMedia = (media = {}) => (
  media?.mimeType?.startsWith?.('video/')
  || (!media?.mimeType && typeof media?.url === 'string' && VIDEO_MEDIA_EXTENSION_PATTERN.test(media.url))
);

const getMediaCacheKey = (media) => (
  media?.uploadedAt || media?.url || media?.dataUrl?.slice?.(0, 64) || 'media'
);

export default function LyricVisualFrame({
  line,
  currentLine,
  settings,
  visible = true,
  active = visible,
  previewMode = false,
  frameKey = 'preview',
  label = 'Output',
  isProjectionMode = false,
  showProjectionExitHint = false,
  className = 'relative w-full h-full overflow-hidden',
  onAutosizeChange,
  disableAnimations = false,
  backgroundVideoPlaying,
  renderBackgroundLayer = true,
  renderFullScreenElementLayer = true,
}) {
  const [adjustedFontSize, setAdjustedFontSize] = useState(null);
  const backgroundVideoRef = useRef(null);
  const textContainerRef = useRef(null);

  const safeSettings = settings || {};
  const displayLine = typeof line === 'string' ? line : (getLineOutputText(currentLine) || '');

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
          exit: { opacity: 0 },
        };
      case 'scale':
        return {
          hidden: { opacity: 0, scale: 0.9 },
          visible: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 0.9 },
        };
      case 'slide':
        return {
          hidden: { opacity: 0, y: 30 },
          visible: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: -30 },
        };
      case 'blur':
        return {
          hidden: { opacity: 0, filter: 'blur(8px)' },
          visible: { opacity: 1, filter: 'blur(0px)' },
          exit: { opacity: 0, filter: 'blur(8px)' },
        };
      default:
        return null;
    }
  };

  const animationVariants = getAnimationVariants();
  const shouldAnimate = !disableAnimations && transitionAnimation !== 'none' && animationVariants !== null;
  const dropShadowStrength = clamp(Number(dropShadowOpacity) || 0, 0, 10);
  const backgroundStrength = clamp(Number(backgroundOpacity) || 0, 0, 10);
  const verticalMarginRem = clamp(Number(yMargin) || 0, 0, 20);
  const horizontalMarginRem = clamp(Number(xMargin) || 0, 0, 20);
  const horizontalPaddingStyle = {
    paddingLeft: `${horizontalMarginRem}rem`,
    paddingRight: `${horizontalMarginRem}rem`,
    boxSizing: 'border-box',
  };
  const dropShadowPadding = (maxLinesEnabled && dropShadowStrength > 0)
    ? Math.max(dropShadowBlur, Math.abs(dropShadowOffsetY))
    : 0;

  const getTextShadow = () => {
    if (!dropShadowColor || dropShadowStrength === 0) return 'none';
    const opacityHex = toHexOpacity(dropShadowStrength);
    return `${dropShadowOffsetX}px ${dropShadowOffsetY}px ${dropShadowBlur}px ${dropShadowColor}${opacityHex}`;
  };

  const getBandBackground = () => paintToCss(backgroundPaint, backgroundColor, backgroundStrength / 10);
  const backgroundVerticalPaddingRem = backgroundBandVerticalPadding / 16;

  const getBackgroundBandHeight = () => {
    if (backgroundBandHeightMode !== 'custom' || fullScreenMode) {
      return undefined;
    }

    const effectiveFontSize = adjustedFontSize ?? fontSize;
    const textHeight = backgroundBandCustomLines * effectiveFontSize * (lineSpacing ?? 1);
    const totalPadding = 2 * backgroundBandVerticalPadding;
    return `${textHeight + totalPadding}px`;
  };

  const effectiveLyricsPosition = positionJustifyMap[lyricsPosition] ? lyricsPosition : 'lower';
  const justifyContent = positionJustifyMap[effectiveLyricsPosition] || 'flex-end';
  const isVisible = Boolean(active && visible && displayLine);
  const shouldShowFullScreenBackground = fullScreenMode && (alwaysShowBackground || active);
  const shouldRenderFullScreenBackgroundLayer = renderBackgroundLayer && shouldShowFullScreenBackground;
  const fullScreenBackgroundColorValue =
    shouldRenderFullScreenBackgroundLayer && fullScreenBackgroundType === 'color'
      ? paintToCss(fullScreenBackgroundPaint, fullScreenBackgroundColor || '#000000')
      : 'transparent';
  const windowBackgroundColor = isProjectionMode ? '#000000' : fullScreenBackgroundColorValue;

  const backgroundMediaSource = useMemo(() => {
    if (!shouldRenderFullScreenBackgroundLayer || !fullScreenBackgroundMedia) return null;
    if (fullScreenBackgroundMedia.dataUrl) return fullScreenBackgroundMedia.dataUrl;
    if (!fullScreenBackgroundMedia.url) return null;
    if (fullScreenBackgroundMedia.bundled) return fullScreenBackgroundMedia.url;

    return resolveBackendUrl(fullScreenBackgroundMedia.url);
  }, [
    fullScreenBackgroundMedia,
    shouldRenderFullScreenBackgroundLayer,
  ]);

  const backgroundMediaIsVideo = useMemo(
    () => isVideoMedia(fullScreenBackgroundMedia),
    [fullScreenBackgroundMedia]
  );

  const backgroundMediaCacheKey = useMemo(
    () => getMediaCacheKey(fullScreenBackgroundMedia),
    [fullScreenBackgroundMedia]
  );

  const isBackgroundVideoPlaybackManaged = typeof backgroundVideoPlaying === 'boolean';
  const shouldPlayBackgroundVideo = backgroundMediaIsVideo
    && Boolean(backgroundMediaSource)
    && shouldRenderFullScreenBackgroundLayer
    && (!isBackgroundVideoPlaybackManaged || backgroundVideoPlaying);

  useEffect(() => {
    const video = backgroundVideoRef.current;
    if (!video) return;

    if (!shouldPlayBackgroundVideo) {
      video.pause();
      return;
    }

    let retryTimeout = null;

    const clearRetry = () => {
      if (retryTimeout) {
        window.clearTimeout(retryTimeout);
        retryTimeout = null;
      }
    };

    const requestPlayback = () => {
      if (!backgroundVideoRef.current || !shouldPlayBackgroundVideo) return;
      const currentVideo = backgroundVideoRef.current;
      currentVideo.muted = true;
      currentVideo.loop = true;
      currentVideo.playsInline = true;
      const playPromise = currentVideo.play();
      playPromise?.catch?.(() => { });
    };

    const schedulePlaybackRetry = () => {
      clearRetry();
      retryTimeout = window.setTimeout(requestPlayback, 250);
    };

    const handleEnded = () => {
      if (!backgroundVideoRef.current) return;
      try {
        backgroundVideoRef.current.currentTime = 0;
      } catch { }
      requestPlayback();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) schedulePlaybackRetry();
    };

    requestPlayback();

    video.addEventListener('ended', handleEnded);
    video.addEventListener('pause', schedulePlaybackRetry);
    video.addEventListener('stalled', schedulePlaybackRetry);
    video.addEventListener('waiting', schedulePlaybackRetry);
    video.addEventListener('suspend', schedulePlaybackRetry);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearRetry();
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('pause', schedulePlaybackRetry);
      video.removeEventListener('stalled', schedulePlaybackRetry);
      video.removeEventListener('waiting', schedulePlaybackRetry);
      video.removeEventListener('suspend', schedulePlaybackRetry);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    backgroundMediaCacheKey,
    backgroundMediaSource,
    shouldPlayBackgroundVideo,
  ]);

  const renderFullScreenMedia = () => {
    if (!shouldRenderFullScreenBackgroundLayer || fullScreenBackgroundType !== 'media') return null;

    const media = fullScreenBackgroundMedia;
    const mediaSource = backgroundMediaSource;
    if (!media || !mediaSource) return null;

    if (backgroundMediaIsVideo) {
      return (
        <video
          key={`video-${backgroundMediaCacheKey}`}
          ref={backgroundVideoRef}
          data-lyric-background-video="true"
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover bg-black pointer-events-none select-none"
          autoPlay={!isBackgroundVideoPlaybackManaged}
          loop
          muted
          playsInline
          preload="auto"
          src={mediaSource}
          disablePictureInPicture
          disableRemotePlayback
          controls={false}
          controlsList="nodownload noplaybackrate noremoteplayback"
          style={{
            transform: 'translateZ(0)',
            backfaceVisibility: 'hidden',
            willChange: 'transform',
          }}
          onCanPlay={shouldPlayBackgroundVideo ? (event) => {
            event.currentTarget.play()?.catch?.(() => { });
          } : undefined}
          onError={() => logError(`${label}: Failed to load background video:`, mediaSource)}
        />
      );
    }

    return (
      <img
        key={`image-${backgroundMediaCacheKey}`}
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
        src={mediaSource}
        alt="Full screen lyric background"
        decoding="async"
        draggable={false}
        onError={() => logError(`${label}: Failed to load background image:`, mediaSource)}
      />
    );
  };

  const resolveFullScreenElementSource = () => {
    if (!shouldShowFullScreenBackground || !renderFullScreenElementLayer || !fullScreenElementEnabled || !fullScreenElementMedia) return null;
    if (fullScreenElementMedia.dataUrl) return fullScreenElementMedia.dataUrl;
    if (!fullScreenElementMedia.url) return null;
    return fullScreenElementMedia.bundled
      ? fullScreenElementMedia.url
      : resolveBackendUrl(fullScreenElementMedia.url);
  };

  const getElementPlacementStyles = () => {
    const safePaddingX = clamp(Number(fullScreenElementPaddingX) || 0, 0, 500);
    const safePaddingY = clamp(Number(fullScreenElementPaddingY) || 0, 0, 500);
    const [vertical = 'center', horizontal = 'center'] = (fullScreenElementPosition || 'center').split('-');
    const styles = {};
    const transforms = [];

    if (vertical === 'top') styles.top = `${safePaddingY}px`;
    else if (vertical === 'bottom') styles.bottom = `${safePaddingY}px`;
    else {
      styles.top = '50%';
      transforms.push('translateY(-50%)');
    }

    if (horizontal === 'left') styles.left = `${safePaddingX}px`;
    else if (horizontal === 'right') styles.right = `${safePaddingX}px`;
    else {
      styles.left = '50%';
      transforms.push('translateX(-50%)');
    }

    if (transforms.length > 0) styles.transform = transforms.join(' ');
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
        onError={() => logError(`${label}: Failed to load full screen image element:`, source)}
      />
    );
  };

  const effectiveBorderSize = clamp(Number(borderSize) || 0, 0, 10);
  const textStrokeValue = effectiveBorderSize > 0
    ? `${effectiveBorderSize}px ${borderColor}`
    : '0px transparent';
  const textStrokeStyles = {
    WebkitTextStroke: textStrokeValue,
    textStroke: textStrokeValue,
    paintOrder: 'stroke fill',
    WebkitPaintOrder: 'stroke fill',
  };
  const processDisplayText = (text) => (allCaps ? text.toUpperCase() : text);

  useEffect(() => {
    if (!maxLinesEnabled) {
      if (adjustedFontSize !== null) {
        setAdjustedFontSize(null);
      }
      onAutosizeChange?.({ adjustedFontSize: null, autosizerActive: false });
      return;
    }

    if (!displayLine || !isVisible) return;

    const rafId = requestAnimationFrame(() => {
      const containerWidth = textContainerRef.current ? textContainerRef.current.clientWidth : null;
      const result = calculateOptimalFontSize({
        text: displayLine,
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
      onAutosizeChange?.({
        adjustedFontSize: safeAdjusted,
        autosizerActive: Boolean(maxLinesEnabled && safeAdjusted !== null && safeAdjusted !== fontSize),
      });
    });

    return () => cancelAnimationFrame(rafId);
  }, [
    maxLinesEnabled,
    displayLine,
    fontSize,
    maxLines,
    minFontSize,
    fontStyle,
    bold,
    italic,
    horizontalMarginRem,
    allCaps,
    isVisible,
    adjustedFontSize,
    onAutosizeChange,
  ]);

  const renderContent = () => {
    const processedText = processDisplayText(displayLine);

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
    textAlign,
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
              key={`text-${keyPrefix}-${frameKey}-${displayLine}`}
              ref={textContainerRef}
              variants={animationVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{
                duration: transitionSpeed / 1000,
                ease: [0.25, 0.46, 0.45, 0.94],
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
          transition: previewMode ? undefined : 'font-size 200ms ease-out, opacity 500ms ease-in-out',
        }}
      >
        {renderContent()}
      </div>
    );
  };

  return (
    <div
      className={className}
      style={{
        background: windowBackgroundColor,
        contain: 'layout style paint',
        isolation: 'isolate',
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
                paddingTop: `${backgroundVerticalPaddingRem}rem`,
                paddingBottom: `${backgroundVerticalPaddingRem}rem`,
                ...horizontalPaddingStyle,
                height: getBackgroundBandHeight(),
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                width: '100%',
                transition: previewMode ? undefined : 'opacity 300ms ease-in-out, background-color 200ms ease-in-out',
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
                transition: previewMode ? undefined : 'opacity 300ms ease-in-out',
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
}
