import { deriveSectionsFromProcessedLines } from '../../../shared/lyricsParsing.js';
import { appendActionLog } from '../actionLog.js';
import { emitLyricsLoad, emitLyricsRenderEvent } from '../broadcast.js';
import { blockIfLiveSafety } from '../liveSafety.js';
import { schedulePersistSessionState } from '../sessionPersistence.js';
import { state } from '../state.js';
import { isPlainObject, isValidLineIndex } from '../utils.js';

export function registerLyricsHandlers({ io, socket, hasPermission, clientType, deviceId, sessionId }) {
  const actor = { clientType, deviceId, sessionId };

  socket.on('lineUpdate', (payload) => {
    if (!hasPermission(socket, 'output:control')) {
      socket.emit('permissionError', 'Insufficient permissions to control output');
      return;
    }

    if (!isPlainObject(payload) || !isValidLineIndex(payload.index)) {
      socket.emit('permissionError', 'Invalid line update payload');
      return;
    }

    const { index } = payload;
    const changed = state.currentSelectedLine !== index;
    state.currentSelectedLine = index;
    schedulePersistSessionState();
    console.log(`Line updated to ${index} by ${clientType} client`);
    if (changed) {
      appendActionLog(io, {
        type: 'line',
        label: 'Line changed',
        detail: `Selected line ${index + 1}`,
        actor,
        target: 'lyrics',
        metadata: { index },
      });
    }
    emitLyricsRenderEvent(io, 'lineUpdate', { index });
  });

  socket.on('lyricsLoad', (payload) => {
    if (blockIfLiveSafety({ io, socket, clientType, deviceId, sessionId, action: 'lyricsLoad' })) {
      return;
    }

    if (!hasPermission(socket, 'lyrics:write')) {
      socket.emit('permissionError', 'Insufficient permissions to load lyrics');
      return;
    }

    const payloadObject = isPlainObject(payload) ? payload : null;
    const lyrics = Array.isArray(payload) ? payload : payloadObject?.lyrics || [];
    const fileName = payloadObject ? (payloadObject.fileName || '') : '';
    const incomingTimestamps = Array.isArray(payloadObject?.lyricsTimestamps) ? payloadObject.lyricsTimestamps : [];
    const incomingEnhancedTimestamps = Array.isArray(payloadObject?.lyricsEnhancedTimestamps) ? payloadObject.lyricsEnhancedTimestamps : [];
    const incomingSections = Array.isArray(payloadObject?.sections) ? payloadObject.sections : null;
    const incomingLineToSection = isPlainObject(payloadObject?.lineToSection) ? payloadObject.lineToSection : null;

    state.currentLyrics = lyrics;
    state.currentLyricsTimestamps = incomingTimestamps;
    state.currentLyricsEnhancedTimestamps = incomingEnhancedTimestamps;
    const derived = incomingSections ? null : deriveSectionsFromProcessedLines(state.currentLyrics);
    state.currentLyricsSections = incomingSections || derived?.sections || [];
    state.currentLineToSection = incomingLineToSection || derived?.lineToSection || {};
    state.currentSelectedLine = null;
    state.currentLyricsFileName = fileName;
    state.currentRawLyricsContent = typeof payloadObject?.rawLyricsContent === 'string' ? payloadObject.rawLyricsContent : '';
    state.currentLyricsSource = isPlainObject(payloadObject?.lyricsSource)
      ? payloadObject.lyricsSource
      : {
        content: state.currentRawLyricsContent,
        fileType: Array.isArray(incomingTimestamps) && incomingTimestamps.length > 0 ? 'lrc' : 'txt',
        filePath: null,
        fileName,
      };
    state.currentSongMetadata = isPlainObject(payloadObject?.songMetadata)
      ? payloadObject.songMetadata
      : {
        title: fileName || '',
        artists: [],
        album: null,
        year: null,
        origin: '',
        filePath: null,
        lyricLines: lyrics.length,
      };
    schedulePersistSessionState();
    console.log(`Lyrics loaded by ${clientType} client:`, lyrics.length, 'lines', fileName ? `(filename: "${fileName}")` : '');
    appendActionLog(io, {
      type: 'lyrics',
      label: 'Lyrics loaded',
      detail: `${fileName || 'Untitled lyrics'} (${lyrics.length} lines)`,
      actor,
      target: fileName || 'lyrics',
      metadata: { lines: lyrics.length },
    });
    emitLyricsLoad(io, {
      lyrics,
      fileName: state.currentLyricsFileName,
      rawLyricsContent: state.currentRawLyricsContent,
      lyricsSource: state.currentLyricsSource,
      songMetadata: state.currentSongMetadata,
      lyricsTimestamps: state.currentLyricsTimestamps,
      lyricsEnhancedTimestamps: state.currentLyricsEnhancedTimestamps,
      sections: state.currentLyricsSections,
      lineToSection: state.currentLineToSection,
    });
    emitLyricsRenderEvent(io, 'lyricsTimestampsUpdate', state.currentLyricsTimestamps);
    emitLyricsRenderEvent(io, 'lyricsSectionsUpdate', { sections: state.currentLyricsSections, lineToSection: state.currentLineToSection });
    emitLyricsRenderEvent(io, 'fileNameUpdate', state.currentLyricsFileName);
  });

  socket.on('lyricsTimestampsUpdate', (timestamps) => {
    if (blockIfLiveSafety({ io, socket, clientType, deviceId, sessionId, action: 'lyricsTimestampsUpdate' })) {
      return;
    }

    if (!hasPermission(socket, 'lyrics:write')) {
      socket.emit('permissionError', 'Insufficient permissions to update timestamps');
      return;
    }

    state.currentLyricsTimestamps = timestamps || [];
    schedulePersistSessionState();
    console.log(`Lyrics timestamps updated by ${clientType} client:`, timestamps?.length, 'timestamps');
    appendActionLog(io, {
      type: 'lyrics',
      label: 'Timestamps updated',
      detail: `${timestamps?.length || 0} timestamp(s) updated`,
      actor,
      target: state.currentLyricsFileName || 'lyrics',
      metadata: { timestamps: timestamps?.length || 0 },
    });
    emitLyricsRenderEvent(io, 'lyricsTimestampsUpdate', timestamps);
  });

  socket.on('splitNormalGroup', (payload = {}) => {
    if (blockIfLiveSafety({ io, socket, clientType, deviceId, sessionId, action: 'splitNormalGroup' })) {
      return;
    }

    if (!hasPermission(socket, 'output:control')) {
      socket.emit('permissionError', 'Insufficient permissions to split groups');
      return;
    }

    const index = typeof payload === 'number' ? payload : payload?.index;
    if (!Number.isInteger(index) || index < 0 || index >= state.currentLyrics.length) {
      socket.emit('lyricsSplitError', 'Invalid group index');
      return;
    }

    const target = state.currentLyrics[index];
    if (!target || target.type !== 'normal-group') {
      socket.emit('lyricsSplitError', 'Selected line is not a normal group');
      return;
    }

    const groupLines = (Array.isArray(target.lines) && target.lines.length > 0)
      ? target.lines.filter((line) => typeof line === 'string' && line.trim().length > 0)
      : [target.line1, target.line2].filter((line) => typeof line === 'string' && line.trim().length > 0);

    if (groupLines.length < 2) {
      socket.emit('lyricsSplitError', 'Selected group is invalid');
      return;
    }

    const newLyrics = [...state.currentLyrics];
    newLyrics.splice(index, 1, ...groupLines);
    const timestampsAligned = Array.isArray(state.currentLyricsTimestamps) && state.currentLyricsTimestamps.length === state.currentLyrics.length;
    const enhancedTimestampsAligned = Array.isArray(state.currentLyricsEnhancedTimestamps) && state.currentLyricsEnhancedTimestamps.length === state.currentLyrics.length;
    const nextTimestamps = timestampsAligned ? [...state.currentLyricsTimestamps] : [];
    const nextEnhancedTimestamps = enhancedTimestampsAligned ? [...state.currentLyricsEnhancedTimestamps] : [];
    if (timestampsAligned) {
      const groupTimestamp = state.currentLyricsTimestamps[index];
      nextTimestamps.splice(index, 1, ...groupLines.map(() => groupTimestamp ?? null));
    }
    if (enhancedTimestampsAligned) {
      const groupEnhanced = state.currentLyricsEnhancedTimestamps[index];
      const expandedEnhanced = Array.isArray(groupEnhanced) && groupEnhanced.every(Array.isArray)
        ? groupEnhanced.slice(0, groupLines.length)
        : groupLines.map(() => []);
      nextEnhancedTimestamps.splice(index, 1, ...expandedEnhanced);
    }
    state.currentLyrics = newLyrics;
    state.currentLyricsTimestamps = nextTimestamps;
    state.currentLyricsEnhancedTimestamps = nextEnhancedTimestamps;
    const derived = deriveSectionsFromProcessedLines(state.currentLyrics);
    state.currentLyricsSections = derived.sections || [];
    state.currentLineToSection = derived.lineToSection || {};
    schedulePersistSessionState();

    if (typeof state.currentSelectedLine === 'number') {
      if (state.currentSelectedLine > index) {
        state.currentSelectedLine += Math.max(0, groupLines.length - 1);
      }
    }

    console.log(`Normal group split at index ${index} by ${clientType} client (${deviceId})`);
    appendActionLog(io, {
      type: 'lyrics',
      label: 'Lyric group split',
      detail: `Split group at line ${index + 1} into ${groupLines.length} lines`,
      actor,
      target: state.currentLyricsFileName || 'lyrics',
      metadata: { index, lines: groupLines.length },
    });
    emitLyricsLoad(io, {
      lyrics: state.currentLyrics,
      fileName: state.currentLyricsFileName,
      rawLyricsContent: state.currentRawLyricsContent,
      lyricsSource: state.currentLyricsSource,
      songMetadata: state.currentSongMetadata,
      lyricsTimestamps: state.currentLyricsTimestamps,
      lyricsEnhancedTimestamps: state.currentLyricsEnhancedTimestamps,
      sections: state.currentLyricsSections,
      lineToSection: state.currentLineToSection,
    });
    emitLyricsRenderEvent(io, 'lyricsTimestampsUpdate', state.currentLyricsTimestamps);
    emitLyricsRenderEvent(io, 'lyricsSectionsUpdate', { sections: state.currentLyricsSections, lineToSection: state.currentLineToSection });

    if (typeof state.currentSelectedLine === 'number') {
      emitLyricsRenderEvent(io, 'lineUpdate', { index: state.currentSelectedLine });
    }

    socket.emit('lyricsSplitSuccess', { index });
  });

  socket.on('fileNameUpdate', (fileName) => {
    if (blockIfLiveSafety({ io, socket, clientType, deviceId, sessionId, action: 'fileNameUpdate' })) {
      return;
    }

    if (!hasPermission(socket, 'lyrics:write')) {
      socket.emit('permissionError', 'Insufficient permissions to update filename');
      return;
    }

    const changed = state.currentLyricsFileName !== fileName;
    state.currentLyricsFileName = fileName;
    state.currentLyricsSource = {
      ...(state.currentLyricsSource || {}),
      fileName: state.currentLyricsSource?.fileName || fileName || '',
    };
    if (state.currentSongMetadata && typeof state.currentSongMetadata === 'object' && !state.currentSongMetadata.title) {
      state.currentSongMetadata = { ...state.currentSongMetadata, title: fileName || '' };
    }
    schedulePersistSessionState();
    console.log(`Filename updated to "${fileName}" by ${clientType} client`);
    if (changed) {
      appendActionLog(io, {
        type: 'lyrics',
        label: 'Filename updated',
        detail: `Lyrics title changed to "${fileName || 'Untitled'}"`,
        actor,
        target: fileName || 'lyrics',
      });
    }
    emitLyricsRenderEvent(io, 'fileNameUpdate', fileName);
  });

  socket.on('autoplayStateUpdate', ({ isActive, clientType: autoplayClientType }) => {
    if (blockIfLiveSafety({ io, socket, clientType, deviceId, sessionId, action: 'autoplayStateUpdate' })) {
      return;
    }

    if (!hasPermission(socket, 'output:control')) {
      socket.emit('permissionError', 'Insufficient permissions to update autoplay state');
      return;
    }

    console.log(`Autoplay state updated by ${clientType} client: ${isActive ? 'active' : 'inactive'}`);
    appendActionLog(io, {
      type: 'output',
      label: 'Autoplay state changed',
      detail: `Autoplay ${isActive ? 'started' : 'stopped'}`,
      actor,
      target: 'autoplay',
      metadata: { active: Boolean(isActive), source: autoplayClientType || clientType },
    });
    socket.broadcast.emit('autoplayStateUpdate', { isActive, clientType: autoplayClientType });
  });
}
