import { parseTxtContent, parseLrcContent } from '../../../shared/lyricsParsing.js';
import {
  normalizeLyricFileType,
  stripLyricImportExtension,
} from '../../../shared/lyricImportRegistry.js';
import { appendActionLog } from '../actionLog.js';
import { emitControllerEvent, emitLyricsLoad, emitLyricsRenderEvent, emitSetlistUpdate } from '../broadcast.js';
import { blockIfLiveSafety } from '../liveSafety.js';
import { schedulePersistSessionState } from '../sessionPersistence.js';
import { normalizeIncomingSetlistFiles, validatePersistedSetlistFiles } from '../setlistValidation.js';
import { state, summarizeSetlistForDisplay } from '../state.js';

export function registerSetlistHandlers({ io, socket, hasPermission, clientType, deviceId, sessionId }) {
  const actor = { clientType, deviceId, sessionId };

  socket.on('requestSetlist', () => {
    if (!hasPermission(socket, 'setlist:read')) {
      socket.emit('permissionError', 'Insufficient permissions to access setlist');
      return;
    }

    const clientInfo = state.connectedClients.get(socket.id);
    const files = clientInfo?.type === 'stage'
      ? summarizeSetlistForDisplay(state.setlistFiles)
      : state.setlistFiles;
    socket.emit('setlistUpdate', files);
    console.log('Setlist sent to authenticated client:', socket.id, `(${state.setlistFiles.length} items)`);
  });

  socket.on('setlistAdd', (files) => {
    if (blockIfLiveSafety({ io, socket, clientType, deviceId, sessionId, action: 'setlistAdd' })) {
      return;
    }

    if (!hasPermission(socket, 'setlist:write')) {
      socket.emit('permissionError', 'Insufficient permissions to modify setlist');
      return;
    }

    try {
      const normalized = normalizeIncomingSetlistFiles(files, {
        existingFiles: state.setlistFiles,
        actor,
      });
      if (!normalized.valid) {
        socket.emit('setlistError', normalized.error);
        return;
      }
      const newFiles = normalized.entries;

      state.setlistFiles.push(...newFiles);
      schedulePersistSessionState();
      console.log(`${clientType} client added ${newFiles.length} files to setlist. Total: ${state.setlistFiles.length}`);
      appendActionLog(io, {
        type: 'setlist',
        label: 'Setlist songs added',
        detail: `${newFiles.length} song${newFiles.length === 1 ? '' : 's'} added to setlist`,
        actor,
        target: 'setlist',
        metadata: {
          added: newFiles.length,
          total: state.setlistFiles.length,
          songs: newFiles.map((file) => file.displayName),
        },
      });

      emitSetlistUpdate(io, state.setlistFiles);
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
    if (blockIfLiveSafety({ io, socket, clientType, deviceId, sessionId, action: 'setlistRemove' })) {
      return;
    }

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
        schedulePersistSessionState();
        console.log(`${clientType} client removed file ${fileId} from setlist. Remaining: ${state.setlistFiles.length}`);
        appendActionLog(io, {
          type: 'setlist',
          label: 'Setlist song removed',
          detail: `Removed "${fileToRemove?.displayName || fileToRemove?.originalName || fileId}" from setlist`,
          actor,
          target: fileToRemove?.displayName || fileId,
          metadata: { total: state.setlistFiles.length },
        });
        emitSetlistUpdate(io, state.setlistFiles);
        socket.emit('setlistRemoveSuccess', fileId);
      } else {
        socket.emit('setlistError', 'File not found in setlist');
      }
    } catch (error) {
      console.error('setlistRemove error:', error.message);
      socket.emit('setlistError', error.message);
    }
  });

  socket.on('setlistItemUpdate', (payload, acknowledge) => {
    const finish = (result) => {
      if (typeof acknowledge === 'function') acknowledge(result);
      if (!result.success) socket.emit('setlistError', result.error);
    };

    if (blockIfLiveSafety({ io, socket, clientType, deviceId, sessionId, action: 'setlistItemUpdate' })) {
      finish({ success: false, error: 'Setlist updates are blocked while Live Safety Mode is enabled' });
      return;
    }

    if (!hasPermission(socket, 'setlist:write')) {
      socket.emit('permissionError', 'Insufficient permissions to modify setlist');
      finish({ success: false, error: 'Insufficient permissions to modify setlist' });
      return;
    }

    const fileId = typeof payload?.fileId === 'string' ? payload.fileId : '';
    const fileIndex = state.setlistFiles.findIndex((file) => file.id === fileId);
    if (!fileId || fileIndex < 0) {
      finish({ success: false, error: 'Setlist item was not found' });
      return;
    }

    const existing = state.setlistFiles[fileIndex];
    if (!hasPermission(socket, 'admin:full') && existing?.addedBy?.sessionId !== sessionId) {
      socket.emit('permissionError', 'You can only update files you added');
      finish({ success: false, error: 'You can only update files you added' });
      return;
    }

    try {
      const otherFiles = state.setlistFiles.filter((file) => file.id !== fileId);
      const normalized = normalizeIncomingSetlistFiles([payload?.file], {
        existingFiles: otherFiles,
        actor,
      });
      if (!normalized.valid) {
        finish({ success: false, error: normalized.error });
        return;
      }

      const replacement = normalized.entries[0];
      const updated = {
        ...existing,
        displayName: replacement.displayName,
        originalName: replacement.originalName,
        content: replacement.content,
        lastModified: replacement.lastModified,
        fileType: replacement.fileType,
        metadata: replacement.metadata,
      };
      const nextFiles = [...state.setlistFiles];
      nextFiles[fileIndex] = updated;
      const validated = validatePersistedSetlistFiles(nextFiles);
      if (!validated.valid) {
        finish({ success: false, error: 'Updated setlist data is invalid or too large' });
        return;
      }

      state.setlistFiles = validated.files;
      schedulePersistSessionState();
      appendActionLog(io, {
        type: 'setlist',
        label: 'Setlist song updated',
        detail: `Updated "${updated.displayName}" in the setlist`,
        actor,
        target: updated.displayName,
        metadata: { fileId, fileType: updated.fileType },
      });
      emitSetlistUpdate(io, state.setlistFiles);
      finish({ success: true, fileId, file: state.setlistFiles[fileIndex] });
    } catch (error) {
      console.error('setlistItemUpdate error:', error.message);
      finish({ success: false, error: error.message });
    }
  });

  socket.on('setlistLoad', (fileId) => {
    if (blockIfLiveSafety({ io, socket, clientType, deviceId, sessionId, action: 'setlistLoad' })) {
      return;
    }

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
      let enhancedTimestamps = [];
      let editableRawContent = file.content;
      let sections = [];
      let lineToSection = {};
      const finalFileType = normalizeLyricFileType({
        fileType: file.fileType,
        fileName: file.originalName,
        fallback: 'txt',
      });
      const isLrc = finalFileType === 'lrc';

      if (isLrc) {
        const parsed = parseLrcContent(file.content);
        processedLines = parsed.processedLines;
        timestamps = parsed.timestamps || [];
        enhancedTimestamps = parsed.enhancedTimestamps || [];
        editableRawContent = file.content;
        sections = parsed.sections || [];
        lineToSection = parsed.lineToSection || {};
      } else {
        const parsed = parseTxtContent(file.content);
        processedLines = parsed.processedLines;
        timestamps = [];
        sections = parsed.sections || [];
        lineToSection = parsed.lineToSection || {};
      }

      const cleanDisplayName = stripLyricImportExtension(file.displayName || file.originalName || '') || file.displayName;

      state.currentLyrics = processedLines;
      state.currentLyricsTimestamps = timestamps;
      state.currentLyricsEnhancedTimestamps = enhancedTimestamps;
      state.currentSelectedLine = null;
      state.currentLyricsFileName = cleanDisplayName;
      state.currentRawLyricsContent = editableRawContent;
      state.currentLyricsSource = {
        content: file.content || editableRawContent || '',
        fileType: finalFileType,
        filePath: file.metadata?.filePath || null,
        fileName: file.originalName || cleanDisplayName || '',
        setlistItemId: file.id,
      };
      state.currentSongMetadata = {
        ...(file.metadata || {}),
        title: file.metadata?.title || cleanDisplayName || '',
        lyricLines: processedLines.length,
        filePath: file.metadata?.filePath || null,
      };
      state.currentLyricsSections = sections;
      state.currentLineToSection = lineToSection;
      schedulePersistSessionState();

      console.log(`${clientType} client loaded "${cleanDisplayName}" from setlist (${processedLines.length} lines, ${timestamps.length} timestamps)`);
      appendActionLog(io, {
        type: 'setlist',
        label: 'Setlist song loaded',
        detail: `Loaded "${cleanDisplayName}" from setlist`,
        actor,
        target: cleanDisplayName,
        metadata: {
          lines: processedLines.length,
          timestamps: timestamps.length,
          fileType: finalFileType,
        },
      });

      emitLyricsLoad(io, {
        lyrics: processedLines,
        fileName: cleanDisplayName,
        rawLyricsContent: editableRawContent,
        lyricsSource: state.currentLyricsSource,
        songMetadata: state.currentSongMetadata,
        lyricsTimestamps: timestamps,
        lyricsEnhancedTimestamps: enhancedTimestamps,
        sections,
        lineToSection,
      });
      emitLyricsRenderEvent(io, 'lyricsTimestampsUpdate', timestamps);
      emitLyricsRenderEvent(io, 'lyricsSectionsUpdate', { sections, lineToSection });
      emitControllerEvent(io, 'setlistLoadSuccess', {
        fileId,
        fileName: cleanDisplayName,
        originalName: file.originalName,
        fileType: finalFileType,
        linesCount: processedLines.length,
        rawContent: editableRawContent,
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
    if (blockIfLiveSafety({ io, socket, clientType, deviceId, sessionId, action: 'setlistClear' })) {
      return;
    }

    if (!hasPermission(socket, 'setlist:delete')) {
      socket.emit('permissionError', 'Insufficient permissions to clear setlist');
      return;
    }

    const previousCount = state.setlistFiles.length;
    state.setlistFiles = [];
    schedulePersistSessionState();
    console.log(`Setlist cleared by ${clientType} client`);
    appendActionLog(io, {
      type: 'setlist',
      label: 'Setlist cleared',
      detail: `Cleared ${previousCount} song${previousCount === 1 ? '' : 's'} from setlist`,
      actor,
      target: 'setlist',
      metadata: { previousCount },
    });
    emitSetlistUpdate(io, state.setlistFiles);
    socket.emit('setlistClearSuccess');
  });

  socket.on('setlistReorder', (payload) => {
    if (blockIfLiveSafety({ io, socket, clientType, deviceId, sessionId, action: 'setlistReorder' })) {
      return;
    }

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
    schedulePersistSessionState();
    console.log(`${clientType} client reordered setlist (${state.setlistFiles.length} items)`);
    appendActionLog(io, {
      type: 'setlist',
      label: 'Setlist reordered',
      detail: `Reordered ${state.setlistFiles.length} setlist song${state.setlistFiles.length === 1 ? '' : 's'}`,
      actor,
      target: 'setlist',
      metadata: { total: state.setlistFiles.length },
    });

    emitSetlistUpdate(io, state.setlistFiles);
    socket.emit('setlistReorderSuccess', {
      orderedIds,
      totalCount: state.setlistFiles.length,
    });
  });

  socket.on('setlistReplace', (payload, acknowledge) => {
    const respond = (result) => {
      if (typeof acknowledge === 'function') {
        acknowledge(result);
      } else if (!result.success) {
        socket.emit('setlistError', result.error);
      }
    };

    if (blockIfLiveSafety({ io, socket, clientType, deviceId, sessionId, action: 'setlistReplace' })) {
      respond({ success: false, error: 'Live safety mode is active' });
      return;
    }

    if (!hasPermission(socket, 'setlist:write') || !hasPermission(socket, 'setlist:delete')) {
      socket.emit('permissionError', 'Insufficient permissions to replace setlist');
      respond({ success: false, error: 'Insufficient permissions to replace setlist' });
      return;
    }

    const files = payload?.files;
    const normalized = normalizeIncomingSetlistFiles(files, { actor });
    if (!normalized.valid) {
      respond({ success: false, error: normalized.error });
      return;
    }

    const previousCount = state.setlistFiles.length;
    state.setlistFiles = normalized.entries;
    schedulePersistSessionState();

    appendActionLog(io, {
      type: 'setlist',
      label: 'Setlist replaced',
      detail: `Replaced ${previousCount} song${previousCount === 1 ? '' : 's'} with ${state.setlistFiles.length}`,
      actor,
      target: 'setlist',
      metadata: {
        previousCount,
        total: state.setlistFiles.length,
        songs: state.setlistFiles.map((file) => file.displayName),
      },
    });

    emitSetlistUpdate(io, state.setlistFiles);
    respond({
      success: true,
      replacedCount: previousCount,
      totalCount: state.setlistFiles.length,
    });
  });
}
