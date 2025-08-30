// server/events.js (ES Module format)

let currentLyrics = [];
let currentSelectedLine = null;
let currentOutput1Settings = {};
let currentOutput2Settings = {};
let currentIsOutputOn = false;

export default function registerSocketEvents(io) {
  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Enhanced state request handler with acknowledgment
    socket.on('requestCurrentState', () => {
      console.log('State requested by:', socket.id);
      
      const currentState = {
        lyrics: currentLyrics,
        selectedLine: currentSelectedLine,
        output1Settings: currentOutput1Settings,
        output2Settings: currentOutput2Settings,
        isOutputOn: currentIsOutputOn,
        timestamp: Date.now() // Add timestamp for debugging
      };
      
      socket.emit('currentState', currentState);
      console.log('Current state sent to:', socket.id, `(${currentLyrics.length} lyrics)`);
    });

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

    // Add periodic state broadcast (every 30 seconds) for additional reliability
    const stateBroadcastInterval = setInterval(() => {
      if (socket.connected) {
        const currentState = {
          lyrics: currentLyrics,
          selectedLine: currentSelectedLine,
          output1Settings: currentOutput1Settings,
          output2Settings: currentOutput2Settings,
          isOutputOn: currentIsOutputOn,
          timestamp: Date.now()
        };
        socket.emit('periodicStateSync', currentState);
      }
    }, 30000);

    socket.on('disconnect', () => {
      console.log('A user disconnected:', socket.id);
      clearInterval(stateBroadcastInterval);
    });
  });
}