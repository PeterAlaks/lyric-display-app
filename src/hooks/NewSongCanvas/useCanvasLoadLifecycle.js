import { useEffect } from 'react';
import { reconstructEditableText } from '../../utils/lyricsFormat';
import { stripLyricImportExtension } from '../../../shared/lyricImportRegistry.js';

const resetCanvasState = ({ baseContentRef, baseTitleRef, loadSignatureRef, resetHistory, setFileName, setTitle }) => {
  resetHistory('');
  setFileName('');
  setTitle('');
  baseContentRef.current = '';
  baseTitleRef.current = '';
  if (loadSignatureRef) {
    loadSignatureRef.current = null;
  }
};

export const useCanvasLoadLifecycle = ({
  baseContentRef,
  baseTitleRef,
  editMode,
  loadSignatureRef,
  lyrics,
  lyricsFileName,
  navigate,
  rawLyricsContent,
  resetHistory,
  setCurrentFilePath,
  setFileName,
  setTitle,
  showToast,
  songMetadata,
  textareaRef,
}) => {
  useEffect(() => {
    if (window.electronAPI) {
      const handleNavigateToNewSong = () => {
        if (!editMode) {
          resetCanvasState({ baseContentRef, baseTitleRef, loadSignatureRef, resetHistory, setFileName, setTitle });
        } else {
          navigate('/new-song?mode=new');
        }
      };

      window.electronAPI.onNavigateToNewSong(handleNavigateToNewSong);

      return () => {
        window.electronAPI.removeAllListeners('navigate-to-new-song');
      };
    }
    return undefined;
  }, [baseContentRef, baseTitleRef, editMode, loadSignatureRef, navigate, resetHistory, setFileName, setTitle]);

  useEffect(() => {
    const handleLoadIntoCanvas = (event) => {
      const { content, fileName, filePath } = event.detail || {};

      if (!content) return;

      const baseName = fileName ? stripLyricImportExtension(fileName) : 'Untitled';

      resetHistory(content);
      setTitle(baseName);
      setFileName(baseName);
      setCurrentFilePath(filePath || '');
      baseContentRef.current = content;
      baseTitleRef.current = baseName;

      loadSignatureRef.current = `${baseName}::${content}`;

      showToast({
        title: 'File loaded',
        message: `"${fileName || 'File'}" loaded into canvas editor`,
        variant: 'success'
      });
    };

    window.addEventListener('load-into-canvas', handleLoadIntoCanvas);

    return () => {
      window.removeEventListener('load-into-canvas', handleLoadIntoCanvas);
    };
  }, [baseContentRef, baseTitleRef, loadSignatureRef, resetHistory, setCurrentFilePath, setFileName, setTitle, showToast]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [textareaRef]);

  useEffect(() => {
    if (!editMode) return;

    const nextContent = rawLyricsContent
      ? rawLyricsContent
      : (lyrics && lyrics.length > 0)
        ? reconstructEditableText(lyrics)
        : '';
    const nextTitle = lyricsFileName || '';
    const loadSignature = `${nextTitle}::${nextContent}`;
    if (loadSignatureRef.current !== loadSignature) {
      resetHistory(nextContent);
      setFileName(nextTitle);
      setTitle(nextTitle);
      setCurrentFilePath(songMetadata?.filePath || '');
      baseContentRef.current = nextContent || '';
      baseTitleRef.current = nextTitle || '';
      loadSignatureRef.current = loadSignature;
    }
  }, [baseContentRef, baseTitleRef, editMode, loadSignatureRef, lyrics, lyricsFileName, rawLyricsContent, resetHistory, setCurrentFilePath, setFileName, setTitle, songMetadata]);

  useEffect(() => {
    if (editMode) return;
    resetCanvasState({ baseContentRef, baseTitleRef, loadSignatureRef, resetHistory, setFileName, setTitle });
  }, [baseContentRef, baseTitleRef, editMode, loadSignatureRef, resetHistory, setFileName, setTitle]);
};
