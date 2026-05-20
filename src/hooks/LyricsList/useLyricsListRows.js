import { useCallback, useMemo } from 'react';
import { useDynamicRowHeight } from 'react-window';
import { STRUCTURE_TAG_PATTERNS } from '../../../shared/lyricsParsing.js';
import { DEFAULT_ROW_HEIGHT, ROW_GAP } from '../../components/LyricsList/layout';

export default function useLyricsListRows({
  lyrics,
  lyricsSections,
  lineToSection,
  selectedLine,
  maxLinesPerGroup,
  highlightedLineIndex,
  searchQuery,
  darkMode,
}) {
  const isStructureTagLine = useCallback((line) => {
    if (!line || typeof line !== 'string') return false;
    const trimmed = line.trim();
    if (!trimmed) return false;
    return STRUCTURE_TAG_PATTERNS.some((pattern) => pattern.test(trimmed));
  }, []);

  const effectiveMaxLinesPerGroup = useMemo(() => {
    const parsed = parseInt(maxLinesPerGroup, 10);
    if (!Number.isFinite(parsed)) return 2;
    return Math.max(2, Math.min(12, parsed));
  }, [maxLinesPerGroup]);

  const getNormalGroupLines = useCallback((line) => {
    if (typeof line === 'string') return [line];
    if (line?.type !== 'normal-group') return [];
    if (Array.isArray(line.lines) && line.lines.length > 0) {
      return line.lines.filter((entry) => typeof entry === 'string' && entry.trim().length > 0);
    }
    return [line.line1, line.line2].filter((entry) => typeof entry === 'string' && entry.trim().length > 0);
  }, []);

  const sectionById = useMemo(() => {
    const map = new Map();
    (lyricsSections || []).forEach((section) => {
      if (section?.id) {
        map.set(section.id, section);
      }
    });
    return map;
  }, [lyricsSections]);

  const sectionStartLookup = useMemo(() => {
    const map = new Map();
    (lyricsSections || []).forEach((section) => {
      if (section && Number.isInteger(section.startLine)) {
        map.set(section.startLine, section.id);
      }
    });
    return map;
  }, [lyricsSections]);

  const activeSectionId = useMemo(() => {
    if (selectedLine == null) return null;
    return lineToSection[selectedLine] || null;
  }, [lineToSection, selectedLine]);

  const dynamicRowHeight = useDynamicRowHeight({
    defaultRowHeight: DEFAULT_ROW_HEIGHT,
    key: lyrics.length,
  });

  const getInitialRowHeight = useCallback((index) => {
    const line = lyrics[index];
    if (!line) return DEFAULT_ROW_HEIGHT;

    if (isStructureTagLine(line)) {
      return 8;
    }

    const hasSectionHeader = sectionStartLookup.has(index);

    if (line.type === 'group') {
      let height = 48;

      if (line.translation) {
        height += 24;
      }
      if (hasSectionHeader) height += 24;
      return height;
    }

    if (line.type === 'normal-group') {
      const lineCount = Math.max(2, getNormalGroupLines(line).length || 2);
      let height = 48 + (Math.max(0, lineCount - 1) * 24);
      if (hasSectionHeader) height += 24;
      return height;
    }

    return DEFAULT_ROW_HEIGHT + (hasSectionHeader ? 24 : 0);
  }, [getNormalGroupLines, isStructureTagLine, lyrics, sectionStartLookup]);

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

  const getLineClassName = useCallback(
    (index, isVirtualized = false, isMultiSelected = false) => {
      const padding = 'p-3';
      let base = `${padding} rounded cursor-pointer transition-colors duration-150 select-none `;

      if (index === selectedLine) base += 'bg-blue-400 text-white';
      else if (index === highlightedLineIndex && searchQuery)
        base += 'bg-orange-200 text-orange-900 border-2 border-orange-400';
      else if (isMultiSelected)
        base += darkMode
          ? 'bg-blue-900/30 text-blue-50 ring-2 ring-blue-400/80'
          : 'bg-blue-50 text-blue-900 ring-2 ring-blue-400/80';
      else
        base += darkMode
          ? 'bg-gray-700 text-gray-100 hover:bg-gray-600'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200';
      return base;
    },
    [selectedLine, highlightedLineIndex, searchQuery, darkMode]
  );

  return {
    isStructureTagLine,
    effectiveMaxLinesPerGroup,
    getNormalGroupLines,
    sectionById,
    sectionStartLookup,
    activeSectionId,
    rowHeightConfig,
    getLineClassName,
  };
}
