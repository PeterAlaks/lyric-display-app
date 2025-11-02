// Project: LyricDisplay App
// File: src/components/LyricsList.jsx

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { List, useDynamicRowHeight, useListRef } from 'react-window';
import { useLyricsState, useDarkModeState } from '../hooks/useStoreSelectors';
import useSocket from '../hooks/useSocket';
import useToast from '../hooks/useToast';
import { Ungroup } from 'lucide-react';

const DEFAULT_ROW_HEIGHT = 48;
const ROW_GAP = 8;
const VIRTUALIZATION_THRESHOLD = 200;
const HORIZONTAL_PADDING_PX = 16;

export default function LyricsList({
  searchQuery = '',
  highlightedLineIndex = null,
  onSelectLine,
}) {
  const listRef = useListRef();
  const { lyrics = [], selectedLine, selectLine, setLyrics } = useLyricsState();
  const { darkMode } = useDarkModeState();
  const { emitLineUpdate, emitLyricsLoad } = useSocket();
  const { showToast } = useToast();
  const [hoveredLineIndex, setHoveredLineIndex] = useState(null);
  const [hoveredButtonIndex, setHoveredButtonIndex] = useState(null);


  const dynamicRowHeight = useDynamicRowHeight({
    defaultRowHeight: DEFAULT_ROW_HEIGHT,
    key: lyrics.length,
  });


  const getInitialRowHeight = useCallback((index) => {
    const line = lyrics[index];
    if (!line) return DEFAULT_ROW_HEIGHT;

    if (line.type === 'group') {
      let height = 48;

      if (line.translation) {
        height += 24;
      }
      return height;
    }

    if (line.type === 'normal-group') {
      return 72;
    }

    return DEFAULT_ROW_HEIGHT;
  }, [lyrics]);

  const rowHeightConfig = useMemo(() => ({
    ...dynamicRowHeight,
    getAverageRowHeight: () => {
      const averageContentHeight =
        dynamicRowHeight.getAverageRowHeight?.() ?? DEFAULT_ROW_HEIGHT;
      return averageContentHeight + ROW_GAP;
    },
    getRowHeight: (index) => {
      const measured = dynamicRowHeight.getRowHeight?.(index);
      const contentHeight = measured ?? getInitialRowHeight(index);
      return contentHeight + ROW_GAP;
    },
    observeRowElements: (elements) => {
      const cleanup = dynamicRowHeight.observeRowElements?.(elements);
      return typeof cleanup === 'function' ? cleanup : () => { };
    },
  }), [dynamicRowHeight, getInitialRowHeight]);

  const handleLineClick = useCallback(
    (index) => {
      if (onSelectLine) onSelectLine(index);
      else {
        selectLine(index);
        emitLineUpdate(index);
      }
    },
    [onSelectLine, selectLine, emitLineUpdate]
  );

  const handleSplitGroup = useCallback(
    (event, index) => {
      event.stopPropagation();

      const line = lyrics[index];
      if (line?.type !== 'normal-group') return;

      const newLyrics = [...lyrics];
      newLyrics.splice(index, 1, line.line1, line.line2);

      setLyrics(newLyrics);

      if (emitLyricsLoad) {
        emitLyricsLoad(newLyrics);
      }

      if (selectedLine === index) {
        setTimeout(() => {
          selectLine(index);
          emitLineUpdate(index);
        }, 0);
      }

      showToast({
        title: 'Group split',
        message: 'The grouped lines have been separated',
        variant: 'success',
      });

      setHoveredLineIndex(null);
    },
    [lyrics, setLyrics, emitLyricsLoad, showToast, selectedLine, selectLine, emitLineUpdate]
  );

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

  const getLineClassName = useCallback(
    (index, isVirtualized = false) => {
      const padding = 'p-3';
      let base = `${padding} rounded cursor-pointer transition-colors duration-150 select-none `;

      if (index === selectedLine) base += 'bg-blue-400 text-white';
      else if (index === highlightedLineIndex && searchQuery)
        base +=
          'bg-orange-200 text-orange-900 border-2 border-orange-400';
      else
        base += darkMode
          ? 'bg-gray-700 text-gray-100 hover:bg-gray-600'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200';
      return base;
    },
    [selectedLine, highlightedLineIndex, searchQuery, darkMode]
  );

  const renderLine = useCallback(
    (line, index) => {
      if (!line) return null;

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
        return (
          <div className="space-y-1">
            <div className="font-medium">
              {highlightSearchTerm(line.line1, searchQuery)}
            </div>
            {line.line2 && (
              <div
                className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}
              >
                {highlightSearchTerm(line.line2, searchQuery)}
              </div>
            )}
          </div>
        );
      }

      return highlightSearchTerm(line, searchQuery);
    },
    [darkMode, searchQuery]
  );

  const rowPropsData = useMemo(
    () => ({
      lyrics,
      getLineClassName,
      renderLine,
      handleLineClick,
    }),
    [lyrics, getLineClassName, renderLine, handleLineClick]
  );

  // Virtualized row renderer
  const Row = useCallback(
    ({ index, style, lyrics, getLineClassName, renderLine, handleLineClick }) => {
      const line = lyrics[index];
      if (!line) return null;

      const heightValue = style?.height;
      const adjustedStyle = {
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

      return (
        <div data-line-index={index} style={adjustedStyle}>
          <div
            className={getLineClassName(index, true)}
            onClick={() => handleLineClick(index)}
          >
            {renderLine(line, index)}
          </div>
        </div>
      );
    },
    []
  );

  useEffect(() => {
    const handleScrollToLine = (event) => {
      const { lineIndex } = event.detail;
      if (lineIndex == null) return;

      if (lyrics.length > VIRTUALIZATION_THRESHOLD) {
        if (listRef.current) {
          listRef.current.scrollToRow({
            index: lineIndex,
            align: 'center',
            behavior: 'smooth'
          });
        }
      } else {
        setTimeout(() => {
          const target = document.querySelector(`[data-line-index="${lineIndex}"]`);
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 50);
      }
    };

    window.addEventListener('scroll-to-lyric-line', handleScrollToLine);
    return () => window.removeEventListener('scroll-to-lyric-line', handleScrollToLine);
  }, [lyrics.length]);

  const itemCount = useMemo(() => lyrics.length, [lyrics]);
  const useVirtualized = itemCount > VIRTUALIZATION_THRESHOLD;

  // Classic render
  if (!useVirtualized) {
    return (
      <div className="space-y-2 py-4">
        {lyrics.map((line, i) => (
          <div key={line?.id || `line_${i}`} className="px-4">
            <div
              data-line-index={i}
              className={`${getLineClassName(i)} relative`}
              onClick={() => handleLineClick(i)}
              onMouseEnter={() => setHoveredLineIndex(i)}
              onMouseLeave={() => setHoveredLineIndex(null)}
            >
              {renderLine(line, i)}

              {/* Split button for normal groups */}
              {line?.type === 'normal-group' && hoveredLineIndex === i && (
                <button
                  onClick={(e) => handleSplitGroup(e, i)}
                  onMouseEnter={() => setHoveredButtonIndex(i)}
                  onMouseLeave={() => setHoveredButtonIndex(null)}
                  className={`absolute top-1.5 right-1.5 rounded shadow-sm flex items-center transition-all duration-200 ease-in-out ${hoveredButtonIndex === i ? 'pl-2 pr-2 py-1.5 gap-1.5' : 'p-1.5'
                    } ${darkMode
                      ? 'bg-gray-800 hover:bg-gray-900 text-gray-100 border border-gray-600'
                      : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300'
                    }`}
                  title="Split group into separate lines"
                >
                  <Ungroup className="w-3.5 h-3.5 flex-shrink-0" />
                  <span
                    className={`text-xs font-medium whitespace-nowrap overflow-hidden transition-all duration-200 ease-in-out ${hoveredButtonIndex === i
                      ? 'max-w-[60px] opacity-100 ml-0'
                      : 'max-w-0 opacity-0'
                      }`}
                  >
                    Ungroup
                  </span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Virtualized render
  return (
    <div className="flex-1 min-h-0 w-full h-full">
      <List
        listRef={listRef}
        rowCount={itemCount}
        rowHeight={rowHeightConfig}
        rowComponent={Row}
        rowProps={rowPropsData}
        style={{
          overflowY: 'auto',
          height: '100%',
          width: '100%',
          paddingTop: `${HORIZONTAL_PADDING_PX}px`,
          paddingBottom: `${HORIZONTAL_PADDING_PX}px`,
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}