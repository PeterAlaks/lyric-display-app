import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FilePlus2,
  FolderOpen,
  ListPlus,
  ListMusic,
  Menu,
  PencilLine,
  Power,
  RefreshCw,
  Save,
  Settings,
  Trash2,
  X,
} from 'lucide-react';
import { useAllOutputIds, useLyricsState, useOutputState, useSetlistState } from '../hooks/useStoreSelectors';
import useLyricsStore from '../context/LyricsStore';
import { useControlSocket } from '../context/ControlSocketProvider';
import useFileUpload from '../hooks/useFileUpload';
import useMultipleFileUpload from '../hooks/useMultipleFileUpload';
import useSearch from '../hooks/useSearch';
import useToast from '../hooks/useToast';
import { useLyricsLoader } from '../hooks/LyricDisplayApp/useLyricsLoader';
import { useQuickParserControls } from '../hooks/LyricDisplayApp/useQuickParserControls';
import LyricsList from './LyricsList';
import SearchBar from './SearchBar';
import OutputSettingsPanel from './OutputSettingsPanel';
import QuickParserPopover from './LyricDisplayApp/QuickParserPopover';
import { Tooltip } from '@/components/ui/tooltip';
import {
  getLyricFormatLabel,
  getLyricImportFormatForType,
  getLyricsAcceptAttribute,
  normalizeLyricFileType,
} from '../../shared/lyricImportRegistry.js';

const outputLabel = (outputId) => {
  if (outputId === 'stage') return 'Stage';
  if (typeof outputId === 'string' && outputId.startsWith('output')) {
    return `Out ${outputId.replace('output', '')}`;
  }
  return outputId;
};

function OutputPill({ outputId, active, onSelect, onToggle, onSettings }) {
  const darkMode = true;
  const enabled = useLyricsStore((state) => (
    outputId === 'stage'
      ? state.stageEnabled
      : state[`${outputId}Enabled`] ?? true
  ));

  return (
    <div className={`flex h-8 shrink-0 items-center rounded-full border text-[11px] transition-colors ${active
      ? darkMode ? 'border-blue-400/60 bg-blue-500/15 text-blue-100' : 'border-blue-400 bg-blue-50 text-blue-900'
      : darkMode ? 'border-gray-800/80 bg-transparent text-gray-400 hover:border-blue-500/35 hover:text-blue-300' : 'border-gray-200 bg-transparent text-gray-600 hover:border-blue-200 hover:text-blue-600'
      }`}>
      <button type="button" onClick={onSelect} className="px-2 font-semibold">
        {outputLabel(outputId)}
      </button>
      <button
        type="button"
        onClick={() => onToggle(outputId, !enabled)}
        className={`h-full border-l px-1.5 transition-colors ${darkMode ? 'border-gray-800 hover:text-blue-300' : 'border-gray-200 hover:text-blue-600'} ${enabled ? 'text-green-500' : 'text-gray-500'}`}
        title={enabled ? 'Disable output' : 'Enable output'}
      >
        <Power className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onSettings(outputId)}
        className={`h-full border-l px-1.5 transition-colors ${darkMode ? 'border-gray-800 text-gray-500 hover:text-blue-300' : 'border-gray-200 text-gray-500 hover:text-blue-600'}`}
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
          {getLyricFormatLabel(file.fileType)}
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

const sanitizeSongTitle = (value) => (value || '')
  .replace(/[<>:"/\\|?*]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const hasLrcTimestamps = (content) => /^\s*\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/m.test(content || '');

const lyricLineToText = (line) => {
  if (typeof line === 'string') return line;
  if (!line || typeof line !== 'object') return '';
  if (Array.isArray(line.lines)) return line.lines.join('\n');
  return [line.line1, line.line2, line.text, line.content].filter(Boolean).join('\n');
};

function DockSongEditor({
  darkMode,
  initialContent,
  initialTitle,
  mode,
  onClose,
  onSaveAndLoad,
  showToast,
}) {
  const [title, setTitle] = React.useState(initialTitle || '');
  const [content, setContent] = React.useState(initialContent || '');
  const [saving, setSaving] = React.useState(false);
  const titleInputRef = React.useRef(null);

  React.useEffect(() => {
    setTitle(initialTitle || '');
    setContent(initialContent || '');
  }, [initialContent, initialTitle]);

  React.useEffect(() => {
    titleInputRef.current?.focus();
  }, []);

  const canSave = title.trim().length > 0 && content.trim().length > 0;
  const extension = hasLrcTimestamps(content) ? 'lrc' : 'txt';

  const downloadFile = React.useCallback(() => {
    if (!canSave) {
      showToast({ title: 'Missing song details', message: 'Add a title and lyrics before saving.', variant: 'warn' });
      return null;
    }

    const baseName = sanitizeSongTitle(title) || 'lyrics';
    const fileName = `${baseName}.${extension}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast({ title: 'File saved', message: `${fileName} downloaded.`, variant: 'success' });
      return { fileName, baseName, extension, content };
    } finally {
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }, [canSave, content, extension, showToast, title]);

  const handleSave = React.useCallback(() => {
    downloadFile();
  }, [downloadFile]);

  const handleSaveAndLoad = React.useCallback(async () => {
    const saved = downloadFile();
    if (!saved) return;

    setSaving(true);
    try {
      const loaded = await onSaveAndLoad(saved);
      if (loaded) onClose();
    } finally {
      setSaving(false);
    }
  }, [downloadFile, onClose, onSaveAndLoad]);

  return (
    <div
      className="fixed inset-0 z-50 grid grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-black/45"
      style={{ height: '100dvh' }}
    >
      <div className={`flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2 ${darkMode ? 'border-gray-800 bg-gray-950 text-gray-100' : 'border-gray-200 bg-white text-gray-950'}`}>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold">{mode === 'edit' ? 'Edit Lyrics' : 'Create Song'}</div>
          <div className={`truncate text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>Save downloads a file. Save & Load also sends it live.</div>
        </div>
        <button type="button" onClick={onClose} className={`rounded-md p-2 ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`} title="Close editor">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className={`min-h-0 overflow-hidden p-3 ${darkMode ? 'bg-gray-950' : 'bg-gray-50'}`}>
        <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
          <input
            ref={titleInputRef}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Song title"
            className={`h-9 rounded-md border px-3 text-sm font-semibold outline-none ${darkMode ? 'border-gray-800 bg-gray-900 text-gray-100 placeholder:text-gray-600 focus:border-blue-500' : 'border-gray-200 bg-white text-gray-950 placeholder:text-gray-400 focus:border-blue-500'}`}
          />
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Type or paste lyrics..."
            spellCheck={false}
            className={`dock-scrollbar h-full min-h-0 max-h-full resize-none overflow-y-auto rounded-md border p-3 font-mono text-sm leading-relaxed outline-none ${darkMode ? 'border-gray-800 bg-gray-900 text-gray-100 placeholder:text-gray-600 focus:border-blue-500' : 'border-gray-200 bg-white text-gray-950 placeholder:text-gray-400 focus:border-blue-500'}`}
          />
        </div>
      </div>
      <div className={`flex shrink-0 items-center gap-2 border-t p-3 ${darkMode ? 'border-gray-800 bg-gray-950' : 'border-gray-200 bg-white'}`}>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave || saving}
          className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-semibold ${!canSave || saving ? 'cursor-not-allowed opacity-45' : darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'}`}
        >
          <Save className="h-3.5 w-3.5" />
          <span>Save</span>
        </button>
        <button
          type="button"
          onClick={handleSaveAndLoad}
          disabled={!canSave || saving}
          className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-blue-600 text-xs font-semibold text-white ${!canSave || saving ? 'cursor-not-allowed opacity-45' : 'hover:bg-blue-700'}`}
        >
          <FolderOpen className="h-3.5 w-3.5" />
          <span>{saving ? 'Loading...' : 'Save & Load'}</span>
        </button>
      </div>
    </div>
  );
}

export default function ObsDockLayout() {
  const darkMode = true;
  const {
    lyrics,
    lyricsFileName,
    lyricsSource,
    rawLyricsContent,
    songMetadata,
    lyricsTimestamps,
    selectedLine,
    selectLine,
    setLyrics,
    setLyricsSections,
    setLineToSection,
    setRawLyricsContent,
    setLyricsFileName,
    setLyricsSource,
    setSongMetadata,
    setLyricsTimestamps,
  } = useLyricsState();
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
  const [editorState, setEditorState] = React.useState(null);
  const [desktopControlAvailable, setDesktopControlAvailable] = React.useState(false);

  const {
    emitLineUpdate,
    emitLyricsLoad,
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
    socket,
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
  const quickSwitchClassName = '!h-7 !w-14 !border-0 shadow-sm transition-colors data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600';
  const quickSwitchThumbClassName = '!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1';
  const shellClasses = darkMode ? 'bg-gray-950 text-gray-100' : 'bg-gray-50 text-gray-950';
  const toolbarClasses = darkMode ? 'border-gray-800 bg-gray-950/95' : 'border-gray-200 bg-white/95';
  const dockIconButtonClass = darkMode
    ? 'inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-blue-500/10 hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/35'
    : 'inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-blue-50 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/35';
  const dockIconDisabledClass = 'cursor-not-allowed opacity-45';
  const dockPrimaryButtonClass = 'flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full bg-linear-to-r from-blue-400 to-purple-600 px-3 text-xs font-semibold text-white transition-all duration-200 hover:from-blue-500 hover:to-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40';
  const currentLineText = hasLyrics && typeof selectedLine === 'number'
    ? `${selectedLine + 1}/${lyrics.length}`
    : hasLyrics ? `${lyrics.length} lines` : 'No lyrics';

  const { processLoadedLyrics } = useLyricsLoader({
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
    showToast,
  });

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
    showToast,
  });

  React.useEffect(() => {
    let cancelled = false;

    fetch('http://127.0.0.1:4000/api/app/capabilities', {
      cache: 'no-store',
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!cancelled) {
          setDesktopControlAvailable(Boolean(payload?.switchToDesktopMode && payload?.obsDockLocalAuth));
        }
      })
      .catch(() => {
        if (!cancelled) setDesktopControlAvailable(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const openDesktopApp = React.useCallback(async () => {
    try {
      const response = await fetch('http://127.0.0.1:4000/api/app/switch-to-desktop-mode', {
        method: 'POST',
        cache: 'no-store',
      });

      if (!response.ok) {
        if (response.status === 503) {
          setDesktopControlAvailable(false);
        }
        throw new Error(`HTTP ${response.status}`);
      }

      showToast({ title: 'Switching to Desktop Mode', message: 'LyricDisplay is restarting.' });
    } catch (error) {
      showToast({
        title: 'Could Not Switch Modes',
        message: 'Use the LyricDisplay tray menu to open or quit Dock Mode.',
        variant: 'warn'
      });
    }
  }, [showToast]);

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

    const fileType = Array.isArray(lyricsTimestamps) && lyricsTimestamps.length > 0
      ? 'lrc'
      : normalizeLyricFileType({ fileType: lyricsSource?.fileType, fileName: lyricsSource?.fileName, fallback: 'txt' });
    const extension = `.${getLyricImportFormatForType(fileType)?.extensions?.[0] || 'txt'}`;
    const emitted = emitSetlistAdd([{
      name: `${lyricsFileName}${extension}`,
      content: rawLyricsContent,
      fileType,
      lastModified: Date.now(),
      metadata: songMetadata || null,
    }]);

    if (!emitted) {
      showToast({ title: 'Setlist unavailable', message: 'Connection is not ready yet.', variant: 'warn' });
    }
  }, [emitSetlistAdd, hasLyrics, isSetlistFull, lyricsFileName, lyricsSource?.fileName, lyricsSource?.fileType, lyricsTimestamps, maxSetlistFiles, rawLyricsContent, showToast, songMetadata]);

  const openCreateEditor = React.useCallback(() => {
    setEditorState({ mode: 'create', title: '', content: '' });
  }, []);

  const openEditEditor = React.useCallback(() => {
    const fallbackContent = Array.isArray(lyrics) ? lyrics.map(lyricLineToText).filter(Boolean).join('\n') : '';
    setEditorState({
      mode: 'edit',
      title: lyricsFileName || songMetadata?.title || '',
      content: rawLyricsContent || lyricsSource?.content || fallbackContent,
    });
  }, [lyrics, lyricsFileName, lyricsSource?.content, rawLyricsContent, songMetadata?.title]);

  const handleEditorSaveAndLoad = React.useCallback(async ({ baseName, content, extension }) => (
    processLoadedLyrics(
      {
        content,
        fileName: baseName,
        fileType: extension,
      },
      {
        fallbackFileName: baseName,
        toastTitle: 'Lyrics loaded',
        toastMessage: `${baseName} loaded from dock editor.`,
        songMetadata: {
          title: baseName,
          artists: [],
          album: null,
          year: null,
          origin: 'LyricDisplay Dock',
          filePath: null,
        },
      }
    )
  ), [processLoadedLyrics]);

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
      <header className={`flex shrink-0 items-center justify-between gap-2 border-b px-2.5 py-2 ${toolbarClasses}`}>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[13px] font-bold">LyricDisplay Dock</span>
            <span className="shrink-0 rounded border border-blue-400/40 bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none text-blue-200">
              Beta
            </span>
          </div>
          <div className={`truncate text-[10px] ${canControl ? 'text-green-500' : darkMode ? 'text-yellow-300' : 'text-yellow-700'}`}>
            {canControl ? 'Connected' : `${connectionStatus} / ${authStatus}`} - {currentLineText}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setSetlistOpen(true)} className={`relative ${dockIconButtonClass}`} title="Open setlist">
            <ListMusic className="h-4.5 w-4.5" />
            {setlistFiles.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-blue-600 px-1 text-[10px] font-bold leading-4 text-white">
                {setlistFiles.length}
              </span>
            )}
          </button>
          <button type="button" onClick={forceReconnect} className={dockIconButtonClass} title="Reconnect">
            <RefreshCw className="h-4.5 w-4.5" />
          </button>
          {desktopControlAvailable && (
            <button type="button" onClick={openDesktopApp} className={dockIconButtonClass} title="Switch to Desktop Mode">
              <ExternalLink className="h-4.5 w-4.5" />
            </button>
          )}
          <button type="button" onClick={() => handleOpenSettings(activeOutput)} className={dockIconButtonClass} title="Output settings">
            <Menu className="h-4.5 w-4.5" />
          </button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className={`shrink-0 border-b px-2 py-1.5 ${toolbarClasses}`}>
          <div className="mb-1.5 flex items-center gap-1.5">
            <button type="button" onClick={() => fileInputRef.current?.click()} className={dockPrimaryButtonClass}>
              <FolderOpen className="h-4 w-4 shrink-0" />
              <span className="truncate">Load</span>
            </button>
            <button type="button" onClick={openCreateEditor} className={`${dockIconButtonClass} rounded-xl`} title="Create new song">
              <FilePlus2 className="h-4 w-4" />
            </button>
            <button type="button" onClick={handleAddCurrentToSetlist} disabled={!hasLyrics || !canControl} className={`${dockIconButtonClass} ${!hasLyrics || !canControl ? dockIconDisabledClass : ''}`} title="Add current song to setlist">
              <ListPlus className="h-4.5 w-4.5" />
            </button>
            <button type="button" onClick={handleToggleOutput} disabled={!canControl} className={`${isOutputOn && canControl ? 'inline-flex h-8 w-8 items-center justify-center rounded-lg bg-green-600 text-white transition-colors hover:bg-green-500' : dockIconButtonClass} ${!canControl ? dockIconDisabledClass : ''}`} title={isOutputOn ? 'Turn display output off' : 'Turn display output on'}>
              <Power className="h-4.5 w-4.5" />
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept={getLyricsAcceptAttribute()} className="hidden" onChange={handleMainFileInput} />
          <input ref={setlistInputRef} type="file" accept={getLyricsAcceptAttribute()} multiple className="hidden" onChange={handleSetlistFilesInput} />
          <div className={`truncate text-[11px] ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {lyricsFileName || 'No lyrics loaded'}
            {typeof selectedLine === 'number' && hasLyrics ? ` - Line ${selectedLine + 1}/${lyrics.length}` : ''}
          </div>
        </div>

        <div className={`shrink-0 border-b px-2 py-1.5 ${darkMode ? 'border-gray-800 bg-gray-950/90' : 'border-gray-200 bg-white/80'}`}>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
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
        </div>

        <section className={`flex min-h-0 flex-1 flex-col overflow-hidden ${darkMode ? 'bg-gray-950' : 'bg-gray-50'}`}>
          <div className={`shrink-0 border-b px-2 py-1.5 ${toolbarClasses}`}>
            <div className="flex items-center gap-1.5">
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
                  density="dock"
                />
              </div>
              {hasLyrics && (
                <Tooltip content="Edit lyrics" side="bottom">
                  <button
                    type="button"
                    onClick={openEditEditor}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${darkMode
                      ? 'text-gray-400 hover:bg-blue-500/10 hover:text-blue-300'
                      : 'text-gray-500 hover:bg-blue-50 hover:text-blue-600'
                      }`}
                    title="Edit lyrics"
                  >
                    <PencilLine className="h-4 w-4" />
                  </button>
                </Tooltip>
              )}
              {hasLyrics && (
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
                  presentation="sheet"
                />
              )}
            </div>
          </div>
          <div ref={lyricsContainerRef} className="dock-scrollbar min-h-0 flex-1 overflow-y-auto">
            {hasLyrics ? (
              <LyricsList
                searchQuery={searchQuery}
                highlightedLineIndex={highlightedLineIndex}
                onSelectLine={handleLineSelect}
                density="dock"
                maxLinesPerGroup={quickParserSettings.maxLinesPerGroup}
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
          <div className={`dock-scrollbar min-h-0 flex-1 overflow-y-auto p-3 ${darkMode ? 'bg-gray-950' : 'bg-gray-50'}`}>
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
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">{outputLabel(activeOutput)} Settings</div>
            </div>
            <button type="button" onClick={() => setSettingsOpen(false)} className={`rounded-md p-2 ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`} title="Close settings">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className={`dock-scrollbar min-h-0 flex-1 overflow-y-auto p-2 ${darkMode ? 'bg-gray-950' : 'bg-gray-50'}`}>
            <div className="mx-auto max-w-sm">
              <OutputSettingsPanel outputKey={activeOutput} compact />
            </div>
          </div>
        </div>
      )}

      {editorState && (
        <DockSongEditor
          darkMode={darkMode}
          initialContent={editorState.content}
          initialTitle={editorState.title}
          mode={editorState.mode}
          onClose={() => setEditorState(null)}
          onSaveAndLoad={handleEditorSaveAndLoad}
          showToast={showToast}
        />
      )}
    </div>
  );
}
