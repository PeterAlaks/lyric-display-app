import { deriveSectionsFromProcessedLines } from '../../../shared/lyricsParsing.js';
import { appendActionLog } from '../actionLog.js';
import { emitControllerEvent, emitLyricsLoad, emitLyricsRenderEvent } from '../broadcast.js';
import { state } from '../state.js';

export function registerDraftHandlers({ io, socket, hasPermission, clientType, deviceId, sessionId }) {
  const actor = { clientType, deviceId, sessionId };

  socket.on('lyricsDraftSubmit', ({ title, rawText, processedLines }) => {
    if (!hasPermission(socket, 'lyrics:draft')) {
      socket.emit('permissionError', 'Insufficient permissions to submit drafts');
      return;
    }

    console.log(`Lyrics draft submitted by ${clientType} client: "${title}" (${processedLines?.length || 0} lines)`);
    appendActionLog(io, {
      type: 'draft',
      label: 'Lyrics draft submitted',
      detail: `"${title || 'Untitled'}" submitted for desktop approval`,
      actor,
      target: title || 'draft',
      metadata: { lines: processedLines?.length || 0 },
    });

    const desktopClients = Array.from(state.connectedClients.values()).filter(c => c.type === 'desktop');

    if (desktopClients.length === 0) {
      socket.emit('draftError', 'No desktop client available to approve draft');
      return;
    }

    const timestamp = Date.now();
    const draftId = `${sessionId}_${timestamp}`;

    const draftPayload = {
      draftId,
      title: title || 'Untitled',
      rawText: rawText || '',
      processedLines: processedLines || [],
      submittedBy: {
        clientType,
        deviceId,
        sessionId,
        timestamp
      }
    };

    state.pendingDrafts.set(draftId, {
      submitterSocketId: socket.id,
      submitterSessionId: sessionId,
      title: draftPayload.title,
      timestamp
    });

    setTimeout(() => {
      state.pendingDrafts.delete(draftId);
    }, 10 * 60 * 1000);

    desktopClients.forEach(client => {
      if (client.socket && client.socket.connected) {
        client.socket.emit('lyricsDraftReceived', draftPayload);
      }
    });

    socket.emit('draftSubmitted', { success: true, title });
  });

  socket.on('lyricsDraftApprove', ({ draftId, title, rawText, processedLines }) => {
    if (!hasPermission(socket, 'lyrics:write')) {
      socket.emit('permissionError', 'Insufficient permissions to approve drafts');
      return;
    }

    state.currentLyrics = processedLines || [];
    state.currentLyricsTimestamps = [];
    state.currentLyricsEnhancedTimestamps = [];
    state.currentSelectedLine = null;
    state.currentLyricsFileName = title || '';
    const derived = deriveSectionsFromProcessedLines(state.currentLyrics);
    state.currentLyricsSections = derived.sections || [];
    state.currentLineToSection = derived.lineToSection || {};

    console.log(`Desktop client approved draft: "${title}" (${processedLines?.length || 0} lines)`);
    appendActionLog(io, {
      type: 'draft',
      label: 'Lyrics draft approved',
      detail: `"${title || 'Untitled'}" approved and loaded`,
      actor,
      target: title || 'draft',
      metadata: { draftId, lines: processedLines?.length || 0 },
    });

    emitLyricsLoad(io, {
      lyrics: state.currentLyrics,
      fileName: state.currentLyricsFileName,
      rawLyricsContent: rawText || '',
      lyricsSource: {
        content: rawText || '',
        fileType: 'txt',
        filePath: null,
        fileName: title || '',
      },
      songMetadata: {
        title: title || '',
        artists: [],
        album: null,
        year: null,
        origin: 'draft',
        filePath: null,
        lyricLines: state.currentLyrics.length,
      },
      lyricsTimestamps: [],
      lyricsEnhancedTimestamps: [],
      sections: state.currentLyricsSections,
      lineToSection: state.currentLineToSection,
    });
    emitLyricsRenderEvent(io, 'fileNameUpdate', state.currentLyricsFileName);
    emitLyricsRenderEvent(io, 'lyricsSectionsUpdate', { sections: state.currentLyricsSections, lineToSection: state.currentLineToSection });
    if (rawText) {
      emitControllerEvent(io, 'setlistLoadSuccess', {
        fileId: null,
        fileName: title,
        originalName: null,
        fileType: 'draft',
        linesCount: state.currentLyrics.length,
        rawContent: rawText,
        loadedBy: 'desktop',
        origin: 'draft'
      });
    }

    if (draftId && state.pendingDrafts.has(draftId)) {
      const draftInfo = state.pendingDrafts.get(draftId);
      const submitterClients = Array.from(state.connectedClients.values())
        .filter(c => c.sessionId === draftInfo.submitterSessionId)
        .sort((a, b) => (b.connectedAt || 0) - (a.connectedAt || 0));

      const targetClient = submitterClients[0];
      if (targetClient?.socket && targetClient.socket.connected) {
        targetClient.socket.emit('draftApproved', { success: true, title, draftId });
      }

      state.pendingDrafts.delete(draftId);
    } else {
      socket.emit('draftApproved', { success: true, title, draftId: draftId || null });
    }
  });

  socket.on('lyricsDraftReject', ({ draftId, title, reason }) => {
    if (!hasPermission(socket, 'lyrics:write')) {
      socket.emit('permissionError', 'Insufficient permissions to reject drafts');
      return;
    }

    console.log(`Desktop client rejected draft "${title}": ${reason || 'No reason provided'}`);
    appendActionLog(io, {
      type: 'draft',
      label: 'Lyrics draft rejected',
      detail: `"${title || 'Untitled'}" rejected${reason ? `: ${reason}` : ''}`,
      actor,
      target: title || 'draft',
      metadata: { draftId },
    });

    if (draftId && state.pendingDrafts.has(draftId)) {
      const draftInfo = state.pendingDrafts.get(draftId);

      const submitterClients = Array.from(state.connectedClients.values())
        .filter(c => c.sessionId === draftInfo.submitterSessionId)
        .sort((a, b) => (b.connectedAt || 0) - (a.connectedAt || 0));

      const targetClient = submitterClients[0];
      if (targetClient?.socket && targetClient.socket.connected) {
        targetClient.socket.emit('draftRejected', {
          success: true,
          title: title || draftInfo.title,
          reason: reason || 'No reason provided',
          draftId
        });
      }

      state.pendingDrafts.delete(draftId);
      console.log(`Rejection notification sent to submitter (session: ${draftInfo.submitterSessionId})`);
    } else {
      console.warn(`Draft ${draftId} not found in pending drafts, cannot notify submitter`);
      socket.emit('draftRejected', { success: true, reason, draftId: draftId || null, title: title || null });
    }
  });
}
