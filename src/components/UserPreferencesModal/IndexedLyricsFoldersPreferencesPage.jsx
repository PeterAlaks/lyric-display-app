import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, Folder, FolderPlus, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FILE_NAVIGATOR_LIMITS } from '../../../shared/fileNavigatorLimits.js';
import {
  getFolderSelectionNotice,
  mergeFileNavigatorStatus,
} from '../../utils/fileNavigatorEvents.js';
import AlwaysInfoButton from '../LyricVideoStudio/AlwaysInfoButton';

const emptyState = { roots: [], status: {}, limits: {} };

const IndexedLyricsFoldersPreferencesPage = ({
  darkMode,
  labelClass,
  mutedClass,
  onBack,
  onPersistenceChange,
  showModal,
  showToast,
}) => {
  const stateRequestSequenceRef = useRef(0);
  const [navigatorState, setNavigatorState] = useState(emptyState);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [creatingLyricsFolder, setCreatingLyricsFolder] = useState(false);
  const [removingPath, setRemovingPath] = useState('');
  const [error, setError] = useState('');

  const applyResult = useCallback((result) => {
    if (!result?.success) return false;
    setNavigatorState((previous) => {
      if ((Number(result.status?.scanId) || 0) < (Number(previous.status?.scanId) || 0)) {
        return previous;
      }
      return {
        roots: result.roots || [],
        status: result.status || {},
        limits: result.limits || {},
      };
    });
    return true;
  }, []);

  const loadState = useCallback(async () => {
    const api = window.electronAPI?.fileNavigator;
    if (!api?.getState) {
      setError('Indexed folders are available in the desktop app.');
      setLoading(false);
      return;
    }

    const requestSequence = ++stateRequestSequenceRef.current;
    try {
      const result = await api.getState();
      if (requestSequence !== stateRequestSequenceRef.current) return false;
      if (!applyResult(result)) throw new Error(result?.error || 'Could not load indexed folders');
      setError('');
      return true;
    } catch (nextError) {
      if (requestSequence === stateRequestSequenceRef.current) {
        setError(nextError?.message || 'Could not load indexed folders');
      }
      return false;
    } finally {
      if (requestSequence === stateRequestSequenceRef.current) setLoading(false);
    }
  }, [applyResult]);

  useEffect(() => {
    void loadState();
    const unsubscribe = window.electronAPI?.fileNavigator?.onChange?.((status) => {
      if (status?.scanning === false) {
        void loadState();
        return;
      }
      if (status?.scanning === true) stateRequestSequenceRef.current += 1;
      setNavigatorState((previous) => {
        const nextStatus = mergeFileNavigatorStatus(previous.status, status);
        if (nextStatus === previous.status) return previous;
        return { ...previous, status: nextStatus };
      });
    });
    return () => unsubscribe?.();
  }, [loadState]);

  const handleAddFolder = async () => {
    if (adding || navigatorState.status.scanning) return;
    setAdding(true);
    setError('');
    onPersistenceChange?.('start');
    try {
      const result = await window.electronAPI?.fileNavigator?.addRoot?.();
      if (result?.canceled) {
        onPersistenceChange?.('cancel');
        return;
      }
      if (!applyResult(result)) throw new Error(result?.error || 'Could not add that folder');
      const notice = getFolderSelectionNotice(result.selection);
      if (notice) showToast?.(notice);
      onPersistenceChange?.(result.selection?.addedCount === 0 ? 'cancel' : 'success');
    } catch (nextError) {
      showToast?.({
        title: 'Folder not indexed',
        message: nextError?.message || 'Could not add that folder.',
        variant: 'error',
      });
      onPersistenceChange?.('error');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveFolder = async (root) => {
    if (navigatorState.status.scanning || removingPath) return;
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
    if (confirmation !== 'remove') return;

    setRemovingPath(root.path);
    setError('');
    onPersistenceChange?.('start');
    try {
      const result = await window.electronAPI?.fileNavigator?.removeRoot?.(root.path);
      if (!applyResult(result)) throw new Error(result?.error || 'Could not remove that folder');
      onPersistenceChange?.('success');
    } catch (nextError) {
      showToast?.({
        title: 'Folder not removed',
        message: nextError?.message || 'Could not remove that folder.',
        variant: 'error',
      });
      onPersistenceChange?.('error');
    } finally {
      setRemovingPath('');
    }
  };

  const handleCreateLyricsFolder = async () => {
    if (creatingLyricsFolder || adding || navigatorState.status.scanning) return;
    setCreatingLyricsFolder(true);
    setError('');
    onPersistenceChange?.('start');
    try {
      const result = await window.electronAPI?.fileNavigator?.createLyricsFolder?.();
      if (!applyResult(result)) {
        throw new Error(result?.error || 'Could not create the Lyrics folder');
      }
      showToast?.({
        title: result.folderCreated ? 'Lyrics folder created' : 'Lyrics folder ready',
        message: result.folderCreated
          ? 'Documents/LyricDisplay/Lyrics was created and indexed.'
          : 'The existing Documents/LyricDisplay/Lyrics folder is now indexed.',
        variant: 'success',
      });
      onPersistenceChange?.('success');
    } catch (nextError) {
      showToast?.({
        title: 'Lyrics folder unavailable',
        message: nextError?.message || 'Could not create the Lyrics folder.',
        variant: 'error',
      });
      onPersistenceChange?.('error');
    } finally {
      setCreatingLyricsFolder(false);
    }
  };

  const handleReindex = async () => {
    if (navigatorState.status.scanning) return;
    setError('');
    try {
      const result = await window.electronAPI?.fileNavigator?.reindex?.();
      if (!applyResult(result)) throw new Error(result?.error || 'Could not refresh the file index');
    } catch (nextError) {
      showToast?.({
        title: 'Index not refreshed',
        message: nextError?.message || 'Could not refresh the file index.',
        variant: 'error',
      });
    }
  };

  const { roots, status } = navigatorState;
  const maxRoots = FILE_NAVIGATOR_LIMITS.maxRoots;
  const maxRootSizeMb = Math.round(FILE_NAVIGATOR_LIMITS.maxSourceBytesPerRoot / (1024 * 1024));
  const rootLimitReached = roots.length >= maxRoots;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button type="button" size="icon" variant="ghost" onClick={onBack} aria-label="Back from Indexed Lyrics Folders" className="h-7 w-7 shrink-0">
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <h3 className={`truncate text-base font-semibold ${labelClass}`}>Indexed Lyrics Folders</h3>
              <AlwaysInfoButton
                side="left"
                ariaLabel="About indexed lyrics folders"
                content={`LyricDisplay searches these folders without moving or managing your files. TXT and LRC contents are indexed for lyric search; Markdown, RTF, and DOCX files are indexed by name and location. Up to ${maxRoots} focused folders and ${maxRootSizeMb} MB of supported files per folder can be indexed.`}
              />
            </div>
            <p className={`text-[11px] ${mutedClass}`}>
              {roots.length} {roots.length === 1 ? 'folder' : 'folders'} · {status.indexedFiles || 0} indexed files
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={handleReindex}
            disabled={loading || status.scanning}
            aria-label="Refresh lyrics index"
            title="Refresh lyrics index"
            className="h-8 w-8"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${status.scanning ? 'animate-spin' : ''}`} />
          </Button>
          <Button type="button" size="sm" onClick={handleAddFolder} disabled={adding || creatingLyricsFolder || status.scanning || rootLimitReached} className="gap-1.5">
            {adding || creatingLyricsFolder ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderPlus className="h-3.5 w-3.5" />}
            {creatingLyricsFolder ? 'Creating…' : rootLimitReached ? 'Folder limit reached' : 'Add folders'}
          </Button>
        </div>
      </div>

      {error && (
        <div className={`mb-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-[11px] ${darkMode
          ? 'border-red-500/30 bg-red-500/10 text-red-300'
          : 'border-red-200 bg-red-50 text-red-700'
          }`} role="alert">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {rootLimitReached && !error && (
        <div className={`mb-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-[11px] ${darkMode
          ? 'border-amber-500/25 bg-amber-500/10 text-amber-200'
          : 'border-amber-200 bg-amber-50 text-amber-800'
          }`} role="status">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Indexed folder limit reached. Remove a folder before adding another.</span>
        </div>
      )}

      <div className={`overflow-hidden rounded-lg border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        {loading ? (
          <div className={`flex items-center justify-center gap-2 px-3 py-8 text-xs ${mutedClass}`}>
            <Loader2 className="h-4 w-4 animate-spin" /> Loading folders
          </div>
        ) : roots.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Folder className={`mx-auto h-6 w-6 ${mutedClass}`} />
            <p className={`mt-2 text-xs font-medium ${labelClass}`}>No indexed folders</p>
            <p className={`mt-1 text-[11px] ${mutedClass}`}>Add an existing folder, or create a Lyrics folder.</p>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleCreateLyricsFolder()}
              disabled={creatingLyricsFolder || status.scanning}
              className="mt-3 gap-1.5"
            >
              {creatingLyricsFolder
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                : <FolderPlus className="h-3.5 w-3.5" aria-hidden />}
              {creatingLyricsFolder ? 'Creating folder…' : 'Create lyrics folder'}
            </Button>
          </div>
        ) : (
          <div className={`divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
            {roots.map((root) => (
              <div key={root.path} className="flex min-h-12 items-center justify-between gap-3 px-3 py-2">
                <div className="flex min-w-0 items-center gap-3">
                  <Folder className={`h-4 w-4 shrink-0 ${root.available && !root.issue ? 'text-amber-500' : 'text-gray-400'}`} />
                  <div className="min-w-0">
                    <p className={`truncate text-xs font-medium ${labelClass}`}>{root.name || root.path}</p>
                    <p className={`truncate text-[10px] ${root.available && !root.issue ? mutedClass : 'text-red-500'}`} title={root.issue || root.path}>
                      {!root.available ? `${root.path} · Folder unavailable` : root.issue || root.path}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void handleRemoveFolder(root)}
                  disabled={status.scanning || Boolean(removingPath)}
                  className={`h-7 shrink-0 gap-1 px-2 text-[11px] ${darkMode
                    ? 'text-red-400 hover:bg-red-950/40 hover:text-red-300'
                    : 'text-red-600 hover:bg-red-50 hover:text-red-700'
                    }`}
                >
                  {removingPath === root.path
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Trash2 className="h-3 w-3" />}
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {status.scanning && (
        <p className={`mt-3 flex items-center gap-2 text-[11px] ${mutedClass}`}>
          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
          Updating index
        </p>
      )}
      {!status.scanning && status.contentTruncated && (
        <p className={`mt-3 flex items-start gap-2 text-[11px] ${mutedClass}`}>
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
          Searchable lyric content reached its safe memory budget. All filenames and paths remain indexed.
        </p>
      )}
    </div>
  );
};

export default IndexedLyricsFoldersPreferencesPage;
