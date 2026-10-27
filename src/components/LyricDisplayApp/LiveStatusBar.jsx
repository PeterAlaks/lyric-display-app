import { useEffect, useState } from 'react';
import useLyricsStore from '../../context/LyricsStore';
import { useKeyboardNavigationPreferences, useLyricsState, useOutputState } from '../../hooks/useStoreSelectors';
import { findNavigableLyricLineIndex, getLineOutputText } from '../../utils/parseLyrics';

const flattenLine = (line) => getLineOutputText(line).replace(/\s+/g, ' ').trim();

const useWallClock = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
};

/**
 * Program/next readout under the lyric list: what the audience sees, what the next
 * cue will show, and the time of day, so operators never have to scroll to check.
 */
export default function LiveStatusBar({ darkMode }) {
  const { lyrics, selectedLine } = useLyricsState();
  const { isOutputOn } = useOutputState();
  const { skipSectionTitlesOnKeyboard } = useKeyboardNavigationPreferences();
  const sectionTagPhrases = useLyricsStore((state) => state.lyricsParsingOptions.groupingConfig.sectionTagPhrases);
  const now = useWallClock();

  const hasSelection = Number.isInteger(selectedLine) && selectedLine >= 0 && selectedLine < lyrics.length;
  const liveText = hasSelection ? flattenLine(lyrics[selectedLine]) : '';
  const nextStart = hasSelection ? selectedLine + 1 : 0;
  const nextIndex = nextStart < lyrics.length
    ? findNavigableLyricLineIndex(lyrics, nextStart, 1, {
      skipSectionTitles: skipSectionTitlesOnKeyboard,
      sectionTagPhrases,
    })
    : null;
  const nextText = nextIndex !== null && nextIndex !== selectedLine ? flattenLine(lyrics[nextIndex]) : '';
  const onAir = isOutputOn && Boolean(liveText);

  const labelClass = `shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em]`;
  const dividerClass = `h-5 w-px shrink-0 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`;

  return (
    <div
      className={`flex h-11 shrink-0 items-center gap-3 border-t px-3 text-xs ${darkMode
        ? 'border-gray-700 bg-gray-900/70 text-gray-200'
        : 'border-gray-200 bg-gray-50 text-gray-700'
        }`}
      role="status"
      aria-label="Live output status"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span
          className={`${labelClass} ${onAir
            ? 'bg-red-600 text-white'
            : darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'
            }`}
        >
          {onAir ? 'Live' : isOutputOn ? 'Ready' : 'Off air'}
        </span>
        <span className={`truncate font-medium ${liveText ? '' : darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          {liveText || 'No line selected'}
        </span>
      </div>

      <span className={dividerClass} aria-hidden="true" />

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className={`${labelClass} ${darkMode ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-500 ring-1 ring-gray-200'}`}>
          Next
        </span>
        <span className={`truncate ${nextText ? darkMode ? 'text-gray-400' : 'text-gray-500' : darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
          {nextText || 'End of song'}
        </span>
      </div>

      <span className={dividerClass} aria-hidden="true" />

      <time
        dateTime={now.toISOString()}
        className={`shrink-0 font-mono text-[13px] font-semibold tabular-nums ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}
      >
        {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </time>
    </div>
  );
}
