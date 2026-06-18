import React from 'react';

const highlightSearchTerm = (text, searchTerm) => {
  if (!searchTerm || !text) return text;
  const regex = new RegExp(
    `(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
    'gi'
  );
  return text.split(regex).map((part, i) =>
    regex.test(part) ? (
      <span
        key={i}
        className="bg-orange-200 text-orange-900 font-medium"
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
}) {
  if (line == null) return null;

  if (isStructureTagLine(line)) {
    return <div className="h-1" aria-hidden="true" />;
  }

  if (line.type === 'group') {
    return (
      <div className="space-y-1">
        <div className="font-medium">
          {highlightSearchTerm(line.mainLine, searchQuery)}
        </div>
        {line.translation && (
          <div
            className={`text-sm italic ${darkMode ? 'text-gray-300' : 'text-gray-600'
              }`}
          >
            {highlightSearchTerm(line.translation, searchQuery)}
          </div>
        )}
      </div>
    );
  }

  if (line.type === 'normal-group') {
    const normalLines = getNormalGroupLines(line);
    return (
      <div className="space-y-1">
        {normalLines.map((groupLine, groupIndex) => (
          <div
            key={`${line.id || index}_${groupIndex}`}
            className={`${groupIndex === 0 ? 'font-medium' : 'text-sm'} ${groupIndex === 0 ? '' : (darkMode ? 'text-gray-300' : 'text-gray-600')}`}
          >
            {highlightSearchTerm(groupLine, searchQuery)}
          </div>
        ))}
      </div>
    );
  }

  return highlightSearchTerm(line, searchQuery);
}
