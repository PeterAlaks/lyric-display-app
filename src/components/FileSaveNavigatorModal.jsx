import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  Folder,
  FolderOpen,
  FolderPlus,
  Loader2,
  Save,
  X,
} from 'lucide-react';
import { REQUEST_MODAL_CLOSE_EVENT } from '../constants/modalEvents';
import { useDarkModeState } from '../hooks/useStoreSelectors';
import {
  createPortableNavigatorSaveName,
  normalizeNavigatorSaveExtension,
} from '../../shared/fileNavigatorSave.js';
import { OPEN_FILE_SAVE_NAVIGATOR_EVENT } from '../utils/fileNavigatorEvents';
import { Input } from './ui/input';

const MODAL_ANIMATION_DURATION = 220;

export default function FileSaveNavigatorModal() {
  const { darkMode } = useDarkModeState();
  const nameInputRef = useRef(null);
  const completionRef = useRef(null);
  const closeTimerRef = useRef(null);
  const enterFrameRef = useRef(null);
  const requestSequenceRef = useRef(0);
  const contentByExtensionRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [destinations, setDestinations] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [fileName, setFileName] = useState('lyrics');
  const [extension, setExtension] = useState('txt');
  const [availableExtensions, setAvailableExtensions] = useState(['txt']);
  const [initialDirectory, setInitialDirectory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [creatingLyricsFolder, setCreatingLyricsFolder] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [overwriteCandidate, setOverwriteCandidate] = useState(null);
  const [error, setError] = useState('');

  const selectedDestination = destinations[selectedIndex] || null;

  const beginClose = useCallback(() => {
    if (closeTimerRef.current !== null) return;
    if (enterFrameRef.current !== null) {
      window.cancelAnimationFrame(enterFrameRef.current);
      enterFrameRef.current = null;
    }
    setTransitioning(true);
    setPreparing(false);
    setCreatingLyricsFolder(false);
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setOpen(false);
      setTransitioning(false);
    }, MODAL_ANIMATION_DURATION);
  }, []);

  const finish = useCallback((result) => {
    const complete = completionRef.current;
    completionRef.current = null;
    contentByExtensionRef.current = null;
    complete?.(result);
    beginClose();
  }, [beginClose]);

  const close = useCallback(() => finish({ canceled: true }), [finish]);

  useEffect(() => () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    if (enterFrameRef.current !== null) window.cancelAnimationFrame(enterFrameRef.current);
    completionRef.current?.({ canceled: true });
    completionRef.current = null;
    contentByExtensionRef.current = null;
  }, []);

  useEffect(() => {
    const handleOpenRequest = (event) => {
      const detail = event?.detail || {};
      const nextExtension = normalizeNavigatorSaveExtension(detail.extension) || 'txt';
      const nextAvailableExtensions = [...new Set((Array.isArray(detail.availableExtensions)
        ? detail.availableExtensions
        : [nextExtension])
        .map(normalizeNavigatorSaveExtension)
        .filter(Boolean))];
      if (!nextAvailableExtensions.includes(nextExtension)) nextAvailableExtensions.unshift(nextExtension);
      const sequence = ++requestSequenceRef.current;

      completionRef.current?.({ canceled: true });
      completionRef.current = typeof detail.onComplete === 'function' ? detail.onComplete : null;
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      if (enterFrameRef.current !== null) window.cancelAnimationFrame(enterFrameRef.current);

      setFileName(createPortableNavigatorSaveName(detail.suggestedName));
      setExtension(nextExtension);
      setAvailableExtensions(nextAvailableExtensions);
      setInitialDirectory(detail.initialDirectory || null);
      contentByExtensionRef.current = detail.contentByExtension && typeof detail.contentByExtension === 'object'
        ? detail.contentByExtension
        : null;
      setDestinations([]);
      setSelectedIndex(0);
      setOverwriteCandidate(null);
      setError('');
      setPreparing(false);
      setCreatingLyricsFolder(false);
      setLoading(true);
      setTransitioning(true);
      setOpen(true);

      void window.electronAPI?.fileNavigator?.getSaveDestinations?.(detail.initialDirectory || null)
        .then((result) => {
          if (sequence !== requestSequenceRef.current) return;
          if (!result?.success) throw new Error(result?.error || 'Could not load indexed folders');
          const nextDestinations = result.destinations || [];
          setDestinations(nextDestinations);
          const firstAvailableIndex = nextDestinations.findIndex((destination) => destination.available);
          setSelectedIndex(firstAvailableIndex >= 0 ? firstAvailableIndex : 0);
        })
        .catch((nextError) => {
          if (sequence === requestSequenceRef.current) {
            setError(nextError?.message || 'Could not load indexed folders');
          }
        })
        .finally(() => {
          if (sequence === requestSequenceRef.current) setLoading(false);
        });
    };

    window.addEventListener(OPEN_FILE_SAVE_NAVIGATOR_EVENT, handleOpenRequest);
    return () => window.removeEventListener(OPEN_FILE_SAVE_NAVIGATOR_EVENT, handleOpenRequest);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const focusFrame = window.requestAnimationFrame(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(focusFrame);
  }, [open]);

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
      event.detail.candidates.push({ close, priority: 260 });
    };
    window.addEventListener(REQUEST_MODAL_CLOSE_EVENT, handleCloseRequest);
    return () => window.removeEventListener(REQUEST_MODAL_CLOSE_EVENT, handleCloseRequest);
  }, [close, open]);

  useEffect(() => {
    setOverwriteCandidate(null);
  }, [extension, fileName, selectedIndex]);

  const submit = useCallback(async ({ overwrite = false, destination = null } = {}) => {
    const targetDestination = destination || selectedDestination;
    if (preparing || !targetDestination?.available) return;
    setPreparing(true);
    setError('');
    try {
      const result = await window.electronAPI?.fileNavigator?.prepareSave?.({
        directoryPath: targetDestination.path,
        fileName,
        extension,
        overwrite,
      });
      if (!result?.success) throw new Error(result?.error || 'Could not use this save destination');
      if (result.exists && !result.writeGranted) {
        setOverwriteCandidate(result);
        return;
      }
      const saveContent = contentByExtensionRef.current?.[result.extension];
      let writeResult = null;
      if (typeof saveContent === 'string') {
        writeResult = await window.electronAPI?.writeFile?.(result.filePath, saveContent, {
          preserveGrouping: result.extension === 'txt',
          collisionPolicy: overwrite ? 'replace' : 'create',
        });
        if (!writeResult?.success) {
          if (writeResult?.code === 'FILE_EXISTS' && !overwrite) {
            setOverwriteCandidate({
              ...result,
              exists: true,
              writeGranted: false,
            });
            return;
          }
          throw new Error(writeResult?.error || 'Could not save the lyric file');
        }
      }
      finish({
        success: true,
        filePath: result.filePath,
        fileName: result.fileName,
        baseName: result.baseName,
        extension: result.extension,
        replaced: Boolean(result.exists),
        writeResult,
      });
    } catch (nextError) {
      setError(nextError?.message || 'Could not use this save destination');
    } finally {
      setPreparing(false);
    }
  }, [extension, fileName, finish, preparing, selectedDestination]);

  const useNativeDialog = useCallback(() => {
    finish({
      nativeDialog: true,
      extension,
      defaultDirectory: selectedDestination?.path || initialDirectory || null,
    });
  }, [extension, finish, initialDirectory, selectedDestination]);

  const handleCreateLyricsFolder = useCallback(async () => {
    if (creatingLyricsFolder || preparing) return;
    const sequence = ++requestSequenceRef.current;
    setCreatingLyricsFolder(true);
    setError('');
    try {
      const creationResult = await window.electronAPI?.fileNavigator?.createLyricsFolder?.();
      if (!creationResult?.success) {
        throw new Error(creationResult?.error || 'Could not create the Lyrics folder');
      }
      const destinationsResult = await window.electronAPI?.fileNavigator?.getSaveDestinations?.(initialDirectory);
      if (sequence !== requestSequenceRef.current) return;
      if (!destinationsResult?.success) {
        throw new Error(destinationsResult?.error || 'Could not load the created Lyrics folder');
      }
      const nextDestinations = destinationsResult.destinations || [];
      setDestinations(nextDestinations);
      const createdIndex = nextDestinations.findIndex((destination) => (
        destination.path === creationResult.createdFolderPath && destination.available
      ));
      const firstAvailableIndex = nextDestinations.findIndex((destination) => destination.available);
      setSelectedIndex(createdIndex >= 0 ? createdIndex : Math.max(0, firstAvailableIndex));
      window.requestAnimationFrame(() => nameInputRef.current?.focus());
    } catch (nextError) {
      if (sequence === requestSequenceRef.current) {
        setError(nextError?.message || 'Could not create the Lyrics folder');
      }
    } finally {
      if (sequence === requestSequenceRef.current) setCreatingLyricsFolder(false);
    }
  }, [creatingLyricsFolder, initialDirectory, preparing]);

  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (destinations.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      setSelectedIndex((previous) => (
        event.key === 'ArrowDown'
          ? (previous + 1) % destinations.length
          : (previous - 1 + destinations.length) % destinations.length
      ));
      return;
    }
    if ((event.ctrlKey || event.metaKey) && String(event.key || '').toLowerCase() === 's') {
      event.preventDefault();
      event.stopPropagation();
      void submit({ overwrite: Boolean(overwriteCandidate) });
      return;
    }
    if ((event.ctrlKey || event.metaKey) && ['h', 'i', 'l', 'n', 'o'].includes(String(event.key || '').toLowerCase())) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
      if (event.target instanceof HTMLElement && event.target.closest('button')) return;
      event.preventDefault();
      event.stopPropagation();
      void submit({ overwrite: Boolean(overwriteCandidate) });
    }
  }, [close, destinations.length, overwriteCandidate, submit]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal((
    <div
      className="fixed inset-x-0 bottom-0 top-9 z-[1810]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="file-save-navigator-title"
      onKeyDownCapture={handleKeyDown}
    >
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${transitioning ? 'opacity-0' : 'opacity-100'}`}
        onClick={close}
        aria-hidden="true"
      />
      <div className="pointer-events-none relative flex h-full items-center justify-center p-4">
        <div
          data-modal-root="true"
          className={`pointer-events-auto flex h-[min(460px,calc(100vh-72px))] min-h-[320px] w-[min(640px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border shadow-2xl ring-1 transition-all duration-200 ${transitioning
            ? 'translate-y-8 scale-95 opacity-0'
            : 'opacity-100'
            } ${darkMode
              ? 'border-slate-700/80 bg-slate-950 text-gray-100 ring-white/5'
              : 'border-slate-200 bg-white text-gray-900 ring-black/5'
            }`}
        >
          <header className={`flex shrink-0 items-start justify-between border-b px-5 py-4 ${darkMode ? 'border-white/7 bg-slate-900/80' : 'border-gray-200 bg-gray-50/90'}`}>
            <div>
              <h2 id="file-save-navigator-title" className="text-sm font-semibold">Save lyrics</h2>
              <p className={`mt-0.5 text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                Choose an indexed folder, then press Enter to save.
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              className={`rounded-full p-2 transition-colors ${darkMode ? 'text-gray-500 hover:bg-white/10 hover:text-gray-300' : 'text-gray-400 hover:bg-black/5 hover:text-gray-600'}`}
              aria-label="Close save dialog"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className={`shrink-0 border-b px-5 py-3 ${darkMode ? 'border-white/7' : 'border-gray-100'}`}>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <label htmlFor="file-save-navigator-name" className={`text-[10px] font-bold uppercase tracking-[0.12em] ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                File name
              </label>
              {availableExtensions.length > 1 && (
                <div className={`flex items-center rounded-lg p-0.5 ring-1 ring-inset ${darkMode ? 'ring-gray-700' : 'ring-gray-200'}`} aria-label="Lyrics file format">
                  {availableExtensions.map((format) => (
                    <button
                      key={format}
                      type="button"
                      onClick={() => { setExtension(format); setError(''); }}
                      className={`rounded-md px-2.5 py-1 text-[9px] font-bold uppercase transition-colors ${extension === format
                        ? darkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-900 shadow-sm'
                        : darkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-500 hover:text-gray-800'
                        }`}
                      aria-pressed={extension === format}
                    >
                      {format}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <Input
                id="file-save-navigator-name"
                ref={nameInputRef}
                value={fileName}
                onChange={(event) => { setFileName(event.target.value); setError(''); }}
                className={`h-10 rounded-xl pr-16 text-[13px] ${darkMode ? 'border-gray-700 bg-gray-800/90 text-white' : 'border-gray-200 bg-white text-gray-900'}`}
              />
              <span className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-semibold ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                .{extension}
              </span>
            </div>
          </div>

          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 [scrollbar-gutter:stable]"
            role="listbox"
            aria-label="Indexed save folders"
            aria-busy={loading || creatingLyricsFolder}
          >
            {loading ? (
              <div className="flex h-full min-h-32 items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" aria-hidden />
                <span className="sr-only">Loading indexed folders</span>
              </div>
            ) : destinations.length === 0 ? (
              <div className="flex h-44 flex-col items-center justify-center px-8 text-center">
                <FolderOpen className={`h-7 w-7 ${darkMode ? 'text-gray-700' : 'text-gray-300'}`} />
                <p className={`mt-3 text-xs font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>No indexed folders available</p>
                <p className={`mt-1 max-w-sm text-[11px] leading-4 ${darkMode ? 'text-gray-600' : 'text-gray-500'}`}>
                  Add a folder in Preferences, or create a Lyrics folder.
                </p>
                <button
                  type="button"
                  onClick={() => void handleCreateLyricsFolder()}
                  disabled={creatingLyricsFolder}
                  className="mt-3 flex h-8 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-[11px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {creatingLyricsFolder
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    : <FolderPlus className="h-3.5 w-3.5" aria-hidden />}
                  {creatingLyricsFolder ? 'Creating folder…' : 'Create lyrics folder'}
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                {destinations.map((destination, index) => {
                  const active = index === selectedIndex;
                  return (
                    <button
                      key={destination.path}
                      type="button"
                      role="option"
                      aria-selected={active}
                      disabled={!destination.available}
                      onClick={() => { setSelectedIndex(index); setError(''); }}
                      onDoubleClick={() => void submit({ destination })}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${active
                        ? darkMode ? 'bg-blue-500/18 text-white ring-1 ring-blue-400/35' : 'bg-blue-50 text-gray-950 ring-1 ring-blue-200'
                        : darkMode ? 'text-gray-300 hover:bg-white/5' : 'text-gray-800 hover:bg-gray-50'
                        } ${!destination.available ? 'cursor-not-allowed opacity-45' : ''}`}
                    >
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-white shadow-sm ring-1 ring-gray-200/70'}`}>
                        <Folder className="h-4 w-4 text-amber-500" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-semibold">{destination.name}</span>
                        <span className={`mt-0.5 block truncate text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-500'}`} title={destination.path}>
                          {destination.detail} · {destination.path}
                        </span>
                      </span>
                      {active && <Check className="h-4 w-4 shrink-0 text-blue-500" />}
                    </button>
                  );
                })}
              </div>
            )}
            {error && (
              <div className={`mt-2 rounded-xl border px-3 py-2 text-[11px] ${darkMode ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-red-200 bg-red-50 text-red-700'}`}>
                {error}
              </div>
            )}
          </div>

          <footer className={`flex min-h-16 shrink-0 items-center justify-between gap-4 border-t px-4 py-3 ${darkMode ? 'border-white/7 bg-slate-900/75' : 'border-gray-200 bg-gray-50'}`}>
            <button
              type="button"
              data-native-save-option="true"
              onClick={useNativeDialog}
              disabled={creatingLyricsFolder || preparing}
              className={`flex h-9 items-center gap-2 rounded-lg px-3 text-[11px] font-semibold disabled:cursor-wait disabled:opacity-50 ${darkMode ? 'text-gray-400 hover:bg-white/7 hover:text-gray-200' : 'text-gray-600 hover:bg-gray-200/70 hover:text-gray-900'}`}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Save in different folder…
            </button>
            <div className="flex items-center gap-2">
              {overwriteCandidate && (
                <button
                  type="button"
                  onClick={() => { setOverwriteCandidate(null); nameInputRef.current?.focus(); }}
                  className={`h-9 rounded-lg px-3 text-[11px] font-semibold ${darkMode ? 'text-gray-400 hover:bg-white/7' : 'text-gray-600 hover:bg-gray-200'}`}
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={() => void submit({ overwrite: Boolean(overwriteCandidate) })}
                disabled={!selectedDestination?.available || !fileName.trim() || preparing}
                className={`flex h-9 min-w-28 items-center justify-center gap-2 rounded-lg px-4 text-[11px] font-semibold text-white disabled:opacity-45 ${overwriteCandidate ? 'bg-amber-600 hover:bg-amber-700' : 'bg-linear-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700'}`}
              >
                {preparing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {overwriteCandidate ? 'Replace file' : 'Save here'}
              </button>
            </div>
          </footer>
          {overwriteCandidate && (
            <div className={`shrink-0 border-t px-4 py-2 text-center text-[10px] font-semibold ${darkMode ? 'border-amber-500/20 bg-amber-500/10 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
              “{overwriteCandidate.fileName}” already exists in this folder. Replace it?
            </div>
          )}
        </div>
      </div>
    </div>
  ), document.body);
}
