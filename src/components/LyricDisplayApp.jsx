import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, FolderOpen, FileText, Edit, List, Globe, Plus } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useLyricsState, useOutputState, useOutput1Settings, useOutput2Settings, useDarkModeState, useSetlistState, useIsDesktopApp } from '../hooks/useStoreSelectors';
import { useControlSocket } from '../context/ControlSocketProvider';
import useFileUpload from '../hooks/useFileUpload';
import AuthStatusIndicator from './AuthStatusIndicator';
import ConnectionBackoffBanner from './ConnectionBackoffBanner';
import LyricsList from './LyricsList';
import MobileLayout from './MobileLayout';
import SetlistModal from './SetlistModal';
import OnlineLyricsSearchModal from './OnlineLyricsSearchModal';
import DraftApprovalModal from './DraftApprovalModal';
import OutputSettingsPanel from './OutputSettingsPanel';
import { Switch } from "@/components/ui/switch";
import useDarkModeSync from '../hooks/useDarkModeSync';
import useMenuShortcuts from '../hooks/useMenuShortcuts';
import useSearch from '../hooks/useSearch';
import useOutputSettings from '../hooks/useOutputSettings';
import useSetlistActions from '../hooks/useSetlistActions';
import SearchBar from './SearchBar';
import useToast from '../hooks/useToast';
import { parseLyricsFileAsync } from '../utils/asyncLyricsParser';
import { useSyncTimer } from '../hooks/useSyncTimer';

const LyricDisplayApp = () => {
  const navigate = useNavigate();

  // Global state management
  // Targeted selectors for optimized re-renders
  const { isOutputOn, setIsOutputOn } = useOutputState();
  const { lyrics, lyricsFileName, rawLyricsContent, selectedLine, selectLine, setLyrics, setRawLyricsContent, setLyricsFileName } = useLyricsState();
  const { settings: output1Settings, updateSettings: updateOutput1Settings } = useOutput1Settings();
  const { settings: output2Settings, updateSettings: updateOutput2Settings } = useOutput2Settings();
  const { darkMode, setDarkMode } = useDarkModeState();
  const { setlistModalOpen, setSetlistModalOpen, setlistFiles, isSetlistFull } = useSetlistState();
  const isDesktopApp = useIsDesktopApp();

  // Handle dark mode sync with Electron
  useDarkModeSync(darkMode, setDarkMode);

  // Menu shortcuts from Electron
  const fileInputRef = useRef(null);
  useMenuShortcuts(navigate, fileInputRef);

  const { socket, emitOutputToggle, emitLineUpdate, emitLyricsLoad, emitStyleUpdate, emitRequestSetlist, emitSetlistAdd, connectionStatus, authStatus, forceReconnect, refreshAuthToken, isConnected, isAuthenticated, ready, lastSyncTime } = useControlSocket();

  const secondsAgo = useSyncTimer(lastSyncTime);

  // File upload functionality
  const handleFileUpload = useFileUpload();

  // Output tabs and settings helpers
  const { activeTab, setActiveTab, getCurrentSettings, updateSettings } = useOutputSettings({
    output1Settings,
    output2Settings,
    updateOutputSettings: (output, settings) => {
      if (output === 'output1') {
        updateOutput1Settings(settings);
      } else if (output === 'output2') {
        updateOutput2Settings(settings);
      }
      emitStyleUpdate(output, settings);
    },
    emitStyleUpdate,
  });

  const [hasInteractedWithTabs, setHasInteractedWithTabs] = React.useState(false);

  // Online lyrics search modal state
  const [onlineLyricsModalOpen, setOnlineLyricsModalOpen] = React.useState(false);

  // Search state and helpers
  const { containerRef: lyricsContainerRef, searchQuery, highlightedLineIndex, currentMatchIndex, totalMatches, handleSearch, clearSearch, navigateToNextMatch, navigateToPreviousMatch } = useSearch(lyrics);

  const hasLyrics = lyrics && lyrics.length > 0;
  const { showToast } = useToast();

  const processLoadedLyrics = React.useCallback(async ({ content, fileName, filePath, fileType }, context = {}) => {
    const sanitize = (value) => (value || '')
      .replace(/[<>:"/\\|?*]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    try {
      const requestedType = (fileType || '').toLowerCase() === 'lrc' ? 'lrc' : ((fileType || '').toLowerCase() === 'txt' ? 'txt' : null);
      const providedName = sanitize(fileName);
      const fallbackName = sanitize(context.fallbackFileName);
      const baseName = providedName || fallbackName || 'Imported Lyrics';
      const hasExtension = /\.[a-z0-9]{2,5}$/i.test(providedName);
      const inferredType = (!requestedType && providedName && providedName.toLowerCase().endsWith('.lrc')) ? 'lrc' : 'txt';
      const finalType = requestedType || inferredType;
      const extension = finalType === 'lrc' ? '.lrc' : '.txt';
      const finalFileName = hasExtension ? providedName : `${baseName}${extension}`;

      // NEW: Determine if we should enable intelligent splitting
      const enableSplitting = Boolean(context.enableOnlineLyricsSplitting || context.enableIntelligentSplitting);

      const parsed = await parseLyricsFileAsync(null, {
        rawText: content || '',
        fileType: finalType,
        name: finalFileName,
        path: filePath,
        enableSplitting,
      });

      if (!parsed || !Array.isArray(parsed.processedLines)) {
        throw new Error('Invalid lyrics response');
      }

      const processedLines = parsed.processedLines;
      const rawText = parsed.rawText ?? (content || '');
      const finalBaseName = (finalFileName || '').replace(/\.(txt|lrc)$/i, '');

      setLyrics(processedLines);
      setRawLyricsContent(rawText);
      selectLine(null);
      setLyricsFileName(finalBaseName);

      emitLyricsLoad(processedLines);
      if (socket && socket.connected && finalBaseName) {
        socket.emit('fileNameUpdate', finalBaseName);
      }

      try {
        if (filePath && window?.electronAPI?.addRecentFile) {
          await window.electronAPI.addRecentFile(filePath);
        }
      } catch { }

      showToast({
        title: context.toastTitle || 'Lyrics loaded',
        message: context.toastMessage || `${finalType === 'lrc' ? 'LRC' : 'Text'}: ${finalBaseName}`,
        variant: context.toastVariant || 'success',
      });

      return true;
    } catch (err) {
      console.error('Failed to load lyrics content:', err);
      showToast({
        title: context.errorTitle || 'Failed to load lyrics',
        message: context.errorMessage || 'The lyrics could not be processed.',
        variant: 'error',
      });
      return false;
    }
  }, [emitLyricsLoad, selectLine, setLyrics, setRawLyricsContent, setLyricsFileName, showToast, socket]);

  const handleImportFromLibrary = React.useCallback(async ({ providerId, providerName, lyric }) => {
    if (!lyric || typeof lyric.content !== 'string' || !lyric.content.trim()) {
      showToast({
        title: 'Import failed',
        message: 'The selected provider did not return lyric content.',
        variant: 'error',
      });
      return false;
    }

    const baseNamePieces = [lyric.title || 'Untitled Song', lyric.artist || providerName || providerId];
    const fallbackFileName = baseNamePieces.filter(Boolean).join(' - ');

    return processLoadedLyrics(
      {
        content: lyric.content,
        fileName: lyric.title || fallbackFileName,
        fileType: 'txt',
        enableOnlineLyricsSplitting: true,
      },
      {
        fallbackFileName,
        toastTitle: 'Lyrics imported',
        toastMessage: `Loaded from ${providerName || providerId}.`,
      }
    );
  }, [processLoadedLyrics, showToast]);

  React.useEffect(() => {
    if (!window?.electronAPI?.onOpenLyricsFromPath) return;
    const off = window.electronAPI.onOpenLyricsFromPath(async (payload) => {
      await processLoadedLyrics(payload || {});
    });
    return () => { try { off?.(); } catch { } };
  }, [processLoadedLyrics]);

  React.useEffect(() => {
    if (!window?.electronAPI?.onOpenLyricsFromPathError) return;
    const off = window.electronAPI.onOpenLyricsFromPathError(({ filePath }) => {
      showToast({
        title: 'File not found',
        message: `The file could not be opened. It may have been moved or deleted.\n${filePath || ''}`,
        variant: 'error'
      });
    });
    return () => { try { off?.(); } catch { } };
  }, [showToast]);

  React.useEffect(() => {
    const listener = (e) => {
      const payload = e?.detail || {};
      processLoadedLyrics(payload);
    };
    window.addEventListener('lyrics-opened', listener);
    return () => window.removeEventListener('lyrics-opened', listener);
  }, [processLoadedLyrics]);

  const fontOptions = ['Arial', 'Calibri', 'Bebas Neue', 'Fira Sans', 'GarnetCapitals', 'Inter', 'Lato', 'Montserrat', 'Noto Sans', 'Open Sans', 'Poppins', 'Roboto', 'Work Sans'];

  const openFileDialog = async () => {
    if (!isAuthenticated) {
      showToast({
        title: 'Authentication Required',
        message: 'Please wait for authentication to complete before loading files.',
        variant: 'warning'
      });
      return;
    }

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
    } catch { }
    fileInputRef.current?.click();
  };

  const handleCreateNewSong = () => {
    navigate('/new-song?mode=new');
  };

  const handleEditLyrics = () => {
    navigate('/new-song?mode=edit');
  };

  const handleOpenSetlist = () => {
    setSetlistModalOpen(true);
  };

  const handleOpenOnlineLyricsSearch = () => {
    setOnlineLyricsModalOpen(true);
  };

  const handleCloseOnlineLyricsSearch = () => {
    setOnlineLyricsModalOpen(false);
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const success = await handleFileUpload(file);
    if (success) {
      clearSearch();
    }
  };

  const handleLineSelect = (index) => {
    selectLine(index);
    emitLineUpdate(index);
  };

  const handleToggle = () => {
    if (!isConnected || !isAuthenticated || !ready) {
      showToast({
        title: 'Connection Required',
        message: 'Cannot control output - not connected or authenticated.',
        variant: 'warning'
      });
      return;
    }

    setIsOutputOn(!isOutputOn);
    emitOutputToggle(!isOutputOn);
  };

  const { isFileAlreadyInSetlist, handleAddToSetlist, disabled: addDisabled, title: addTitle } = useSetlistActions(emitSetlistAdd);

  if (!isDesktopApp) {
    return <MobileLayout />;
  }

  return (
    <>
      <ConnectionBackoffBanner darkMode={darkMode} />
      {isDesktopApp && <DraftApprovalModal darkMode={darkMode} />}
      <div className={`flex h-screen font-sans ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
        {/* Left Sidebar - Control Panel */}
        <div className={`w-[420px] shadow-lg p-6 overflow-y-auto ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <img
              src="/LyricDisplay-icon.png"
              alt="LyricDisplay"
              className="h-8 w-8"
            />
            <div className="flex items-center gap-2">
              {/* Online Lyrics Search Button */}
              <button
                className={`p-2 rounded-lg font-medium transition-colors ${darkMode
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
                className={`p-2 rounded-lg font-medium transition-colors ${darkMode
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
                disabled={!isConnected || !isAuthenticated || !ready}
                className={`p-2 rounded-lg font-medium transition-colors ${(!isConnected || !isAuthenticated || !ready)
                  ? (darkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed opacity-50' : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50')
                  : (darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700')
                  }`}
                title={(!isConnected || !isAuthenticated || !ready) ? "Cannot sync - not connected or authenticated" : "Sync current state to outputs"}
                onClick={() => {
                  if (!isConnected || !isAuthenticated) {
                    showToast({
                      title: 'Cannot Sync',
                      message: 'Not connected or authenticated.',
                      variant: 'warning'
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
                      if (output1Settings && !emitStyleUpdate('output1', output1Settings)) {
                        syncSuccess = false;
                      }
                      if (output2Settings && !emitStyleUpdate('output2', output2Settings)) {
                        syncSuccess = false;
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
                        variant: 'success'
                      });
                    } else {
                      showToast({
                        title: 'Sync Failed',
                        message: 'Outputs were not updated. Check the connection and try again.',
                        variant: 'error'
                      });
                    }
                  } catch (error) {
                    console.error('Manual sync failed:', error);
                    showToast({
                      title: 'Sync Failed',
                      message: 'An unexpected error occurred while syncing outputs.',
                      variant: 'error'
                    });
                  }
                }}
              >
                <RefreshCw className="w-5 h-5" />
              </button>

              {/* Authentication Status Indicator */}
              <AuthStatusIndicator
                authStatus={authStatus}
                connectionStatus={connectionStatus}
                onRetry={forceReconnect}
                onRefreshToken={refreshAuthToken}
                darkMode={darkMode}
              />
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

          <div className={`border-t my-8 ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}></div>

          {/* Output Tabs */}
          <Tabs value={activeTab} onValueChange={(val) => { setHasInteractedWithTabs(true); setActiveTab(val); }}>
            <TabsList className={`w-full h-11 mb-8 ${darkMode ? 'bg-gray-700 text-gray-300' : ''}`}>
              <TabsTrigger value="output1" className={`flex-1 h-8 ${darkMode ? 'data-[state=active]:bg-white data-[state=active]:text-gray-900' : 'data-[state=active]:bg-black data-[state=active]:text-white'}`}>
                Output 1
              </TabsTrigger>
              <TabsTrigger value="output2" className={`flex-1 h-8 ${darkMode ? 'data-[state=active]:bg-white data-[state=active]:text-gray-900' : 'data-[state=active]:bg-black data-[state=active]:text-white'}`}>
                Output 2
              </TabsTrigger>
            </TabsList>
            <TabsContent
              value="output1"
              className={`mt-0 ${hasInteractedWithTabs && activeTab === 'output1' ? 'animate-in slide-in-from-left-8 duration-300' : ''}`}
            >
              <OutputSettingsPanel
                outputKey="output1"
                settings={getCurrentSettings()}
                updateSettings={updateSettings}
                fontOptions={fontOptions}
              />
            </TabsContent>
            <TabsContent
              value="output2"
              className={`mt-0 ${hasInteractedWithTabs && activeTab === 'output2' ? 'animate-in slide-in-from-right-8 duration-300' : ''}`}
            >
              <OutputSettingsPanel
                outputKey="output2"
                settings={getCurrentSettings()}
                updateSettings={updateSettings}
                fontOptions={fontOptions}
              />
            </TabsContent>
          </Tabs>

          <div className={`border-t my-8 ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}></div>

          {/* Last Synced Indicator */}
          {lastSyncTime && (
            <div className={`mt-3 text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              Last synced {secondsAgo}s ago
            </div>
          )}

          <div className={`mt-4 text-[12px] text-left space-y-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            © 2025 LyricDisplay. All rights reserved. Designed and developed by Peter Alakembi and David Okaliwe.
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
                className="flex-1 overflow-y-auto"
                onDrop={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files && e.dataTransfer.files[0];
                  if (!file) return;
                  const success = await handleFileUpload(file);
                  if (success) {
                    clearSearch();
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
                  searchQuery={searchQuery}
                  highlightedLineIndex={highlightedLineIndex}
                  onSelectLine={handleLineSelect}
                />
              </div>
            ) : (
              /* Empty State - Drag and Drop */
              <div
                className="flex-1 flex items-center justify-center p-4"
                onDrop={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files && e.dataTransfer.files[0];
                  if (!file) return;
                  await handleFileUpload(file);
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
          onImportLyrics={handleImportFromLibrary}
        />
      </div>
    </>
  );
};

export default LyricDisplayApp;
