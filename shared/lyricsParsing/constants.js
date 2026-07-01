export const BRACKET_PAIRS = [
  ['[', ']'],
  ['(', ')'],
  ['{', '}'],
  ['<', '>'],
];

// Default config values - can be overridden by user preferences
export const NORMAL_GROUP_CONFIG = {
  ENABLED: true,
  MAX_LINE_LENGTH: 45,
  CROSS_BLANK_LINE_GROUPING: true,
  MAX_LINES_PER_GROUP: 2,
};

export const STRUCTURE_TAGS_CONFIG = {
  ENABLED: true,
  MODE: 'isolate',
};

// Common structure tag patterns
export const STRUCTURE_TAG_PATTERNS = [
  // [Verse], (Verse), {Verse}, <Verse>, [Verse 1:], [Chorus: Artist], etc.
  // Supports many common song structure markers with optional numbering/sub-labels
  /^\s*[\[\(\{<](Verse|Vamp|Chorus|Hook|Refrain|Bridge|Intro|Outro|Pre[- ]?Chorus|Post[- ]?Chorus|Pre[- ]?Hook|Post[- ]?Hook|Interlude|Break|Instrumental|Solo|Rap|Rap Verse|Spoken|Coda|Backing Vocals|Ad[- ]?Libs?|Adlibs?|Outro Chorus|Final Chorus|Ending Chorus)(\s+\d+)?(?:\s*[-\u2013]\s*[^\]\)\}>:]+)?(?:\s*:\s*[^\]\)\}>]*)?\s*[\]\)\}>]\s*/i,

  // Verse 1:, Chorus:, Bridge:, etc. (with colon)
  /^\s*(Verse|Vamp|Chorus|Hook|Refrain|Bridge|Intro|Outro|Pre[- ]?Chorus|Post[- ]?Chorus|Pre[- ]?Hook|Post[- ]?Hook|Interlude|Break|Instrumental|Solo|Rap|Rap Verse|Spoken|Coda|Backing Vocals|Ad[- ]?Libs?|Adlibs?|Outro Chorus|Final Chorus|Ending Chorus)(\s+\d+)?(?:\s*[-\u2013]\s*[^:]+)?\s*:\s*/i,

  // Verse 1, Chorus, Bridge, etc. (standalone line without colon)
  /^\s*(Verse|Vamp|Chorus|Hook|Refrain|Bridge|Intro|Outro|Pre[- ]?Chorus|Post[- ]?Chorus|Pre[- ]?Hook|Post[- ]?Hook|Interlude|Break|Instrumental|Solo|Rap|Rap Verse|Spoken|Coda|Backing Vocals|Ad[- ]?Libs?|Adlibs?|Outro Chorus|Final Chorus|Ending Chorus)(\s+\d+)?\s*$/i,

  // Roman numeral sections: Verse II, Chorus IV, etc.
  /^\s*(Verse|Chorus|Bridge|Hook|Refrain)\s+[IVXLC]+\s*:?$/i,

  // Numeric shorthand: V1, C2, B1, PC, etc. Single-letter forms require numbers.
  /^\s*(?:(?:V|C|B|O|I|R)\d+|(?:PC|HC)\d*)\s*:?$/i,

  // ALL CAPS common markers
  /^\s*(VERSE|CHORUS|BRIDGE|HOOK|REFRAIN|INTRO|OUTRO|PRE[- ]?CHORUS|POST[- ]?CHORUS|INTERLUDE|INSTRUMENTAL|SOLO|RAP)(\s+\d+)?\s*:?$/,

  // Double section markers: Chorus x2, Repeat Chorus, etc.
  /^\s*(Repeat\s+)?(Verse|Chorus|Bridge|Hook|Refrain|Outro|Intro)(\s+\d+)?(\s*x\d+)?\s*:?$/i,
];

export const TIME_TAG_REGEX = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,2}))?\]/g;
export const ENHANCED_TIME_TAG_REGEX = /<(\d{1,2}):(\d{2})(?:\.(\d{1,2}))?>/g;
export const META_TAG_REGEX = /^\s*\[\s*(ti|ar|al|by|offset|length|au|lr|re|tool|ve|#)\s*:.*\]\s*$/i;

export const TIMESTAMP_LIKE_PATTERNS = [
  /\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/g,
  /<\d{1,2}:\d{2}(?:\.\d{1,3})?>/g,
  /\(\d{1,2}:\d{2}(?:\.\d{1,3})?\)/g,
  /^\d{1,2}:\d{2}\s+/gm,
];
