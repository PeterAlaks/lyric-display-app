import { useCallback, useRef } from 'react';
import useLyricsStore from '../context/LyricsStore';
import { logDebug, logError, logWarn } from '../utils/logger';
import { detectArtistFromFilename } from '../utils/artistDetection';
import { deriveSectionsFromProcessedLines } from '../../shared/lyricsParsing.js';
import { normalizeLyricFileType } from '../../shared/lyricImportRegistry.js';

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const isOutputId = (value) => typeof value === 'string' && value.startsWith('output');
const isRoutableOutput = (value) => value === 'stage' || isOutputId(value);
const isCustomOutputId = (value) => isOutputId(value) && value !== 'output1' && value !== 'output2';
const isPassiveDisplayRole = (role) => role === 'stage' || isOutputId(role);
const shallowArrayEqual = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const summarizeSnapshotForLog = (state) => {
  if (!isPlainObject(state)) return state;

  const outputSettingsCount = Object.keys(state)
    .filter((key) => key.startsWith('output') && key.endsWith('Settings'))
    .length;
  const outputEnabledCount = Object.keys(state)
    .filter((key) => key.startsWith('output') && key.endsWith('Enabled'))
    .length;

  return {
    lyrics: Array.isArray(state.lyrics) ? state.lyrics.length : undefined,
    lyricsTimestamps: Array.isArray(state.lyricsTimestamps) ? state.lyricsTimestamps.length : undefined,
    lyricsEnhancedTimestamps: Array.isArray(state.lyricsEnhancedTimestamps) ? state.lyricsEnhancedTimestamps.length : undefined,
    lyricsSections: Array.isArray(state.lyricsSections) ? state.lyricsSections.length : undefined,
    setlistFiles: Array.isArray(state.setlistFiles) ? state.setlistFiles.length : undefined,
    rawLyricsContentBytes: typeof state.rawLyricsContent === 'string' ? state.rawLyricsContent.length : undefined,
    selectedLine: state.selectedLine,
    lyricsFileName: state.lyricsFileName || '',
    outputSettingsCount,
    outputEnabledCount,
    stageMessages: Array.isArray(state.stageMessages) ? state.stageMessages.length : undefined,
    hasStageTimerState: Boolean(state.stageTimerState),
    timestamp: state.timestamp,
    syncTimestamp: state.syncTimestamp,
  };
};

const normalizeOutputRegistry = (payload) => {
  if (!isPlainObject(payload) || !Array.isArray(payload.outputs)) return null;
  const uniqueOutputs = Array.from(
    new Set(
      payload.outputs.filter((id) => typeof id === 'string')
    )
  );
  return { outputs: uniqueOutputs };
};

const useSocketEvents = (role, clientPurpose = role) => {
  const {
    setLyrics,
    setLyricsTimestamps,
    setLyricsEnhancedTimestamps,
    selectLine,
    updateOutputSettings,
    setSetlistFiles,
    setIsDesktopApp,
    setLyricsFileName,
    setRawLyricsContent,
    setLyricsSource,
    setSongMetadata,
    setLyricsSections,
    setLineToSection,
  } = useLyricsStore();

  const setlistNameRef = useRef(new Map());
  const registrySyncPendingRef = useRef(false);
  const pendingRegisteredOutputsRef = useRef(null);

  const setupApplicationEventHandlers = useCallback((socket, clientType, isDesktopApp) => {
    if (role === 'timer-control') {
      const applyTimerSnapshot = (state, source) => {
        if (!isPlainObject(state)) {
          logWarn(`Ignoring invalid ${source} payload`);
          return;
        }

        if (window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('sync-completed'));
        }

        if (state.stageTimerState) {
          window.dispatchEvent(new CustomEvent('stage-timer-update', {
            detail: state.stageTimerState,
          }));
        }
      };

      socket.on('currentState', (state) => {
        applyTimerSnapshot(state, 'currentState');
      });

      socket.on('periodicStateSync', (state) => {
        applyTimerSnapshot(state, 'periodicStateSync');
      });

      socket.on('stageTimerUpdate', (timerData) => {
        logDebug('Received stage timer update:', timerData);
        window.dispatchEvent(new CustomEvent('stage-timer-update', {
          detail: timerData,
        }));
      });

      socket.on('heartbeat_ack', ({ timestamp }) => {
        logDebug('Heartbeat acknowledged, server time:', new Date(timestamp));
      });

      return;
    }

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

    const applyOutputEnabled = (output, enabled) => {
      if (typeof enabled !== 'boolean') return;
      const store = useLyricsStore.getState();
      if (output === 'stage' && typeof store.setStageEnabled === 'function') {
        store.setStageEnabled(enabled);
        return;
      }
      const setterName = `set${output.charAt(0).toUpperCase()}${output.slice(1)}Enabled`;
      const setter = store[setterName];
      if (typeof setter === 'function') {
        setter(enabled);
      } else if (typeof store.setOutputEnabled === 'function' && isOutputId(output)) {
        store.setOutputEnabled(output, enabled);
      }
    };

    const shouldIgnoreEmptyRemoteFileName = (incomingFileName) => {
      if (!isDesktopApp) return false;
      if (typeof incomingFileName !== 'string' || incomingFileName.trim().length > 0) return false;

      const store = useLyricsStore.getState();
      return typeof store.lyricsFileName === 'string'
        && store.lyricsFileName.trim().length > 0
        && Array.isArray(store.lyrics)
        && store.lyrics.length > 0;
    };

    const applyOutputSettingsFromSnapshot = (state) => {
      for (const key of Object.keys(state)) {
        if (!key.startsWith('output') || !key.endsWith('Settings') || !isPlainObject(state[key])) continue;
        const outputId = key.slice(0, -'Settings'.length);
        const { autosizerActive, primaryViewportWidth, primaryViewportHeight, allInstances, instanceCount, ...styleSettings } = state[key];
        updateOutputSettings(outputId, styleSettings);
      }
    };

    const reconcileCustomOutputsFromSnapshot = (state) => {
      const customIds = new Set();
      for (const key of Object.keys(state)) {
        if (!key.startsWith('output')) continue;
        if (!key.endsWith('Settings') && !key.endsWith('Enabled')) continue;
        const outputId = key.replace(/(Settings|Enabled)$/, '');
        if (!isOutputId(outputId)) continue;
        if (outputId === 'output1' || outputId === 'output2') continue;
        customIds.add(outputId);
      }
      const store = useLyricsStore.getState();
      if (typeof store.setCustomOutputs === 'function' && customIds.size > 0) {
        const existing = Array.isArray(store.customOutputIds) ? store.customOutputIds : [];
        const merged = Array.from(new Set([...existing, ...Array.from(customIds)]));
        store.setCustomOutputs(merged);
      }
    };

    const applySnapshot = (rawState, source) => {
      if (!isPlainObject(rawState)) {
        logWarn(`Ignoring invalid ${source} payload`);
        return;
      }
      const state = rawState;
      const storeAtStart = useLyricsStore.getState();
      const incomingLyrics = hasOwn(state, 'lyrics') && Array.isArray(state.lyrics) ? state.lyrics : null;
      const preserveHydratedLyrics = Boolean(
        (isDesktopApp || clientType === 'obsDock') &&
        source === 'currentState' &&
        Array.isArray(incomingLyrics) &&
        incomingLyrics.length === 0 &&
        Array.isArray(storeAtStart.lyrics) &&
        storeAtStart.lyrics.length > 0
      );

      logDebug(`Received ${source}:`, summarizeSnapshotForLog(state));
      if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('sync-completed'));
      }

      if (!isDesktopApp) {
        reconcileCustomOutputsFromSnapshot(state);
      }

      if (hasOwn(state, 'lyrics') && Array.isArray(state.lyrics) && !preserveHydratedLyrics) {
        const currentLyrics = useLyricsStore.getState().lyrics;
        if (!shallowArrayEqual(currentLyrics, state.lyrics)) {
          setLyrics(state.lyrics);
        }
      }
      if (hasOwn(state, 'lyricsTimestamps') && !preserveHydratedLyrics) {
        const nextTimestamps = Array.isArray(state.lyricsTimestamps) ? state.lyricsTimestamps : [];
        const currentTimestamps = useLyricsStore.getState().lyricsTimestamps;
        if (!shallowArrayEqual(currentTimestamps, nextTimestamps)) {
          setLyricsTimestamps(nextTimestamps);
        }
      }
      if (hasOwn(state, 'lyricsEnhancedTimestamps') && !preserveHydratedLyrics && !isPassiveDisplayRole(role)) {
        const nextEnhancedTimestamps = Array.isArray(state.lyricsEnhancedTimestamps) ? state.lyricsEnhancedTimestamps : [];
        const currentEnhancedTimestamps = useLyricsStore.getState().lyricsEnhancedTimestamps;
        if (!shallowArrayEqual(currentEnhancedTimestamps, nextEnhancedTimestamps)) {
          setLyricsEnhancedTimestamps(nextEnhancedTimestamps);
        }
      }
      if (hasOwn(state, 'lyricsFileName') && typeof state.lyricsFileName === 'string' && !preserveHydratedLyrics) {
        if (shouldIgnoreEmptyRemoteFileName(state.lyricsFileName)) {
          logDebug(`Ignoring empty ${source} lyricsFileName to preserve local desktop state`);
        } else {
          setLyricsFileName(state.lyricsFileName);
        }
      }
      if (hasOwn(state, 'rawLyricsContent') && typeof state.rawLyricsContent === 'string' && !preserveHydratedLyrics) {
        setRawLyricsContent(state.rawLyricsContent);
      }
      if (hasOwn(state, 'lyricsSource') && isPlainObject(state.lyricsSource) && !preserveHydratedLyrics) {
        setLyricsSource(state.lyricsSource);
      }
      if (hasOwn(state, 'songMetadata') && isPlainObject(state.songMetadata) && !preserveHydratedLyrics) {
        setSongMetadata(state.songMetadata);
      }

      const isDesktop = state.isDesktopClient === true;
      if (hasOwn(state, 'selectedLine')) {
        if (state.selectedLine === null) {
          if (!isDesktop) {
            selectLine(null);
          } else {
            const persisted = useLyricsStore.getState().selectedLine;
            if (typeof persisted !== 'number' || persisted < 0) {
              selectLine(null);
            } else {
              logDebug('Preserving persisted selectedLine:', persisted);
            }
          }
        } else if (typeof state.selectedLine === 'number' && state.selectedLine >= 0) {
          const currentLyrics = useLyricsStore.getState().lyrics;
          if (!Array.isArray(currentLyrics) || state.selectedLine < currentLyrics.length) {
            selectLine(state.selectedLine);
          }
        }
      }

      applyOutputSettingsFromSnapshot(state);
      if (isPlainObject(state.stageSettings) && role === 'stage') {
        updateOutputSettings('stage', state.stageSettings);
      }
      if (Array.isArray(state.setlistFiles)) setSetlistFiles(state.setlistFiles);
      if (typeof state.isDesktopClient === 'boolean') setIsDesktopApp(state.isDesktopClient);
      if (typeof state.isOutputOn === 'boolean' && !isDesktopApp) {
        useLyricsStore.getState().setIsOutputOn(state.isOutputOn);
      }

      if (!isDesktopApp) {
        for (const key of Object.keys(state)) {
          if (!key.startsWith('output') || !key.endsWith('Enabled')) continue;
          const outputId = key.slice(0, -'Enabled'.length);
          applyOutputEnabled(outputId, state[key]);
        }

        if (typeof state.stageEnabled === 'boolean') {
          useLyricsStore.getState().setStageEnabled(state.stageEnabled);
        }
      }

      if (!preserveHydratedLyrics && !isPassiveDisplayRole(role)) {
        applySections(state.lyricsSections || state.sections, state.lineToSection, state.lyrics);
      }

      if (state.stageTimerState) {
        window.dispatchEvent(new CustomEvent('stage-timer-update', {
          detail: state.stageTimerState,
        }));
      }

      if (role === 'stage') {
        if (state.stageMessages) {
          window.dispatchEvent(new CustomEvent('stage-messages-update', {
            detail: state.stageMessages,
          }));
        }
      }
    };

    socket.on('currentState', (state) => {
      applySnapshot(state, 'currentState');
    });

    socket.on('lineUpdate', (payload) => {
      if (!isPlainObject(payload)) return;
      const { index } = payload;
      if (index === null || (typeof index === 'number' && index >= 0)) {
        logDebug('Received line update:', index);
        selectLine(index);
      }
    });

    socket.on('lyricsLoad', (payload) => {
      const payloadObject = isPlainObject(payload) ? payload : null;
      const lyrics = Array.isArray(payload) ? payload : payloadObject?.lyrics;
      if (!Array.isArray(lyrics)) return;
      const sections = Array.isArray(payloadObject?.sections) ? payloadObject.sections : null;
      const lineToSection = payloadObject?.lineToSection;

      logDebug('Received lyrics load:', lyrics?.length, 'lines');

      const currentStore = useLyricsStore.getState();
      const isSameLyrics = Array.isArray(lyrics) &&
        Array.isArray(currentStore.lyrics) &&
        lyrics.length === currentStore.lyrics.length &&
        lyrics.length > 0 &&
        lyrics[0] === currentStore.lyrics[0] &&
        lyrics[lyrics.length - 1] === currentStore.lyrics[lyrics.length - 1];

      setLyrics(lyrics);
      if (!isPassiveDisplayRole(role)) {
        setLyricsTimestamps(Array.isArray(payloadObject?.lyricsTimestamps) ? payloadObject.lyricsTimestamps : []);
        setLyricsEnhancedTimestamps(Array.isArray(payloadObject?.lyricsEnhancedTimestamps) ? payloadObject.lyricsEnhancedTimestamps : []);
      }
      if (typeof payloadObject?.fileName === 'string') {
        setLyricsFileName(payloadObject.fileName);
      }
      if (typeof payloadObject?.rawLyricsContent === 'string') {
        setRawLyricsContent(payloadObject.rawLyricsContent);
      }
      if (isPlainObject(payloadObject?.lyricsSource)) {
        setLyricsSource(payloadObject.lyricsSource);
      }
      if (isPlainObject(payloadObject?.songMetadata)) {
        setSongMetadata(payloadObject.songMetadata);
      }
      if (!isSameLyrics) {
        selectLine(null);
      }
      if (!isPassiveDisplayRole(role)) {
        applySections(sections, lineToSection, lyrics);
      }
    });

    socket.on('lyricsTimestampsUpdate', (timestamps) => {
      if (!Array.isArray(timestamps)) return;
      logDebug('Received lyrics timestamps update:', timestamps.length, 'timestamps');
      setLyricsTimestamps(timestamps);
    });

    socket.on('lyricsSectionsUpdate', (payload) => {
      if (!isPlainObject(payload)) return;
      const { sections, lineToSection } = payload;
      logDebug('Received lyrics sections update');
      applySections(sections, lineToSection);
    });

    socket.on('outputToggle', (state) => {
      if (typeof state !== 'boolean') return;
      logDebug('Received output toggle:', state);
      useLyricsStore.getState().setIsOutputOn(state);
    });

    socket.on('individualOutputToggle', (payload) => {
      if (!isPlainObject(payload) || !isRoutableOutput(payload.output) || typeof payload.enabled !== 'boolean') {
        return;
      }
      const { output, enabled } = payload;
      logDebug('Received individual output toggle:', output, enabled);
      applyOutputEnabled(output, enabled);
    });

    socket.on('outputRemoved', (payload) => {
      if (!isPlainObject(payload) || !isOutputId(payload.output)) return;
      const { output } = payload;
      const store = useLyricsStore.getState();
      if (typeof store.removeCustomOutput === 'function') {
        store.removeCustomOutput(output);
      }
    });

    socket.on('outputUnavailable', (payload) => {
      if (!isPlainObject(payload) || !isOutputId(payload.output)) return;
      const { output } = payload;
      const store = useLyricsStore.getState();
      if (typeof store.removeCustomOutput === 'function') {
        store.removeCustomOutput(output);
      }
    });

    socket.on('outputsRegistry', (payload) => {
      const normalized = normalizeOutputRegistry(payload);
      if (!normalized) return;
      const customOutputs = normalized.outputs
        .filter((id) => isCustomOutputId(id));
      const store = useLyricsStore.getState();
      if (typeof store.setCustomOutputs === 'function') {
        if (clientType === 'desktop' && registrySyncPendingRef.current) {
          const localCustomOutputs = (Array.isArray(store.customOutputIds) ? store.customOutputIds : [])
            .filter((id) => isCustomOutputId(id));
          const matchesLocal =
            localCustomOutputs.length === customOutputs.length
            && localCustomOutputs.every((id) => customOutputs.includes(id));

          if (!matchesLocal) {
            logDebug('Ignoring stale outputsRegistry while sync is pending', {
              expected: localCustomOutputs,
              received: customOutputs,
            });
            return;
          }

          registrySyncPendingRef.current = false;
          pendingRegisteredOutputsRef.current = null;
        }

        store.setCustomOutputs(customOutputs);
      }
    });

    const shouldHandleOutputMetrics =
      role === 'control' ||
      role === 'stage' ||
      (typeof role === 'string' && role.startsWith('output') && role !== 'output-discovery');

    if (shouldHandleOutputMetrics) {
      socket.on('styleUpdate', (payload) => {
        if (!isPlainObject(payload) || !isRoutableOutput(payload.output) || !isPlainObject(payload.settings)) {
          return;
        }
        const { output, settings } = payload;
        logDebug('Received style update for', output, ':', settings);

        if (output === 'stage' && role === 'stage') {

          updateOutputSettings(output, settings);
        } else if (output !== 'stage') {

          const { autosizerActive, primaryViewportWidth, primaryViewportHeight, allInstances, instanceCount, ...styleSettings } = settings;
          updateOutputSettings(output, styleSettings);
        }
      });

      socket.on('outputMetrics', (payload) => {
        if (!isPlainObject(payload) || !isOutputId(payload.output) || !isPlainObject(payload.metrics)) {
          return;
        }
        const { output, metrics, allInstances, instanceCount } = payload;
        try {
          const updates = {
            autosizerActive: metrics?.autosizerActive ?? false,
            primaryViewportWidth: metrics?.viewportWidth ?? null,
            primaryViewportHeight: metrics?.viewportHeight ?? null,
            allInstances: allInstances || null,
            instanceCount: Number.isFinite(instanceCount) ? instanceCount : 1,
          };

          if (typeof output === 'string' && output.startsWith('output')) {
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

    socket.on('stageTimerUpdate', (timerData) => {
      logDebug('Received stage timer update:', timerData);
      window.dispatchEvent(new CustomEvent('stage-timer-update', {
        detail: timerData,
      }));
    });

    if (role === 'stage') {
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
      const finalFileType = normalizeLyricFileType({ fileType, fileName: originalName || fileName, fallback: 'txt' });
      setLyricsFileName(fileName);
      selectLine(null);
      if (rawContent) {
        setRawLyricsContent(rawContent);
      }
      setLyricsSource({
        content: rawContent || '',
        fileType: finalFileType,
        filePath: savedMetadata?.filePath || null,
        fileName: originalName || fileName || '',
      });
      if (savedMetadata?.sections) {
        setLyricsSections(savedMetadata.sections);
        setLineToSection(savedMetadata.lineToSection || {});
      } else if (linesCount && useLyricsStore.getState().lyrics?.length) {
        const derived = deriveSectionsFromProcessedLines(useLyricsStore.getState().lyrics);
        setLyricsSections(derived.sections || []);
        setLineToSection(derived.lineToSection || {});
      }

      let computedOrigin = 'Setlist';
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
      if (shouldIgnoreEmptyRemoteFileName(fileName)) {
        logDebug('Ignoring empty fileNameUpdate to preserve local desktop state');
        return;
      }
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
      applySnapshot(state, 'periodicStateSync');
    });
  }, [role, setLyrics, setLyricsSections, setLineToSection, setLyricsTimestamps, setLyricsEnhancedTimestamps, selectLine, updateOutputSettings, setSetlistFiles, setIsDesktopApp, setLyricsFileName, setRawLyricsContent, setLyricsSource, setSongMetadata]);

  const registerAuthenticatedHandlers = useCallback(({
    socket,
    clientType,
    isDesktopApp,
    reconnectTimeoutRef,
    startHeartbeat,
    stopHeartbeat,
    setConnectionStatus,
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
      const confirmedPurpose = typeof clientPurpose === 'string' && clientPurpose.trim()
        ? clientPurpose.trim()
        : role;
      socket.emit('clientConnect', { type: clientType, purpose: confirmedPurpose });

      setTimeout(() => {
        socket.emit('requestCurrentState');
      }, 500);

      const isOutputRole = typeof role === 'string' && role.startsWith('output');
      const shouldSyncOutputSettings = !isOutputRole && role !== 'stage' && role !== 'timer-control';

      if (shouldSyncOutputSettings && clientType === 'desktop') {
        const syncOutputSettingsFromStore = () => {
          try {
            const storeState = useLyricsStore.getState();
            const customOutputs = Array.isArray(storeState.customOutputIds) ? storeState.customOutputIds : [];
            registrySyncPendingRef.current = true;
            pendingRegisteredOutputsRef.current = new Set(customOutputs);
            socket.emit('outputsRegister', { outputs: storeState.customOutputIds || [] });

            for (const key of Object.keys(storeState)) {
              if (key.startsWith('output') && key.endsWith('Settings') && storeState[key]) {
                const outputId = key.slice(0, -'Settings'.length);
                socket.emit('styleUpdate', { output: outputId, settings: storeState[key] });
              }
            }

            if (storeState.stageSettings) {
              socket.emit('styleUpdate', { output: 'stage', settings: storeState.stageSettings });
            }

            logDebug('Synced output settings to server after reconnect');
          } catch (error) {
            registrySyncPendingRef.current = false;
            pendingRegisteredOutputsRef.current = null;
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
      } else {
        registrySyncPendingRef.current = false;
        pendingRegisteredOutputsRef.current = null;
      }

      if ((isDesktopApp || clientType === 'obsDock') && role !== 'timer-control') {
        setTimeout(() => {
          const currentState = useLyricsStore.getState();

          if (isDesktopApp) {
            socket.emit('outputToggle', currentState.isOutputOn);
            for (const key of Object.keys(currentState)) {
              if (key.startsWith('output') && key.endsWith('Enabled') && typeof currentState[key] === 'boolean') {
                const outputId = key.slice(0, -'Enabled'.length);
                socket.emit('individualOutputToggle', { output: outputId, enabled: currentState[key] });
              }
            }
            if (typeof currentState.stageEnabled === 'boolean') {
              socket.emit('individualOutputToggle', { output: 'stage', enabled: currentState.stageEnabled });
            }
          }

          if (currentState.lyrics.length > 0) {
            socket.emit('lyricsLoad', {
              lyrics: currentState.lyrics,
              fileName: currentState.lyricsFileName || '',
              rawLyricsContent: currentState.rawLyricsContent || '',
              lyricsSource: currentState.lyricsSource || null,
              songMetadata: currentState.songMetadata || null,
              lyricsTimestamps: currentState.lyricsTimestamps || [],
              lyricsEnhancedTimestamps: currentState.lyricsEnhancedTimestamps || [],
              sections: currentState.lyricsSections || [],
              lineToSection: currentState.lineToSection || {},
            });
            if (Array.isArray(currentState.lyricsTimestamps) && currentState.lyricsTimestamps.length > 0) {
              socket.emit('lyricsTimestampsUpdate', currentState.lyricsTimestamps);
            }
            if (currentState.lyricsFileName) {
              socket.emit('fileNameUpdate', currentState.lyricsFileName);
            }
            socket.emit('lineUpdate', { index: currentState.selectedLine });
          }
        }, 1000);
      }
    });

    socket.on('disconnect', (reason) => {
      logDebug('Socket disconnected:', reason);
      setConnectionStatus('disconnected');
      stopHeartbeat();
    });

    socket.on('connect_error', (error) => {
      logError('Socket connection error:', error);
      setConnectionStatus('error');

      if (error.message?.includes('Authentication') || error.message?.includes('token')) {
        logDebug('Authentication error, clearing token and retrying...');
        handleAuthError(error.message, false);
      }
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
  }, [setIsDesktopApp, setupApplicationEventHandlers, role, clientPurpose]);

  return {
    setupApplicationEventHandlers,
    registerAuthenticatedHandlers,
  };
};

export default useSocketEvents;
