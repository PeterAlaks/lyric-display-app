import React, { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import useToast from '../hooks/useToast';
import { X, Plus, Search, Trash2, Clock, GripVertical } from 'lucide-react';
import { useSetlistState, useDarkModeState, useIsDesktopApp } from '../hooks/useStoreSelectors';
import { useControlSocket } from '../context/ControlSocketProvider';
import useModal from '../hooks/useModal';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const SetlistModal = () => {
  const { setlistModalOpen, setSetlistModalOpen, setlistFiles, isSetlistFull, getAvailableSetlistSlots, setSetlistFiles } = useSetlistState();

  const { darkMode } = useDarkModeState();
  const isDesktopApp = useIsDesktopApp();

  const { emitSetlistAdd, emitSetlistRemove, emitSetlistLoad, emitSetlistReorder } = useControlSocket();

  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);
  const { showToast } = useToast();
  const { showModal } = useModal();
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Filter setlist files based on search query
  const list = Array.isArray(setlistFiles) ? setlistFiles : [];
  const filteredFiles = list.filter(file =>
    file.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const canReorder = isDesktopApp && filteredFiles.length > 1;

  const handleDragStart = useCallback(({ active }) => {
    if (!isDesktopApp) return;
    setActiveId(active?.id ?? null);
  }, [isDesktopApp]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const handleDragEnd = useCallback(({ active, over }) => {
    setActiveId(null);
    if (!isDesktopApp || !over || !active || active.id === over.id) return;

    const fromIndex = list.findIndex((file) => file.id === active.id);
    const toIndex = list.findIndex((file) => file.id === over.id);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

    const reordered = arrayMove(list, fromIndex, toIndex);
    setSetlistFiles(reordered);

    try {
      emitSetlistReorder(reordered.map((file) => file.id));
    } catch (error) {
      console.error('Failed to emit setlist reorder:', error);
    }
  }, [emitSetlistReorder, isDesktopApp, list, setSetlistFiles]);

  // Format date for display
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Handle file selection
  const handleFileSelect = useCallback(async () => {
    if (!isDesktopApp) {
      console.warn('File add only available on desktop app');
      return;
    }

    if (isSetlistFull()) {
      showModal({
        title: 'Setlist is full',
        description: 'You already have the maximum of 25 songs in the setlist.',
        variant: 'warn',
        dismissLabel: 'Got it',
      });
      return;
    }

    fileInputRef.current?.click();
  }, [isDesktopApp, isSetlistFull]);

  // Process selected files
  const handleFileChange = useCallback(async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    // Check if adding these files would exceed limit
    const availableSlots = getAvailableSetlistSlots();
    if (files.length > availableSlots) {
      showModal({
        title: 'Setlist limit reached',
        description: availableSlots === 0
          ? 'No slots are left. Remove a song before adding new ones.'
          : `You can add ${availableSlots} more ${availableSlots === 1 ? 'song' : 'songs'} right now.`,
        variant: 'warn',
        dismissLabel: 'Okay',
      });
      return;
    }

    // Validate all files are .txt
    const invalidFiles = files.filter(file => !file.name.toLowerCase().endsWith('.txt'));
    if (invalidFiles.length > 0) {
      showModal({
        title: 'Unsupported files',
        description: 'Only .txt lyric files can be added to the setlist.',
        variant: 'error',
        dismissLabel: 'Understood',
      });
      return;
    }

    setIsLoading(true);

    try {
      const processedFiles = await Promise.all(
        files.map(async (file) => {
          const content = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
          });

          return {
            name: file.name,
            content,
            lastModified: file.lastModified
          };
        })
      );

      // Send files to server
      emitSetlistAdd(processedFiles);

      // Clear file input
      event.target.value = '';

    } catch (error) {
      console.error('Error processing files:', error);
      showModal({
        title: 'File processing error',
        description: 'Some files could not be added. Please try again.',
        variant: 'error',
        dismissLabel: 'Close',
      });
    } finally {
      setIsLoading(false);
    }
  }, [emitSetlistAdd, getAvailableSetlistSlots]);

  // Handle file removal
  const handleRemoveFile = useCallback((fileId, event) => {
    event.stopPropagation(); // Prevent loading the file when clicking remove
    if (!isDesktopApp) return;

    emitSetlistRemove(fileId);
  }, [emitSetlistRemove, isDesktopApp]);

  // Handle file loading
  const handleLoadFile = useCallback((fileId) => {
    emitSetlistLoad(fileId);
    // Close modal after loading (optional - you can remove this if you want modal to stay open)
    setSetlistModalOpen(false);
  }, [emitSetlistLoad, setSetlistModalOpen]);

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
  };

  // Close modal
  const closeModal = () => {
    setSetlistModalOpen(false);
    setSearchQuery(''); // Clear search when closing
  };

  // Animate mount/unmount (internal visibility decoupled from store)
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [entering, setEntering] = useState(false);
  useLayoutEffect(() => {
    if (setlistModalOpen) {
      setVisible(true);
      setExiting(false);
      setEntering(true);
      const raf = requestAnimationFrame(() => setEntering(false));
      return () => cancelAnimationFrame(raf);
    } else {
      // trigger exit animation then hide after duration
      setEntering(false);
      setExiting(true);
      const t = setTimeout(() => { setExiting(false); setVisible(false); }, 300);
      return () => clearTimeout(t);
    }
  }, [setlistModalOpen]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black backdrop-blur-sm transition-opacity duration-300 ${exiting || entering ? 'opacity-0' : 'opacity-50'}`}
        onClick={closeModal}
      />

      {/* Modal */}
      <div className={`
        relative w-full max-w-4xl mx-4 max-h-[90vh] rounded-xl shadow-2xl overflow-hidden
        ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}
        md:mx-auto md:w-full md:max-w-2xl md:max-h-[80vh] md:rounded-xl
        sm:mx-2 sm:max-w-full sm:h-full sm:max-h-full sm:rounded-none
        transition-all duration-300 ease-out
        ${(exiting || entering) ? 'opacity-0 translate-y-1 scale-95' : 'opacity-100 translate-y-0 scale-100'}
        `}>

        {/* Fixed Header */}
        <div className={`
          px-6 py-4 border-b flex items-center justify-between
          ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}
        `}>
          <div>
            <h2 className="text-xl font-bold">Setlist Songs</h2>
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Add up to 25 lyric files to setlist ({setlistFiles.length}/25)
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Add Files Button - Desktop Only */}
            {isDesktopApp && (
              <Button
                onClick={handleFileSelect}
                disabled={isSetlistFull() || isLoading}
                variant="ghost"
                className={`
    flex items-center gap-2 px-3 py-2
    ${isSetlistFull() ? 'opacity-50 cursor-not-allowed' : ''}
    ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}
  `}
                title={isSetlistFull() ? 'Setlist is full (25 files)' : 'Add files to setlist'}
              >
                <Plus className="w-4 h-4" />
                Add Files
              </Button>
            )}

            {/* Close Button */}
            <Button
              onClick={closeModal}
              variant="ghost"
              size="icon"
              className={`w-10 h-10 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
            >
              <X className="w-6 h-6" />
            </Button>
          </div>
        </div>

        {/* Fixed Search Bar */}
        <div className={`
          px-6 py-3 border-b
          ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}
        `}>
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'
              }`} />
            <Input
              type="text"
              placeholder="Search setlist files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`pl-10 pr-10 ${darkMode
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                : 'bg-white border-gray-300'
                }`}
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'
                  }`}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {searchQuery && (
            <p className={`mt-2 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {filteredFiles.length > 0
                ? `Showing ${filteredFiles.length} of ${list.length} files`
                : 'No files match your search'
              }
            </p>
          )}

          {isDesktopApp && filteredFiles.length > 1 && !searchQuery && (
            <p className={`mt-2 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
              Drag the grip handle to reorder songs. Changes sync to all clients.
            </p>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 max-h-96">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Processing files...
              </div>
            </div>
          )}

          {!isLoading && filteredFiles.length === 0 && !searchQuery && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'
                }`}>
                <Plus className={`w-8 h-8 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
              </div>
              <p className={`text-lg ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                No items on setlist
              </p>
              <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {isDesktopApp
                  ? 'Click add button on header to add files'
                  : 'Files can only be added from desktop app'
                }
              </p>
            </div>
          )}

          {!isLoading && filteredFiles.length === 0 && searchQuery && (
            <div className="flex flex-col items-center justify-center py-12">
              <Search className={`w-16 h-16 mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
              <p className={`text-lg ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                No files match "{searchQuery}"
              </p>
              <Button
                onClick={clearSearch}
                variant="ghost"
                className="mt-2"
              >
                Clear search
              </Button>
            </div>
          )}

          {!isLoading && filteredFiles.length > 0 && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <SortableContext items={filteredFiles.map((file) => file.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {filteredFiles.map((file) => (
                    <SortableSetlistItem
                      key={file.id}
                      file={file}
                      darkMode={darkMode}
                      isDesktopApp={isDesktopApp}
                      canReorder={canReorder}
                      isActive={activeId === file.id}
                      onLoad={handleLoadFile}
                      onRemove={handleRemoveFile}
                      formatDate={formatDate}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
};

const SortableSetlistItem = ({
  file,
  darkMode,
  isDesktopApp,
  canReorder,
  isActive,
  onLoad,
  onRemove,
  formatDate,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: file.id, disabled: !canReorder });

  const style = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition: transition || undefined,
    boxShadow: isDragging ? (darkMode ? '0 10px 30px rgba(0,0,0,0.45)' : '0 10px 25px rgba(0,0,0,0.15)') : undefined,
  };

  const handleLoad = useCallback(() => onLoad(file.id), [file.id, onLoad]);

  const handleRemove = useCallback((event) => {
    event.stopPropagation();
    onRemove(file.id, event);
  }, [file.id, onRemove]);

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleLoad();
    }
  };

  const baseClasses = darkMode
    ? 'bg-gray-700 border-gray-600 hover:bg-gray-600'
    : 'bg-gray-50 border-gray-200 hover:bg-gray-100';

  const activeClasses = isActive ? 'ring-2 ring-indigo-400 ring-offset-1' : '';

  const removeButtonClasses = darkMode
    ? 'hover:bg-gray-800 text-gray-400 hover:text-red-400'
    : 'hover:bg-gray-200 text-gray-500 hover:text-red-500';

  const handleClasses = darkMode
    ? 'border-gray-600 text-gray-400 hover:bg-gray-600'
    : 'border-gray-200 text-gray-500 hover:bg-gray-200';

  const reorderTitle = canReorder
    ? 'Drag to reorder'
    : 'Reordering available on desktop when multiple items are visible';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative p-4 rounded-lg border cursor-pointer transition-all duration-200 ${baseClasses} hover:shadow-md ${activeClasses}`}
      onClick={handleLoad}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {isDesktopApp && (
            <button
              type="button"
              ref={setActivatorNodeRef}
              className={`mt-1 hidden sm:flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${handleClasses} ${canReorder ? 'cursor-grab active:cursor-grabbing opacity-100' : 'cursor-not-allowed opacity-40'}`}
              onClick={(event) => event.stopPropagation()}
              title={reorderTitle}
              aria-label="Reorder setlist item"
              {...(canReorder ? attributes : {})}
              {...(canReorder ? listeners : {})}
            >
              <GripVertical className="w-4 h-4" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-base truncate mb-1">
              {file.displayName}
            </h3>
            <div className={`flex items-center gap-1 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              <Clock className="w-3 h-3" />
              <span>{formatDate(file.lastModified)}</span>
            </div>
          </div>
        </div>

        {isDesktopApp && (
          <button
            type="button"
            onClick={handleRemove}
            className={`opacity-0 group-hover:opacity-100 p-2 rounded-md transition-opacity ${removeButtonClasses}`}
            title="Remove from setlist"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

// Listen for setlist remove success to show toast
export default function SetlistModalWithToasts(props) {
  const { showToast } = useToast();
  useEffect(() => {
    const handler = (e) => {
      const name = e?.detail?.name || e?.detail?.fileId || '';
      showToast({ title: 'Removed from setlist', message: String(name), variant: 'success' });
    };
    window.addEventListener('setlist-remove-success', handler);
    return () => window.removeEventListener('setlist-remove-success', handler);
  }, [showToast]);

  return <SetlistModal {...props} />;
}
export { SetlistModal };
