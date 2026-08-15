import { useCallback } from 'react';
import { formatLyrics } from '../../utils/lyricsFormat';
import { parseTxtContent } from '../../../shared/lyricsParsing/txtParser.js';
import useLyricsStore from '../../context/LyricsStore.js';
import { isUsableLyricsTitle, UNTITLED_LYRICS_TITLE } from '../../utils/titlePrefill.js';

export const useDraftLoader = ({
  baseContentRef,
  baseTitleRef,
  content,
  emitLyricsDraftSubmit,
  navigate,
  resetHistory,
  setTitle,
  showModal,
  showToast,
  title,
}) => useCallback(async () => {
  if (!content.trim() || !isUsableLyricsTitle(title)) {
    showModal({
      title: 'Missing details',
      description: 'Replace “Untitled Lyrics” with a song title and add lyrics before loading.',
      variant: 'warn',
      dismissLabel: 'Got it',
    });
    return;
  }

  try {
    const state = useLyricsStore.getState();
    const parsingOptions = state.lyricsParsingOptions;
    const cleanedText = formatLyrics(content, {
      ...parsingOptions,
      capitalizeFirst: state.formattingCapitalizeFirstLetter,
      capitalizeReligious: state.formattingCapitalizeReligiousTerms,
      capitalizedWords: state.formattingCapitalizedWords,
      normalizeTypographic: state.formattingNormalizeTypographicChars,
    });
    const processedLines = parseTxtContent(cleanedText, parsingOptions).processedLines;

    const success = emitLyricsDraftSubmit({
      title: title.trim(),
      rawText: content,
      processedLines
    });

    if (!success) {
      showToast({
        title: 'Submission failed',
        message: 'Could not send draft. Check connection.',
        variant: 'error'
      });
      return;
    }

    setTimeout(() => {
      resetHistory('');
      setTitle(UNTITLED_LYRICS_TITLE);
      baseContentRef.current = '';
      baseTitleRef.current = UNTITLED_LYRICS_TITLE;
      navigate('/');
    }, 1500);
  } catch (err) {
    console.error('Draft submission error:', err);
    showModal({
      title: 'Submission error',
      description: 'Could not submit draft. Please try again.',
      variant: 'error',
      dismissLabel: 'Close',
    });
  }
}, [baseContentRef, baseTitleRef, content, emitLyricsDraftSubmit, navigate, resetHistory, setTitle, showModal, showToast, title]);
