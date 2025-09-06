import React, { useRef } from 'react';
import { List, RefreshCw, ChevronUp, ChevronDown, X } from 'lucide-react';
import useLyricsStore from '../context/LyricsStore';
import useSocket from '../hooks/useSocket';
import LyricsList from './LyricsList';
import { getLineSearchText } from '../utils/parseLyrics';
import SetlistModal from './SetlistModal';
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

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

  const [searchQuery, setSearchQuery] = React.useState('');
  const [highlightedLineIndex, setHighlightedLineIndex] = React.useState(null);
  const [currentMatchIndex, setCurrentMatchIndex] = React.useState(0);
  const [totalMatches, setTotalMatches] = React.useState(0);
  const [allMatchIndices, setAllMatchIndices] = React.useState([]);
  const lyricsContainerRef = useRef(null);

  const hasLyrics = lyrics && lyrics.length > 0;

  const handleLineSelect = (index) => {
    selectLine(index);
    emitLineUpdate(index);
  };

  const handleToggle = () => {
    setIsOutputOn(!isOutputOn);
    emitOutputToggle(!isOutputOn);
  };

  const findAllMatches = (query) => {
    if (!query.trim() || !lyrics || lyrics.length === 0) return [];

    const matchIndices = [];
    lyrics.forEach((line, index) => {
      const searchText = getLineSearchText(line);
      if (searchText.toLowerCase().includes(query.toLowerCase())) {
        matchIndices.push(index);
      }
    });
    return matchIndices;
  };

  const scrollToLine = (lineIndex) => {
    setTimeout(() => {
      const container = lyricsContainerRef.current;
      if (container) {
        const lineElements = container.querySelectorAll('[data-line-index]');
        const targetElement = lineElements[lineIndex];
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }, 50);
  };

  const navigateToMatch = (matchIndex) => {
    if (allMatchIndices.length === 0) return;
    const clampedIndex = Math.max(0, Math.min(matchIndex, allMatchIndices.length - 1));
    const lineIndex = allMatchIndices[clampedIndex];
    setCurrentMatchIndex(clampedIndex);
    setHighlightedLineIndex(lineIndex);
    scrollToLine(lineIndex);
  };

  const navigateToNextMatch = () => {
    if (allMatchIndices.length === 0) return;
    const nextIndex =
      currentMatchIndex >= allMatchIndices.length - 1 ? 0 : currentMatchIndex + 1;
    navigateToMatch(nextIndex);
  };

  const navigateToPreviousMatch = () => {
    if (allMatchIndices.length === 0) return;
    const prevIndex =
      currentMatchIndex <= 0 ? allMatchIndices.length - 1 : currentMatchIndex - 1;
    navigateToMatch(prevIndex);
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setHighlightedLineIndex(null);
      setCurrentMatchIndex(0);
      setTotalMatches(0);
      setAllMatchIndices([]);
      return;
    }
    const matchIndices = findAllMatches(query);
    setAllMatchIndices(matchIndices);
    setTotalMatches(matchIndices.length);
    if (matchIndices.length > 0) {
      setCurrentMatchIndex(0);
      setHighlightedLineIndex(matchIndices[0]);
      scrollToLine(matchIndices[0]);
    } else {
      setHighlightedLineIndex(null);
      setCurrentMatchIndex(0);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setHighlightedLineIndex(null);
    setCurrentMatchIndex(0);
    setTotalMatches(0);
    setAllMatchIndices([]);
  };

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
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Search lyrics..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className={`w-full pr-24 ${darkMode
                      ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400'
                      : 'border-gray-300 bg-white'
                      }`}
                  />
                  {searchQuery && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {allMatchIndices.length > 0 && (
                        <>
                          <button
                            onClick={navigateToPreviousMatch}
                            className={`p-1.5 rounded-md transition-colors ${darkMode
                              ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-600'
                              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                              }`}
                            title="Previous match"
                            disabled={allMatchIndices.length === 0}
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={navigateToNextMatch}
                            className={`p-1.5 rounded-md transition-colors ${darkMode
                              ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-600'
                              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                              }`}
                            title="Next match"
                            disabled={allMatchIndices.length === 0}
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={clearSearch}
                        className={`p-1.5 rounded-md transition-colors ${darkMode
                          ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-600'
                          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                          }`}
                        title="Clear search"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                {searchQuery && (
                  <div className={`text-xs mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                    {totalMatches > 0
                      ? `Showing result ${currentMatchIndex + 1} of ${totalMatches} matches`
                      : 'No matches found'}
                  </div>
                )}
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