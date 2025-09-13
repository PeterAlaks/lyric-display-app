// Utilities for formatting and reconstructing lyrics text

// Auto-formatting utility function with bracket-aware spacing
export const formatLyrics = (text) => {
  const religiousWords = ['jesus', 'jesu', 'yesu', 'jehovah', 'god', 'yahweh', 'lord', 'christ'];

  // Split into lines
  const lines = text.split(/\r?\n/);
  const formattedLines = [];

  // Same translation detection logic used elsewhere
  const isTranslationLine = (line) => {
    if (!line || typeof line !== 'string') return false;

    const trimmed = line.trim();
    if (trimmed.length <= 2) return false; // must have content

    const bracketPairs = [['[', ']'], ['(', ')'], ['{', '}'], ['<', '>']];
    return bracketPairs.some(([open, close]) => trimmed.startsWith(open) && trimmed.endsWith(close));
  };

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue;

    // Remove leading punctuation (periods, commas, hyphens)
    line = line.replace(/^[.,\-]+/, '');
    // NEW: specifically remove leading ellipses (.., ..., .... etc.) while keeping the rest of the line
    line = line.replace(/^\.+/, '');
    // NEW: also remove the ellipsis symbols "․", "‥", "…"
    line = line.replace(/^[․‥…]+/, '');
    // Remove all periods and dot-like symbols
    line = line.replace(/[.․‥…]/g, '');

    // Capitalize first letter
    line = line.charAt(0).toUpperCase() + line.slice(1);

    // Capitalize religious words
    religiousWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      line = line.replace(regex, match => match.charAt(0).toUpperCase() + match.slice(1).toLowerCase());
    });

    formattedLines.push(line);

    // Look ahead: add blank line unless next line is a translation
    const nextLine = lines[i + 1] || '';
    if (!isTranslationLine(nextLine)) {
      formattedLines.push('');
    }
  }

  // Remove last empty line if exists
  if (formattedLines[formattedLines.length - 1] === '') {
    formattedLines.pop();
  }

  return formattedLines.join('\n');
};

// Reconstructs editable text from processed lyrics array
export const reconstructEditableText = (lyrics) => {
  if (!lyrics || lyrics.length === 0) return '';

  return lyrics.map(line => {
    if (typeof line === 'string') {
      return line;
    } else if (line && line.type === 'group') {
      // Reconstruct original format: main line + translation line with blank line after
      return `${line.mainLine}\n${line.translation}`;
    }
    return '';
  }).join('\n\n'); // Double newline to maintain spacing between sections
};

