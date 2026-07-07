import React from 'react';
import { Image, Trash2, Upload, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { resolveBackendUrl } from '../utils/network';
import { outputTemplates } from '../utils/outputTemplates';
import useAuth from '../hooks/useAuth';
import useToast from '../hooks/useToast';
import useModal from '../hooks/useModal';
import { ModalActionButton, ModalFooter } from '@/components/modal/modalActions';

const MAX_MEDIA_SIZE_BYTES = 200 * 1024 * 1024;

const mediaTabs = [
  { value: 'image', label: 'Image', icon: Image, accept: 'image/*' },
  { value: 'video', label: 'Video', icon: Video, accept: 'video/*' },
];

const formatFileSize = (bytes) => {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const getClientType = () => (typeof window !== 'undefined' && window.electronAPI ? 'desktop' : 'web');

const bundledTemplateMedia = outputTemplates
  .map((template) => {
    const media = template.settings?.fullScreenBackgroundMedia;
    if (!media?.bundled || !media.url) return null;

    return {
      id: `bundled:${media.url}`,
      type: 'image',
      name: template.settings?.fullScreenBackgroundMediaName || media.name || template.title,
      filename: media.name || media.url.split('/').pop() || template.id,
      url: media.url,
      mimeType: media.mimeType || 'image/jpeg',
      size: media.size || 0,
      uploadedAt: media.uploadedAt || 0,
      bundled: true,
    };
  })
  .filter(Boolean);

const UserMediaModal = ({
  darkMode,
  allowedTypes = ['image', 'video'],
  initialTab = 'image',
  description = '',
  onSelect,
  onClose,
}) => {
  const normalizedAllowedTypes = React.useMemo(() => {
    const next = allowedTypes.filter((type) => type === 'image' || type === 'video');
    return next.length > 0 ? next : ['image', 'video'];
  }, [allowedTypes]);

  const firstTab = normalizedAllowedTypes.includes(initialTab) ? initialTab : normalizedAllowedTypes[0];
  const [activeTab, setActiveTab] = React.useState(firstTab);
  const [media, setMedia] = React.useState([]);
  const [selectedId, setSelectedId] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const fileInputRef = React.useRef(null);
  const { ensureValidToken } = useAuth();
  const { showToast } = useToast();
  const { showModal } = useModal();
  const canSelectMedia = typeof onSelect === 'function';

  const selectedMedia = React.useMemo(
    () => media.find((item) => item.id === selectedId) || null,
    [media, selectedId]
  );

  const visibleMedia = React.useMemo(
    () => media.filter((item) => item.type === activeTab),
    [activeTab, media]
  );

  const deletableVisibleMedia = React.useMemo(
    () => visibleMedia.filter((item) => !item.bundled),
    [visibleMedia]
  );

  const request = React.useCallback(async (path, options = {}) => {
    const token = await ensureValidToken(getClientType());
    const response = await fetch(resolveBackendUrl(path), {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      let errorMessage = 'Media request failed';
      try {
        const body = await response.json();
        if (body?.error) errorMessage = body.error;
      } catch {
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }, [ensureValidToken]);

  const loadMedia = React.useCallback(async () => {
    setLoading(true);
    try {
      const typeParam = normalizedAllowedTypes.length === 1 ? normalizedAllowedTypes[0] : 'all';
      const payload = await request(`/api/user-media?type=${encodeURIComponent(typeParam)}`);
      const userMedia = Array.isArray(payload.media) ? payload.media : [];
      const bundledMedia = normalizedAllowedTypes.includes('image') ? bundledTemplateMedia : [];
      setMedia([...bundledMedia, ...userMedia]);
    } catch (error) {
      setMedia(normalizedAllowedTypes.includes('image') ? bundledTemplateMedia : []);
      showToast({
        title: 'Could not load media',
        message: error?.message || 'The media library could not be loaded.',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [normalizedAllowedTypes, request, showToast]);

  React.useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  React.useEffect(() => {
    if (!normalizedAllowedTypes.includes(activeTab)) {
      setActiveTab(normalizedAllowedTypes[0]);
    }
  }, [activeTab, normalizedAllowedTypes]);

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const expectedPrefix = activeTab === 'image' ? 'image/' : 'video/';
    if (!file.type.startsWith(expectedPrefix)) {
      showToast({
        title: 'Unsupported file',
        message: `Please choose a ${activeTab} file.`,
        variant: 'error',
      });
      return;
    }

    if (file.size > MAX_MEDIA_SIZE_BYTES) {
      showToast({
        title: 'File too large',
        message: `Files must be ${Math.round(MAX_MEDIA_SIZE_BYTES / (1024 * 1024))}MB or smaller.`,
        variant: 'error',
      });
      return;
    }

    setBusy(true);
    try {
      const formData = new FormData();
      formData.append('type', activeTab);
      formData.append('media', file);
      const payload = await request('/api/user-media', {
        method: 'POST',
        body: formData,
      });

      setMedia((current) => [payload, ...current.filter((item) => item.id !== payload.id)]);
      setSelectedId(payload.id);
      showToast({
        title: 'Media uploaded',
        message: `${payload.originalName || payload.name || file.name} is ready.`,
        variant: 'success',
      });
    } catch (error) {
      showToast({
        title: 'Upload failed',
        message: error?.message || 'Could not upload the media file.',
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = React.useCallback(async ({ title, message, confirmLabel = 'Delete' }) => {
    const result = await showModal({
      title,
      message,
      variant: 'warning',
      size: 'sm',
      actions: [
        {
          label: 'Cancel',
          value: { confirmed: false },
          variant: 'outline',
        },
        {
          label: confirmLabel,
          value: { confirmed: true },
          variant: 'destructive',
          autoFocus: true,
        },
      ],
    });

    return Boolean(result?.confirmed);
  }, [showModal]);

  const deleteMedia = async (item) => {
    if (!item || busy) return;
    if (item.bundled) return;
    const confirmed = await confirmDelete({
      title: 'Delete Media',
      message: `Delete "${item.name}" from the media library? This removes it from disk.`,
      confirmLabel: 'Delete',
    });
    if (!confirmed) return;

    setBusy(true);
    try {
      await request(`/api/user-media/${encodeURIComponent(item.type)}/${encodeURIComponent(item.filename)}`, {
        method: 'DELETE',
      });
      setMedia((current) => current.filter((entry) => entry.id !== item.id));
      setSelectedId((current) => (current === item.id ? null : current));
      showToast({
        title: 'Media deleted',
        message: `${item.name} was removed.`,
        variant: 'success',
      });
    } catch (error) {
      showToast({
        title: 'Delete failed',
        message: error?.message || 'Could not delete the media file.',
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const deleteAll = async () => {
    if (deletableVisibleMedia.length === 0 || busy) return;
    const confirmed = await confirmDelete({
      title: `Delete All ${activeTab === 'image' ? 'Images' : 'Videos'}`,
      message: activeTab === 'image'
        ? 'Delete all uploaded image media from the library? Bundled template images will remain available.'
        : 'Delete all uploaded video media from the library? This removes the files from disk.',
      confirmLabel: 'Delete All',
    });
    if (!confirmed) return;

    setBusy(true);
    try {
      await request(`/api/user-media?type=${encodeURIComponent(activeTab)}`, {
        method: 'DELETE',
      });
      setMedia((current) => current.filter((item) => item.type !== activeTab || item.bundled));
      setSelectedId((current) => {
        const selected = media.find((item) => item.id === current);
        return selected?.type === activeTab && !selected.bundled ? null : current;
      });
      showToast({
        title: 'Media cleared',
        message: `Uploaded ${activeTab} media was removed.`,
        variant: 'success',
      });
    } catch (error) {
      showToast({
        title: 'Delete all failed',
        message: error?.message || 'Could not delete media files.',
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const resolveMediaSource = (item) => (
    item?.bundled ? item.url : resolveBackendUrl(item?.url)
  );

  const proceed = () => {
    if (!canSelectMedia || !selectedMedia) return;
    onSelect(selectedMedia);
    onClose?.({ action: 'selected', media: selectedMedia });
  };

  return (
    <div className={cn('flex h-full min-h-[520px] flex-col', darkMode ? 'text-gray-100' : 'text-gray-900')}>
      <div className={cn('flex flex-col gap-3 border-b px-6 py-4', darkMode ? 'border-white/5 bg-slate-950/45' : 'border-slate-900/5 bg-[#f8fafc]')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className={cn('h-10 p-1', darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600')}>
              {mediaTabs
                .filter((tab) => normalizedAllowedTypes.includes(tab.value))
                .map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className={cn(
                        'min-w-[120px] gap-2 px-4',
                        darkMode
                          ? 'data-[state=active]:bg-white data-[state=active]:text-gray-950'
                          : 'data-[state=active]:bg-white data-[state=active]:text-gray-950'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </TabsTrigger>
                  );
                })}
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept={mediaTabs.find((tab) => tab.value === activeTab)?.accept}
              onChange={handleUpload}
            />
            <Button
              type="button"
              variant="outline"
              onClick={triggerUpload}
              disabled={busy}
              className={darkMode ? 'bg-gray-700 border-gray-500 text-gray-100 hover:bg-gray-600 hover:text-white hover:border-gray-400' : ''}
            >
              <Upload className="h-4 w-4" />
              Upload New
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={deleteAll}
              disabled={busy || deletableVisibleMedia.length === 0}
              className={cn(
                darkMode
                  ? 'bg-red-950/60 border-red-700 text-red-100 hover:bg-red-900 hover:text-white hover:border-red-500'
                  : 'border-red-200 text-red-600 hover:bg-red-50'
              )}
            >
              <Trash2 className="h-4 w-4" />
              Delete All
            </Button>
          </div>
        </div>

        {description && (
          <p className={cn('text-xs leading-5', darkMode ? 'text-gray-400' : 'text-gray-600')}>
            {description}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {loading ? (
          <div className={cn('flex h-full items-center justify-center text-sm', darkMode ? 'text-gray-400' : 'text-gray-500')}>
            Loading media...
          </div>
        ) : visibleMedia.length === 0 ? (
          <div className={cn('flex h-full min-h-[260px] flex-col items-center justify-center gap-3 rounded border border-dashed text-center',
            darkMode ? 'border-gray-800 text-gray-400' : 'border-gray-300 text-gray-500'
          )}>
            {activeTab === 'image' ? <Image className="h-10 w-10" /> : <Video className="h-10 w-10" />}
            <div>
              <p className="text-sm font-medium">No {activeTab} media yet</p>
              <p className="mt-1 text-xs">Upload a file to add it to the media library.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visibleMedia.map((item) => {
              const selected = selectedId === item.id;
              const source = resolveMediaSource(item);
              return (
                <div
                  key={item.id}
                  className={cn(
                    'group relative overflow-hidden rounded-md border text-left transition',
                    selected
                      ? darkMode ? 'border-green-400 ring-2 ring-green-400/40' : 'border-gray-950 ring-2 ring-gray-950/20'
                      : darkMode ? 'border-gray-800 hover:border-gray-600' : 'border-gray-200 hover:border-gray-400',
                    darkMode ? 'bg-gray-950' : 'bg-white'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className="block w-full text-left"
                  >
                    <div className={cn('aspect-video w-full overflow-hidden', darkMode ? 'bg-gray-900' : 'bg-gray-100')}>
                      {item.type === 'image' ? (
                        <img src={source} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <video src={source} className="h-full w-full object-cover" muted preload="metadata" />
                      )}
                    </div>
                    <div className="min-w-0 px-3 py-2">
                      <p className={cn('truncate text-xs font-medium', darkMode ? 'text-gray-100' : 'text-gray-900')} title={item.name}>
                        {item.name}
                      </p>
                      <p className={cn('mt-0.5 text-[11px]', darkMode ? 'text-gray-500' : 'text-gray-500')}>
                        {item.bundled ? 'Bundled template image' : formatFileSize(item.size)}
                      </p>
                    </div>
                  </button>
                  {!item.bundled && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteMedia(item);
                      }}
                      className={cn(
                        'absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-md opacity-0 shadow transition group-hover:opacity-100',
                        darkMode ? 'bg-gray-950/90 text-red-200 hover:bg-red-950' : 'bg-white/95 text-red-600 hover:bg-red-50'
                      )}
                      aria-label={`Delete ${item.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ModalFooter
        darkMode={darkMode}
        align="between"
        leading={(
          <p className={cn('truncate text-xs', darkMode ? 'text-gray-400' : 'text-gray-500')}>
            {canSelectMedia
              ? (selectedMedia ? selectedMedia.name : 'Select a media item to continue.')
              : `${visibleMedia.length} ${activeTab === 'image' ? 'image' : 'video'}${visibleMedia.length === 1 ? '' : 's'} in library.`}
          </p>
        )}
      >
        <div className="flex shrink-0 items-center gap-3">
          <ModalActionButton
            type="button"
            tone="secondary"
            darkMode={darkMode}
            onClick={() => onClose?.({ dismissed: true })}
          >
            {canSelectMedia ? 'Cancel' : 'Close'}
          </ModalActionButton>
          {canSelectMedia && (
            <ModalActionButton
              type="button"
              tone="primary"
              darkMode={darkMode}
              onClick={proceed}
              disabled={!selectedMedia || busy}
            >
              Use Selected Media
            </ModalActionButton>
          )}
        </div>
      </ModalFooter>
    </div>
  );
};

export default UserMediaModal;
