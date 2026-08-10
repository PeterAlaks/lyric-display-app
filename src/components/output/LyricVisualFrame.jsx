import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getLineOutputText } from '../../utils/parseLyrics';
import { resolveBackendUrl } from '../../utils/network';
import { calculateOptimalFontSize } from '../../utils/maxLinesCalculator';
import { paintToCss } from '../../utils/paint';
import { logError } from '../../utils/logger';
import ProjectionExitHint from '../ProjectionExitHint';
import {
  getTransitionVariants,
  normalizeTransitionDuration,
} from '../../../shared/transitionSettings.js';

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

const IMMEDIATE_BACKGROUND_VARIANTS = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const FullScreenBackgroundLayer = ({
  background,
  isReady,
  isVisible,
  label,
  onReady,
  playbackRequested,
  transitionSeconds,
  transitionVariants,
}) => {
  const imageRef = useRef(null);
  const videoRef = useRef(null);
  const readyReportedRef = useRef(false);
  const effectiveVariants = transitionVariants || IMMEDIATE_BACKGROUND_VARIANTS;

  const reportReady = useCallback(() => {
    if (readyReportedRef.current) return;
    readyReportedRef.current = true;
    onReady?.(background.key);
  }, [background.key, onReady]);

  const reportReadyAfterPaint = useCallback(() => {
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      reportReady();
      return;
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(reportReady);
    });
  }, [reportReady]);

  useEffect(() => {
    if (background.kind !== 'image') return;
    const image = imageRef.current;
    if (!image?.complete || image.naturalWidth <= 0) return;

    if (typeof image.decode === 'function') {
      image.decode().catch(() => { }).then(reportReadyAfterPaint);
    } else {
      reportReadyAfterPaint();
    }
  }, [background.key, background.kind, reportReadyAfterPaint]);

  useEffect(() => {
    if (background.kind !== 'video') return undefined;
    const video = videoRef.current;
    if (!video) return undefined;

    let retryTimeout = null;

    const clearRetry = () => {
      if (retryTimeout) {
        window.clearTimeout(retryTimeout);
        retryTimeout = null;
      }
    };

    const reportVideoReady = () => {
      if (video.readyState >= 2) {
        reportReadyAfterPaint();
      }
    };

    const requestPlayback = () => {
      if (!playbackRequested) return;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      const playPromise = video.play();
      playPromise?.then?.(reportVideoReady).catch?.(() => { });
    };

    const schedulePlaybackRetry = () => {
      clearRetry();
      retryTimeout = window.setTimeout(requestPlayback, 250);
    };

    const handleEnded = () => {
      try {
        video.currentTime = 0;
      } catch { }
      requestPlayback();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) schedulePlaybackRetry();
    };

    reportVideoReady();

    if (playbackRequested) {
      requestPlayback();
    } else {
      video.pause();
    }

    video.addEventListener('loadeddata', reportVideoReady);
    video.addEventListener('canplay', reportVideoReady);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('pause', schedulePlaybackRetry);
    video.addEventListener('stalled', schedulePlaybackRetry);
    video.addEventListener('waiting', schedulePlaybackRetry);
    video.addEventListener('suspend', schedulePlaybackRetry);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearRetry();
      video.removeEventListener('loadeddata', reportVideoReady);
      video.removeEventListener('canplay', reportVideoReady);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('pause', schedulePlaybackRetry);
      video.removeEventListener('stalled', schedulePlaybackRetry);
      video.removeEventListener('waiting', schedulePlaybackRetry);
      video.removeEventListener('suspend', schedulePlaybackRetry);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [background.key, background.kind, playbackRequested, reportReadyAfterPaint]);

  const motionProps = {
    variants: effectiveVariants,
    initial: 'hidden',
    animate: isReady && isVisible ? 'visible' : 'hidden',
    transition: {
      duration: transitionVariants ? transitionSeconds : 0,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  };

  if (background.kind === 'color') {
    return (
      <motion.div
        data-lyric-background-color="true"
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{ background: background.value }}
        {...motionProps}
      />
    );
  }

  if (background.kind === 'video') {
    return (
      <motion.video
        ref={videoRef}
        data-lyric-background-video="true"
        data-background-layer-key={background.key}
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover bg-black pointer-events-none select-none"
        autoPlay={playbackRequested}
        loop
        muted
        playsInline
        preload="auto"
        src={background.source}
        disablePictureInPicture
        disableRemotePlayback
        controls={false}
        controlsList="nodownload noplaybackrate noremoteplayback"
        style={{
          backfaceVisibility: 'hidden',
          willChange: transitionVariants ? 'transform, opacity, filter' : 'transform',
        }}
        {...motionProps}
        onError={() => logError(`${label}: Failed to load background video:`, background.source)}
      />
    );
  }

  return (
    <motion.img
      ref={imageRef}
      data-background-layer-key={background.key}
      aria-hidden="true"
      className="absolute inset-0 h-full w-full object-cover pointer-events-none select-none"
      src={background.source}
      alt="Full screen lyric background"
      decoding="async"
      draggable={false}
      {...motionProps}
      onLoad={(event) => {
        const image = event.currentTarget;
        if (typeof image.decode === 'function') {
          image.decode().catch(() => { }).then(reportReadyAfterPaint);
        } else {
          reportReadyAfterPaint();
        }
      }}
      onError={() => logError(`${label}: Failed to load background image:`, background.source)}
    />
  );
};

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
  retainBackgroundLayerWhenInactive = false,
  retainContentWhenInactive = false,
}) {
  const [adjustedFontSize, setAdjustedFontSize] = useState(null);
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
    fullScreenBackgroundOpacity = 10,
    fullScreenBackgroundMedia,
    backgroundMediaTransitionAnimation = 'fade',
    backgroundMediaTransitionDuration = 300,
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

  const animationVariants = getTransitionVariants(transitionAnimation);
  const shouldAnimate = !disableAnimations && transitionAnimation !== 'none' && animationVariants !== null;
  const backgroundTransitionVariants = useMemo(
    () => (disableAnimations ? null : getTransitionVariants(backgroundMediaTransitionAnimation)),
    [backgroundMediaTransitionAnimation, disableAnimations]
  );
  const backgroundTransitionSeconds = normalizeTransitionDuration(backgroundMediaTransitionDuration, 300) / 1000;
  const dropShadowStrength = clamp(Number(dropShadowOpacity) || 0, 0, 10);
  const backgroundStrength = clamp(Number(backgroundOpacity) || 0, 0, 10);
  const parsedFullScreenBackgroundOpacity = Number(fullScreenBackgroundOpacity);
  const fullScreenBackgroundStrength = Number.isFinite(parsedFullScreenBackgroundOpacity)
    ? clamp(parsedFullScreenBackgroundOpacity, 0, 10) / 10
    : 1;
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
  const isVisible = Boolean((active || retainContentWhenInactive) && visible && displayLine);
  const shouldShowFullScreenBackground = fullScreenMode
    && (alwaysShowBackground || active || retainBackgroundLayerWhenInactive);
  const shouldRenderFullScreenBackgroundLayer = renderBackgroundLayer && shouldShowFullScreenBackground;
  const fullScreenBackgroundColorValue = paintToCss(
    fullScreenBackgroundPaint,
    fullScreenBackgroundColor || '#000000'
  );
  const frameFallbackBackground = isProjectionMode && renderBackgroundLayer ? '#000000' : 'transparent';

  const backgroundMediaSource = useMemo(() => {
    if (!fullScreenBackgroundMedia) return null;
    if (fullScreenBackgroundMedia.dataUrl) return fullScreenBackgroundMedia.dataUrl;
    if (!fullScreenBackgroundMedia.url) return null;
    if (fullScreenBackgroundMedia.bundled) return fullScreenBackgroundMedia.url;

    return resolveBackendUrl(fullScreenBackgroundMedia.url);
  }, [fullScreenBackgroundMedia]);

  const backgroundMediaIsVideo = useMemo(
    () => isVideoMedia(fullScreenBackgroundMedia),
    [fullScreenBackgroundMedia]
  );

  const backgroundMediaCacheKey = useMemo(
    () => getMediaCacheKey(fullScreenBackgroundMedia),
    [fullScreenBackgroundMedia]
  );

  const isBackgroundVideoPlaybackManaged = typeof backgroundVideoPlaying === 'boolean';
  const shouldPlayBackgroundVideo = shouldRenderFullScreenBackgroundLayer
    && (!retainBackgroundLayerWhenInactive || active)
    && (!isBackgroundVideoPlaybackManaged || backgroundVideoPlaying);

  const desiredFullScreenBackground = useMemo(() => {
    if (!fullScreenMode || !renderBackgroundLayer) return null;

    if (fullScreenBackgroundType === 'color') {
      return {
        key: `color-${fullScreenBackgroundColorValue}`,
        kind: 'color',
        value: fullScreenBackgroundColorValue,
      };
    }

    if (fullScreenBackgroundType !== 'media' || !fullScreenBackgroundMedia || !backgroundMediaSource) {
      return null;
    }

    const kind = backgroundMediaIsVideo ? 'video' : 'image';
    return {
      key: `${kind}-${backgroundMediaCacheKey}`,
      kind,
      source: backgroundMediaSource,
    };
  }, [
    backgroundMediaCacheKey,
    backgroundMediaIsVideo,
    backgroundMediaSource,
    fullScreenBackgroundColorValue,
    fullScreenBackgroundMedia,
    fullScreenBackgroundType,
    fullScreenMode,
    renderBackgroundLayer,
  ]);

  const [backgroundState, setBackgroundState] = useState({
    current: null,
    incoming: null,
    incomingReady: false,
  });

  useEffect(() => {
    setBackgroundState((previous) => {
      if (!desiredFullScreenBackground) {
        if (!previous.incoming) return previous;
        return { ...previous, incoming: null, incomingReady: false };
      }

      if (previous.current?.key === desiredFullScreenBackground.key) {
        return {
          current: desiredFullScreenBackground,
          incoming: null,
          incomingReady: false,
        };
      }

      if (previous.incoming?.key === desiredFullScreenBackground.key) {
        return { ...previous, incoming: desiredFullScreenBackground };
      }

      return {
        ...previous,
        incoming: desiredFullScreenBackground,
        incomingReady: desiredFullScreenBackground.kind === 'color',
      };
    });
  }, [desiredFullScreenBackground]);

  const handleBackgroundReady = useCallback((backgroundKey) => {
    setBackgroundState((previous) => (
      previous.incoming?.key === backgroundKey
        ? { ...previous, incomingReady: true }
        : previous
    ));
  }, []);

  useEffect(() => {
    if (!backgroundState.incoming || !backgroundState.incomingReady) return undefined;

    const transitionDelay = backgroundState.current
      && shouldRenderFullScreenBackgroundLayer
      && backgroundTransitionVariants
      ? backgroundTransitionSeconds * 1000
      : 0;

    const timeout = window.setTimeout(() => {
      setBackgroundState((previous) => {
        if (!previous.incoming || !previous.incomingReady) return previous;
        return {
          current: previous.incoming,
          incoming: null,
          incomingReady: false,
        };
      });
    }, transitionDelay);

    return () => window.clearTimeout(timeout);
  }, [
    backgroundState.current,
    backgroundState.incoming,
    backgroundState.incomingReady,
    backgroundTransitionSeconds,
    backgroundTransitionVariants,
    shouldRenderFullScreenBackgroundLayer,
  ]);

  useEffect(() => {
    if (desiredFullScreenBackground || !backgroundState.current) return undefined;

    const transitionDelay = shouldRenderFullScreenBackgroundLayer && backgroundTransitionVariants
      ? backgroundTransitionSeconds * 1000
      : 0;
    const timeout = window.setTimeout(() => {
      setBackgroundState((previous) => ({ ...previous, current: null }));
    }, transitionDelay);

    return () => window.clearTimeout(timeout);
  }, [
    backgroundState.current,
    backgroundTransitionSeconds,
    backgroundTransitionVariants,
    desiredFullScreenBackground,
    shouldRenderFullScreenBackgroundLayer,
  ]);

  const renderFullScreenBackground = () => {
    const layers = [];
    const incomingIsReady = Boolean(backgroundState.incoming && backgroundState.incomingReady);

    if (backgroundState.current) {
      layers.push({
        background: backgroundState.current,
        isReady: true,
        isVisible: Boolean(
          desiredFullScreenBackground
          && shouldRenderFullScreenBackgroundLayer
          && !incomingIsReady
        ),
      });
    }

    if (backgroundState.incoming) {
      layers.push({
        background: backgroundState.incoming,
        isReady: backgroundState.incomingReady,
        isVisible: Boolean(shouldRenderFullScreenBackgroundLayer && backgroundState.incomingReady),
      });
    }

    return layers.map(({ background, isReady, isVisible }) => (
      <div
        key={background.key}
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: fullScreenBackgroundStrength,
          transition: previewMode ? undefined : 'opacity 150ms ease-out',
        }}
      >
        <FullScreenBackgroundLayer
          background={background}
          isReady={isReady}
          isVisible={isVisible}
          label={label}
          onReady={handleBackgroundReady}
          playbackRequested={background.kind === 'video' && shouldPlayBackgroundVideo}
          transitionSeconds={backgroundTransitionSeconds}
          transitionVariants={backgroundTransitionVariants}
        />
      </div>
    ));
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
      data-lyric-visual-frame="true"
      data-lyrics-position={effectiveLyricsPosition}
      data-fullscreen-mode={fullScreenMode ? 'true' : 'false'}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: frameFallbackBackground,
      }}
    >
      {renderFullScreenBackground()}
      {renderFullScreenElement()}
      <ProjectionExitHint visible={isProjectionMode && showProjectionExitHint} />
      <div
        data-lyric-position-layer="true"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          zIndex: 10,
          display: 'flex',
          justifyContent,
          flexDirection: 'column',
          alignItems: 'stretch',
          paddingTop: `${verticalMarginRem}rem`,
          paddingBottom: `${verticalMarginRem}rem`,
          boxSizing: 'border-box',
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
