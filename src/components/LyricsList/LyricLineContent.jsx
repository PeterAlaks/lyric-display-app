import React from 'react';

const highlightSearchTerm = (text, searchTerm, darkMode = false, compact = false) => {
  if (!searchTerm || !text) return text;
  const regex = new RegExp(
    `(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
    'gi'
  );
  return text.split(regex).map((part, i) =>
    regex.test(part) ? (
      <span
        key={i}
        className={darkMode && compact
          ? 'rounded-sm bg-amber-400/25 px-0.5 font-semibold text-amber-100 ring-1 ring-amber-300/20'
          : 'bg-orange-200 text-orange-900 font-medium'}
      >
        {part}
      </span>
    ) : (
      part
    )
  );
};

export default function LyricLineContent({
  line,
  index,
  searchQuery,
  darkMode,
  isStructureTagLine,
  getNormalGroupLines,
  density = 'default',
  isActiveSearchMatch = false,
}) {
  const compact = density === 'dock' || density === 'compact';
  const secondaryTextClass = isActiveSearchMatch
    ? ''
    : darkMode ? 'text-gray-300' : 'text-gray-600';

  if (line == null) return null;

  if (isStructureTagLine(line)) {
    return <div className="h-1" aria-hidden="true" />;
  }

  if (line.type === 'group') {
    return (
      <div className={compact ? 'space-y-0.5' : 'space-y-1'}>
        <div className="font-medium text-[15px]">
          {highlightSearchTerm(line.mainLine, searchQuery, darkMode, compact)}
        </div>
        {line.translation && (
          <div
            className={`${compact ? 'text-[12px]' : 'text-[15px]'} italic ${secondaryTextClass}`}
          >
            {highlightSearchTerm(line.translation, searchQuery, darkMode, compact)}
          </div>
        )}
      </div>
    );
  }

  if (line.type === 'normal-group') {
    const normalLines = getNormalGroupLines(line);
    return (
      <div className={compact ? 'space-y-0.5' : 'space-y-1'}>
        {normalLines.map((groupLine, groupIndex) => (
          <div
            key={`${line.id || index}_${groupIndex}`}
            className={`${groupIndex === 0 ? 'font-medium text-[15px]' : compact ? 'text-[12px]' : 'text-[15px]'} ${groupIndex === 0 ? '' : secondaryTextClass}`}
          >
            {highlightSearchTerm(groupLine, searchQuery, darkMode, compact)}
          </div>
        ))}
      </div>
    );
  }

  return <div className="text-[15px]">{highlightSearchTerm(line, searchQuery, darkMode, compact)}</div>;
}
