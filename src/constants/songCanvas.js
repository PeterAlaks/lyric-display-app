export const STANDARD_LRC_START_REGEX = /^\s*(\[\d{1,2}:\d{2}(?:\.\d{1,2})?\])+/;

export const METADATA_OPTIONS = [
  { key: 'ti', label: 'Title [ti:]' },
  { key: 'ar', label: 'Artist [ar:]' },
  { key: 'al', label: 'Album [al:]' },
  { key: 'au', label: 'Author [au:]' },
  { key: 'lr', label: 'Lyricist [lr:]' },
  { key: 'length', label: 'Length [length:]' },
  { key: 'by', label: 'LRC Author [by:]' },
  { key: 'offset', label: 'Offset [offset:]' },
  { key: 're', label: 'Player/Editor [re:]' },
  { key: 'tool', label: 'Tool [tool:]' },
  { key: 've', label: 'Version [ve:]' },
  { key: '#', label: 'Comment [#]' },
];

export const SONG_SECTIONS = [
  { key: 'Verse', label: 'Verse' },
  { key: 'Verse 1', label: 'Verse 1' },
  { key: 'Verse 2', label: 'Verse 2' },
  { key: 'Verse 3', label: 'Verse 3' },
  { key: 'Chorus', label: 'Chorus' },
  { key: 'Pre-Chorus', label: 'Pre-Chorus' },
  { key: 'Bridge', label: 'Bridge' },
  { key: 'Intro', label: 'Intro' },
  { key: 'Outro', label: 'Outro' },
  { key: 'Hook', label: 'Hook' },
  { key: 'Refrain', label: 'Refrain' },
  { key: 'Interlude', label: 'Interlude' },
  { key: 'Break', label: 'Break' },
];