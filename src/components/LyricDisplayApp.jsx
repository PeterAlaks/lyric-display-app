import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, FolderOpen, FileText, X, Edit, ChevronUp, ChevronDown, List, Globe } from 'lucide-react';
import useLyricsStore from '../context/LyricsStore';
import useSocket from '../hooks/useSocket';
import useFileUpload from '../hooks/useFileUpload';
import LyricsList from './LyricsList';
import MobileLayout from './MobileLayout';
import SetlistModal from './SetlistModal';
import OnlineLyricsSearchModal from './OnlineLyricsSearchModal';
import { getLineSearchText } from '../utils/parseLyrics';
import OutputSettingsPanel from './OutputSettingsPanel';
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

// Main App Component
const LyricDisplayApp = () => {
  const navigate = useNavigate();

  // Global state management
  const {
    isOutputOn,
    setIsOutputOn,
    lyrics,
    lyricsFileName,
    selectedLine,
    selectLine,
    output1Settings,
    output2Settings,
    updateOutputSettings,
    darkMode,
    setDarkMode,
    isDesktopApp,
    setlistModalOpen,
    setSetlistModalOpen,
  } = useLyricsStore();

  // Handle dark mode toggle from Electron menu
  React.useEffect(() => {
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

  // Menu event handlers
  React.useEffect(() => {
    if (window.electronAPI) {
      // Handle Ctrl+O - Load Lyrics File
      const handleTriggerFileLoad = () => {
        fileInputRef.current?.click();
      };

      // Handle Ctrl+N - New Lyrics File
      const handleNavigateToNewSong = () => {
        navigate('/new-song?mode=new');
      };

      window.electronAPI.onTriggerFileLoad(handleTriggerFileLoad);
      window.electronAPI.onNavigateToNewSong(handleNavigateToNewSong);

      return () => {
        window.electronAPI.removeAllListeners('trigger-file-load');
        window.electronAPI.removeAllListeners('navigate-to-new-song');
      };
    }
  }, [navigate]);

  const { emitOutputToggle, emitLineUpdate, emitLyricsLoad, emitStyleUpdate, emitRequestSetlist } = useSocket('control');

  // File upload functionality
  const handleFileUpload = useFileUpload();
  const fileInputRef = useRef(null);

  // Tabs
  const [activeTab, setActiveTab] = React.useState('output1');

  // Online lyrics search modal state
  const [onlineLyricsModalOpen, setOnlineLyricsModalOpen] = React.useState(false);

  // Search state - Enhanced navigation
  const [searchQuery, setSearchQuery] = React.useState('');
  const [highlightedLineIndex, setHighlightedLineIndex] = React.useState(null);
  const [currentMatchIndex, setCurrentMatchIndex] = React.useState(0);
  const [totalMatches, setTotalMatches] = React.useState(0);
  const [allMatchIndices, setAllMatchIndices] = React.useState([]);

  // Ref for scrollable container
  const lyricsContainerRef = useRef(null);

  // Check if lyrics are loaded
  const hasLyrics = lyrics && lyrics.length > 0;

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
  const openFileDialog = () => {
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
    if (file && file.type === 'text/plain') {
      // Clear search when new file is loaded
      setSearchQuery('');
      setHighlightedLineIndex(null);
      setCurrentMatchIndex(0);
      setTotalMatches(0);
      setAllMatchIndices([]);
      await handleFileUpload(file);
    }
  };

  // Handle line selection
  const handleLineSelect = (index) => {
    selectLine(index);
    emitLineUpdate(index);
  };

  // Find all matching lines
  const findAllMatches = (query) => {
    if (!query.trim() || !lyrics || lyrics.length === 0) {
      return [];
    }

    const matchIndices = [];
    lyrics.forEach((line, index) => {
      // Use the helper function to get searchable text for both string and group types
      const searchText = getLineSearchText(line);
      if (searchText.toLowerCase().includes(query.toLowerCase())) {
        matchIndices.push(index);
      }
    });

    return matchIndices;
  };

  // Scroll to specific line
  const scrollToLine = (lineIndex) => {
    setTimeout(() => {
      const container = lyricsContainerRef.current;
      if (container) {
        const lineElements = container.querySelectorAll('[data-line-index]');
        const targetElement = lineElements[lineIndex];

        if (targetElement) {
          targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
      }
    }, 50);
  };

  // Navigate to specific match
  const navigateToMatch = (matchIndex) => {
    if (allMatchIndices.length === 0) return;

    const clampedIndex = Math.max(0, Math.min(matchIndex, allMatchIndices.length - 1));
    const lineIndex = allMatchIndices[clampedIndex];

    setCurrentMatchIndex(clampedIndex);
    setHighlightedLineIndex(lineIndex);
    scrollToLine(lineIndex);
  };

  // Navigate to next match
  const navigateToNextMatch = () => {
    if (allMatchIndices.length === 0) return;

    const nextIndex = currentMatchIndex >= allMatchIndices.length - 1 ? 0 : currentMatchIndex + 1;
    navigateToMatch(nextIndex);
  };

  // Navigate to previous match
  const navigateToPreviousMatch = () => {
    if (allMatchIndices.length === 0) return;

    const prevIndex = currentMatchIndex <= 0 ? allMatchIndices.length - 1 : currentMatchIndex - 1;
    navigateToMatch(prevIndex);
  };

  // Handle keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.shiftKey && searchQuery && allMatchIndices.length > 0) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          navigateToPreviousMatch();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          navigateToNextMatch();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery, allMatchIndices, currentMatchIndex]);

  // Enhanced search handler
  const handleSearch = (query) => {
    setSearchQuery(query);

    if (!query.trim()) {
      setHighlightedLineIndex(null);
      setCurrentMatchIndex(0);
      setTotalMatches(0);
      setAllMatchIndices([]);
      return;
    }

    // Find all matches
    const matchIndices = findAllMatches(query);
    setAllMatchIndices(matchIndices);
    setTotalMatches(matchIndices.length);

    if (matchIndices.length > 0) {
      // Start with first match
      setCurrentMatchIndex(0);
      setHighlightedLineIndex(matchIndices[0]);
      scrollToLine(matchIndices[0]);
    } else {
      setHighlightedLineIndex(null);
      setCurrentMatchIndex(0);
    }
  };

  // Clear search function
  const clearSearch = () => {
    setSearchQuery('');
    setHighlightedLineIndex(null);
    setCurrentMatchIndex(0);
    setTotalMatches(0);
    setAllMatchIndices([]);
  };

  // Get current settings based on active tab
  const getCurrentSettings = () => {
    return activeTab === 'output1' ? output1Settings : output2Settings;
  };

  // Update settings based on active tab
  const updateSettings = (newSettings) => {
    const outputKey = activeTab === 'output1' ? 'output1' : 'output2';
    updateOutputSettings(outputKey, newSettings);
    emitStyleUpdate(outputKey, newSettings);
  };

  // Handle output toggle
  const handleToggle = () => {
    setIsOutputOn(!isOutputOn);
    emitOutputToggle(!isOutputOn);
  };

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
            Load lyrics file (.txt)
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
          accept=".txt"
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
                  ? "data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-600"
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
            )}
          </div>

          {/* Search Bar */}
          {hasLyrics && (
            <div className="mt-3 w-full">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search lyrics..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className={`border rounded-md w-full pr-24 ${darkMode
                    ? 'border-gray-600 bg-gray-800 text-white placeholder-gray-400'
                    : 'border-gray-300 bg-white'
                    }`}
                />
                <div className="absolute right-1 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
                  {searchQuery && allMatchIndices.length > 0 && (
                    <>
                      <button
                        onClick={navigateToPreviousMatch}
                        className={`p-1 rounded transition-colors ${darkMode
                          ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                          }`}
                        title="Previous match (Shift+Up)"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={navigateToNextMatch}
                        className={`p-1 rounded transition-colors ${darkMode
                          ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                          }`}
                        title="Next match (Shift+Down)"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {searchQuery && (
                    <button
                      onClick={clearSearch}
                      className={`p-1 rounded transition-colors ${darkMode
                        ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                        }`}
                      title="Clear search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Match Counter */}
              {searchQuery && (
                <div className={`mt-2 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                  {totalMatches > 0 ? (
                    `Showing result ${currentMatchIndex + 1} of ${totalMatches} matches`
                  ) : (
                    'No matches found'
                  )}
                </div>
              )}
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
                if (file && file.type === 'text/plain') {
                  setSearchQuery('');
                  setHighlightedLineIndex(null);
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
                if (file && file.type === 'text/plain') {
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