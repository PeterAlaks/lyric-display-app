/**
 * Parse .lrc file into { rawText, processedLines }
 * - processedLines: array of lyric strings ordered by time
 * - rawText: strictly the displayed text, no timestamps (for editing)
 */
export const parseLrc = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const raw = e.target.result || '';
      const lines = raw.split(/\r?\n/);
      const entries = [];

      const timeTagRe = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,2}))?\]/g; // [mm:ss.xx]
      const metaRe = /^\s*\[(ti|ar|al|by|offset):.*\]\s*$/i; // metadata lines

      for (const line of lines) {
        if (!line?.trim()) continue;
        if (metaRe.test(line)) continue; // skip metadata tags

        // lines can have multiple time tags like [00:01.00][00:02.00] lyric
        let match;
        const times = [];
        timeTagRe.lastIndex = 0;
        while ((match = timeTagRe.exec(line)) !== null) {
          const mm = parseInt(match[1], 10) || 0;
          const ss = parseInt(match[2], 10) || 0;
          const cs = match[3] ? parseInt(match[3].slice(0, 2).padEnd(2, '0'), 10) : 0; // hundredths
          const t = mm * 60 * 100 + ss * 100 + cs; // in hundredths
          times.push(t);
        }
        // Extract text content after the last time tag
        const text = line.replace(timeTagRe, '').trim();
        if (!text) continue;
        if (times.length === 0) {
          // LRC sometimes has lines without a tag - treat as 0 time to keep order
          entries.push({ t: Number.MAX_SAFE_INTEGER, text });
        } else {
          times.forEach((t) => entries.push({ t, text }));
        }
      }

      // Sort by time and collapse duplicates while preserving order
      entries.sort((a, b) => a.t - b.t);
      const processedLines = [];
      const seen = new Set();
      for (const e2 of entries) {
        const key = e2.t + '|' + e2.text;
        if (seen.has(key)) continue;
        seen.add(key);
        processedLines.push(e2.text);
      }

      // Apply bracket-based translation grouping similar to TXT flow
      const isTranslationLine = (line) => {
        if (!line || typeof line !== 'string') return false;
        const trimmed = line.trim();
        if (trimmed.length <= 2) return false; // must have content inside brackets
        const bracketPairs = [['[', ']'], ['(', ')'], ['{', '}'], ['<', '>']];
        return bracketPairs.some(([open, close]) => trimmed.startsWith(open) && trimmed.endsWith(close));
      };

      const grouped = [];
      for (let i = 0; i < processedLines.length; i++) {
        const main = processedLines[i];
        const next = processedLines[i + 1];
        if (next && isTranslationLine(next)) {
          grouped.push({
            type: 'group',
            id: `lrc_group_${i}`,
            mainLine: main,
            translation: next,
            displayText: `${main}\n${next}`,
            searchText: `${main} ${next}`,
            originalIndex: i
          });
          i++; // skip translation line
        } else {
          grouped.push(main);
        }
      }

      const rawText = processedLines.join('\n'); // strictly visible lines only
      resolve({ rawText, processedLines: grouped });
    } catch (err) {
      reject(err);
    }
  };
  reader.onerror = (err) => reject(err);
  reader.readAsText(file);
});

// Parse LRC content from a raw string (no FileReader)
export function parseLrcText(raw) {
  try {
    const lines = (raw || '').split(/\r?\n/);
    const entries = [];

    const timeTagRe = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,2}))?\]/g; // [mm:ss.xx]
    const metaRe = /^\s*\[(ti|ar|al|by|offset):.*\]\s*$/i; // metadata lines

    for (const line of lines) {
      if (!line?.trim()) continue;
      if (metaRe.test(line)) continue;

      let match;
      const times = [];
      timeTagRe.lastIndex = 0;
      while ((match = timeTagRe.exec(line)) !== null) {
        const mm = parseInt(match[1], 10) || 0;
        const ss = parseInt(match[2], 10) || 0;
        const cs = match[3] ? parseInt(match[3].slice(0, 2).padEnd(2, '0'), 10) : 0; // hundredths
        const t = mm * 60 * 100 + ss * 100 + cs; // in hundredths
        times.push(t);
      }
      const text = line.replace(timeTagRe, '').trim();
      if (!text) continue;
      if (times.length === 0) {
        entries.push({ t: Number.MAX_SAFE_INTEGER, text });
      } else {
        times.forEach((t) => entries.push({ t, text }));
      }
    }

    entries.sort((a, b) => a.t - b.t);
    const processedLinesRaw = [];
    const seen = new Set();
    for (const e2 of entries) {
      const key = e2.t + '|' + e2.text;
      if (seen.has(key)) continue;
      seen.add(key);
      processedLinesRaw.push(e2.text);
    }

    const isTranslationLine = (line) => {
      if (!line || typeof line !== 'string') return false;
      const trimmed = line.trim();
      if (trimmed.length <= 2) return false;
      const bracketPairs = [['[', ']'], ['(', ')'], ['{', '}'], ['<', '>']];
      return bracketPairs.some(([open, close]) => trimmed.startsWith(open) && trimmed.endsWith(close));
    };

    const grouped = [];
    for (let i = 0; i < processedLinesRaw.length; i++) {
      const main = processedLinesRaw[i];
      const next = processedLinesRaw[i + 1];
      if (next && isTranslationLine(next)) {
        grouped.push({
          type: 'group',
          id: `lrc_group_${i}`,
          mainLine: main,
          translation: next,
          displayText: `${main}\n${next}`,
          searchText: `${main} ${next}`,
          originalIndex: i
        });
        i++;
      } else {
        grouped.push(main);
      }
    }
    const rawText = processedLinesRaw.join('\n');
    return { rawText, processedLines: grouped };
  } catch (err) {
    throw err;
  }
}
