import React from 'react';
import { getLineSearchText } from '../utils/parseLyrics';

const useSearch = (lyrics) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [highlightedLineIndex, setHighlightedLineIndex] = React.useState(null);
  const [currentMatchIndex, setCurrentMatchIndex] = React.useState(0);
  const [totalMatches, setTotalMatches] = React.useState(0);
  const [allMatchIndices, setAllMatchIndices] = React.useState([]);

  const containerRef = React.useRef(null);

  const findAllMatches = React.useCallback((query) => {
    if (!query.trim() || !lyrics || lyrics.length === 0) return [];
    const matchIndices = [];
    lyrics.forEach((line, index) => {
      const text = getLineSearchText(line);
      if (text.toLowerCase().includes(query.toLowerCase())) matchIndices.push(index);
    });
    return matchIndices;
  }, [lyrics]);

  const scrollToLine = React.useCallback((lineIndex) => {
    setTimeout(() => {
      const container = containerRef.current;
      if (!container) return;
      const lineElements = container.querySelectorAll('[data-line-index]');
      const target = lineElements[lineIndex];
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }, []);

  const navigateToMatch = React.useCallback((matchIndex) => {
    if (allMatchIndices.length === 0) return;
    const clamped = Math.max(0, Math.min(matchIndex, allMatchIndices.length - 1));
    const lineIndex = allMatchIndices[clamped];
    setCurrentMatchIndex(clamped);
    setHighlightedLineIndex(lineIndex);
    scrollToLine(lineIndex);
  }, [allMatchIndices, scrollToLine]);

  const navigateToNextMatch = React.useCallback(() => {
    if (allMatchIndices.length === 0) return;
    const nextIndex = currentMatchIndex >= allMatchIndices.length - 1 ? 0 : currentMatchIndex + 1;
    navigateToMatch(nextIndex);
  }, [allMatchIndices, currentMatchIndex, navigateToMatch]);

  const navigateToPreviousMatch = React.useCallback(() => {
    if (allMatchIndices.length === 0) return;
    const prevIndex = currentMatchIndex <= 0 ? allMatchIndices.length - 1 : currentMatchIndex - 1;
    navigateToMatch(prevIndex);
  }, [allMatchIndices, currentMatchIndex, navigateToMatch]);

  const handleSearch = React.useCallback((query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setHighlightedLineIndex(null);
      setCurrentMatchIndex(0);
      setTotalMatches(0);
      setAllMatchIndices([]);
      return;
    }
    const matchIndices = findAllMatches(query);
    setAllMatchIndices(matchIndices);
    setTotalMatches(matchIndices.length);
    if (matchIndices.length > 0) {
      setCurrentMatchIndex(0);
      setHighlightedLineIndex(matchIndices[0]);
      scrollToLine(matchIndices[0]);
    } else {
      setHighlightedLineIndex(null);
      setCurrentMatchIndex(0);
    }
  }, [findAllMatches, scrollToLine]);

  const clearSearch = React.useCallback(() => {
    setSearchQuery('');
    setHighlightedLineIndex(null);
    setCurrentMatchIndex(0);
    setTotalMatches(0);
    setAllMatchIndices([]);
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.shiftKey && searchQuery && allMatchIndices.length > 0) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          navigateToPreviousMatch();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          navigateToNextMatch();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery, allMatchIndices, navigateToNextMatch, navigateToPreviousMatch]);

  return {
    containerRef,
    searchQuery,
    highlightedLineIndex,
    currentMatchIndex,
    totalMatches,
    allMatchIndices,
    handleSearch,
    clearSearch,
    navigateToNextMatch,
    navigateToPreviousMatch,
  };
};

export default useSearch;

