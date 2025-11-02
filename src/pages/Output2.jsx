import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLyricsState, useOutputState, useOutput2Settings } from '../hooks/useStoreSelectors';
import useSocket from '../hooks/useSocket';
import { getLineOutputText } from '../utils/parseLyrics';
import { logDebug, logError } from '../utils/logger';
import { resolveBackendUrl } from '../utils/network';
import { calculateOptimalFontSize } from '../utils/maxLinesCalculator';

const Output2 = () => {
  const { socket, isConnected, connectionStatus, isAuthenticated, emitStyleUpdate, emitOutputMetrics } = useSocket('output2');
  const { lyrics, selectedLine, setLyrics, selectLine } = useLyricsState();
  const { isOutputOn, setIsOutputOn } = useOutputState();
  const { settings: output2Settings, updateSettings: updateOutput2Settings } = useOutput2Settings();

  const stateRequestTimeoutRef = useRef(null);
  const pendingStateRequestRef = useRef(false);

  const [adjustedFontSize, setAdjustedFontSize] = useState(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const textContainerRef = useRef(null);

  const currentLine = lyrics[selectedLine];
  const line = getLineOutputText(currentLine) || '';

  const requestCurrentStateWithRetry = useCallback((retryCount = 0) => {
    const maxRetries = 3;

    if (retryCount === 0 && pendingStateRequestRef.current) {
      logDebug('Output2: Skipping state request - pending request in progress');
      return;
    }

    if (!socket || !socket.connected || !isAuthenticated) {
      if (retryCount === 0) {
        pendingStateRequestRef.current = false;
      }
      logDebug('Output2: Cannot request state - socket not connected or authenticated');
      return;
    }

    if (retryCount >= maxRetries) {
      pendingStateRequestRef.current = false;
      logError('Output2: Max retries reached for state request');
      return;
    }

    pendingStateRequestRef.current = true;
    logDebug(`Output2: Requesting current state (attempt ${retryCount + 1})`);
    socket.emit('requestCurrentState');

    if (stateRequestTimeoutRef.current) {
      clearTimeout(stateRequestTimeoutRef.current);
    }

    stateRequestTimeoutRef.current = setTimeout(() => {
      pendingStateRequestRef.current = false;
      logDebug(`Output2: State request timeout (attempt ${retryCount + 1}), retrying...`);
      requestCurrentStateWithRetry(retryCount + 1);
    }, 3000);
  }, [socket, isAuthenticated]);

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

  useEffect(() => {
    if (!socket) return;

    const handleCurrentState = (state) => {
      logDebug('Output2: Received current state:', state);

      if (stateRequestTimeoutRef.current) {
        clearTimeout(stateRequestTimeoutRef.current);
        stateRequestTimeoutRef.current = null;
      }
      pendingStateRequestRef.current = false;

      if (state.lyrics) setLyrics(state.lyrics);
      if (state.selectedLine !== undefined) selectLine(state.selectedLine);
      if (state.output2Settings) updateOutput2Settings(state.output2Settings);
      if (typeof state.isOutputOn === 'boolean') setIsOutputOn(state.isOutputOn);
    };

    const handleLineUpdate = ({ index }) => {
      logDebug('Output2: Received line update:', index);
      selectLine(index);
    };

    const handleLyricsLoad = (newLyrics) => {
      logDebug('Output2: Received lyrics load:', newLyrics?.length, 'lines');
      setLyrics(newLyrics);
      selectLine(null);
    };

    const handleStyleUpdate = ({ output, settings }) => {
      if (output === 'output2') {
        logDebug('Output2: Received style update');
        updateOutput2Settings(settings);
      }
    };

    const handleOutputToggle = (state) => {
      logDebug('Output2: Received output toggle:', state);
      setIsOutputOn(state);
    };

    socket.on('currentState', handleCurrentState);
    socket.on('lineUpdate', handleLineUpdate);
    socket.on('lyricsLoad', handleLyricsLoad);
    socket.on('styleUpdate', handleStyleUpdate);
    socket.on('outputToggle', handleOutputToggle);

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
    };

  }, [socket, requestCurrentStateWithRetry]);

  useEffect(() => {
    logDebug(`Output2 connection status: ${connectionStatus}`);

    if (connectionStatus === 'connected' && socket) {
      setTimeout(() => requestCurrentStateWithRetry(0), 200);
    }
  }, [connectionStatus, socket, requestCurrentStateWithRetry]);

  useEffect(() => {
    if (!isConnected) return;

    const syncCheckInterval = setInterval(() => {
      logDebug('Output2: Periodic sync check');
      if (socket && socket.connected) {
        requestCurrentStateWithRetry(0);
      }
    }, 60000);

    return () => clearInterval(syncCheckInterval);
  }, [isConnected, socket, requestCurrentStateWithRetry]);

  useEffect(() => {
    return () => {
      if (stateRequestTimeoutRef.current) {
        clearTimeout(stateRequestTimeoutRef.current);
      }
    };
  }, []);

  const {
    fontStyle,
    bold,
    italic,
    underline,
    allCaps,
    fontSize,
    translationFontSizeMode = 'bound',
    translationFontSize = 48,
    fontColor,
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
    xMargin = 0,
    yMargin = 0,
    maxLinesEnabled = false,
    maxLines = 3,
    minFontSize = 24,
  } = output2Settings;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const toHexOpacity = (value) => clamp(Math.round((value / 10) * 255), 0, 255)
    .toString(16)
    .padStart(2, '0');

  const dropShadowStrength = clamp(Number(dropShadowOpacity) || 0, 0, 10);
  const backgroundStrength = clamp(Number(backgroundOpacity) || 0, 0, 10);
  const verticalMarginRem = clamp(Number(yMargin) || 0, 0, 20);
  const horizontalMarginRem = clamp(Number(xMargin) || 0, 0, 20);

  const getTextShadow = () => {
    if (!dropShadowColor || dropShadowStrength === 0) return 'none';
    const opacityHex = toHexOpacity(dropShadowStrength);
    return `${dropShadowOffsetX}px ${dropShadowOffsetY}px ${dropShadowBlur}px ${dropShadowColor}${opacityHex}`;
  };

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
  const effectiveLyricsPosition = fullScreenMode ? 'center' : (positionJustifyMap[lyricsPosition] ? lyricsPosition : 'lower');
  const justifyContent = positionJustifyMap[effectiveLyricsPosition] || 'flex-end';
  const isVisible = Boolean(isOutputOn && line);

  const fullScreenBackgroundColorValue =
    fullScreenMode && fullScreenBackgroundType === 'color'
      ? fullScreenBackgroundColor || '#000000'
      : 'transparent';

  const resolveBackgroundMediaSource = () => {
    if (!fullScreenBackgroundMedia) return null;
    if (fullScreenBackgroundMedia.dataUrl) return fullScreenBackgroundMedia.dataUrl;
    if (fullScreenBackgroundMedia.url) return resolveBackendUrl(fullScreenBackgroundMedia.url);
    return null;
  };

  const renderFullScreenMedia = () => {
    if (!fullScreenMode || fullScreenBackgroundType !== 'media') {
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
            logError('Output2: Failed to load background video:', mediaSource);
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
          logError('Output2: Failed to load background image:', mediaSource);
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
      updateOutput2Settings({ autosizerActive: false });

      if (emitOutputMetrics && isConnected && isAuthenticated) {
        try {
          emitOutputMetrics('output2', {
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

      updateOutput2Settings({ autosizerActive });

      if (emitOutputMetrics && isConnected && isAuthenticated) {
        try {
          emitOutputMetrics('output2', {
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
    isVisible,
    adjustedFontSize
  ]);

  const renderContent = () => {
    const processedText = processDisplayText(line);

    if (processedText.includes('\n')) {
      const lines = processedText.split('\n');

      const isTranslationGroup = lines.length === 2 &&
        /^[\[({<].*[\])}>\s]*$/.test(lines[1].trim());

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
                className="font-medium"
                style={{
                  ...textStrokeStyles,
                  color: (isTranslationGroup && index > 0) ? translationLineColor : 'inherit',
                  fontSize: (isTranslationGroup && index > 0) ? `${effectiveTranslationSize}px` : 'inherit'
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
                paddingLeft: `${horizontalMarginRem}rem`,
                paddingRight: `${horizontalMarginRem}rem`,
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
              <div
                ref={textContainerRef}
                style={{
                  fontFamily: fontStyle,
                  fontSize: `${(adjustedFontSize ?? fontSize)}px`,
                  fontWeight: bold ? 'bold' : 'normal',
                  fontStyle: italic ? 'italic' : 'normal',
                  textDecoration: underline ? 'underline' : 'none',
                  color: fontColor,
                  textShadow: getTextShadow(),
                  ...textStrokeStyles,
                  textAlign: 'center',
                  width: '100%',
                  maxWidth: '100%',
                  lineHeight: 1.05,
                  transition: 'font-size 200ms ease-out, opacity 500ms ease-in-out',
                  display: maxLinesEnabled ? '-webkit-box' : 'block',
                  WebkitBoxOrient: maxLinesEnabled ? 'vertical' : undefined,
                  WebkitLineClamp: maxLinesEnabled ? String(maxLines) : undefined,
                  overflow: maxLinesEnabled ? 'hidden' : 'visible',
                  textOverflow: maxLinesEnabled ? 'ellipsis' : 'clip',
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word',
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                }}
              >
                {renderContent()}
              </div>
            </div>
          ) : (
            <div
              className="leading-none"
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                width: '100%',
                opacity: isVisible ? 1 : 0,
                transition: 'opacity 300ms ease-in-out',
                pointerEvents: isVisible ? 'auto' : 'none',
              }}
            >
              <div
                ref={textContainerRef}
                style={{
                  fontFamily: fontStyle,
                  fontSize: `${(adjustedFontSize ?? fontSize)}px`,
                  fontWeight: bold ? 'bold' : 'normal',
                  fontStyle: italic ? 'italic' : 'normal',
                  textDecoration: underline ? 'underline' : 'none',
                  color: fontColor,
                  textShadow: getTextShadow(),
                  ...textStrokeStyles,
                  textAlign: 'center',
                  width: '100%',
                  maxWidth: '100%',
                  lineHeight: 1.05,
                  transition: 'font-size 200ms ease-out, opacity 500ms ease-in-out',
                  display: maxLinesEnabled ? '-webkit-box' : 'block',
                  WebkitBoxOrient: maxLinesEnabled ? 'vertical' : undefined,
                  WebkitLineClamp: maxLinesEnabled ? String(maxLines) : undefined,
                  overflow: maxLinesEnabled ? 'hidden' : 'visible',
                  textOverflow: maxLinesEnabled ? 'ellipsis' : 'clip',
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word',
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                }}
              >
                {renderContent()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Output2;