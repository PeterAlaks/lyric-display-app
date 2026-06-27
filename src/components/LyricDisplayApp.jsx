import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, FilePlusCorner, FileMusic, Plus, PlusCircle } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useLyricsState, useOutputState, useOutput1Settings, useOutput2Settings, useStageSettings, useDarkModeState, useSetlistState, useIsDesktopApp, useAutoplaySettings, useIntelligentAutoplayState, useAllOutputIds, useKeyboardNavigationPreferences } from '../hooks/useStoreSelectors';
import { useControlSocket } from '../context/ControlSocketProvider';
import useFileUpload from '../hooks/useFileUpload';
import useMultipleFileUpload from '../hooks/useMultipleFileUpload';
import useSetlistLoader from '../hooks/SetlistModal/useSetlistLoader';
import ConnectionBackoffBanner from './ConnectionBackoffBanner';
import MobileLayout from './MobileLayout';
import DraftApprovalModal from './DraftApprovalModal';
import OutputSettingsPanel from './OutputSettingsPanel';
import { Switch } from "@/components/ui/switch";
import useDarkModeSync from '../hooks/useDarkModeSync';
import useMenuShortcuts from '../hooks/LyricDisplayApp/useMenuShortcuts';
import useSearch from '../hooks/useSearch';
import useOutputSettings from '../hooks/LyricDisplayApp/useOutputSettings';
import useSetlistActions from '../hooks/LyricDisplayApp/useSetlistActions';
import useToast from '../hooks/useToast';
import useModal from '../hooks/useModal';
import { Tooltip } from '@/components/ui/tooltip';
import { DEFAULT_OUTPUT_IDS, MAX_CUSTOM_OUTPUTS } from '../../shared/outputRegistry.js';
import { useAutoplayManager } from '../hooks/useAutoplayManager';
import { useSyncOutputs } from '../hooks/useSyncOutputs';
import { useLyricsLoader } from '../hooks/LyricDisplayApp/useLyricsLoader';
import { useKeyboardShortcuts } from '../hooks/LyricDisplayApp/useKeyboardShortcuts';
import { useElectronListeners } from '../hooks/LyricDisplayApp/useElectronListeners';
import { useResponsiveWidth } from '../hooks/LyricDisplayApp/useResponsiveWidth';
import { useDragAndDrop } from '../hooks/LyricDisplayApp/useDragAndDrop';
import { useQuickParserControls } from '../hooks/LyricDisplayApp/useQuickParserControls';
import { useExternalControl } from '../hooks/useExternalControl';
import { useControlPanelFileActions } from '../hooks/LyricDisplayApp/useControlPanelFileActions';
import { useCustomOutputActions } from '../hooks/LyricDisplayApp/useCustomOutputActions';
import { useLineCounterText } from '../hooks/LyricDisplayApp/useLineCounterText';
import { useLrcTimestampHydration } from '../hooks/LyricDisplayApp/useLrcTimestampHydration';
import { useOutputControlActions } from '../hooks/LyricDisplayApp/useOutputControlActions';
import { usePendingLyricsLoad } from '../hooks/LyricDisplayApp/usePendingLyricsLoad';
import { usePendingSavedVersionPrompt } from '../hooks/LyricDisplayApp/usePendingSavedVersionPrompt';
import { useRegisterCustomOutputs } from '../hooks/LyricDisplayApp/useRegisterCustomOutputs';
import { useResetLyricsScroll } from '../hooks/LyricDisplayApp/useResetLyricsScroll';
import { useSetlistNavigation } from '../hooks/LyricDisplayApp/useSetlistNavigation';
import ControlPanelHeaderActions from './LyricDisplayApp/ControlPanelHeaderActions';
import ControlPanelModals from './LyricDisplayApp/ControlPanelModals';
import LyricsWorkspace from './LyricDisplayApp/LyricsWorkspace';

const LyricDisplayApp = () => {
  const navigate = useNavigate();

  const { isOutputOn, setIsOutputOn } = useOutputState();
  const { lyrics, lyricsFileName, lyricsSource, rawLyricsContent, songMetadata, selectedLine, lyricsTimestamps, pendingSavedVersion, selectLine, setLyrics, setLyricsSections, setLineToSection, setRawLyricsContent, setLyricsFileName, setLyricsSource, setSongMetadata, setLyricsTimestamps, clearPendingSavedVersion } = useLyricsState();
  const { settings: output1Settings, updateSettings: updateOutput1Settings } = useOutput1Settings();
  const { settings: output2Settings, updateSettings: updateOutput2Settings } = useOutput2Settings();
  const { settings: stageSettings, updateSettings: updateStageSettings } = useStageSettings();
  const { darkMode, setDarkMode, themeMode, setThemeMode } = useDarkModeState();
  const { setSetlistModalOpen, setlistFiles, setSetlistFiles, getMaxSetlistFiles } = useSetlistState();
  const isDesktopApp = useIsDesktopApp();
  const maxSetlistFiles = getMaxSetlistFiles();
  const { settings: autoplaySettings, setSettings: setAutoplaySettings } = useAutoplaySettings();
  const { hasSeenIntelligentAutoplayInfo, setHasSeenIntelligentAutoplayInfo } = useIntelligentAutoplayState();
  const { skipSectionTitlesOnKeyboard } = useKeyboardNavigationPreferences();

  useDarkModeSync(darkMode, setDarkMode);

  const fileInputRef = useRef(null);
  const scrollableSettingsRef = useRef(null);
  useMenuShortcuts(navigate, fileInputRef);

  const { socket, emitOutputToggle, emitIndividualOutputToggle, emitLineUpdate, emitLyricsLoad, emitStyleUpdate, emitSetlistAdd, emitSetlistClear, emitSetlistLoad, emitAutoplayStateUpdate, emitOutputRemove, emitOutputsRegister, connectionStatus, authStatus, forceReconnect, refreshAuthToken, isConnected, isAuthenticated, ready } = useControlSocket();

  const handleFileUpload = useFileUpload();
  const handleMultipleFileUpload = useMultipleFileUpload();
  const loadSetlist = useSetlistLoader({ setlistFiles, setSetlistFiles, emitSetlistAdd, emitSetlistClear });

  const allOutputIds = useAllOutputIds();
  const customOutputIds = React.useMemo(
    () => allOutputIds.filter((id) => id !== 'output1' && id !== 'output2'),
    [allOutputIds]
  );

  const { activeTab, setActiveTab } = useOutputSettings({
    availableTabs: [...allOutputIds, 'stage'],
  });

  const [onlineLyricsModalOpen, setOnlineLyricsModalOpen] = React.useState(false);
  const [easyWorshipModalOpen, setEasyWorshipModalOpen] = React.useState(false);
  const [presentationModalOpen, setPresentationModalOpen] = React.useState(false);
  const headerContainerRef = useRef(null);

  const { containerRef: lyricsContainerRef, searchQuery, highlightedLineIndex, currentMatchIndex, totalMatches, handleSearch: baseHandleSearch, clearSearch, navigateToNextMatch, navigateToPreviousMatch } = useSearch(lyrics);

  const trackAction = React.useCallback((actionType) => {
    window.dispatchEvent(new CustomEvent('support-dev:track-action', {
      detail: { actionType }
    }));
  }, []);
  const { showToast } = useToast();
  const { showModal } = useModal();

  useResetLyricsScroll(lyricsContainerRef);

  const handleSearch = React.useCallback((query) => {
    baseHandleSearch(query);
    if (query) {
      trackAction('search_performed');
    }
  }, [baseHandleSearch, trackAction]);

  const hasLyrics = lyrics && lyrics.length > 0;
  const quickSwitchClassName = `!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
    ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
    : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
    }`;
  const quickSwitchThumbClassName = "!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1";

  const lineCounterText = useLineCounterText({ hasLyrics, lyrics, selectedLine });

  const { isDragging, dragFileCount, handleDragEnter, handleDragLeave, handleDragOver, handleDrop } = useDragAndDrop({
    handleFileUpload,
    handleMultipleFileUpload,
    loadSetlist,
    clearSearch,
    trackAction,
    showToast
  });

  const { useIconOnlyButtons } = useResponsiveWidth(headerContainerRef, hasLyrics);

  useLrcTimestampHydration({
    hasLyrics,
    lyrics,
    lyricsTimestamps,
    rawLyricsContent,
    setLineToSection,
    setLyricsSections,
    setLyricsTimestamps,
  });

  useRegisterCustomOutputs(customOutputIds);

  const {
    autoplayActive,
    intelligentAutoplayActive,
    remoteAutoplayActive,
    handleAutoplayToggle,
    handleIntelligentAutoplayToggle,
    handleIntelligentAutoplayStart,
    handleIntelligentAutoplayStop,
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
    clientType: 'desktop'
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
    emitStyleUpdate,
    output1Settings,
    output2Settings,
    showToast
  });

  const { processLoadedLyrics, handleImportFromLibrary: baseHandleImportFromLibrary } = useLyricsLoader({
    setLyrics,
    setLyricsSections,
    setLineToSection,
    setRawLyricsContent,
    setLyricsTimestamps,
    selectLine,
    setLyricsFileName,
    setLyricsSource,
    setSongMetadata,
    emitLyricsLoad,
    socket,
    showToast
  });

  const handleImportFromLibrary = React.useCallback(async (params) => {
    const result = await baseHandleImportFromLibrary(params, lyrics);
    if (result) {
      trackAction('song_loaded');
    }
    return result;
  }, [baseHandleImportFromLibrary, lyrics, trackAction]);

  const {
    quickParserOpen,
    setQuickParserOpen,
    quickParserLoading,
    reloadingWithParser,
    quickParserSettings,
    clampGroupSize,
    updateQuickParserSetting,
    handleReloadWithQuickParser,
  } = useQuickParserControls({
    hasLyrics,
    lyricsSource,
    songMetadata,
    rawLyricsContent,
    lyricsFileName,
    processLoadedLyrics,
    showToast
  });

  useElectronListeners({
    processLoadedLyrics,
    showToast,
    setEasyWorshipModalOpen,
    setPresentationModalOpen,
    setlistFiles,
    setSetlistFiles,
    emitSetlistAdd,
    emitSetlistClear
  });

  usePendingLyricsLoad(processLoadedLyrics);

  usePendingSavedVersionPrompt({
    clearPendingSavedVersion,
    lyricsFileName,
    pendingSavedVersion,
    processLoadedLyrics,
    rawLyricsContent,
    showToast,
  });

  const {
    handleCloseOnlineLyricsSearch,
    handleCreateNewSong,
    handleEditLyrics,
    handleFileChange,
    handleOpenOnlineLyricsSearch,
    handleOpenSetlist,
    handleOpenTimerControl,
    openFileDialog,
  } = useControlPanelFileActions({
    clearSearch,
    fileInputRef,
    handleFileUpload,
    isAuthenticated,
    loadSetlist,
    navigate,
    setOnlineLyricsModalOpen,
    setSetlistModalOpen,
    showToast,
    trackAction,
  });

  const handleLineSelect = (index) => {
    selectLine(index);
    emitLineUpdate(index);
    trackAction('lyrics_edited');
  };

  const { handleClearOutput, handleOutputTabSwitch, handleToggle } = useOutputControlActions({
    allOutputIds,
    emitLineUpdate,
    emitOutputToggle,
    isAuthenticated,
    isConnected,
    isOutputOn,
    ready,
    scrollableSettingsRef,
    selectLine,
    setActiveTab,
    setIsOutputOn,
    showToast,
    trackAction,
  });

  const { handleAddOutput, handleDeleteOutput } = useCustomOutputActions({
    activeTab,
    emitIndividualOutputToggle,
    emitOutputRemove,
    emitOutputsRegister,
    emitStyleUpdate,
    setActiveTab,
    showModal,
    showToast,
  });

  const { handleAddToSetlist, disabled: addDisabled, title: addTitle } = useSetlistActions(emitSetlistAdd);

  const { handleNavigateSetlistPrevious, handleNavigateSetlistNext } = useSetlistNavigation({
    emitSetlistLoad,
    hasLyrics,
    lyricsFileName,
    setlistFiles,
    showToast,
  });

  const handleOpenPreferences = React.useCallback(() => {
    showModal({
      title: 'Preferences',
      headerDescription: 'Configure application settings and preferences',
      component: 'UserPreferences',
      variant: 'info',
      size: 'lg',
      actions: [],
      allowBackdropClose: false,
      customLayout: true
    });
  }, [showModal]);

  React.useEffect(() => {
    window.addEventListener('open-setlist-modal', handleOpenSetlist);
    window.addEventListener('open-online-lyrics-search', handleOpenOnlineLyricsSearch);
    window.addEventListener('sync-outputs-from-menu', handleSyncOutputs);
    window.addEventListener('open-user-preferences', handleOpenPreferences);

    return () => {
      window.removeEventListener('open-setlist-modal', handleOpenSetlist);
      window.removeEventListener('open-online-lyrics-search', handleOpenOnlineLyricsSearch);
      window.removeEventListener('sync-outputs-from-menu', handleSyncOutputs);
      window.removeEventListener('open-user-preferences', handleOpenPreferences);
    };
  }, [handleOpenOnlineLyricsSearch, handleOpenPreferences, handleOpenSetlist, handleSyncOutputs]);

  useKeyboardShortcuts({
    hasLyrics,
    lyrics,
    lyricsTimestamps,
    selectedLine,
    handleLineSelect,
    handleToggle,
    handleAutoplayToggle,
    handleIntelligentAutoplayToggle,
    handleClearOutput,
    handleOutputTabSwitch,
    searchQuery,
    clearSearch,
    totalMatches,
    highlightedLineIndex,
    handleOpenSetlist,
    handleOpenOnlineLyricsSearch,
    handleOpenFileDialog: openFileDialog,
    handleCreateNewSong,
    handleEditLyrics,
    handleAddToSetlist,
    handleNavigateSetlistPrevious,
    handleNavigateSetlistNext,
    handleOpenPreferences,
    availableOutputIds: allOutputIds,
    skipSectionTitlesOnKeyboard
  });

  useExternalControl({
    lyrics,
    selectedLine,
    isOutputOn,
    autoplayActive,
    intelligentAutoplayActive,
    selectLine,
    setIsOutputOn,
    emitLineUpdate,
    emitOutputToggle,
    emitOutput1Toggle: (enabled) => emitIndividualOutputToggle({ output: 'output1', enabled }),
    emitOutput2Toggle: (enabled) => emitIndividualOutputToggle({ output: 'output2', enabled }),
    emitStageToggle: (enabled) => emitIndividualOutputToggle({ output: 'stage', enabled }),
    handleAutoplayToggle,
    handleIntelligentAutoplayToggle,
    handleIntelligentAutoplayStart,
    handleIntelligentAutoplayStop,
    handleSetlistNext: handleNavigateSetlistNext,
    handleSetlistPrev: handleNavigateSetlistPrevious,
    setlistFiles,
    emitSetlistLoad,
    handleSyncOutputs,
    showToast,
    songName: lyricsFileName,
    enabled: isDesktopApp
  });

  const iconButtonClass = (disabled = false) => {
    const base = 'h-10 w-full rounded-lg font-medium transition-all duration-150 flex items-center justify-center';
    if (disabled) {
      return `${base} ${darkMode ? 'bg-transparent text-gray-600 cursor-not-allowed opacity-60' : 'bg-transparent text-gray-300 cursor-not-allowed opacity-70'}`;
    }
    return `${base} ${darkMode ? 'bg-transparent text-gray-300 hover:bg-blue-500/10 hover:text-blue-300 focus-visible:bg-blue-500/10 focus-visible:text-blue-300' : 'bg-transparent text-gray-600 hover:bg-blue-50 hover:text-blue-600 focus-visible:bg-blue-50 focus-visible:text-blue-600'}`;
  };

  if (!isDesktopApp) {
    return <MobileLayout />;
  }

  return (
    <>
      <ConnectionBackoffBanner darkMode={darkMode} />
      {isDesktopApp && <DraftApprovalModal darkMode={darkMode} />}
      <div className={`flex h-full font-sans ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
        {/* Left Sidebar - Control Panel */}
        <div className={`w-[420px] flex-shrink-0 shadow-lg flex flex-col h-full ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          {/* Fixed Header Section */}
          <div className={`flex-shrink-0 pt-4 px-5 pb-0 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <ControlPanelHeaderActions
              authStatus={authStatus}
              connectionStatus={connectionStatus}
              darkMode={darkMode}
              forceReconnect={forceReconnect}
              handleOpenOnlineLyricsSearch={handleOpenOnlineLyricsSearch}
              handleOpenSetlist={handleOpenSetlist}
              handleOpenTimerControl={handleOpenTimerControl}
              handleSyncOutputs={handleSyncOutputs}
              iconButtonClass={iconButtonClass}
              isAuthenticated={isAuthenticated}
              isConnected={isConnected}
              maxSetlistFiles={maxSetlistFiles}
              ready={ready}
              refreshAuthToken={refreshAuthToken}
              setDarkMode={setDarkMode}
              setThemeMode={setThemeMode}
              showModal={showModal}
              themeMode={themeMode}
            />

            {/* Load and Create Buttons */}
            <div className={`flex gap-3 ${hasLyrics ? 'mb-3' : 'mb-6'}`}>
              <Tooltip content={<span>Load a .txt or .lrc lyrics file from your computer - <strong>Ctrl+O</strong></span>} side="right">
                <button
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-400 to-purple-600 text-white rounded-xl font-medium hover:from-blue-500 hover:to-purple-700 transition-all duration-200 flex items-center justify-center gap-2"
                  onClick={openFileDialog}
                >
                  <FolderOpen className="w-5 h-5" />
                  Load lyrics file (.txt, .lrc)
                </button>
              </Tooltip>
              <Tooltip content={<span>Open the song canvas to create new lyrics from scratch - <strong>Ctrl+N</strong></span>} side="left">
                <button
                  className={`h-[52px] w-[52px] rounded-xl font-medium transition-all duration-200 flex items-center justify-center ${darkMode
                    ? 'bg-gray-700 hover:bg-blue-500/10 hover:text-blue-300 text-gray-200'
                    : 'bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-700'
                    }`}
                  onClick={handleCreateNewSong}
                >
                  <FilePlusCorner className="w-5 h-5" />
                </button>
              </Tooltip>
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
              <div className={`mb-6 text-sm font-semibold flex items-center gap-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                <FileMusic className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{lyricsFileName}</span>
              </div>
            )}

            {/* Output Toggle */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4 pl-4">
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

              {/* Help trigger button */}
              <Tooltip content="Control Panel Help" side="bottom">
                <button
                  onClick={() => {
                    showModal({
                      title: 'Control Panel Help',
                      headerDescription: 'Master your LyricDisplay workflow with these essential tools',
                      component: 'ControlPanelHelp',
                      variant: 'info',
                      size: 'large',
                      dismissLabel: 'Got it'
                    });
                  }}
                  className={`p-2 rounded-lg transition-colors ${darkMode
                    ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
                    : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                    }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              </Tooltip>
            </div>

            <div className={`border-t my-8 ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}></div>

            {/* Output Tabs */}
            <Tabs value={activeTab} onValueChange={handleOutputTabSwitch}>
              <TabsList className={`w-full p-1.5 h-11 mb-8 gap-1 ${darkMode ? 'bg-gray-700 text-gray-300' : ''}`}>
                {allOutputIds.map((id) => {
                  const num = id.replace('output', '');
                  return (
                    <TabsTrigger
                      key={id}
                      value={id}
                      className={`flex-1 h-full text-sm min-w-0 ${darkMode ? 'data-[state=active]:bg-white data-[state=active]:text-gray-900' : 'data-[state=active]:bg-black data-[state=active]:text-white'}`}
                    >
                      {num}
                    </TabsTrigger>
                  );
                })}
                {allOutputIds.length < DEFAULT_OUTPUT_IDS.length + MAX_CUSTOM_OUTPUTS && (
                  <Tooltip content="Add a new output" side="bottom">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleAddOutput(); }}
                      className={`flex-1 flex items-center justify-center h-full min-w-0 rounded-md transition-colors ${darkMode ? 'hover:bg-gray-600 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-200 text-gray-400 hover:text-gray-600'}`}
                      aria-label="Add output"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </Tooltip>
                )}
                <TabsTrigger value="stage" className={`flex-1 h-full text-sm min-w-0 ${darkMode ? 'data-[state=active]:bg-white data-[state=active]:text-gray-900' : 'data-[state=active]:bg-black data-[state=active]:text-white'}`}>
                  {allOutputIds.length >= 5 ? 'S' : 'Stage'}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Scrollable Settings Panel */}
          <div
            ref={scrollableSettingsRef}
            className="flex-1 overflow-y-auto px-6 relative"
            onScroll={(e) => {
              const scrollTop = e.currentTarget.scrollTop;
              const shadow = e.currentTarget.previousElementSibling;
              if (shadow) {
                if (scrollTop > 10) {
                  shadow.classList.add('shadow-md');
                } else {
                  shadow.classList.remove('shadow-md');
                }
              }
            }}
          >
            {/* Tab Content */}
            <div>
              {activeTab.startsWith('output') && allOutputIds.includes(activeTab) && (
                <OutputSettingsPanel
                  key={activeTab}
                  outputKey={activeTab}
                  onDeleteOutput={activeTab !== 'output1' && activeTab !== 'output2' ? handleDeleteOutput : undefined}
                />
              )}

              {activeTab === 'stage' && (
                <OutputSettingsPanel
                  outputKey="stage"
                />
              )}
            </div>
            <div className="m-10"></div>
          </div>
        </div>

        <LyricsWorkspace
          addDisabled={addDisabled}
          addTitle={addTitle}
          autoplayActive={autoplayActive}
          clampGroupSize={clampGroupSize}
          clearSearch={clearSearch}
          currentMatchIndex={currentMatchIndex}
          darkMode={darkMode}
          dragFileCount={dragFileCount}
          handleAddToSetlist={handleAddToSetlist}
          handleAutoplayToggle={handleAutoplayToggle}
          handleDragEnter={handleDragEnter}
          handleDragLeave={handleDragLeave}
          handleDragOver={handleDragOver}
          handleDrop={handleDrop}
          handleEditLyrics={handleEditLyrics}
          handleIntelligentAutoplayToggle={handleIntelligentAutoplayToggle}
          handleLineSelect={handleLineSelect}
          handleOpenAutoplaySettings={handleOpenAutoplaySettings}
          handleReloadWithQuickParser={handleReloadWithQuickParser}
          handleSearch={handleSearch}
          hasLyrics={hasLyrics}
          headerContainerRef={headerContainerRef}
          highlightedLineIndex={highlightedLineIndex}
          intelligentAutoplayActive={intelligentAutoplayActive}
          isDragging={isDragging}
          lineCounterText={lineCounterText}
          lyricsContainerRef={lyricsContainerRef}
          lyricsFileName={lyricsFileName}
          lyricsTimestamps={lyricsTimestamps}
          navigateToNextMatch={navigateToNextMatch}
          navigateToPreviousMatch={navigateToPreviousMatch}
          quickParserLoading={quickParserLoading}
          quickParserOpen={quickParserOpen}
          quickParserSettings={quickParserSettings}
          quickSwitchClassName={quickSwitchClassName}
          quickSwitchThumbClassName={quickSwitchThumbClassName}
          reloadingWithParser={reloadingWithParser}
          remoteAutoplayActive={remoteAutoplayActive}
          searchQuery={searchQuery}
          setQuickParserOpen={setQuickParserOpen}
          setlistFileCount={setlistFiles.length}
          showModal={showModal}
          totalMatches={totalMatches}
          updateQuickParserSetting={updateQuickParserSetting}
          useIconOnlyButtons={useIconOnlyButtons}
        />
        <ControlPanelModals
          darkMode={darkMode}
          easyWorshipModalOpen={easyWorshipModalOpen}
          handleCloseOnlineLyricsSearch={handleCloseOnlineLyricsSearch}
          handleImportFromLibrary={handleImportFromLibrary}
          onlineLyricsModalOpen={onlineLyricsModalOpen}
          presentationModalOpen={presentationModalOpen}
          setEasyWorshipModalOpen={setEasyWorshipModalOpen}
          setPresentationModalOpen={setPresentationModalOpen}
        />
      </div>
    </>
  );
};

export default LyricDisplayApp;
