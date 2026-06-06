import { deriveSectionsFromProcessedLines } from '../../../shared/lyricsParsing.js';
import { blockIfLiveSafety } from '../liveSafety.js';
import { state } from '../state.js';
import { isPlainObject, isValidLineIndex } from '../utils.js';

export function registerLyricsHandlers({ io, socket, hasPermission, clientType, deviceId }) {
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
    state.currentSelectedLine = index;
    console.log(`Line updated to ${index} by ${clientType} client`);
    io.emit('lineUpdate', { index });
  });

  socket.on('lyricsLoad', (payload) => {
    if (blockIfLiveSafety({ socket, clientType, action: 'lyricsLoad' })) {
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
    io.emit('lyricsLoad', lyrics);
    io.emit('lyricsTimestampsUpdate', state.currentLyricsTimestamps);
    io.emit('lyricsSectionsUpdate', { sections: state.currentLyricsSections, lineToSection: state.currentLineToSection });
    io.emit('fileNameUpdate', state.currentLyricsFileName);
  });

  socket.on('lyricsTimestampsUpdate', (timestamps) => {
    if (blockIfLiveSafety({ socket, clientType, action: 'lyricsTimestampsUpdate' })) {
      return;
    }

    if (!hasPermission(socket, 'lyrics:write')) {
      socket.emit('permissionError', 'Insufficient permissions to update timestamps');
      return;
    }

    state.currentLyricsTimestamps = timestamps || [];
    console.log(`Lyrics timestamps updated by ${clientType} client:`, timestamps?.length, 'timestamps');
    io.emit('lyricsTimestampsUpdate', timestamps);
  });

  socket.on('splitNormalGroup', (payload = {}) => {
    if (blockIfLiveSafety({ socket, clientType, action: 'splitNormalGroup' })) {
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
    io.emit('lyricsLoad', state.currentLyrics);
    io.emit('lyricsTimestampsUpdate', state.currentLyricsTimestamps);
    io.emit('lyricsSectionsUpdate', { sections: state.currentLyricsSections, lineToSection: state.currentLineToSection });

    if (typeof state.currentSelectedLine === 'number') {
      io.emit('lineUpdate', { index: state.currentSelectedLine });
    }

    socket.emit('lyricsSplitSuccess', { index });
  });

  socket.on('fileNameUpdate', (fileName) => {
    if (blockIfLiveSafety({ socket, clientType, action: 'fileNameUpdate' })) {
      return;
    }

    if (!hasPermission(socket, 'lyrics:write')) {
      socket.emit('permissionError', 'Insufficient permissions to update filename');
      return;
    }

    state.currentLyricsFileName = fileName;
    console.log(`Filename updated to "${fileName}" by ${clientType} client`);
    io.emit('fileNameUpdate', fileName);
  });

  socket.on('autoplayStateUpdate', ({ isActive, clientType: autoplayClientType }) => {
    if (blockIfLiveSafety({ socket, clientType, action: 'autoplayStateUpdate' })) {
      return;
    }

    if (!hasPermission(socket, 'output:control')) {
      socket.emit('permissionError', 'Insufficient permissions to update autoplay state');
      return;
    }

    console.log(`Autoplay state updated by ${clientType} client: ${isActive ? 'active' : 'inactive'}`);
    socket.broadcast.emit('autoplayStateUpdate', { isActive, clientType: autoplayClientType });
  });
}
