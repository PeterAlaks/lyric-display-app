// server/events.js
import { processRawTextToLines, parseLrcContent } from '../shared/lyricsParsing.js';

let currentLyrics = [];
let currentLyricsFileName = '';
let currentSelectedLine = null;
let currentOutput1Settings = {};
let currentOutput2Settings = {};
let currentStageSettings = {};
let currentIsOutputOn = false;
let setlistFiles = [];
let connectedClients = new Map();
let outputInstances = {
  output1: new Map(),
  output2: new Map(),
  stage: new Map()
};
let currentStageTimerState = { running: false, paused: false, endTime: null, remaining: null };
let currentStageMessages = [];

export default function registerSocketEvents(io, { hasPermission }) {
  io.on('connection', (socket) => {
    const { clientType, deviceId, sessionId } = socket.userData;
    console.log(`Authenticated user connected: ${clientType} (${deviceId}) - Socket: ${socket.id}`);

    connectedClients.set(socket.id, {
      type: clientType,
      deviceId,
      sessionId,
      socket,
      permissions: socket.userData.permissions,
      connectedAt: socket.userData.connectedAt
    });

    socket.on('clientConnect', ({ type }) => {
      if (type !== clientType) {
        console.warn(`Client ${socket.id} claimed type ${type} but authenticated as ${clientType}`);
        socket.emit('authError', 'Client type mismatch with authentication');
        return;
      }

      console.log(`Client ${socket.id} confirmed as: ${type}`);
      socket.emit('currentState', buildCurrentState(connectedClients.get(socket.id)));
    });

    socket.on('requestCurrentState', () => {
      if (!hasPermission(socket, 'lyrics:read')) {
        socket.emit('permissionError', 'Insufficient permissions to read current state');
        return;
      }

      console.log('State requested by authenticated client:', socket.id);
      const clientInfo = connectedClients.get(socket.id);
      socket.emit('currentState', buildCurrentState(clientInfo));
      console.log(`Current state sent to: ${socket.id} (${currentLyrics.length} lyrics, ${setlistFiles.length} setlist items)`);
    });

    socket.on('requestSetlist', () => {
      if (!hasPermission(socket, 'setlist:read')) {
        socket.emit('permissionError', 'Insufficient permissions to access setlist');
        return;
      }

      socket.emit('setlistUpdate', setlistFiles);
      console.log('Setlist sent to authenticated client:', socket.id, `(${setlistFiles.length} items)`);
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

        const totalAfterAdd = setlistFiles.length + files.length;
        if (totalAfterAdd > 25) {
          console.error('setlistAdd: Would exceed 25 file limit');
          socket.emit('setlistError', `Cannot add ${files.length} files. Maximum 25 files allowed.`);
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
          const alreadyExists = setlistFiles.some((existing) => {
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
            addedBy: {
              clientType,
              deviceId,
              sessionId
            }
          };
        });

        setlistFiles.push(...newFiles);
        console.log(`${clientType} client added ${newFiles.length} files to setlist. Total: ${setlistFiles.length}`);

        io.emit('setlistUpdate', setlistFiles);
        socket.emit('setlistAddSuccess', {
          addedCount: newFiles.length,
          totalCount: setlistFiles.length
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
        const initialCount = setlistFiles.length;
        const fileToRemove = setlistFiles.find(file => file.id === fileId);

        if (!hasPermission(socket, 'admin:full') &&
          fileToRemove?.addedBy?.sessionId !== sessionId) {
          socket.emit('permissionError', 'You can only remove files you added');
          return;
        }

        setlistFiles = setlistFiles.filter(file => file.id !== fileId);

        if (setlistFiles.length < initialCount) {
          console.log(`${clientType} client removed file ${fileId} from setlist. Remaining: ${setlistFiles.length}`);
          io.emit('setlistUpdate', setlistFiles);
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
      if (!hasPermission(socket, 'setlist:read')) {
        socket.emit('permissionError', 'Insufficient permissions to read setlist');
        return;
      }

      try {
        const file = setlistFiles.find(f => f.id === fileId);
        if (!file) {
          socket.emit('setlistError', 'File not found in setlist');
          return;
        }

        let processedLines;
        let sanitizedRawContent = file.content;
        const isLrc = (file.fileType === 'lrc') ||
          (typeof file.originalName === 'string' && file.originalName.toLowerCase().endsWith('.lrc'));

        if (isLrc) {
          const parsed = parseLrcContent(file.content);
          processedLines = parsed.processedLines;
          sanitizedRawContent = parsed.rawText;
        } else {
          processedLines = processRawTextToLines(file.content);
        }

        const cleanDisplayName = (file.displayName || file.originalName || '').replace(/\.(txt|lrc)$/i, '') || file.displayName;

        currentLyrics = processedLines;
        currentSelectedLine = null;
        currentLyricsFileName = cleanDisplayName;

        console.log(`${clientType} client loaded "${cleanDisplayName}" from setlist (${processedLines.length} lines)`);

        io.emit('lyricsLoad', processedLines);
        io.emit('setlistLoadSuccess', {
          fileId,
          fileName: cleanDisplayName,
          originalName: file.originalName,
          fileType: file.fileType || (isLrc ? 'lrc' : 'txt'),
          linesCount: processedLines.length,
          rawContent: sanitizedRawContent,
          loadedBy: clientType
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

      setlistFiles = [];
      console.log(`Setlist cleared by ${clientType} client`);
      io.emit('setlistUpdate', setlistFiles);
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

      if (orderedIds.length !== setlistFiles.length) {
        socket.emit('setlistError', 'Reorder payload does not match setlist size');
        return;
      }

      const idToFile = new Map(setlistFiles.map((file) => [file.id, file]));
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

      if (reordered.length !== setlistFiles.length) {
        socket.emit('setlistError', 'Reorder payload incomplete');
        return;
      }

      setlistFiles = reordered;
      console.log(`${clientType} client reordered setlist (${setlistFiles.length} items)`);

      io.emit('setlistUpdate', setlistFiles);
      socket.emit('setlistReorderSuccess', {
        orderedIds,
        totalCount: setlistFiles.length,
      });
    });

    socket.on('lineUpdate', ({ index }) => {
      if (!hasPermission(socket, 'output:control')) {
        socket.emit('permissionError', 'Insufficient permissions to control output');
        return;
      }

      currentSelectedLine = index;
      console.log(`Line updated to ${index} by ${clientType} client`);
      io.emit('lineUpdate', { index });
    });

    socket.on('outputToggle', (state) => {
      if (!hasPermission(socket, 'output:control')) {
        socket.emit('permissionError', 'Insufficient permissions to control output');
        return;
      }

      currentIsOutputOn = state;
      console.log(`Output toggled to ${state} by ${clientType} client`);
      io.emit('outputToggle', state);
    });

    socket.on('lyricsLoad', (lyrics) => {
      if (!hasPermission(socket, 'lyrics:write')) {
        socket.emit('permissionError', 'Insufficient permissions to load lyrics');
        return;
      }

      currentLyrics = lyrics;
      currentSelectedLine = null;
      currentLyricsFileName = '';
      console.log(`Lyrics loaded by ${clientType} client:`, lyrics?.length, 'lines');
      io.emit('lyricsLoad', lyrics);
    });

    socket.on('styleUpdate', ({ output, settings }) => {
      if (!hasPermission(socket, 'settings:write')) {
        socket.emit('permissionError', 'Insufficient permissions to modify settings');
        return;
      }

      if (output === 'output1') {
        currentOutput1Settings = { ...currentOutput1Settings, ...settings };
      }
      if (output === 'output2') {
        currentOutput2Settings = { ...currentOutput2Settings, ...settings };
      }
      if (output === 'stage') {
        currentStageSettings = { ...currentStageSettings, ...settings };
      }
      console.log(`Style updated for ${output} by ${clientType} client`);
      io.emit('styleUpdate', { output, settings });
    });

    socket.on('stageTimerUpdate', (timerData) => {
      if (!hasPermission(socket, 'output:control')) {
        socket.emit('permissionError', 'Insufficient permissions to control stage timer');
        return;
      }

      currentStageTimerState = { ...timerData };
      console.log(`Stage timer updated by ${clientType} client:`, timerData);
      io.emit('stageTimerUpdate', timerData);
    });

    socket.on('stageMessagesUpdate', (messages) => {
      if (!hasPermission(socket, 'output:control')) {
        socket.emit('permissionError', 'Insufficient permissions to update stage messages');
        return;
      }

      currentStageMessages = Array.isArray(messages) ? [...messages] : [];
      console.log(`Stage messages updated by ${clientType} client: ${messages?.length || 0} messages`);
      io.emit('stageMessagesUpdate', messages);
    });

    socket.on('outputMetrics', ({ output, metrics }) => {
      if (!(clientType === 'output1' || clientType === 'output2')) {
        socket.emit('permissionError', 'Insufficient permissions to publish metrics');
        return;
      }
      if (!output || !metrics || (output !== 'output1' && output !== 'output2')) {
        return;
      }

      const safe = {};
      if (Number.isFinite(metrics.adjustedFontSize) || metrics.adjustedFontSize === null) safe.adjustedFontSize = metrics.adjustedFontSize;
      if (typeof metrics.autosizerActive === 'boolean') safe.autosizerActive = metrics.autosizerActive;
      if (Number.isFinite(metrics.viewportWidth)) safe.viewportWidth = metrics.viewportWidth;
      if (Number.isFinite(metrics.viewportHeight)) safe.viewportHeight = metrics.viewportHeight;
      if (Number.isFinite(metrics.timestamp)) safe.timestamp = metrics.timestamp;

      outputInstances[output].set(socket.id, {
        ...safe,
        socketId: socket.id,
        lastUpdate: Date.now()
      });

      const allInstances = Array.from(outputInstances[output].values());

      const primaryInstance = allInstances.reduce((largest, current) => {
        if (!largest) return current;
        const largestArea = (largest.viewportWidth || 0) * (largest.viewportHeight || 0);
        const currentArea = (current.viewportWidth || 0) * (current.viewportHeight || 0);
        return currentArea > largestArea ? current : largest;
      }, null);

      io.emit('outputMetrics', {
        output,
        metrics: primaryInstance || safe,
        allInstances: allInstances,
        instanceCount: allInstances.length
      });
    });

    socket.on('fileNameUpdate', (fileName) => {
      if (!hasPermission(socket, 'lyrics:write')) {
        socket.emit('permissionError', 'Insufficient permissions to update filename');
        return;
      }

      currentLyricsFileName = fileName;
      console.log(`Filename updated to "${fileName}" by ${clientType} client`);
      io.emit('fileNameUpdate', fileName);
    });

    socket.on('lyricsDraftSubmit', ({ title, rawText, processedLines }) => {
      if (!hasPermission(socket, 'lyrics:draft')) {
        socket.emit('permissionError', 'Insufficient permissions to submit drafts');
        return;
      }

      console.log(`Lyrics draft submitted by ${clientType} client: "${title}" (${processedLines?.length || 0} lines)`);

      const desktopClients = Array.from(connectedClients.values()).filter(c => c.type === 'desktop');

      if (desktopClients.length === 0) {
        socket.emit('draftError', 'No desktop client available to approve draft');
        return;
      }

      const draftPayload = {
        title: title || 'Untitled',
        rawText: rawText || '',
        processedLines: processedLines || [],
        submittedBy: {
          clientType,
          deviceId,
          sessionId,
          timestamp: Date.now()
        }
      };

      desktopClients.forEach(client => {
        if (client.socket && client.socket.connected) {
          client.socket.emit('lyricsDraftReceived', draftPayload);
        }
      });

      socket.emit('draftSubmitted', { success: true, title });
    });

    socket.on('lyricsDraftApprove', ({ title, rawText, processedLines }) => {
      if (!hasPermission(socket, 'lyrics:write')) {
        socket.emit('permissionError', 'Insufficient permissions to approve drafts');
        return;
      }

      currentLyrics = processedLines || [];
      currentSelectedLine = null;
      currentLyricsFileName = title || '';

      console.log(`Desktop client approved draft: "${title}" (${processedLines?.length || 0} lines)`);

      io.emit('lyricsLoad', currentLyrics);
      io.emit('fileNameUpdate', currentLyricsFileName);
      if (rawText) {
        io.emit('setlistLoadSuccess', {
          fileId: null,
          fileName: title,
          linesCount: currentLyrics.length,
          rawContent: rawText,
          loadedBy: 'desktop'
        });
      }

      socket.emit('draftApproved', { success: true, title });
    });

    socket.on('lyricsDraftReject', ({ reason }) => {
      if (!hasPermission(socket, 'lyrics:write')) {
        socket.emit('permissionError', 'Insufficient permissions to reject drafts');
        return;
      }

      console.log(`Desktop client rejected draft: ${reason || 'No reason provided'}`);
      socket.emit('draftRejected', { success: true, reason });
    });

    socket.on('heartbeat', () => {
      socket.emit('heartbeat_ack', { timestamp: Date.now() });
    });

    socket.on('disconnect', (reason) => {
      console.log(`Authenticated user disconnected: ${clientType} (${deviceId}) - Reason: ${reason}`);
      connectedClients.delete(socket.id);

      if (clientType === 'output1' || clientType === 'output2') {
        outputInstances[clientType]?.delete(socket.id);

        const remainingInstances = Array.from(outputInstances[clientType]?.values() || []);
        if (remainingInstances.length > 0) {
          const primaryInstance = remainingInstances.reduce((largest, current) => {
            if (!largest) return current;
            const largestArea = (largest.viewportWidth || 0) * (largest.viewportHeight || 0);
            const currentArea = (current.viewportWidth || 0) * (current.viewportHeight || 0);
            return currentArea > largestArea ? current : largest;
          }, null);

          io.emit('outputMetrics', {
            output: clientType,
            metrics: primaryInstance,
            allInstances: remainingInstances,
            instanceCount: remainingInstances.length
          });
        }
      }

      socket.broadcast.emit('clientDisconnected', {
        clientType,
        deviceId,
        disconnectedAt: Date.now(),
        reason
      });
    });

    setTimeout(() => {
      if (socket.connected) {
        const clientInfo = connectedClients.get(socket.id);
        socket.emit('currentState', buildCurrentState(clientInfo));
      }
    }, 100);

    const stateBroadcastInterval = setInterval(() => {
      if (socket.connected) {
        const clientInfo = connectedClients.get(socket.id);
        socket.emit('periodicStateSync', buildCurrentState(clientInfo));
      }
    }, 30000);

    socket.on('disconnect', () => {
      clearInterval(stateBroadcastInterval);
    });
  });

  setInterval(() => {
    const stats = {
      totalConnections: connectedClients.size,
      clientTypes: {},
      timestamp: Date.now()
    };

    connectedClients.forEach(client => {
      stats.clientTypes[client.type] = (stats.clientTypes[client.type] || 0) + 1;
    });

    console.log('Connection statistics:', stats);
  }, 5 * 60 * 1000);
}

function buildCurrentState(clientInfo) {
  const timestamp = Date.now();
  const state = {
    lyrics: currentLyrics,
    selectedLine: currentSelectedLine,
    output1Settings: currentOutput1Settings,
    output2Settings: currentOutput2Settings,
    stageSettings: currentStageSettings,
    isOutputOn: currentIsOutputOn,
    setlistFiles,
    lyricsFileName: currentLyricsFileName || '',
    isDesktopClient: clientInfo?.type === 'desktop',
    clientPermissions: clientInfo?.permissions || [],
    timestamp,
    syncTimestamp: timestamp,
  };

  if (clientInfo?.type === 'stage') {
    state.stageTimerState = currentStageTimerState;
    state.stageMessages = currentStageMessages;
  }

  return state;
}
