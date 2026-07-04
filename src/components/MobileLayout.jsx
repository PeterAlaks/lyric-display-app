import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ListMusic, RefreshCw, FileText, Play, Square, ChevronDown, Sparkles, CheckSquare, MoreHorizontal, X, HelpCircle } from 'lucide-react';
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
  const [selectionMode, setSelectionMode] = React.useState(false);
  const [selectionStats, setSelectionStats] = React.useState({ totalSelected: 0, totalLines: 0 });
  const selectionApiRef = React.useRef(null);
  const ellipsisButtonRef = React.useRef(null);
  const selectionControlsRef = React.useRef(null);

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
    const base = 'inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40';
    if (disabled) {
      return `${base} cursor-not-allowed opacity-45 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`;
    }
    return `${base} ${darkMode ? 'text-gray-400 hover:bg-blue-500/10 hover:text-blue-300' : 'text-gray-500 hover:bg-blue-50 hover:text-blue-600'}`;
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

  React.useEffect(() => {
    const handleLiveSafetyBlocked = (event) => {
      showToast({
        title: 'Live safety mode',
        message: event?.detail?.reason || 'The desktop controller has limited secondary controllers to line navigation during service.',
        variant: 'warn',
        duration: 5000,
      });
    };

    window.addEventListener('live-safety-blocked', handleLiveSafetyBlocked);
    return () => window.removeEventListener('live-safety-blocked', handleLiveSafetyBlocked);
  }, [showToast]);

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

  const handleEnterSelectionMode = React.useCallback(() => {
    setSelectionMode(true);
  }, []);

  const handleCloseSelectionMode = React.useCallback(() => {
    setSelectionMode(false);
    selectionApiRef.current?.clearSelection?.();
  }, []);

  const handleSelectAll = React.useCallback(() => {
    if (!hasLyrics) return;
    if (selectionStats.totalLines > 0 && selectionStats.totalSelected === selectionStats.totalLines) {
      selectionApiRef.current?.clearSelection?.();
    } else {
      selectionApiRef.current?.selectAll?.();
    }
  }, [hasLyrics, selectionStats]);

  const handleOpenContextMenuFromEllipsis = React.useCallback(() => {
    selectionApiRef.current?.openContextMenuForSelection?.(ellipsisButtonRef.current);
  }, []);

  const isAllSelected = selectionMode && selectionStats.totalLines > 0 && selectionStats.totalSelected === selectionStats.totalLines;

  return (
    <>
      <ConnectionBackoffBanner darkMode={darkMode} />
      <div
        className={`flex flex-col h-screen font-sans ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'
          }`}
      >
        {/* Fixed Header */}
        <div
          className={`border-b px-4 py-4 shrink-0 ${darkMode
            ? 'bg-gray-900 border-gray-800'
            : 'bg-white/95 border-gray-200'
            }`}
        >
          {/* Top Row - Title and Controls */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <img
                src="/LyricDisplay-icon.png"
                alt="LyricDisplay"
                className="h-8 w-8"
              />
              <div>
                <h1
                  className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}
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
            <div className="flex items-center gap-2">
              {/* Setlist Button */}
              <button
                onClick={handleOpenSetlist}
                className={iconButtonClass(false)}
                title="Open setlist"
              >
                <ListMusic className="h-4.5 w-4.5" />
              </button>
              {/* Sync Outputs Button */}
              <button
                onClick={handleSyncOutputs}
                disabled={!isConnected || !isAuthenticated || !ready}
                className={iconButtonClass(!isConnected || !isAuthenticated || !ready)}
                title={(!isConnected || !isAuthenticated || !ready) ? "Cannot sync - not connected or authenticated" : "Sync outputs"}
              >
                <RefreshCw className="h-4.5 w-4.5" />
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
                <HelpCircle className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>

          {/* Compose New Lyrics Button and Toggle Row */}
          <div className="mb-5 space-y-3">
            {/* Compose Button and Toggle */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => navigate('/new-song?mode=compose')}
                className="flex h-11 min-w-0 w-full items-center justify-center gap-2 rounded-full bg-linear-to-r from-blue-400 to-purple-600 px-4 text-sm font-semibold text-white transition-all duration-200 hover:from-blue-500 hover:to-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 md:max-w-md"
              >
                <FileText className="h-4 w-4 shrink-0" />
                <span className="truncate">Create Lyrics</span>
              </button>

              {/* Toggle Display Switch */}
              <div className="flex shrink-0 items-center gap-4">
                <Switch
                  checked={isOutputOn}
                  onCheckedChange={handleToggle}
                  className={`scale-[1.45] ${darkMode
                    ? 'data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-600'
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
                ? 'text-gray-300 border-gray-800'
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
            className={`rounded-2xl border flex-1 flex flex-col overflow-hidden ${darkMode
              ? 'bg-gray-900/70 border-gray-800'
              : 'bg-white/80 border-gray-200'
              }`}
          >
            {hasLyrics ? (
              <>
                {/* Fixed Search Bar and Autoplay */}
                <div className={`border-b px-3 py-3 shrink-0 ${darkMode
                  ? 'border-gray-800 bg-gray-900/70'
                  : 'border-gray-200 bg-white/80'
                  }`}>

                  {/* Search Bar and Autoplay Controls */}
                  <div className="flex flex-col gap-4 md:flex-row md:items-center">
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
                    <div className="flex gap-2 md:w-auto md:shrink-0">
                      {/* Intelligent Autoplay Button */}
                      {hasValidTimestamps(lyricsTimestamps) && (
                        <button
                          onClick={handleIntelligentAutoplayToggle}
                          disabled={remoteAutoplayActive || autoplayActive}
                          className={`inline-flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium transition-colors ${remoteAutoplayActive || autoplayActive
                            ? 'cursor-not-allowed text-gray-500 opacity-45'
                            : intelligentAutoplayActive
                              ? 'bg-linear-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white'
                              : darkMode
                                ? 'text-gray-400 hover:bg-blue-500/10 hover:text-blue-300'
                                : 'text-gray-500 hover:bg-blue-50 hover:text-blue-600'
                            }`}
                          title={
                            remoteAutoplayActive || autoplayActive
                              ? "Autoplay is active"
                              : intelligentAutoplayActive
                                ? "Stop intelligent autoplay"
                                : "Start intelligent autoplay"
                          }
                        >
                          <Sparkles className="h-4.5 w-4.5" />
                        </button>
                      )}

                      <button
                        onClick={handleAutoplayToggle}
                        disabled={remoteAutoplayActive || intelligentAutoplayActive}
                        className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors md:flex-initial md:min-w-35 ${remoteAutoplayActive || intelligentAutoplayActive
                          ? 'cursor-not-allowed text-gray-500 opacity-45'
                          : autoplayActive
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : darkMode
                              ? 'text-gray-300 hover:bg-blue-500/10 hover:text-blue-300'
                              : 'text-gray-600 hover:bg-blue-50 hover:text-blue-600'
                          }`}
                      >
                        {autoplayActive ? (
                          <>
                            <Square className="h-4.5 w-4.5 fill-current" />
                            <span className="hidden md:inline">Stop</span>
                            <span className="md:hidden">Stop Autoplay</span>
                          </>
                        ) : (
                          <>
                            <Play className="h-4.5 w-4.5" />
                            <span className="hidden md:inline">Autoplay</span>
                            <span className="md:hidden">Start Autoplay</span>
                          </>
                        )}
                      </button>

                      {/* Settings Button */}
                      {!autoplayActive && !remoteAutoplayActive && !intelligentAutoplayActive && (
                        <button
                          onClick={handleOpenAutoplaySettings}
                          className={`inline-flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${darkMode
                            ? 'text-gray-400 hover:bg-blue-500/10 hover:text-blue-300'
                            : 'text-gray-500 hover:bg-blue-50 hover:text-blue-600'
                            }`}
                          title="Autoplay settings"
                        >
                          <ChevronDown className="h-4.5 w-4.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Selection Mode Controls */}
                  <div
                    ref={selectionControlsRef}
                    className={`overflow-hidden transition-[max-height,opacity,transform] duration-300 ${selectionMode
                      ? 'mt-3 max-h-20 opacity-100 translate-y-0'
                      : 'mt-0 max-h-0 opacity-0 -translate-y-2 pointer-events-none'
                      }`}
                  >
                    <div
                      className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-3 ${darkMode
                        ? 'bg-gray-950/40 border-gray-800 text-gray-100'
                        : 'bg-gray-50/80 border-gray-200 text-gray-800'
                        }`}
                    >
                      <button
                        type="button"
                        onClick={handleCloseSelectionMode}
                        className={`p-2 rounded-lg transition-colors ${darkMode
                          ? 'text-gray-400 hover:bg-blue-500/10 hover:text-blue-300'
                          : 'text-gray-500 hover:bg-blue-50 hover:text-blue-600'
                          }`}
                        title="Close select mode"
                      >
                        <X className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={handleSelectAll}
                        className={`flex-1 flex items-center gap-3 text-sm font-semibold rounded-lg px-3 py-2 transition-colors ${darkMode
                          ? 'text-gray-300 hover:bg-blue-500/10 hover:text-blue-300'
                          : 'text-gray-600 hover:bg-blue-50 hover:text-blue-600'
                          }`}
                      >
                        {isAllSelected ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                        <span className="truncate">Select all</span>
                        <span className="text-xs font-medium text-gray-500">
                          {selectionStats.totalSelected}/{selectionStats.totalLines || 0}
                        </span>
                      </button>

                      <button
                        type="button"
                        ref={ellipsisButtonRef}
                        onClick={handleOpenContextMenuFromEllipsis}
                        className={`p-2 rounded-lg transition-colors ${darkMode
                          ? 'text-gray-400 hover:bg-blue-500/10 hover:text-blue-300'
                          : 'text-gray-500 hover:bg-blue-50 hover:text-blue-600'
                          }`}
                        title="More actions"
                      >
                        <MoreHorizontal className="w-5 h-5" />
                      </button>
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
                    selectionMode={selectionMode}
                    onEnterSelectionMode={handleEnterSelectionMode}
                    onSelectionStateChange={setSelectionStats}
                    onContextMenuApiReady={(api) => {
                      selectionApiRef.current = api;
                    }}
                    clickAwayIgnoreRefs={[selectionControlsRef, ellipsisButtonRef]}
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
          className={`px-4 py-3 text-center text-xs border-t shrink-0 whitespace-normal wrap-break-word ${darkMode
            ? 'text-gray-400 bg-gray-800 border-gray-700'
            : 'text-gray-600 bg-gray-50 border-gray-200'
            }`}
        >
          © {new Date().getFullYear()} LyricDisplay. Designed and developed by Peter Alakembi and David Okaliwe, among other contributors.
        </div>

        {/* Setlist Modal */}
        <SetlistModal />
      </div >
    </>
  );
};

export default MobileLayout;
