import React from 'react';
import { List, RefreshCw } from 'lucide-react';
import useLyricsStore from '../context/LyricsStore';
import useSocket from '../hooks/useSocket';
import LyricsList from './LyricsList';
import SetlistModal from './SetlistModal';
import { Switch } from "@/components/ui/switch";
import useSearch from '../hooks/useSearch';
import SearchBar from './SearchBar';

const MobileLayout = () => {
  const {
    isOutputOn,
    setIsOutputOn,
    lyrics,
    lyricsFileName,
    selectedLine,
    selectLine,
    darkMode,
    setlistModalOpen,
    setSetlistModalOpen,
    setlistFiles,
  } = useLyricsStore();

  const { emitOutputToggle, emitLineUpdate, emitLyricsLoad } = useSocket('control');

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

  const hasLyrics = lyrics && lyrics.length > 0;

  const handleLineSelect = (index) => {
    selectLine(index);
    emitLineUpdate(index);
  };

  const handleToggle = () => {
    setIsOutputOn(!isOutputOn);
    emitOutputToggle(!isOutputOn);
  };

  // Search logic handled via useSearch hook

  const handleOpenSetlist = () => {
    setSetlistModalOpen(true);
  };

  const handleSyncOutputs = () => {
    if (lyrics && lyrics.length > 0) {
      emitLyricsLoad(lyrics);
      if (selectedLine !== null && selectedLine !== undefined) {
        emitLineUpdate(selectedLine);
      }
    }
    emitOutputToggle(isOutputOn);
  };

  return (
    <div
      className={`flex flex-col h-screen font-sans ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'
        }`}
    >
      {/* Fixed Header */}
      <div
        className={`shadow-sm border-b px-6 py-6 flex-shrink-0 ${darkMode
          ? 'bg-gray-800 border-gray-700'
          : 'bg-white border-gray-200'
          }`}
      >
        {/* Top Row - Title and Controls */}
        <div className="flex items-center justify-between mb-6">
          <h1
            className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'
              }`}
          >
            LyricDisplay
          </h1>
          <div className="flex items-center gap-3">
            {/* Setlist Button */}
            <button
              onClick={handleOpenSetlist}
              className={`p-2.5 rounded-lg transition-colors ${darkMode
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              title="Open setlist"
            >
              <List className="w-5 h-5" />
            </button>
            {/* Sync Outputs Button */}
            <button
              onClick={handleSyncOutputs}
              className={`p-2.5 rounded-lg transition-colors ${darkMode
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              title="Sync outputs"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toggle Row */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <Switch
            checked={isOutputOn}
            onCheckedChange={handleToggle}
            className={`scale-[1.5] ${darkMode
              ? 'data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-600'
              : 'data-[state=checked]:bg-black'
              }`}
          />
          <span
            className={`text-sm ml-3 ${darkMode ? 'text-gray-300' : 'text-gray-600'
              }`}
          >
            {isOutputOn ? 'Display Output is ON' : 'Display Output is OFF'}
          </span>
        </div>

        {/* Current File Indicator */}
        {hasLyrics && (
          <div
            className={`px-4 py-3 text-sm font-semibold border-t mt-4 ${darkMode
              ? 'text-gray-300 border-gray-600'
              : 'text-gray-600 border-gray-200'
              }`}
          >
            {lyricsFileName}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-4 flex flex-col min-h-0">
        <div
          className={`rounded-xl shadow-sm border flex-1 flex flex-col overflow-hidden ${darkMode
            ? 'bg-gray-800 border-gray-600'
            : 'bg-white border-gray-200'
            }`}
        >
          {hasLyrics ? (
            <>
              {/* Fixed Search Bar */}
              <div className={`border-b px-4 py-4 flex-shrink-0 ${darkMode
                ? 'border-gray-600 bg-gray-800'
                : 'border-gray-200 bg-white'
                }`}>
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

              {/* Scrollable Lyrics List */}
              <div
                ref={lyricsContainerRef}
                className="flex-1 overflow-y-auto p-4"
              >
                <LyricsList
                  lyrics={lyrics}
                  selectedLine={selectedLine}
                  onSelectLine={handleLineSelect}
                  searchQuery={searchQuery}
                  highlightedLineIndex={highlightedLineIndex}
                />
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <div
                  className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${darkMode ? 'bg-gray-700' : 'bg-gray-200'
                    }`}
                >
                  <List
                    className={`w-8 h-8 ${darkMode ? 'text-gray-400' : 'text-gray-400'
                      }`}
                  />
                </div>
                <p
                  className={`text-lg mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}
                >
                  No lyrics loaded
                </p>
                <p
                  className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'
                    }`}
                >
                  {setlistFiles.length > 0
                    ? 'Select a song from the setlist to begin'
                    : 'Files can be added to setlist from desktop app'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fixed Footer */}
      <div
        className={`px-4 py-3 text-center text-xs border-t flex-shrink-0 ${darkMode
          ? 'text-gray-400 bg-gray-800 border-gray-700'
          : 'text-gray-600 bg-gray-50 border-gray-200'
          }`}
      >
        Designed and Developed by Peter Alakembi and David Okaliwe for Victory City Media. ©2025 All Rights Reserved.
      </div>

      {/* Setlist Modal */}
      <SetlistModal />
    </div>
  );
};

export default MobileLayout;
