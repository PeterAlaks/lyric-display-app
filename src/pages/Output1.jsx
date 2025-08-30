import React, { useEffect, useRef, useState, useCallback } from 'react';
import useLyricsStore from '../context/LyricsStore';
import useSocket from '../hooks/useSocket';
import { getLineOutputText } from '../utils/parseLyrics';

const Output1 = () => {
  const { socket, isConnected, connectionStatus } = useSocket('output');
  const {
    lyrics,
    selectedLine,
    output1Settings,
    isOutputOn,
    setIsOutputOn,
    setLyrics,
    selectLine,
    updateOutputSettings,
  } = useLyricsStore();
  
  const stateRequestTimeoutRef = useRef(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  
  // Get the current line and process it for output
  const currentLine = lyrics[selectedLine];
  const line = getLineOutputText(currentLine) || '';

  // Robust state request function with retry logic
  const requestCurrentStateWithRetry = useCallback((retryCount = 0) => {
    const maxRetries = 3;
    
    if (!socket || !socket.connected) {
      console.log('Output1: Cannot request state - socket not connected');
      return;
    }

    if (retryCount >= maxRetries) {
      console.error('Output1: Max retries reached for state request');
      return;
    }

    console.log(`Output1: Requesting current state (attempt ${retryCount + 1})`);
    socket.emit('requestCurrentState');

    // Set timeout for response
    if (stateRequestTimeoutRef.current) {
      clearTimeout(stateRequestTimeoutRef.current);
    }
    
    stateRequestTimeoutRef.current = setTimeout(() => {
      console.log(`Output1: State request timeout (attempt ${retryCount + 1}), retrying...`);
      requestCurrentStateWithRetry(retryCount + 1);
    }, 3000); // 3 second timeout per attempt
  }, [socket]);

  // Enhanced socket setup with retry logic
  useEffect(() => {
    if (!socket) return;

    // Set up event listeners
    const handleCurrentState = (state) => {
      console.log('Output1: Received current state:', state);
      setLastSyncTime(Date.now());
      
      // Clear any pending timeout
      if (stateRequestTimeoutRef.current) {
        clearTimeout(stateRequestTimeoutRef.current);
        stateRequestTimeoutRef.current = null;
      }
      
      // Apply received state
      if (state.lyrics) setLyrics(state.lyrics);
      if (state.selectedLine !== undefined) selectLine(state.selectedLine);
      if (state.output1Settings) updateOutputSettings('output1', state.output1Settings);
      if (typeof state.isOutputOn === 'boolean') setIsOutputOn(state.isOutputOn);
    };

    const handleLineUpdate = ({ index }) => {
      console.log('Output1: Received line update:', index);
      selectLine(index);
    };

    const handleLyricsLoad = (newLyrics) => {
      console.log('Output1: Received lyrics load:', newLyrics?.length, 'lines');
      setLyrics(newLyrics);
      selectLine(null);
    };

    const handleStyleUpdate = ({ output, settings }) => {
      if (output === 'output1') {
        console.log('Output1: Received style update');
        updateOutputSettings('output1', settings);
      }
    };

    const handleOutputToggle = (state) => {
      console.log('Output1: Received output toggle:', state);
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
  }, [socket, requestCurrentStateWithRetry, setLyrics, selectLine, updateOutputSettings, setIsOutputOn]);

  // Monitor connection status and re-request state on connection
  useEffect(() => {
    console.log(`Output1 connection status: ${connectionStatus}`);
    
    if (connectionStatus === 'connected' && socket) {
      setTimeout(() => requestCurrentStateWithRetry(0), 200);
    }
  }, [connectionStatus, socket, requestCurrentStateWithRetry]);

  // Periodic sync check (every 60 seconds)
  useEffect(() => {
    if (!isConnected) return;

    const syncCheckInterval = setInterval(() => {
      console.log('Output1: Periodic sync check');
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
    dropShadowColor,
    dropShadowOpacity,
    backgroundColor,
    backgroundOpacity,
    xMargin,
    yMargin,
  } = output1Settings;

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
      {isOutputOn && line && (
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
          }}
          className="w-full text-center leading-none"
        >
          {renderContent()}
        </div>
      )}
    </div>
  );
};

export default Output1;