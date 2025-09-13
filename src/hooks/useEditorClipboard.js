import { useCallback } from 'react';
import { formatLyrics } from '../utils/lyricsFormat';

// Provides cut/copy/paste/cleanup handlers for a textarea-based editor
const useEditorClipboard = ({ content, setContent, textareaRef }) => {
  const handleCut = useCallback(async () => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const selectedText = content.substring(start, end);
    if (!selectedText) return;
    try {
      await navigator.clipboard.writeText(selectedText);
      const newContent = content.substring(0, start) + content.substring(end);
      setContent(newContent);
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
      setContent(newContent);
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(start + formattedText.length, start + formattedText.length);
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
    setContent(newContent);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + formattedText.length, start + formattedText.length);
      }
    }, 0);
  }, [content, setContent, textareaRef]);

  const handleCleanup = useCallback(() => {
    const formattedContent = formatLyrics(content);
    setContent(formattedContent);
  }, [content, setContent]);

  return { handleCut, handleCopy, handlePaste, handleTextareaPaste, handleCleanup };
};

export default useEditorClipboard;

