import { useMemo } from 'react';

const STANDARD_LRC_START_REGEX = /^\s*(\[\d{1,2}:\d{2}(?:\.\d{1,2})?\])+/;
const LRC_METADATA_REGEX = /^\s*\[(ti|ar|al|by|length|offset):.*\]\s*$/i;

/**
 * Hook to determine if content is eligible for LRC format saving
 * @param {string} content - The editor content to validate
 * @returns {{ eligible: boolean, reason: string }} - Eligibility status and reason
  */
const useLrcEligibility = (content) => {
  const lrcEligibility = useMemo(() => {
    const rawLines = (content || '').split(/\r?\n/);
    let timestampedLyricCount = 0;

    for (const rawLine of rawLines) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;
      if (LRC_METADATA_REGEX.test(trimmed)) continue;

      if (!STANDARD_LRC_START_REGEX.test(trimmed)) {
        continue;
      }

      timestampedLyricCount += 1;
    }

    if (timestampedLyricCount < 2) {
      return { eligible: false, reason: 'Add at least two timestamped lyric lines to enable LRC saving or save as plain text.' };
    }

    return { eligible: true, reason: '' };
  }, [content]);

  return lrcEligibility;
};

export default useLrcEligibility;