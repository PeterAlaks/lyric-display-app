import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLyricsState, useOutputState, useOutput2Settings } from '../hooks/useStoreSelectors';
import useSocket from '../hooks/useSocket';
import { getLineOutputText } from '../utils/parseLyrics';
import { logDebug, logError } from '../utils/logger';

const Output2 = () => {
  const { socket, isConnected, connectionStatus, isAuthenticated } = useSocket('output2');
  const { lyrics, selectedLine, setLyrics, selectLine } = useLyricsState();
  const { isOutputOn, setIsOutputOn } = useOutputState();
  const { settings: output2Settings, updateSettings: updateOutput2Settings } = useOutput2Settings();

  const stateRequestTimeoutRef = useRef(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // Get the current line and process it for output
  const currentLine = lyrics[selectedLine];
  const line = getLineOutputText(currentLine) || '';

  // Robust state request function with retry logic
  const requestCurrentStateWithRetry = useCallback((retryCount = 0) => {
    const maxRetries = 3;

    if (!socket || !socket.connected || !isAuthenticated) {
      logDebug('Output2: Cannot request state - socket not connected or authenticated');
      return;
    }

    if (retryCount >= maxRetries) {
      logError('Output2: Max retries reached for state request');
      return;
    }

    logDebug(`Output2: Requesting current state (attempt ${retryCount + 1})`);
    socket.emit('requestCurrentState');

    // Set timeout for response
    if (stateRequestTimeoutRef.current) {
      clearTimeout(stateRequestTimeoutRef.current);
    }

    stateRequestTimeoutRef.current = setTimeout(() => {
      logDebug(`Output2: State request timeout (attempt ${retryCount + 1}), retrying...`);
      requestCurrentStateWithRetry(retryCount + 1);
    }, 3000); // 3 second timeout per attempt
  }, [socket]);

  // Enhanced socket setup with retry logic
  useEffect(() => {
    if (!socket) return;

    // Set up event listeners
    const handleCurrentState = (state) => {
      logDebug('Output2: Received current state:', state);
      setLastSyncTime(Date.now());

      // Clear any pending timeout
      if (stateRequestTimeoutRef.current) {
        clearTimeout(stateRequestTimeoutRef.current);
        stateRequestTimeoutRef.current = null;
      }

      // Apply received state
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

    // Set up listeners
    socket.on('currentState', handleCurrentState);
    socket.on('lineUpdate', handleLineUpdate);
    socket.on('lyricsLoad', handleLyricsLoad);
    socket.on('styleUpdate', handleStyleUpdate);
    socket.on('outputToggle', handleOutputToggle);

    // Request current state when socket is ready
    if (socket.connected) {
      setTimeout(() => requestCurrentStateWithRetry(0), 100);
    }

    return () => {
      if (stateRequestTimeoutRef.current) {
        clearTimeout(stateRequestTimeoutRef.current);
      }
      socket.off('currentState', handleCurrentState);
      socket.off('lineUpdate', handleLineUpdate);
      socket.off('lyricsLoad', handleLyricsLoad);
      socket.off('styleUpdate', handleStyleUpdate);
      socket.off('outputToggle', handleOutputToggle);
    };
  }, [socket, requestCurrentStateWithRetry, setLyrics, selectLine, updateOutput2Settings, setIsOutputOn]);

  // Monitor connection status and re-request state on connection
  useEffect(() => {
    logDebug(`Output2 connection status: ${connectionStatus}`);

    if (connectionStatus === 'connected' && socket) {
      setTimeout(() => requestCurrentStateWithRetry(0), 200);
    }
  }, [connectionStatus, socket, requestCurrentStateWithRetry]);

  // Periodic sync check (every 60 seconds)
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

  // Cleanup on unmount
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
    dropShadowColor,
    dropShadowOpacity,
    backgroundColor,
    backgroundOpacity,
    xMargin,
    yMargin,
  } = output2Settings;

  const getTextShadow = () => {
    const opacity = Math.round((dropShadowOpacity / 10) * 255)
      .toString(16)
      .padStart(2, '0');
    return `0px 8px 10px ${dropShadowColor}${opacity}`;
  };

  const getBackground = () => {
    const opacity = Math.round((backgroundOpacity / 10) * 255)
      .toString(16)
      .padStart(2, '0');
    return `${backgroundColor}${opacity}`;
  };

  const effectiveBorderSize = Math.min(10, Math.max(0, Number(borderSize) || 0));
  const textStrokeValue = effectiveBorderSize > 0
    ? `${effectiveBorderSize}px ${borderColor}`
    : '0px transparent';
  const textStrokeStyles = {
    WebkitTextStroke: textStrokeValue,
    textStroke: textStrokeValue,
  };

  // Apply text transformations and handle multi-line content
  const processDisplayText = (text) => {
    return allCaps ? text.toUpperCase() : text;
  };

  // Render multi-line content with proper styling for translations
  const renderContent = () => {
    const processedText = processDisplayText(line);

    // Check if we have line breaks (from grouped content)
    if (processedText.includes('\n')) {
      const lines = processedText.split('\n');
      return (
        <div className="space-y-1">
          {lines.map((lineText, index) => (
            <div
              key={index}
              className={index > 0 ? 'font-medium' : 'font-medium'}
              style={{
                ...textStrokeStyles,
                color: index > 0 ? '#FBBF24' : 'inherit'
              }}
            >
              {lineText}
            </div>
          ))}
        </div>
      );
    }

    return processedText;
  };

  return (
    <div
      className="w-screen h-screen flex items-center justify-center"
      style={{
        backgroundColor: 'transparent',
      }}
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
          backgroundColor: getBackground(),
          padding: `${yMargin}rem ${xMargin}rem`,
          ...textStrokeStyles,
          opacity: isOutputOn && line ? 1 : 0, // Control opacity
          pointerEvents: isOutputOn && line ? 'auto' : 'none', // Make it non-interactive when hidden
        }}
        className="w-full h-full flex items-center justify-center text-center leading-none transition-opacity duration-500 ease-in-out"
      >
        {renderContent()}
      </div>
    </div>
  );
};

export default Output2;
