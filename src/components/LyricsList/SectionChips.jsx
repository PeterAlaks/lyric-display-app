import React from 'react';
import { getCleanSectionLabel } from '../../../shared/lyricsParsing.js';

export default function SectionChips({
  darkMode,
  sections,
  activeSectionId,
  onSectionJump,
  containerRef,
  scrollerRef,
  density = 'default',
}) {
  const compact = density === 'dock' || density === 'compact';
  if (!sections?.length) return null;

  return (
    <div className={`sticky top-0 z-20 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
      <div className="relative" ref={containerRef}>
        <div
          ref={scrollerRef}
          className={`${compact ? 'px-2 py-1.5 gap-1.5' : 'px-4 py-3.5 gap-2'} flex flex-nowrap overflow-x-auto overflow-y-hidden whitespace-nowrap overscroll-contain`}
        >
          {sections.map((section) => {
            const isActive = section.id && section.id === activeSectionId;
            return (
              <button
                key={section.id}
                onClick={() => onSectionJump(section)}
                className={`${compact ? 'text-[10px] px-2.5 py-0.5' : 'text-xs px-4 py-1'} rounded-full border transition-colors shrink-0 ${isActive
                  ? 'bg-blue-500 text-white border-blue-500'
                  : darkMode
                    ? 'bg-gray-800 text-gray-200 border-gray-700 hover:border-gray-500'
                    : 'bg-gray-100 text-gray-700 border-gray-300 hover:border-gray-400'
                  }`}
              >
                {getCleanSectionLabel(section.label).toUpperCase()}
              </button>
            );
          })}
        </div>
        <div
          className={`pointer-events-none absolute inset-y-0 right-0 w-12 ${darkMode
            ? 'bg-gradient-to-l from-gray-800 via-gray-800/85 to-transparent'
            : 'bg-gradient-to-l from-white via-white/85 to-transparent'
            }`}
        />
      </div>
    </div>
  );
}
