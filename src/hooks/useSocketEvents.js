import { useCallback, useRef } from 'react';
import useLyricsStore from '../context/LyricsStore';

const useSocketEvents = (role) => {
  const {
    setLyrics,
    selectLine,
    updateOutputSettings,
    setSetlistFiles,
    setIsDesktopApp,
    setLyricsFileName,
    setRawLyricsContent,
  } = useLyricsStore();

  const setlistNameRef = useRef(new Map());

  const setupApplicationEventHandlers = useCallback((socket, clientType, isDesktopApp) => {
    socket.on('currentState', (state) => {
      console.log('Received enhanced current state:', state);

      if (state.lyrics && state.lyrics.length > 0) {
        setLyrics(state.lyrics);
        if (state.lyricsFileName) {
          setLyricsFileName(state.lyricsFileName);
        }
        if (typeof state.selectedLine === 'number' && state.selectedLine >= 0) {
          selectLine(state.selectedLine);
        }
      }

      if (state.output1Settings) updateOutputSettings('output1', state.output1Settings);
      if (state.output2Settings) updateOutputSettings('output2', state.output2Settings);
      if (state.setlistFiles) setSetlistFiles(state.setlistFiles);
      if (typeof state.isDesktopClient === 'boolean') setIsDesktopApp(state.isDesktopClient);
      if (typeof state.isOutputOn === 'boolean' && !isDesktopApp) {
        useLyricsStore.getState().setIsOutputOn(state.isOutputOn);
      }
    });

    if (role === 'output' || role === 'output1' || role === 'output2') {
      socket.on('lineUpdate', ({ index }) => {
        console.log('Received line update:', index);
        selectLine(index);
      });

      socket.on('lyricsLoad', (lyrics) => {
        console.log('Received lyrics load:', lyrics?.length, 'lines');
        setLyrics(lyrics);
      });

      socket.on('styleUpdate', ({ output, settings }) => {
        console.log('Received style update for', output, ':', settings);
        updateOutputSettings(output, settings);
      });

      socket.on('outputToggle', (state) => {
        console.log('Received output toggle:', state);
        useLyricsStore.getState().setIsOutputOn(state);
      });
    }

    socket.on('setlistUpdate', (files) => {
      try {
        const map = new Map();
        (files || []).forEach((f) => {
          if (f && f.id) map.set(f.id, f.displayName || '');
        });
        const prev = setlistNameRef.current || new Map();
        prev.forEach((name, id) => {
          if (!map.has(id)) map.set(id, name);
        });
        setlistNameRef.current = map;
      } catch { }
      setSetlistFiles(files);
    });

    socket.on('setlistLoadSuccess', ({ fileId, fileName, linesCount, rawContent, loadedBy }) => {
      console.log(`Setlist file loaded: ${fileName} (${linesCount} lines) by ${loadedBy}`);
      setLyricsFileName(fileName);
      selectLine(null);
      if (rawContent) {
        setRawLyricsContent(rawContent);
      }
    });

    socket.on('setlistAddSuccess', ({ addedCount, totalCount }) => {
      console.log(`Added ${addedCount} files to setlist. Total: ${totalCount}`);
      window.dispatchEvent(new CustomEvent('setlist-add-success', {
        detail: { addedCount, totalCount },
      }));
    });

    socket.on('setlistRemoveSuccess', (fileId) => {
      console.log(`Removed file ${fileId} from setlist`);
      try {
        const name = setlistNameRef.current.get(fileId) || '';
        window.dispatchEvent(new CustomEvent('setlist-remove-success', {
          detail: { fileId, name },
        }));
      } catch { }
    });

    socket.on('setlistError', (error) => {
      console.error('Setlist error:', error);
      window.dispatchEvent(new CustomEvent('setlist-error', {
        detail: { message: error },
      }));
    });

    socket.on('setlistClearSuccess', () => {
      console.log('Setlist cleared successfully');
      window.dispatchEvent(new CustomEvent('setlist-clear-success'));
    });

    socket.on('fileNameUpdate', (fileName) => {
      console.log('Received filename update:', fileName);
      setLyricsFileName(fileName);
    });

    socket.on('clientDisconnected', ({ clientType: disconnectedType, deviceId, reason }) => {
      console.log(`Client disconnected: ${disconnectedType} (${deviceId}) - ${reason}`);
    });

    socket.on('heartbeat_ack', ({ timestamp }) => {
      console.log('Heartbeat acknowledged, server time:', new Date(timestamp));
    });

    socket.on('periodicStateSync', (state) => {
      console.log('Received periodic state sync');

      if (state.lyrics && state.lyrics.length > 0) {
        const currentLyrics = useLyricsStore.getState().lyrics;
        if (currentLyrics.length === 0) {
          setLyrics(state.lyrics);
        }
      }

      if (typeof state.selectedLine === 'number' && state.selectedLine >= 0) {
        const currentLyrics = useLyricsStore.getState().lyrics;
        if (state.selectedLine < currentLyrics.length) {
          selectLine(state.selectedLine);
        }
      }

      if (state.output1Settings) updateOutputSettings('output1', state.output1Settings);
      if (state.output2Settings) updateOutputSettings('output2', state.output2Settings);
      if (state.setlistFiles) setSetlistFiles(state.setlistFiles);
      if (typeof state.isDesktopClient === 'boolean') setIsDesktopApp(state.isDesktopClient);
    });
  }, [role, setLyrics, selectLine, updateOutputSettings, setSetlistFiles, setIsDesktopApp, setLyricsFileName, setRawLyricsContent]);

  const registerAuthenticatedHandlers = useCallback(({
    socket,
    clientType,
    isDesktopApp,
    reconnectTimeoutRef,
    startHeartbeat,
    stopHeartbeat,
    setConnectionStatus,
    requestReconnect,
    handleAuthError,
  }) => {
    setIsDesktopApp(isDesktopApp);

    socket.on('connect', () => {
      console.log('Authenticated socket connected:', socket.id);
      setConnectionStatus('connected');

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      startHeartbeat();
      socket.emit('clientConnect', { type: clientType });

      setTimeout(() => {
        socket.emit('requestCurrentState');
      }, 500);

      if (isDesktopApp) {
        setTimeout(() => {
          const currentState = useLyricsStore.getState();
          if (currentState.lyrics.length > 0) {
            socket.emit('lyricsLoad', currentState.lyrics);
            if (currentState.lyricsFileName) {
              socket.emit('fileNameUpdate', currentState.lyricsFileName);
            }
            if (typeof currentState.selectedLine === 'number') {
              socket.emit('lineUpdate', { index: currentState.selectedLine });
            }
            socket.emit('outputToggle', currentState.isOutputOn);
          }
        }, 1000);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setConnectionStatus('disconnected');
      stopHeartbeat();

      if (reason !== 'io client disconnect') {
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Auto-reconnecting...');
          requestReconnect();
        }, 2000);
      }
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setConnectionStatus('error');

      if (error.message?.includes('Authentication') || error.message?.includes('token')) {
        console.log('Authentication error, clearing token and retrying...');
        handleAuthError(error.message, false);
      }

      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        requestReconnect();
      }, 3000);
    });

    socket.on('authError', (error) => {
      console.error('Authentication error:', error);
      handleAuthError(error, true);
    });

    socket.on('permissionError', (error) => {
      console.warn('Permission error:', error);
      window.dispatchEvent(new CustomEvent('permission-error', {
        detail: { message: error },
      }));
    });

    setupApplicationEventHandlers(socket, clientType, isDesktopApp);
  }, [setIsDesktopApp, setupApplicationEventHandlers]);

  return {
    setupApplicationEventHandlers,
    registerAuthenticatedHandlers,
  };
};

export default useSocketEvents;
