import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, FolderOpen, FileText, Edit, List, Globe, Plus } from 'lucide-react';
import useLyricsStore from '../context/LyricsStore';
import useSocket from '../hooks/useSocket';
import useFileUpload from '../hooks/useFileUpload';
import LyricsList from './LyricsList';
import MobileLayout from './MobileLayout';
import SetlistModal from './SetlistModal';
import OnlineLyricsSearchModal from './OnlineLyricsSearchModal';
import OutputSettingsPanel from './OutputSettingsPanel';
import { Switch } from "@/components/ui/switch";
import useDarkModeSync from '../hooks/useDarkModeSync';
import useMenuShortcuts from '../hooks/useMenuShortcuts';
import useSearch from '../hooks/useSearch';
import useOutputSettings from '../hooks/useOutputSettings';
import useSetlistActions from '../hooks/useSetlistActions';
import SearchBar from './SearchBar';
import useToast from '../hooks/useToast';
import { processRawTextToLines } from '../utils/parseLyrics';
import { parseLrcText } from '../utils/parseLrc';

// Main App Component
const LyricDisplayApp = () => {
  const navigate = useNavigate();

  // Global state management
  const {
    isOutputOn,
    setIsOutputOn,
    lyrics,
    lyricsFileName,
    rawLyricsContent,
    selectedLine,
    selectLine,
    setLyrics,
    setRawLyricsContent,
    setLyricsFileName,
    output1Settings,
    output2Settings,
    updateOutputSettings,
    darkMode,
    setDarkMode,
    isDesktopApp,
    setlistModalOpen,
    setSetlistModalOpen,
    setlistFiles,
    isSetlistFull,
  } = useLyricsStore();

  // Handle dark mode sync with Electron
  useDarkModeSync(darkMode, setDarkMode);

  // Menu shortcuts from Electron
  const fileInputRef = useRef(null);
  useMenuShortcuts(navigate, fileInputRef);

  const { socket, emitOutputToggle, emitLineUpdate, emitLyricsLoad, emitStyleUpdate, emitRequestSetlist, emitSetlistAdd } = useSocket('control');

  // File upload functionality
  const handleFileUpload = useFileUpload();

  // Output tabs and settings helpers
  const { activeTab, setActiveTab, getCurrentSettings, updateSettings } = useOutputSettings({
    output1Settings,
    output2Settings,
    updateOutputSettings,
    emitStyleUpdate,
  });

  // Online lyrics search modal state
  const [onlineLyricsModalOpen, setOnlineLyricsModalOpen] = React.useState(false);

  // Search state and helpers
  const {
    containerRef: lyricsContainerRef,
    searchQuery,
    highlightedLineIndex,
    currentMatchIndex,
    totalMatches,
    handleSearch,
    clearSearch,
    navigateToNextMatch,
    navigateToPreviousMatch,
  } = useSearch(lyrics);

  // Check if lyrics are loaded
  const hasLyrics = lyrics && lyrics.length > 0;
  const { showToast } = useToast();

  const processLoadedLyrics = React.useCallback(async ({ content, fileName, filePath }) => {
    try {
      const lower = (fileName || '').toLowerCase();
      let processedLines = [];
      let rawText = content || '';
      if (lower.endsWith('.lrc')) {
        const parsed = parseLrcText(content || '');
        processedLines = parsed.processedLines;
        rawText = parsed.rawText;
      } else {
        processedLines = processRawTextToLines(content || '');
      }

      setLyrics(processedLines);
      setRawLyricsContent(rawText);
      selectLine(null);
      const baseName = (fileName || '').replace(/\.(txt|lrc)$/i, '');
      setLyricsFileName(baseName);

      // Emit to connected outputs and broadcast filename
      emitLyricsLoad(processedLines);
      if (socket && socket.connected && baseName) {
        socket.emit('fileNameUpdate', baseName);
      }

      // Ensure file is in recent list
      try {
        if (filePath && window?.electronAPI?.addRecentFile) {
          await window.electronAPI.addRecentFile(filePath);
        }
      } catch {}

      showToast({ title: 'File loaded', message: `${lower.endsWith('.lrc') ? 'LRC' : 'Text'}: ${baseName}`, variant: 'success' });
    } catch (err) {
      console.error('Failed to open file:', err);
      showToast({ title: 'Failed to open file', message: 'The file could not be processed.', variant: 'error' });
    }
  }, [emitLyricsLoad, selectLine, setLyrics, setRawLyricsContent, setLyricsFileName, showToast, socket]);

  // Handle opening lyrics directly from a file path via menu (recent files)
  React.useEffect(() => {
    if (!window?.electronAPI?.onOpenLyricsFromPath) return;
    const off = window.electronAPI.onOpenLyricsFromPath(async (payload) => {
      await processLoadedLyrics(payload || {});
    });
    return () => { try { off?.(); } catch {} };
  }, [processLoadedLyrics]);

  // Show toast if a recent file no longer exists
  React.useEffect(() => {
    if (!window?.electronAPI?.onOpenLyricsFromPathError) return;
    const off = window.electronAPI.onOpenLyricsFromPathError(({ filePath }) => {
      showToast({
        title: 'File not found',
        message: `The file could not be opened. It may have been moved or deleted.\n${filePath || ''}`,
        variant: 'error'
      });
    });
    return () => { try { off?.(); } catch {} };
  }, [showToast]);

  // Handle load triggered from File menu using native dialog (renderer dispatches DOM event)
  React.useEffect(() => {
    const listener = (e) => {
      const payload = e?.detail || {};
      processLoadedLyrics(payload);
    };
    window.addEventListener('lyrics-opened', listener);
    return () => window.removeEventListener('lyrics-opened', listener);
  }, [processLoadedLyrics]);

  // Font options for dropdown
  const fontOptions = [
    'Arial',
    'Calibri',
    'Bebas Neue',
    'Fira Sans',
    'GarnetCapitals',
    'Inter',
    'Lato',
    'Montserrat',
    'Noto Sans',
    'Open Sans',
    'Poppins',
    'Roboto',
    'Work Sans'
  ];

  // Handle file upload button click
  const openFileDialog = async () => {
    try {
      if (window?.electronAPI?.loadLyricsFile) {
        const result = await window.electronAPI.loadLyricsFile();
        if (result && result.success && result.content) {
          const payload = { content: result.content, fileName: result.fileName, filePath: result.filePath };
          window.dispatchEvent(new CustomEvent('lyrics-opened', { detail: payload }));
          return;
        }
        if (result && result.canceled) return;
      }
    } catch {}
    fileInputRef.current?.click();
  };

  // Handle create new song
  const handleCreateNewSong = () => {
    navigate('/new-song?mode=new');
  };

  // Handle edit current lyrics
  const handleEditLyrics = () => {
    navigate('/new-song?mode=edit');
  };

  // Handle setlist modal
  const handleOpenSetlist = () => {
    setSetlistModalOpen(true);
  };

  // Handle online lyrics search modal
  const handleOpenOnlineLyricsSearch = () => {
    setOnlineLyricsModalOpen(true);
  };

  const handleCloseOnlineLyricsSearch = () => {
    setOnlineLyricsModalOpen(false);
  };

  // Handle file input change
  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    const name = file?.name?.toLowerCase?.() || '';
    if (file && (file.type === 'text/plain' || name.endsWith('.txt') || name.endsWith('.lrc'))) {
      clearSearch();
      await handleFileUpload(file);
    }
  };

  // Handle line selection
  const handleLineSelect = (index) => {
    selectLine(index);
    emitLineUpdate(index);
  };

  // Search behavior moved to hook

  // Settings helpers moved to hook

  // Handle output toggle
  const handleToggle = () => {
    setIsOutputOn(!isOutputOn);
    emitOutputToggle(!isOutputOn);
  };

  // Setlist actions
  const { isFileAlreadyInSetlist, handleAddToSetlist, disabled: addDisabled, title: addTitle } = useSetlistActions(emitSetlistAdd);

  // If not desktop app, show mobile layout
  if (!isDesktopApp) {
    return <MobileLayout />;
  }

  return (
    <div className={`flex h-screen font-sans ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      {/* Left Sidebar - Control Panel */}
      <div className={`w-[420px] shadow-lg p-6 overflow-y-auto ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>LyricDisplay</h1>
          <div className="flex items-center gap-2">
            {/* Online Lyrics Search Button */}
            <button
              className={`p-2 rounded font-medium transition-colors ${darkMode
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              title="Search online for lyrics"
              onClick={handleOpenOnlineLyricsSearch}
            >
              <Globe className="w-5 h-5" />
            </button>

            {/* Setlist Button */}
            <button
              className={`p-2 rounded font-medium transition-colors ${darkMode
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              title="Open setlist"
              onClick={handleOpenSetlist}
            >
              <List className="w-5 h-5" />
            </button>

            {/* Sync Outputs Button - Icon Only */}
            <button
              className={`p-2 rounded font-medium transition-colors ${darkMode
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              title="Sync current state to outputs"
              onClick={() => {
                if (lyrics && lyrics.length > 0) {
                  emitLyricsLoad(lyrics);
                  if (selectedLine !== null && selectedLine !== undefined) {
                    emitLineUpdate(selectedLine);
                  }
                  if (output1Settings) {
                    emitStyleUpdate('output1', output1Settings);
                  }
                  if (output2Settings) {
                    emitStyleUpdate('output2', output2Settings);
                  }
                }
                emitOutputToggle(isOutputOn);
              }}
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Load and Create Buttons */}
        <div className="flex gap-3 mb-3">
          <button
            className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-400 to-purple-600 text-white rounded-xl font-medium hover:from-blue-500 hover:to-purple-700 transition-all duration-200 flex items-center justify-center gap-2"
            onClick={openFileDialog}
          >
            <FolderOpen className="w-5 h-5" />
            Load lyrics file (.txt, .lrc)
          </button>
          <button
            className={`h-[52px] w-[52px] rounded-xl font-medium transition-all duration-200 flex items-center justify-center ${darkMode
              ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
              : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            onClick={handleCreateNewSong}
            title="Create new lyrics"
          >
            <FileText className="w-5 h-5" />
          </button>
        </div>
        <input
          type="file"
          accept=".txt,.lrc"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {/* Current File Indicator */}
        {hasLyrics && (
          <div className={`mb-6 text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {lyricsFileName}
          </div>
        )}

        {/* Output Toggle */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4 mx-2">
            <Switch
              checked={isOutputOn}
              onCheckedChange={handleToggle}
              className={`
                scale-[1.8]
                ${darkMode
                  ? "data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600"
                  : "data-[state=checked]:bg-black"}
              `}
            />
            <span className={`text-sm ml-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              {isOutputOn ? 'Display Output is ON' : 'Display Output is OFF'}
            </span>
          </div>
        </div>

        <div className={`border-t my-10 ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}></div>

        {/* Output Settings */}
        <div className="mb-6">
          <OutputSettingsPanel
            outputKey={activeTab}
            settings={getCurrentSettings()}
            updateSettings={updateSettings}
            fontOptions={fontOptions}
          />
        </div>

        {/* Output Tabs */}
        <div className={`flex rounded-lg overflow-hidden border ${darkMode ? 'border-gray-600' : 'border-gray-200'}`}>
          <button
            className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${activeTab === 'output1'
              ? 'bg-black text-white'
              : darkMode
                ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            onClick={() => setActiveTab('output1')}
          >
            Output 1
          </button>
          <button
            className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${activeTab === 'output2'
              ? 'bg-black text-white'
              : darkMode
                ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            onClick={() => setActiveTab('output2')}
          >
            Output 2
          </button>
        </div>

        <div className={`border-t my-10 ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}></div>

        <div className={`mt-4 text-[12px] text-left ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          Designed and Developed by Peter Alakembi and David Okaliwe for Victory City Media. ©2025 All Rights Reserved.
        </div>
      </div>

      {/* Right Main Area */}
      <div className="flex-1 p-6 flex flex-col h-screen">
        {/* Fixed Header */}
        <div className="mb-6 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {hasLyrics ? lyricsFileName : ''}
            </h2>
            {hasLyrics && (
              <div className="flex items-center gap-2">
                {/* Add to Setlist Button */}
                <button
                  onClick={handleAddToSetlist}
                  aria-disabled={addDisabled}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-colors ${addDisabled
                    ? (darkMode ? 'bg-gray-700 text-gray-500' : 'bg-gray-100 text-gray-400')
                    : (darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700')
                    }`}
                  title={addTitle}
                  style={{ cursor: addDisabled ? 'not-allowed' : 'pointer', opacity: addDisabled ? 0.9 : 1 }}
                >
                  <Plus className="w-4 h-4" />
                  Add to Setlist
                </button>

                {/* Edit Button */}
                <button
                  onClick={handleEditLyrics}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-colors ${darkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
              </div>
            )}
          </div>

          {/* Search Bar */}
          {hasLyrics && (
            <div className="mt-3 w-full">
              <SearchBar
                darkMode={darkMode}
                searchQuery={searchQuery}
                onSearch={handleSearch}
                totalMatches={totalMatches}
                currentMatchIndex={currentMatchIndex}
                onPrev={navigateToPreviousMatch}
                onNext={navigateToNextMatch}
                onClear={clearSearch}
              />
            </div>
          )}
        </div>

        {/* Scrollable Content Area */}
        <div className={`rounded-lg shadow-sm border flex-1 flex flex-col overflow-hidden ${darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'
          }`}>
          {hasLyrics ? (
            <div
              ref={lyricsContainerRef}
              className="p-4 flex-1 overflow-y-auto"
              onDrop={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files && e.dataTransfer.files[0];
                const name = file?.name?.toLowerCase?.() || '';
                if (file && (file.type === 'text/plain' || name.endsWith('.txt') || name.endsWith('.lrc'))) {
                  clearSearch();
                  await handleFileUpload(file);
                }
              }}
              onDragOver={e => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDragEnter={e => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <LyricsList
                lyrics={lyrics}
                selectedLine={selectedLine}
                onSelectLine={handleLineSelect}
                searchQuery={searchQuery}
                highlightedLineIndex={highlightedLineIndex}
              />
            </div>
          ) : (
            /* Empty State - Drag and Drop */
            <div
              className="flex-1 flex items-center justify-center"
              onDrop={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files && e.dataTransfer.files[0];
                const name = file?.name?.toLowerCase?.() || '';
                if (file && (file.type === 'text/plain' || name.endsWith('.txt') || name.endsWith('.lrc'))) {
                  await handleFileUpload(file);
                }
              }}
              onDragOver={e => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDragEnter={e => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <div className="text-center">
                <div className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${darkMode ? 'bg-gray-700' : 'bg-gray-200'
                  }`}>
                  <FolderOpen className={`w-10 h-10 ${darkMode ? 'text-gray-400' : 'text-gray-400'}`} />
                </div>
                <p className={`text-lg ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Drag and drop TXT lyric files here
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Setlist Modal */}
      <SetlistModal />

      {/* Online Lyrics Search Modal */}
      <OnlineLyricsSearchModal
        isOpen={onlineLyricsModalOpen}
        onClose={handleCloseOnlineLyricsSearch}
        darkMode={darkMode}
      />
    </div>
  );
};

export default LyricDisplayApp;
