import { useCallback } from 'react';
import { formatLyrics, formatLyricsWithStats } from '../../utils/lyricsFormat';
import useLyricsStore from '../../context/LyricsStore';

const getFormattingOptions = () => {
  const state = useLyricsStore.getState();
  return {
    capitalizeFirst: state.formattingCapitalizeFirstLetter,
    capitalizeReligious: state.formattingCapitalizeReligiousTerms,
    normalizeTypographic: state.formattingNormalizeTypographicChars,
  };
};

const useEditorClipboard = ({ content, setContent, textareaRef, showToast }) => {
  const handleCut = useCallback(async () => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const selectedText = content.substring(start, end);
    if (!selectedText) return;
    try {
      await navigator.clipboard.writeText(selectedText);
      const newContent = content.substring(0, start) + content.substring(end);
      const scrollTop = textareaRef.current.scrollTop || 0;
      setContent(newContent, {
        selectionStart: start,
        selectionEnd: start,
        scrollTop,
        timestamp: Date.now(),
        coalesceKey: 'edit'
      });
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(start, start);
    } catch (err) {
      console.error('Failed to cut text:', err);
    }
  }, [content, setContent, textareaRef]);

  const handleCopy = useCallback(async () => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const selectedText = content.substring(start, end);
    if (!selectedText) return;
    try {
      await navigator.clipboard.writeText(selectedText);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  }, [content, textareaRef]);

  const handlePaste = useCallback(async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (!textareaRef.current) return;
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const cleanupOnPaste = useLyricsStore.getState().canvasCleanupOnPaste;
      const pasteText = cleanupOnPaste ? formatLyrics(clipboardText, getFormattingOptions()) : clipboardText;
      const newContent = content.substring(0, start) + pasteText + content.substring(end);
      const nextCursor = start + pasteText.length;
      const scrollTop = textareaRef.current.scrollTop || 0;
      setContent(newContent, {
        selectionStart: nextCursor,
        selectionEnd: nextCursor,
        scrollTop,
        timestamp: Date.now(),
        coalesceKey: 'edit'
      });
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(nextCursor, nextCursor);
    } catch (err) {
      console.error('Failed to paste text:', err);
    }
  }, [content, setContent, textareaRef]);

  const handleTextareaPaste = useCallback((e) => {
    const cleanupOnPaste = useLyricsStore.getState().canvasCleanupOnPaste;
    if (!cleanupOnPaste) return;
    e.preventDefault();
    const clipboardText = e.clipboardData.getData('text');
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const formattedText = formatLyrics(clipboardText, getFormattingOptions());
    const newContent = content.substring(0, start) + formattedText + content.substring(end);
    const nextCursor = start + formattedText.length;
    const scrollTop = textareaRef.current.scrollTop || 0;
    setContent(newContent, {
      selectionStart: nextCursor,
      selectionEnd: nextCursor,
      scrollTop,
      timestamp: Date.now(),
      coalesceKey: 'edit'
    });
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(nextCursor, nextCursor);
      }
    }, 0);
  }, [content, setContent, textareaRef]);

  const handleCleanup = useCallback(() => {
    const { text: formattedContent, stats } = formatLyricsWithStats(content, {
      enableSplitting: true,
      ...getFormattingOptions(),
    });
    const scrollTop = textareaRef.current?.scrollTop || 0;
    const cursor = textareaRef.current?.selectionStart ?? null;

    const safeCursor = cursor !== null ? Math.min(cursor, formattedContent.length) : null;

    setContent(formattedContent, {
      selectionStart: safeCursor,
      selectionEnd: safeCursor,
      scrollTop,
      timestamp: Date.now(),
      coalesceKey: 'cleanup'
    });

    const details = [];
    if (stats.typographicCharsNormalized > 0) {
      details.push(`${stats.typographicCharsNormalized} typographic char${stats.typographicCharsNormalized !== 1 ? 's' : ''} normalized`);
    }
    if (stats.metadataTagsNormalized > 0) {
      details.push(`${stats.metadataTagsNormalized} metadata tag${stats.metadataTagsNormalized !== 1 ? 's' : ''} fixed`);
    }
    if (stats.bracketsRepaired > 0) {
      details.push(`${stats.bracketsRepaired} bracket${stats.bracketsRepaired !== 1 ? 's' : ''} repaired`);
    }
    if (stats.emptySectionsRemoved > 0) {
      details.push(`${stats.emptySectionsRemoved} empty section${stats.emptySectionsRemoved !== 1 ? 's' : ''} removed`);
    }
    if (stats.excessBlanksRemoved > 0) {
      details.push(`${stats.excessBlanksRemoved} excess blank line${stats.excessBlanksRemoved !== 1 ? 's' : ''} collapsed`);
    }

    const noContentChange = formattedContent === content;
    if (noContentChange) {
      showToast({
        title: 'Already clean',
        message: 'No formatting changes needed.',
        variant: 'info'
      });
    } else if (details.length > 0) {
      showToast({
        title: 'Lyrics cleaned',
        message: `Formatting applied: ${details.join(', ')}.`,
        variant: 'success'
      });
    } else {
      showToast({
        title: 'Lyrics cleaned',
        message: 'Formatting and structure improved.',
        variant: 'success'
      });
    }
  }, [content, setContent, showToast, textareaRef]);


  return { handleCut, handleCopy, handlePaste, handleTextareaPaste, handleCleanup };
};

export default useEditorClipboard;