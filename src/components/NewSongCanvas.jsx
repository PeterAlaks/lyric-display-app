import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Scissors,
  Copy,
  ClipboardPaste,
  Wand2,
  Save,
  FolderOpen
} from 'lucide-react';
import useLyricsStore from '../context/LyricsStore';
import useFileUpload from '../hooks/useFileUpload';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Auto-formatting utility function
// Auto-formatting utility function with bracket-aware spacing
const formatLyrics = (text) => {
  const religiousWords = ['jesus', 'jesu', 'yesu', 'jehovah', 'god', 'yahweh', 'lord', 'christ'];

  // Split into lines
  const lines = text.split(/\r?\n/);
  const formattedLines = [];

  // Reuse your isTranslationLine logic
  const isTranslationLine = (line) => {
    if (!line || typeof line !== 'string') return false;

    const trimmed = line.trim();
    if (trimmed.length <= 2) return false; // must have content

    const bracketPairs = [['[', ']'], ['(', ')'], ['{', '}'], ['<', '>']];
    return bracketPairs.some(([open, close]) => trimmed.startsWith(open) && trimmed.endsWith(close));
  };

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue;

    // Remove leading punctuation (periods, commas, hyphens)
    line = line.replace(/^[.,\-]+/, '');
    // NEW: specifically remove leading ellipses (.., ..., .... etc.) while keeping the rest of the line
    line = line.replace(/^\.+/, '');
    // NEW: also remove the Unicode ellipsis symbol "…"
    line = line.replace(/^[․‥…]+/, '');
    // Remove all periods
    line = line.replace(/\./g, '');
    // Capitalize first letter
    line = line.charAt(0).toUpperCase() + line.slice(1);

    // Capitalize religious words
    religiousWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      line = line.replace(regex, match => match.charAt(0).toUpperCase() + match.slice(1).toLowerCase());
    });

    formattedLines.push(line);

    // Look ahead: add blank line unless next line is a translation
    const nextLine = lines[i + 1] || '';
    if (!isTranslationLine(nextLine)) {
      formattedLines.push('');
    }
  }

  // Remove last empty line if exists
  if (formattedLines[formattedLines.length - 1] === '') {
    formattedLines.pop();
  }

  return formattedLines.join('\n');
};


/**
 * Reconstructs editable text from processed lyrics array
 * Properly handles both string lines and grouped objects
 */
const reconstructEditableText = (lyrics) => {
  if (!lyrics || lyrics.length === 0) return '';

  return lyrics.map(line => {
    if (typeof line === 'string') {
      return line;
    } else if (line && line.type === 'group') {
      // Reconstruct original format: main line + translation line with blank line after
      return `${line.mainLine}\n${line.translation}`;
    }
    return '';
  }).join('\n\n'); // Double newline to maintain spacing between sections
};

const NewSongCanvas = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isEditMode = new URLSearchParams(location.search).get("mode") === "edit";

  const {
    darkMode,
    setDarkMode,
    lyrics,
    lyricsFileName,
    rawLyricsContent,
    setRawLyricsContent
  } = useLyricsStore();

  const handleFileUpload = useFileUpload();
  const textareaRef = useRef(null);

  const [content, setContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [title, setTitle] = useState(''); // NEW: title state for the input field

  useEffect(() => {
    if (window.electronAPI) {
      const handleDarkModeToggle = () => {
        const newDarkMode = !darkMode;
        setDarkMode(newDarkMode);
        window.electronAPI.setDarkMode(newDarkMode);
        // Sync with native theme
        window.electronAPI.syncNativeDarkMode(newDarkMode);
      };
      window.electronAPI.onDarkModeToggle(handleDarkModeToggle);
      window.electronAPI.setDarkMode(darkMode);
      // Sync initial state with native theme
      window.electronAPI.syncNativeDarkMode(darkMode);
      return () => {
        window.electronAPI.removeAllListeners('toggle-dark-mode');
      };
    }
  }, [darkMode, setDarkMode]);

  React.useEffect(() => {
    if (window.electronAPI) {
      // Handle Ctrl+N - New Lyrics File (clear canvas when already on new song page)
      const handleNavigateToNewSong = () => {
        if (!isEditMode) {
          // If already in new mode, just clear content
          setContent('');
          setFileName('');
          setTitle(''); // NEW: clear title when creating a new song
          setRawLyricsContent('');
        } else {
          // If in edit mode, navigate to new mode
          navigate('/new-song?mode=new');
        }
      };

      window.electronAPI.onNavigateToNewSong(handleNavigateToNewSong);

      return () => {
        window.electronAPI.removeAllListeners('navigate-to-new-song');
      };
    }
  }, [isEditMode, navigate, setRawLyricsContent]);

  // Focus textarea on mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  // Fixed logic for populating the editor
  useEffect(() => {
    if (isEditMode) {
      // Priority 1: Use rawLyricsContent if available (preserves original formatting)
      if (rawLyricsContent) {
        setContent(rawLyricsContent);
      }
      // Priority 2: Reconstruct from processed lyrics array
      else if (lyrics && lyrics.length > 0) {
        setContent(reconstructEditableText(lyrics));
      }
      // Priority 3: Empty content if nothing available
      else {
        setContent('');
      }
      setFileName(lyricsFileName || '');
      setTitle(lyricsFileName || '');
    } else {
      // For a new song, ensure everything is clear
      setContent('');
      setFileName('');
      setTitle(''); // NEW: clear title for new songs
      setRawLyricsContent(''); // Clear any previous raw content
    }
  }, [isEditMode, lyrics, lyricsFileName, rawLyricsContent, setRawLyricsContent]);

  // Handle back navigation
  const handleBack = () => {
    navigate('/');
  };

  const handleCut = async () => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const selectedText = content.substring(start, end);

      if (selectedText) {
        try {
          await navigator.clipboard.writeText(selectedText);
          const newContent = content.substring(0, start) + content.substring(end);
          setContent(newContent);
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(start, start);
        } catch (err) {
          console.error('Failed to cut text:', err);
        }
      }
    }
  };

  const handleCopy = async () => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const selectedText = content.substring(start, end);

      if (selectedText) {
        try {
          await navigator.clipboard.writeText(selectedText);
        } catch (err) {
          console.error('Failed to copy text:', err);
        }
      }
    }
  };

  const handlePaste = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (textareaRef.current) {
        const start = textareaRef.current.selectionStart;
        const end = textareaRef.current.selectionEnd;

        // Apply formatting to pasted content
        const formattedText = formatLyrics(clipboardText);

        const newContent = content.substring(0, start) + formattedText + content.substring(end);
        setContent(newContent);

        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + formattedText.length, start + formattedText.length);
      }
    } catch (err) {
      console.error('Failed to paste text:', err);
    }
  };

  const handleCleanup = () => {
    const formattedContent = formatLyrics(content);
    setContent(formattedContent);
  };

  // Simplified save function
  const handleSave = async () => {
    if (!content.trim() || !title.trim()) {
      alert('Please enter a title and some lyrics before saving.');
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
        }
      } catch (err) {
        console.error('Failed to save file:', err);
        alert('Failed to save file. Please try again.');
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
    }
  };

  // Simplified save and load function
  const handleSaveAndLoad = async () => {
    if (!content.trim() || !title.trim()) {
      alert('Please enter a title and some lyrics before saving and loading.');
      return;
    }

    if (window.electronAPI && window.electronAPI.showSaveDialog) {
      try {
        const result = await window.electronAPI.showSaveDialog({
          defaultPath: (title && `${title}.txt`) || fileName || 'untitled.txt',
          filters: [{ name: 'Text Files', extensions: ['txt'] }]
        });

        if (!result.canceled) {
          // Save the file
          await window.electronAPI.writeFile(result.filePath, content);
          const baseName = result.filePath.split(/[\\/]/).pop().replace(/\.txt$/i, '');

          // Create a simple File object for processing
          const blob = new Blob([content], { type: 'text/plain' });
          const file = new File([blob], `${baseName}.txt`, { type: 'text/plain' });

          // Store raw content before processing
          setRawLyricsContent(content);

          // Process and load into store
          await handleFileUpload(file);

          // Navigate back to control panel
          navigate('/');
        }
      } catch (err) {
        console.error('Failed to save and load file:', err);
        alert('Failed to save and load file. Please try again.');
      }
    } else {
      // Fallback for non-Electron environments
      try {
        const baseName = title || fileName || 'lyrics';
        const blob = new Blob([content], { type: 'text/plain' });
        const file = new File([blob], `${baseName}.txt`, { type: 'text/plain' });

        // Store raw content before processing
        setRawLyricsContent(content);

        // Process and load into store
        await handleFileUpload(file);

        // Still trigger download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        navigate('/');
      } catch (err) {
        console.error('Failed to process lyrics:', err);
        alert('Failed to process lyrics. Please try again.');
      }
    }
  };

  // Handle paste events in textarea
  const handleTextareaPaste = async (e) => {
    e.preventDefault();
    const clipboardText = e.clipboardData.getData('text');
    const formattedText = formatLyrics(clipboardText);

    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const newContent = content.substring(0, start) + formattedText + content.substring(end);

    setContent(newContent);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + formattedText.length, start + formattedText.length);
      }
    }, 0);
  };

  const isContentEmpty = !content.trim();
  const isTitleEmpty = !title.trim(); // NEW: used to disable save buttons

  return (
    <div className={`flex flex-col h-screen font-sans ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      {/* Fixed Header */}
      <div className={`shadow-sm border-b p-4 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
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
            {isEditMode ? "Edit Song Canvas" : "New Song Canvas"}
          </h1>

          <div className="w-[72px]"></div>
        </div>
        <div className="flex items-center justify-center gap-4">
          <Button
            onClick={handleCut}
            disabled={isContentEmpty}
            variant="ghost"
            className={`${darkMode ? 'text-gray-200 hover:text-gray-100' : ''}`}
          >
            <Scissors className="w-4 h-4" /> Cut
          </Button>

          <Button
            onClick={handleCopy}
            disabled={isContentEmpty}
            variant="ghost"
            className={`${darkMode ? 'text-gray-200 hover:text-gray-100' : ''}`}
          >
            <Copy className="w-4 h-4" /> Copy
          </Button>

          <Button
            onClick={handlePaste}
            variant="ghost"
            className={`${darkMode ? 'text-gray-200 hover:text-gray-100' : ''}`}
          >
            <ClipboardPaste className="w-4 h-4" /> Paste
          </Button>

          <Button
            onClick={handleCleanup}
            disabled={isContentEmpty}
            variant="ghost"
            className={`${darkMode ? 'text-gray-200 hover:text-gray-100' : ''}`}
          >
            <Wand2 className="w-4 h-4" /> Cleanup
          </Button>
          <div className={`w-px h-6 ${darkMode ? 'bg-gray-600' : 'bg-gray-300'}`}></div>

          {/* Title Input Field */}
          <Input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={65}
            placeholder="Enter song title..."
            className={`px-3 py-1.5 rounded-md max-w-sm ${darkMode
              ? "bg-gray-700 text-gray-200 placeholder-gray-400 border border-gray-600 focus:ring-2 focus:ring-blue-500"
              : "bg-white text-gray-900 placeholder-gray-400 border border-gray-300 focus:ring-2 focus:ring-blue-500"
              }`}
          />

          <Button
            onClick={handleSave}
            disabled={isContentEmpty || isTitleEmpty}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-colors ${darkMode
              ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            variant="ghost"
          >
            <Save className="w-4 h-4" /> Save
          </Button>
          <Button
            onClick={handleSaveAndLoad}
            disabled={isContentEmpty || isTitleEmpty}
            className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-400 to-purple-600 text-white rounded-md font-medium hover:from-blue-500 hover:to-purple-700 transition-all duration-200"
          >
            <FolderOpen className="w-4 h-4" /> Save and Load
          </Button>
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
