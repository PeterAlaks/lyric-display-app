// Project: LyricDisplay App
// File: src/components/LyricsList.jsx

import React, { useCallback, useEffect, useMemo } from 'react';
import { List, useDynamicRowHeight, useListRef } from 'react-window';
import { useLyricsState, useDarkModeState } from '../hooks/useStoreSelectors';
import useSocket from '../hooks/useSocket';

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
  const { lyrics = [], selectedLine, selectLine } = useLyricsState();
  const { darkMode } = useDarkModeState();
  const { emitLineUpdate } = useSocket();


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
              className={getLineClassName(i)}
              onClick={() => handleLineClick(i)}
            >
              {renderLine(line, i)}
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