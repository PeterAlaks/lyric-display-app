export const GAP_BEHAVIORS = {
  BACKGROUND_ONLY: 'background-only',
  BLANK: 'blank',
  SHOW_TITLE: 'show-title',
  KEEP_PREVIOUS_LINE: 'keep-previous-line',
};

const isValidTimestampCs = (timestamp) =>
  typeof timestamp === 'number' && Number.isFinite(timestamp) && timestamp >= 0;

export const timestampCsToMs = (timestampCs) =>
  isValidTimestampCs(timestampCs) ? timestampCs * 10 : null;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function getTimedEntries(lyrics, timestamps) {
  if (!Array.isArray(lyrics) || !Array.isArray(timestamps)) return [];

  return lyrics
    .map((line, index) => {
      const timeMs = timestampCsToMs(timestamps[index]);
      return timeMs === null ? null : { index, line, timeMs };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.timeMs !== b.timeMs) return a.timeMs - b.timeMs;
      return a.index - b.index;
    });
}

function getClearedLine(gapBehavior) {
  return gapBehavior === GAP_BEHAVIORS.BLANK ? '' : null;
}

/**
 * Resolve the currently displayed lyricVideo line from an audio clock.
 *
 * Timestamps are centiseconds and are converted to milliseconds internally.
 * Positive offsetMs advances the lyric timeline relative to the audio clock.
 */
export function getActiveLyricVideoLine({
  lyrics,
  timestamps,
  currentTimeMs,
  offsetMs = 0,
  gapBehavior = GAP_BEHAVIORS.BACKGROUND_ONLY,
  clearAfterMs = 2500,
}) {
  const entries = getTimedEntries(lyrics, timestamps);
  const effectiveTimeMs = Math.max(0, (Number(currentTimeMs) || 0) + (Number(offsetMs) || 0));
  const safeClearAfterMs = Number.isFinite(Number(clearAfterMs))
    ? Math.max(0, Number(clearAfterMs))
    : 2500;

  if (entries.length === 0) {
    return {
      activeIndex: null,
      activeLine: null,
      nextIndex: null,
      progressToNext: 0,
      inGap: false,
      gapMs: 0,
    };
  }

  let activeEntry = null;
  let activePosition = -1;

  for (let i = 0; i < entries.length; i += 1) {
    if (entries[i].timeMs <= effectiveTimeMs) {
      activeEntry = entries[i];
      activePosition = i;
    } else {
      break;
    }
  }

  if (!activeEntry) {
    return {
      activeIndex: null,
      activeLine: null,
      nextIndex: entries[0].index,
      progressToNext: 0,
      inGap: false,
      gapMs: 0,
    };
  }

  const nextEntry = entries
    .slice(activePosition + 1)
    .find((entry) => entry.timeMs > activeEntry.timeMs) || null;

  const clearAtMs = activeEntry.timeMs + safeClearAfterMs;
  const inGap = effectiveTimeMs >= clearAtMs && (!nextEntry || effectiveTimeMs < nextEntry.timeMs);
  const shouldClearActiveLine = inGap && gapBehavior !== GAP_BEHAVIORS.KEEP_PREVIOUS_LINE;

  const progressToNext = nextEntry
    ? clamp((effectiveTimeMs - activeEntry.timeMs) / (nextEntry.timeMs - activeEntry.timeMs), 0, 1)
    : 1;

  return {
    activeIndex: shouldClearActiveLine ? null : activeEntry.index,
    activeLine: shouldClearActiveLine ? getClearedLine(gapBehavior) : activeEntry.line,
    nextIndex: nextEntry?.index ?? null,
    progressToNext,
    inGap,
    gapMs: inGap ? Math.max(0, effectiveTimeMs - clearAtMs) : 0,
  };
}
