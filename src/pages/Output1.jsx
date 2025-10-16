import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLyricsState, useOutputState, useOutput1Settings } from '../hooks/useStoreSelectors';
import useSocket from '../hooks/useSocket';
import { getLineOutputText } from '../utils/parseLyrics';
import { logDebug, logError } from '../utils/logger';
import { resolveBackendUrl } from '../utils/network';

const Output1 = () => {
  const { socket, isConnected, connectionStatus, isAuthenticated } = useSocket('output1');
  const { lyrics, selectedLine, setLyrics, selectLine } = useLyricsState();
  const { isOutputOn, setIsOutputOn } = useOutputState();
  const { settings: output1Settings, updateSettings: updateOutput1Settings } = useOutput1Settings();

  const stateRequestTimeoutRef = useRef(null);
  const pendingStateRequestRef = useRef(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  const currentLine = lyrics[selectedLine];
  const line = getLineOutputText(currentLine) || '';

  const requestCurrentStateWithRetry = useCallback((retryCount = 0) => {
    const maxRetries = 3;

    if (retryCount === 0 && pendingStateRequestRef.current) {
      logDebug('Output1: Skipping state request - pending request in progress');
      return;
    }

    if (!socket || !socket.connected || !isAuthenticated) {
      if (retryCount === 0) {
        pendingStateRequestRef.current = false;
      }
      logDebug('Output1: Cannot request state - socket not connected or authenticated');
      return;
    }

    if (retryCount >= maxRetries) {
      pendingStateRequestRef.current = false;
      logError('Output1: Max retries reached for state request');
      return;
    }

    pendingStateRequestRef.current = true;
    logDebug(`Output1: Requesting current state (attempt ${retryCount + 1})`);
    socket.emit('requestCurrentState');

    if (stateRequestTimeoutRef.current) {
      clearTimeout(stateRequestTimeoutRef.current);
    }

    stateRequestTimeoutRef.current = setTimeout(() => {
      pendingStateRequestRef.current = false;
      logDebug(`Output1: State request timeout (attempt ${retryCount + 1}), retrying...`);
      requestCurrentStateWithRetry(retryCount + 1);
    }, 3000);
  }, [socket, isAuthenticated]);

  useEffect(() => {
    if (!socket) return;

    const handleCurrentState = (state) => {
      logDebug('Output1: Received current state:', state);
      setLastSyncTime(Date.now());

      if (stateRequestTimeoutRef.current) {
        clearTimeout(stateRequestTimeoutRef.current);
        stateRequestTimeoutRef.current = null;
      }
      pendingStateRequestRef.current = false;

      if (state.lyrics) setLyrics(state.lyrics);
      if (state.selectedLine !== undefined) selectLine(state.selectedLine);
      if (state.output1Settings) updateOutput1Settings(state.output1Settings);
      if (typeof state.isOutputOn === 'boolean') setIsOutputOn(state.isOutputOn);
    };

    const handleLineUpdate = ({ index }) => {
      logDebug('Output1: Received line update:', index);
      selectLine(index);
    };

    const handleLyricsLoad = (newLyrics) => {
      logDebug('Output1: Received lyrics load:', newLyrics?.length, 'lines');
      setLyrics(newLyrics);
      selectLine(null);
    };

    const handleStyleUpdate = ({ output, settings }) => {
      if (output === 'output1') {
        logDebug('Output1: Received style update');
        updateOutput1Settings(settings);
      }
    };

    const handleOutputToggle = (state) => {
      logDebug('Output1: Received output toggle:', state);
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
    logDebug(`Output1 connection status: ${connectionStatus}`);

    if (connectionStatus === 'connected' && socket) {
      setTimeout(() => requestCurrentStateWithRetry(0), 200);
    }
  }, [connectionStatus, socket, requestCurrentStateWithRetry]);

  useEffect(() => {
    if (!isConnected) return;

    const syncCheckInterval = setInterval(() => {
      logDebug('Output1: Periodic sync check');
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
    fontColor,
    borderColor = '#000000',
    borderSize = 0,
    dropShadowColor = '#000000',
    dropShadowOpacity = 0,
    backgroundColor = '#000000',
    backgroundOpacity = 0,
    lyricsPosition = 'lower',
    fullScreenMode = false,
    fullScreenBackgroundType = 'color',
    fullScreenBackgroundColor = '#000000',
    fullScreenBackgroundMedia,
    xMargin = 0,
    yMargin = 0,
  } = output1Settings;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const toHexOpacity = (value) => clamp(Math.round((value / 10) * 255), 0, 255)
    .toString(16)
    .padStart(2, '0');

  const dropShadowStrength = clamp(Number(dropShadowOpacity) || 0, 0, 10);
  const backgroundStrength = clamp(Number(backgroundOpacity) || 0, 0, 10);
  const verticalMarginRem = clamp(Number(yMargin) || 0, 0, 20);
  const horizontalMarginRem = clamp(Number(xMargin) || 0, 0, 20);

  const getTextShadow = () => {
    if (!dropShadowColor) return 'none';
    const opacityHex = toHexOpacity(dropShadowStrength);
    return `0px 8px 10px ${dropShadowColor}${opacityHex}`;
  };

  const getBandBackground = () => {
    const opacityHex = toHexOpacity(backgroundStrength);
    return `${backgroundColor}${opacityHex}`;
  };

  const BACKGROUND_VERTICAL_PADDING_REM = 1.5;
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
            logError('Output1: Failed to load background video:', mediaSource);
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
          logError('Output1: Failed to load background image:', mediaSource);
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

  const renderContent = () => {
    const processedText = processDisplayText(line);

    if (processedText.includes('\n')) {
      const lines = processedText.split('\n');
      return (
        <div className="space-y-1">
          {lines.map((lineText, index) => {
            const displayText = index > 0
              ? lineText.replace(/^[\[({<]|[\])}>\s]*$/g, '').trim()
              : lineText;

            return (
              <div
                key={index}
                className="font-medium"
                style={{
                  ...textStrokeStyles,
                  color: index > 0 ? '#FBBF24' : 'inherit'
                }}
              >
                {displayText}
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
          <div
            style={{
              backgroundColor: !fullScreenMode && backgroundStrength > 0 ? getBandBackground() : 'transparent',
              paddingTop: `${BACKGROUND_VERTICAL_PADDING_REM}rem`,
              paddingBottom: `${BACKGROUND_VERTICAL_PADDING_REM}rem`,
              paddingLeft: `${horizontalMarginRem}rem`,
              paddingRight: `${horizontalMarginRem}rem`,
              display: 'flex',
              justifyContent: 'center',
              width: '100%',
              transition: 'opacity 300ms ease-in-out, background-color 200ms ease-in-out',
              opacity: isVisible ? 1 : 0,
              pointerEvents: isVisible ? 'auto' : 'none',
            }}
            className="leading-none"
          >
            <div
              style={{
                fontFamily: fontStyle,
                fontSize: `${fontSize}px`,
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
              }}
              className="transition-opacity duration-500 ease-in-out"
            >
              {renderContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Output1;