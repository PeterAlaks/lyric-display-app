import { deriveSectionsFromProcessedLines } from '../../../shared/lyricsParsing.js';
import { appendActionLog } from '../actionLog.js';
import { emitControllerEvent, emitLyricsLoad, emitLyricsRenderEvent } from '../broadcast.js';
import { blockIfLiveSafety } from '../liveSafety.js';
import { schedulePersistSessionState } from '../sessionPersistence.js';
import { state } from '../state.js';
import { isPlainObject } from '../utils.js';

const MAX_DRAFT_TITLE_LENGTH = 256;
const MAX_DRAFT_REASON_LENGTH = 1000;
const MAX_DRAFT_CONTENT_BYTES = 2 * 1024 * 1024;
const MAX_DRAFT_LINES = 10000;

const hasValidByteLength = (value, maxBytes = MAX_DRAFT_CONTENT_BYTES) => (
  typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= maxBytes
);

const hasValidProcessedLines = (value) => {
  if (!Array.isArray(value) || value.length > MAX_DRAFT_LINES) return false;
  if (!value.every((line) => typeof line === 'string' || isPlainObject(line))) return false;

  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8') <= MAX_DRAFT_CONTENT_BYTES;
  } catch {
    return false;
  }
};

const parseDraftContent = (payload) => {
  if (!isPlainObject(payload)) return null;

  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const rawText = typeof payload.rawText === 'string' ? payload.rawText : '';
  if (title.length > MAX_DRAFT_TITLE_LENGTH || !hasValidByteLength(rawText) || !hasValidProcessedLines(payload.processedLines)) {
    return null;
  }

  return {
    draftId: typeof payload.draftId === 'string' ? payload.draftId : null,
    title: title || 'Untitled',
    rawText,
    processedLines: payload.processedLines,
  };
};

export function registerDraftHandlers({ io, socket, hasPermission, clientType, deviceId, sessionId }) {
  const actor = { clientType, deviceId, sessionId };

  socket.on('lyricsDraftSubmit', (payload) => {
    if (!hasPermission(socket, 'lyrics:draft')) {
      socket.emit('permissionError', 'Insufficient permissions to submit drafts');
      return;
    }

    const draft = parseDraftContent(payload);
    if (!draft) {
      socket.emit('draftError', 'Invalid lyrics draft payload');
      return;
    }

    const { title, rawText, processedLines } = draft;

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

    const expirationTimer = setTimeout(() => {
      state.pendingDrafts.delete(draftId);
    }, 10 * 60 * 1000);
    expirationTimer.unref?.();

    desktopClients.forEach(client => {
      if (client.socket && client.socket.connected) {
        client.socket.emit('lyricsDraftReceived', draftPayload);
      }
    });

    socket.emit('draftSubmitted', { success: true, title });
  });

  socket.on('lyricsDraftApprove', (payload) => {
    if (!hasPermission(socket, 'lyrics:draft:approve')) {
      socket.emit('permissionError', 'Insufficient permissions to approve drafts');
      return;
    }

    if (blockIfLiveSafety({ io, socket, clientType, deviceId, sessionId, action: 'lyricsDraftApprove' })) {
      return;
    }

    const draft = parseDraftContent(payload);
    if (!draft || !draft.draftId || !state.pendingDrafts.has(draft.draftId)) {
      socket.emit('draftError', 'Draft is invalid, expired, or no longer pending');
      return;
    }

    const { draftId, title, rawText, processedLines } = draft;

    state.currentLyrics = processedLines;
    state.currentLyricsTimestamps = [];
    state.currentLyricsEnhancedTimestamps = [];
    state.currentSelectedLine = null;
    state.currentLyricsFileName = title;
    state.currentRawLyricsContent = rawText;
    state.currentLyricsSource = {
      content: rawText,
      fileType: 'txt',
      filePath: null,
      fileName: title,
    };
    state.currentSongMetadata = {
      title,
      artists: [],
      album: null,
      year: null,
      origin: 'draft',
      filePath: null,
      lyricLines: state.currentLyrics.length,
    };
    const derived = deriveSectionsFromProcessedLines(state.currentLyrics);
    state.currentLyricsSections = derived.sections || [];
    state.currentLineToSection = derived.lineToSection || {};
    schedulePersistSessionState();

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

  socket.on('lyricsDraftReject', (payload) => {
    if (!hasPermission(socket, 'lyrics:draft:approve')) {
      socket.emit('permissionError', 'Insufficient permissions to reject drafts');
      return;
    }

    if (blockIfLiveSafety({ io, socket, clientType, deviceId, sessionId, action: 'lyricsDraftReject' })) {
      return;
    }

    if (!isPlainObject(payload)
      || typeof payload.draftId !== 'string'
      || !state.pendingDrafts.has(payload.draftId)
      || (payload.title !== undefined && typeof payload.title !== 'string')
      || (payload.reason !== undefined && typeof payload.reason !== 'string')) {
      socket.emit('draftError', 'Draft is invalid, expired, or no longer pending');
      return;
    }

    const draftId = payload.draftId;
    const title = typeof payload.title === 'string' ? payload.title.trim().slice(0, MAX_DRAFT_TITLE_LENGTH) : '';
    const reason = typeof payload.reason === 'string' ? payload.reason.trim().slice(0, MAX_DRAFT_REASON_LENGTH) : '';

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
