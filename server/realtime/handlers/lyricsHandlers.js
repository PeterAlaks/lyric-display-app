import { deriveSectionsFromProcessedLines } from '../../../shared/lyricsParsing.js';
import { appendActionLog } from '../actionLog.js';
import { blockIfLiveSafety } from '../liveSafety.js';
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
    io.emit('lineUpdate', { index });
  });

  socket.on('lyricsLoad', (payload) => {
    if (blockIfLiveSafety({ io, socket, clientType, deviceId, sessionId, action: 'lyricsLoad' })) {
      return;
    }

    if (!hasPermission(socket, 'lyrics:write')) {
      socket.emit('permissionError', 'Insufficient permissions to load lyrics');
      return;
    }

    const lyrics = Array.isArray(payload) ? payload : payload?.lyrics || [];
    const fileName = typeof payload === 'object' ? (payload.fileName || '') : '';

    state.currentLyrics = lyrics;
    state.currentLyricsTimestamps = [];
    const derived = deriveSectionsFromProcessedLines(state.currentLyrics);
    state.currentLyricsSections = derived.sections || [];
    state.currentLineToSection = derived.lineToSection || {};
    state.currentSelectedLine = null;
    state.currentLyricsFileName = fileName;
    console.log(`Lyrics loaded by ${clientType} client:`, lyrics.length, 'lines', fileName ? `(filename: "${fileName}")` : '');
    appendActionLog(io, {
      type: 'lyrics',
      label: 'Lyrics loaded',
      detail: `${fileName || 'Untitled lyrics'} (${lyrics.length} lines)`,
      actor,
      target: fileName || 'lyrics',
      metadata: { lines: lyrics.length },
    });
    io.emit('lyricsLoad', lyrics);
    io.emit('lyricsTimestampsUpdate', state.currentLyricsTimestamps);
    io.emit('lyricsSectionsUpdate', { sections: state.currentLyricsSections, lineToSection: state.currentLineToSection });
    io.emit('fileNameUpdate', state.currentLyricsFileName);
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
    console.log(`Lyrics timestamps updated by ${clientType} client:`, timestamps?.length, 'timestamps');
    appendActionLog(io, {
      type: 'lyrics',
      label: 'Timestamps updated',
      detail: `${timestamps?.length || 0} timestamp(s) updated`,
      actor,
      target: state.currentLyricsFileName || 'lyrics',
      metadata: { timestamps: timestamps?.length || 0 },
    });
    io.emit('lyricsTimestampsUpdate', timestamps);
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
    state.currentLyrics = newLyrics;
    state.currentLyricsTimestamps = [];
    const derived = deriveSectionsFromProcessedLines(state.currentLyrics);
    state.currentLyricsSections = derived.sections || [];
    state.currentLineToSection = derived.lineToSection || {};

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
    io.emit('lyricsLoad', state.currentLyrics);
    io.emit('lyricsTimestampsUpdate', state.currentLyricsTimestamps);
    io.emit('lyricsSectionsUpdate', { sections: state.currentLyricsSections, lineToSection: state.currentLineToSection });

    if (typeof state.currentSelectedLine === 'number') {
      io.emit('lineUpdate', { index: state.currentSelectedLine });
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
    io.emit('fileNameUpdate', fileName);
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
