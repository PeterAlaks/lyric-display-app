import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const useCanvasSearch = ({ content, setContent, textareaRef }) => {
  const [searchBarVisible, setSearchBarVisible] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceValue, setReplaceValue] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  const searchInputRef = useRef(null);
  const replaceInputRef = useRef(null);
  const pendingFocusIndexRef = useRef(null);

  const findMatchesInText = useCallback((text) => {
    if (!searchQuery.trim()) return [];
    const lowerText = text.toLowerCase();
    const lowerQuery = searchQuery.toLowerCase();
    const matches = [];
    let cursor = 0;

    while (cursor < lowerText.length) {
      const start = lowerText.indexOf(lowerQuery, cursor);
      if (start === -1) break;
      matches.push({ start, end: start + searchQuery.length });
      cursor = start + lowerQuery.length;
    }

    return matches;
  }, [searchQuery]);

  const matches = useMemo(() => findMatchesInText(content), [content, findMatchesInText]);
  const totalMatches = matches.length;

  useEffect(() => {
    if (searchBarVisible && searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.select?.();
    }
  }, [searchBarVisible]);

  useEffect(() => {
    if (searchExpanded && replaceInputRef.current) {
      replaceInputRef.current.focus();
    }
  }, [searchExpanded]);

  useEffect(() => {
    if (!searchBarVisible || !searchQuery.trim()) return;

    if (totalMatches === 0) {
      setCurrentMatchIndex(0);
      return;
    }

    const desiredIndex = pendingFocusIndexRef.current !== null
      ? pendingFocusIndexRef.current
      : currentMatchIndex;
    const clamped = Math.max(0, Math.min(desiredIndex, totalMatches - 1));

    if (clamped !== currentMatchIndex) {
      setCurrentMatchIndex(clamped);
      pendingFocusIndexRef.current = clamped;
      return;
    }

    pendingFocusIndexRef.current = null;
  }, [currentMatchIndex, searchBarVisible, searchQuery, totalMatches]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setCurrentMatchIndex(0);
      return;
    }
    if (totalMatches > 0 && currentMatchIndex > totalMatches - 1) {
      setCurrentMatchIndex(0);
    }
  }, [currentMatchIndex, searchQuery, totalMatches]);

  const openSearchBar = useCallback((expand = false) => {
    setSearchBarVisible(true);
    setSearchExpanded((prev) => prev || expand);
    pendingFocusIndexRef.current = 0;
    requestAnimationFrame(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
        searchInputRef.current.select?.();
      }
    });
  }, []);

  const openReplaceBar = useCallback(() => {
    if (searchBarVisible) {
      setSearchExpanded(true);
      requestAnimationFrame(() => {
        replaceInputRef.current?.focus();
        replaceInputRef.current?.select?.();
      });
      return;
    }

    setSearchBarVisible(true);
    setSearchExpanded(true);
    pendingFocusIndexRef.current = 0;
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select?.();
    });
  }, [searchBarVisible]);

  const closeSearchBar = useCallback(() => {
    setSearchBarVisible(false);
    setSearchExpanded(false);
  }, []);

  const toggleSearchExpansion = useCallback(() => {
    setSearchExpanded((prev) => {
      const next = !prev;
      if (next) {
        requestAnimationFrame(() => {
          replaceInputRef.current?.focus();
        });
      }
      return next;
    });
    setSearchBarVisible(true);
  }, []);

  const handleSearchInputChange = useCallback((value) => {
    setSearchQuery(value);
    pendingFocusIndexRef.current = 0;
  }, []);

  const handleReplaceValueChange = useCallback((value) => {
    setReplaceValue(value);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setCurrentMatchIndex(0);
    pendingFocusIndexRef.current = null;
  }, []);

  const handleNextMatch = useCallback(() => {
    if (totalMatches === 0) return;
    const nextIndex = currentMatchIndex >= totalMatches - 1 ? 0 : currentMatchIndex + 1;
    pendingFocusIndexRef.current = nextIndex;
    setCurrentMatchIndex(nextIndex);
  }, [currentMatchIndex, totalMatches]);

  const handlePreviousMatch = useCallback(() => {
    if (totalMatches === 0) return;
    const prevIndex = currentMatchIndex <= 0 ? totalMatches - 1 : currentMatchIndex - 1;
    pendingFocusIndexRef.current = prevIndex;
    setCurrentMatchIndex(prevIndex);
  }, [currentMatchIndex, totalMatches]);

  useEffect(() => {
    if (!searchBarVisible) return;
    const handleKeyDown = (event) => {
      if (!searchQuery.trim() || totalMatches === 0) return;
      if (!event.shiftKey) return;
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        handlePreviousMatch();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        handleNextMatch();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextMatch, handlePreviousMatch, searchBarVisible, searchQuery, totalMatches]);

  const handleReplaceCurrent = useCallback(() => {
    if (!searchQuery.trim() || matches.length === 0) return;

    const safeIndex = Math.max(0, Math.min(currentMatchIndex, matches.length - 1));
    const match = matches[safeIndex];
    const updatedContent = `${content.slice(0, match.start)}${replaceValue}${content.slice(match.end)}`;
    const updatedMatches = findMatchesInText(updatedContent);
    const nextIndex = updatedMatches.length === 0
      ? 0
      : Math.min(safeIndex, updatedMatches.length - 1);
    const caret = match.start + replaceValue.length;
    const scrollTop = textareaRef.current?.scrollTop ?? null;

    pendingFocusIndexRef.current = nextIndex;
    setCurrentMatchIndex(nextIndex);
    setContent(updatedContent, {
      selectionStart: caret,
      selectionEnd: caret,
      scrollTop,
      timestamp: Date.now(),
      coalesceKey: 'replace'
    });
  }, [content, currentMatchIndex, findMatchesInText, matches, replaceValue, searchQuery, setContent, textareaRef]);

  const handleReplaceAll = useCallback(() => {
    if (!searchQuery.trim() || matches.length === 0) return;

    let updatedContent = '';
    let lastIndex = 0;

    matches.forEach((match) => {
      updatedContent += `${content.slice(lastIndex, match.start)}${replaceValue}`;
      lastIndex = match.end;
    });

    updatedContent += content.slice(lastIndex);

    const caret = updatedContent.length;
    const scrollTop = textareaRef.current?.scrollTop ?? null;

    pendingFocusIndexRef.current = 0;
    setCurrentMatchIndex(0);
    setContent(updatedContent, {
      selectionStart: caret,
      selectionEnd: caret,
      scrollTop,
      timestamp: Date.now(),
      coalesceKey: 'replace'
    });
  }, [content, matches, replaceValue, searchQuery, setContent, textareaRef]);

  return {
    closeSearchBar,
    currentMatchIndex,
    handleClearSearch,
    handleNextMatch,
    handlePreviousMatch,
    handleReplaceAll,
    handleReplaceCurrent,
    handleReplaceValueChange,
    handleSearchInputChange,
    openReplaceBar,
    openSearchBar,
    replaceInputRef,
    replaceValue,
    matches,
    searchBarVisible,
    searchExpanded,
    searchInputRef,
    searchQuery,
    toggleSearchExpansion,
    totalMatches,
  };
};

export default useCanvasSearch;