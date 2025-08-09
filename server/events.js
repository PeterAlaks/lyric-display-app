// server/events.js (ES Module format)

let currentLyrics = [];
let currentSelectedLine = null;
let currentOutput1Settings = {};
let currentOutput2Settings = {};
let currentIsOutputOn = false;

export default function registerSocketEvents(io) {
  io.on('connection', (socket) => {
    console.log('A user connected');

    // Respond to state requests from outputs
    socket.on('requestCurrentState', () => {
      socket.emit('currentState', {
        lyrics: currentLyrics,
        selectedLine: currentSelectedLine,
        output1Settings: currentOutput1Settings,
        output2Settings: currentOutput2Settings,
        isOutputOn: currentIsOutputOn,
      });
    });

    socket.on('lineUpdate', ({ index }) => {
      currentSelectedLine = index;
      io.emit('lineUpdate', { index });
    });

    socket.on('outputToggle', (state) => {
      currentIsOutputOn = state;
      io.emit('outputToggle', state);
    });

    socket.on('lyricsLoad', (lyrics) => {
      currentLyrics = lyrics;
      io.emit('lyricsLoad', lyrics);
    });

    socket.on('styleUpdate', ({ output, settings }) => {
      if (output === 'output1') {
        currentOutput1Settings = settings;
      }
      if (output === 'output2') {
        currentOutput2Settings = settings;
      }
      io.emit('styleUpdate', { output, settings });
    });

    socket.on('disconnect', () => {
      console.log('A user disconnected');
    });
  });
}
