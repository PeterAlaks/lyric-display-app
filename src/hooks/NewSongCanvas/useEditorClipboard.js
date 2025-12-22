import { useCallback } from 'react';
import { formatLyrics } from '../../utils/lyricsFormat';

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
      const formattedText = formatLyrics(clipboardText);
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
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(nextCursor, nextCursor);
    } catch (err) {
      console.error('Failed to paste text:', err);
    }
  }, [content, setContent, textareaRef]);

  const handleTextareaPaste = useCallback((e) => {
    e.preventDefault();
    const clipboardText = e.clipboardData.getData('text');
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const formattedText = formatLyrics(clipboardText);
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
    const formattedContent = formatLyrics(content, {
      enableSplitting: true,
    });
    const scrollTop = textareaRef.current?.scrollTop || 0;
    const cursor = textareaRef.current?.selectionStart ?? null;
    setContent(formattedContent, {
      selectionStart: cursor,
      selectionEnd: cursor,
      scrollTop,
      timestamp: Date.now(),
      coalesceKey: 'cleanup'
    });
    showToast({
      title: 'Lyrics cleaned',
      message: 'Formatting applied successfully.',
      variant: 'success'
    });
  }, [content, setContent, textareaRef]);


  return { handleCut, handleCopy, handlePaste, handleTextareaPaste, handleCleanup };
};

export default useEditorClipboard;