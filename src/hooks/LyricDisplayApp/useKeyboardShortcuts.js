import { useEffect } from 'react';
import { hasValidTimestamps } from '../../utils/timestampHelpers';

export const useKeyboardShortcuts = ({
  hasLyrics,
  lyrics,
  lyricsTimestamps,
  selectedLine,
  handleLineSelect,
  handleToggle,
  handleAutoplayToggle,
  handleIntelligentAutoplayToggle,
  handleClearOutput,
  handleOutputTabSwitch,
  searchQuery,
  clearSearch,
  totalMatches,
  highlightedLineIndex,
  handleOpenSetlist,
  handleOpenOnlineLyricsSearch,
  handleOpenFileDialog,
  handleCreateNewSong,
  handleEditLyrics,
  handleAddToSetlist,
  handleNavigateSetlistPrevious,
  handleNavigateSetlistNext
}) => {

  useEffect(() => {
    const handleGlobalKeyDown = (event) => {
      const activeElement = document.activeElement;
      const isTyping = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable
      );

      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && (event.key === 'o' || event.key === 'O')) {
        if (isTyping) return;
        event.preventDefault();
        handleOpenFileDialog?.();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && (event.key === 'n' || event.key === 'N')) {
        if (isTyping) return;
        event.preventDefault();
        handleCreateNewSong?.();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && (event.key === 'e' || event.key === 'E')) {
        if (isTyping) return;
        if (!hasLyrics) return;
        event.preventDefault();
        handleEditLyrics?.();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === 's' || event.key === 'S')) {
        event.preventDefault();
        handleOpenSetlist?.();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === 'o' || event.key === 'O')) {
        event.preventDefault();
        handleOpenOnlineLyricsSearch?.();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.altKey && !event.shiftKey && (event.key === 's' || event.key === 'S')) {
        if (isTyping) return;
        event.preventDefault();
        handleAddToSetlist?.();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'ArrowLeft') {
        event.preventDefault();
        handleNavigateSetlistPrevious?.();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'ArrowRight') {
        event.preventDefault();
        handleNavigateSetlistNext?.();
        return;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleOpenSetlist, handleOpenOnlineLyricsSearch, handleOpenFileDialog, handleCreateNewSong, handleEditLyrics, hasLyrics, handleAddToSetlist, handleNavigateSetlistPrevious, handleNavigateSetlistNext]);

  useEffect(() => {
    if (!hasLyrics) return;

    const handleKeyDown = (event) => {
      const activeElement = document.activeElement;
      const isTyping = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable
      );

      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        const searchInput = document.querySelector('[data-search-input]');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && (event.key === 'p' || event.key === 'P')) {
        event.preventDefault();
        if (event.shiftKey && hasValidTimestamps(lyricsTimestamps)) {
          handleIntelligentAutoplayToggle();
        } else {
          handleAutoplayToggle();
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && (event.key === 'c' || event.key === 'C')) {
        if (isTyping) return;
        event.preventDefault();
        handleClearOutput();
        return;
      }

      if (event.key === 'Escape') {
        if (searchQuery) {
          event.preventDefault();
          clearSearch();
          if (activeElement && activeElement.hasAttribute('data-search-input')) {
            activeElement.blur();
          }
        }
        return;
      }

      if (event.key === 'Enter' && activeElement && activeElement.hasAttribute('data-search-input')) {
        event.preventDefault();
        if (totalMatches > 0 && highlightedLineIndex !== null) {
          handleLineSelect(highlightedLineIndex);
          window.dispatchEvent(new CustomEvent('scroll-to-lyric-line', {
            detail: { lineIndex: highlightedLineIndex }
          }));
        }
        return;
      }

      if (isTyping) return;

      if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        if (event.key === '1') {
          event.preventDefault();
          handleOutputTabSwitch('output1');
          return;
        }
        if (event.key === '2') {
          event.preventDefault();
          handleOutputTabSwitch('output2');
          return;
        }
        if (event.key === '3') {
          event.preventDefault();
          handleOutputTabSwitch('stage');
          return;
        }
      }

      if (event.key === ' ' || event.code === 'Space') {
        event.preventDefault();
        handleToggle();
        return;
      }

      const isUpArrow = event.key === 'ArrowUp' || event.keyCode === 38;
      const isDownArrow = event.key === 'ArrowDown' || event.keyCode === 40;
      const isHome = event.key === 'Home';
      const isEnd = event.key === 'End';

      if (isUpArrow || isDownArrow || isHome || isEnd) {
        event.preventDefault();

        const currentIndex = selectedLine ?? -1;
        let newIndex;

        if (isHome) {
          newIndex = 0;
        } else if (isEnd) {
          newIndex = lyrics.length - 1;
        } else if (isUpArrow) {
          newIndex = currentIndex > 0 ? currentIndex - 1 : 0;
        } else {
          newIndex = currentIndex < lyrics.length - 1 ? currentIndex + 1 : lyrics.length - 1;
        }

        if (newIndex !== currentIndex) {
          handleLineSelect(newIndex);
          window.dispatchEvent(new CustomEvent('scroll-to-lyric-line', {
            detail: { lineIndex: newIndex }
          }));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    hasLyrics,
    lyrics,
    lyricsTimestamps,
    selectedLine,
    handleLineSelect,
    handleToggle,
    handleAutoplayToggle,
    handleIntelligentAutoplayToggle,
    handleClearOutput,
    handleOutputTabSwitch,
    searchQuery,
    clearSearch,
    totalMatches,
    highlightedLineIndex,
    handleOpenSetlist,
    handleOpenOnlineLyricsSearch
  ]);
};