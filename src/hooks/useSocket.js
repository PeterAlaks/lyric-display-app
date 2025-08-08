// Project: Lyric Display App
// File: src/hooks/useSocket.js

import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import useLyricsStore from '../context/LyricsStore';

const useSocket = (role = 'output') => {
  const socketRef = useRef(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const {
    setLyrics,
    selectLine,
    updateOutputSettings,
    output1Settings,
    output2Settings,
  } = useLyricsStore();

  useEffect(() => {
    // Determine socket URL - fallback chain for different environments
    const getSocketUrl = () => {
      // Environment variable (Vite)
      if (import.meta.env.VITE_SOCKET_SERVER_URL) {
        return import.meta.env.VITE_SOCKET_SERVER_URL;
      }
      // Default fallback: use the same host/port as the loaded page
      return window.location.origin;
    };

    const socketUrl = getSocketUrl();
    console.log('Connecting to socket server:', socketUrl);

    // Socket configuration options
    const socketOptions = {
      transports: ['websocket', 'polling'], // Try websocket first, fallback to polling
      timeout: 20000,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      maxReconnectionAttempts: 10,
    };

    socketRef.current = io(socketUrl, socketOptions);

    // Connection event handlers
    socketRef.current.on('connect', () => {
      console.log('Socket connected:', socketRef.current.id);
      setConnectionStatus('connected');
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setConnectionStatus('disconnected');
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setConnectionStatus('error');
    });

    socketRef.current.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts');
      setConnectionStatus('connected');
    });

    socketRef.current.on('reconnect_attempt', (attemptNumber) => {
      console.log('Socket reconnection attempt:', attemptNumber);
      setConnectionStatus('reconnecting');
    });

    // App-specific event handlers
    if (role === 'output') {
      socketRef.current.on('lineUpdate', ({ index }) => {
        console.log('Received line update:', index);
        selectLine(index);
      });

      socketRef.current.on('lyricsLoad', (lyrics) => {
        console.log('Received lyrics load:', lyrics?.length, 'lines');
        setLyrics(lyrics);
      });

      socketRef.current.on('styleUpdate', ({ output, settings }) => {
        console.log('Received style update for', output, ':', settings);
        updateOutputSettings(output, settings);
      });

      socketRef.current.on('outputToggle', (state) => {
        console.log('Received output toggle:', state);
        useLyricsStore.getState().setIsOutputOn(state);
      });
    }

    // Cleanup function
    return () => {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        console.log('Socket disconnected and cleaned up');
      }
    };
  }, [role, setLyrics, selectLine, updateOutputSettings]);

  // Emit functions with error handling
  const emitLineUpdate = (index) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('lineUpdate', { index });
      console.log('Emitted line update:', index);
    } else {
      console.warn('Cannot emit line update - socket not connected');
    }
  };

  const emitLyricsLoad = (lyrics) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('lyricsLoad', lyrics);
      console.log('Emitted lyrics load:', lyrics?.length, 'lines');
    } else {
      console.warn('Cannot emit lyrics load - socket not connected');
    }
  };

  const emitStyleUpdate = (output, settings) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('styleUpdate', { output, settings });
      console.log('Emitted style update for', output);
    } else {
      console.warn('Cannot emit style update - socket not connected');
    }
  };

  const emitOutputToggle = (state) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('outputToggle', state);
      console.log('Emitted output toggle:', state);
    } else {
      console.warn('Cannot emit output toggle - socket not connected');
    }
  };

  // Force reconnect function (useful for troubleshooting)
  const forceReconnect = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current.connect();
    }
  };

  return {
    emitLineUpdate,
    emitLyricsLoad,
    emitStyleUpdate,
    emitOutputToggle,
    connectionStatus,
    forceReconnect,
    isConnected: connectionStatus === 'connected',
  };
};

export default useSocket;