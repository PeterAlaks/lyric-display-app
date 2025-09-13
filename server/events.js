// server/events.js (ES Module format)

let currentLyrics = [];
let currentLyricsFileName = '';
let currentSelectedLine = null;
let currentOutput1Settings = {};
let currentOutput2Settings = {};
let currentIsOutputOn = false;
let setlistFiles = []; // New: Store setlist files (max 25)
let connectedClients = new Map(); // Track client types


export default function registerSocketEvents(io) {
  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Handle client type identification
    socket.on('clientConnect', ({ type }) => {
      connectedClients.set(socket.id, { type, socket });
      console.log(`Client ${socket.id} identified as: ${type}`);

      socket.emit('currentState', buildCurrentState({ type }));
    });

    // Enhanced state request handler with setlist
    socket.on('requestCurrentState', () => {
      console.log('State requested by:', socket.id);

      const clientInfo = connectedClients.get(socket.id);
      socket.emit('currentState', buildCurrentState(clientInfo));
      console.log('Current state sent to:', socket.id, `(${currentLyrics.length} lyrics, ${setlistFiles.length} setlist items)`);
    });

    // Request setlist specifically
    socket.on('requestSetlist', () => {
      socket.emit('setlistUpdate', setlistFiles);
      console.log('Setlist sent to:', socket.id, `(${setlistFiles.length} items)`);
    });

    // Add files to setlist
    socket.on('setlistAdd', (files) => {
      try {
        if (!Array.isArray(files)) {
          console.error('setlistAdd: files must be an array');
          socket.emit('setlistError', 'Invalid file data');
          return;
        }

        // Validate total count
        const totalAfterAdd = setlistFiles.length + files.length;
        if (totalAfterAdd > 25) {
          console.error('setlistAdd: Would exceed 25 file limit');
          socket.emit('setlistError', `Cannot add ${files.length} files. Maximum 25 files allowed.`);
          return;
        }

        // Process and validate each file
        const newFiles = files.map((file, index) => {
          if (!file.name || !file.content) {
            throw new Error(`File ${index + 1} is missing name or content`);
          }

          // Remove .txt extension for display
          const displayName = file.name.replace(/\.txt$/i, '');

          // Check for duplicates
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
            addedAt: Date.now()
          };
        });

        // Add files to setlist
        setlistFiles.push(...newFiles);
        console.log(`Added ${newFiles.length} files to setlist. Total: ${setlistFiles.length}`);

        // Broadcast setlist update to all clients
        io.emit('setlistUpdate', setlistFiles);

        // Send success confirmation to requester
        socket.emit('setlistAddSuccess', {
          addedCount: newFiles.length,
          totalCount: setlistFiles.length
        });

      } catch (error) {
        console.error('setlistAdd error:', error.message);
        socket.emit('setlistError', error.message);
      }
    });

    // Remove file from setlist
    socket.on('setlistRemove', (fileId) => {
      try {
        const initialCount = setlistFiles.length;
        setlistFiles = setlistFiles.filter(file => file.id !== fileId);

        if (setlistFiles.length < initialCount) {
          console.log(`Removed file ${fileId} from setlist. Remaining: ${setlistFiles.length}`);
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

    // Load file from setlist
    socket.on('setlistLoad', (fileId) => {
      try {
        const file = setlistFiles.find(f => f.id === fileId);
        if (!file) {
          socket.emit('setlistError', 'File not found in setlist');
          return;
        }

        // Process the file content as lyrics
        const processedLines = processRawTextToLines(file.content);

        // Update current state
        currentLyrics = processedLines;
        currentSelectedLine = null;
        currentLyricsFileName = file.displayName;

        console.log(`Loaded "${file.displayName}" from setlist (${processedLines.length} lines)`);

        // Broadcast to all clients - IMPORTANT: Include raw content for editing
        io.emit('lyricsLoad', processedLines);
        io.emit('setlistLoadSuccess', {
          fileId,
          fileName: file.displayName,
          linesCount: processedLines.length,
          rawContent: file.content // Add this line
        });

      } catch (error) {
        console.error('setlistLoad error:', error.message);
        socket.emit('setlistError', error.message);
      }
    });

    // Clear setlist (desktop only)
    socket.on('setlistClear', () => {
      const clientInfo = connectedClients.get(socket.id);
      if (clientInfo?.type !== 'desktop') {
        socket.emit('setlistError', 'Only desktop client can clear setlist');
        return;
      }

      setlistFiles = [];
      console.log('Setlist cleared by desktop client');
      io.emit('setlistUpdate', setlistFiles);
      socket.emit('setlistClearSuccess');
    });

    // Existing event handlers
    socket.on('lineUpdate', ({ index }) => {
      currentSelectedLine = index;
      console.log('Line updated to:', index);
      io.emit('lineUpdate', { index });
    });

    socket.on('outputToggle', (state) => {
      currentIsOutputOn = state;
      console.log('Output toggled to:', state);
      io.emit('outputToggle', state);
    });

    socket.on('lyricsLoad', (lyrics) => {
      currentLyrics = lyrics;
      currentSelectedLine = null;
      currentLyricsFileName = ''; // Clear filename when new lyrics loaded directly
      console.log('Lyrics loaded:', lyrics?.length, 'lines');
      io.emit('lyricsLoad', lyrics);
    });

    socket.on('styleUpdate', ({ output, settings }) => {
      if (output === 'output1') {
        currentOutput1Settings = { ...currentOutput1Settings, ...settings };
      }
      if (output === 'output2') {
        currentOutput2Settings = { ...currentOutput2Settings, ...settings };
      }
      console.log('Style updated for', output);
      io.emit('styleUpdate', { output, settings });
    });

    socket.on('fileNameUpdate', (fileName) => {
      currentLyricsFileName = fileName;
      console.log('Filename updated to:', fileName);
      io.emit('fileNameUpdate', fileName);
    });

    // Add periodic state broadcast (every 30 seconds) for additional reliability
    const stateBroadcastInterval = setInterval(() => {
      if (socket.connected) {
        const clientInfo = connectedClients.get(socket.id);
        socket.emit('periodicStateSync', buildCurrentState(clientInfo));
      }
    }, 30000);

    socket.on('disconnect', () => {
      console.log('A user disconnected:', socket.id);
      connectedClients.delete(socket.id);
      clearInterval(stateBroadcastInterval);
    });
  });
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
  const bracketPairs = [ ['[', ']'], ['(', ')'], ['{', '}'], ['<', '>'] ];
  return bracketPairs.some(([open, close]) => trimmed.startsWith(open) && trimmed.endsWith(close));
}
