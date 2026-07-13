import { useEffect, useState } from 'react';
import { ChevronDown, Edit, FolderOpen, Info, MousePointerClick, Play, Plus, Sparkles, Square } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import { hasValidTimestamps } from '../../utils/timestampHelpers';
import SearchBar from '../SearchBar';
import LyricsList from '../LyricsList';
import LyricsDragOverlay from './LyricsDragOverlay';
import QuickParserPopover from './QuickParserPopover';
import { FIRST_RUN_TOUR_STEP_EVENT } from '../../utils/firstRunTour';

const TOUR_PREVIEW_LINES = [
  'Morning breaks with hope anew',
  'Every heart can find its song',
  'We lift our voices, clear and strong',
];

const TourLyricsPreview = ({ darkMode }) => (
  <div className="flex-1 overflow-hidden p-5" aria-label="Sample lyrics for the product tour">
    <div className="mx-auto flex h-full max-w-3xl flex-col">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className={`text-[11px] font-bold uppercase tracking-[0.16em] ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>
            Tour preview
          </p>
          <h3 className={`mt-1 text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>A sample song</h3>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
          3 lyric groups
        </span>
      </div>

      <div className={`mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
        <span>Verse 1</span>
        <span className={`h-px flex-1 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
      </div>

      <div className="space-y-2">
        {TOUR_PREVIEW_LINES.map((line, index) => {
          const selected = index === 1;
          return (
            <div
              key={line}
              className={`flex items-center gap-4 rounded-xl border px-4 py-3 transition-colors ${selected
                ? darkMode
                  ? 'border-blue-400 bg-blue-500/20 text-white shadow-lg shadow-blue-950/20'
                  : 'border-blue-500 bg-blue-50 text-blue-950 shadow-sm'
                : darkMode
                  ? 'border-gray-700 bg-gray-800/70 text-gray-300'
                  : 'border-gray-200 bg-white text-gray-700'
              }`}
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${selected
                ? 'bg-blue-600 text-white'
                : darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
              }`}>
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 text-[15px] font-medium">{line}</span>
              {selected && (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                  <MousePointerClick className="h-3 w-3" />
                  Selected
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className={`mt-5 flex items-center gap-2 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        <MousePointerClick className="h-4 w-4 text-blue-500" />
        Click a row or use the arrow keys to change the selected lyric group.
      </div>
    </div>
  </div>
);

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
  const [activeTourStep, setActiveTourStep] = useState(null);
  useEffect(() => {
    const handleTourStepChange = (event) => setActiveTourStep(event?.detail?.stepId || null);
    window.addEventListener(FIRST_RUN_TOUR_STEP_EVENT, handleTourStepChange);
    return () => window.removeEventListener(FIRST_RUN_TOUR_STEP_EVENT, handleTourStepChange);
  }, []);

  const showTourLyricsPreview = !hasLyrics && activeTourStep === 'workspace';
  const blueHoverClass = darkMode
    ? 'bg-transparent text-gray-300 hover:bg-blue-500/10 hover:text-blue-300 focus-visible:bg-blue-500/10 focus-visible:text-blue-300'
    : 'bg-transparent text-gray-700 hover:bg-blue-50 hover:text-blue-600 focus-visible:bg-blue-50 focus-visible:text-blue-600';
  const mutedDisabledClass = darkMode
    ? 'bg-transparent text-gray-600 cursor-not-allowed opacity-60'
    : 'bg-transparent text-gray-400 cursor-not-allowed opacity-60';
  const actionPadding = useIconOnlyButtons ? 'px-2 py-2' : 'px-4 py-2';

  return (
    <div data-tour="lyrics-workspace" className={`flex-1 min-w-0 pt-4 px-5 pb-5 flex flex-col h-full ${darkMode ? '' : 'bg-[#f8fafc]'}`}>
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
          />
        </div>
      ) : showTourLyricsPreview ? (
        <TourLyricsPreview darkMode={darkMode} />
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
