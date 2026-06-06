import { processRawTextToLines, parseLrcContent, deriveSectionsFromProcessedLines } from '../../../shared/lyricsParsing.js';
import { state } from '../state.js';

export function registerSetlistHandlers({ io, socket, hasPermission, clientType, deviceId, sessionId }) {
  socket.on('requestSetlist', () => {
    if (!hasPermission(socket, 'setlist:read')) {
      socket.emit('permissionError', 'Insufficient permissions to access setlist');
      return;
    }

    socket.emit('setlistUpdate', state.setlistFiles);
    console.log('Setlist sent to authenticated client:', socket.id, `(${state.setlistFiles.length} items)`);
  });

  socket.on('setlistAdd', (files) => {
    if (!hasPermission(socket, 'setlist:write')) {
      socket.emit('permissionError', 'Insufficient permissions to modify setlist');
      return;
    }

    try {
      if (!Array.isArray(files)) {
        console.error('setlistAdd: files must be an array');
        socket.emit('setlistError', 'Invalid file data');
        return;
      }

      const totalAfterAdd = state.setlistFiles.length + files.length;
      if (totalAfterAdd > 50) {
        console.error('setlistAdd: Would exceed 50 file limit');
        socket.emit('setlistError', `Cannot add ${files.length} files. Maximum 50 files allowed.`);
        return;
      }

      const normalizeName = (value = '') => String(value).trim().replace(/\.(txt|lrc)$/i, '').toLowerCase();

      const newFiles = files.map((file, index) => {
        if (!file.name || !file.content) {
          throw new Error(`File ${index + 1} is missing name or content`);
        }

        const lowerName = file.name.toLowerCase();
        const isLrc = lowerName.endsWith('.lrc');
        const displayName = file.name.replace(/\.(txt|lrc)$/i, '');
        const normalizedIncoming = normalizeName(file.name);
        const alreadyExists = state.setlistFiles.some((existing) => {
          const candidate = existing?.displayName ?? existing?.originalName ?? '';
          return normalizeName(candidate) === normalizedIncoming;
        });
        if (alreadyExists) {
          throw new Error(`File "${displayName}" already exists in setlist`);
        }

        return {
          id: `setlist_${Date.now()}_${index}`,
          displayName,
          originalName: file.name,
          content: file.content,
          lastModified: file.lastModified || Date.now(),
          addedAt: Date.now(),
          fileType: isLrc ? 'lrc' : 'txt',
          metadata: file.metadata || null,
          addedBy: {
            clientType,
            deviceId,
            sessionId
          }
        };
      });

      state.setlistFiles.push(...newFiles);
      console.log(`${clientType} client added ${newFiles.length} files to setlist. Total: ${state.setlistFiles.length}`);

      io.emit('setlistUpdate', state.setlistFiles);
      socket.emit('setlistAddSuccess', {
        addedCount: newFiles.length,
        totalCount: state.setlistFiles.length
      });

    } catch (error) {
      console.error('setlistAdd error:', error.message);
      socket.emit('setlistError', error.message);
    }
  });

  socket.on('setlistRemove', (fileId) => {
    if (!hasPermission(socket, 'setlist:write')) {
      socket.emit('permissionError', 'Insufficient permissions to modify setlist');
      return;
    }

    try {
      const initialCount = state.setlistFiles.length;
      const fileToRemove = state.setlistFiles.find(file => file.id === fileId);

      if (!hasPermission(socket, 'admin:full') &&
        fileToRemove?.addedBy?.sessionId !== sessionId) {
        socket.emit('permissionError', 'You can only remove files you added');
        return;
      }

      state.setlistFiles = state.setlistFiles.filter(file => file.id !== fileId);

      if (state.setlistFiles.length < initialCount) {
        console.log(`${clientType} client removed file ${fileId} from setlist. Remaining: ${state.setlistFiles.length}`);
        io.emit('setlistUpdate', state.setlistFiles);
        socket.emit('setlistRemoveSuccess', fileId);
      } else {
        socket.emit('setlistError', 'File not found in setlist');
      }
    } catch (error) {
      console.error('setlistRemove error:', error.message);
      socket.emit('setlistError', error.message);
    }
  });

  socket.on('setlistLoad', (fileId) => {
    if (!hasPermission(socket, 'lyrics:write')) {
      socket.emit('permissionError', 'Insufficient permissions to load setlist items into live lyrics');
      return;
    }

    try {
      const file = state.setlistFiles.find(f => f.id === fileId);
      if (!file) {
        socket.emit('setlistError', 'File not found in setlist');
        return;
      }

      let processedLines;
      let timestamps = [];
      let sanitizedRawContent = file.content;
      let sections = [];
      let lineToSection = {};
      const isLrc = (file.fileType === 'lrc') ||
        (typeof file.originalName === 'string' && file.originalName.toLowerCase().endsWith('.lrc'));

      if (isLrc) {
        const parsed = parseLrcContent(file.content);
        processedLines = parsed.processedLines;
        timestamps = parsed.timestamps || [];
        sanitizedRawContent = parsed.rawText;
        sections = parsed.sections || [];
        lineToSection = parsed.lineToSection || {};
      } else {
        processedLines = processRawTextToLines(file.content);
        timestamps = [];
        const derived = deriveSectionsFromProcessedLines(processedLines);
        sections = derived.sections || [];
        lineToSection = derived.lineToSection || {};
      }

      const cleanDisplayName = (file.displayName || file.originalName || '').replace(/\.(txt|lrc)$/i, '') || file.displayName;

      state.currentLyrics = processedLines;
      state.currentLyricsTimestamps = timestamps;
      state.currentSelectedLine = null;
      state.currentLyricsFileName = cleanDisplayName;
      state.currentLyricsSections = sections;
      state.currentLineToSection = lineToSection;

      console.log(`${clientType} client loaded "${cleanDisplayName}" from setlist (${processedLines.length} lines, ${timestamps.length} timestamps)`);

      io.emit('lyricsLoad', processedLines);
      io.emit('lyricsTimestampsUpdate', timestamps);
      io.emit('lyricsSectionsUpdate', { sections, lineToSection });
      io.emit('setlistLoadSuccess', {
        fileId,
        fileName: cleanDisplayName,
        originalName: file.originalName,
        fileType: file.fileType || (isLrc ? 'lrc' : 'txt'),
        linesCount: processedLines.length,
        rawContent: sanitizedRawContent,
        loadedBy: clientType,
        metadata: {
          ...(file.metadata || {}),
          sections,
          lineToSection,
        }
      });

    } catch (error) {
      console.error('setlistLoad error:', error.message);
      socket.emit('setlistError', error.message);
    }
  });

  socket.on('setlistClear', () => {
    if (!hasPermission(socket, 'setlist:delete')) {
      socket.emit('permissionError', 'Insufficient permissions to clear setlist');
      return;
    }

    state.setlistFiles = [];
    console.log(`Setlist cleared by ${clientType} client`);
    io.emit('setlistUpdate', state.setlistFiles);
    socket.emit('setlistClearSuccess');
  });

  socket.on('setlistReorder', (payload) => {
    if (!hasPermission(socket, 'setlist:write')) {
      socket.emit('permissionError', 'Insufficient permissions to modify setlist ordering');
      return;
    }

    const orderedIds = Array.isArray(payload) ? payload : payload?.orderedIds;
    if (!Array.isArray(orderedIds)) {
      socket.emit('setlistError', 'Invalid reorder payload');
      return;
    }

    if (orderedIds.length !== state.setlistFiles.length) {
      socket.emit('setlistError', 'Reorder payload does not match setlist size');
      return;
    }

    const idToFile = new Map(state.setlistFiles.map((file) => [file.id, file]));
    const seen = new Set();
    const reordered = [];

    for (const id of orderedIds) {
      if (seen.has(id)) {
        socket.emit('setlistError', 'Duplicate entries in reorder payload');
        return;
      }
      seen.add(id);
      const file = idToFile.get(id);
      if (!file) {
        socket.emit('setlistError', 'Unknown setlist entry in reorder payload');
        return;
      }
      reordered.push(file);
    }

    if (reordered.length !== state.setlistFiles.length) {
      socket.emit('setlistError', 'Reorder payload incomplete');
      return;
    }

    state.setlistFiles = reordered;
    console.log(`${clientType} client reordered setlist (${state.setlistFiles.length} items)`);

    io.emit('setlistUpdate', state.setlistFiles);
    socket.emit('setlistReorderSuccess', {
      orderedIds,
      totalCount: state.setlistFiles.length,
    });
  });
}
