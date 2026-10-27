export const isAutoplayKeyboardShortcut = (event) => (
  Boolean(event?.ctrlKey || event?.metaKey)
  && !event?.altKey
  && String(event?.key || '').toLowerCase() === 'p'
);

const NEXT_LINE_KEYS = new Set(['PageDown', 'ArrowRight', 'ArrowDown']);
const PREVIOUS_LINE_KEYS = new Set(['PageUp', 'ArrowLeft', 'ArrowUp']);
// Space, plus the B / . keys presentation clickers send from their "blank screen" button.
const TOGGLE_OUTPUT_KEYS = new Set([' ', 'b', 'B', '.']);
const SECTION_JUMP_LETTERS = new Set(['C', 'V', 'B', 'P', 'T', 'I', 'O', 'E']);

/**
 * Unmodified live-navigation keys, including the PageUp/PageDown and arrow keys sent by
 * presentation clickers.
 * @returns {'next'|'previous'|'first'|'last'|'toggle-output'|null}
 */
export const getLiveNavigationKeyAction = (event) => {
  if (!event || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return null;
  const key = event.key;
  if (NEXT_LINE_KEYS.has(key) || event.keyCode === 40) return 'next';
  if (PREVIOUS_LINE_KEYS.has(key) || event.keyCode === 38) return 'previous';
  if (key === 'Home') return 'first';
  if (key === 'End') return 'last';
  if (TOGGLE_OUTPUT_KEYS.has(key) || event.code === 'Space') return 'toggle-output';
  return null;
};

/**
 * Shift + letter jumps to the next section of that type (Shift+C for Chorus). Shift keeps
 * stray typing from cueing lyrics live.
 * @returns {string|null} Upper-case section letter.
 */
export const getSectionJumpHotkey = (event) => {
  if (!event?.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return null;
  const letter = /^Key([A-Z])$/.exec(event.code || '')?.[1]
    || (/^[a-z]$/i.test(event.key || '') ? event.key.toUpperCase() : null);
  return letter && SECTION_JUMP_LETTERS.has(letter) ? letter : null;
};

export const SHORTCUTS = [
  {
    category: 'General & Window',
    items: [
      { label: 'Close the active modal or popup', combo: 'Escape' },
      { label: 'Open Preferences (Control Panel / Canvas)', combo: 'Ctrl/Cmd + I' },
      { label: 'Reload the Control Panel window', combo: 'Ctrl/Cmd + R' },
      { label: 'Toggle Developer Tools', combo: 'Ctrl/Cmd + Shift + I' },
      { label: 'Zoom in', combo: 'Ctrl/Cmd + + / =' },
      { label: 'Zoom out', combo: 'Ctrl/Cmd + -' },
      { label: 'Reset zoom', combo: 'Ctrl/Cmd + 0' },
      { label: 'Toggle fullscreen', combo: 'F11' },
      { label: 'Quit LyricDisplay', combo: 'Alt + F4' },
    ],
  },
  {
    category: 'Control Panel — Files & Setlist',
    items: [
      { label: 'Open file navigator', combo: 'Ctrl/Cmd + O' },
      { label: 'Open native file dialog', combo: 'Ctrl/Cmd + Alt + O' },
      { label: 'Create new lyrics', combo: 'Ctrl/Cmd + N' },
      { label: 'Edit loaded lyrics', combo: 'Ctrl/Cmd + E' },
      { label: 'Open Setlist Manager', combo: 'Ctrl/Cmd + Shift + S' },
      { label: 'Open Online Lyrics Search', combo: 'Ctrl/Cmd + Shift + O' },
      { label: 'Open Timer Control', combo: 'Ctrl/Cmd + Shift + T' },
      { label: 'Open Project Output', combo: 'Ctrl/Cmd + Alt + P' },
      { label: 'Add current song to setlist', combo: 'Ctrl/Cmd + Alt + S' },
      { label: 'Previous / next setlist song', combo: 'Ctrl/Cmd + Shift + ← / →' },
    ],
  },
  {
    category: 'Control Panel — Search',
    items: [
      { label: 'Focus lyric search', combo: 'Ctrl/Cmd + F' },
      { label: 'Clear lyric search', combo: 'Escape' },
      { label: 'Send highlighted search match', combo: 'Enter' },
      { label: 'Previous / next search match', combo: 'Shift + ↑ / ↓' },
    ],
  },
  {
    category: 'Control Panel — Live Control',
    items: [
      { label: 'Toggle output visibility', combo: 'Space' },
      { label: 'Blank output (presentation clicker blank button)', combo: 'B / .' },
      { label: 'Toggle autoplay', combo: 'Ctrl/Cmd + P' },
      { label: 'Toggle intelligent autoplay (timestamped lyrics)', combo: 'Ctrl/Cmd + Shift + P' },
      { label: 'Clear output outside text fields', combo: 'Ctrl/Cmd + C' },
      { label: 'Send previewed lyric line', combo: 'Enter' },
      { label: 'Previous / next lyric line', combo: '↑ / ↓' },
      { label: 'Previous / next lyric line', combo: '← / →' },
      { label: 'Previous / next lyric line (presentation clickers)', combo: 'Page Up / Page Down' },
      { label: 'First / last lyric line', combo: 'Home / End' },
      { label: 'Jump to next Chorus / Verse / Bridge / Pre-Chorus', combo: 'Shift + C / V / B / P' },
      { label: 'Jump to next Tag / Intro / Outro / Ending', combo: 'Shift + T / I / O / E' },
    ],
  },
  {
    category: 'Control Panel — Output Tabs',
    items: [
      { label: 'Switch to Output 1–6 (when available)', combo: '1–6' },
      { label: 'Switch to Stage', combo: '0' },
    ],
  },
  {
    category: 'Song Canvas — File & Search',
    items: [
      { label: 'Start new lyrics', combo: 'Ctrl/Cmd + N' },
      { label: 'Open file navigator', combo: 'Ctrl/Cmd + O' },
      { label: 'Save file', combo: 'Ctrl/Cmd + S' },
      { label: 'Save and load into Control Panel', combo: 'Ctrl/Cmd + Shift + L' },
      { label: 'Clean up lyrics', combo: 'Ctrl/Cmd + Shift + C' },
      { label: 'Open Find', combo: 'Ctrl/Cmd + F' },
      { label: 'Open Find and Replace', combo: 'Ctrl/Cmd + H' },
      { label: 'Previous / next search match', combo: 'Shift + ↑ / ↓' },
      { label: 'Close search/selection or return', combo: 'Escape' },
      { label: 'Return when outside an editor', combo: 'Backspace' },
    ],
  },
  {
    category: 'Song Canvas — Line Editing',
    items: [
      { label: 'Add translation line', combo: 'Ctrl/Cmd + T' },
      { label: 'Duplicate current line', combo: 'Ctrl/Cmd + D' },
      { label: 'Select current line', combo: 'Ctrl/Cmd + L' },
    ],
  },
  {
    category: 'Online Lyrics Search',
    items: [
      { label: 'Move through library results', combo: '↑ / ↓' },
      { label: 'Select result or run search', combo: 'Enter' },
      { label: 'Close Online Lyrics Search', combo: 'Escape' },
    ],
  },
  {
    category: 'Lyric Video & Timer',
    items: [
      { label: 'Play / pause Lyric Video Studio', combo: 'Space' },
      { label: 'Start, pause, resume, or advance timer', combo: 'Space' },
    ],
  },
  {
    category: 'First-Run Tour',
    items: [
      { label: 'Previous / next tour step', combo: '← / →' },
      { label: 'Skip tour or close skip confirmation', combo: 'Escape' },
    ],
  },
];
