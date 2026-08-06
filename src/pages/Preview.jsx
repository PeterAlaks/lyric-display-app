import React from 'react';
import { LayoutGrid, RefreshCw } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import ProjectionExitHint from '@/components/ProjectionExitHint';
import useSocket from '@/hooks/useSocket';
import { useCustomOutputIds, usePreviewSettings } from '@/hooks/useStoreSelectors';
import { formatOutputLabel } from '@/utils/outputLabels';
import { createPreviewUrl } from '@/integrations/sourceUrls';
import {
  DEFAULT_PREVIEW_SETTINGS,
  getAvailablePreviewItemIds,
  normalizePreviewSettings,
  resolvePreviewItemOrder,
} from '../../shared/previewSettings.js';

const PREVIEW_SIZES = {
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
};

const chunkRows = (itemIds, maxItemsPerRow = 3) => {
  const rows = [];
  for (let offset = 0; offset < itemIds.length; offset += maxItemsPerRow) {
    rows.push(itemIds.slice(offset, offset + maxItemsPerRow));
  }
  return rows;
};

const createPreviewRows = (itemIds, gridStyle) => {
  if (gridStyle !== 'featured' || itemIds.length < 2) {
    return chunkRows(itemIds).map((items) => ({ items, columns: 3 }));
  }

  return [
    { items: itemIds.slice(0, 2), columns: 2 },
    ...chunkRows(itemIds.slice(2)).map((items) => ({ items, columns: 3 })),
  ];
};

const PreviewTile = ({ itemId, refreshKey, resolution, showLabel, showRoutePath }) => {
  const containerRef = React.useRef(null);
  const iframeRef = React.useRef(null);
  const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return undefined;

    let frameId = null;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        const width = Math.round(entry.contentRect.width);
        const height = Math.round(entry.contentRect.height);
        setDimensions((current) => (
          current.width === width && current.height === height ? current : { width, height }
        ));
      });
    });
    observer.observe(container);

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, []);

  React.useEffect(() => {
    setLoaded(false);
  }, [itemId, refreshKey, resolution.height, resolution.width]);

  React.useEffect(() => () => {
    if (!iframeRef.current) return;
    try { iframeRef.current.src = 'about:blank'; } catch { }
  }, []);

  const scale = dimensions.width && dimensions.height
    ? Math.min(dimensions.width / resolution.width, dimensions.height / resolution.height)
    : 0;
  const scaledWidth = resolution.width * scale;
  const scaledHeight = resolution.height * scale;

  return (
    <article
      ref={containerRef}
      className="relative min-h-0 overflow-hidden rounded-xl border border-white/20 bg-black"
    >
      {showLabel && (
        <div className="absolute left-2 top-2 z-20 max-w-[calc(100%-1rem)] rounded-[5px] border border-white/15 bg-slate-950/55 px-2 py-1 shadow-[0_4px_16px_rgba(0,0,0,0.25)] backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_7px_rgba(103,232,249,0.65)]" />
            <span className="truncate text-[11px] font-semibold tracking-wide text-white">
              {formatOutputLabel(itemId)}
            </span>
          </div>
          {showRoutePath && (
            <div className="truncate pl-3 text-[8px] leading-3 text-slate-300/70">/{itemId}?preview=true</div>
          )}
        </div>
      )}

      {scale > 0 && (
        <div
          className="absolute left-1/2 top-1/2 overflow-hidden"
          style={{
            width: `${scaledWidth}px`,
            height: `${scaledHeight}px`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <iframe
            ref={iframeRef}
            key={`${itemId}-${refreshKey}-${resolution.width}`}
            src={createPreviewUrl(itemId) || undefined}
            title={`${formatOutputLabel(itemId)} preview`}
            onLoad={() => setLoaded(true)}
            style={{
              width: `${resolution.width}px`,
              height: `${resolution.height}px`,
              border: 0,
              display: 'block',
              pointerEvents: 'none',
              transform: `scale(${scale})`,
              transformOrigin: '0 0',
            }}
          />
        </div>
      )}

      {!loaded && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#05080d]">
          <RefreshCw className="h-5 w-5 animate-spin text-slate-600" />
        </div>
      )}
    </article>
  );
};

const Preview = () => {
  const location = useLocation();
  const customOutputIds = useCustomOutputIds();
  const { connectionStatus, isConnected } = useSocket('output-discovery', {
    preview: true,
    purpose: 'preview',
  });
  const storedSettings = usePreviewSettings();
  const settings = React.useMemo(
    () => normalizePreviewSettings(storedSettings || DEFAULT_PREVIEW_SETTINGS),
    [storedSettings]
  );
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [now, setNow] = React.useState(() => new Date());

  const searchParams = React.useMemo(() => new URLSearchParams(location.search), [location.search]);
  const showProjectionExitHint = ['1', 'true'].includes(
    (searchParams.get('escapeHint') || '').toLowerCase()
  );

  React.useEffect(() => {
    if (!settings.showHeader) return undefined;
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, [settings.showHeader]);

  const availableItemIds = React.useMemo(
    () => getAvailablePreviewItemIds(customOutputIds),
    [customOutputIds]
  );
  const itemIds = React.useMemo(
    () => resolvePreviewItemOrder(settings.order, availableItemIds),
    [availableItemIds, settings.order]
  );
  const previewRows = React.useMemo(
    () => createPreviewRows(itemIds, settings.gridStyle),
    [itemIds, settings.gridStyle]
  );
  const resolution = PREVIEW_SIZES[settings.previewResolution] || PREVIEW_SIZES['720p'];
  const gapClassName = settings.gap === 'compact' ? 'gap-1.5 p-1.5' : 'gap-3 p-3';
  const rowGapClassName = settings.gap === 'compact' ? 'gap-1.5' : 'gap-3';
  const connectionLabel = isConnected
    ? 'Connected'
    : (connectionStatus === 'connecting' ? 'Connecting' : 'Reconnecting');

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden bg-[#050810] font-sans text-white">
      {settings.showHeader && (
        <header className="flex h-14 shrink-0 items-center gap-4 border-b border-white/10 bg-[#0a0f19] px-4 shadow-lg">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/10">
              <LayoutGrid className="h-4 w-4 text-cyan-300" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold tracking-wide text-slate-100">LyricDisplay Preview</h1>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-emerald-400' : 'animate-pulse bg-amber-400'}`} />
                <span>{connectionLabel}</span>
                <span aria-hidden="true">·</span>
                <span>{itemIds.length} {itemIds.length === 1 ? 'feed' : 'feeds'}</span>
              </div>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <time className="text-right tabular-nums">
              <div className="text-sm font-semibold text-slate-200">
                {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div className="text-[9px] uppercase tracking-[0.16em] text-slate-500">
                {now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
            </time>
            <button
              type="button"
              onClick={() => setRefreshKey((current) => current + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Refresh all previews"
              title="Refresh all previews"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </header>
      )}

      <section
        className={`flex min-h-0 flex-1 flex-col ${gapClassName}`}
        aria-label="Output previews"
      >
        {previewRows.map((row) => (
          <div
            key={row.items.join(':')}
            className={`grid min-h-0 flex-1 ${rowGapClassName}`}
            style={{ gridTemplateColumns: `repeat(${row.columns}, minmax(0, 1fr))` }}
          >
            {row.items.map((itemId) => (
              <PreviewTile
                key={itemId}
                itemId={itemId}
                refreshKey={refreshKey}
                resolution={resolution}
                showLabel={settings.showLabels}
                showRoutePath={settings.showRoutePaths}
              />
            ))}
          </div>
        ))}
      </section>

      <ProjectionExitHint visible={showProjectionExitHint} />
    </main>
  );
};

export default Preview;
