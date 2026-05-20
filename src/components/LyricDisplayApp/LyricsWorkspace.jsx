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
}) => (
  <div className="flex-1 min-w-0 p-6 flex flex-col h-full">
    <div className="mb-6 flex-shrink-0 min-w-0" ref={headerContainerRef}>
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
          <div className="flex items-center gap-2 flex-shrink-0">
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
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed opacity-60'
                    : intelligentAutoplayActive
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white'
                      : darkMode
                        ? 'bg-gradient-to-r from-purple-600/20 to-blue-600/20 hover:from-purple-600/30 hover:to-blue-600/30 text-purple-300 border border-purple-500/30'
                        : 'bg-gradient-to-r from-purple-100 to-blue-100 hover:from-purple-200 hover:to-blue-200 text-purple-700 border border-purple-300'
                    }`}
                  title={intelligentAutoplayActive ? 'Stop intelligent autoplay' : 'Start intelligent autoplay'}
                >
                  <Sparkles className="w-4 h-4" />
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
                    ? useIconOnlyButtons
                      ? 'bg-gray-400 text-gray-600 cursor-not-allowed px-2 py-2 rounded-lg opacity-60'
                      : 'bg-gray-400 text-gray-600 cursor-not-allowed px-4 py-2 rounded-lg opacity-60'
                    : autoplayActive
                      ? useIconOnlyButtons
                        ? 'bg-green-600 hover:bg-green-700 text-white px-2 py-2 rounded-lg'
                        : 'bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg'
                      : useIconOnlyButtons
                        ? darkMode
                          ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 px-2 py-2 rounded-l-lg'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-800 px-2 py-2 rounded-l-lg'
                        : darkMode
                          ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 px-4 py-2 rounded-l-lg'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-l-lg'
                    }`}
                >
                  {autoplayActive ? (
                    <>
                      <Square className="w-4 h-4 flex-shrink-0 fill-current" />
                      {!useIconOnlyButtons && <span className="whitespace-nowrap">Autoplay</span>}
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 flex-shrink-0" />
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
                    className={`flex items-center justify-center ${useIconOnlyButtons ? 'px-1.5' : 'px-2'} py-2 rounded-r-lg transition-colors border-l ${autoplayActive
                      ? 'bg-green-600 hover:bg-green-700 text-white border-green-500'
                      : darkMode
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-600'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-800 border-gray-300'
                      }`}
                    title="Autoplay settings"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                )}
              </div>
            </Tooltip>

            <Tooltip content="Add current lyrics to your setlist for quick access during service" side="bottom">
              <button
                onClick={handleAddToSetlist}
                aria-disabled={addDisabled}
                className={`flex items-center gap-2 rounded-lg text-xs font-medium transition-colors ${addDisabled
                  ? (darkMode ? 'bg-gray-700 text-gray-500' : 'bg-gray-100 text-gray-400')
                  : (darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-800')
                  } ${useIconOnlyButtons ? 'px-2 py-2' : 'px-4 py-2'}`}
                title={addTitle}
                style={{ cursor: addDisabled ? 'not-allowed' : 'pointer', opacity: addDisabled ? 0.9 : 1 }}
              >
                <Plus className="w-4 h-4 flex-shrink-0" />
                {!useIconOnlyButtons && <span className="whitespace-nowrap overflow-hidden text-ellipsis">Add to Setlist</span>}
              </button>
            </Tooltip>

            <Tooltip content="Edit current lyrics in the song canvas editor" side="bottom">
              <button
                onClick={handleEditLyrics}
                className={`flex items-center gap-2 rounded-lg text-xs font-medium transition-colors ${darkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                  } ${useIconOnlyButtons ? 'px-2 py-2' : 'px-4 py-2'}`}
              >
                <Edit className="w-4 h-4 flex-shrink-0" />
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
                className={`p-2 rounded-lg transition-colors ${darkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                title="Song Information"
              >
                <Info className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>
        )}
      </div>

      {hasLyrics && (
        <div className="mt-3 w-full">
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
              Drag and drop lyric files (.txt, .lrc) or setlists (.ldset) here
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

export default LyricsWorkspace;
