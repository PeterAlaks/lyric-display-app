import React from 'react';
import { Ungroup } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import { HORIZONTAL_PADDING_PX, ROW_GAP } from '../../hooks/LyricsList/useLyricsListRows';
import LyricLineContent from './LyricLineContent';
import TutorialLineAnchor from './TutorialLineAnchor';
import { formatTimestamp } from '../../utils/timestampHelpers';

export default function LyricRow({
  index,
  line,
  style,
  lyrics,
  lyricsTimestamps,
  virtualized = false,
  getLineClassName,
  handleRowClick,
  handleSplitGroup,
  handleContextMenuOpen,
  handleRowTouchStart,
  handleRowTouchMove,
  handleRowTouchEnd,
  selectedLine,
  previewLine,
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
  highlightedLineIndex,
  isStructureTagLine,
  getNormalGroupLines,
  isOutputOn = true,
  density = 'default',
}) {
  const compact = density === 'dock' || density === 'compact';
  const currentLine = line ?? lyrics?.[index];
  if (currentLine == null) return null;

  const sectionId = sectionStartLookup.get(index);
  const sectionLabel = sectionId ? sectionById.get(sectionId)?.label : null;
  const isActiveSection = sectionId && sectionId === activeSectionId;
  const isBatchSelected = selectedIndices?.has(index);
  const isActiveSearchMatch = index === highlightedLineIndex && Boolean(searchQuery);
  const timestamp = Array.isArray(lyricsTimestamps) ? lyricsTimestamps[index] : null;
  const isLive = index === selectedLine;
  const isPreview = index === previewLine && !isLive;
  const tallyLabel = isPreview ? 'Preview' : isLive ? (isOutputOn ? 'Live' : 'Cued') : null;
  const isUngroupHovered = isDesktopApp && currentLine?.type === 'normal-group' && hoveredLineIndex === index;
  const showTally = Boolean(tallyLabel) && (!isUngroupHovered || tallyLabel === 'Live');
  const hasTimestamp = typeof timestamp === 'number' && Number.isFinite(timestamp) && timestamp >= 0;

  if (typeof currentLine === 'string' && isStructureTagLine(currentLine)) {
    if (!virtualized) {
      return <div data-line-index={index} className={`${compact ? 'px-2 h-1' : 'px-3 h-2'} pointer-events-none`} />;
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
      className={virtualized ? undefined : compact ? 'px-2' : 'px-3'}
    >
      {sectionLabel && (
        <div className={`${compact ? 'text-[10px]' : 'text-xs'} font-semibold ${compact ? 'mb-1' : virtualized ? 'mb-3' : 'mb-2'} flex items-center gap-2 ${getSectionClassName(isActiveSection, darkMode, virtualized, compact)}`}>
          <span className="uppercase tracking-wide">{sectionLabel.toUpperCase ? sectionLabel.toUpperCase() : sectionLabel}</span>
          <span className={`h-px flex-1 ${darkMode ? 'bg-gray-800' : 'bg-gray-300'} opacity-80`} />
        </div>
      )}
      <div
        data-line-index={virtualized ? undefined : index}
        data-preview-line={index === previewLine ? 'true' : undefined}
        aria-current={isLive ? 'true' : undefined}
        className={`${getLineClassName(index, virtualized, isBatchSelected)} relative`}
        onClick={(event) => handleRowClick(event, index)}
        onContextMenu={(event) => handleContextMenuOpen(event, index)}
        onTouchStart={(event) => handleRowTouchStart(event, index)}
        onTouchMove={handleRowTouchMove}
        onTouchEnd={handleRowTouchEnd}
        onMouseEnter={() => setHoveredLineIndex(index)}
        onMouseLeave={() => setHoveredLineIndex(null)}
      >
        <div className={`${hasTimestamp ? 'flex items-stretch gap-3 ' : ''}${showTally ? (compact ? 'pr-14' : 'pr-18') : 'pr-9'}`}>
          {hasTimestamp && (
            <div
              className={`shrink-0 self-stretch rounded-md border px-2 py-1 font-mono ${compact ? 'w-18 text-[10px]' : 'w-21 text-[11px]'} flex items-center justify-center ${darkMode
                ? 'border-gray-600 bg-gray-900/35 text-gray-300'
                : 'border-gray-200 bg-white/80 text-gray-500'
                }`}
            >
              {formatTimestamp(timestamp)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <LyricLineContent
              line={currentLine}
              index={index}
              searchQuery={searchQuery}
              darkMode={darkMode}
              isStructureTagLine={isStructureTagLine}
              getNormalGroupLines={getNormalGroupLines}
              density={density}
              isActiveSearchMatch={isActiveSearchMatch}
              tone={isPreview ? 'preview' : isLive && isOutputOn ? 'live' : 'default'}
            />
          </div>
        </div>

        {showTally && (
          tallyLabel === 'Live' ? (
            <span
              className="pointer-events-none absolute right-2.5 top-2.5 z-10 h-1.5 w-1.5 rounded-full bg-red-500"
              role="img"
              aria-label="Live"
              title="Live"
            />
          ) : (
            <span
              className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-1.5 py-0.5 ${compact ? 'text-[8px]' : 'text-[9px]'} font-bold uppercase tracking-[0.12em] ${isPreview
                ? darkMode ? 'bg-amber-400/20 text-amber-200' : 'bg-amber-500/15 text-amber-800'
                : 'bg-red-500/15 text-red-500'
                }`}
            >
              {tallyLabel}
            </span>
          )
        )}

        {isDesktopApp && currentLine?.type === 'normal-group' && hoveredLineIndex === index && (
          <Tooltip content="Split this group into two separate lines" side="top" sideOffset={5}>
            <button
              onClick={(e) => handleSplitGroup(e, index)}
              onMouseEnter={() => setHoveredButtonIndex(index)}
              onMouseLeave={() => setHoveredButtonIndex(null)}
              className={`absolute right-2 top-1/2 flex h-7 min-w-7 -translate-y-1/2 items-center justify-center rounded-full px-[7.5px] shadow-sm transition-all duration-200 ease-in-out ${hoveredButtonIndex === index ? 'gap-1.5' : 'gap-0'
                } ${darkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-100 border border-gray-500'
                  : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300'
                }`}
            >
              <Ungroup className="h-3.25 w-3.25 shrink-0" />
              <span
                className={`text-[11px] font-medium whitespace-nowrap overflow-hidden transition-all duration-200 ease-in-out ${hoveredButtonIndex === index
                  ? 'max-w-15 opacity-100 ml-0'
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

function getSectionClassName(isActiveSection, darkMode, virtualized, compact) {
  if (isActiveSection) {
    if (darkMode && compact) return 'text-blue-300';
    return darkMode ? 'text-green-400' : virtualized ? 'text-green-600' : 'text-green-500';
  }

  if (darkMode && compact) return 'text-gray-500';
  return darkMode ? 'text-gray-300' : 'text-gray-600';
}
