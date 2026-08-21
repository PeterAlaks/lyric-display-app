import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpDown,
  Check,
  ChevronRight,
  FileCode2,
  FileText,
  Folder,
  FolderPlus,
  History,
  Loader2,
  LocateFixed,
  Music2,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { useDarkModeState } from '../hooks/useStoreSelectors';
import useModal from '../hooks/useModal';
import useToast from '../hooks/useToast';
import { REQUEST_MODAL_CLOSE_EVENT } from '../constants/modalEvents';
import {
  getFolderSelectionNotice,
  mergeFileNavigatorStatus,
  OPEN_FILE_NAVIGATOR_EVENT,
} from '../utils/fileNavigatorEvents';
import { Input } from './ui/input';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Tooltip } from './ui/tooltip';
import { SlidingTabIndicator } from './ui/sliding-tab-indicator';
import { FILE_NAVIGATOR_LIMITS } from '../../shared/fileNavigatorLimits.js';

const MODAL_ANIMATION_DURATION = 220;

const FILTERS = [
  { id: 'all', label: 'All', types: [] },
  { id: 'txt', label: 'TXT', types: ['txt'] },
  { id: 'lrc', label: 'LRC', types: ['lrc'] },
  { id: 'documents', label: 'Documents', types: ['md', 'rtf', 'docx'] },
];

const SORT_OPTIONS = [
  { id: 'name-asc', label: 'Name (A to Z)' },
  { id: 'name-desc', label: 'Name (Z to A)' },
  { id: 'modified-desc', label: 'Date modified (newest)' },
  { id: 'modified-asc', label: 'Date modified (oldest)' },
  { id: 'size-desc', label: 'Size (largest)' },
  { id: 'size-asc', label: 'Size (smallest)' },
  { id: 'type-asc', label: 'File type' },
];
const DEFAULT_SORT_ID = 'name-asc';
const SORT_PREFERENCE_PATH = 'fileHandling.fileNavigatorSort';
const isValidSortId = (value) => SORT_OPTIONS.some((option) => option.id === value);

const fileNameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

const sortFolderEntries = (entries, sortId) => [...entries].sort((first, second) => {
  if (first.kind !== second.kind) return first.kind === 'folder' ? -1 : 1;

  let comparison = 0;
  if (sortId === 'name-desc') {
    comparison = fileNameCollator.compare(second.fileName || '', first.fileName || '');
  } else if (first.kind === 'file' && sortId === 'modified-desc') {
    comparison = (Number(second.modifiedMs) || 0) - (Number(first.modifiedMs) || 0);
  } else if (first.kind === 'file' && sortId === 'modified-asc') {
    comparison = (Number(first.modifiedMs) || 0) - (Number(second.modifiedMs) || 0);
  } else if (first.kind === 'file' && sortId === 'size-desc') {
    comparison = (Number(second.size) || 0) - (Number(first.size) || 0);
  } else if (first.kind === 'file' && sortId === 'size-asc') {
    comparison = (Number(first.size) || 0) - (Number(second.size) || 0);
  } else if (first.kind === 'file' && sortId === 'type-asc') {
    comparison = fileNameCollator.compare(first.fileType || '', second.fileType || '');
  }

  return comparison
    || fileNameCollator.compare(first.fileName || '', second.fileName || '')
    || fileNameCollator.compare(first.filePath || '', second.filePath || '');
});

const pathName = (value = '') => String(value || '').split(/[\\/]/).filter(Boolean).pop() || value;
const normalizePath = (value = '') => String(value || '').replace(/\\/g, '/').toLowerCase();

const formatBytes = (value) => {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatModified = (value) => {
  if (!Number(value)) return '';
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: new Date(value).getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
    }).format(new Date(value));
  } catch {
    return '';
  }
};

const FileTypeIcon = ({ entry, className = 'h-4 w-4' }) => {
  if (entry.kind === 'folder') return <Folder className={`${className} text-amber-500`} aria-hidden />;
  if (entry.fileType === 'lrc') return <Music2 className={`${className} text-violet-500`} aria-hidden />;
  if (entry.fileType === 'txt') return <FileText className={`${className} text-blue-500`} aria-hidden />;
  return <FileCode2 className={`${className} text-emerald-500`} aria-hidden />;
};

const ResultRow = React.memo(function ResultRow({
  active,
  darkMode,
  entry,
  index,
  multiSelect,
  onActivate,
  onOpen,
  selected,
}) {
  const locationText = entry.kind === 'folder'
    ? entry.relativePath || entry.filePath
    : entry.parentPath || entry.relativePath;

  return (
    <button
      id={`file-navigator-result-${index}`}
      data-file-navigator-index={index}
      type="button"
      role="option"
      aria-selected={active}
      disabled={entry.missing}
      onClick={() => onActivate(index)}
      onDoubleClick={() => onOpen(entry)}
      className={`group flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${active
        ? darkMode ? 'bg-blue-500/18 text-white ring-1 ring-blue-400/35' : 'bg-blue-50 text-gray-950 ring-1 ring-blue-200'
        : darkMode ? 'text-gray-200 hover:bg-white/5' : 'text-gray-800 hover:bg-gray-50'
        } ${entry.missing ? 'cursor-not-allowed opacity-45' : ''}`}
    >
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white shadow-sm ring-1 ring-gray-200/70'}`}>
        <FileTypeIcon entry={entry} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[13px] font-semibold">{entry.fileName}</span>
          {entry.matchedField === 'content' && (
            <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${darkMode ? 'bg-violet-500/20 text-violet-200' : 'bg-violet-50 text-violet-700'}`}>
              lyric match
            </span>
          )}
        </span>
        <span className={`mt-0.5 block truncate text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
          {entry.missing ? 'File moved or deleted' : locationText}
        </span>
        {entry.matchSnippet && (
          <span className={`mt-1 block line-clamp-2 whitespace-pre-line text-[11px] leading-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {entry.matchSnippet}
          </span>
        )}
      </span>
      {entry.kind !== 'folder' && (
        multiSelect ? (
          <span className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${selected
            ? 'border-blue-500 bg-blue-500 text-white'
            : darkMode ? 'border-gray-600' : 'border-gray-300'
            }`} aria-label={selected ? 'Selected' : 'Not selected'}>
            {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
          </span>
        ) : (
          <span className={`mt-0.5 shrink-0 text-[10px] font-semibold uppercase ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            {entry.fileType}
          </span>
        )
      )}
    </button>
  );
});

export default function FileNavigatorModal() {
  const location = useLocation();
  const navigate = useNavigate();
  const { darkMode } = useDarkModeState();
  const { showModal } = useModal();
  const { showToast } = useToast();
  const inputRef = useRef(null);
  const resultsRef = useRef(null);
  const requestSequenceRef = useRef(0);
  const stateRequestSequenceRef = useRef(0);
  const indexEventSequenceRef = useRef(0);
  const indexEventActiveRef = useRef(false);
  const hydrationSequenceRef = useRef(0);
  const currentDirectoryRef = useRef(null);
  const closeTimerRef = useRef(null);
  const enterFrameRef = useRef(null);
  const removalConfirmationTimerRef = useRef(null);
  const wasIndexingRef = useRef(false);
  const sortPreferenceSequenceRef = useRef(0);

  const [open, setOpen] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [query, setQuery] = useState('');
  const [filterId, setFilterId] = useState('all');
  const [sortId, setSortId] = useState(DEFAULT_SORT_ID);
  const [sortPopoverOpen, setSortPopoverOpen] = useState(false);
  const [destination, setDestination] = useState('control');
  const [navigatorState, setNavigatorState] = useState({ roots: [], recents: [], status: {}, limits: {} });
  const [entries, setEntries] = useState([]);
  const [currentDirectory, setCurrentDirectory] = useState(null);
  const [browseParent, setBrowseParent] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [stateHydrating, setStateHydrating] = useState(false);
  const [indexingPending, setIndexingPending] = useState(false);
  const [creatingLyricsFolder, setCreatingLyricsFolder] = useState(false);
  const [opening, setOpening] = useState(false);
  const [removalConfirmationOpen, setRemovalConfirmationOpen] = useState(false);
  const [maxSelections, setMaxSelections] = useState(100);
  const [selectedPaths, setSelectedPaths] = useState(() => new Set());
  const [error, setError] = useState('');
  const [preview, setPreview] = useState({ loading: false, content: '', available: false, reason: '' });

  currentDirectoryRef.current = currentDirectory;
  const displayedEntries = useMemo(() => (
    currentDirectory && !query.trim() ? sortFolderEntries(entries, sortId) : entries
  ), [currentDirectory, entries, query, sortId]);
  const selectedEntry = displayedEntries[selectedIndex] || null;
  const activeFilter = FILTERS.find((filter) => filter.id === filterId) || FILTERS[0];
  const activeSort = SORT_OPTIONS.find((option) => option.id === sortId) || SORT_OPTIONS[0];
  const setlistMode = destination === 'setlist';
  const videoMode = destination === 'video';
  const remoteIndexing = Boolean(navigatorState.status?.scanning);
  const indexing = indexingPending || creatingLyricsFolder || remoteIndexing || stateHydrating;
  const navigatorBlocked = indexing;

  const resetResultsToTop = useCallback(() => {
    setSelectedIndex(0);
    if (resultsRef.current) resultsRef.current.scrollTop = 0;
    window.requestAnimationFrame(() => {
      if (resultsRef.current) resultsRef.current.scrollTop = 0;
    });
  }, []);

  useEffect(() => {
    const api = window.electronAPI?.preferences;
    if (!api?.get) return undefined;

    let active = true;
    const sequence = ++sortPreferenceSequenceRef.current;
    void api.get(SORT_PREFERENCE_PATH).then((result) => {
      if (!active || sequence !== sortPreferenceSequenceRef.current) return;
      const storedSortId = result?.success ? result.value : null;
      if (!isValidSortId(storedSortId)) return;
      setSortId(storedSortId);
      resetResultsToTop();
    }).catch((error) => {
      console.warn('Failed to load the file navigator sort preference:', error);
    });

    return () => {
      active = false;
    };
  }, [resetResultsToTop]);

  const close = useCallback(() => {
    if (closeTimerRef.current !== null) return;
    if (enterFrameRef.current !== null) {
      window.cancelAnimationFrame(enterFrameRef.current);
      enterFrameRef.current = null;
    }
    setTransitioning(true);
    setOpening(false);
    setSortPopoverOpen(false);
    setError('');
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setOpen(false);
      setTransitioning(false);
    }, MODAL_ANIMATION_DURATION);
  }, []);

  useEffect(() => () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    if (enterFrameRef.current !== null) window.cancelAnimationFrame(enterFrameRef.current);
    if (removalConfirmationTimerRef.current !== null) window.clearTimeout(removalConfirmationTimerRef.current);
  }, []);

  const applyState = useCallback((result) => {
    if (!result?.success) return false;
    setNavigatorState((previous) => {
      const incomingScanId = Number(result.status?.scanId) || 0;
      const currentScanId = Number(previous.status?.scanId) || 0;
      if (incomingScanId < currentScanId) return previous;
      return {
        roots: result.roots || [],
        recents: result.recents || [],
        status: result.status || {},
        limits: result.limits || {},
      };
    });
    return true;
  }, []);

  const loadState = useCallback(async ({
    updateEntries = false,
    expectedIndexEventSequence = null,
  } = {}) => {
    const api = window.electronAPI?.fileNavigator;
    if (!api?.getState) return 'failed';
    const stateRequestSequence = ++stateRequestSequenceRef.current;
    try {
      const result = await api.getState();
      if (
        stateRequestSequence !== stateRequestSequenceRef.current
        || (
          expectedIndexEventSequence !== null
          && expectedIndexEventSequence !== indexEventSequenceRef.current
        )
      ) return 'stale';
      if (!applyState(result)) throw new Error(result?.error || 'Could not load file navigator');
      if (updateEntries && !currentDirectoryRef.current) {
        setEntries(result.recents || []);
        setSelectedIndex(0);
      }
      return 'loaded';
    } catch (nextError) {
      if (stateRequestSequence === stateRequestSequenceRef.current) {
        setError(nextError?.message || 'Could not load file navigator');
      }
      return 'failed';
    }
  }, [applyState]);

  useEffect(() => {
    const handleOpenRequest = (event) => {
      const requestedDestination = event?.detail?.destination;
      setDestination(['canvas', 'control', 'setlist', 'video'].includes(requestedDestination)
        ? requestedDestination
        : location.pathname === '/new-song' ? 'canvas' : 'control');
      setQuery('');
      setFilterId(requestedDestination === 'video' ? 'lrc' : 'all');
      setSortPopoverOpen(false);
      setMaxSelections(Math.max(1, Math.min(100, Number(event?.detail?.maxSelections) || 100)));
      setSelectedPaths(new Set());
      setCurrentDirectory(null);
      setBrowseParent(null);
      setEntries(navigatorState.recents || []);
      setSelectedIndex(0);
      setPreview({ loading: false, content: '', available: false, reason: '' });
      setError('');
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      if (enterFrameRef.current !== null) window.cancelAnimationFrame(enterFrameRef.current);
      setTransitioning(true);
      setOpen(true);
      const hydrationSequence = ++hydrationSequenceRef.current;
      setStateHydrating(true);
      void loadState({ updateEntries: true }).finally(() => {
        if (hydrationSequence === hydrationSequenceRef.current) setStateHydrating(false);
      });
    };
    window.addEventListener(OPEN_FILE_NAVIGATOR_EVENT, handleOpenRequest);
    return () => window.removeEventListener(OPEN_FILE_NAVIGATOR_EVENT, handleOpenRequest);
  }, [loadState, location.pathname, navigatorState.recents]);

  useEffect(() => {
    if (!open) return undefined;
    const focusFrame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(focusFrame);
  }, [open]);

  useEffect(() => {
    const indexingFinished = open && wasIndexingRef.current && !indexing;
    wasIndexingRef.current = indexing;
    if (!indexingFinished) return undefined;
    const focusFrame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(focusFrame);
  }, [indexing, open]);

  useEffect(() => {
    if (!open || !transitioning || closeTimerRef.current !== null) return undefined;
    enterFrameRef.current = window.requestAnimationFrame(() => {
      enterFrameRef.current = null;
      setTransitioning(false);
    });
    return () => {
      if (enterFrameRef.current !== null) {
        window.cancelAnimationFrame(enterFrameRef.current);
        enterFrameRef.current = null;
      }
    };
  }, [open, transitioning]);

  useEffect(() => {
    if (!open) return undefined;
    const handleCloseRequest = (event) => {
      if (!Array.isArray(event?.detail?.candidates)) return;
      event.detail.candidates.push({ close, priority: 250 });
    };
    window.addEventListener(REQUEST_MODAL_CLOSE_EVENT, handleCloseRequest);
    return () => window.removeEventListener(REQUEST_MODAL_CLOSE_EVENT, handleCloseRequest);
  }, [close, open]);

  useEffect(() => {
    const api = window.electronAPI?.fileNavigator;
    if (!api?.onChange) return undefined;
    const unsubscribe = api.onChange((nextStatus) => {
      if (nextStatus?.scanning === true) {
        if (!indexEventActiveRef.current) indexEventSequenceRef.current += 1;
        indexEventActiveRef.current = true;
        stateRequestSequenceRef.current += 1;
        requestSequenceRef.current += 1;
        setLoading(false);
      }
      if (nextStatus?.scanning === false) {
        indexEventActiveRef.current = false;
        const expectedIndexEventSequence = ++indexEventSequenceRef.current;
        if (!open) {
          setNavigatorState((previous) => ({
            ...previous,
            status: mergeFileNavigatorStatus(previous.status, nextStatus),
          }));
          return;
        }
        void loadState({
          updateEntries: !query.trim() && !currentDirectoryRef.current,
          expectedIndexEventSequence,
        }).then((outcome) => {
          if (outcome !== 'failed') return;
          if (expectedIndexEventSequence !== indexEventSequenceRef.current) return;
          setNavigatorState((previous) => ({
            ...previous,
            status: mergeFileNavigatorStatus(previous.status, nextStatus),
          }));
        });
        return;
      }
      setNavigatorState((previous) => {
        const status = mergeFileNavigatorStatus(previous.status, nextStatus);
        if (status === previous.status) return previous;
        return {
          ...previous,
          status,
        };
      });
    });
    const unsubscribeRecents = window.electronAPI?.recents?.onChange?.(() => {
      if (open) void loadState({ updateEntries: !query.trim() && !currentDirectoryRef.current });
    });
    return () => {
      unsubscribe?.();
      unsubscribeRecents?.();
    };
  }, [loadState, open, query]);

  const loadDirectory = useCallback(async (directoryPath) => {
    const api = window.electronAPI?.fileNavigator;
    if (!api?.browse || !directoryPath) return;
    const sequence = ++requestSequenceRef.current;
    setLoading(true);
    setError('');
    try {
      const result = await api.browse(directoryPath);
      if (sequence !== requestSequenceRef.current) return;
      if (!result?.success) throw new Error(result?.error || 'Could not browse this folder');
      setCurrentDirectory(result.directoryPath);
      setBrowseParent(result.parentPath || null);
      const allowedTypes = new Set(activeFilter.types);
      setEntries((result.items || []).filter((entry) => (
        entry.kind === 'folder' || allowedTypes.size === 0 || allowedTypes.has(entry.fileType)
      )));
      setSelectedIndex(0);
    } catch (nextError) {
      if (sequence === requestSequenceRef.current) setError(nextError?.message || 'Could not browse this folder');
    } finally {
      if (sequence === requestSequenceRef.current) setLoading(false);
    }
  }, [activeFilter.types]);

  useEffect(() => {
    if (!open || navigatorBlocked) return undefined;
    const trimmed = query.trim();
    if (!trimmed) {
      if (currentDirectory) {
        void loadDirectory(currentDirectory);
      } else {
        const allowedTypes = new Set(activeFilter.types);
        setEntries((navigatorState.recents || []).filter((entry) => (
          allowedTypes.size === 0 || allowedTypes.has(entry.fileType)
        )));
        setSelectedIndex(0);
      }
      return undefined;
    }

    const sequence = ++requestSequenceRef.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const result = await window.electronAPI?.fileNavigator?.search?.({
          query: trimmed,
          fileTypes: activeFilter.types,
          limit: 100,
        });
        if (sequence !== requestSequenceRef.current) return;
        if (!result?.success) throw new Error(result?.error || 'Search failed');
        setEntries(result.results || []);
        setSelectedIndex(0);
      } catch (nextError) {
        if (sequence === requestSequenceRef.current) {
          setEntries([]);
          setError(nextError?.message || 'Search failed');
        }
      } finally {
        if (sequence === requestSequenceRef.current) setLoading(false);
      }
    }, 55);
    return () => window.clearTimeout(timer);
  }, [activeFilter.types, currentDirectory, loadDirectory, navigatorBlocked, navigatorState.recents, open, query]);

  useEffect(() => {
    if (navigatorBlocked) return undefined;
    if (!selectedEntry || selectedEntry.kind !== 'file' || selectedEntry.missing) {
      setPreview({ loading: false, content: '', available: false, reason: '' });
      return undefined;
    }
    if (!selectedEntry.previewAvailable) {
      setPreview({ loading: false, content: '', available: false, reason: 'Full previews are available for TXT and LRC files.' });
      return undefined;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      setPreview((previous) => ({ ...previous, loading: true }));
      const result = await window.electronAPI?.fileNavigator?.preview?.(selectedEntry.filePath);
      if (!active) return;
      if (result?.success) {
        setPreview({
          loading: false,
          available: Boolean(result.available),
          content: result.content || '',
          reason: result.reason || '',
          truncated: Boolean(result.truncated),
        });
      } else {
        setPreview({ loading: false, content: '', available: false, reason: result?.error || 'Preview unavailable' });
      }
    }, 40);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [navigatorBlocked, selectedEntry]);

  useEffect(() => {
    const element = resultsRef.current?.querySelector?.(`[data-file-navigator-index="${selectedIndex}"]`);
    element?.scrollIntoView?.({ block: 'nearest' });
  }, [selectedIndex]);

  const toggleSetlistEntry = useCallback((entry) => {
    if (!entry || entry.kind !== 'file' || entry.missing) return;
    setSelectedPaths((previous) => {
      const next = new Set(previous);
      if (next.has(entry.filePath)) {
        next.delete(entry.filePath);
        return next;
      }
      if (next.size >= maxSelections) {
        showToast({
          title: 'Setlist limit reached',
          message: `You can select up to ${maxSelections} ${maxSelections === 1 ? 'song' : 'songs'} right now.`,
          variant: 'warning',
        });
        return previous;
      }
      next.add(entry.filePath);
      return next;
    });
  }, [maxSelections, showToast]);

  const loadLyricsIntoDestination = useCallback((result, requestedDestination) => {
    const payload = {
      content: result.content,
      fileName: result.fileName,
      filePath: result.filePath,
      fileType: result.fileType,
    };
    close();

    if (requestedDestination === 'video') {
      window.dispatchEvent(new CustomEvent('file-navigator:video-lrc-selection', { detail: payload }));
    } else if (requestedDestination === 'canvas') {
      if (location.pathname === '/new-song') {
        window.setTimeout(() => window.dispatchEvent(new CustomEvent('load-into-canvas', { detail: payload })), 0);
      } else {
        window.__pendingCanvasLyricsLoad = payload;
        navigate('/new-song?mode=new');
      }
    } else if (location.pathname === '/') {
      window.dispatchEvent(new CustomEvent('lyrics-opened', { detail: payload }));
      window.dispatchEvent(new CustomEvent('support-dev:track-action', { detail: { actionType: 'song_loaded' } }));
    } else {
      window.__pendingLyricsLoad = payload;
      navigate('/');
    }
  }, [close, location.pathname, navigate]);

  const openEntry = useCallback(async (entry, requestedDestination = destination) => {
    if (!entry || entry.missing || indexing || opening) return;
    if (entry.kind === 'folder') {
      setQuery('');
      await loadDirectory(entry.filePath);
      inputRef.current?.focus();
      return;
    }

    if (requestedDestination === 'setlist') {
      toggleSetlistEntry(entry);
      return;
    }

    setOpening(true);
    setError('');
    try {
      const result = await window.electronAPI?.fileNavigator?.open?.(entry.filePath);
      if (!result?.success || typeof result.content !== 'string') {
        throw new Error(result?.error || 'Could not load the selected lyrics file');
      }
      loadLyricsIntoDestination(result, requestedDestination);
    } catch (nextError) {
      setOpening(false);
      const message = nextError?.message || 'Could not load the selected lyrics file';
      setError(message);
      showToast({ title: 'Load failed', message, variant: 'error' });
    }
  }, [destination, indexing, loadDirectory, loadLyricsIntoDestination, opening, showToast, toggleSetlistEntry]);

  const handleOpenStandaloneFile = useCallback(async () => {
    if (opening) return;
    setOpening(true);
    setError('');
    try {
      const result = await window.electronAPI?.loadLyricsFile?.();
      if (result?.canceled) {
        setOpening(false);
        inputRef.current?.focus();
        return;
      }
      if (!result?.success || typeof result.content !== 'string') {
        throw new Error(result?.error || 'Could not load the selected lyrics file');
      }
      loadLyricsIntoDestination(result, destination);
    } catch (nextError) {
      setOpening(false);
      const message = nextError?.message || 'Could not load the selected lyrics file';
      setError(message);
      showToast({ title: 'Load failed', message, variant: 'error' });
    }
  }, [destination, loadLyricsIntoDestination, opening, showToast]);

  const completeSetlistSelection = useCallback(async () => {
    if (selectedPaths.size === 0 || indexing || opening) return;
    setOpening(true);
    setError('');
    try {
      const result = await window.electronAPI?.fileNavigator?.openMany?.([...selectedPaths]);
      if (!result?.success || !Array.isArray(result.files)) {
        throw new Error(result?.error || 'Could not load the selected lyric files');
      }
      close();
      window.dispatchEvent(new CustomEvent('file-navigator:setlist-selection', {
        detail: { files: result.files },
      }));
    } catch (nextError) {
      setOpening(false);
      const message = nextError?.message || 'Could not load the selected lyric files';
      setError(message);
      showToast({ title: 'Load failed', message, variant: 'error' });
    }
  }, [close, indexing, opening, selectedPaths, showToast]);

  const handleAddRoot = useCallback(async () => {
    if (indexing) return;
    setIndexingPending(true);
    requestSequenceRef.current += 1;
    setLoading(false);
    try {
      const result = await window.electronAPI?.fileNavigator?.addRoot?.();
      if (result?.canceled) return;
      if (!applyState(result)) {
        showToast({
          title: 'Folders not indexed',
          message: result?.error || 'Could not add the selected folders.',
          variant: 'error',
        });
        return;
      }
      const notice = getFolderSelectionNotice(result.selection);
      if (notice) showToast(notice);
      if (result.selection?.addedCount === 1) {
        const addedPath = result.selection.addedPaths?.[0];
        if (addedPath) {
          setQuery('');
          await loadDirectory(addedPath);
        }
      }
    } catch (nextError) {
      showToast({
        title: 'Folders not indexed',
        message: nextError?.message || 'Could not add the selected folders.',
        variant: 'error',
      });
    } finally {
      setIndexingPending(false);
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [applyState, indexing, loadDirectory, showToast]);

  const handleCreateLyricsFolder = useCallback(async () => {
    if (indexing) return;
    setCreatingLyricsFolder(true);
    requestSequenceRef.current += 1;
    setLoading(false);
    setError('');
    try {
      const result = await window.electronAPI?.fileNavigator?.createLyricsFolder?.();
      if (!applyState(result)) {
        throw new Error(result?.error || 'Could not create the Lyrics folder');
      }
      setQuery('');
      setCurrentDirectory(null);
      setBrowseParent(null);
      setEntries(result.recents || []);
      setSelectedIndex(0);
      showToast({
        title: result.folderCreated ? 'Lyrics folder created' : 'Lyrics folder ready',
        message: result.folderCreated
          ? 'Documents/LyricDisplay/Lyrics was created and indexed.'
          : 'The existing Documents/LyricDisplay/Lyrics folder is now indexed.',
        variant: 'success',
      });
    } catch (nextError) {
      const message = nextError?.message || 'Could not create the Lyrics folder.';
      setError(message);
      showToast({ title: 'Lyrics folder unavailable', message, variant: 'error' });
    } finally {
      setCreatingLyricsFolder(false);
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [applyState, indexing, showToast]);

  const handleRemoveRoot = useCallback(async (event, root) => {
    event.stopPropagation();
    if (!root?.path || indexing) return;

    if (removalConfirmationTimerRef.current !== null) {
      window.clearTimeout(removalConfirmationTimerRef.current);
      removalConfirmationTimerRef.current = null;
    }
    setRemovalConfirmationOpen(true);
    const confirmation = await showModal({
      title: `Remove ${root.name || 'this folder'}?`,
      description: 'LyricDisplay will stop indexing this folder. No files will be moved or deleted.',
      variant: 'warning',
      size: 'sm',
      actions: [
        { label: 'Cancel', value: 'cancel', variant: 'outline' },
        { label: 'Remove folder', value: 'remove', variant: 'destructive', autoFocus: true },
      ],
    });
    removalConfirmationTimerRef.current = window.setTimeout(() => {
      removalConfirmationTimerRef.current = null;
      setRemovalConfirmationOpen(false);
      inputRef.current?.focus();
    }, MODAL_ANIMATION_DURATION);
    if (confirmation !== 'remove') return;

    setIndexingPending(true);
    requestSequenceRef.current += 1;
    try {
      const result = await window.electronAPI?.fileNavigator?.removeRoot?.(root.path);
      if (!applyState(result)) {
        showToast({
          title: 'Folder not removed',
          message: result?.error || 'Could not remove that folder.',
          variant: 'error',
        });
        return;
      }
      if (currentDirectory && normalizePath(currentDirectory).startsWith(normalizePath(root.path))) {
        setCurrentDirectory(null);
        setBrowseParent(null);
        setQuery('');
        setEntries(result.recents || []);
      }
    } catch (nextError) {
      showToast({
        title: 'Folder not removed',
        message: nextError?.message || 'Could not remove that folder.',
        variant: 'error',
      });
    } finally {
      setIndexingPending(false);
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [applyState, currentDirectory, indexing, showModal, showToast]);

  const handleReindex = useCallback(async () => {
    if (indexing) return;
    setIndexingPending(true);
    requestSequenceRef.current += 1;
    try {
      const result = await window.electronAPI?.fileNavigator?.reindex?.();
      if (!applyState(result)) {
        showToast({
          title: 'Index not refreshed',
          message: result?.error || 'Could not refresh the file index.',
          variant: 'error',
        });
      }
    } catch (nextError) {
      showToast({
        title: 'Index not refreshed',
        message: nextError?.message || 'Could not refresh the file index.',
        variant: 'error',
      });
    } finally {
      setIndexingPending(false);
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [applyState, indexing, showToast]);

  const handleSortChange = useCallback((nextSortId) => {
    if (!isValidSortId(nextSortId)) return;
    sortPreferenceSequenceRef.current += 1;
    setSortId(nextSortId);
    setSortPopoverOpen(false);
    resetResultsToTop();
    window.requestAnimationFrame(() => inputRef.current?.focus());

    const persistSort = window.electronAPI?.preferences?.set;
    if (!persistSort) return;
    void persistSort(SORT_PREFERENCE_PATH, nextSortId).then((result) => {
      if (result?.success !== false) return;
      showToast({
        title: 'Sort preference not saved',
        message: result?.error || 'The folder was sorted, but the choice could not be saved.',
        variant: 'warning',
        dedupeKey: 'file-navigator-sort-preference-failed',
      });
    }).catch((error) => {
      showToast({
        title: 'Sort preference not saved',
        message: error?.message || 'The folder was sorted, but the choice could not be saved.',
        variant: 'warning',
        dedupeKey: 'file-navigator-sort-preference-failed',
      });
    });
  }, [resetResultsToTop, showToast]);

  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (sortPopoverOpen) {
        setSortPopoverOpen(false);
        inputRef.current?.focus();
        return;
      }
      close();
      return;
    }
    const commandKey = event.ctrlKey || event.metaKey;
    const shortcutKey = String(event.key || '').toLowerCase();
    if (commandKey && shortcutKey === 'f') {
      event.preventDefault();
      event.stopPropagation();
      if (!indexing) {
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      return;
    }
    if (commandKey && ['h', 'i', 'l', 'n', 'o', 's'].includes(shortcutKey)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      if (indexing) return;
      setSelectedIndex((previous) => {
        if (displayedEntries.length === 0) return 0;
        return event.key === 'ArrowDown'
          ? (previous + 1) % displayedEntries.length
          : (previous - 1 + displayedEntries.length) % displayedEntries.length;
      });
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
      if (event.target instanceof HTMLElement && event.target.closest('button')) return;
      event.preventDefault();
      event.stopPropagation();
      if (indexing) return;
      void openEntry(displayedEntries[selectedIndex]);
      return;
    }
    if (
      event.key === 'Backspace'
      && event.target === inputRef.current
      && !indexing
      && !query
      && currentDirectory
      && browseParent
    ) {
      event.preventDefault();
      void loadDirectory(browseParent);
    }
  }, [browseParent, close, currentDirectory, displayedEntries, indexing, loadDirectory, openEntry, query, selectedIndex, sortPopoverOpen]);

  const title = query.trim()
    ? `${entries.length} search ${entries.length === 1 ? 'result' : 'results'}`
    : currentDirectory ? pathName(currentDirectory) : 'Recently opened';
  const hasRoots = navigatorState.roots.length > 0;
  const maxRoots = FILE_NAVIGATOR_LIMITS.maxRoots;
  const rootLimitReached = navigatorState.roots.length >= maxRoots;
  const canSortFolder = Boolean(currentDirectory && !query.trim());
  const searchInputClass = darkMode
    ? 'h-10 rounded-full border-gray-700/70 bg-gray-800/90 pl-10 pr-10 text-[13px] text-white shadow-none placeholder:text-gray-500 focus-visible:border-blue-500/50 focus-visible:ring-blue-500/20'
    : 'h-10 rounded-full border-gray-200 bg-white pl-10 pr-10 text-[13px] text-gray-900 shadow-none placeholder:text-gray-400 focus-visible:border-blue-500/40 focus-visible:ring-blue-500/15';

  const content = open ? (
    <div
      className={`fixed inset-x-0 bottom-0 top-9 ${removalConfirmationOpen ? 'z-[1200]' : 'z-[1800]'}`}
      role="dialog"
      aria-modal={removalConfirmationOpen ? undefined : 'true'}
      aria-hidden={removalConfirmationOpen ? 'true' : undefined}
      aria-labelledby="file-navigator-title"
      onKeyDownCapture={handleKeyDown}
    >
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${transitioning ? 'opacity-0' : 'opacity-100'}`}
        onClick={close}
        aria-hidden="true"
      />
      <div className="pointer-events-none relative flex h-full items-center justify-center p-3 sm:p-4">
        <div
          data-modal-root="true"
          className={`pointer-events-auto flex h-[min(680px,calc(100vh-72px))] w-[min(1040px,calc(100vw-32px))] min-h-[460px] flex-col overflow-hidden rounded-2xl border shadow-2xl ring-1 transition-all duration-200 ${transitioning
            ? 'translate-y-8 scale-95 opacity-0'
            : 'opacity-100'
            } ${darkMode
              ? 'border-slate-700/80 bg-slate-950 text-gray-100 ring-white/5'
              : 'border-slate-200 bg-white text-gray-900 ring-black/5'
            }`}
        >
        <div className={`shrink-0 border-b px-4 py-3 ${darkMode ? 'border-white/7 bg-slate-900/80' : 'border-gray-200 bg-gray-50/90'}`}>
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} aria-hidden />
              <Input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                disabled={indexing}
                placeholder="Search titles, folders, or lyrics..."
                aria-label="Search indexed lyrics files"
                aria-controls={indexing ? undefined : 'file-navigator-results'}
                aria-activedescendant={!indexing && selectedEntry ? `file-navigator-result-${selectedIndex}` : undefined}
                aria-busy={indexing ? 'true' : undefined}
                className={searchInputClass}
              />
              {!indexing && loading ? (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-blue-500" aria-label="Searching" />
              ) : !indexing && query ? (
                <button
                  type="button"
                  onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                  className={`absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full transition-all ${darkMode ? 'text-gray-400 hover:bg-blue-500/10 hover:text-blue-300' : 'text-gray-500 hover:bg-blue-50 hover:text-blue-600'}`}
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={close}
              className={`rounded-full p-2 transition-colors ${darkMode ? 'text-gray-500 hover:bg-white/10 hover:text-gray-300' : 'text-gray-400 hover:bg-black/5 hover:text-gray-600'}`}
              aria-label="Close file navigator"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              {FILTERS.filter((filter) => !videoMode || filter.id === 'lrc').map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => { setFilterId(filter.id); inputRef.current?.focus(); }}
                  disabled={indexing}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${filterId === filter.id
                    ? darkMode ? 'bg-blue-500 text-white' : 'bg-gray-900 text-white'
                    : darkMode ? 'text-gray-400 hover:bg-white/7 hover:text-gray-200' : 'text-gray-500 hover:bg-gray-200/70 hover:text-gray-800'
                    } disabled:cursor-wait disabled:opacity-45`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <p className={`truncate text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
              Try <span className="font-mono">ext:lrc</span> or quote an exact phrase
            </p>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[188px_minmax(280px,1.35fr)_minmax(240px,0.8fr)]">
          <aside className={`flex min-h-0 flex-col overflow-hidden border-r ${darkMode ? 'border-white/7' : 'border-gray-200'}`}>
            <div className={`shrink-0 pt-3 ${darkMode ? 'bg-slate-900/45' : 'bg-gray-50/65'}`}>
              <div className="px-3">
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setCurrentDirectory(null);
                    setBrowseParent(null);
                    setEntries(navigatorState.recents || []);
                    setSelectedIndex(0);
                    inputRef.current?.focus();
                  }}
                  disabled={indexing}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold ${!currentDirectory && !query
                    ? darkMode ? 'bg-white/8 text-white' : 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
                    : darkMode ? 'text-gray-400 hover:bg-white/5' : 'text-gray-600 hover:bg-white'
                    } disabled:cursor-wait disabled:opacity-50`}
                >
                  <History className="h-4 w-4" />
                  Recent
                </button>
              </div>

              <div className="mb-1 mt-5 flex w-full items-center justify-between pl-5 pr-3">
                <span className={`text-[10px] font-bold uppercase tracking-[0.13em] ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                  Sources {navigatorState.roots.length}/{maxRoots}
                </span>
                <button
                  type="button"
                  onClick={handleAddRoot}
                  disabled={indexing || rootLimitReached}
                  className={`rounded-md disabled:cursor-not-allowed disabled:opacity-40 ${darkMode ? 'text-gray-500 hover:text-blue-300' : 'text-gray-400 hover:text-blue-600'}`}
                  aria-label="Add lyrics folders"
                  title={indexing ? 'Wait for indexing to finish' : rootLimitReached ? 'Indexed folder limit reached' : 'Add lyrics folders'}
                >
                  <FolderPlus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 [scrollbar-gutter:stable] ${darkMode ? 'bg-slate-900/45' : 'bg-gray-50/65'}`}>
              <div className="space-y-1">
                {navigatorState.roots.map((root) => {
                  const active = currentDirectory && normalizePath(currentDirectory).startsWith(normalizePath(root.path));
                  return (
                    <div
                      key={root.path}
                      className={`group flex w-full items-center rounded-lg text-xs ${active
                        ? darkMode ? 'bg-blue-500/15 text-blue-200' : 'bg-blue-50 text-blue-800'
                        : darkMode ? 'text-gray-400 hover:bg-white/5' : 'text-gray-600 hover:bg-white'
                        } ${!root.available ? 'opacity-50' : ''}`}
                    >
                      <button
                        type="button"
                        onClick={() => { setQuery(''); void loadDirectory(root.path); inputRef.current?.focus(); }}
                        disabled={indexing}
                        className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left disabled:cursor-wait"
                        title={root.issue || root.path}
                      >
                        <Folder className="h-4 w-4 shrink-0 text-amber-500" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{root.name}</span>
                          {root.issue && <span className="block truncate text-[9px] text-amber-500">Index limit exceeded</span>}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={(event) => void handleRemoveRoot(event, root)}
                        disabled={indexing}
                        className={`mr-1.5 rounded p-1 opacity-0 transition group-hover:opacity-100 focus:opacity-100 ${darkMode ? 'hover:bg-white/10 hover:text-red-300' : 'hover:bg-gray-100 hover:text-red-600'}`}
                        aria-label={`Remove ${root.name} from indexed folders`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
              {!hasRoots && (
                <div className={`mx-1 mt-3 rounded-xl border border-dashed p-3 text-[11px] leading-4 ${darkMode ? 'border-gray-700 text-gray-500' : 'border-gray-300 text-gray-500'}`}>
                  Add the folder where your lyric files live.
                </div>
              )}
            </div>

            <div className={`shrink-0 px-3 pb-3 ${darkMode ? 'bg-slate-900/45' : 'bg-gray-50/65'}`}>
              <Tooltip
                content={indexing ? 'Wait for indexing to finish' : rootLimitReached ? 'Indexed folder limit reached' : 'Add lyrics folders for indexed search'}
                side="top"
              >
                <button
                  type="button"
                  onClick={handleAddRoot}
                  disabled={indexing || rootLimitReached}
                  className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-2 py-2 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${darkMode ? 'border-gray-700 text-gray-400 hover:border-blue-500/60 hover:text-blue-300' : 'border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-700'}`}
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  {rootLimitReached ? 'Folder limit reached' : 'Add folders'}
                </button>
              </Tooltip>
            </div>
          </aside>

          {indexing ? (
            <section
              className={`col-span-2 flex min-h-0 items-center justify-center ${darkMode ? 'bg-slate-950 text-gray-500' : 'bg-white text-gray-500'}`}
              aria-live="polite"
              aria-busy="true"
              role="status"
            >
              <div className="flex items-center gap-2 text-xs font-medium">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" aria-hidden />
                <h2 id="file-navigator-title">
                  {creatingLyricsFolder
                    ? 'Creating lyrics folder…'
                    : stateHydrating && !indexingPending && !remoteIndexing
                    ? 'Preparing file navigator…'
                    : 'Indexing lyric folders…'}
                </h2>
              </div>
            </section>
          ) : (
            <>
          <section className={`flex min-h-0 flex-col border-r ${darkMode ? 'border-white/7' : 'border-gray-200'}`}>
            <div className={`flex h-11 shrink-0 items-center justify-between border-b px-4 ${darkMode ? 'border-white/7' : 'border-gray-100'}`}>
              <div className="flex min-w-0 items-center gap-2">
                {currentDirectory && !query && browseParent && (
                  <button
                    type="button"
                    onClick={() => void loadDirectory(browseParent)}
                    className={`rounded-md p-1 ${darkMode ? 'text-gray-400 hover:bg-white/8 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
                    aria-label="Open parent folder"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                <h2 id="file-navigator-title" className="truncate text-[12px] font-semibold">{title}</h2>
              </div>
              <div className="flex items-center gap-2">
                <Popover open={sortPopoverOpen} onOpenChange={setSortPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      disabled={!canSortFolder}
                      className={`rounded-md p-1.5 ${darkMode ? 'text-gray-500 hover:bg-white/8 hover:text-gray-200' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'} disabled:cursor-not-allowed disabled:opacity-40`}
                      aria-label={`Sort folder by ${activeSort.label}`}
                      aria-haspopup="menu"
                      aria-expanded={sortPopoverOpen}
                      title={canSortFolder ? `Sort: ${activeSort.label}` : 'Open a folder to sort its files'}
                    >
                      <ArrowUpDown className="h-3.5 w-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    sideOffset={6}
                    role="menu"
                    aria-label="Sort folder files"
                    className={`z-[1900] w-56 rounded-xl p-1.5 shadow-xl ${darkMode
                      ? 'border-gray-700 bg-gray-800 text-gray-100'
                      : 'border-gray-200 bg-white text-gray-800'
                      }`}
                  >
                    <p className={`px-2.5 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.13em] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      Sort by
                    </p>
                    {SORT_OPTIONS.map((option) => {
                      const selected = option.id === sortId;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          role="menuitemradio"
                          aria-checked={selected}
                          onClick={() => handleSortChange(option.id)}
                          className={`flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${selected
                            ? darkMode ? 'bg-blue-500/15 text-blue-200' : 'bg-blue-50 text-blue-700'
                            : darkMode ? 'hover:bg-white/7' : 'hover:bg-gray-100'
                            }`}
                        >
                          <span>{option.label}</span>
                          {selected && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                        </button>
                      );
                    })}
                  </PopoverContent>
                </Popover>
                <button
                  type="button"
                  onClick={handleReindex}
                  disabled={navigatorState.status?.scanning}
                  className={`rounded-md p-1.5 ${darkMode ? 'text-gray-500 hover:bg-white/8 hover:text-gray-200' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'} disabled:opacity-40`}
                  aria-label="Refresh file index"
                  title="Refresh file index"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div
              ref={resultsRef}
              id="file-navigator-results"
              role="listbox"
              className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2"
            >
              {error && (
                <div className={`m-2 rounded-xl border px-3 py-2 text-xs ${darkMode ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-red-200 bg-red-50 text-red-700'}`}>
                  {error}
                </div>
              )}
              {!loading && entries.length === 0 && !error && (
                <div className="flex h-full min-h-56 flex-col items-center justify-center px-6 text-center">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${darkMode ? 'bg-white/5 text-gray-600' : 'bg-gray-100 text-gray-400'}`}>
                    {query ? <Search className="h-5 w-5" /> : <History className="h-5 w-5" />}
                  </div>
                  <p className={`mt-3 text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {query ? 'No matching lyric files' : currentDirectory ? 'No lyric files in this folder' : 'No recent lyric files yet'}
                  </p>
                  <p className={`mt-1 max-w-xs text-[11px] leading-4 ${darkMode ? 'text-gray-600' : 'text-gray-500'}`}>
                    {query ? 'Try fewer words, a filename fragment, or another file type.' : hasRoots ? 'Start typing to search all indexed folders.' : 'Add or create lyrics folder to begin.'}
                  </p>
                  {!query && !currentDirectory && !hasRoots && (
                    <button
                      type="button"
                      onClick={() => void handleCreateLyricsFolder()}
                      disabled={creatingLyricsFolder}
                      className="mt-4 flex h-8 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-[11px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
                    >
                      {creatingLyricsFolder
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        : <FolderPlus className="h-3.5 w-3.5" aria-hidden />}
                      {creatingLyricsFolder ? 'Creating folder…' : 'Create lyrics folder'}
                    </button>
                  )}
                </div>
              )}
              {displayedEntries.map((entry, index) => (
                <ResultRow
                  key={`${entry.kind}:${entry.filePath}`}
                  active={index === selectedIndex}
                  darkMode={darkMode}
                  entry={entry}
                  index={index}
                  multiSelect={setlistMode}
                  onActivate={setSelectedIndex}
                  onOpen={openEntry}
                  selected={selectedPaths.has(entry.filePath)}
                />
              ))}
            </div>
          </section>

          <aside className={`flex min-h-0 flex-col ${darkMode ? 'bg-slate-900/35' : 'bg-gray-50/55'}`}>
            {selectedEntry ? (
              <>
                <div className={`shrink-0 border-b p-4 ${darkMode ? 'border-white/7' : 'border-gray-200'}`}>
                  <div className="flex items-start gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-white shadow-sm ring-1 ring-gray-200'}`}>
                      <FileTypeIcon entry={selectedEntry} className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="break-words text-[13px] font-semibold leading-5">{selectedEntry.fileName}</h3>
                      <p className={`mt-0.5 break-all text-[10px] leading-4 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{selectedEntry.parentPath || selectedEntry.filePath}</p>
                    </div>
                  </div>
                  {selectedEntry.kind === 'file' && (
                    <div className={`mt-3 flex items-center gap-2 text-[10px] font-medium ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                      <span className="uppercase">{selectedEntry.fileType}</span>
                      <span aria-hidden>·</span>
                      <span>{formatBytes(selectedEntry.size)}</span>
                      {formatModified(selectedEntry.modifiedMs) && <span aria-hidden>·</span>}
                      <span>{formatModified(selectedEntry.modifiedMs)}</span>
                    </div>
                  )}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  {selectedEntry.kind === 'folder' ? (
                    <button
                      type="button"
                      onClick={() => void openEntry(selectedEntry)}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-xs font-semibold ${darkMode ? 'border-gray-700 bg-gray-800/60 hover:bg-gray-800' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                    >
                      Browse folder
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  ) : preview.loading ? (
                    <div className={`flex h-40 items-center justify-center gap-2 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading preview
                    </div>
                  ) : preview.available && preview.content ? (
                    <>
                      <p className={`mb-2 text-[10px] font-bold uppercase tracking-[0.13em] ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>Preview</p>
                      <pre className={`select-text whitespace-pre-wrap break-words font-sans text-[11px] leading-[1.55] ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{preview.content}</pre>
                      {preview.truncated && <p className={`mt-3 text-[10px] ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>Preview truncated</p>}
                    </>
                  ) : (
                    <div className={`flex h-40 flex-col items-center justify-center text-center text-[11px] leading-4 ${darkMode ? 'text-gray-600' : 'text-gray-500'}`}>
                      <FileText className="mb-2 h-5 w-5" />
                      {preview.reason || 'Preview unavailable'}
                    </div>
                  )}
                </div>
                {selectedEntry.kind === 'file' && !selectedEntry.missing && (
                  <div className={`shrink-0 space-y-2 border-t p-3 ${darkMode ? 'border-white/7' : 'border-gray-200'}`}>
                    <button
                      type="button"
                      onClick={() => void openEntry(selectedEntry)}
                      disabled={opening}
                      className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-blue-500 to-violet-600 text-xs font-semibold text-white shadow-sm transition hover:from-blue-600 hover:to-violet-700 disabled:opacity-60"
                    >
                      {opening && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {setlistMode
                        ? selectedPaths.has(selectedEntry.filePath) ? 'Remove selection' : 'Select for setlist'
                        : videoMode ? 'Import into Studio'
                          : destination === 'canvas' ? 'Open in Canvas' : 'Load in Control Panel'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void window.electronAPI?.fileNavigator?.reveal?.(selectedEntry.filePath)}
                      className={`flex h-8 w-full items-center justify-center gap-2 rounded-lg text-[11px] font-semibold ${darkMode ? 'text-gray-500 hover:bg-white/5 hover:text-gray-300' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'}`}
                    >
                      <LocateFixed className="h-3.5 w-3.5" /> Reveal in folder
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className={`flex h-full flex-col items-center justify-center px-8 text-center text-xs ${darkMode ? 'text-gray-600' : 'text-gray-500'}`}>
                <FileText className="mb-3 h-7 w-7" />
                Select a file to preview it.
              </div>
            )}
          </aside>
            </>
          )}
        </div>

        <footer className={`flex h-14 shrink-0 items-center justify-between border-t px-4 ${darkMode ? 'border-white/7 bg-slate-900/75' : 'border-gray-200 bg-gray-50'}`}>
          <div className={`flex items-center gap-4 text-[10px] ${darkMode ? 'text-gray-600' : 'text-gray-500'}`}>
            {!indexing && (
              <>
                <span><kbd className="font-sans font-semibold">↑↓</kbd> Navigate</span>
                <span><kbd className="font-sans font-semibold">Enter</kbd> {setlistMode ? 'Select' : 'Open'}</span>
              </>
            )}
            <span><kbd className="font-sans font-semibold">Esc</kbd> Close</span>
            {!indexing && currentDirectory && !query && browseParent && <span><kbd className="font-sans font-semibold">Backspace</kbd> Up</span>}
          </div>
          {setlistMode ? (
            <button
              type="button"
              onClick={() => void completeSetlistSelection()}
              disabled={indexing || selectedPaths.size === 0 || opening}
              className="flex h-8 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:opacity-45"
            >
              {opening && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Add {selectedPaths.size || ''} {selectedPaths.size === 1 ? 'song' : 'songs'}
            </button>
          ) : videoMode ? (
            <span className={`text-[10px] font-semibold ${darkMode ? 'text-violet-300' : 'text-violet-700'}`}>LRC files only</span>
          ) : (
            <div className="flex items-center gap-2">
              <Tooltip content="Open a single file without indexing its folder" side="top">
                <button
                  type="button"
                  onClick={() => void handleOpenStandaloneFile()}
                  disabled={opening}
                  className={`flex h-8 items-center justify-center gap-2 rounded-lg px-3 text-[11px] font-semibold transition-colors disabled:opacity-45 ${darkMode
                    ? 'text-gray-300 hover:bg-white/7'
                    : 'text-gray-600 hover:bg-white'
                    }`}
                >
                  {opening ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                  Open File&hellip;
                </button>
              </Tooltip>
              <div
                className="tab-switcher-squircle relative isolate flex items-center gap-1 rounded-2xl p-1 ring-1 ring-inset ring-gray-300/40"
                role="tablist"
                aria-label="Open files in"
              >
                <SlidingTabIndicator className={darkMode ? 'bg-gray-700' : 'bg-white shadow-sm'} />
                <button
                  type="button"
                  role="tab"
                  aria-selected={destination === 'control'}
                  onClick={() => { setDestination('control'); inputRef.current?.focus(); }}
                  className={`tab-switcher-item-squircle relative z-10 rounded-xl px-3 py-1.5 text-[11px] font-semibold transition-colors ${destination === 'control'
                    ? darkMode ? 'text-white' : 'text-gray-900'
                    : darkMode ? 'text-gray-500' : 'text-gray-500'
                    }`}
                >
                  Control Panel
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={destination === 'canvas'}
                  onClick={() => { setDestination('canvas'); inputRef.current?.focus(); }}
                  className={`tab-switcher-item-squircle relative z-10 rounded-xl px-3 py-1.5 text-[11px] font-semibold transition-colors ${destination === 'canvas'
                    ? darkMode ? 'text-white' : 'text-gray-900'
                    : darkMode ? 'text-gray-500' : 'text-gray-500'
                    }`}
                >
                  Canvas
                </button>
              </div>
            </div>
          )}
        </footer>
        </div>
      </div>
    </div>
  ) : null;

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
