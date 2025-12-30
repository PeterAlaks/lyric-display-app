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