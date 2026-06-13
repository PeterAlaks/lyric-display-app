import React from 'react';
import { Ungroup } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import { HORIZONTAL_PADDING_PX, ROW_GAP } from './layout';
import LyricLineContent from './LyricLineContent';
import TutorialLineAnchor from './TutorialLineAnchor';

export default function LyricRow({
  index,
  line,
  style,
  lyrics,
  virtualized = false,
  getLineClassName,
  handleRowClick,
  handleSplitGroup,
  handleContextMenuOpen,
  handleRowTouchStart,
  handleRowTouchMove,
  handleRowTouchEnd,
  selectedLine,
  darkMode,
  hoveredLineIndex,
  setHoveredLineIndex,
  hoveredButtonIndex,
  setHoveredButtonIndex,
  sectionStartLookup,
  sectionById,
  activeSectionId,
  selectedIndices,
  isDesktopApp,
  stageOnlyTutorial,
  handleStageOnlyTutorialVisible,
  handleStageOnlyTutorialOpenChange,
  handleNeverShowTutorialPopovers,
  searchQuery,
  isStructureTagLine,
  getNormalGroupLines,
}) {
  const currentLine = line ?? lyrics?.[index];
  if (currentLine == null) return null;

  const sectionId = sectionStartLookup.get(index);
  const sectionLabel = sectionId ? sectionById.get(sectionId)?.label : null;
  const isActiveSection = sectionId && sectionId === activeSectionId;
  const isBatchSelected = selectedIndices?.has(index);

  if (typeof currentLine === 'string' && isStructureTagLine(currentLine)) {
    if (!virtualized) {
      return <div data-line-index={index} className="px-4 h-2 pointer-events-none" />;
    }

    return (
      <div
        data-line-index={index}
        style={getVirtualizedStyle(style)}
        className="pointer-events-none"
      />
    );
  }

  const rowInner = (
    <div
      data-line-index={virtualized ? index : undefined}
      style={virtualized ? getVirtualizedStyle(style) : undefined}
      className={virtualized ? undefined : 'px-4'}
    >
      {sectionLabel && (
        <div className={`text-xs font-semibold ${virtualized ? 'mb-3' : 'mb-2'} flex items-center gap-2 ${getSectionClassName(isActiveSection, darkMode, virtualized)}`}>
          <span className="uppercase tracking-wide">{sectionLabel.toUpperCase ? sectionLabel.toUpperCase() : sectionLabel}</span>
          <span className="h-px flex-1 bg-gray-300 opacity-60" />
        </div>
      )}
      <div
        data-line-index={virtualized ? undefined : index}
        className={`${getLineClassName(index, virtualized, isBatchSelected)} relative`}
        onClick={(event) => handleRowClick(event, index)}
        onContextMenu={(event) => handleContextMenuOpen(event, index)}
        onTouchStart={(event) => handleRowTouchStart(event, index)}
        onTouchMove={handleRowTouchMove}
        onTouchEnd={handleRowTouchEnd}
        onMouseEnter={() => setHoveredLineIndex(index)}
        onMouseLeave={() => setHoveredLineIndex(null)}
      >
        <LyricLineContent
          line={currentLine}
          index={index}
          searchQuery={searchQuery}
          darkMode={darkMode}
          isStructureTagLine={isStructureTagLine}
          getNormalGroupLines={getNormalGroupLines}
        />

        {isDesktopApp && currentLine?.type === 'normal-group' && hoveredLineIndex === index && (
          <Tooltip content="Split this group into two separate lines" side="top" sideOffset={5}>
            <button
              onClick={(e) => handleSplitGroup(e, index)}
              onMouseEnter={() => setHoveredButtonIndex(index)}
              onMouseLeave={() => setHoveredButtonIndex(null)}
              className={`absolute top-1.5 right-1.5 rounded-md shadow-sm flex items-center transition-all duration-200 ease-in-out ${hoveredButtonIndex === index ? 'p-1.5 gap-1.5' : 'p-1.5'
                } ${index === selectedLine
                  ? 'bg-blue-500 hover:bg-blue-600 text-white border border-blue-400'
                  : darkMode
                    ? 'bg-gray-800 hover:bg-gray-900 text-gray-100 border border-gray-600'
                    : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300'
                }`}
            >
              <Ungroup className="w-3.5 h-3.5 flex-shrink-0" />
              <span
                className={`text-xs font-medium whitespace-nowrap overflow-hidden transition-all duration-200 ease-in-out ${hoveredButtonIndex === index
                  ? 'max-w-[60px] opacity-100 ml-0'
                  : 'max-w-0 opacity-0'
                  }`}
              >
                Ungroup
              </span>
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );

  return (
    <TutorialLineAnchor
      active={stageOnlyTutorial?.index === index}
      open={Boolean(stageOnlyTutorial?.index === index && stageOnlyTutorial.open)}
      index={index}
      loadKey={stageOnlyTutorial?.key}
      darkMode={darkMode}
      onVisible={handleStageOnlyTutorialVisible}
      onOpenChange={handleStageOnlyTutorialOpenChange}
      onNeverShowAgain={handleNeverShowTutorialPopovers}
    >
      {rowInner}
    </TutorialLineAnchor>
  );
}

function getVirtualizedStyle(style) {
  const heightValue = style?.height;
  return {
    ...style,
    ...(heightValue != null
      ? {
        height: `calc(${typeof heightValue === 'number'
          ? `${heightValue}px`
          : heightValue} - ${ROW_GAP}px)`,
      }
      : {}),
    paddingLeft: `${HORIZONTAL_PADDING_PX}px`,
    paddingRight: `${HORIZONTAL_PADDING_PX}px`,
    boxSizing: 'border-box',
  };
}

function getSectionClassName(isActiveSection, darkMode, virtualized) {
  if (isActiveSection) {
    return darkMode ? 'text-green-400' : virtualized ? 'text-green-600' : 'text-green-500';
  }

  return darkMode ? 'text-gray-300' : 'text-gray-600';
}
