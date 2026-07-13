import { useCallback } from 'react';
import { formatLyrics } from '../../utils/lyricsFormat';
import { parseTxtContent } from '../../../shared/lyricsParsing.js';
import useLyricsStore from '../../context/LyricsStore.js';

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
  if (!content.trim() || !title.trim()) {
    showModal({
      title: 'Missing details',
      description: 'Enter both a song title and lyrics before loading.',
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
      setTitle('');
      baseContentRef.current = '';
      baseTitleRef.current = '';
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
