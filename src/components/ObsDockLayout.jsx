import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FilePlus2,
  FolderOpen,
  ListMusic,
  Menu,
  Power,
  RefreshCw,
  Settings,
  Trash2,
  X,
} from 'lucide-react';
import { useAllOutputIds, useDarkModeState, useLyricsState, useOutputState, useSetlistState } from '../hooks/useStoreSelectors';
import useLyricsStore from '../context/LyricsStore';
import { useControlSocket } from '../context/ControlSocketProvider';
import useFileUpload from '../hooks/useFileUpload';
import useMultipleFileUpload from '../hooks/useMultipleFileUpload';
import useSearch from '../hooks/useSearch';
import useToast from '../hooks/useToast';
import LyricsList from './LyricsList';
import SearchBar from './SearchBar';
import OutputSettingsPanel from './OutputSettingsPanel';

const CLIENT_URL = import.meta.env.MODE === 'development'
  ? 'http://localhost:5173/obs-dock'
  : 'http://127.0.0.1:4000/#/obs-dock';

const outputLabel = (outputId) => {
  if (outputId === 'stage') return 'Stage';
  if (typeof outputId === 'string' && outputId.startsWith('output')) {
    return `Out ${outputId.replace('output', '')}`;
  }
  return outputId;
};

function OutputPill({ outputId, active, onSelect, onToggle, onSettings }) {
  const darkMode = useLyricsStore((state) => state.darkMode);
  const enabled = useLyricsStore((state) => (
    outputId === 'stage'
      ? state.stageEnabled
      : state[`${outputId}Enabled`] ?? true
  ));

  return (
    <div className={`flex items-center rounded-md border text-xs ${active
      ? darkMode ? 'border-blue-400 bg-blue-500/15 text-blue-100' : 'border-blue-500 bg-blue-50 text-blue-900'
      : darkMode ? 'border-gray-700 bg-gray-900 text-gray-200' : 'border-gray-200 bg-white text-gray-800'
      }`}>
      <button type="button" onClick={onSelect} className="px-2.5 py-2 font-semibold">
        {outputLabel(outputId)}
      </button>
      <button
        type="button"
        onClick={() => onToggle(outputId, !enabled)}
        className={`border-l px-2 py-2 ${darkMode ? 'border-gray-700' : 'border-gray-200'} ${enabled ? 'text-green-500' : 'text-gray-400'}`}
        title={enabled ? 'Disable output' : 'Enable output'}
      >
        <Power className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onSettings(outputId)}
        className={`border-l px-2 py-2 ${darkMode ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-600'}`}
        title="Open output settings"
      >
        <Settings className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function SetlistItem({ file, index, total, darkMode, onLoad, onRemove, onMove }) {
  return (
    <div className={`flex items-center gap-2 rounded-md border px-3 py-2 ${darkMode ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-white'}`}>
      <button type="button" onClick={() => onLoad(file.id)} className="min-w-0 flex-1 text-left">
        <div className="truncate text-sm font-semibold">{file.displayName || file.originalName}</div>
        <div className={`truncate text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
          {file.fileType === 'lrc' ? 'LRC' : 'Text'}
        </div>
      </button>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onMove(index, -1)}
          disabled={index === 0}
          className={`rounded p-1.5 ${index === 0 ? 'cursor-not-allowed opacity-35' : darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
          title="Move up"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onMove(index, 1)}
          disabled={index >= total - 1}
          className={`rounded p-1.5 ${index >= total - 1 ? 'cursor-not-allowed opacity-35' : darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
          title="Move down"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onRemove(file.id)}
          className={`rounded p-1.5 ${darkMode ? 'text-gray-400 hover:bg-gray-800 hover:text-red-300' : 'text-gray-500 hover:bg-gray-100 hover:text-red-600'}`}
          title="Remove from setlist"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function ObsDockLayout() {
  const { darkMode } = useDarkModeState();
  const { lyrics, lyricsFileName, rawLyricsContent, songMetadata, lyricsTimestamps, selectedLine, selectLine } = useLyricsState();
  const { isOutputOn, setIsOutputOn } = useOutputState();
  const { setlistFiles, setSetlistFiles, isSetlistFull, getMaxSetlistFiles } = useSetlistState();
  const allOutputIds = useAllOutputIds();
  const { showToast } = useToast();
  const handleFileUpload = useFileUpload();
  const handleMultipleFileUpload = useMultipleFileUpload();
  const fileInputRef = React.useRef(null);
  const setlistInputRef = React.useRef(null);
  const [activeOutput, setActiveOutput] = React.useState('output1');
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [setlistOpen, setSetlistOpen] = React.useState(false);

  const {
    emitLineUpdate,
    emitOutputToggle,
    emitIndividualOutputToggle,
    emitSetlistAdd,
    emitSetlistLoad,
    emitSetlistRemove,
    emitSetlistReorder,
    forceReconnect,
    connectionStatus,
    authStatus,
    isConnected,
    isAuthenticated,
    ready,
  } = useControlSocket();

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

  const hasLyrics = Array.isArray(lyrics) && lyrics.length > 0;
  const maxSetlistFiles = getMaxSetlistFiles();
  const canControl = isConnected && isAuthenticated && ready;
  const shellClasses = darkMode ? 'bg-gray-950 text-gray-100' : 'bg-gray-50 text-gray-950';
  const panelClasses = darkMode ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-white';

  const openDesktopApp = React.useCallback(() => {
    window.location.href = 'lyricdisplay://open';
  }, []);

  const handleLineSelect = React.useCallback((index) => {
    if (!canControl) return;
    selectLine(index);
    emitLineUpdate(index);
  }, [canControl, emitLineUpdate, selectLine]);

  const handleToggleOutput = React.useCallback(() => {
    const next = !isOutputOn;
    setIsOutputOn(next);
    emitOutputToggle(next);
  }, [emitOutputToggle, isOutputOn, setIsOutputOn]);

  const handleIndividualToggle = React.useCallback((outputId, enabled) => {
    const store = useLyricsStore.getState();
    if (outputId === 'stage') {
      store.setStageEnabled(enabled);
    } else {
      store.setOutputEnabled(outputId, enabled);
    }
    emitIndividualOutputToggle({ output: outputId, enabled });
  }, [emitIndividualOutputToggle]);

  const handleOpenSettings = React.useCallback((outputId = activeOutput) => {
    setActiveOutput(outputId);
    setSettingsOpen(true);
  }, [activeOutput]);

  const handleMainFileInput = React.useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const loaded = await handleFileUpload(file);
    if (loaded) clearSearch();
  }, [clearSearch, handleFileUpload]);

  const handleSetlistFilesInput = React.useCallback(async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0) return;
    await handleMultipleFileUpload(files);
  }, [handleMultipleFileUpload]);

  const handleAddCurrentToSetlist = React.useCallback(() => {
    if (!hasLyrics || !rawLyricsContent || !lyricsFileName) {
      showToast({ title: 'No loaded file', message: 'Load lyrics before adding to setlist.', variant: 'warn' });
      return;
    }
    if (isSetlistFull()) {
      showToast({ title: 'Setlist full', message: `${maxSetlistFiles} songs maximum reached.`, variant: 'warn' });
      return;
    }

    const extension = Array.isArray(lyricsTimestamps) && lyricsTimestamps.length > 0 ? '.lrc' : '.txt';
    const emitted = emitSetlistAdd([{
      name: `${lyricsFileName}${extension}`,
      content: rawLyricsContent,
      lastModified: Date.now(),
      metadata: songMetadata || null,
    }]);

    if (!emitted) {
      showToast({ title: 'Setlist unavailable', message: 'Connection is not ready yet.', variant: 'warn' });
    }
  }, [emitSetlistAdd, hasLyrics, isSetlistFull, lyricsFileName, lyricsTimestamps, maxSetlistFiles, rawLyricsContent, showToast, songMetadata]);

  const handleMoveSetlistItem = React.useCallback((index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= setlistFiles.length) return;
    const next = [...setlistFiles];
    const [item] = next.splice(index, 1);
    next.splice(nextIndex, 0, item);
    setSetlistFiles(next);
    emitSetlistReorder(next.map((file) => file.id));
  }, [emitSetlistReorder, setSetlistFiles, setlistFiles]);

  return (
    <div className={`flex h-screen min-h-0 flex-col overflow-hidden font-sans ${shellClasses}`}>
      <header className={`flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2 ${darkMode ? 'border-gray-800 bg-gray-950' : 'border-gray-200 bg-white'}`}>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold">LyricDisplay Dock</div>
          <div className={`truncate text-[11px] ${canControl ? 'text-green-500' : darkMode ? 'text-yellow-300' : 'text-yellow-700'}`}>
            {canControl ? 'Connected' : `${connectionStatus} / ${authStatus}`}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setSetlistOpen(true)} className={`relative rounded-md p-2 ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`} title="Open setlist">
            <ListMusic className="h-4 w-4" />
            {setlistFiles.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-blue-600 px-1 text-[10px] font-bold leading-4 text-white">
                {setlistFiles.length}
              </span>
            )}
          </button>
          <button type="button" onClick={forceReconnect} className={`rounded-md p-2 ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`} title="Reconnect">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button type="button" onClick={openDesktopApp} className={`rounded-md p-2 ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`} title="Open desktop app">
            <ExternalLink className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => handleOpenSettings(activeOutput)} className={`rounded-md p-2 ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`} title="Output settings">
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-2">
        <section className={`shrink-0 rounded-lg border p-2 ${panelClasses}`}>
          <div className="mb-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <FolderOpen className="h-4 w-4 shrink-0" />
              <span className="truncate">Load Lyrics</span>
            </button>
            <button
              type="button"
              onClick={handleAddCurrentToSetlist}
              disabled={!hasLyrics || !canControl}
              className={`rounded-md p-2 ${!hasLyrics || !canControl ? 'cursor-not-allowed opacity-45' : darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'}`}
              title="Add current song to setlist"
            >
              <FilePlus2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleToggleOutput}
              disabled={!canControl}
              className={`rounded-md p-2 ${!canControl ? 'cursor-not-allowed opacity-45' : isOutputOn ? 'bg-green-600 text-white hover:bg-green-700' : darkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              title={isOutputOn ? 'Turn display output off' : 'Turn display output on'}
            >
              <Power className="h-4 w-4" />
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept=".txt,.lrc" className="hidden" onChange={handleMainFileInput} />
          <input ref={setlistInputRef} type="file" accept=".txt,.lrc" multiple className="hidden" onChange={handleSetlistFilesInput} />
          <div className={`truncate text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {lyricsFileName || 'No lyrics loaded'}
            {typeof selectedLine === 'number' && hasLyrics ? ` · Line ${selectedLine + 1}/${lyrics.length}` : ''}
          </div>
        </section>

        <section className={`shrink-0 rounded-lg border p-2 ${panelClasses}`}>
          <div className="flex flex-wrap gap-1.5">
            {[...allOutputIds, 'stage'].map((outputId) => (
              <OutputPill
                key={outputId}
                outputId={outputId}
                active={activeOutput === outputId}
                onSelect={() => setActiveOutput(outputId)}
                onToggle={handleIndividualToggle}
                onSettings={handleOpenSettings}
              />
            ))}
          </div>
        </section>

        <section className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border ${panelClasses}`}>
          <div className={`shrink-0 border-b p-2 ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
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
          <div ref={lyricsContainerRef} className="min-h-0 flex-1 overflow-y-auto px-2">
            {hasLyrics ? (
              <LyricsList
                searchQuery={searchQuery}
                highlightedLineIndex={highlightedLineIndex}
                onSelectLine={handleLineSelect}
              />
            ) : (
              <div className={`flex h-full items-center justify-center p-6 text-center text-sm ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                Load a lyrics file or choose a song from the setlist.
              </div>
            )}
          </div>
        </section>
      </main>

      {setlistOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/45">
          <div className={`flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2 ${darkMode ? 'border-gray-800 bg-gray-950 text-gray-100' : 'border-gray-200 bg-white text-gray-950'}`}>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-bold">
                <ListMusic className="h-4 w-4" />
                <span>Setlist</span>
                <span className={darkMode ? 'text-gray-500' : 'text-gray-500'}>({setlistFiles.length}/{maxSetlistFiles})</span>
              </div>
              <div className={`truncate text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                Add, load, remove, and reorder dock setlist songs.
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setlistInputRef.current?.click()}
                disabled={!canControl || isSetlistFull()}
                className={`rounded-md px-2.5 py-2 text-xs font-semibold ${!canControl || isSetlistFull() ? 'cursor-not-allowed opacity-45' : darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'}`}
              >
                Add
              </button>
              <button type="button" onClick={() => setSetlistOpen(false)} className={`rounded-md p-2 ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`} title="Close setlist">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className={`min-h-0 flex-1 overflow-y-auto p-3 ${darkMode ? 'bg-gray-950' : 'bg-gray-50'}`}>
            <div className="space-y-1.5">
              {setlistFiles.length === 0 ? (
                <div className={`rounded-md border border-dashed px-3 py-8 text-center text-xs ${darkMode ? 'border-gray-800 text-gray-500' : 'border-gray-200 text-gray-500'}`}>
                  Add lyric files for quick service-order loading.
                </div>
              ) : (
                setlistFiles.map((file, index) => (
                  <SetlistItem
                    key={file.id}
                    file={file}
                    index={index}
                    total={setlistFiles.length}
                    darkMode={darkMode}
                    onLoad={(fileId) => {
                      emitSetlistLoad(fileId);
                      setSetlistOpen(false);
                    }}
                    onRemove={emitSetlistRemove}
                    onMove={handleMoveSetlistItem}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/45">
          <div className={`flex shrink-0 items-center justify-between border-b px-3 py-2 ${darkMode ? 'border-gray-800 bg-gray-950 text-gray-100' : 'border-gray-200 bg-white text-gray-950'}`}>
            <div>
              <div className="text-sm font-bold">{outputLabel(activeOutput)} Settings</div>
              <div className={`text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{CLIENT_URL}</div>
            </div>
            <button type="button" onClick={() => setSettingsOpen(false)} className={`rounded-md p-2 ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`} title="Close settings">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className={`min-h-0 flex-1 overflow-y-auto p-4 ${darkMode ? 'bg-gray-950' : 'bg-gray-50'}`}>
            <div className="mx-auto max-w-xl">
              <OutputSettingsPanel outputKey={activeOutput} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
