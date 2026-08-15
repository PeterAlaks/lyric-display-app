import { useState, useRef, useEffect, useCallback } from 'react';
import {
  extractFirstValidLine,
  isUsableLyricsTitle,
  UNTITLED_LYRICS_TITLE,
} from '../../utils/titlePrefill';

/**
 * Hook for managing automatic title prefilling from lyrics content
 * @param {string} content - The lyrics content
 * @param {string} title - The current title value
 * @param {Function} setTitle - Function to update the title
 * @param {boolean} editMode - Whether in edit mode (prefill disabled in edit mode)
 * @param {React.RefObject} textareaRef - Lyrics textarea reference
 * @param {Array<string>} sectionTagPhrases - Currently recognized section headings
 * @returns {Object} - Title prefill state and handlers
 */
export default function useTitlePrefill(content, title, setTitle, editMode, textareaRef, sectionTagPhrases) {
  const [isTitlePrefilled, setIsTitlePrefilled] = useState(false);
  const pasteTimeoutRef = useRef(null);

  const updateTitlePrefill = useCallback((overrideContent) => {
    if (editMode) return;
    if (isUsableLyricsTitle(title) && !isTitlePrefilled) return;

    const contentToUse = overrideContent !== undefined ? overrideContent : content;
    const firstLine = extractFirstValidLine(contentToUse, { sectionTagPhrases });

    if (firstLine && firstLine !== title) {
      const truncatedTitle = firstLine.slice(0, 65);
      setTitle(truncatedTitle);
      setIsTitlePrefilled(true);
    } else if (!firstLine && isTitlePrefilled) {
      setTitle(UNTITLED_LYRICS_TITLE);
      setIsTitlePrefilled(false);
    }
  }, [content, title, isTitlePrefilled, editMode, sectionTagPhrases, setTitle]);

  const handleContentKeyDown = useCallback((event, textareaRef) => {
    if (event.key === 'Enter' && !editMode) {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const cursorPosition = textarea.selectionStart;
      const textBeforeCursor = content.slice(0, cursorPosition);
      const lineCount = textBeforeCursor.split('\n').length;

      if (lineCount === 1) {
        setTimeout(() => {
          updateTitlePrefill();
        }, 0);
      }
    }
  }, [content, editMode, updateTitlePrefill]);

  const handleContentPaste = useCallback((overrideContent) => {
    if (editMode) return;

    if (pasteTimeoutRef.current) {
      clearTimeout(pasteTimeoutRef.current);
    }

    if (typeof overrideContent === 'string') {
      updateTitlePrefill(overrideContent);
      pasteTimeoutRef.current = null;
      return;
    }

    pasteTimeoutRef.current = setTimeout(() => {
      const currentContent = textareaRef?.current?.value || '';
      updateTitlePrefill(currentContent);
      pasteTimeoutRef.current = null;
    }, 0);
  }, [editMode, updateTitlePrefill, textareaRef]);

  const handleTitleChange = useCallback((e) => {
    const newValue = e.target.value;
    setTitle(newValue);

    if (isTitlePrefilled) {
      setIsTitlePrefilled(false);
    }
  }, [isTitlePrefilled, setTitle]);

  const handleTitleBlur = useCallback((event) => {
    if (event.currentTarget.value.trim()) return;
    setTitle(UNTITLED_LYRICS_TITLE);
    setIsTitlePrefilled(false);
  }, [setTitle]);

  useEffect(() => {
    return () => {
      if (pasteTimeoutRef.current) {
        clearTimeout(pasteTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (editMode) {
      setIsTitlePrefilled(false);
      return;
    }

    if (!content.trim() && isTitlePrefilled) {
      setTitle(UNTITLED_LYRICS_TITLE);
      setIsTitlePrefilled(false);
    }
  }, [editMode, content, isTitlePrefilled, setTitle]);

  return {
    isTitlePrefilled,
    handleContentKeyDown,
    handleContentPaste,
    handleTitleBlur,
    handleTitleChange
  };
}
