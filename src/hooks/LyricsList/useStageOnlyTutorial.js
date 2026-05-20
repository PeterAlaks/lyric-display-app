import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useLyricsStore from '../../context/LyricsStore';
import { getLineDisplayText } from '../../utils/parseLyrics';

const STAGE_ONLY_MARKER_REGEX = /^\s*\/\//;

const hasStageOnlyMarker = (line) => {
  const displayText = getLineDisplayText(line);
  if (!displayText) return false;
  return displayText.split('\n').some((lineText) => STAGE_ONLY_MARKER_REGEX.test(lineText));
};

const getFirstStageOnlyMarkerIndex = (lyrics) => {
  if (!Array.isArray(lyrics)) return null;
  const index = lyrics.findIndex((line) => hasStageOnlyMarker(line));
  return index >= 0 ? index : null;
};

const getLyricsLoadSignature = (lyrics, firstMarkerIndex, lyricsFileName) => {
  if (!Array.isArray(lyrics) || firstMarkerIndex == null) return '';
  const firstLine = getLineDisplayText(lyrics[0]);
  const markerLine = getLineDisplayText(lyrics[firstMarkerIndex]);
  return `${lyricsFileName || ''}|${lyrics.length}|${firstMarkerIndex}|${firstLine}|${markerLine}`;
};

const getTutorialLoadIdentity = (detail = {}) => {
  const fileName = detail.fileName || '';
  const filePath = detail.filePath || '';
  const fileType = detail.fileType || '';
  return `${fileName}|${filePath}|${fileType}|${Date.now()}`;
};

let hasHandledInitialPersistedTutorial = false;

export default function useStageOnlyTutorial({ lyrics, lyricsFileName }) {
  const showTutorialPopovers = useLyricsStore((state) => state.showTutorialPopovers);
  const setShowTutorialPopovers = useLyricsStore((state) => state.setShowTutorialPopovers);
  const [stageOnlyTutorial, setStageOnlyTutorial] = useState(null);
  const [lyricsTutorialLoad, setLyricsTutorialLoad] = useState(null);

  const tutorialMutationRef = useRef(false);
  const tutorialLoadCounterRef = useRef(0);
  const initialTutorialEvaluatedRef = useRef(false);
  const allowInitialPersistedTutorialRef = useRef(!hasHandledInitialPersistedTutorial && Array.isArray(lyrics) && lyrics.length > 0);
  const handledTutorialLoadIdRef = useRef(null);
  const previousShowTutorialPopoversRef = useRef(showTutorialPopovers);

  const firstStageOnlyMarkerIndex = useMemo(
    () => getFirstStageOnlyMarkerIndex(lyrics),
    [lyrics]
  );

  useEffect(() => {
    const handleLyricsTutorialLoad = (event) => {
      hasHandledInitialPersistedTutorial = true;
      setLyricsTutorialLoad({
        id: getTutorialLoadIdentity(event?.detail),
        detail: event?.detail || {},
      });
    };

    window.addEventListener('lyrics-tutorial-load', handleLyricsTutorialLoad);
    return () => window.removeEventListener('lyrics-tutorial-load', handleLyricsTutorialLoad);
  }, []);

  useEffect(() => {
    if (tutorialMutationRef.current) {
      tutorialMutationRef.current = false;
      return;
    }

    const wasShowingTutorialPopovers = previousShowTutorialPopoversRef.current;
    previousShowTutorialPopoversRef.current = showTutorialPopovers;
    const hasUnhandledExplicitLyricsLoad = Boolean(lyricsTutorialLoad?.id && lyricsTutorialLoad.id !== handledTutorialLoadIdRef.current);

    if (!showTutorialPopovers || firstStageOnlyMarkerIndex == null) {
      if (hasUnhandledExplicitLyricsLoad) {
        handledTutorialLoadIdRef.current = lyricsTutorialLoad.id;
      }
      setStageOnlyTutorial(null);
      return;
    }

    const isInitialPersistedLyricsCheck = allowInitialPersistedTutorialRef.current && !initialTutorialEvaluatedRef.current;
    if (!initialTutorialEvaluatedRef.current) {
      initialTutorialEvaluatedRef.current = true;
      if (allowInitialPersistedTutorialRef.current) {
        hasHandledInitialPersistedTutorial = true;
      }
    }

    const wasPreferenceReenabled = !wasShowingTutorialPopovers && showTutorialPopovers;

    if (!isInitialPersistedLyricsCheck && !wasPreferenceReenabled && !hasUnhandledExplicitLyricsLoad) {
      return;
    }

    if (hasUnhandledExplicitLyricsLoad) {
      handledTutorialLoadIdRef.current = lyricsTutorialLoad.id;
    }

    tutorialLoadCounterRef.current += 1;
    const loadSignature = getLyricsLoadSignature(lyrics, firstStageOnlyMarkerIndex, lyricsFileName);

    setStageOnlyTutorial({
      key: `${tutorialLoadCounterRef.current}|${loadSignature}`,
      index: firstStageOnlyMarkerIndex,
      open: false,
      hasShown: false,
    });
  }, [firstStageOnlyMarkerIndex, lyrics, lyricsFileName, lyricsTutorialLoad, showTutorialPopovers]);

  const handleStageOnlyTutorialVisible = useCallback((index) => {
    setStageOnlyTutorial((current) => {
      if (!current || current.index !== index || current.hasShown) return current;
      return { ...current, open: true, hasShown: true };
    });
  }, []);

  const handleStageOnlyTutorialOpenChange = useCallback((open) => {
    setStageOnlyTutorial((current) => {
      if (!current) return current;
      return { ...current, open };
    });
  }, []);

  const handleNeverShowTutorialPopovers = useCallback(async () => {
    setShowTutorialPopovers(false);
    setStageOnlyTutorial(null);

    try {
      if (window.electronAPI?.preferences?.set) {
        await window.electronAPI.preferences.set('appearance.showTutorialPopovers', false);
      }
    } catch (error) {
      console.error('Failed to save tutorial popover preference:', error);
    }

    window.dispatchEvent(new CustomEvent('tutorial-popovers-preference-updated', {
      detail: { showTutorialPopovers: false }
    }));
  }, [setShowTutorialPopovers]);

  return {
    stageOnlyTutorial,
    tutorialMutationRef,
    handleStageOnlyTutorialVisible,
    handleStageOnlyTutorialOpenChange,
    handleNeverShowTutorialPopovers,
  };
}
