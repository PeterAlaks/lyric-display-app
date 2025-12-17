import { useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Hook for handling file save operations (Save, Save & Load)
 * @param {Object} params
 * @param {string} params.content - Current editor content
 * @param {string} params.title - Current song title
 * @param {string} params.fileName - Current file name
 * @param {Function} params.setFileName - Setter for file name
 * @param {Function} params.setTitle - Setter for title
 * @param {Function} params.setRawLyricsContent - Setter for raw lyrics content
 * @param {Function} params.handleFileUpload - File upload handler
 * @param {Function} params.showModal - Modal display function
 * @param {Function} params.showToast - Toast display function
 * @param {Object} params.lrcEligibility - LRC eligibility status
 * @returns {Object} - File save handlers
 */
const useFileSave = ({
  content,
  title,
  fileName,
  setFileName,
  setTitle,
  setRawLyricsContent,
  handleFileUpload,
  showModal,
  showToast,
  lrcEligibility
}) => {
  const navigate = useNavigate();
  const baseContentRef = useRef('');
  const baseTitleRef = useRef('');

  const resolveBaseName = useCallback(() => {
    const rawBase = (title && title.trim()) || fileName || 'lyrics';
    const cleaned = rawBase.replace(/\.(txt|lrc)$/i, '');
    return cleaned || 'lyrics';
  }, [fileName, title]);

  const bodyText = lrcEligibility.eligible
    ? 'LyricDisplay supports loading LRC files for intelligent lyric operations.'
    : (lrcEligibility.reason || 'Add timestamps to enable LRC saving.');

  const promptForFileFormat = useCallback(async () => {
    const selection = await showModal({
      title: 'Choose file format',
      description: 'Select the format to save your lyrics file',
      allowBackdropClose: true,
      dismissible: true,
      size: 'sm',
      actions: [
        {
          label: 'Save as LRC (.lrc)',
          value: 'lrc',
          variant: 'outline',
          disabled: !lrcEligibility.eligible,
        },
        {
          label: 'Save as Text (.txt)',
          value: 'txt',
          variant: 'default',
          autoFocus: true,
        },
      ],
      body: bodyText,
    });

    if (selection === 'lrc' || selection === 'txt') {
      return selection;
    }
    return null;
  }, [lrcEligibility, showModal]);

  const handleSave = useCallback(async () => {
    if (!content.trim() || !title.trim()) {
      showModal({
        title: 'Missing song details',
        description: 'Enter both a song title and lyrics before saving.',
        variant: 'warn',
        dismissLabel: 'Will do',
      });
      return;
    }

    const format = await promptForFileFormat();
    if (!format) return;
    if (format === 'lrc' && !lrcEligibility.eligible) return;

    const extension = format === 'lrc' ? 'lrc' : 'txt';
    const baseName = resolveBaseName();
    const payload = content;

    if (window.electronAPI && window.electronAPI.showSaveDialog) {
      try {
        const result = await window.electronAPI.showSaveDialog({
          defaultPath: `${baseName}.${extension}`,
          filters: [{ name: extension === 'lrc' ? 'LRC Files' : 'Text Files', extensions: [extension] }]
        });

        if (!result.canceled) {
          await window.electronAPI.writeFile(result.filePath, payload);
          const savedBaseName = result.filePath.split(/[\\/]/).pop().replace(/\.(txt|lrc)$/i, '');
          setFileName(savedBaseName);
          setTitle(savedBaseName);
          baseContentRef.current = payload;
          baseTitleRef.current = savedBaseName;

          showToast({
            title: 'File saved',
            message: `"${savedBaseName}.${extension}" saved successfully`,
            variant: 'success'
          });
        }
      } catch (err) {
        console.error('Failed to save file:', err);
        showModal({
          title: 'Save failed',
          description: 'We could not save the lyric file. Please try again.',
          variant: 'error',
          dismissLabel: 'Close',
        });
      }
    } else {
      const blob = new Blob([payload], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      baseContentRef.current = payload;
      baseTitleRef.current = baseName;

      showToast({
        title: 'File saved',
        message: `"${baseName}.${extension}" saved successfully`,
        variant: 'success'
      });
    }
  }, [content, title, promptForFileFormat, lrcEligibility, resolveBaseName, setFileName, setTitle, showModal, showToast]);

  const handleSaveAndLoad = useCallback(async () => {
    if (!content.trim() || !title.trim()) {
      showModal({
        title: 'Missing song details',
        description: 'Enter both a song title and lyrics before saving and loading.',
        variant: 'warn',
        dismissLabel: 'Got it',
      });
      return;
    }

    const format = await promptForFileFormat();
    if (!format) return;
    if (format === 'lrc' && !lrcEligibility.eligible) return;

    const extension = format === 'lrc' ? 'lrc' : 'txt';
    const baseName = resolveBaseName();
    const payload = content;

    if (window.electronAPI && window.electronAPI.showSaveDialog) {
      try {
        const result = await window.electronAPI.showSaveDialog({
          defaultPath: `${baseName}.${extension}`,
          filters: [{ name: extension === 'lrc' ? 'LRC Files' : 'Text Files', extensions: [extension] }]
        });

        if (!result.canceled) {
          await window.electronAPI.writeFile(result.filePath, payload);
          const savedBaseName = result.filePath.split(/[\\/]/).pop().replace(/\.(txt|lrc)$/i, '');

          const blob = new Blob([payload], { type: 'text/plain' });
          const file = new File([blob], `${savedBaseName}.${extension}`, { type: 'text/plain' });

          setRawLyricsContent(payload);
          await handleFileUpload(file, { rawText: payload });
          setFileName(savedBaseName);
          setTitle(savedBaseName);
          baseContentRef.current = payload;
          baseTitleRef.current = savedBaseName;
          try {
            if (window.electronAPI?.addRecentFile) {
              await window.electronAPI.addRecentFile(result.filePath);
            }
          } catch { }

          navigate('/');
        }
      } catch (err) {
        console.error('Failed to save and load file:', err);
        showModal({
          title: 'Save and load failed',
          description: 'We could not save and reload the lyrics. Please try again.',
          variant: 'error',
          dismissLabel: 'Close',
        });
      }
    } else {
      try {
        const blob = new Blob([payload], { type: 'text/plain' });
        const file = new File([blob], `${baseName}.${extension}`, { type: 'text/plain' });

        setRawLyricsContent(payload);
        await handleFileUpload(file, { rawText: payload });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        baseContentRef.current = payload;
        baseTitleRef.current = baseName;
        navigate('/');
      } catch (err) {
        console.error('Failed to process lyrics:', err);
        showModal({
          title: 'Processing error',
          description: 'We could not process the lyrics. Please try again.',
          variant: 'error',
          dismissLabel: 'Close',
        });
      }
    }
  }, [content, title, promptForFileFormat, lrcEligibility, resolveBaseName, setRawLyricsContent, handleFileUpload, setFileName, setTitle, showModal, navigate]);

  return {
    handleSave,
    handleSaveAndLoad,
    baseContentRef,
    baseTitleRef
  };
};

export default useFileSave;
