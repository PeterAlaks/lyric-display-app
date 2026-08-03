import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, Folder, FolderPlus, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const emptyState = { roots: [], status: {} };

const IndexedLyricsFoldersPreferencesPage = ({
  darkMode,
  labelClass,
  mutedClass,
  onBack,
  onPersistenceChange,
  showModal,
}) => {
  const [navigatorState, setNavigatorState] = useState(emptyState);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [removingPath, setRemovingPath] = useState('');
  const [error, setError] = useState('');

  const applyResult = useCallback((result) => {
    if (!result?.success) return false;
    setNavigatorState({
      roots: result.roots || [],
      status: result.status || {},
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

    try {
      const result = await api.getState();
      if (!applyResult(result)) throw new Error(result?.error || 'Could not load indexed folders');
    } catch (nextError) {
      setError(nextError?.message || 'Could not load indexed folders');
    } finally {
      setLoading(false);
    }
  }, [applyResult]);

  useEffect(() => {
    void loadState();
    const unsubscribe = window.electronAPI?.fileNavigator?.onChange?.((status) => {
      setNavigatorState((previous) => ({
        ...previous,
        status: { ...previous.status, ...(status || {}) },
      }));
    });
    return () => unsubscribe?.();
  }, [loadState]);

  const handleAddFolder = async () => {
    if (adding) return;
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
      onPersistenceChange?.('success');
    } catch (nextError) {
      setError(nextError?.message || 'Could not add that folder');
      onPersistenceChange?.('error');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveFolder = async (root) => {
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
      setError(nextError?.message || 'Could not remove that folder');
      onPersistenceChange?.('error');
    } finally {
      setRemovingPath('');
    }
  };

  const handleReindex = async () => {
    setError('');
    try {
      const result = await window.electronAPI?.fileNavigator?.reindex?.();
      if (!applyResult(result)) throw new Error(result?.error || 'Could not refresh the file index');
    } catch (nextError) {
      setError(nextError?.message || 'Could not refresh the file index');
    }
  };

  const { roots, status } = navigatorState;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button type="button" size="icon" variant="ghost" onClick={onBack} aria-label="Back from Indexed Lyrics Folders" className="h-7 w-7 shrink-0">
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
          <div className="min-w-0">
            <h3 className={`truncate text-base font-semibold ${labelClass}`}>Indexed Lyrics Folders</h3>
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
          <Button type="button" size="sm" onClick={handleAddFolder} disabled={adding} className="gap-1.5">
            {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderPlus className="h-3.5 w-3.5" />}
            Add folder
          </Button>
        </div>
      </div>

      <p className={`mb-3 text-[11px] leading-5 ${mutedClass}`}>
        LyricDisplay searches these folders without moving or managing your files. TXT and LRC contents are indexed for lyric search; Markdown, RTF, and DOCX files are indexed by name and location.
      </p>

      {error && (
        <div className={`mb-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-[11px] ${darkMode
          ? 'border-red-500/30 bg-red-500/10 text-red-300'
          : 'border-red-200 bg-red-50 text-red-700'
          }`} role="alert">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
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
            <p className={`mt-1 text-[11px] ${mutedClass}`}>Add the folder where you keep your lyric files.</p>
          </div>
        ) : (
          <div className={`divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
            {roots.map((root) => (
              <div key={root.path} className="flex min-h-12 items-center justify-between gap-3 px-3 py-2">
                <div className="flex min-w-0 items-center gap-3">
                  <Folder className={`h-4 w-4 shrink-0 ${root.available ? 'text-amber-500' : 'text-gray-400'}`} />
                  <div className="min-w-0">
                    <p className={`truncate text-xs font-medium ${labelClass}`}>{root.name || root.path}</p>
                    <p className={`truncate text-[10px] ${root.available ? mutedClass : 'text-red-500'}`} title={root.path}>
                      {root.available ? root.path : `${root.path} · Folder unavailable`}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void handleRemoveFolder(root)}
                  disabled={removingPath === root.path}
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
          Updating index{status.scannedFiles ? ` · ${status.scannedFiles} files scanned` : ''}
        </p>
      )}
    </div>
  );
};

export default IndexedLyricsFoldersPreferencesPage;
