import { useEffect } from 'react';
import { hasValidTimestamps } from '../../utils/timestampHelpers';
import { findNavigableLyricLineIndex } from '../../utils/parseLyrics';
import useLyricsStore from '../../context/LyricsStore';
import {
  getLiveNavigationKeyAction,
  getSectionJumpHotkey,
  isAutoplayKeyboardShortcut,
} from '../../constants/shortcuts';
import { findSectionJumpTarget } from '../../../shared/lyricsParsing/sections.js';
import {
  dispatchCommand,
  isCommandFocusProtected,
  isModalFocusProtected,
  isTextEditingFocusProtected,
  resolveCopyShortcutAction,
} from '../../../shared/commandSafetyPolicy.js';

const dispatchKeyboardCommand = (event, action, execute, enforceFocus = true) => dispatchCommand({
  action,
  source: 'keyboard',
  focusTarget: event?.target,
  fallbackFocusTarget: typeof document !== 'undefined' ? document.activeElement : null,
  enforceFocus,
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
  handleOpenNativeFileDialog,
  handleOpenTimerControl,
  handleOpenProjectOutput,
  handleCreateNewSong,
  handleEditLyrics,
  handleAddToSetlist,
  handleNavigateSetlistPrevious,
  handleNavigateSetlistNext,
  handleOpenPreferences,
  availableOutputIds,
  skipSectionTitlesOnKeyboard = true
}) => {
  const sectionTagPhrases = useLyricsStore(
    (state) => state.lyricsParsingOptions.groupingConfig.sectionTagPhrases,
  );
  const lyricsSections = useLyricsStore((state) => state.lyricsSections);

  useEffect(() => {
    const handleGlobalKeyDown = (event) => {
      const activeElement = document.activeElement;
      if (isModalFocusProtected(event.target, activeElement)) return;

      if ((event.ctrlKey || event.metaKey) && event.altKey && !event.shiftKey && (event.key === 'o' || event.key === 'O')) {
        event.preventDefault();
        handleOpenNativeFileDialog?.();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && (event.key === 'o' || event.key === 'O')) {
        event.preventDefault();
        handleOpenFileDialog?.();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && (event.key === 't' || event.key === 'T')) {
        event.preventDefault();
        handleOpenTimerControl?.();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.altKey && !event.shiftKey && (event.key === 'p' || event.key === 'P')) {
        event.preventDefault();
        handleOpenProjectOutput?.();
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
  }, [handleOpenSetlist, handleOpenOnlineLyricsSearch, handleOpenFileDialog, handleOpenNativeFileDialog, handleOpenTimerControl, handleOpenProjectOutput, handleCreateNewSong, handleEditLyrics, hasLyrics, handleAddToSetlist, handleNavigateSetlistPrevious, handleNavigateSetlistNext, handleOpenPreferences]);

  useEffect(() => {
    if (!hasLyrics) return;

    const handleKeyDown = (event) => {
      const activeElement = document.activeElement;
      const isEditingText = isTextEditingFocusProtected(event.target, activeElement);
      const isModalFocused = isModalFocusProtected(event.target, activeElement);

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

      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        if (isModalFocused) return;
        event.preventDefault();
        const searchInput = document.querySelector('[data-search-input]');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && (event.key === 'c' || event.key === 'C')) {
        if (isEditingText || isModalFocused) return;
        const copyAction = resolveCopyShortcutAction({
          hasTextSelection: Boolean(window.getSelection?.()?.toString().trim()),
        });
        if (copyAction === 'native-copy') return;
        const dispatched = dispatchKeyboardCommand(event, 'clear-output', handleClearOutput, false);
        if (dispatched.executed) event.preventDefault();
        return;
      }

      if (isAutoplayKeyboardShortcut(event)) {
        if (isModalFocused) return;
        const useIntelligentAutoplay = event.shiftKey && hasValidTimestamps(lyricsTimestamps);
        const action = useIntelligentAutoplay ? 'toggle-intelligent-autoplay' : 'toggle-autoplay';
        const execute = useIntelligentAutoplay ? handleIntelligentAutoplayToggle : handleAutoplayToggle;
        const dispatched = dispatchKeyboardCommand(event, action, execute, false);
        if (dispatched.executed) event.preventDefault();
        return;
      }

      if (isCommandFocusProtected(event.target, activeElement)) return;

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

      const cueLine = (lineIndex) => {
        dispatchKeyboardCommand(event, 'select-line', () => {
          handleLineSelect(lineIndex);
          window.dispatchEvent(new CustomEvent('scroll-to-lyric-line', {
            detail: { lineIndex }
          }));
        });
      };

      const sectionHotkey = getSectionJumpHotkey(event);
      if (sectionHotkey) {
        const target = findSectionJumpTarget(lyricsSections, selectedLine, sectionHotkey);
        if (target) {
          event.preventDefault();
          cueLine(target.startLine);
        }
        return;
      }

      const action = getLiveNavigationKeyAction(event);
      if (!action) return;

      if (action === 'toggle-output') {
        const dispatched = dispatchKeyboardCommand(event, 'toggle-output', handleToggle);
        if (dispatched.executed) event.preventDefault();
        return;
      }

      event.preventDefault();

      const currentIndex = selectedLine ?? -1;
      const navigationOptions = { skipSectionTitles: skipSectionTitlesOnKeyboard, sectionTagPhrases };
      let newIndex;

      if (action === 'first') {
        newIndex = findNavigableLyricLineIndex(lyrics, 0, 1, navigationOptions);
      } else if (action === 'last') {
        newIndex = findNavigableLyricLineIndex(lyrics, lyrics.length - 1, -1, navigationOptions);
      } else if (action === 'previous') {
        const startIndex = currentIndex > 0 ? currentIndex - 1 : 0;
        newIndex = findNavigableLyricLineIndex(lyrics, startIndex, -1, navigationOptions);
      } else {
        const startIndex = currentIndex < lyrics.length - 1 ? currentIndex + 1 : lyrics.length - 1;
        newIndex = findNavigableLyricLineIndex(lyrics, startIndex, 1, navigationOptions);
      }

      if (newIndex !== null && newIndex !== currentIndex) {
        cueLine(newIndex);
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
    lyricsSections,
    sectionTagPhrases,
    skipSectionTitlesOnKeyboard
  ]);
};
