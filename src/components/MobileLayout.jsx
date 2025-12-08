import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ListMusic, RefreshCw, FileText, Play, Square, ChevronDown, Sparkles } from 'lucide-react';
import { useLyricsState, useOutputState, useDarkModeState, useSetlistState, useAutoplaySettings, useIntelligentAutoplayState } from '../hooks/useStoreSelectors';
import { useControlSocket } from '../context/ControlSocketProvider';
import LyricsList from './LyricsList';
import ConnectionBackoffBanner from './ConnectionBackoffBanner';
import SetlistModal from './SetlistModal';
import { Switch } from "@/components/ui/switch";
import useSearch from '../hooks/useSearch';
import SearchBar from './SearchBar';
import { useSyncTimer } from '../hooks/useSyncTimer';
import useToast from '../hooks/useToast';
import useModal from '../hooks/useModal';
import { hasValidTimestamps } from '../utils/timestampHelpers';
import { useAutoplayManager } from '../hooks/useAutoplayManager';
import { useSyncOutputs } from '../hooks/useSyncOutputs';

const MobileLayout = () => {
  const { isOutputOn, setIsOutputOn } = useOutputState();
  const { lyrics, lyricsFileName, selectedLine, lyricsTimestamps, selectLine } = useLyricsState();
  const { darkMode } = useDarkModeState();
  const { setlistModalOpen, setSetlistModalOpen, setlistFiles } = useSetlistState();
  const { settings: autoplaySettings, setSettings: setAutoplaySettings } = useAutoplaySettings();
  const { hasSeenIntelligentAutoplayInfo, setHasSeenIntelligentAutoplayInfo } = useIntelligentAutoplayState();

  const { emitOutputToggle, emitLineUpdate, emitLyricsLoad, emitAutoplayStateUpdate, isAuthenticated, connectionStatus, ready, lastSyncTime, isConnected } = useControlSocket();

  const secondsAgo = useSyncTimer(lastSyncTime);

  const {
    containerRef: lyricsContainerRef, searchQuery, highlightedLineIndex, currentMatchIndex, totalMatches, handleSearch, clearSearch, navigateToNextMatch, navigateToPreviousMatch, } = useSearch(lyrics);

  const hasLyrics = lyrics && lyrics.length > 0;
  const { showToast } = useToast();
  const { showModal } = useModal();

  const navigate = useNavigate();

  const {
    autoplayActive,
    intelligentAutoplayActive,
    remoteAutoplayActive,
    handleAutoplayToggle,
    handleIntelligentAutoplayToggle,
    handleOpenAutoplaySettings
  } = useAutoplayManager({
    lyrics,
    lyricsTimestamps,
    selectedLine,
    autoplaySettings,
    setAutoplaySettings,
    selectLine,
    emitLineUpdate,
    showToast,
    showModal,
    hasLyrics,
    lyricsFileName,
    hasSeenIntelligentAutoplayInfo,
    setHasSeenIntelligentAutoplayInfo,
    emitAutoplayStateUpdate,
    isConnected,
    isAuthenticated,
    ready,
    clientType: 'mobile'
  });

  const { handleSyncOutputs } = useSyncOutputs({
    isConnected,
    isAuthenticated,
    ready,
    lyrics,
    selectedLine,
    isOutputOn,
    emitLyricsLoad,
    emitLineUpdate,
    emitOutputToggle,
    showToast
  });

  const iconButtonClass = (disabled = false) => {
    const base = 'p-2.5 rounded-lg transition-colors';
    if (disabled) {
      return `${base} ${darkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed opacity-50' : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'}`;
    }
    return `${base} ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`;
  };

  React.useEffect(() => {
    const handleDraftRejected = (event) => {
      const { title, reason } = event.detail;
      showModal({
        title: 'Draft Rejected',
        headerDescription: `Your draft "${title}" was rejected by the control panel`,
        description: reason || 'No reason provided',
        variant: 'error',
        dismissLabel: 'Understood',
      });
    };

    window.addEventListener('draft-rejected', handleDraftRejected);

    return () => {
      window.removeEventListener('draft-rejected', handleDraftRejected);
    };
  }, [showModal]);

  const handleLineSelect = (index) => {
    if (!isAuthenticated || !ready) {
      return;
    }
    selectLine(index);
    emitLineUpdate(index);
  };

  const handleToggle = () => {
    setIsOutputOn(!isOutputOn);
    emitOutputToggle(!isOutputOn);
  };

  const handleOpenSetlist = () => {
    setSetlistModalOpen(true);
  };

  return (
    <>
      <ConnectionBackoffBanner darkMode={darkMode} />
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
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <img
                src="/LyricDisplay-icon.png"
                alt="LyricDisplay"
                className="h-9 w-9"
              />
              <div>
                <h1
                  className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}
                >
                  LyricDisplay
                </h1>
                {lastSyncTime && (
                  <p className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    Last synced {secondsAgo}s ago
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Setlist Button */}
              <button
                onClick={handleOpenSetlist}
                className={iconButtonClass(false)}
                title="Open setlist"
              >
                <ListMusic className="w-5 h-5" />
              </button>
              {/* Sync Outputs Button */}
              <button
                onClick={handleSyncOutputs}
                disabled={!isConnected || !isAuthenticated || !ready}
                className={iconButtonClass(!isConnected || !isAuthenticated || !ready)}
                title={(!isConnected || !isAuthenticated || !ready) ? "Cannot sync - not connected or authenticated" : "Sync outputs"}
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  showModal({
                    title: 'Mobile Controller Help',
                    component: 'MobileControllerHelp',
                    variant: 'info',
                    size: 'large',
                    dismissLabel: 'Got it'
                  });
                }}
                className={iconButtonClass(false)}
                title="Help"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Compose New Lyrics Button and Toggle Row */}
          <div className="mb-8 space-y-3">
            {/* Compose Button and Toggle */}
            <div className="flex items-center justify-center gap-8">
              <button
                onClick={() => navigate('/new-song?mode=compose')}
                className={`w-full md:max-w-md py-3 px-4 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 min-w-0 ${darkMode
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white'
                  : 'bg-gradient-to-r from-blue-400 to-purple-600 hover:from-blue-500 hover:to-purple-700 text-white'
                  }`}
              >
                <FileText className="w-5 h-5 flex-shrink-0" />
                <span className="truncate">Create Lyrics</span>
              </button>

              {/* Toggle Display Switch */}
              <div className="flex items-center gap-5 flex-shrink-0">
                <Switch
                  checked={isOutputOn}
                  onCheckedChange={handleToggle}
                  className={`scale-[1.6] ${darkMode
                    ? 'data-[state=checked]:bg-green-500 data[state=unchecked]:bg-gray-600'
                    : 'data-[state=checked]:bg-black'
                    }`}
                />
                <span
                  className={`text-xs whitespace-nowrap ${darkMode ? 'text-gray-300' : 'text-gray-600'
                    }`}
                >
                  {isOutputOn ? 'Output ON' : 'Output OFF'}
                </span>
              </div>
            </div>
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
                {/* Fixed Search Bar and Autoplay */}
                <div className={`border-b px-4 py-4 flex-shrink-0 ${darkMode
                  ? 'border-gray-600 bg-gray-800'
                  : 'border-gray-200 bg-white'
                  }`}>

                  {/* Search Bar and Autoplay Controls */}
                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    {/* Search Bar */}
                    <div className="flex-1">
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

                    {/* Autoplay Controls */}
                    <div className="flex gap-2 md:w-auto md:flex-shrink-0">
                      {/* Intelligent Autoplay Button */}
                      {hasValidTimestamps(lyricsTimestamps) && (
                        <button
                          onClick={handleIntelligentAutoplayToggle}
                          disabled={remoteAutoplayActive || autoplayActive}
                          className={`p-2.5 rounded-lg text-sm font-medium transition-all ${remoteAutoplayActive || autoplayActive
                            ? 'bg-gray-400 text-gray-600 cursor-not-allowed opacity-60'
                            : intelligentAutoplayActive
                              ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white'
                              : darkMode
                                ? 'bg-gradient-to-r from-purple-600/20 to-blue-600/20 hover:from-purple-600/30 hover:to-blue-600/30 text-purple-300 border border-purple-500/30'
                                : 'bg-gradient-to-r from-purple-100 to-blue-100 hover:from-purple-200 hover:to-blue-200 text-purple-700 border border-purple-300'
                            }`}
                          title={
                            remoteAutoplayActive || autoplayActive
                              ? "Autoplay is active"
                              : intelligentAutoplayActive
                                ? "Stop intelligent autoplay"
                                : "Start intelligent autoplay"
                          }
                        >
                          <Sparkles className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        onClick={handleAutoplayToggle}
                        disabled={remoteAutoplayActive || intelligentAutoplayActive}
                        className={`flex-1 md:flex-initial md:min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${remoteAutoplayActive || intelligentAutoplayActive
                          ? 'bg-gray-400 text-gray-600 cursor-not-allowed opacity-60'
                          : autoplayActive
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : darkMode
                              ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                          }`}
                      >
                        {autoplayActive ? (
                          <>
                            <Square className="w-4 h-4 fill-current" />
                            <span className="hidden md:inline">Stop</span>
                            <span className="md:hidden">Stop Autoplay</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4" />
                            <span className="hidden md:inline">Autoplay</span>
                            <span className="md:hidden">Start Autoplay</span>
                          </>
                        )}
                      </button>

                      {/* Settings Button */}
                      {!autoplayActive && !remoteAutoplayActive && !intelligentAutoplayActive && (
                        <button
                          onClick={handleOpenAutoplaySettings}
                          className={`p-2.5 rounded-lg transition-colors ${darkMode
                            ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                            }`}
                          title="Autoplay settings"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Scrollable Lyrics List */}
                <div
                  ref={lyricsContainerRef}
                  className="flex-1 overflow-y-auto"
                >
                  <LyricsList
                    searchQuery={searchQuery}
                    highlightedLineIndex={highlightedLineIndex}
                    onSelectLine={handleLineSelect}
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
                    <ListMusic
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
          © 2025 LyricDisplay. All rights reserved. Designed and developed by Peter Alakembi and David Okaliwe.
        </div>

        {/* Setlist Modal */}
        <SetlistModal />
      </div>
    </>
  );
};

export default MobileLayout;