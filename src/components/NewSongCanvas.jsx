import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { parseLyrics } from '../utils/parseLyrics';
import { Button } from "@/components/ui/button";

// Auto-formatting utility function
const formatLyrics = (text) => {
  const religiousWords = ['jesus', 'jesu', 'yesu', 'jehovah', 'god', 'yahweh'];
  
  const lines = text.split(/\r?\n/);
  const formattedLines = [];
  
  lines.forEach(line => {
    let trimmedLine = line.trim();
    if (trimmedLine.length === 0) return;
    
    // Remove punctuation from line beginning
    trimmedLine = trimmedLine.replace(/^[.,\-]+/, '');
    
    // Capitalize first letter of line
    if (trimmedLine.length > 0) {
      trimmedLine = trimmedLine.charAt(0).toUpperCase() + trimmedLine.slice(1);
    }
    
    // Capitalize first letter of religious words
    religiousWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      trimmedLine = trimmedLine.replace(regex, (match) => {
        return match.charAt(0).toUpperCase() + match.slice(1).toLowerCase();
      });
    });
    
    formattedLines.push(trimmedLine);
    formattedLines.push(''); // Add empty line after each lyric line
  });
  
  // Remove trailing empty line
  if (formattedLines[formattedLines.length - 1] === '') {
    formattedLines.pop();
  }
  
  return formattedLines.join('\n');
};

const NewSongCanvas = () => {
  const navigate = useNavigate();
  const { darkMode, setLyrics, selectLine, setLyricsFileName } = useLyricsStore();
  const handleFileUpload = useFileUpload();
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const [content, setContent] = useState('');
  const [fileName, setFileName] = useState('');

  // Focus textarea on mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  // Handle back navigation
  const handleBack = () => {
    navigate('/');
  };

  // Toolbar button handlers
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

  const handleSave = async () => {
    if (!content.trim()) {
      alert('Please enter some lyrics before saving.');
      return;
    }

    // Use Electron's save dialog if available
    if (window.electronAPI && window.electronAPI.showSaveDialog) {
      try {
        const result = await window.electronAPI.showSaveDialog({
          defaultPath: fileName || 'untitled.txt',
          filters: [{ name: 'Text Files', extensions: ['txt'] }]
        });
        
        if (!result.canceled) {
          await window.electronAPI.writeFile(result.filePath, content);
          const baseName = result.filePath.split('/').pop().replace(/\.txt$/i, '');
          setFileName(baseName);
          
          // Auto-load the saved file
          const blob = new Blob([content], { type: 'text/plain' });
          const file = new File([blob], `${baseName}.txt`, { type: 'text/plain' });
          await handleFileUpload(file);
          
          // Navigate back to main app
          navigate('/');
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
      a.download = fileName || 'lyrics.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleLoad = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/plain') {
      try {
        // Use parseLyrics to maintain consistency with app's file processing
        const lyricsArray = await parseLyrics(file);
        // Convert parsed array back to text for editing
        setContent(lyricsArray.join('\n'));
        const baseName = file.name.replace(/\.txt$/i, '');
        setFileName(baseName);
      } catch (err) {
        console.error('Failed to load file:', err);
        alert('Failed to load file. Please try again.');
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
    
    // Set cursor position after pasted content
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + formattedText.length, start + formattedText.length);
      }
    }, 0);
  };

  return (
    <div className={`flex flex-col h-screen font-sans ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      {/* Fixed Header */}
      <div className={`shadow-sm border-b p-4 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        {/* Top Row - Back button and Title */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handleBack}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-colors ${
              darkMode
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          
          <h1 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            New Song Canvas
          </h1>
          
          <div className="w-[72px]"></div> {/* Spacer for center alignment */}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-center gap-4">
          <Button
            onClick={handleCut}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-colors ${
              darkMode
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
            variant="ghost"
          >
            <Scissors className="w-4 h-4" />
            Cut
          </Button>

          <Button
            onClick={handleCopy}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-colors ${
              darkMode
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
            variant="ghost"
          >
            <Copy className="w-4 h-4" />
            Copy
          </Button>

          <Button
            onClick={handlePaste}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-colors ${
              darkMode
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
            variant="ghost"
          >
            <ClipboardPaste className="w-4 h-4" />
            Paste
          </Button>

          <Button
            onClick={handleCleanup}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-colors ${
              darkMode
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
            variant="ghost"
          >
            <Wand2 className="w-4 h-4" />
            Cleanup
          </Button>

          <div className={`w-px h-6 ${darkMode ? 'bg-gray-600' : 'bg-gray-300'}`}></div>

          <Button
            onClick={handleSave}
            className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-400 to-purple-600 text-white rounded-md font-medium hover:from-blue-500 hover:to-purple-700 transition-all duration-200"
          >
            <Save className="w-4 h-4" />
            Save
          </Button>

          <Button
            onClick={handleLoad}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-colors ${
              darkMode
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
            variant="ghost"
          >
            <FolderOpen className="w-4 h-4" />
            Load
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6">
        <div className={`h-full rounded-lg border ${
          darkMode ? 'border-gray-600' : 'border-gray-300'
        }`}>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onPaste={handleTextareaPaste}
            placeholder="Start typing your lyrics here, or paste existing content..."
            className={`w-full h-full p-6 rounded-lg resize-none outline-none font-mono text-base leading-relaxed ${
              darkMode 
                ? 'bg-gray-800 text-gray-200 placeholder-gray-500' 
                : 'bg-white text-gray-900 placeholder-gray-400'
            }`}
            spellCheck={false}
          />
        </div>
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        accept=".txt"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
};

export default NewSongCanvas;