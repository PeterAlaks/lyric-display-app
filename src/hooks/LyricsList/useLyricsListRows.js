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
  density = 'default',
}) {
  const compact = density === 'dock' || density === 'compact';
  const baseRowHeight = compact ? 38 : DEFAULT_ROW_HEIGHT;
  const rowGap = compact ? 4 : ROW_GAP;

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
    defaultRowHeight: baseRowHeight,
    key: lyrics.length,
  });

  const getInitialRowHeight = useCallback((index) => {
    const line = lyrics[index];
    if (!line) return baseRowHeight;

    if (isStructureTagLine(line)) {
      return compact ? 4 : 8;
    }

    const hasSectionHeader = sectionStartLookup.has(index);

    if (line.type === 'group') {
      let height = compact ? 38 : 48;

      if (line.translation) {
        height += compact ? 18 : 24;
      }
      if (hasSectionHeader) height += compact ? 18 : 24;
      return height;
    }

    if (line.type === 'normal-group') {
      const lineCount = Math.max(2, getNormalGroupLines(line).length || 2);
      let height = (compact ? 38 : 48) + (Math.max(0, lineCount - 1) * (compact ? 18 : 24));
      if (hasSectionHeader) height += compact ? 18 : 24;
      return height;
    }

    return baseRowHeight + (hasSectionHeader ? (compact ? 18 : 24) : 0);
  }, [baseRowHeight, compact, getNormalGroupLines, isStructureTagLine, lyrics, sectionStartLookup]);

  const rowHeightConfig = useMemo(() => ({
    ...dynamicRowHeight,
    getAverageRowHeight: () => {
      const averageContentHeight =
        dynamicRowHeight.getAverageRowHeight?.() ?? baseRowHeight;
      return averageContentHeight + rowGap;
    },
    getRowHeight: (index) => {
      const measured = dynamicRowHeight.getRowHeight?.(index);
      const contentHeight = measured ?? getInitialRowHeight(index);
      return contentHeight + rowGap;
    },
    observeRowElements: (elements) => {
      const cleanup = dynamicRowHeight.observeRowElements?.(elements);
      return typeof cleanup === 'function' ? cleanup : () => { };
    },
  }), [baseRowHeight, dynamicRowHeight, getInitialRowHeight, rowGap]);

  const getLineClassName = useCallback(
    (index, isVirtualized = false, isMultiSelected = false) => {
      const padding = compact ? 'px-2.5 py-2' : 'p-3';
      let base = `${padding} ${compact ? 'rounded-md border text-[13px] leading-snug' : 'rounded'} cursor-pointer transition-colors duration-150 select-none `;

      if (compact && darkMode) {
        if (index === selectedLine) {
          return `${base}border-blue-400 bg-blue-400 text-white shadow-sm`;
        }
        if (index === highlightedLineIndex && searchQuery) {
          return `${base}border-amber-400/70 bg-amber-500/15 text-amber-100 ring-1 ring-amber-500/25`;
        }
        if (isMultiSelected) {
          return `${base}border-blue-400/70 bg-blue-900/35 text-blue-50 ring-1 ring-blue-400/40`;
        }
        return `${base}border-gray-800 bg-gray-900/80 text-gray-200 hover:border-gray-700 hover:bg-gray-800/90`;
      }

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
    [compact, selectedLine, highlightedLineIndex, searchQuery, darkMode]
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
