import React from 'react';
import { AlertTriangle, CheckCircle2, Monitor, MonitorUp, Network, Power, Tv2, Radio, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import useToast from '@/hooks/useToast';
import useLyricsStore from '@/context/LyricsStore';
import { formatOutputLabel } from '@/utils/outputLabels';
import { cn } from '@/lib/utils';
import { ModalActionButton, ModalFooter } from '@/components/modal/modalActions';
import { DEFAULT_OUTPUT_IDS } from '../../shared/outputRegistry.js';

const DESKTOP_TARGET = 'desktop';
const PROJECTION_SYNC_CHANNEL = 'lyricdisplay-projection-state';

const toDisplayId = (value) => {
  if (value === null || typeof value === 'undefined') return null;
  const num = Number(value);
  return Number.isNaN(num) ? value : num;
};

const displayLabel = (display, fallbackIndex = 0) => {
  if (!display) return `Display ${fallbackIndex + 1}`;
  const baseName = display.name || display.label || `Display ${fallbackIndex + 1}`;
  const width = display?.bounds?.width;
  const height = display?.bounds?.height;
  if (width && height) return `${baseName} (${width}×${height})`;
  return baseName;
};

const projectionTargetValue = (projection) => {
  if (!projection) return null;
  if (projection.targetType === 'desktop') return DESKTOP_TARGET;
  if (projection.displayId === null || typeof projection.displayId === 'undefined') return null;
  return String(projection.displayId);
};

const projectionTargetLabel = (projection) => {
  if (!projection) return 'Unknown';
  if (projection.targetType === 'desktop') return 'This Monitor';
  return projection.displayName || 'External Display';
};

const outputHint = (value, option = {}) => {
  if (option.hint) return option.hint;
  if (value === 'lyric-video-studio') return 'Live studio preview';
  if (value === 'stage') return 'Presenter view';
  if (value === 'time') return 'Clock and timer';
  if (value === 'output1') return 'Main lyrics display';
  if (value === 'output2') return 'Alternate lyrics display';
  return 'Custom lyrics display';
};

const outputIcon = (value) => {
  if (value === 'stage') return Radio;
  if (value === 'time') return Monitor;
  if (value === 'lyric-video-studio') return MonitorUp;
  return Tv2;
};

/* ─── Section header ──────────────────────────────────────── */
function SectionHeader({ icon: Icon, label, aside, darkMode }) {
  const d = darkMode;
  return (
    <div className={cn(
      'sticky top-0 z-10 flex items-center gap-1.5 border-b px-3 py-2.5',
      d ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'
    )}>
      <Icon className={cn('h-3.5 w-3.5', d ? 'text-gray-500' : 'text-gray-400')} />
      <span className={cn('text-[10px] font-semibold uppercase tracking-widest', d ? 'text-gray-400' : 'text-gray-500')}>{label}</span>
      {aside && <div className="ml-auto">{aside}</div>}
    </div>
  );
}

/* ─── Live badge ──────────────────────────────────────────── */
function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-500 ring-1 ring-inset ring-emerald-500/25">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      Live
    </span>
  );
}

/* ─── Main component ──────────────────────────────────────── */
const ProjectOutputModal = ({
  darkMode,
  onClose,
  preferredDisplayId = null,
  triggerSource = 'manual',
  detectedDisplays = [],
  onOpenIntegrationGuide,
  initialOutputKey = null,
  extraOutputOptions = [],
}) => {
  const { showToast } = useToast();
  const customOutputIds = useLyricsStore((state) => state.customOutputIds || []);
  const syncSenderIdRef = React.useRef(`projection-modal-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const outputOptions = React.useMemo(() => {
    const baseOptions = [...DEFAULT_OUTPUT_IDS, ...customOutputIds, 'stage', 'time']
      .map((value) => ({ value, label: formatOutputLabel(value) }));
    const byValue = new Map(baseOptions.map((option) => [option.value, option]));

    extraOutputOptions.forEach((option) => {
      if (!option?.value) return;
      byValue.set(option.value, {
        ...option,
        label: option.label || formatOutputLabel(option.value),
      });
    });

    return Array.from(byValue.values());
  }, [customOutputIds, extraOutputOptions]);

  const [selectedOutput, setSelectedOutput] = React.useState(initialOutputKey || outputOptions[0]?.value || 'output1');
  const [selectedTarget, setSelectedTarget] = React.useState(DESKTOP_TARGET);
  const [externalDisplays, setExternalDisplays] = React.useState([]);
  const [projections, setProjections] = React.useState([]);
  const [loadingState, setLoadingState] = React.useState(false);
  const [isProjecting, setIsProjecting] = React.useState(false);
  const [stoppingOutputKey, setStoppingOutputKey] = React.useState(null);

  React.useEffect(() => {
    if (!outputOptions.some((o) => o.value === selectedOutput)) {
      setSelectedOutput(outputOptions[0]?.value || 'output1');
    }
  }, [outputOptions, selectedOutput]);

  const loadProjectionState = React.useCallback(async ({ excludedOutputKeys = [] } = {}) => {
    if (!window?.electronAPI?.display) return;
    setLoadingState(true);
    try {
      const result = await window.electronAPI.display.getProjectionState();
      if (!result?.success) return;
      const externals = Array.isArray(result.externalDisplays)
        ? result.externalDisplays
        : (Array.isArray(result.displays) ? result.displays.filter((d) => !d.primary) : []);
      const excluded = new Set(excludedOutputKeys);
      const nextProjections = (Array.isArray(result.projections) ? result.projections : [])
        .filter((e) => e?.outputKey && !excluded.has(e.outputKey));
      setExternalDisplays(externals);
      setProjections(nextProjections);
      return { projections: nextProjections, externalDisplays: externals };
    } catch (err) {
      console.warn('Failed to load projection state:', err);
    } finally {
      setLoadingState(false);
    }
  }, []);

  React.useEffect(() => { loadProjectionState(); }, [loadProjectionState]);

  const notifyProjectionStateChanged = React.useCallback(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    try {
      const channel = new BroadcastChannel(PROJECTION_SYNC_CHANNEL);
      channel.postMessage({
        type: 'projection-state-changed',
        senderId: syncSenderIdRef.current,
        sentAt: Date.now(),
      });
      channel.close();
    } catch { }
  }, []);

  React.useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return undefined;
    const channel = new BroadcastChannel(PROJECTION_SYNC_CHANNEL);
    channel.onmessage = (event) => {
      if (
        event?.data?.type === 'projection-state-changed'
        && event.data.senderId !== syncSenderIdRef.current
      ) {
        loadProjectionState();
      }
    };
    return () => channel.close();
  }, [loadProjectionState]);

  React.useEffect(() => {
    const refreshOnWindowActive = () => loadProjectionState();
    const refreshOnVisible = () => {
      if (document.visibilityState === 'visible') {
        loadProjectionState();
      }
    };

    window.addEventListener('focus', refreshOnWindowActive);
    document.addEventListener('visibilitychange', refreshOnVisible);
    return () => {
      window.removeEventListener('focus', refreshOnWindowActive);
      document.removeEventListener('visibilitychange', refreshOnVisible);
    };
  }, [loadProjectionState]);

  React.useEffect(() => {
    if (!preferredDisplayId) return;
    if (!externalDisplays.some((d) => String(d.id) === String(preferredDisplayId))) return;
    setSelectedTarget(String(preferredDisplayId));
  }, [preferredDisplayId, externalDisplays]);

  const activeProjection = React.useMemo(
    () => projections.find((e) => e.outputKey === selectedOutput) || null,
    [projections, selectedOutput]
  );

  React.useEffect(() => {
    if (!activeProjection) return;
    const next = activeProjection.targetType === 'display' && activeProjection.displayId !== null
      ? String(activeProjection.displayId)
      : DESKTOP_TARGET;
    setSelectedTarget((prev) => (prev === next ? prev : next));
  }, [activeProjection]);

  const targetOptions = React.useMemo(() => {
    const base = [{ value: DESKTOP_TARGET, label: 'This Monitor', sub: 'Fullscreen · press Esc to exit', icon: Monitor }];
    externalDisplays.forEach((display, i) => {
      base.push({ value: String(display.id), label: displayLabel(display, i), sub: 'External display', icon: Tv2 });
    });
    return base;
  }, [externalDisplays]);

  const selectedTargetInfo = React.useMemo(
    () => targetOptions.find((o) => o.value === selectedTarget) || targetOptions[0],
    [targetOptions, selectedTarget]
  );

  React.useEffect(() => {
    if (!targetOptions.some((o) => o.value === selectedTarget)) setSelectedTarget(DESKTOP_TARGET);
  }, [selectedTarget, targetOptions]);

  const activeProjections = React.useMemo(
    () => projections.filter((e) => e && e.outputKey),
    [projections]
  );

  const targetOccupant = React.useMemo(() => (
    activeProjections.find((e) => e.outputKey !== selectedOutput && projectionTargetValue(e) === selectedTarget) || null
  ), [activeProjections, selectedOutput, selectedTarget]);

  const isActiveOnSelectedTarget = React.useMemo(() => (
    Boolean(activeProjection) && projectionTargetValue(activeProjection) === selectedTarget
  ), [activeProjection, selectedTarget]);

  const showProjectAction = !activeProjection || !isActiveOnSelectedTarget;
  const isStopping = Boolean(stoppingOutputKey);

  const projectActionLabel = React.useMemo(() => {
    if (isProjecting) return 'Starting…';
    const ol = formatOutputLabel(selectedOutput);
    const tl = selectedTargetInfo?.label || 'Target';
    if (targetOccupant && activeProjection) return `Replace & Move ${ol}`;
    if (targetOccupant) return `Replace with ${ol}`;
    if (activeProjection) return `Move to ${tl}`;
    return `Project to ${tl}`;
  }, [isProjecting, targetOccupant, activeProjection, selectedOutput, selectedTargetInfo]);

  const handleProject = async () => {
    if (!window?.electronAPI?.display?.projectOutput) {
      showToast({ title: 'Projection unavailable', message: 'Display projection API is not available.', variant: 'error' });
      return;
    }
    setIsProjecting(true);
    try {
      const payload = {
        outputKey: selectedOutput,
        targetType: selectedTarget === DESKTOP_TARGET ? 'desktop' : 'display',
        displayId: selectedTarget === DESKTOP_TARGET ? null : toDisplayId(selectedTarget),
      };
      const result = await window.electronAPI.display.projectOutput(payload);
      if (!result?.success) throw new Error(result?.error || 'Could not start projection.');
      const displaced = result?.displacedOutputKey || null;
      showToast({
        title: 'Projecting',
        message: `${formatOutputLabel(selectedOutput)} → ${selectedTargetInfo?.label || 'target'}.${displaced ? ` ${formatOutputLabel(displaced)} was turned off.` : ''}`,
        variant: 'success',
      });
      const nextState = await loadProjectionState();
      notifyProjectionStateChanged();
      if (!activeProjection && nextState?.projections) {
        const projected = new Set(nextState.projections.map((e) => e.outputKey));
        const nextOutput = outputOptions.find((o) => !projected.has(o.value));
        if (nextOutput?.value) setSelectedOutput(nextOutput.value);
      }
    } catch (err) {
      showToast({ title: 'Projection failed', message: err?.message || 'Could not start projection.', variant: 'error' });
      await loadProjectionState();
    } finally {
      setIsProjecting(false);
    }
  };

  const handleStopProjection = async (outputKey = selectedOutput) => {
    if (!window?.electronAPI?.display?.stopProjection) {
      showToast({ title: 'Unavailable', message: 'Display projection API is not available.', variant: 'error' });
      return;
    }
    setStoppingOutputKey(outputKey);
    try {
      const result = await window.electronAPI.display.stopProjection({ outputKey });
      if (!result?.success) throw new Error(result?.error || 'Could not stop projection.');
      showToast({ title: 'Output stopped', message: `${formatOutputLabel(outputKey)} has been turned off.`, variant: 'success' });
      setProjections((cur) => cur.filter((e) => e?.outputKey !== outputKey));
      await loadProjectionState({ excludedOutputKeys: [outputKey] });
      notifyProjectionStateChanged();
    } catch (err) {
      showToast({ title: 'Stop failed', message: err?.message || 'Could not stop projection.', variant: 'error' });
    } finally {
      setStoppingOutputKey(null);
    }
  };

  const detectionBanner = triggerSource !== 'manual' && Array.isArray(detectedDisplays) && detectedDisplays.length > 0;
  const d = darkMode;

  return (
    <div
      className="flex min-h-0 flex-col"
      style={{
        height: 'min(560px, calc(100vh - var(--top-menu-height, 0px) - 190px))',
        maxHeight: 'calc(100vh - var(--top-menu-height, 0px) - 190px)',
      }}
    >
      {/* Scrollable body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">

        {/* Detection banner */}
        {detectionBanner && (
          <div className={cn(
            'flex items-start gap-3 rounded-xl px-4 py-3 border',
            d ? 'bg-blue-500/10 border-blue-500/20 text-blue-200' : 'bg-blue-50 border-blue-100 text-blue-800'
          )}>
            <Monitor className={cn('mt-0.5 h-4 w-4 shrink-0', d ? 'text-blue-400' : 'text-blue-600')} />
            <div>
              <p className="text-sm font-semibold">
                {detectedDisplays.length > 1 ? `${detectedDisplays.length} External Displays Found` : 'External Display Found'}
              </p>
              <p className={cn('mt-0.5 text-xs leading-relaxed', d ? 'text-blue-300/80' : 'text-blue-600')}>
                {detectedDisplays.length > 1
                  ? 'Pick what to show and choose a destination for each.'
                  : 'Pick what to show, then select the detected display as the destination.'}
              </p>
            </div>
          </div>
        )}

        {/* Output + Destination columns */}
        <div className="grid grid-cols-2 gap-3">
          {/* ── Output ── */}
          <div className={cn('rounded-xl border overflow-hidden', d ? 'border-gray-800 bg-gray-900/60' : 'border-gray-200 bg-white')}>
            <div className="max-h-72 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
              <SectionHeader
                icon={MonitorUp}
                label="Output"
                darkMode={d}
                aside={activeProjection ? <LiveBadge /> : null}
              />
              <div className="p-2 space-y-1">
                {outputOptions.map((option) => {
                  const isSelected = option.value === selectedOutput;
                  const projection = activeProjections.find((e) => e.outputKey === option.value);
                  const Icon = outputIcon(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSelectedOutput(option.value)}
                      className={cn(
                        'w-full rounded-lg border px-3 py-2.5 text-left transition-all duration-150 group',
                        isSelected
                          ? d
                            ? 'border-blue-500/50 bg-blue-500/10 ring-1 ring-blue-500/20'
                            : 'border-blue-300 bg-blue-50/80 ring-1 ring-blue-100'
                          : d
                          ? 'border-gray-800 bg-gray-900/30 hover:border-gray-700 hover:bg-gray-900/60'
                          : 'border-gray-100 bg-gray-50/50 hover:border-gray-200 hover:bg-white'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={cn('h-3.5 w-3.5 shrink-0',
                          isSelected
                            ? d ? 'text-blue-400' : 'text-blue-600'
                            : d ? 'text-gray-600' : 'text-gray-400'
                        )} />
                        <span className={cn('flex-1 truncate text-xs font-semibold',
                          isSelected ? (d ? 'text-blue-200' : 'text-blue-800') : (d ? 'text-gray-200' : 'text-gray-700')
                        )}>
                          {option.label}
                        </span>
                        {isSelected && <CheckCircle2 className={cn('h-3.5 w-3.5 shrink-0', d ? 'text-blue-400' : 'text-blue-500')} />}
                      </div>
                      <p className={cn('mt-0.5 pl-5.5 text-[10px]', d ? 'text-gray-600' : 'text-gray-400')}>
                        {projection ? `Live → ${projectionTargetLabel(projection)}` : outputHint(option.value, option)}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Destination ── */}
          <div className={cn('rounded-xl border overflow-hidden', d ? 'border-gray-800 bg-gray-900/60' : 'border-gray-200 bg-white')}>
            <div className="max-h-72 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
              <SectionHeader icon={Monitor} label="Destination" darkMode={d} />
              <div className="p-2 space-y-1">
                {targetOptions.map((option) => {
                  const isSelected = option.value === selectedTarget;
                  const occupant = activeProjections.find((e) => projectionTargetValue(e) === option.value);
                  const selectedOutputOwnsTarget = occupant?.outputKey === selectedOutput;
                  const Icon = option.icon || Monitor;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSelectedTarget(option.value)}
                      className={cn(
                        'w-full rounded-lg border px-3 py-2.5 text-left transition-all duration-150',
                        isSelected
                          ? d
                            ? 'border-violet-500/50 bg-violet-500/10 ring-1 ring-violet-500/20'
                            : 'border-violet-300 bg-violet-50/80 ring-1 ring-violet-100'
                          : d
                          ? 'border-gray-800 bg-gray-900/30 hover:border-gray-700 hover:bg-gray-900/60'
                          : 'border-gray-100 bg-gray-50/50 hover:border-gray-200 hover:bg-white'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={cn('h-3.5 w-3.5 shrink-0',
                          isSelected
                            ? d ? 'text-violet-400' : 'text-violet-600'
                            : d ? 'text-gray-600' : 'text-gray-400'
                        )} />
                        <span className={cn('flex-1 truncate text-xs font-semibold',
                          isSelected ? (d ? 'text-violet-200' : 'text-violet-800') : (d ? 'text-gray-200' : 'text-gray-700')
                        )}>
                          {option.label}
                        </span>
                        {isSelected && <CheckCircle2 className={cn('h-3.5 w-3.5 shrink-0', d ? 'text-violet-400' : 'text-violet-500')} />}
                      </div>
                      <p className={cn('mt-0.5 pl-5.5 text-[10px]', d ? 'text-gray-600' : 'text-gray-400')}>
                        {option.sub}
                      </p>
                      {occupant && (
                        <div className={cn(
                          'mt-1.5 flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium',
                          selectedOutputOwnsTarget
                            ? (d ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-700')
                            : (d ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-700')
                        )}>
                          {selectedOutputOwnsTarget
                            ? <CheckCircle2 className="h-3 w-3 shrink-0" />
                            : <AlertTriangle className="h-3 w-3 shrink-0" />}
                          <span className="truncate">
                            {selectedOutputOwnsTarget
                              ? 'Currently showing this output'
                              : `In use by: ${formatOutputLabel(occupant.outputKey)}`}
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Conflict warning */}
        {targetOccupant && (
          <div className={cn(
            'flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-xs border',
            d ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' : 'bg-amber-50 border-amber-100 text-amber-700'
          )}>
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              <strong>{formatOutputLabel(targetOccupant.outputKey)}</strong> is already using this destination and will be replaced by <strong>{formatOutputLabel(selectedOutput)}</strong>.
            </span>
          </div>
        )}

        {/* Active projections */}
        {activeProjections.length > 0 && (
          <div className={cn('rounded-xl border overflow-hidden', d ? 'border-gray-800' : 'border-gray-200')}>
            <div className={cn('flex items-center gap-2 px-3.5 py-2.5 border-b', d ? 'bg-gray-900 border-gray-800' : 'bg-gray-50 border-gray-100')}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className={cn('text-[10px] font-semibold uppercase tracking-widest', d ? 'text-gray-400' : 'text-gray-500')}>
                Live Outputs
              </span>
              {loadingState && <Loader2 className={cn('ml-1 h-3 w-3 animate-spin', d ? 'text-gray-600' : 'text-gray-400')} />}
            </div>
            <div className={cn('flex flex-wrap gap-2 p-3', d ? 'bg-gray-900/40' : 'bg-white')}>
              {activeProjections.map((entry) => {
                const isSel = entry.outputKey === selectedOutput;
                const isStopping2 = stoppingOutputKey === entry.outputKey;
                return (
                  <div
                    key={`${entry.outputKey}-${entry.windowId || entry.displayId || entry.targetType}`}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs',
                      isSel
                        ? d ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : d ? 'border-gray-800 bg-gray-900/60 text-gray-400' : 'border-gray-200 bg-gray-50 text-gray-600'
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedOutput(entry.outputKey)}
                      className="flex items-center gap-1.5"
                    >
                      <MonitorUp className="h-3.5 w-3.5 shrink-0" />
                      <span className="font-medium">{formatOutputLabel(entry.outputKey)}</span>
                      <span className={cn('text-[10px]', d ? 'text-gray-600' : 'text-gray-400')}>
                        → {projectionTargetLabel(entry)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStopProjection(entry.outputKey)}
                      disabled={isProjecting || isStopping}
                      className={cn(
                        'ml-0.5 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors disabled:opacity-40',
                        d ? 'text-rose-400 hover:bg-rose-500/15' : 'text-rose-600 hover:bg-rose-50'
                      )}
                    >
                      {isStopping2 ? 'Stopping…' : <><Power className="h-2.5 w-2.5" /> Off</>}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeProjections.length === 0 && !loadingState && (
          <div className={cn(
            'rounded-xl border border-dashed px-4 py-4 text-center',
            d ? 'border-gray-800 text-gray-600' : 'border-gray-200 text-gray-400'
          )}>
            <MonitorUp className="w-5 h-5 mx-auto mb-1.5 opacity-40" />
            <p className="text-xs">No outputs are projecting yet</p>
          </div>
        )}

        {/* Integration callout */}
        <div className={cn(
          'flex items-center gap-3 rounded-xl border px-4 py-3',
          d ? 'border-cyan-500/20 bg-cyan-500/5' : 'border-cyan-100 bg-cyan-50'
        )}>
          <Network className={cn('h-4 w-4 shrink-0', d ? 'text-cyan-400' : 'text-cyan-600')} />
          <div className="flex-1 min-w-0">
            <p className={cn('text-xs font-semibold', d ? 'text-cyan-300' : 'text-cyan-900')}>Using OBS, vMix, or Wirecast?</p>
            <p className={cn('text-[10px] mt-0.5', d ? 'text-cyan-400/70' : 'text-cyan-600')}>Use a browser source for production software.</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onOpenIntegrationGuide?.()}
            className={cn(
              'shrink-0 text-xs h-8',
              d ? 'border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/15 bg-transparent' : 'border-cyan-200 text-cyan-700 hover:bg-cyan-100'
            )}
          >
            Guide
          </Button>
        </div>
      </div>

      {/* Footer */}
      <ModalFooter darkMode={d} align="between" className="px-5">
        <ModalActionButton
          type="button"
          tone="secondary"
          darkMode={d}
          onClick={() => onClose?.({ dismissed: true })}
        >
          Close
        </ModalActionButton>

        <div className="flex items-center gap-2">
          {activeProjection && (
            <ModalActionButton
              type="button"
              tone="destructive"
              darkMode={d}
              onClick={() => handleStopProjection(selectedOutput)}
              disabled={isStopping || isProjecting}
              className="gap-1.5"
            >
              <Power className="h-3.5 w-3.5" />
              {stoppingOutputKey === selectedOutput ? 'Stopping…' : 'Turn Off'}
            </ModalActionButton>
          )}
          {showProjectAction && (
            <ModalActionButton
              type="button"
              tone="primary"
              darkMode={d}
              onClick={handleProject}
              disabled={isProjecting || isStopping}
              className="gap-1.5"
            >
              {isProjecting
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <MonitorUp className="h-3.5 w-3.5" />}
              {projectActionLabel}
            </ModalActionButton>
          )}
        </div>
      </ModalFooter>
    </div>
  );
};

export default ProjectOutputModal;
