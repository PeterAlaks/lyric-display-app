import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLyricsState, useOutputState, useOutputSettings, useOutputEnabled } from '../hooks/useStoreSelectors';
import useLyricsStore from '../context/LyricsStore';
import useSocket from '../hooks/useSocket';
import { getLineOutputText } from '../utils/parseLyrics';
import { logDebug, logError } from '../utils/logger';
import { resolveBackendUrl } from '../utils/network';
import { calculateOptimalFontSize } from '../utils/maxLinesCalculator';

/**
 * Generic output page component. Renders lyrics with full styling support.
 *
 * @param {Object} props
 * @param {string} props.outputId - The output identifier (e.g. 'output1', 'output2').
 *   Used as the socket role, store settings key, and log label.
 */
const OutputPage = ({ outputId }) => {
  const label = outputId.charAt(0).toUpperCase() + outputId.slice(1);

  const isDefaultOutput = outputId === 'output1' || outputId === 'output2';
  const [isOutputAvailable, setIsOutputAvailable] = useState(isDefaultOutput);

  // Only connect when the output exists on the server (or is a default output).
  const { socket, isConnected, connectionStatus, isAuthenticated, emitOutputMetrics } = useSocket(outputId, {
    enabled: isOutputAvailable,
  });
  const { settings: outputSettings, updateSettings: updateOutputSettings } = useOutputSettings(outputId);
  const outputEnabled = useOutputEnabled(outputId);
  const { lyrics, selectedLine, setLyrics, selectLine } = useLyricsState();
  const { isOutputOn, setIsOutputOn } = useOutputState();

  const isPreviewMode = new URLSearchParams(window.location.search).get('preview') === 'true';

  const stateRequestTimeoutRef = useRef(null);
  const pendingStateRequestRef = useRef(false);
  const [isOutputRemoved, setIsOutputRemoved] = useState(false);
  const lastStateRequestAtRef = useRef(0);
  const lastStateReceivedAtRef = useRef(0);

  const [adjustedFontSize, setAdjustedFontSize] = useState(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const textContainerRef = useRef(null);


  const [preloadedVideoUrl, setPreloadedVideoUrl] = useState(null);
  const [isPreloading, setIsPreloading] = useState(false);
  const preloadAbortControllerRef = useRef(null);

  const currentLine = lyrics[selectedLine];
  const line = getLineOutputText(currentLine) || '';

  const requestCurrentStateWithRetry = useCallback((retryCount = 0) => {
    const maxRetries = 3;
    const now = Date.now();
    const minRequestIntervalMs = 1500;
    const minSinceReceiveMs = 1500;

    if (isOutputRemoved || !isOutputAvailable) {
      return;
    }

    if (now - lastStateRequestAtRef.current < minRequestIntervalMs) {
      logDebug(`${label}: Skipping state request - throttled`);
      return;
    }

    if (lastStateReceivedAtRef.current && (now - lastStateReceivedAtRef.current) < minSinceReceiveMs) {
      logDebug(`${label}: Skipping state request - recently synced`);
      return;
    }

    if (retryCount === 0 && pendingStateRequestRef.current) {
      logDebug(`${label}: Skipping state request - pending request in progress`);
      return;
    }

    if (!socket || !socket.connected || !isAuthenticated) {
      if (retryCount === 0) {
        pendingStateRequestRef.current = false;
      }
      logDebug(`${label}: Cannot request state - socket not connected or authenticated`);
      return;
    }

    if (retryCount >= maxRetries) {
      pendingStateRequestRef.current = false;
      logError(`${label}: Max retries reached for state request`);
      return;
    }

    lastStateRequestAtRef.current = now;
    pendingStateRequestRef.current = true;
    logDebug(`${label}: Requesting current state (attempt ${retryCount + 1})`);
    socket.emit('requestCurrentState');

    if (stateRequestTimeoutRef.current) {
      clearTimeout(stateRequestTimeoutRef.current);
    }

    stateRequestTimeoutRef.current = setTimeout(() => {
      pendingStateRequestRef.current = false;
      logDebug(`${label}: State request timeout (attempt ${retryCount + 1}), retrying...`);
      requestCurrentStateWithRetry(retryCount + 1);
    }, 3000);
  }, [socket, isAuthenticated, label, isOutputRemoved, isOutputAvailable]);

  useEffect(() => {
    const transparentStyle = 'background: transparent !important';
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');

    if (html) html.setAttribute('style', transparentStyle);
    if (body) body.setAttribute('style', transparentStyle);
    if (root) root.setAttribute('style', transparentStyle);

    return () => {
      if (html) html.removeAttribute('style');
      if (body) body.removeAttribute('style');
      if (root) root.removeAttribute('style');
    };
  }, []);

  const clearLocalOutputSettings = useCallback(() => {
    useLyricsStore.setState({
      [`${outputId}Settings`]: undefined,
      [`${outputId}Enabled`]: undefined,
    });
  }, [outputId]);

  useEffect(() => {
    if (isDefaultOutput) return;

    let isActive = true;

    const checkAvailability = async () => {
      try {
        const response = await fetch(resolveBackendUrl(`/api/outputs/${outputId}`), { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        if (!isActive) return;
        if (typeof data?.exists === 'boolean') {
          setIsOutputAvailable(data.exists);
          if (!data.exists) {
            setIsOutputRemoved(true);
            clearLocalOutputSettings();
          }
        }
      } catch { }
    };

    checkAvailability();

    if (isOutputAvailable) return () => { isActive = false; };

    const interval = setInterval(checkAvailability, 3000);
    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [outputId, isDefaultOutput, isOutputAvailable, clearLocalOutputSettings]);

  useEffect(() => {
    if (!socket) return;

    const settingsKey = `${outputId}Settings`;

    const handleCurrentState = (state) => {
      logDebug(`${label}: Received current state:`, state);

      if (stateRequestTimeoutRef.current) {
        clearTimeout(stateRequestTimeoutRef.current);
        stateRequestTimeoutRef.current = null;
      }
      pendingStateRequestRef.current = false;
      lastStateReceivedAtRef.current = Date.now();

      if (state.lyrics) setLyrics(state.lyrics);
      if (state.selectedLine !== undefined) selectLine(state.selectedLine);
      if (Object.prototype.hasOwnProperty.call(state, settingsKey)) {
        updateOutputSettings(state[settingsKey] || {});
        setIsOutputRemoved(false);
        setIsOutputAvailable(true);
      } else if (outputId !== 'output1' && outputId !== 'output2') {
        clearLocalOutputSettings();
        setIsOutputRemoved(true);
        setIsOutputAvailable(false);
      }
      if (typeof state.isOutputOn === 'boolean') setIsOutputOn(state.isOutputOn);
    };

    const handleLineUpdate = ({ index }) => {
      logDebug(`${label}: Received line update:`, index);
      selectLine(index);
    };

    const handleLyricsLoad = (newLyrics) => {
      logDebug(`${label}: Received lyrics load:`, newLyrics?.length, 'lines');
      setLyrics(newLyrics);
      selectLine(null);
    };

    const handleStyleUpdate = ({ output, settings }) => {
      if (output === outputId) {
        logDebug(`${label}: Received style update`);
        updateOutputSettings(settings);
        setIsOutputRemoved(false);
        setIsOutputAvailable(true);
      }
    };

    const handleOutputToggle = (state) => {
      logDebug(`${label}: Received output toggle:`, state);
      setIsOutputOn(state);
    };

    const handleOutputRemoved = ({ output }) => {
      if (output === outputId) {
        logDebug(`${label}: Output removed, clearing local settings`);
        clearLocalOutputSettings();
        setIsOutputRemoved(true);
        setIsOutputAvailable(false);
        if (stateRequestTimeoutRef.current) {
          clearTimeout(stateRequestTimeoutRef.current);
          stateRequestTimeoutRef.current = null;
        }
        pendingStateRequestRef.current = false;
        lastStateRequestAtRef.current = 0;
        lastStateReceivedAtRef.current = 0;
      }
    };

    socket.on('currentState', handleCurrentState);
    socket.on('lineUpdate', handleLineUpdate);
    socket.on('lyricsLoad', handleLyricsLoad);
    socket.on('styleUpdate', handleStyleUpdate);
    socket.on('outputToggle', handleOutputToggle);
    socket.on('outputRemoved', handleOutputRemoved);

    if (socket.connected) {
      setTimeout(() => requestCurrentStateWithRetry(0), 100);
    }

    return () => {
      if (stateRequestTimeoutRef.current) {
        clearTimeout(stateRequestTimeoutRef.current);
      }
      pendingStateRequestRef.current = false;
      socket.off('currentState', handleCurrentState);
      socket.off('lineUpdate', handleLineUpdate);
      socket.off('lyricsLoad', handleLyricsLoad);
      socket.off('styleUpdate', handleStyleUpdate);
      socket.off('outputToggle', handleOutputToggle);
      socket.off('outputRemoved', handleOutputRemoved);
    };

  }, [socket, requestCurrentStateWithRetry, outputId, label, clearLocalOutputSettings, updateOutputSettings, setIsOutputOn]);

  useEffect(() => {
    logDebug(`${label} connection status: ${connectionStatus}`);

    if (!isOutputRemoved && isOutputAvailable && connectionStatus === 'connected' && socket) {
      setTimeout(() => requestCurrentStateWithRetry(0), 200);
    }
  }, [connectionStatus, socket, requestCurrentStateWithRetry, label, isOutputRemoved, isOutputAvailable]);

  useEffect(() => {
    if (!isConnected || isOutputRemoved || !isOutputAvailable) return;

    const syncCheckInterval = setInterval(() => {
      logDebug(`${label}: Periodic sync check`);
      if (socket && socket.connected) {
        requestCurrentStateWithRetry(0);
      }
    }, 60000);

    return () => clearInterval(syncCheckInterval);
  }, [isConnected, socket, requestCurrentStateWithRetry, label, isOutputRemoved, isOutputAvailable]);

  useEffect(() => {
    return () => {
      if (stateRequestTimeoutRef.current) {
        clearTimeout(stateRequestTimeoutRef.current);
      }
    };
  }, []);

  // Use an empty fallback so destructure never crashes when output hasn't been created yet.
  const safeSettings = outputSettings || {};

  const {
    fontStyle,
    bold,
    italic,
    underline,
    allCaps,
    textAlign = 'center',
    letterSpacing = 0,
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
    backgroundOpacity = 0,
    backgroundBandVerticalPadding = 20,
    backgroundBandHeightMode = 'adaptive',
    backgroundBandCustomLines = 3,
    lyricsPosition = 'lower',
    fullScreenMode = false,
    fullScreenBackgroundType = 'color',
    fullScreenBackgroundColor = '#000000',
    fullScreenBackgroundMedia,
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

  const getBandBackground = () => {
    const opacityHex = toHexOpacity(backgroundStrength);
    return `${backgroundColor}${opacityHex}`;
  };

  const BACKGROUND_VERTICAL_PADDING_REM = backgroundBandVerticalPadding / 16;

  const getBackgroundBandHeight = () => {
    if (backgroundBandHeightMode !== 'custom' || fullScreenMode) {
      return undefined;
    }

    const lineHeight = 1.05;
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

  // Only show content if this output has settings (either from store or received from server).
  // outputEnabled defaults to true when undefined (custom output not yet in local store).
  const isOutputActive = Boolean(outputSettings)
    && (isPreviewMode || Boolean(isOutputOn && (outputEnabled !== false)));
  const isVisible = Boolean(isOutputActive && line);
  const shouldShowFullScreenBackground = fullScreenMode && (alwaysShowBackground || isOutputActive);

  const fullScreenBackgroundColorValue =
    shouldShowFullScreenBackground && fullScreenBackgroundType === 'color'
      ? fullScreenBackgroundColor || '#000000'
      : 'transparent';

  useEffect(() => {
    const preloadVideo = async () => {
      if (!shouldShowFullScreenBackground || fullScreenBackgroundType !== 'media' || !fullScreenBackgroundMedia) {
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
  }, [fullScreenMode, fullScreenBackgroundType, fullScreenBackgroundMedia?.url, fullScreenBackgroundMedia?.uploadedAt, shouldShowFullScreenBackground, label]);

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

      if (emitOutputMetrics && isConnected && isAuthenticated) {
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

      if (emitOutputMetrics && isConnected && isAuthenticated) {
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
    adjustedFontSize
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
    lineHeight: 1.05,
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
        backgroundColor: fullScreenBackgroundColorValue,
      }}
    >
      {renderFullScreenMedia()}
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
                backgroundColor: getBandBackground(),
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