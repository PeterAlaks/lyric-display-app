import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListMusic, RefreshCw, FileText, Play, Square, ChevronDown } from 'lucide-react';
import { useLyricsState, useOutputState, useDarkModeState, useSetlistState, useAutoplaySettings } from '../hooks/useStoreSelectors';
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
import { getLineDisplayText } from '../utils/parseLyrics';

const MobileLayout = () => {
  const { isOutputOn, setIsOutputOn } = useOutputState();
  const { lyrics, lyricsFileName, selectedLine, selectLine } = useLyricsState();
  const { darkMode } = useDarkModeState();
  const { setlistModalOpen, setSetlistModalOpen, setlistFiles } = useSetlistState();
  const { settings: autoplaySettings, setSettings: setAutoplaySettings } = useAutoplaySettings();

  const { emitOutputToggle, emitLineUpdate, emitLyricsLoad, emitAutoplayStateUpdate, isAuthenticated, connectionStatus, ready, lastSyncTime, isConnected } = useControlSocket();

  const secondsAgo = useSyncTimer(lastSyncTime);

  const {
    containerRef: lyricsContainerRef, searchQuery, highlightedLineIndex, currentMatchIndex, totalMatches, handleSearch, clearSearch, navigateToNextMatch, navigateToPreviousMatch, } = useSearch(lyrics);

  const hasLyrics = lyrics && lyrics.length > 0;
  const { showToast } = useToast();
  const { showModal } = useModal();

  const navigate = useNavigate();

  const [autoplayActive, setAutoplayActive] = React.useState(false);
  const [remoteAutoplayActive, setRemoteAutoplayActive] = React.useState(false);
  const autoplayIntervalRef = useRef(null);
  const lyricsRef = useRef(lyrics);
  const selectedLineRef = useRef(selectedLine);
  const autoplaySettingsRef = useRef(autoplaySettings);
  const selectLineRef = useRef(selectLine);
  const emitLineUpdateRef = useRef(emitLineUpdate);
  const showToastRef = useRef(showToast);

  React.useEffect(() => {
    lyricsRef.current = lyrics;
  }, [lyrics]);

  React.useEffect(() => {
    selectedLineRef.current = selectedLine;
  }, [selectedLine]);

  React.useEffect(() => {
    autoplaySettingsRef.current = autoplaySettings;
  }, [autoplaySettings]);

  React.useEffect(() => {
    selectLineRef.current = selectLine;
  }, [selectLine]);

  React.useEffect(() => {
    emitLineUpdateRef.current = emitLineUpdate;
  }, [emitLineUpdate]);

  React.useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  const isLineBlank = React.useCallback((line) => {
    if (!line) return true;
    const displayText = getLineDisplayText(line);
    return !displayText || displayText.trim() === '';
  }, []);

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

  const handleSyncOutputs = () => {
    if (!isConnected || !isAuthenticated || !ready) {
      showToast({
        title: 'Cannot Sync',
        message: 'Not connected or authenticated.',
        variant: 'warning',
      });
      return;
    }

    try {
      let syncSuccess = true;

      if (lyrics && lyrics.length > 0) {
        if (!emitLyricsLoad(lyrics)) {
          syncSuccess = false;
        }
        if (selectedLine !== null && selectedLine !== undefined) {
          if (!emitLineUpdate(selectedLine)) {
            syncSuccess = false;
          }
        }
      }

      if (!emitOutputToggle(isOutputOn)) {
        syncSuccess = false;
      }

      if (syncSuccess) {
        window.dispatchEvent(new CustomEvent('sync-completed', { detail: { source: 'manual' } }));
        showToast({
          title: 'Outputs Synced',
          message: 'Output displays updated successfully.',
          variant: 'success',
        });
      } else {
        showToast({
          title: 'Sync Failed',
          message: 'Outputs were not updated. Check the connection and try again.',
          variant: 'error',
        });
      }
    } catch (error) {
      console.error('Manual sync failed:', error);
      showToast({
        title: 'Sync Failed',
        message: 'An unexpected error occurred while syncing outputs.',
        variant: 'error',
      });
    }
  };

  React.useEffect(() => {
    if (autoplayIntervalRef.current) {
      clearInterval(autoplayIntervalRef.current);
      autoplayIntervalRef.current = null;
    }

    if (!autoplayActive || !hasLyrics) {
      return;
    }

    autoplayIntervalRef.current = setInterval(() => {
      const currentLyrics = lyricsRef.current;
      const currentSelectedLine = selectedLineRef.current;
      const currentSettings = autoplaySettingsRef.current;
      const currentSelectLine = selectLineRef.current;
      const currentEmitLineUpdate = emitLineUpdateRef.current;
      const currentShowToast = showToastRef.current;

      if (!currentLyrics || currentLyrics.length === 0) {
        setAutoplayActive(false);
        return;
      }

      const currentIndex = currentSelectedLine ?? -1;
      let nextIndex = currentIndex + 1;

      if (currentSettings.skipBlankLines) {
        while (nextIndex < currentLyrics.length && isLineBlank(currentLyrics[nextIndex])) {
          nextIndex++;
        }
      }

      if (nextIndex >= currentLyrics.length) {
        if (currentSettings.loop) {
          nextIndex = 0;
          if (currentSettings.skipBlankLines) {
            while (nextIndex < currentLyrics.length && isLineBlank(currentLyrics[nextIndex])) {
              nextIndex++;
            }
          }
          if (nextIndex >= currentLyrics.length) {
            setAutoplayActive(false);
            currentShowToast({
              title: 'Autoplay Stopped',
              message: 'No non-blank lines found.',
              variant: 'info'
            });
            return;
          }
        } else {
          setAutoplayActive(false);
          currentShowToast({
            title: 'Autoplay Complete',
            message: 'Reached the end of lyrics.',
            variant: 'success'
          });
          return;
        }
      }

      currentSelectLine(nextIndex);
      currentEmitLineUpdate(nextIndex);
      window.dispatchEvent(new CustomEvent('scroll-to-lyric-line', {
        detail: { lineIndex: nextIndex }
      }));
    }, autoplaySettings.interval * 1000);

    return () => {
      if (autoplayIntervalRef.current) {
        clearInterval(autoplayIntervalRef.current);
        autoplayIntervalRef.current = null;
      }
    };
  }, [autoplayActive, hasLyrics, autoplaySettings.interval, isLineBlank]);

  const handleAutoplayToggle = () => {
    if (autoplayActive) {
      setAutoplayActive(false);
      showToast({
        title: 'Autoplay Stopped',
        message: 'Automatic lyric progression paused.',
        variant: 'info'
      });
    } else {
      if (autoplaySettings.startFromFirst) {
        let startIndex = 0;
        if (autoplaySettings.skipBlankLines) {
          while (startIndex < lyrics.length && isLineBlank(lyrics[startIndex])) {
            startIndex++;
          }
        }
        if (startIndex >= lyrics.length) {
          showToast({
            title: 'Cannot Start Autoplay',
            message: 'No non-blank lines found.',
            variant: 'warning'
          });
          return;
        }
        selectLine(startIndex);
        emitLineUpdate(startIndex);
        window.dispatchEvent(new CustomEvent('scroll-to-lyric-line', {
          detail: { lineIndex: startIndex }
        }));
      }

      setAutoplayActive(true);
      showToast({
        title: 'Autoplay Started',
        message: `Advancing every ${autoplaySettings.interval} second${autoplaySettings.interval !== 1 ? 's' : ''}.`,
        variant: 'success'
      });
    }
  };

  const handleOpenAutoplaySettings = () => {
    showModal({
      title: 'Autoplay Settings',
      headerDescription: 'Configure automatic lyric progression',
      component: 'AutoplaySettings',
      variant: 'info',
      size: 'sm',
      settings: autoplaySettings,
      onSave: (newSettings) => {
        setAutoplaySettings(newSettings);
        showToast({
          title: 'Settings Saved',
          message: 'Autoplay settings updated successfully.',
          variant: 'success'
        });
      },
      actions: []
    });
  };

  React.useEffect(() => {
    setAutoplayActive(false);
  }, [lyricsFileName]);

  React.useEffect(() => {
    if (isConnected && isAuthenticated && ready) {
      emitAutoplayStateUpdate({ isActive: autoplayActive, clientType: 'mobile' });
    }
  }, [autoplayActive, isConnected, isAuthenticated, ready, emitAutoplayStateUpdate]);

  React.useEffect(() => {
    const handleAutoplayStateUpdate = (event) => {
      const { isActive, clientType } = event.detail;

      if (clientType === 'desktop') {
        setRemoteAutoplayActive(isActive);
      }
    };

    window.addEventListener('autoplay-state-update', handleAutoplayStateUpdate);
    return () => window.removeEventListener('autoplay-state-update', handleAutoplayStateUpdate);
  }, []);

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
          <div className="flex items-center justify-between mb-6">
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
                className={`p-2.5 rounded-lg transition-colors ${darkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                title="Open setlist"
              >
                <ListMusic className="w-5 h-5" />
              </button>
              {/* Sync Outputs Button */}
              <button
                onClick={handleSyncOutputs}
                disabled={!isConnected || !isAuthenticated || !ready}
                className={`p-2.5 rounded-lg transition-colors ${(!isConnected || !isAuthenticated || !ready)
                  ? (darkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed opacity-50' : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50')
                  : (darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700')
                  }`}
                title={(!isConnected || !isAuthenticated || !ready) ? "Cannot sync - not connected or authenticated" : "Sync outputs"}
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  showModal({
                    title: 'Mobile Controller Help',
                    component: 'ControlPanelHelp',
                    variant: 'info',
                    size: 'large',
                    dismissLabel: 'Got it'
                  });
                }}
                className={`p-2.5 rounded-lg transition-colors ${darkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                title="Help"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Compose New Lyrics Button - Full Width */}
          <button
            onClick={() => navigate('/new-song?mode=compose')}
            className={`w-full py-3 px-4 mb-6 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${darkMode
              ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white'
              : 'bg-gradient-to-r from-blue-400 to-purple-600 hover:from-blue-500 hover:to-purple-700 text-white'
              }`}
          >
            <FileText className="w-5 h-5" />
            Compose New Lyrics
          </button>

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
                {/* Fixed Search Bar and Autoplay */}
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

                  {/* Autoplay Button */}
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={handleAutoplayToggle}
                      disabled={remoteAutoplayActive}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${remoteAutoplayActive
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
                          <span>Stop Autoplay</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          <span>Start Autoplay</span>
                        </>
                      )}
                    </button>

                    {/* Settings Button */}
                    {!autoplayActive && !remoteAutoplayActive && (
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
        > © 2025 LyricDisplay. All rights reserved. Designed and developed by Peter Alakembi and David Okaliwe.
        </div>

        {/* Setlist Modal */}
        <SetlistModal />
      </div>
    </>
  );
};

export default MobileLayout;