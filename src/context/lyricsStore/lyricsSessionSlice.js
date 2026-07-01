const stateValueEqual = (a, b) => {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') {
    return Object.is(a, b);
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let index = 0; index < a.length; index += 1) {
      if (!stateValueEqual(a[index], b[index])) return false;
    }
    return true;
  }

  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key) || !stateValueEqual(a[key], b[key])) {
      return false;
    }
  }
  return true;
};

const normalizeLyricsSource = (source) => ({
  content: source?.content || '',
  fileType: source?.fileType || 'txt',
  filePath: source?.filePath || null,
  fileName: source?.fileName || '',
});

export const createLyricsSessionSlice = (set) => ({
  lyrics: [],
  rawLyricsContent: '',
  selectedLine: null,
  lyricsFileName: '',
  lyricsSections: [],
  lineToSection: {},
  songMetadata: {
    title: '',
    artists: [],
    album: '',
    year: null,
    origin: '',
    filePath: '',
  },
  lyricsSource: {
    content: '',
    fileType: 'txt',
    filePath: null,
    fileName: '',
  },
  lyricsTimestamps: [],
  lyricsEnhancedTimestamps: [],
  pendingSavedVersion: null,

  setLyrics: (lines) => set((state) => (stateValueEqual(state.lyrics, lines) ? state : { lyrics: lines })),
  setLyricsSections: (sections) => set((state) => {
    const next = Array.isArray(sections) ? sections : [];
    return stateValueEqual(state.lyricsSections, next) ? state : { lyricsSections: next };
  }),
  setLineToSection: (mapping) => set((state) => {
    const next = mapping && typeof mapping === 'object' ? mapping : {};
    return stateValueEqual(state.lineToSection, next) ? state : { lineToSection: next };
  }),
  setRawLyricsContent: (content) => set((state) => (state.rawLyricsContent === content ? state : { rawLyricsContent: content })),
  setLyricsFileName: (name) => set((state) => (state.lyricsFileName === name ? state : { lyricsFileName: name })),
  selectLine: (index) => set((state) => (Object.is(state.selectedLine, index) ? state : { selectedLine: index })),
  setSongMetadata: (metadata) => set((state) => (stateValueEqual(state.songMetadata, metadata) ? state : { songMetadata: metadata })),
  setLyricsSource: (source) => set((state) => {
    const next = normalizeLyricsSource(source);
    return stateValueEqual(state.lyricsSource, next) ? state : { lyricsSource: next };
  }),
  setLyricsTimestamps: (timestamps) => set((state) => (stateValueEqual(state.lyricsTimestamps, timestamps) ? state : { lyricsTimestamps: timestamps })),
  setLyricsEnhancedTimestamps: (timestamps) => set((state) => (stateValueEqual(state.lyricsEnhancedTimestamps, timestamps) ? state : { lyricsEnhancedTimestamps: timestamps })),
  setPendingSavedVersion: (payload) => set({ pendingSavedVersion: payload || null }),
  clearPendingSavedVersion: () => set({ pendingSavedVersion: null }),
});
