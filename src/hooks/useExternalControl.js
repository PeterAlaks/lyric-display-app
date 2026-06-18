/**
 * useExternalControl Hook
 * Handles MIDI and OSC control actions in the renderer process
 */

import { useEffect, useCallback, useRef } from 'react';

/**
 * Hook to handle external control (MIDI/OSC) actions
 * @param {Object} options - Hook options
 * @param {Array} options.lyrics - Current lyrics array
 * @param {number|null} options.selectedLine - Currently selected line index
 * @param {boolean} options.isOutputOn - Whether output is enabled
 * @param {boolean} options.autoplayActive - Whether autoplay is active
 * @param {boolean} options.intelligentAutoplayActive - Whether timestamp-based autoplay is active
 * @param {Function} options.selectLine - Function to select a line
 * @param {Function} options.setIsOutputOn - Function to toggle output
 * @param {Function} options.emitLineUpdate - Function to emit line update via socket
 * @param {Function} options.emitOutputToggle - Function to emit output toggle via socket
 * @param {Function} options.emitOutput1Toggle - Function to emit output 1 toggle via socket (optional)
 * @param {Function} options.emitOutput2Toggle - Function to emit output 2 toggle via socket (optional)
 * @param {Function} options.emitStageToggle - Function to emit stage toggle via socket (optional)
 * @param {Function} options.handleAutoplayToggle - Function to toggle autoplay
 * @param {Function} options.handleIntelligentAutoplayToggle - Function to toggle timestamp-based autoplay
 * @param {Function} options.handleIntelligentAutoplayStart - Function to start timestamp-based autoplay
 * @param {Function} options.handleIntelligentAutoplayStop - Function to stop timestamp-based autoplay
 * @param {Function} options.handleSetlistNext - Function to go to next song in setlist
 * @param {Function} options.handleSetlistPrev - Function to go to previous song in setlist
 * @param {Array} options.setlistFiles - Current setlist items
 * @param {Function} options.emitSetlistLoad - Function to load a setlist item by id
 * @param {Function} options.handleSyncOutputs - Function to sync all outputs
 * @param {Function} options.showToast - Function to show toast notifications
 * @param {string} options.songName - Current song/file name for OSC feedback
 * @param {boolean} options.enabled - Whether external control is enabled
 */
export function resolveSetlistItemIdByIndex(setlistFiles, index) {
  if (!Array.isArray(setlistFiles)) return null;
  if (!Number.isFinite(index)) return null;

  const itemIndex = Math.floor(index);
  if (itemIndex < 0 || itemIndex >= setlistFiles.length) return null;

  return setlistFiles[itemIndex]?.id || null;
}

export function useExternalControl({
  lyrics = [],
  selectedLine,
  isOutputOn,
  autoplayActive,
  intelligentAutoplayActive,
  selectLine,
  setIsOutputOn,
  emitLineUpdate,
  emitOutputToggle,
  emitOutput1Toggle,
  emitOutput2Toggle,
  emitStageToggle,
  handleAutoplayToggle,
  handleIntelligentAutoplayToggle,
  handleIntelligentAutoplayStart,
  handleIntelligentAutoplayStop,
  handleSetlistNext,
  handleSetlistPrev,
  setlistFiles = [],
  emitSetlistLoad,
  handleSyncOutputs,
  showToast,
  songName = '',
  enabled = true
}) {
  const lyricsRef = useRef(lyrics);
  const selectedLineRef = useRef(selectedLine);
  const isOutputOnRef = useRef(isOutputOn);
  const autoplayActiveRef = useRef(autoplayActive);
  const intelligentAutoplayActiveRef = useRef(intelligentAutoplayActive);
  const setlistFilesRef = useRef(setlistFiles);

  // Keep refs updated
  useEffect(() => { lyricsRef.current = lyrics; }, [lyrics]);
  useEffect(() => { selectedLineRef.current = selectedLine; }, [selectedLine]);
  useEffect(() => { isOutputOnRef.current = isOutputOn; }, [isOutputOn]);
  useEffect(() => { autoplayActiveRef.current = autoplayActive; }, [autoplayActive]);
  useEffect(() => { intelligentAutoplayActiveRef.current = intelligentAutoplayActive; }, [intelligentAutoplayActive]);
  useEffect(() => { setlistFilesRef.current = setlistFiles; }, [setlistFiles]);

  /**
   * Handle line selection with bounds checking
   */
  const handleSelectLine = useCallback((lineIndex) => {
    const currentLyrics = lyricsRef.current;
    if (!currentLyrics || currentLyrics.length === 0) return;

    const clampedIndex = Math.max(0, Math.min(lineIndex, currentLyrics.length - 1));
    selectLine(clampedIndex);
    emitLineUpdate(clampedIndex);

    // Scroll to the selected line
    window.dispatchEvent(new CustomEvent('scroll-to-lyric-line', {
      detail: { lineIndex: clampedIndex }
    }));
  }, [selectLine, emitLineUpdate]);

  /**
   * Handle next line action
   */
  const handleNextLine = useCallback(() => {
    const currentLyrics = lyricsRef.current;
    const currentLine = selectedLineRef.current;

    if (!currentLyrics || currentLyrics.length === 0) return;

    const nextIndex = currentLine === null ? 0 : Math.min(currentLine + 1, currentLyrics.length - 1);
    handleSelectLine(nextIndex);
  }, [handleSelectLine]);

  /**
   * Handle previous line action
   */
  const handlePrevLine = useCallback(() => {
    const currentLyrics = lyricsRef.current;
    const currentLine = selectedLineRef.current;

    if (!currentLyrics || currentLyrics.length === 0) return;

    const prevIndex = currentLine === null ? 0 : Math.max(currentLine - 1, 0);
    handleSelectLine(prevIndex);
  }, [handleSelectLine]);

  /**
   * Handle output toggle
   */
  const handleToggleOutput = useCallback(() => {
    const newState = !isOutputOnRef.current;
    setIsOutputOn(newState);
    emitOutputToggle(newState);
  }, [setIsOutputOn, emitOutputToggle]);

  /**
   * Handle set output state
   */
  const handleSetOutput = useCallback((enabled) => {
    setIsOutputOn(enabled);
    emitOutputToggle(enabled);
  }, [setIsOutputOn, emitOutputToggle]);

  /**
   * Handle clear output (deselect line)
   */
  const handleClearOutput = useCallback(() => {
    selectLine(null);
    emitLineUpdate(null);
  }, [selectLine, emitLineUpdate]);

  /**
   * Handle scroll lines (from CC/fader)
   * Maps 0-1 percentage to line index
   */
  const handleScrollLines = useCallback((percentage) => {
    const currentLyrics = lyricsRef.current;
    if (!currentLyrics || currentLyrics.length === 0) return;

    const lineIndex = Math.floor(percentage * (currentLyrics.length - 1));
    handleSelectLine(lineIndex);
  }, [handleSelectLine]);

  /**
   * Handle setlist item selection by zero-based index.
   */
  const handleLoadSetlistItem = useCallback((index) => {
    const fileId = resolveSetlistItemIdByIndex(setlistFilesRef.current, index);

    if (fileId && typeof emitSetlistLoad === 'function') {
      emitSetlistLoad(fileId);
      return;
    }

    if (typeof showToast === 'function') {
      showToast({
        title: 'Setlist item not found',
        message: `No setlist item exists at index ${index}`,
        variant: 'info'
      });
    }
  }, [emitSetlistLoad, showToast]);

  /**
   * Process incoming external control action
   */
  const processAction = useCallback((action) => {
    if (!action || !action.type) return;

    console.log('[ExternalControl] Processing action:', action.type, action);

    switch (action.type) {
      case 'select-line':
        if (typeof action.lineIndex === 'number') {
          handleSelectLine(action.lineIndex);
        }
        break;

      case 'next-line':
        handleNextLine();
        break;

      case 'prev-line':
        handlePrevLine();
        break;

      case 'toggle-output':
        handleToggleOutput();
        break;

      case 'set-output':
        if (typeof action.enabled === 'boolean') {
          handleSetOutput(action.enabled);
        }
        break;

      case 'clear-output':
        handleClearOutput();
        break;

      case 'toggle-autoplay':
        if (typeof handleAutoplayToggle === 'function') {
          handleAutoplayToggle();
        }
        break;

      case 'autoplay-start':
        if (typeof handleAutoplayToggle === 'function' && !autoplayActiveRef.current) {
          handleAutoplayToggle();
        }
        break;

      case 'autoplay-stop':
        if (typeof handleAutoplayToggle === 'function' && autoplayActiveRef.current) {
          handleAutoplayToggle();
        }
        break;

      case 'toggle-intelligent-autoplay':
        if (typeof handleIntelligentAutoplayToggle === 'function') {
          handleIntelligentAutoplayToggle();
        }
        break;

      case 'intelligent-autoplay-start':
        if (typeof handleIntelligentAutoplayStart === 'function' && !intelligentAutoplayActiveRef.current) {
          handleIntelligentAutoplayStart();
        }
        break;

      case 'intelligent-autoplay-stop':
        if (typeof handleIntelligentAutoplayStop === 'function' && intelligentAutoplayActiveRef.current) {
          handleIntelligentAutoplayStop();
        }
        break;

      case 'next-song':
        if (typeof handleSetlistNext === 'function') {
          handleSetlistNext();
        }
        break;

      case 'prev-song':
        if (typeof handleSetlistPrev === 'function') {
          handleSetlistPrev();
        }
        break;

      case 'load-setlist-item':
        console.log('[ExternalControl] Load setlist item:', action.index);
        if (typeof action.index === 'number') {
          handleLoadSetlistItem(action.index);
        }
        break;

      case 'sync-outputs':
        if (typeof handleSyncOutputs === 'function') {
          handleSyncOutputs();
        }
        break;

      case 'scroll-lines':
        if (typeof action.percentage === 'number') {
          handleScrollLines(action.percentage);
        }
        break;

      // Individual output controls (from OSC)
      case 'toggle-output-1':
        if (typeof emitOutput1Toggle === 'function') {
          emitOutput1Toggle();
        } else {
          console.log('[ExternalControl] Output 1 toggle not available');
        }
        break;

      case 'set-output-1':
        if (typeof emitOutput1Toggle === 'function' && typeof action.enabled === 'boolean') {
          emitOutput1Toggle(action.enabled);
        } else {
          console.log('[ExternalControl] Output 1 set not available');
        }
        break;

      case 'toggle-output-2':
        if (typeof emitOutput2Toggle === 'function') {
          emitOutput2Toggle();
        } else {
          console.log('[ExternalControl] Output 2 toggle not available');
        }
        break;

      case 'set-output-2':
        if (typeof emitOutput2Toggle === 'function' && typeof action.enabled === 'boolean') {
          emitOutput2Toggle(action.enabled);
        } else {
          console.log('[ExternalControl] Output 2 set not available');
        }
        break;

      case 'toggle-stage':
        if (typeof emitStageToggle === 'function') {
          emitStageToggle();
        } else {
          console.log('[ExternalControl] Stage toggle not available');
        }
        break;

      case 'set-stage':
        if (typeof emitStageToggle === 'function' && typeof action.enabled === 'boolean') {
          emitStageToggle(action.enabled);
        } else {
          console.log('[ExternalControl] Stage set not available');
        }
        break;

      default:
        console.log('[ExternalControl] Unknown action type:', action.type);
    }

    // Show feedback toast for certain actions (optional)
    if (action.source === 'midi' || action.source === 'osc') {
      // Could show subtle feedback here if desired
    }
  }, [
    handleSelectLine,
    handleNextLine,
    handlePrevLine,
    handleToggleOutput,
    handleSetOutput,
    handleClearOutput,
    handleAutoplayToggle,
    handleIntelligentAutoplayToggle,
    handleIntelligentAutoplayStart,
    handleIntelligentAutoplayStop,
    handleSetlistNext,
    handleSetlistPrev,
    handleLoadSetlistItem,
    handleSyncOutputs,
    handleScrollLines,
    emitOutput1Toggle,
    emitOutput2Toggle,
    emitStageToggle
  ]);

  /**
   * Set up listener for external control actions
   */
  useEffect(() => {
    if (!enabled || !window.electronAPI?.externalControl?.onAction) {
      return;
    }

    const cleanup = window.electronAPI.externalControl.onAction((action) => {
      processAction(action);
    });

    return () => {
      if (typeof cleanup === 'function') {
        cleanup();
      }
    };
  }, [enabled, processAction]);

  /**
   * Send state updates to main process for OSC feedback
   * Fires whenever relevant app state changes so OSC clients stay in sync
   */
  useEffect(() => {
    if (!enabled || !window.electronAPI?.externalControl?.updateState) {
      return;
    }

    window.electronAPI.externalControl.updateState({
      line: selectedLine,
      output: isOutputOn,
      songName: songName || '',
      lineCount: lyrics?.length || 0,
      autoplay: autoplayActive || false,
      intelligentAutoplay: intelligentAutoplayActive || false
    });
  }, [enabled, selectedLine, isOutputOn, songName, lyrics?.length, autoplayActive, intelligentAutoplayActive]);

  return {
    processAction,
    handleSelectLine,
    handleNextLine,
    handlePrevLine,
    handleToggleOutput,
    handleClearOutput
  };
}

export default useExternalControl;
