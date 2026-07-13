import { useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { stripLyricImportExtension } from '../../../shared/lyricImportRegistry.js';
import { extractExplicitGroupingDirective, parseTxtContent } from '../../../shared/lyricsParsing.js';
import useLyricsStore from '../../context/LyricsStore.js';

/**
 * Hook for handling file save operations (Save, Save & Load)
 * Adds awareness of existing file paths so overwrites can bypass the native dialog
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
  lrcEligibility,
  baseContentRef: externalBaseContentRef,
  baseTitleRef: externalBaseTitleRef,
  existingFilePath,
  songMetadata,
  setSongMetadata,
  setPendingSavedVersion,
  setSaveVersion,
  activeSetlistItemId,
  updateSetlistItem,
  editMode = false
}) => {
  const navigate = useNavigate();
  const baseContentRef = externalBaseContentRef || useRef('');
  const baseTitleRef = externalBaseTitleRef || useRef('');

  const serializePayload = useCallback((editorContent, extension) => (
    extension === 'txt' ? extractExplicitGroupingDirective(editorContent).content : editorContent
  ), []);

  const createEditorGroupingPlan = useCallback((editorContent, extension) => {
    if (extension !== 'txt') return null;
    const parsingOptions = useLyricsStore.getState().lyricsParsingOptions;
    return parseTxtContent(editorContent, {
      ...parsingOptions,
      groupingConfig: {
        ...parsingOptions.groupingConfig,
        enableCrossBlankLineGrouping: false,
      },
    }).groupingPlan;
  }, []);

  const resolveBaseName = useCallback(() => {
    const rawBase = (title && title.trim()) || fileName || 'lyrics';
    const cleaned = stripLyricImportExtension(rawBase);
    return cleaned || 'lyrics';
  }, [fileName, title]);

  const getExistingTarget = useCallback(() => {
    if (!editMode) return null;
    const normalizedPath = (existingFilePath || '').trim();
    if (!normalizedPath) return null;
    const lowerPath = normalizedPath.toLowerCase();
    if (!lowerPath.endsWith('.txt') && !lowerPath.endsWith('.lrc')) return null;
    const extension = lowerPath.endsWith('.lrc') ? 'lrc' : 'txt';
    return { path: normalizedPath, extension };
  }, [editMode, existingFilePath]);

  const getDirectoryFromPath = useCallback((targetPath) => {
    if (!targetPath) return '';
    const normalized = targetPath.replace(/\\/g, '/');
    const idx = normalized.lastIndexOf('/');
    if (idx === -1) return '';
    return targetPath.slice(0, idx);
  }, []);

  const getFormatPromptBody = useCallback((preferredExtension) => {
    const originalIsLrc = (preferredExtension || getExistingTarget()?.extension) === 'lrc';
    if (!lrcEligibility.eligible) {
      if (originalIsLrc) {
        return 'The loaded file is .lrc but the current lyrics do not have enough timestamps. Save as text, or add timestamps to enable LRC.';
      }
      return lrcEligibility.reason || 'Add timestamps to enable LRC saving.';
    }
    if (originalIsLrc) {
      return 'The loaded file is .lrc. Keep timestamps intact by saving as LRC, or switch to text if you prefer.';
    }
    return 'LyricDisplay supports loading LRC files for intelligent lyric operations.';
  }, [getExistingTarget, lrcEligibility.eligible, lrcEligibility.reason]);

  const promptForFileFormat = useCallback(async (preferredExtension) => {
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
      body: getFormatPromptBody(preferredExtension),
    });

    if (selection === 'lrc' || selection === 'txt') {
      return selection;
    }
    return null;
  }, [getFormatPromptBody, lrcEligibility.eligible, showModal]);

  const confirmOverwrite = useCallback(async ({ targetPath, titleChanged, suggestedName }) => {
    const actions = [
      { label: 'Cancel', value: 'cancel', variant: 'outline' },
    ];

    if (titleChanged) {
      actions.push({ label: 'Save New', value: 'save-new', variant: 'default', autoFocus: true });
    } else {
      actions.push({ label: 'Save New', value: 'save-new', variant: 'outline' });
      actions.push({ label: 'Overwrite file', value: 'overwrite', variant: 'default', autoFocus: true });
    }

    const description = titleChanged
      ? 'The song title was changed. Save a new file instead of overwriting the original.'
      : 'Saving will automatically replace the lyrics file at this location:';

    const body = titleChanged
      ? `Existing file: ${targetPath}\n\nNew file name: ${suggestedName || 'lyrics'}.${targetPath?.toLowerCase().endsWith('.lrc') ? 'lrc' : 'txt'}`
      : targetPath;

    const choice = await showModal({
      title: titleChanged ? 'Save as new file?' : 'Overwrite existing file?',
      description,
      body,
      variant: titleChanged ? 'info' : 'warn',
      size: 'sm',
      dismissible: true,
      allowBackdropClose: true,
      actions,
    });
    return choice;
  }, [showModal]);

  const verifyExistingPath = useCallback(async (targetPath, extension) => {
    if (!targetPath || !window?.electronAPI?.parseLyricsFile) return true;
    try {
      const result = await window.electronAPI.parseLyricsFile({ fileType: extension, path: targetPath, rawText: null });
      return Boolean(result?.success);
    } catch {
      return false;
    }
  }, []);

  const markSaved = useCallback(({ payload, editorContent, baseName, extension, filePath, notifyPendingReload }) => {
    baseContentRef.current = editorContent ?? payload;
    baseTitleRef.current = baseName;

    setFileName(baseName);
    setTitle(baseName);

    if (setSaveVersion) {
      setSaveVersion(prev => prev + 1);
    }

    if (typeof setPendingSavedVersion === 'function') {
      if (notifyPendingReload) {
        setPendingSavedVersion({
          filePath: filePath || null,
          fileName: baseName,
          rawText: payload,
          extension,
          setlistItemId: activeSetlistItemId || null,
          songMetadata: songMetadata || null,
          createdAt: Date.now(),
        });
      } else {
        setPendingSavedVersion(null);
      }
    }
  }, [activeSetlistItemId, baseContentRef, baseTitleRef, setFileName, setPendingSavedVersion, setSaveVersion, setTitle, songMetadata]);

  const syncActiveSetlistItem = useCallback(async ({ payload, baseName, extension, filePath, groupingPlan = null }) => {
    if (!activeSetlistItemId || typeof updateSetlistItem !== 'function') return true;
    const effectiveGroupingPlan = groupingPlan || createEditorGroupingPlan(payload, extension);

    try {
      const result = await updateSetlistItem(activeSetlistItemId, {
        name: `${baseName}.${extension}`,
        content: payload,
        fileType: extension,
        lastModified: Date.now(),
        metadata: {
          ...(songMetadata || {}),
          title: songMetadata?.title || baseName,
          filePath: filePath || songMetadata?.filePath || null,
          groupingPlan: extension === 'txt' ? effectiveGroupingPlan : null,
        },
      });
      if (result?.success) return true;

      showToast({
        title: 'Setlist copy not updated',
        message: result?.error || 'The file was saved, but its setlist entry could not be refreshed.',
        variant: 'warn',
      });
      return false;
    } catch (error) {
      console.error('Failed to update the active setlist item:', error);
      showToast({
        title: 'Setlist copy not updated',
        message: 'The file was saved, but its setlist entry could not be refreshed.',
        variant: 'warn',
      });
      return false;
    }
  }, [activeSetlistItemId, createEditorGroupingPlan, showToast, songMetadata, updateSetlistItem]);

  const getReloadOptions = useCallback(({ payload, extension, filePath, groupingPlan = null }) => {
    const effectiveGroupingPlan = groupingPlan || createEditorGroupingPlan(payload, extension);
    return {
      rawText: payload,
      fileType: extension,
      filePath: filePath || null,
      path: filePath || null,
      setlistItemId: activeSetlistItemId || null,
      songMetadata: songMetadata || null,
      groupingPlan: effectiveGroupingPlan,
    };
  }, [activeSetlistItemId, createEditorGroupingPlan, songMetadata]);

  const writeLyricsFile = useCallback(async (targetPath, payload) => {
    const result = await window.electronAPI.writeFile(targetPath, payload, {
      preserveGrouping: /\.txt$/i.test(targetPath || ''),
    });
    if (result && result.success === false) {
      throw new Error(result.error || 'File write failed');
    }
    return result;
  }, []);

  const saveWithDialog = useCallback(async ({ payload, extension, baseName, defaultDir, notifyPendingReload, alsoLoad }) => {
    if (!window.electronAPI?.showSaveDialog) return null;

    const sep = defaultDir && /\\/.test(defaultDir) ? '\\' : '/';
    const normalizedDir = (defaultDir || '').replace(/[\\/]+$/, '');
    const defaultPath = normalizedDir ? `${normalizedDir}${sep}${baseName}.${extension}` : `${baseName}.${extension}`;

    try {
      const filePayload = serializePayload(payload, extension);
      const result = await window.electronAPI.showSaveDialog({
        defaultPath,
        filters: [{ name: extension === 'lrc' ? 'LRC Files' : 'Text Files', extensions: [extension] }]
      });

      if (result.canceled) return { canceled: true };

      const writeResult = await writeLyricsFile(result.filePath, filePayload);
      const savedBaseName = result.filePath.split(/[\\/]/).pop().replace(/\.(txt|lrc)$/i, '');

      if (alsoLoad) {
        const blob = new Blob([filePayload], { type: 'text/plain' });
        const file = new File([blob], `${savedBaseName}.${extension}`, { type: 'text/plain' });
        setRawLyricsContent(filePayload);
        await handleFileUpload(file, getReloadOptions({
          payload: filePayload,
          extension,
          filePath: result.filePath,
          groupingPlan: writeResult?.groupingPlan,
        }));
      }

      await syncActiveSetlistItem({
        payload: filePayload,
        baseName: savedBaseName,
        extension,
        filePath: result.filePath,
        groupingPlan: writeResult?.groupingPlan,
      });

      markSaved({
        payload: filePayload,
        editorContent: payload,
        baseName: savedBaseName,
        extension,
        filePath: result.filePath,
        notifyPendingReload: notifyPendingReload && !alsoLoad
      });

      try {
        if (window.electronAPI?.addRecentFile) {
          await window.electronAPI.addRecentFile(result.filePath);
        }
      } catch { }

      showToast({
        title: 'File saved',
        message: `"${savedBaseName}.${extension}" saved successfully`,
        variant: 'success'
      });

      if (alsoLoad) {
        navigate('/');
      }

      return { success: true, filePath: result.filePath };
    } catch (err) {
      console.error('Failed to save lyrics file via dialog:', err);
      showModal({
        title: 'Save failed',
        description: 'We could not save the lyric file. Please try again.',
        variant: 'error',
        dismissLabel: 'Close',
      });
      return { success: false };
    }
  }, [getReloadOptions, handleFileUpload, markSaved, navigate, serializePayload, setRawLyricsContent, showModal, showToast, syncActiveSetlistItem, writeLyricsFile]);

  const tryDirectSaveToExistingPath = useCallback(async (payload, { alsoLoad = false } = {}) => {
    const target = getExistingTarget();
    if (!target) return null;
    const hasLoadedBaseContent = Boolean((baseContentRef.current || '').trim());
    if (!hasLoadedBaseContent) return null;
    if (target.extension === 'lrc' && !lrcEligibility.eligible) return null;
    if (!window?.electronAPI?.writeFile) return null;

    const initialTitle = (baseTitleRef.current || '').trim();
    const currentTitle = (title || '').trim();
    const titleChanged = editMode && initialTitle !== '' && currentTitle !== '' && initialTitle !== currentTitle;

    const exists = await verifyExistingPath(target.path, target.extension);
    if (!exists) {
      showToast({
        title: 'File not found',
        message: 'The original file could not be located. Please choose a new save location.',
        variant: 'warn'
      });
      return null;
    }

    const action = await confirmOverwrite({
      targetPath: target.path,
      titleChanged,
      suggestedName: resolveBaseName()
    });
    if (action === 'cancel') return { canceled: true };
    if (action === 'save-new') {
      const preferredExtension = target.extension;
      const format = await promptForFileFormat(preferredExtension);
      if (!format) return { canceled: true };
      if (format === 'lrc' && !lrcEligibility.eligible) return { canceled: true };

      const extension = format === 'lrc' ? 'lrc' : 'txt';
      const dir = getDirectoryFromPath(target.path);
      const baseName = resolveBaseName();
      const res = await saveWithDialog({
        payload,
        extension,
        baseName,
        defaultDir: dir,
        notifyPendingReload: !alsoLoad,
        alsoLoad
      });
      return res;
    }
    if (action !== 'overwrite') return { canceled: true };

    try {
      const filePayload = serializePayload(payload, target.extension);
      const writeResult = await writeLyricsFile(target.path, filePayload);
      const savedBaseName = target.path.split(/[\\/]/).pop().replace(/\.(txt|lrc)$/i, '');

      if (alsoLoad) {
        const blob = new Blob([filePayload], { type: 'text/plain' });
        const file = new File([blob], `${savedBaseName}.${target.extension}`, { type: 'text/plain' });
        await handleFileUpload(file, getReloadOptions({
          payload: filePayload,
          extension: target.extension,
          filePath: target.path,
          groupingPlan: writeResult?.groupingPlan,
        }));
      }

      await syncActiveSetlistItem({
        payload: filePayload,
        baseName: savedBaseName,
        extension: target.extension,
        filePath: target.path,
        groupingPlan: writeResult?.groupingPlan,
      });

      markSaved({
        payload: filePayload,
        editorContent: payload,
        baseName: savedBaseName,
        extension: target.extension,
        filePath: target.path,
        notifyPendingReload: !alsoLoad
      });

      try {
        if (window.electronAPI?.addRecentFile) {
          await window.electronAPI.addRecentFile(target.path);
        }
      } catch { }

      showToast({
        title: 'File saved',
        message: `"${savedBaseName}.${target.extension}" saved successfully`,
        variant: 'success'
      });

      if (alsoLoad) {
        navigate('/');
      }

      return { success: true, filePath: target.path };
    } catch (err) {
      console.error('Failed to overwrite lyrics file:', err);
      showToast({
        title: 'Save failed',
        message: 'Could not overwrite the existing file. Please choose a new location.',
        variant: 'warn'
      });
      return null;
    }
  }, [confirmOverwrite, editMode, getDirectoryFromPath, getExistingTarget, getReloadOptions, handleFileUpload, lrcEligibility.eligible, markSaved, navigate, promptForFileFormat, resolveBaseName, saveWithDialog, serializePayload, showToast, syncActiveSetlistItem, title, verifyExistingPath, writeLyricsFile]);

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

    const payload = content;

    const directResult = await tryDirectSaveToExistingPath(payload, { alsoLoad: false });
    if (directResult?.success || directResult?.canceled) {
      return;
    }

    const preferredExtension = getExistingTarget()?.extension;
    const format = await promptForFileFormat(preferredExtension);
    if (!format) return;
    if (format === 'lrc' && !lrcEligibility.eligible) return;

    const extension = format === 'lrc' ? 'lrc' : 'txt';
    const baseName = resolveBaseName();
    const filePayload = serializePayload(payload, extension);

    if (window.electronAPI && window.electronAPI.showSaveDialog) {
      try {
        const result = await window.electronAPI.showSaveDialog({
          defaultPath: `${baseName}.${extension}`,
          filters: [{ name: extension === 'lrc' ? 'LRC Files' : 'Text Files', extensions: [extension] }]
        });

        if (!result.canceled) {
          const writeResult = await writeLyricsFile(result.filePath, filePayload);
          const savedBaseName = result.filePath.split(/[\\/]/).pop().replace(/\.(txt|lrc)$/i, '');

          await syncActiveSetlistItem({
            payload: filePayload,
            baseName: savedBaseName,
            extension,
            filePath: result.filePath,
            groupingPlan: writeResult?.groupingPlan,
          });

          markSaved({
            payload: filePayload,
            editorContent: payload,
            baseName: savedBaseName,
            extension,
            filePath: result.filePath,
            notifyPendingReload: editMode
          });

          try {
            if (window.electronAPI?.addRecentFile) {
              await window.electronAPI.addRecentFile(result.filePath);
            }
          } catch { }

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
      return;
    }

    try {
      const blob = new Blob([filePayload], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      await syncActiveSetlistItem({ payload: filePayload, baseName, extension, filePath: null });

      markSaved({
        payload: filePayload,
        editorContent: payload,
        baseName,
        extension,
        filePath: null,
        notifyPendingReload: editMode
      });

      showToast({
        title: 'File saved',
        message: `"${baseName}.${extension}" saved successfully`,
        variant: 'success'
      });
    } catch (err) {
      console.error('Failed to save lyrics file:', err);
      showModal({
        title: 'Save failed',
        description: 'We could not save the lyric file. Please try again.',
        variant: 'error',
        dismissLabel: 'Close',
      });
    }
  }, [content, lrcEligibility.eligible, markSaved, promptForFileFormat, resolveBaseName, serializePayload, showModal, showToast, syncActiveSetlistItem, title, tryDirectSaveToExistingPath, writeLyricsFile]);

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

    const payload = content;

    const directResult = await tryDirectSaveToExistingPath(payload, { alsoLoad: true });
    if (directResult?.success || directResult?.canceled) {
      return;
    }

    const preferredExtension = getExistingTarget()?.extension;
    const format = await promptForFileFormat(preferredExtension);
    if (!format) return;
    if (format === 'lrc' && !lrcEligibility.eligible) return;

    const extension = format === 'lrc' ? 'lrc' : 'txt';
    const baseName = resolveBaseName();
    const filePayload = serializePayload(payload, extension);

    if (window.electronAPI && window.electronAPI.showSaveDialog) {
      try {
        const result = await window.electronAPI.showSaveDialog({
          defaultPath: `${baseName}.${extension}`,
          filters: [{ name: extension === 'lrc' ? 'LRC Files' : 'Text Files', extensions: [extension] }]
        });

        if (!result.canceled) {
          const writeResult = await writeLyricsFile(result.filePath, filePayload);
          const savedBaseName = result.filePath.split(/[\\/]/).pop().replace(/\.(txt|lrc)$/i, '');

          const blob = new Blob([filePayload], { type: 'text/plain' });
          const file = new File([blob], `${savedBaseName}.${extension}`, { type: 'text/plain' });

          setRawLyricsContent(filePayload);
          await handleFileUpload(file, getReloadOptions({
            payload: filePayload,
            extension,
            filePath: result.filePath,
            groupingPlan: writeResult?.groupingPlan,
          }));
          await syncActiveSetlistItem({
            payload: filePayload,
            baseName: savedBaseName,
            extension,
            filePath: result.filePath,
            groupingPlan: writeResult?.groupingPlan,
          });

          markSaved({
            payload: filePayload,
            editorContent: payload,
            baseName: savedBaseName,
            extension,
            filePath: result.filePath,
            notifyPendingReload: false
          });

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
      return;
    }

    try {
      const blob = new Blob([filePayload], { type: 'text/plain' });
      const file = new File([blob], `${baseName}.${extension}`, { type: 'text/plain' });

      setRawLyricsContent(filePayload);
      await handleFileUpload(file, getReloadOptions({ payload: filePayload, extension, filePath: null }));
      await syncActiveSetlistItem({ payload: filePayload, baseName, extension, filePath: null });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      markSaved({
        payload: filePayload,
        editorContent: payload,
        baseName,
        extension,
        filePath: null,
        notifyPendingReload: false
      });
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
  }, [content, getReloadOptions, handleFileUpload, lrcEligibility.eligible, markSaved, navigate, promptForFileFormat, resolveBaseName, serializePayload, setRawLyricsContent, showModal, syncActiveSetlistItem, title, tryDirectSaveToExistingPath, writeLyricsFile]);

  return {
    handleSave,
    handleSaveAndLoad,
    baseContentRef,
    baseTitleRef
  };
};

export default useFileSave;
