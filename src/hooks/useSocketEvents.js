import { useCallback, useRef } from 'react';
import useLyricsStore from '../context/LyricsStore';
import { logDebug, logError, logWarn } from '../utils/logger';
import { detectArtistFromFilename } from '../utils/artistDetection';
import { deriveSectionsFromProcessedLines } from '../../shared/lyricsParsing.js';

const useSocketEvents = (role) => {
  const {
    setLyrics,
    setLyricsTimestamps,
    selectLine,
    updateOutputSettings,
    setSetlistFiles,
    setIsDesktopApp,
    setLyricsFileName,
    setRawLyricsContent,
    setLyricsSections,
    setLineToSection,
  } = useLyricsStore();

  const setlistNameRef = useRef(new Map());

  const setupApplicationEventHandlers = useCallback((socket, clientType, isDesktopApp) => {
    const applySections = (sections, lineToSection, fallbackLyrics) => {
      let targetSections = Array.isArray(sections) ? sections : null;
      let targetLineToSection = (lineToSection && typeof lineToSection === 'object') ? lineToSection : null;

      if (!targetSections && Array.isArray(fallbackLyrics)) {
        const derived = deriveSectionsFromProcessedLines(fallbackLyrics);
        targetSections = derived.sections;
        targetLineToSection = derived.lineToSection;
      }

      setLyricsSections(targetSections || []);
      setLineToSection(targetLineToSection || {});
    };

    socket.on('currentState', (state) => {
      logDebug('Received enhanced current state:', state);
      if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('sync-completed'));
      }

      if (state.lyrics && state.lyrics.length > 0) {
        setLyrics(state.lyrics);

        if (Array.isArray(state.lyricsTimestamps)) {
          setLyricsTimestamps(state.lyricsTimestamps);
        } else {
          setLyricsTimestamps([]);
        }
        if (state.lyricsFileName) {
          setLyricsFileName(state.lyricsFileName);
        }
      }

      if (state.selectedLine === null || (typeof state.selectedLine === 'number' && state.selectedLine >= 0)) {
        selectLine(state.selectedLine);
      }

      if (state.output1Settings) {
        const { autosizerActive, primaryViewportWidth, primaryViewportHeight, allInstances, instanceCount, ...styleSettings } = state.output1Settings;
        updateOutputSettings('output1', styleSettings);
      }
      if (state.output2Settings) {
        const { autosizerActive, primaryViewportWidth, primaryViewportHeight, allInstances, instanceCount, ...styleSettings } = state.output2Settings;
        updateOutputSettings('output2', styleSettings);
      }
      if (state.stageSettings && role === 'stage') {
        updateOutputSettings('stage', state.stageSettings);
      }
      if (state.setlistFiles) setSetlistFiles(state.setlistFiles);
      if (typeof state.isDesktopClient === 'boolean') setIsDesktopApp(state.isDesktopClient);
      if (typeof state.isOutputOn === 'boolean' && !isDesktopApp) {
        useLyricsStore.getState().setIsOutputOn(state.isOutputOn);
      }

      if (typeof state.output1Enabled === 'boolean') {
        useLyricsStore.getState().setOutput1Enabled(state.output1Enabled);
      }
      if (typeof state.output2Enabled === 'boolean') {
        useLyricsStore.getState().setOutput2Enabled(state.output2Enabled);
      }
      if (typeof state.stageEnabled === 'boolean') {
        useLyricsStore.getState().setStageEnabled(state.stageEnabled);
      }

      applySections(state.lyricsSections || state.sections, state.lineToSection, state.lyrics);

      if (role === 'stage') {
        if (state.stageTimerState) {
          window.dispatchEvent(new CustomEvent('stage-timer-update', {
            detail: state.stageTimerState,
          }));
        }
        if (state.stageMessages) {
          window.dispatchEvent(new CustomEvent('stage-messages-update', {
            detail: state.stageMessages,
          }));
        }
      }
    });

    socket.on('lineUpdate', ({ index }) => {
      logDebug('Received line update:', index);
      selectLine(index);
    });

    socket.on('lyricsLoad', (payload) => {
      const lyrics = Array.isArray(payload) ? payload : payload?.lyrics;
      const sections = Array.isArray(payload?.sections) ? payload.sections : null;
      const lineToSection = payload?.lineToSection;

      logDebug('Received lyrics load:', lyrics?.length, 'lines');
      setLyrics(lyrics);
      setLyricsTimestamps([]);
      selectLine(null);
      applySections(sections, lineToSection, lyrics);
    });

    socket.on('lyricsTimestampsUpdate', (timestamps) => {
      logDebug('Received lyrics timestamps update:', timestamps?.length, 'timestamps');
      setLyricsTimestamps(timestamps || []);
    });

    socket.on('lyricsSectionsUpdate', ({ sections, lineToSection }) => {
      logDebug('Received lyrics sections update');
      applySections(sections, lineToSection);
    });

    socket.on('outputToggle', (state) => {
      logDebug('Received output toggle:', state);
      useLyricsStore.getState().setIsOutputOn(state);
    });

    socket.on('individualOutputToggle', ({ output, enabled }) => {
      logDebug('Received individual output toggle:', output, enabled);
      const store = useLyricsStore.getState();
      if (output === 'output1') {
        store.setOutput1Enabled(enabled);
      } else if (output === 'output2') {
        store.setOutput2Enabled(enabled);
      } else if (output === 'stage') {
        store.setStageEnabled(enabled);
      }
    });

    const shouldHandleOutputMetrics = role === 'control' || role === 'output' || role === 'output1' || role === 'output2' || role === 'stage';

    if (shouldHandleOutputMetrics) {
      socket.on('styleUpdate', ({ output, settings }) => {
        logDebug('Received style update for', output, ':', settings);

        if (output === 'stage' && role === 'stage') {

          updateOutputSettings(output, settings);
        } else if (output !== 'stage') {

          const { autosizerActive, primaryViewportWidth, primaryViewportHeight, allInstances, instanceCount, ...styleSettings } = settings;
          updateOutputSettings(output, styleSettings);
        }
      });

      socket.on('outputMetrics', ({ output, metrics, allInstances, instanceCount }) => {
        try {
          const updates = {
            autosizerActive: metrics?.autosizerActive ?? false,
            primaryViewportWidth: metrics?.viewportWidth ?? null,
            primaryViewportHeight: metrics?.viewportHeight ?? null,
            allInstances: allInstances || null,
            instanceCount: instanceCount || 1,
          };

          if (output === 'output1' || output === 'output2') {
            updateOutputSettings(output, updates);

            if (instanceCount > 1) {
              logDebug(`${output}: ${instanceCount} instances detected, using primary (${metrics.viewportWidth}x${metrics.viewportHeight})`);
            }
          }
        } catch (e) {
          logWarn('Failed to apply output metrics:', e?.message || e);
        }
      });
    }

    if (role === 'stage') {
      socket.on('stageTimerUpdate', (timerData) => {
        logDebug('Received stage timer update:', timerData);
        window.dispatchEvent(new CustomEvent('stage-timer-update', {
          detail: timerData,
        }));
      });

      socket.on('stageMessagesUpdate', (messages) => {
        logDebug('Received stage messages update:', messages);
        window.dispatchEvent(new CustomEvent('stage-messages-update', {
          detail: messages,
        }));
      });

      socket.on('stageUpcomingSongUpdate', (data) => {
        logDebug('Received stage upcoming song update:', data);
        window.dispatchEvent(new CustomEvent('stage-upcoming-song-update', {
          detail: data,
        }));
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

    socket.on('setlistLoadSuccess', ({ fileId, fileName, originalName, fileType, linesCount, rawContent, loadedBy, origin, draftId, metadata: savedMetadata }) => {
      logDebug(`Setlist file loaded: ${fileName} (${linesCount} lines) by ${loadedBy}`);
      setLyricsFileName(fileName);
      selectLine(null);
      if (rawContent) {
        setRawLyricsContent(rawContent);
      }
      if (savedMetadata?.sections) {
        setLyricsSections(savedMetadata.sections);
        setLineToSection(savedMetadata.lineToSection || {});
      } else if (linesCount && useLyricsStore.getState().lyrics?.length) {
        const derived = deriveSectionsFromProcessedLines(useLyricsStore.getState().lyrics);
        setLyricsSections(derived.sections || []);
        setLineToSection(derived.lineToSection || {});
      }

      let computedOrigin = 'Setlist (.txt)';
      if (fileType === 'lrc') {
        computedOrigin = 'Setlist (.lrc)';
      }
      if (fileType === 'draft' || origin === 'draft') {
        computedOrigin = 'Secondary Controller Draft';
      }

      let finalMetadata;
      if (savedMetadata && (savedMetadata.title || savedMetadata.artists?.length > 0)) {

        finalMetadata = {
          ...savedMetadata,
          origin: computedOrigin,
          lyricLines: linesCount,
          draftId: draftId || null
        };
      } else {
        const detected = detectArtistFromFilename(fileName);
        finalMetadata = {
          title: detected.title || fileName,
          artists: detected.artist ? [detected.artist] : [],
          album: null,
          year: null,
          lyricLines: linesCount,
          origin: computedOrigin,
          filePath: savedMetadata?.filePath || null,
          draftId: draftId || null
        };
      }
      useLyricsStore.getState().setSongMetadata(finalMetadata);

      try {
        window.dispatchEvent(new CustomEvent('setlist-load-success', {
          detail: { fileId, fileName, originalName, fileType, linesCount, loadedBy, origin: computedOrigin, draftId: draftId || null },
        }));
      } catch { }
    });

    socket.on('setlistAddSuccess', ({ addedCount, totalCount }) => {
      logDebug(`Added ${addedCount} files to setlist. Total: ${totalCount}`);
      window.dispatchEvent(new CustomEvent('setlist-add-success', {
        detail: { addedCount, totalCount },
      }));
    });

    socket.on('setlistRemoveSuccess', (fileId) => {
      logDebug(`Removed file ${fileId} from setlist`);
      try {
        const name = setlistNameRef.current.get(fileId) || '';
        window.dispatchEvent(new CustomEvent('setlist-remove-success', {
          detail: { fileId, name },
        }));
      } catch { }
    });

    socket.on('setlistReorderSuccess', ({ totalCount, orderedIds }) => {
      logDebug(`Setlist reordered: ${orderedIds?.length || 0} items`);
      window.dispatchEvent(new CustomEvent('setlist-reorder-success', {
        detail: { totalCount, orderedIds },
      }));
    });

    socket.on('setlistError', (error) => {
      logError('Setlist error:', error);
      window.dispatchEvent(new CustomEvent('setlist-error', {
        detail: { message: error },
      }));
    });

    socket.on('setlistClearSuccess', () => {
      logDebug('Setlist cleared successfully');
      window.dispatchEvent(new CustomEvent('setlist-clear-success'));
    });

    socket.on('fileNameUpdate', (fileName) => {
      logDebug('Received filename update:', fileName);
      setLyricsFileName(fileName);
    });

    socket.on('draftSubmitted', ({ success, title }) => {
      logDebug(`Draft submitted successfully: ${title}`);
      window.dispatchEvent(new CustomEvent('draft-submitted', {
        detail: { success, title },
      }));
    });

    socket.on('draftError', (error) => {
      logError('Draft submission error:', error);
      window.dispatchEvent(new CustomEvent('draft-error', {
        detail: { message: error },
      }));
    });

    socket.on('lyricsDraftReceived', (payload) => {
      logDebug('Received lyrics draft for approval:', payload.title);
      window.dispatchEvent(new CustomEvent('lyrics-draft-received', {
        detail: payload,
      }));
    });

    socket.on('draftApproved', ({ success, title, draftId }) => {
      logDebug(`Draft approved: ${title}`);
      window.dispatchEvent(new CustomEvent('draft-approved', {
        detail: { success, title, draftId },
      }));
    });

    socket.on('draftRejected', ({ success, reason, draftId, title }) => {
      logDebug('Draft rejected:', reason);
      window.dispatchEvent(new CustomEvent('draft-rejected', {
        detail: { success, reason, draftId, title },
      }));
    });

    socket.on('clientDisconnected', ({ clientType: disconnectedType, deviceId, reason }) => {
      logDebug(`Client disconnected: ${disconnectedType} (${deviceId}) - ${reason}`);
    });

    socket.on('heartbeat_ack', ({ timestamp }) => {
      logDebug('Heartbeat acknowledged, server time:', new Date(timestamp));
    });

    socket.on('autoplayStateUpdate', ({ isActive, clientType }) => {
      logDebug('Received autoplay state update:', { isActive, clientType });
      window.dispatchEvent(new CustomEvent('autoplay-state-update', {
        detail: { isActive, clientType },
      }));
    });

    socket.on('periodicStateSync', (state) => {
      logDebug('Received periodic state sync');
      if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('sync-completed'));
      }

      if (state.lyrics && state.lyrics.length > 0) {
        const currentLyrics = useLyricsStore.getState().lyrics;
        if (currentLyrics.length === 0) {
          setLyrics(state.lyrics);
        }

        if (Array.isArray(state.lyricsTimestamps)) {
          setLyricsTimestamps(state.lyricsTimestamps);
        } else {
          setLyricsTimestamps([]);
        }
      }
      applySections(state.lyricsSections || state.sections, state.lineToSection, state.lyrics);

      if (state.selectedLine === null) {
        selectLine(null);
      } else if (typeof state.selectedLine === 'number' && state.selectedLine >= 0) {
        const currentLyrics = useLyricsStore.getState().lyrics;
        if (state.selectedLine < currentLyrics.length) {
          selectLine(state.selectedLine);
        }
      }

      if (state.output1Settings) {
        const { autosizerActive, primaryViewportWidth, primaryViewportHeight, allInstances, instanceCount, ...styleSettings } = state.output1Settings;
        updateOutputSettings('output1', styleSettings);
      }
      if (state.output2Settings) {
        const { autosizerActive, primaryViewportWidth, primaryViewportHeight, allInstances, instanceCount, ...styleSettings } = state.output2Settings;
        updateOutputSettings('output2', styleSettings);
      }
      if (state.stageSettings && role === 'stage') {
        updateOutputSettings('stage', state.stageSettings);
      }
      if (state.setlistFiles) setSetlistFiles(state.setlistFiles);
      if (typeof state.isDesktopClient === 'boolean') setIsDesktopApp(state.isDesktopClient);

      if (typeof state.output1Enabled === 'boolean') {
        useLyricsStore.getState().setOutput1Enabled(state.output1Enabled);
      }
      if (typeof state.output2Enabled === 'boolean') {
        useLyricsStore.getState().setOutput2Enabled(state.output2Enabled);
      }
      if (typeof state.stageEnabled === 'boolean') {
        useLyricsStore.getState().setStageEnabled(state.stageEnabled);
      }
    });
  }, [role, setLyrics, setLyricsSections, setLineToSection, setLyricsTimestamps, selectLine, updateOutputSettings, setSetlistFiles, setIsDesktopApp, setLyricsFileName, setRawLyricsContent]);

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
      logDebug('Authenticated socket connected:', socket.id);
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

      const shouldSyncOutputSettings = role !== 'output' && role !== 'output1' && role !== 'output2' && role !== 'stage';

      if (shouldSyncOutputSettings && clientType === 'desktop') {
        const syncOutputSettingsFromStore = () => {
          try {
            const { output1Settings, output2Settings, stageSettings } = useLyricsStore.getState();

            if (output1Settings) {
              socket.emit('styleUpdate', { output: 'output1', settings: output1Settings });
            }

            if (output2Settings) {
              socket.emit('styleUpdate', { output: 'output2', settings: output2Settings });
            }

            if (stageSettings) {
              socket.emit('styleUpdate', { output: 'stage', settings: stageSettings });
            }

            logDebug('Synced output settings to server after reconnect');
          } catch (error) {
            logError('Failed to sync output settings after reconnect:', error);
          }
        };

        const persistApi = useLyricsStore.persist;
        if (persistApi?.hasHydrated?.()) {
          syncOutputSettingsFromStore();
        } else if (persistApi?.onFinishHydration) {
          persistApi.onFinishHydration(() => {
            syncOutputSettingsFromStore();
          });
        } else {
          syncOutputSettingsFromStore();
        }
      }

      if (isDesktopApp) {
        setTimeout(() => {
          const currentState = useLyricsStore.getState();
          if (currentState.lyrics.length > 0) {
            socket.emit('lyricsLoad', currentState.lyrics);
            if (Array.isArray(currentState.lyricsTimestamps) && currentState.lyricsTimestamps.length > 0) {
              socket.emit('lyricsTimestampsUpdate', currentState.lyricsTimestamps);
            }
            if (currentState.lyricsFileName) {
              socket.emit('fileNameUpdate', currentState.lyricsFileName);
            }
            socket.emit('lineUpdate', { index: currentState.selectedLine });
            socket.emit('outputToggle', currentState.isOutputOn);

            if (typeof currentState.output1Enabled === 'boolean') {
              socket.emit('individualOutputToggle', { output: 'output1', enabled: currentState.output1Enabled });
            }
            if (typeof currentState.output2Enabled === 'boolean') {
              socket.emit('individualOutputToggle', { output: 'output2', enabled: currentState.output2Enabled });
            }
            if (typeof currentState.stageEnabled === 'boolean') {
              socket.emit('individualOutputToggle', { output: 'stage', enabled: currentState.stageEnabled });
            }
          }
        }, 1000);
      }
    });

    socket.on('disconnect', (reason) => {
      logDebug('Socket disconnected:', reason);
      setConnectionStatus('disconnected');
      stopHeartbeat();

      if (reason !== 'io client disconnect') {
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          logDebug('Auto-reconnecting...');
          requestReconnect();
        }, 2000);
      }
    });

    socket.on('connect_error', (error) => {
      logError('Socket connection error:', error);
      setConnectionStatus('error');

      if (error.message?.includes('Authentication') || error.message?.includes('token')) {
        logDebug('Authentication error, clearing token and retrying...');
        handleAuthError(error.message, false);
      }

      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        requestReconnect();
      }, 3000);
    });

    socket.on('authError', (error) => {
      logError('Authentication error:', error);
      handleAuthError(error, true);
    });

    socket.on('permissionError', (error) => {
      logWarn('Permission error:', error);
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