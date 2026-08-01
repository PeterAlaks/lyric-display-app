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
      { label: 'Open lyrics file', combo: 'Ctrl/Cmd + O' },
      { label: 'Create new lyrics', combo: 'Ctrl/Cmd + N' },
      { label: 'Edit loaded lyrics', combo: 'Ctrl/Cmd + E' },
      { label: 'Open Setlist Manager', combo: 'Ctrl/Cmd + Shift + S' },
      { label: 'Open Online Lyrics Search', combo: 'Ctrl/Cmd + Shift + O' },
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
      { label: 'Toggle autoplay', combo: 'Ctrl/Cmd + P' },
      { label: 'Toggle intelligent autoplay (timestamped lyrics)', combo: 'Ctrl/Cmd + Shift + P' },
      { label: 'Clear output outside text fields', combo: 'Ctrl/Cmd + C' },
      { label: 'Send previewed lyric line', combo: 'Enter' },
      { label: 'Previous / next lyric line', combo: '↑ / ↓' },
      { label: 'First / last lyric line', combo: 'Home / End' },
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
      { label: 'Open lyrics file', combo: 'Ctrl/Cmd + O' },
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
