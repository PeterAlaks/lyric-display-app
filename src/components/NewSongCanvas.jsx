import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Scissors, Copy, ClipboardPaste, Wand2, Save, FolderOpen } from 'lucide-react';
import { useLyricsState, useDarkModeState } from '../hooks/useStoreSelectors';
import { useControlSocket } from '../context/ControlSocketProvider';
import useFileUpload from '../hooks/useFileUpload';
import useDarkModeSync from '../hooks/useDarkModeSync';
import useEditorClipboard from '../hooks/useEditorClipboard';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatLyrics, reconstructEditableText } from '../utils/lyricsFormat';
import useToast from '../hooks/useToast';
import useModal from '../hooks/useModal';

const NewSongCanvas = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const mode = params.get("mode") || "new";
  const editMode = mode === "edit";
  const composeMode = mode === "compose";
  const isController = composeMode;

  const { darkMode, setDarkMode } = useDarkModeState();
  const { lyrics, lyricsFileName, rawLyricsContent, setRawLyricsContent } = useLyricsState();

  const { emitLyricsDraftSubmit } = useControlSocket();

  const handleFileUpload = useFileUpload();
  const textareaRef = useRef(null);
  const baseContentRef = useRef('');
  const baseTitleRef = useRef('');

  const [content, setContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [title, setTitle] = useState('');

  useDarkModeSync(darkMode, setDarkMode);
  const { showToast } = useToast();
  const { showModal } = useModal();

  React.useEffect(() => {
    if (window.electronAPI) {
      const handleNavigateToNewSong = () => {
        if (!editMode) {
          setContent('');
          setFileName('');
          setTitle('');
        } else {
          navigate('/new-song?mode=new');
        }
      };

      window.electronAPI.onNavigateToNewSong(handleNavigateToNewSong);

      return () => {
        window.electronAPI.removeAllListeners('navigate-to-new-song');
      };
    }
  }, [editMode, navigate, setRawLyricsContent]);

  // Focus textarea on mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  // Populate editor when in edit mode and relevant data changes
  useEffect(() => {
    if (!editMode) return;
    if (rawLyricsContent) {
      setContent(rawLyricsContent);
    } else if (lyrics && lyrics.length > 0) {
      const text = reconstructEditableText(lyrics);
      setContent(text);
    } else {
      setContent('');
    }
    setFileName(lyricsFileName || '');
    setTitle(lyricsFileName || '');
    // Set baselines for unsaved changes guard
    const nextContent = rawLyricsContent
      ? rawLyricsContent
      : (lyrics && lyrics.length > 0)
        ? reconstructEditableText(lyrics)
        : '';
    baseContentRef.current = nextContent || '';
    baseTitleRef.current = (lyricsFileName || '') || '';
  }, [editMode, lyrics, lyricsFileName, rawLyricsContent]);

  useEffect(() => {
    if (editMode) return;
    setContent('');
    setFileName('');
    setTitle('');
    baseContentRef.current = '';
    baseTitleRef.current = '';
  }, [editMode]);

  // Listen for draft submission results
  React.useEffect(() => {
    const handleDraftSubmitted = (event) => {
      showToast({
        title: 'Draft submitted',
        message: `"${event.detail?.title}" sent for approval`,
        variant: 'success'
      });
    };

    const handleDraftError = (event) => {
      showToast({
        title: 'Draft submission failed',
        message: event.detail?.message || 'Could not send draft',
        variant: 'error'
      });
    };

    window.addEventListener('draft-submitted', handleDraftSubmitted);
    window.addEventListener('draft-error', handleDraftError);

    return () => {
      window.removeEventListener('draft-submitted', handleDraftSubmitted);
      window.removeEventListener('draft-error', handleDraftError);
    };
  }, [showToast]);

  // Clipboard + formatting handlers
  const { handleCut, handleCopy, handlePaste, handleCleanup, handleTextareaPaste } = useEditorClipboard({ content, setContent, textareaRef });

  // Back navigation
  const handleBack = () => {
    const hasChanges = (content || '') !== (baseContentRef.current || '') || (title || '') !== (baseTitleRef.current || '');
    if (hasChanges) {
      showToast({
        title: 'Unsaved changes',
        message: 'You have unsaved changes. Discard them?',
        variant: 'warn',
        duration: 0,
        actions: [
          { label: 'Yes, discard', onClick: () => navigate('/') },
          { label: 'Cancel', onClick: () => { } },
        ],
      });
      return;
    }
    navigate('/');
  };

  // Save file
  const handleSave = async () => {
    if (!content.trim() || !title.trim()) {
      showModal({
        title: 'Missing song details',
        description: 'Enter both a song title and lyrics before saving.',
        variant: 'warn',
        dismissLabel: 'Will do',
      });
      return;
    }

    if (window.electronAPI && window.electronAPI.showSaveDialog) {
      try {
        const result = await window.electronAPI.showSaveDialog({
          defaultPath: (title && `${title}.txt`) || fileName || 'untitled.txt',
          filters: [{ name: 'Text Files', extensions: ['txt'] }]
        });

        if (!result.canceled) {
          await window.electronAPI.writeFile(result.filePath, content);
          const baseName = result.filePath.split(/[\\/]/).pop().replace(/\.txt$/i, '');
          setFileName(baseName);
          setTitle(baseName);
          baseContentRef.current = content;
          baseTitleRef.current = baseName;
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
      // Fallback: download file
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (title && `${title}.txt`) || fileName || 'lyrics.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      baseContentRef.current = content;
      baseTitleRef.current = title || fileName || 'lyrics';
    }
  };
  // Save and load into app
  const handleSaveAndLoad = async () => {
    if (!content.trim() || !title.trim()) {
      showModal({
        title: 'Missing song details',
        description: 'Enter both a song title and lyrics before saving and loading.',
        variant: 'warn',
        dismissLabel: 'Got it',
      });
      return;
    }

    if (window.electronAPI && window.electronAPI.showSaveDialog) {
      try {
        const result = await window.electronAPI.showSaveDialog({
          defaultPath: (title && `${title}.txt`) || fileName || 'untitled.txt',
          filters: [{ name: 'Text Files', extensions: ['txt'] }]
        });

        if (!result.canceled) {
          await window.electronAPI.writeFile(result.filePath, content);
          const baseName = result.filePath.split(/[\\/]/).pop().replace(/\.txt$/i, '');

          const blob = new Blob([content], { type: 'text/plain' });
          const file = new File([blob], `${baseName}.txt`, { type: 'text/plain' });

          setRawLyricsContent(content);
          await handleFileUpload(file);
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
        const baseName = title || fileName || 'lyrics';
        const blob = new Blob([content], { type: 'text/plain' });
        const file = new File([blob], `${baseName}.txt`, { type: 'text/plain' });

        setRawLyricsContent(content);
        await handleFileUpload(file);

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        baseContentRef.current = content;
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
  };

  // Handle load draft (for controllers)
  const handleLoadDraft = useCallback(async () => {
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
      const processedLines = formatLyrics(content).split('\n').filter(l => l.trim());

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
        setContent('');
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
  }, [content, title, emitLyricsDraftSubmit, showToast, showModal, navigate]);

  const isContentEmpty = !content.trim();
  const isTitleEmpty = !title.trim();


  return (
    <div className={`flex flex-col h-screen font-sans ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      {/* Fixed Header */}
      <div className={`shadow-sm border-b p-4 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        {/* Mobile Layout - Two Rows */}
        <div className="md:hidden">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={handleBack}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-colors ${darkMode
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <h1 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {composeMode ? "Compose Lyrics" : editMode ? "Edit Song Canvas" : "New Song Canvas"}
            </h1>
            <div className="w-[72px]"></div>
          </div>

          {/* Row 1: Cut, Copy, Paste, Cleanup */}
          <div className="flex items-center justify-center gap-2 mb-3">
            <Button onClick={handleCut} disabled={isContentEmpty} variant="ghost" size="sm" className={`flex-1 ${darkMode ? 'text-gray-200 hover:text-gray-100' : ''}`}>
              <Scissors className="w-4 h-4 mr-1" /> Cut
            </Button>
            <Button onClick={handleCopy} disabled={isContentEmpty} variant="ghost" size="sm" className={`flex-1 ${darkMode ? 'text-gray-200 hover:text-gray-100' : ''}`}>
              <Copy className="w-4 h-4 mr-1" /> Copy
            </Button>
            <Button onClick={handlePaste} variant="ghost" size="sm" className={`flex-1 ${darkMode ? 'text-gray-200 hover:text-gray-100' : ''}`}>
              <ClipboardPaste className="w-4 h-4 mr-1" /> Paste
            </Button>
            <Button onClick={handleCleanup} disabled={isContentEmpty} variant="ghost" size="sm" className={`flex-1 ${darkMode ? 'text-gray-200 hover:text-gray-100' : ''}`}>
              <Wand2 className="w-4 h-4 mr-1" /> Cleanup
            </Button>
          </div>

          {/* Row 2: Title and Action Button */}
          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={65}
              placeholder="Enter song title..."
              className={`flex-1 px-3 py-1.5 rounded-md ${darkMode
                ? "bg-gray-700 text-gray-200 placeholder-gray-400 border-gray-600"
                : "bg-white text-gray-900 placeholder-gray-400 border-gray-300"
                }`}
            />
            {composeMode ? (
              <Button
                onClick={handleLoadDraft}
                disabled={isContentEmpty || isTitleEmpty}
                className="whitespace-nowrap bg-gradient-to-r from-blue-400 to-purple-600 text-white hover:from-blue-500 hover:to-purple-700"
              >
                <FolderOpen className="w-4 h-4 mr-1" /> Load Draft
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleSave}
                  disabled={isContentEmpty || isTitleEmpty}
                  variant="ghost"
                  size="sm"
                >
                  <Save className="w-4 h-4 mr-1" /> Save
                </Button>
                <Button
                  onClick={handleSaveAndLoad}
                  disabled={isContentEmpty || isTitleEmpty}
                  className="whitespace-nowrap bg-gradient-to-r from-blue-400 to-purple-600 text-white"
                  size="sm"
                >
                  <FolderOpen className="w-4 h-4 mr-1" /> Save & Load
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Desktop Layout - Original Single Row */}
        <div className="hidden md:block">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={handleBack}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-colors ${darkMode
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <h1 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {composeMode ? "Compose Lyrics" : editMode ? "Edit Song Canvas" : "New Song Canvas"}
            </h1>
            <div className="w-[72px]"></div>
          </div>
          <div className="flex items-center justify-center gap-4">
            <Button onClick={handleCut} disabled={isContentEmpty} variant="ghost" className={`${darkMode ? 'text-gray-200 hover:text-gray-100' : ''}`}>
              <Scissors className="w-4 h-4" /> Cut
            </Button>
            <Button onClick={handleCopy} disabled={isContentEmpty} variant="ghost" className={`${darkMode ? 'text-gray-200 hover:text-gray-100' : ''}`}>
              <Copy className="w-4 h-4" /> Copy
            </Button>
            <Button onClick={handlePaste} variant="ghost" className={`${darkMode ? 'text-gray-200 hover:text-gray-100' : ''}`}>
              <ClipboardPaste className="w-4 h-4" /> Paste
            </Button>
            <Button onClick={handleCleanup} disabled={isContentEmpty} variant="ghost" className={`${darkMode ? 'text-gray-200 hover:text-gray-100' : ''}`}>
              <Wand2 className="w-4 h-4" /> Cleanup
            </Button>
            <div className={`w-px h-6 ${darkMode ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={65}
              placeholder="Enter song title..."
              className={`px-3 py-1.5 rounded-md max-w-sm ${darkMode
                ? "bg-gray-700 text-gray-200 placeholder-gray-400 border-gray-600"
                : "bg-white text-gray-900 placeholder-gray-400 border-gray-300"
                }`}
            />
            {!composeMode && (
              <Button
                onClick={handleSave}
                disabled={isContentEmpty || isTitleEmpty}
                variant="ghost"
              >
                <Save className="w-4 h-4" /> Save
              </Button>
            )}
            <Button
              onClick={composeMode ? handleLoadDraft : handleSaveAndLoad}
              disabled={isContentEmpty || isTitleEmpty}
              className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-400 to-purple-600 text-white rounded-md font-medium hover:from-blue-500 hover:to-purple-700"
            >
              <FolderOpen className="w-4 h-4" /> {composeMode ? 'Load Draft' : 'Save and Load'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6">
        <div className={`h-full rounded-lg border ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onPaste={handleTextareaPaste}
            placeholder="Start typing your lyrics here, or paste existing content..."
            className={`w-full h-full p-6 rounded-lg resize-none outline-none font-mono text-base leading-relaxed ${darkMode
              ? 'bg-gray-800 text-gray-200 placeholder-gray-500'
              : 'bg-white text-gray-900 placeholder-gray-400'
              }`}
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
};

export default NewSongCanvas;
