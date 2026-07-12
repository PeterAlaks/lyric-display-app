import { useEffect } from 'react';
import { hasValidTimestamps } from '../../utils/timestampHelpers';
import { findNavigableLyricLineIndex } from '../../utils/lyricLineNavigation';
import { dispatchCommand, isCommandFocusProtected } from '../../../shared/commandSafetyPolicy.js';

const dispatchKeyboardCommand = (event, action, execute) => dispatchCommand({
  action,
  source: 'keyboard',
  focusTarget: event?.target,
  fallbackFocusTarget: typeof document !== 'undefined' ? document.activeElement : null,
  enforceFocus: true,
  execute,
});

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
  handleNavigateSetlistNext,
  handleOpenPreferences,
  availableOutputIds,
  skipSectionTitlesOnKeyboard = true
}) => {

  useEffect(() => {
    const handleGlobalKeyDown = (event) => {
      const activeElement = document.activeElement;
      const isTyping = isCommandFocusProtected(event.target, activeElement);
      if (isTyping) return;

      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && (event.key === 'o' || event.key === 'O')) {
        event.preventDefault();
        handleOpenFileDialog?.();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && (event.key === 'n' || event.key === 'N')) {
        event.preventDefault();
        handleCreateNewSong?.();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && (event.key === 'e' || event.key === 'E')) {
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

      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && (event.key === 'i' || event.key === 'I')) {
        event.preventDefault();
        handleOpenPreferences?.();
        return;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleOpenSetlist, handleOpenOnlineLyricsSearch, handleOpenFileDialog, handleCreateNewSong, handleEditLyrics, hasLyrics, handleAddToSetlist, handleNavigateSetlistPrevious, handleNavigateSetlistNext, handleOpenPreferences]);

  useEffect(() => {
    if (!hasLyrics) return;

    const handleKeyDown = (event) => {
      const activeElement = document.activeElement;
      const isTyping = isCommandFocusProtected(event.target, activeElement);

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

      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        const searchInput = document.querySelector('[data-search-input]');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && (event.key === 'c' || event.key === 'C')) {
        const dispatched = dispatchKeyboardCommand(event, 'clear-output', handleClearOutput);
        if (dispatched.executed) event.preventDefault();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && (event.key === 'p' || event.key === 'P')) {
        const useIntelligentAutoplay = event.shiftKey && hasValidTimestamps(lyricsTimestamps);
        const action = useIntelligentAutoplay ? 'toggle-intelligent-autoplay' : 'toggle-autoplay';
        const execute = useIntelligentAutoplay ? handleIntelligentAutoplayToggle : handleAutoplayToggle;
        const dispatched = dispatchKeyboardCommand(event, action, execute);
        if (dispatched.executed) event.preventDefault();
        return;
      }

      if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        if (event.key === '0') {
          event.preventDefault();
          handleOutputTabSwitch('stage');
          return;
        }

        if (/^[1-9]$/.test(event.key)) {
          const outputIds = Array.isArray(availableOutputIds) ? availableOutputIds : [];
          const targetOutput = `output${event.key}`;
          if (outputIds.includes(targetOutput)) {
            event.preventDefault();
            handleOutputTabSwitch(targetOutput);
          }
          return;
        }
      }

      if (event.key === ' ' || event.code === 'Space') {
        const dispatched = dispatchKeyboardCommand(event, 'toggle-output', handleToggle);
        if (dispatched.executed) event.preventDefault();
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
          newIndex = findNavigableLyricLineIndex(lyrics, 0, 1, { skipSectionTitles: skipSectionTitlesOnKeyboard });
        } else if (isEnd) {
          newIndex = findNavigableLyricLineIndex(lyrics, lyrics.length - 1, -1, { skipSectionTitles: skipSectionTitlesOnKeyboard });
        } else if (isUpArrow) {
          const startIndex = currentIndex > 0 ? currentIndex - 1 : 0;
          newIndex = findNavigableLyricLineIndex(lyrics, startIndex, -1, { skipSectionTitles: skipSectionTitlesOnKeyboard });
        } else {
          const startIndex = currentIndex < lyrics.length - 1 ? currentIndex + 1 : lyrics.length - 1;
          newIndex = findNavigableLyricLineIndex(lyrics, startIndex, 1, { skipSectionTitles: skipSectionTitlesOnKeyboard });
        }

        if (newIndex !== null && newIndex !== currentIndex) {
          dispatchKeyboardCommand(event, 'select-line', () => {
            handleLineSelect(newIndex);
            window.dispatchEvent(new CustomEvent('scroll-to-lyric-line', {
              detail: { lineIndex: newIndex }
            }));
          });
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
    handleOpenOnlineLyricsSearch,
    availableOutputIds,
    skipSectionTitlesOnKeyboard
  ]);
};
