import { ChevronDown, Edit, FolderOpen, Info, Play, Plus, Sparkles, Square } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import { hasValidTimestamps } from '../../utils/timestampHelpers';
import SearchBar from '../SearchBar';
import LyricsList from '../LyricsList';
import LyricsDragOverlay from './LyricsDragOverlay';
import QuickParserPopover from './QuickParserPopover';

const LyricsWorkspace = ({
  addDisabled,
  addTitle,
  autoplayActive,
  clampGroupSize,
  clearSearch,
  currentMatchIndex,
  darkMode,
  dragFileCount,
  handleAddToSetlist,
  handleAutoplayToggle,
  handleDragEnter,
  handleDragLeave,
  handleDragOver,
  handleDrop,
  handleEditLyrics,
  handleIntelligentAutoplayToggle,
  handleLineSelect,
  handleOpenAutoplaySettings,
  handleReloadWithQuickParser,
  handleSearch,
  hasLyrics,
  headerContainerRef,
  highlightedLineIndex,
  intelligentAutoplayActive,
  isDragging,
  lineCounterText,
  lyricsContainerRef,
  lyricsFileName,
  lyricsTimestamps,
  navigateToNextMatch,
  navigateToPreviousMatch,
  quickParserLoading,
  quickParserOpen,
  quickParserSettings,
  quickSwitchClassName,
  quickSwitchThumbClassName,
  reloadingWithParser,
  remoteAutoplayActive,
  searchQuery,
  setQuickParserOpen,
  setlistFileCount,
  showModal,
  totalMatches,
  updateQuickParserSetting,
  useIconOnlyButtons,
}) => {
  const blueHoverClass = darkMode
    ? 'bg-transparent text-gray-300 hover:bg-blue-500/10 hover:text-blue-300 focus-visible:bg-blue-500/10 focus-visible:text-blue-300'
    : 'bg-transparent text-gray-700 hover:bg-blue-50 hover:text-blue-600 focus-visible:bg-blue-50 focus-visible:text-blue-600';
  const mutedDisabledClass = darkMode
    ? 'bg-transparent text-gray-600 cursor-not-allowed opacity-60'
    : 'bg-transparent text-gray-400 cursor-not-allowed opacity-60';
  const actionPadding = useIconOnlyButtons ? 'px-2 py-2' : 'px-4 py-2';

  return (
    <div className={`flex-1 min-w-0 pt-4 px-5 pb-5 flex flex-col h-full ${darkMode ? '' : 'bg-[#f8fafc]'}`}>
    <div className="mb-6 shrink-0 min-w-0" ref={headerContainerRef}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className={`text-xl font-bold whitespace-nowrap overflow-hidden text-ellipsis ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            {hasLyrics ? lyricsFileName : ''}
          </h2>
          {hasLyrics && (
            <p className={`text-xs mt-1 whitespace-nowrap overflow-hidden text-ellipsis ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              {lineCounterText}
            </p>
          )}
        </div>

        {hasLyrics && (
          <div className="flex items-center gap-2 shrink-0">
            {hasValidTimestamps(lyricsTimestamps) && (
              <Tooltip content={
                remoteAutoplayActive || autoplayActive
                  ? 'Autoplay is active'
                  : intelligentAutoplayActive
                    ? 'Stop intelligent autoplay'
                    : 'Start timestamp-based autoplay'
              } side="bottom">
                <button
                  onClick={handleIntelligentAutoplayToggle}
                  disabled={remoteAutoplayActive || autoplayActive}
                  className={`p-2 rounded-lg text-xs font-medium transition-all ${remoteAutoplayActive || autoplayActive
                    ? mutedDisabledClass
                    : intelligentAutoplayActive
                      ? 'bg-linear-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white'
                      : blueHoverClass
                    }`}
                  title={intelligentAutoplayActive ? 'Stop intelligent autoplay' : 'Start intelligent autoplay'}
                >
                  <Sparkles className="h-4 w-4" />
                </button>
              </Tooltip>
            )}

            <Tooltip content={
              remoteAutoplayActive || intelligentAutoplayActive
                ? 'Autoplay is active'
                : autoplayActive
                  ? 'Stop autoplay'
                  : 'Start automatic lyric progression'
            } side="bottom">
              <div className="relative flex">
                <button
                  onClick={handleAutoplayToggle}
                  disabled={remoteAutoplayActive || intelligentAutoplayActive}
                  className={`flex items-center gap-2 text-xs font-medium transition-all ${remoteAutoplayActive || intelligentAutoplayActive
                    ? `${mutedDisabledClass} ${actionPadding} rounded-lg`
                    : autoplayActive
                      ? useIconOnlyButtons
                        ? 'bg-green-600 hover:bg-green-700 text-white px-2 py-2 rounded-lg'
                        : 'bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg'
                      : `${blueHoverClass} ${actionPadding} rounded-l-lg`
                    }`}
                >
                  {autoplayActive ? (
                    <>
                      <Square className="h-4 w-4 shrink-0 fill-current" />
                      {!useIconOnlyButtons && <span className="whitespace-nowrap">Autoplay</span>}
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 shrink-0" />
                      {!useIconOnlyButtons && <span className="whitespace-nowrap">Autoplay</span>}
                    </>
                  )}
                </button>

                {!autoplayActive && !remoteAutoplayActive && !intelligentAutoplayActive && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenAutoplaySettings();
                    }}
                    className={`flex items-center justify-center ${useIconOnlyButtons ? 'px-1.5' : 'px-2'} py-2 rounded-r-lg transition-all ${blueHoverClass}`}
                    title="Autoplay settings"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                )}
              </div>
            </Tooltip>

            <Tooltip content="Add current lyrics to your setlist for quick access during service" side="bottom">
              <button
                onClick={handleAddToSetlist}
                aria-disabled={addDisabled}
                className={`flex items-center gap-2 rounded-lg text-xs font-medium transition-all ${addDisabled ? mutedDisabledClass : blueHoverClass} ${actionPadding}`}
                title={addTitle}
                style={{ cursor: addDisabled ? 'not-allowed' : 'pointer', opacity: addDisabled ? 0.9 : 1 }}
              >
                <Plus className="h-4 w-4 shrink-0" />
                {!useIconOnlyButtons && <span className="whitespace-nowrap overflow-hidden text-ellipsis">Add to Setlist</span>}
              </button>
            </Tooltip>

            <Tooltip content="Edit current lyrics in the song canvas editor" side="bottom">
              <button
                onClick={handleEditLyrics}
                className={`flex items-center gap-2 rounded-lg text-xs font-medium transition-all ${blueHoverClass} ${actionPadding}`}
              >
                <Edit className="h-4 w-4 shrink-0" />
                {!useIconOnlyButtons && <span className="whitespace-nowrap overflow-hidden text-ellipsis">Edit Lyrics</span>}
              </button>
            </Tooltip>

            <Tooltip content="View song information" side="bottom">
              <button
                onClick={() => {
                  showModal({
                    title: 'Song Information',
                    component: 'SongInfoModal',
                    variant: 'info',
                    size: 'sm',
                    dismissLabel: 'Close'
                  });
                }}
                className={`p-2 rounded-lg transition-all ${blueHoverClass}`}
                title="Song Information"
              >
                <Info className="h-4 w-4" />
              </button>
            </Tooltip>
          </div>
        )}
      </div>

      {hasLyrics && (
        <div className="mt-5 w-full">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
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
            <QuickParserPopover
              clampGroupSize={clampGroupSize}
              darkMode={darkMode}
              handleReloadWithQuickParser={handleReloadWithQuickParser}
              quickParserLoading={quickParserLoading}
              quickParserOpen={quickParserOpen}
              quickParserSettings={quickParserSettings}
              quickSwitchClassName={quickSwitchClassName}
              quickSwitchThumbClassName={quickSwitchThumbClassName}
              reloadingWithParser={reloadingWithParser}
              setQuickParserOpen={setQuickParserOpen}
              updateQuickParserSetting={updateQuickParserSetting}
            />
          </div>
        </div>
      )}
    </div>

    <div className={`rounded-lg shadow-sm border flex-1 flex flex-col overflow-hidden relative ${darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}`}>
      {hasLyrics ? (
        <div
          ref={lyricsContainerRef}
          className="flex-1 overflow-y-auto"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
        >
          <LyricsList
            searchQuery={searchQuery}
            highlightedLineIndex={highlightedLineIndex}
            onSelectLine={handleLineSelect}
            maxLinesPerGroup={quickParserSettings.maxLinesPerGroup}
          />
        </div>
      ) : (
        <div
          className="flex-1 flex items-center justify-center p-4"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
        >
          <div className="text-center">
            <div className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
              <FolderOpen className={`w-10 h-10 ${darkMode ? 'text-gray-400' : 'text-gray-400'}`} />
            </div>
            <p className={`text-lg ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Drag and drop lyric files or setlists (.ldset) here
            </p>
          </div>
        </div>
      )}

      {isDragging && (
        <LyricsDragOverlay
          darkMode={darkMode}
          dragFileCount={dragFileCount}
          hasLyrics={hasLyrics}
          setlistFileCount={setlistFileCount}
        />
      )}
    </div>
  </div>
  );
};

export default LyricsWorkspace;
