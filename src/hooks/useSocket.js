// Project: LyricDisplay App
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
    setSetlistFiles,
    setIsDesktopApp,
    setLyricsFileName,
    setRawLyricsContent,
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
      timeout: 30000,
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 3,
      maxReconnectionAttempts: 5,
    };

    socketRef.current = io(socketUrl, socketOptions);

    // Detect client type and send to server
    const isDesktopApp = window.electronAPI !== undefined;
    setIsDesktopApp(isDesktopApp);

    // Connection event handlers
    socketRef.current.on('connect', () => {
      console.log('Socket connected:', socketRef.current.id);
      setConnectionStatus('connected');

      // Identify client type to server
      socketRef.current.emit('clientConnect', {
        type: isDesktopApp ? 'desktop' : 'web'
      });

      // If this is desktop app, broadcast current state to sync other clients
      if (isDesktopApp) {
        setTimeout(() => {
          const currentState = useLyricsStore.getState();
          if (currentState.lyrics.length > 0) {
            socketRef.current.emit('lyricsLoad', currentState.lyrics);
            if (currentState.lyricsFileName) {
              socketRef.current.emit('fileNameUpdate', currentState.lyricsFileName);
            }
            if (typeof currentState.selectedLine === 'number') {
              socketRef.current.emit('lineUpdate', { index: currentState.selectedLine });
            }
            socketRef.current.emit('outputToggle', currentState.isOutputOn);
          }
        }, 1000);
      }

      // Request current state for all clients
      setTimeout(() => {
        socketRef.current.emit('requestCurrentState');
      }, 500);
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

      // Re-identify client type after reconnection
      socketRef.current.emit('clientConnect', {
        type: isDesktopApp ? 'desktop' : 'web'
      });
    });

    socketRef.current.on('reconnect_attempt', (attemptNumber) => {
      console.log('Socket reconnection attempt:', attemptNumber);
      setConnectionStatus('reconnecting');
    });

    socketRef.current.on('currentState', (state) => {
      console.log('Received enhanced current state:', state);

      // Always sync lyrics and filename if server has them
      if (state.lyrics && state.lyrics.length > 0) {
        setLyrics(state.lyrics);
        if (state.lyricsFileName) {
          setLyricsFileName(state.lyricsFileName);
        }

        // Also sync selected line when we have lyrics
        if (typeof state.selectedLine === 'number' && state.selectedLine >= 0) {
          selectLine(state.selectedLine);
        }
      }

      // Always update settings, setlist, and output toggle state
      if (state.output1Settings) updateOutputSettings('output1', state.output1Settings);
      if (state.output2Settings) updateOutputSettings('output2', state.output2Settings);
      if (state.setlistFiles) setSetlistFiles(state.setlistFiles);
      if (typeof state.isDesktopClient === 'boolean') setIsDesktopApp(state.isDesktopClient);
      if (typeof state.isOutputOn === 'boolean' && !isDesktopApp) {
        useLyricsStore.getState().setIsOutputOn(state.isOutputOn);
      }
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

    // New setlist event handlers
    socketRef.current.on('setlistUpdate', (files) => {
      setSetlistFiles(files);
      // Do NOT clear lyrics, selectedLine, or output settings here!
    });

    socketRef.current.on('setlistLoadSuccess', ({ fileId, fileName, linesCount, rawContent }) => {
      console.log(`Setlist file loaded: ${fileName} (${linesCount} lines)`);
      setLyricsFileName(fileName);
      selectLine(null);

      // IMPORTANT: Set raw content for editing
      if (rawContent) {
        setRawLyricsContent(rawContent);
      }
    });

    socketRef.current.on('setlistAddSuccess', ({ addedCount, totalCount }) => {
      console.log(`Added ${addedCount} files to setlist. Total: ${totalCount}`);
    });

    socketRef.current.on('setlistRemoveSuccess', (fileId) => {
      console.log(`Removed file ${fileId} from setlist`);
    });

    socketRef.current.on('setlistError', (error) => {
      console.error('Setlist error:', error);
      // You could also show a toast notification here
    });

    socketRef.current.on('setlistClearSuccess', () => {
      console.log('Setlist cleared successfully');
    });

    // Handle periodic state sync
    socketRef.current.on('periodicStateSync', (state) => {
      console.log('Received periodic state sync');

      // Don't override lyrics if we already have different content
      if (state.lyrics && state.lyrics.length > 0) {
        const currentLyrics = useLyricsStore.getState().lyrics;
        if (currentLyrics.length === 0) {
          setLyrics(state.lyrics);
        }
      }

      // Only sync selectedLine if it makes sense
      if (typeof state.selectedLine === 'number' && state.selectedLine >= 0) {
        const currentLyrics = useLyricsStore.getState().lyrics;
        if (state.selectedLine < currentLyrics.length) {
          selectLine(state.selectedLine);
        }
      }

      // Settings are always safe to sync
      if (state.output1Settings) updateOutputSettings('output1', state.output1Settings);
      if (state.output2Settings) updateOutputSettings('output2', state.output2Settings);
      if (state.setlistFiles) setSetlistFiles(state.setlistFiles);
      if (typeof state.isDesktopClient === 'boolean') setIsDesktopApp(state.isDesktopClient);
    });

    socketRef.current.on('fileNameUpdate', (fileName) => {
      console.log('Received filename update:', fileName);
      setLyricsFileName(fileName);
    });

    // Cleanup function
    return () => {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        console.log('Socket disconnected and cleaned up');
      }
    };
  }, [role, setLyrics, selectLine, updateOutputSettings, setSetlistFiles, setIsDesktopApp, setLyricsFileName, setRawLyricsContent]);

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

  // New setlist emit functions
  const emitSetlistAdd = (files) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('setlistAdd', files);
      console.log('Emitted setlist add:', files?.length, 'files');
    } else {
      console.warn('Cannot emit setlist add - socket not connected');
    }
  };

  const emitSetlistRemove = (fileId) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('setlistRemove', fileId);
      console.log('Emitted setlist remove:', fileId);
    } else {
      console.warn('Cannot emit setlist remove - socket not connected');
    }
  };

  const emitSetlistLoad = (fileId) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('setlistLoad', fileId);
      console.log('Emitted setlist load:', fileId);
    } else {
      console.warn('Cannot emit setlist load - socket not connected');
    }
  };

  const emitRequestSetlist = () => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('requestSetlist');
      console.log('Emitted request setlist');
    } else {
      console.warn('Cannot emit request setlist - socket not connected');
    }
  };

  const emitSetlistClear = () => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('setlistClear');
      console.log('Emitted setlist clear');
    } else {
      console.warn('Cannot emit setlist clear - socket not connected');
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
    socket: socketRef.current,
    emitLineUpdate,
    emitLyricsLoad,
    emitStyleUpdate,
    emitOutputToggle,
    emitSetlistAdd,
    emitSetlistRemove,
    emitSetlistLoad,
    emitRequestSetlist,
    emitSetlistClear,
    connectionStatus,
    forceReconnect,
    isConnected: connectionStatus === 'connected',
  };
};

export default useSocket;