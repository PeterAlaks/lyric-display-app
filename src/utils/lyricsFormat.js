// Utilities for formatting and reconstructing lyrics text

export const formatLyrics = (text) => {
  const religiousWords = ['jesus', 'jesu', 'yesu', 'jehovah', 'god', 'yahweh', 'lord', 'christ'];

  const lines = text.split(/\r?\n/);
  const formattedLines = [];

  const isTranslationLine = (line) => {
    if (!line || typeof line !== 'string') return false;

    const trimmed = line.trim();
    if (trimmed.length <= 2) return false;

    const bracketPairs = [['[', ']'], ['(', ')'], ['{', '}'], ['<', '>']];
    return bracketPairs.some(([open, close]) => trimmed.startsWith(open) && trimmed.endsWith(close));
  };

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue;

    line = line.replace(/^[.,\-]+/, '');
    line = line.replace(/^\.+/, '');
    line = line.replace(/^[․‥…]+/, '');
    line = line.replace(/[.․‥…]/g, '');

    line = line.charAt(0).toUpperCase() + line.slice(1);

    religiousWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      line = line.replace(regex, match => match.charAt(0).toUpperCase() + match.slice(1).toLowerCase());
    });

    formattedLines.push(line);

    const nextLine = lines[i + 1] || '';
    if (!isTranslationLine(nextLine)) {
      formattedLines.push('');
    }
  }

  if (formattedLines[formattedLines.length - 1] === '') {
    formattedLines.pop();
  }

  return formattedLines.join('\n');
};

export const reconstructEditableText = (lyrics) => {
  if (!lyrics || lyrics.length === 0) return '';

  return lyrics.map(line => {
    if (typeof line === 'string') {
      return line;
    } else if (line && line.type === 'group') {
      return `${line.mainLine}\n${line.translation}`;
    }
    return '';
  }).join('\n\n');
};
