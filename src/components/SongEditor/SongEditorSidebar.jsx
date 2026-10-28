import React from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, ChevronLeft, ChevronRight, ListOrdered, Minus, Monitor, Plus, RotateCcw, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip } from '@/components/ui/tooltip';
import LyricVisualFrame from '../output/LyricVisualFrame';
import { splitSongCredits } from '../../../shared/lyricsParsing/songMetadata.js';
import { getLineOutputText } from '../../utils/parseLyrics';
import {
  OUTPUT_PREVIEW_RESOLUTIONS,
  formatOutputLabel,
  getLyricsPreviewAnchor,
  placeZoomedOutputPreview,
} from '../../utils/outputLabels';
import { useAllOutputIds, useOutputSettings } from '../../hooks/useStoreSelectors';
import { readPersistentStorageItem, writePersistentStorageItem } from '../../utils/persistentStorage';
import { getEditorSlideCues } from '../../utils/songDocumentEditing';

const PREVIEW_PREFERENCES_KEY = 'lyricdisplay-song-editor-preview';
const PREVIEW_ZOOM_LEVELS = [1, 1.5, 2, 2.5, 3];
const DEFAULT_PREVIEW_ZOOM = 2;

const readPreviewPreferences = () => {
  try {
    const stored = JSON.parse(readPersistentStorageItem(PREVIEW_PREFERENCES_KEY) || '{}');
    return {
      resolutionIndex: OUTPUT_PREVIEW_RESOLUTIONS[stored.resolutionIndex] ? stored.resolutionIndex : 0,
      zoom: PREVIEW_ZOOM_LEVELS.includes(stored.zoom) ? stored.zoom : DEFAULT_PREVIEW_ZOOM,
      outputId: typeof stored.outputId === 'string' ? stored.outputId : 'output1',
    };
  } catch {
    return { resolutionIndex: 0, zoom: DEFAULT_PREVIEW_ZOOM, outputId: 'output1' };
  }
};

const outputChipLabel = (outputId) => /^output(\d+)$/i.exec(outputId)?.[1] || formatOutputLabel(outputId);
const selectTriggerClass = (darkMode) => `h-7 text-xs ${darkMode ? 'border-gray-700 bg-gray-900/60 text-gray-200' : 'border-gray-200 bg-white text-gray-800'}`;
const selectContentClass = (darkMode) => (darkMode ? 'border-gray-700 bg-gray-800 text-gray-200' : 'border-gray-200 bg-white');

const panelClass = (darkMode) => `rounded-xl border p-3 ${darkMode ? 'border-gray-700 bg-gray-800/60' : 'border-gray-200 bg-white'}`;
const headingClass = (darkMode, { spaced = true } = {}) => `${spaced ? 'mb-2 ' : ''}flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] ${darkMode ? 'text-gray-400' : 'text-gray-500'}`;
const fieldClass = (darkMode) => `w-full rounded-md border px-2.5 py-1.5 text-sm outline-none focus:ring-2 ${darkMode
  ? 'border-gray-700 bg-gray-900/60 text-gray-100 placeholder-gray-600 focus:border-blue-500/60 focus:ring-blue-500/15'
  : 'border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:ring-blue-500/10'
  }`;

function DetailField({ label, value, placeholder, onChange, darkMode, inputMode }) {
  return (
    <label className="block">
      <span className={`mb-1 block text-[11px] font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} inputMode={inputMode} className={fieldClass(darkMode)} />
    </label>
  );
}

// Draws the slide with the real output renderer at the chosen screen size, then zooms in
// around where that output places its lyrics so the text is readable in a narrow panel.
function SlidePreview({ slide, outputSettings, resolution, zoom, onZoomChange, darkMode }) {
  const boxRef = React.useRef(null);
  const [box, setBox] = React.useState({ width: 0, height: 0 });
  const [cueIndex, setCueIndex] = React.useState(0);
  const cues = React.useMemo(() => getEditorSlideCues(slide), [slide]);
  const hasText = Boolean(slide?.lines?.some((line) => String(line.text || '').trim()));
  const stageOnly = hasText && cues.length === 0;
  const cue = cues[Math.min(cueIndex, cues.length - 1)] ?? null;
  const text = cue ? getLineOutputText(cue) : '';
  const zoomIndex = PREVIEW_ZOOM_LEVELS.indexOf(zoom);
  const placement = box.width > 0
    ? placeZoomedOutputPreview({
      boxWidth: box.width,
      boxHeight: box.height,
      resolution,
      zoom,
      anchor: getLyricsPreviewAnchor(outputSettings),
    })
    : null;

  React.useEffect(() => setCueIndex(0), [slide?.id]);

  React.useEffect(() => {
    const element = boxRef.current;
    if (!element) return undefined;
    const update = () => setBox({ width: element.clientWidth, height: element.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const zoomButtonClass = 'flex h-6 w-6 items-center justify-center rounded text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-30';

  return (
    <>
      <div
        ref={boxRef}
        className="relative overflow-hidden rounded-lg bg-black"
        style={{ aspectRatio: `${resolution.width} / ${resolution.height}` }}
      >
        {placement && (
          <div
            className="absolute origin-top-left"
            style={{
              left: placement.left,
              top: placement.top,
              width: resolution.width,
              height: resolution.height,
              transform: `scale(${placement.scale})`,
            }}
          >
            <LyricVisualFrame
              line={text}
              currentLine={cue}
              settings={outputSettings}
              visible={Boolean(text)}
              active
              previewMode
              disableAnimations
              frameKey={`${slide?.id || 'none'}_${cueIndex}`}
              label="Song editor preview"
              className="relative h-full w-full overflow-hidden"
            />
          </div>
        )}
        {!hasText && (
          <span className={`absolute inset-0 flex items-center justify-center text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            Select a line to preview its slide
          </span>
        )}
        {stageOnly && (
          <span className="absolute left-2 top-2 rounded bg-violet-500/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-violet-100">
            Stage display only
          </span>
        )}
        <div className="absolute right-1.5 top-1.5 flex items-center rounded-md bg-black/65 ring-1 ring-white/10 backdrop-blur-sm" role="group" aria-label="Preview zoom">
          <button type="button" aria-label="Zoom out" disabled={zoomIndex <= 0} onClick={() => onZoomChange(PREVIEW_ZOOM_LEVELS[zoomIndex - 1])} className={zoomButtonClass}>
            <Minus className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => onZoomChange(zoom === 1 ? DEFAULT_PREVIEW_ZOOM : 1)}
            aria-label={zoom === 1 ? 'Zoom to lyrics' : 'Show the whole screen'}
            className="h-6 min-w-9 px-0.5 text-center font-mono text-[10px] tabular-nums text-white/85 hover:text-white"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" aria-label="Zoom in" disabled={zoomIndex >= PREVIEW_ZOOM_LEVELS.length - 1} onClick={() => onZoomChange(PREVIEW_ZOOM_LEVELS[zoomIndex + 1])} className={zoomButtonClass}>
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>
      {cues.length > 1 && (
        <div className={`mt-1.5 flex items-center justify-between text-[11px] ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          <span>This slide plays as {cues.length} cues</span>
          <span className="flex items-center gap-0.5">
            <button type="button" aria-label="Previous cue" disabled={cueIndex === 0} onClick={() => setCueIndex((index) => index - 1)} className="rounded p-0.5 disabled:opacity-30"><ChevronLeft className="h-3.5 w-3.5" /></button>
            <span className="tabular-nums">{Math.min(cueIndex, cues.length - 1) + 1} / {cues.length}</span>
            <button type="button" aria-label="Next cue" disabled={cueIndex >= cues.length - 1} onClick={() => setCueIndex((index) => index + 1)} className="rounded p-0.5 disabled:opacity-30"><ChevronRight className="h-3.5 w-3.5" /></button>
          </span>
        </div>
      )}
    </>
  );
}

// One row of equal-width chips, so up to six outputs share the panel width without wrapping.
function OutputChips({ outputIds, value, onChange, darkMode }) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <span className={`shrink-0 text-[11px] font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Output</span>
      <div
        role="radiogroup"
        aria-label="Output to preview"
        className={`grid min-w-0 flex-1 gap-0.5 rounded-md p-0.5 ${darkMode ? 'bg-gray-900/70' : 'bg-gray-100'}`}
        style={{ gridTemplateColumns: `repeat(${outputIds.length}, minmax(0, 1fr))` }}
      >
        {outputIds.map((outputId) => {
          const selected = outputId === value;
          return (
            <Tooltip key={outputId} content={formatOutputLabel(outputId)} side="bottom">
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={formatOutputLabel(outputId)}
                onClick={() => onChange(outputId)}
                className={`h-6 min-w-0 truncate rounded px-1 text-xs font-semibold tabular-nums transition-colors ${selected
                  ? 'bg-blue-600 text-white shadow-sm'
                  : darkMode ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-100' : 'text-gray-500 hover:bg-white hover:text-gray-900'
                  }`}
              >
                {outputChipLabel(outputId)}
              </button>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

export default function SongEditorSidebar({
  darkMode,
  metadata,
  onMetadataChange,
  playOrder,
  hasCustomOrder,
  sectionLabels,
  onPlayOrderChange,
  selectedSlide,
  issues,
}) {
  const [preview, setPreview] = React.useState(readPreviewPreferences);
  const updatePreview = (patch) => setPreview((current) => {
    const next = { ...current, ...patch };
    writePersistentStorageItem(PREVIEW_PREFERENCES_KEY, JSON.stringify(next));
    return next;
  });
  const outputIds = useAllOutputIds();
  // A remembered custom output that has since been removed falls back to Output 1.
  const previewOutputId = outputIds.includes(preview.outputId) ? preview.outputId : 'output1';
  const { settings: previewOutputSettings } = useOutputSettings(previewOutputId);
  const resolution = OUTPUT_PREVIEW_RESOLUTIONS[preview.resolutionIndex];
  const writers = Array.isArray(metadata.artists) ? metadata.artists.join(', ') : '';

  const moveOrderEntry = (index, delta) => {
    const next = [...playOrder];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onPlayOrderChange(next);
  };

  return (
    <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto pb-4">
      <div className={panelClass(darkMode)}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className={headingClass(darkMode, { spaced: false })}><Monitor className="h-3.5 w-3.5" /> Slide preview</h3>
          <Select
            value={String(preview.resolutionIndex)}
            onValueChange={(value) => updatePreview({ resolutionIndex: Number(value) })}
          >
            <SelectTrigger aria-label="Preview resolution" className={`${selectTriggerClass(darkMode)} w-auto gap-1 px-2 font-mono tabular-nums`}>
              <SelectValue>{`${resolution.width}×${resolution.height}`}</SelectValue>
            </SelectTrigger>
            <SelectContent align="end" className={selectContentClass(darkMode)}>
              {OUTPUT_PREVIEW_RESOLUTIONS.map((option, index) => (
                <SelectItem key={option.label} value={String(index)}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <SlidePreview
          slide={selectedSlide}
          outputSettings={previewOutputSettings}
          resolution={resolution}
          zoom={preview.zoom}
          onZoomChange={(zoom) => updatePreview({ zoom })}
          darkMode={darkMode}
        />
        <OutputChips
          outputIds={outputIds}
          value={previewOutputId}
          onChange={(outputId) => updatePreview({ outputId })}
          darkMode={darkMode}
        />
      </div>

      <div className={panelClass(darkMode)}>
        <h3 className={headingClass(darkMode)}><ListOrdered className="h-3.5 w-3.5" /> Play order</h3>
        <p className={`mb-2 text-[11px] leading-snug ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          The order sections appear in the control panel when this song is loaded. Write a chorus once, then repeat it here instead of typing it again.
        </p>
        {playOrder.length === 0 ? (
          <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Name your sections to arrange the order they play in.</p>
        ) : (
          <ol className="space-y-1">
            {playOrder.map((label, index) => (
              <li key={`${label}_${index}`} className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs ${darkMode ? 'bg-gray-900/50 text-gray-200' : 'bg-gray-50 text-gray-700'}`}>
                <span className={`w-5 shrink-0 font-mono text-[10px] tabular-nums ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{String(index + 1).padStart(2, '0')}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
                {hasCustomOrder && (
                  <>
                    <button type="button" aria-label="Move earlier" onClick={() => moveOrderEntry(index, -1)} className="rounded p-0.5 opacity-60 hover:opacity-100"><ArrowUp className="h-3 w-3" /></button>
                    <button type="button" aria-label="Move later" onClick={() => moveOrderEntry(index, 1)} className="rounded p-0.5 opacity-60 hover:opacity-100"><ArrowDown className="h-3 w-3" /></button>
                    <button type="button" aria-label="Remove from play order" onClick={() => onPlayOrderChange(playOrder.filter((_, entry) => entry !== index))} className="rounded p-0.5 opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
                  </>
                )}
              </li>
            ))}
          </ol>
        )}
        {sectionLabels.length > 0 && (
          <div className="mt-2">
            {/* Stays on its placeholder so the same section can be added again and again. */}
            <Select value="" onValueChange={(label) => onPlayOrderChange([...playOrder, label])}>
              <SelectTrigger aria-label="Add a section to the play order" className={selectTriggerClass(darkMode)}>
                <SelectValue placeholder="Add a section to the end…" />
              </SelectTrigger>
              <SelectContent className={selectContentClass(darkMode)}>
                {sectionLabels.map((label) => <SelectItem key={label} value={label}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {hasCustomOrder && (
          <button type="button" onClick={() => onPlayOrderChange(null)} className={`mt-2 inline-flex items-center gap-1 text-[11px] font-medium ${darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-800'}`}>
            <RotateCcw className="h-3 w-3" /> Play sections in the order written
          </button>
        )}
      </div>

      <div className={panelClass(darkMode)}>
        <h3 className={headingClass(darkMode)}>Song details</h3>
        <div className="space-y-2">
          <DetailField darkMode={darkMode} label="Writers" value={writers} placeholder="e.g. John Newton, Edwin Excell" onChange={(value) => onMetadataChange({ artists: splitSongCredits(value) })} />
          <DetailField darkMode={darkMode} label="Copyright" value={metadata.copyright || ''} placeholder="e.g. 2004 Example Music" onChange={(value) => onMetadataChange({ copyright: value })} />
          <DetailField darkMode={darkMode} label="Administrator" value={metadata.administrator || ''} placeholder="Optional" onChange={(value) => onMetadataChange({ administrator: value })} />
          <DetailField darkMode={darkMode} label="CCLI Song #" inputMode="numeric" value={metadata.ccliSongNumber || ''} placeholder="e.g. 22025" onChange={(value) => onMetadataChange({ ccliSongNumber: value.replace(/\D/g, '').slice(0, 12) })} />
        </div>
        <p className={`mt-2 text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Shown by outputs with Song Credits turned on.</p>
      </div>

      <div className={panelClass(darkMode)}>
        <h3 className={headingClass(darkMode)}>Song check</h3>
        {issues.length === 0 ? (
          <p className={`flex items-center gap-1.5 text-xs ${darkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Every slide will display as written.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {issues.map((issue, index) => (
              <li key={index} className={`flex gap-1.5 text-xs ${darkMode ? 'text-amber-200' : 'text-amber-800'}`}>
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
