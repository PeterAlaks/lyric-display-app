// server/events.js (ES Module format with Authentication)

let currentLyrics = [];
let currentLyricsFileName = '';
let currentSelectedLine = null;
let currentOutput1Settings = {};
let currentOutput2Settings = {};
let currentIsOutputOn = false;
let setlistFiles = [];
let connectedClients = new Map();

export default function registerSocketEvents(io, { hasPermission }) {
  io.on('connection', (socket) => {
    const { clientType, deviceId, sessionId } = socket.userData;
    console.log(`Authenticated user connected: ${clientType} (${deviceId}) - Socket: ${socket.id}`);

    // Track authenticated client
    connectedClients.set(socket.id, {
      type: clientType,
      deviceId,
      sessionId,
      socket,
      permissions: socket.userData.permissions,
      connectedAt: socket.userData.connectedAt
    });

    // Handle client type confirmation
    socket.on('clientConnect', ({ type }) => {
      if (type !== clientType) {
        console.warn(`Client ${socket.id} claimed type ${type} but authenticated as ${clientType}`);
        socket.emit('authError', 'Client type mismatch with authentication');
        return;
      }

      console.log(`Client ${socket.id} confirmed as: ${type}`);
      socket.emit('currentState', buildCurrentState(connectedClients.get(socket.id)));
    });

    // Enhanced state request handler with authentication
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

    // Request setlist with permission check
    socket.on('requestSetlist', () => {
      if (!hasPermission(socket, 'setlist:read')) {
        socket.emit('permissionError', 'Insufficient permissions to access setlist');
        return;
      }

      socket.emit('setlistUpdate', setlistFiles);
      console.log('Setlist sent to authenticated client:', socket.id, `(${setlistFiles.length} items)`);
    });

    // Add files to setlist with permission check
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

        const newFiles = files.map((file, index) => {
          if (!file.name || !file.content) {
            throw new Error(`File ${index + 1} is missing name or content`);
          }

          const displayName = file.name.replace(/\.txt$/i, '');
          const existingFile = setlistFiles.find(f => f.displayName === displayName);
          if (existingFile) {
            throw new Error(`File "${displayName}" already exists in setlist`);
          }

          return {
            id: `setlist_${Date.now()}_${index}`,
            displayName,
            originalName: file.name,
            content: file.content,
            lastModified: file.lastModified || Date.now(),
            addedAt: Date.now(),
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

    // Remove file from setlist with permission check
    socket.on('setlistRemove', (fileId) => {
      if (!hasPermission(socket, 'setlist:write')) {
        socket.emit('permissionError', 'Insufficient permissions to modify setlist');
        return;
      }

      try {
        const initialCount = setlistFiles.length;
        const fileToRemove = setlistFiles.find(file => file.id === fileId);

        // Desktop clients can remove any file, others can only remove their own
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

    // Load file from setlist with permission check
    socket.on('setlistLoad', (fileId) => {
      if (!hasPermission(socket, 'lyrics:write')) {
        socket.emit('permissionError', 'Insufficient permissions to load lyrics');
        return;
      }

      try {
        const file = setlistFiles.find(f => f.id === fileId);
        if (!file) {
          socket.emit('setlistError', 'File not found in setlist');
          return;
        }

        const processedLines = processRawTextToLines(file.content);

        currentLyrics = processedLines;
        currentSelectedLine = null;
        currentLyricsFileName = file.displayName;

        console.log(`${clientType} client loaded "${file.displayName}" from setlist (${processedLines.length} lines)`);

        io.emit('lyricsLoad', processedLines);
        io.emit('setlistLoadSuccess', {
          fileId,
          fileName: file.displayName,
          linesCount: processedLines.length,
          rawContent: file.content,
          loadedBy: clientType
        });

      } catch (error) {
        console.error('setlistLoad error:', error.message);
        socket.emit('setlistError', error.message);
      }
    });

    // Clear setlist (desktop/admin only)
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

    // Line update with permission check
    socket.on('lineUpdate', ({ index }) => {
      if (!hasPermission(socket, 'output:control')) {
        socket.emit('permissionError', 'Insufficient permissions to control output');
        return;
      }

      currentSelectedLine = index;
      console.log(`Line updated to ${index} by ${clientType} client`);
      io.emit('lineUpdate', { index });
    });

    // Output toggle with permission check
    socket.on('outputToggle', (state) => {
      if (!hasPermission(socket, 'output:control')) {
        socket.emit('permissionError', 'Insufficient permissions to control output');
        return;
      }

      currentIsOutputOn = state;
      console.log(`Output toggled to ${state} by ${clientType} client`);
      io.emit('outputToggle', state);
    });

    // Lyrics load with permission check
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

    // Style update with permission check
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
      console.log(`Style updated for ${output} by ${clientType} client`);
      io.emit('styleUpdate', { output, settings });
    });

    // File name update with permission check
    socket.on('fileNameUpdate', (fileName) => {
      if (!hasPermission(socket, 'lyrics:write')) {
        socket.emit('permissionError', 'Insufficient permissions to update filename');
        return;
      }

      currentLyricsFileName = fileName;
      console.log(`Filename updated to "${fileName}" by ${clientType} client`);
      io.emit('fileNameUpdate', fileName);
    });

    // Heartbeat for connection monitoring
    socket.on('heartbeat', () => {
      socket.emit('heartbeat_ack', { timestamp: Date.now() });
    });

    // Enhanced disconnect handler
    socket.on('disconnect', (reason) => {
      console.log(`Authenticated user disconnected: ${clientType} (${deviceId}) - Reason: ${reason}`);
      connectedClients.delete(socket.id);

      // Emit client disconnection to other clients for awareness
      socket.broadcast.emit('clientDisconnected', {
        clientType,
        deviceId,
        disconnectedAt: Date.now(),
        reason
      });
    });

    // Send initial state after authentication
    setTimeout(() => {
      if (socket.connected) {
        const clientInfo = connectedClients.get(socket.id);
        socket.emit('currentState', buildCurrentState(clientInfo));
      }
    }, 100);

    // Periodic authenticated state broadcast (every 30 seconds)
    const stateBroadcastInterval = setInterval(() => {
      if (socket.connected) {
        const clientInfo = connectedClients.get(socket.id);
        socket.emit('periodicStateSync', buildCurrentState(clientInfo));
      }
    }, 30000);

    // Clear interval on disconnect
    socket.on('disconnect', () => {
      clearInterval(stateBroadcastInterval);
    });
  });

  // Broadcast connection statistics every 5 minutes
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
  return {
    lyrics: currentLyrics,
    selectedLine: currentSelectedLine,
    output1Settings: currentOutput1Settings,
    output2Settings: currentOutput2Settings,
    isOutputOn: currentIsOutputOn,
    setlistFiles,
    lyricsFileName: currentLyricsFileName || '',
    isDesktopClient: clientInfo?.type === 'desktop',
    clientPermissions: clientInfo?.permissions || [],
    timestamp: Date.now(),
  };
}

// Helper function to process raw text (same rules as client)
function processRawTextToLines(rawText) {
  const allLines = rawText.split(/\r?\n/);

  const clusters = [];
  let currentCluster = [];

  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i].trim();
    if (line.length > 0) {
      currentCluster.push({ line, originalIndex: i });
    } else {
      if (currentCluster.length > 0) {
        clusters.push([...currentCluster]);
        currentCluster = [];
      }
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  const result = [];
  clusters.forEach((cluster, clusterIndex) => {
    if (cluster.length === 2 && isTranslationLine(cluster[1].line)) {
      const groupedLine = {
        type: 'group',
        id: `group_${clusterIndex}_${cluster[0].originalIndex}`,
        mainLine: cluster[0].line,
        translation: cluster[1].line,
        displayText: `${cluster[0].line}\n${cluster[1].line}`,
        searchText: `${cluster[0].line} ${cluster[1].line}`,
        originalIndex: cluster[0].originalIndex
      };
      result.push(groupedLine);
    } else {
      cluster.forEach(item => {
        result.push(item.line);
      });
    }
  });

  return result;
}

function isTranslationLine(line) {
  if (!line || typeof line !== 'string') return false;
  const trimmed = line.trim();
  if (trimmed.length <= 2) return false;
  const bracketPairs = [['[', ']'], ['(', ')'], ['{', '}'], ['<', '>']];
  return bracketPairs.some(([open, close]) => trimmed.startsWith(open) && trimmed.endsWith(close));
}