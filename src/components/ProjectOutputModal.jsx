import React from 'react';
import { AlertTriangle, CheckCircle2, Monitor, Network, Projector, Power, ScreenShare, Tv2, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import useToast from '@/hooks/useToast';
import useLyricsStore from '@/context/LyricsStore';
import { formatOutputLabel } from '@/utils/outputLabels';
import { cn } from '@/lib/utils';

const DESKTOP_TARGET = 'desktop';

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
  if (!projection) return 'Unknown target';
  if (projection.targetType === 'desktop') return 'This Monitor';
  return projection.displayName || 'External Display';
};

const outputHint = (value) => {
  if (value === 'stage') return 'Presenter view';
  if (value === 'time') return 'Clock and timer';
  if (value === 'output1') return 'Main lyrics display';
  if (value === 'output2') return 'Alternate lyrics display';
  return 'Custom lyrics display';
};

const outputIcon = (value) => {
  if (value === 'stage') return Radio;
  if (value === 'time') return Monitor;
  return Tv2;
};

const ProjectOutputModal = ({
  darkMode,
  onClose,
  preferredDisplayId = null,
  triggerSource = 'manual',
  detectedDisplays = [],
  onOpenIntegrationGuide,
}) => {
  const { showToast } = useToast();
  const customOutputIds = useLyricsStore((state) => state.customOutputIds || []);

  const outputOptions = React.useMemo(() => {
    const options = ['output1', 'output2', ...customOutputIds, 'stage', 'time'];
    return options.map((value) => ({ value, label: formatOutputLabel(value) }));
  }, [customOutputIds]);

  const [selectedOutput, setSelectedOutput] = React.useState(outputOptions[0]?.value || 'output1');
  const [selectedTarget, setSelectedTarget] = React.useState(DESKTOP_TARGET);
  const [externalDisplays, setExternalDisplays] = React.useState([]);
  const [projections, setProjections] = React.useState([]);
  const [loadingState, setLoadingState] = React.useState(false);
  const [isProjecting, setIsProjecting] = React.useState(false);
  const [stoppingOutputKey, setStoppingOutputKey] = React.useState(null);

  React.useEffect(() => {
    if (!outputOptions.some((option) => option.value === selectedOutput)) {
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
      const excludedOutputs = new Set(excludedOutputKeys);
      const nextProjections = (Array.isArray(result.projections) ? result.projections : [])
        .filter((entry) => entry?.outputKey && !excludedOutputs.has(entry.outputKey));
      setExternalDisplays(externals);
      setProjections(nextProjections);
      return { projections: nextProjections, externalDisplays: externals };
    } catch (error) {
      console.warn('Failed to load projection state:', error);
      return null;
    } finally {
      setLoadingState(false);
    }
  }, []);

  React.useEffect(() => { loadProjectionState(); }, [loadProjectionState]);

  React.useEffect(() => {
    if (!preferredDisplayId) return;
    if (!externalDisplays.some((display) => String(display.id) === String(preferredDisplayId))) return;
    setSelectedTarget(String(preferredDisplayId));
  }, [preferredDisplayId, externalDisplays]);

  const activeProjection = React.useMemo(
    () => projections.find((entry) => entry.outputKey === selectedOutput) || null,
    [projections, selectedOutput]
  );

  React.useEffect(() => {
    if (!activeProjection) return;
    const nextTarget = activeProjection.targetType === 'display' && activeProjection.displayId !== null
      ? String(activeProjection.displayId)
      : DESKTOP_TARGET;
    setSelectedTarget((prev) => (prev === nextTarget ? prev : nextTarget));
  }, [activeProjection]);

  const targetOptions = React.useMemo(() => {
    const base = [{
      value: DESKTOP_TARGET,
      label: 'This Monitor',
      sub: 'Fullscreen behind windows',
      icon: Monitor,
    }];
    externalDisplays.forEach((display, index) => {
      base.push({
        value: String(display.id),
        label: displayLabel(display, index),
        sub: 'External display',
        icon: Tv2,
      });
    });
    return base;
  }, [externalDisplays]);

  const selectedTargetInfo = React.useMemo(
    () => targetOptions.find((option) => option.value === selectedTarget) || targetOptions[0],
    [targetOptions, selectedTarget]
  );

  React.useEffect(() => {
    if (targetOptions.some((option) => option.value === selectedTarget)) return;
    setSelectedTarget(DESKTOP_TARGET);
  }, [selectedTarget, targetOptions]);

  const activeProjections = React.useMemo(
    () => projections.filter((entry) => entry && entry.outputKey),
    [projections]
  );

  const targetOccupant = React.useMemo(() => (
    activeProjections.find((entry) => (
      entry.outputKey !== selectedOutput && projectionTargetValue(entry) === selectedTarget
    )) || null
  ), [activeProjections, selectedOutput, selectedTarget]);

  const isActiveOnSelectedTarget = React.useMemo(() => (
    Boolean(activeProjection) && projectionTargetValue(activeProjection) === selectedTarget
  ), [activeProjection, selectedTarget]);

  const showProjectAction = !activeProjection || !isActiveOnSelectedTarget;
  const isStopping = Boolean(stoppingOutputKey);

  const projectActionLabel = React.useMemo(() => {
    if (isProjecting) return 'Projecting…';
    const outputLabel = formatOutputLabel(selectedOutput);
    const targetLabel = selectedTargetInfo?.label || 'Selected Target';
    if (targetOccupant && activeProjection) return `Replace & Move ${outputLabel}`;
    if (targetOccupant) return `Replace with ${outputLabel}`;
    if (activeProjection) return `Move to ${targetLabel}`;
    return `Project to ${targetLabel}`;
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
      const displacedOutputKey = result?.displacedOutputKey || null;
      const displacementMessage = displacedOutputKey
        ? ` ${formatOutputLabel(displacedOutputKey)} was turned off on this target.` : '';
      showToast({
        title: 'Projection started',
        message: `${formatOutputLabel(selectedOutput)} is now projecting to ${selectedTargetInfo?.label || 'selected target'}.${displacementMessage}`,
        variant: 'success',
      });
      const nextState = await loadProjectionState();
      if (!activeProjection && nextState?.projections) {
        const projectedKeys = new Set(nextState.projections.map((entry) => entry.outputKey));
        const nextOutput = outputOptions.find((option) => !projectedKeys.has(option.value));
        if (nextOutput?.value) setSelectedOutput(nextOutput.value);
      }
    } catch (error) {
      showToast({ title: 'Projection failed', message: error?.message || 'Could not start projection.', variant: 'error' });
      await loadProjectionState();
    } finally {
      setIsProjecting(false);
    }
  };

  const handleStopProjection = async (outputKey = selectedOutput) => {
    if (!window?.electronAPI?.display?.stopProjection) {
      showToast({ title: 'Projection unavailable', message: 'Display projection API is not available.', variant: 'error' });
      return;
    }
    setStoppingOutputKey(outputKey);
    try {
      const result = await window.electronAPI.display.stopProjection({ outputKey });
      if (!result?.success) throw new Error(result?.error || 'Could not stop projection.');
      showToast({ title: 'Projection stopped', message: `${formatOutputLabel(outputKey)} projection has been turned off.`, variant: 'success' });
      setProjections((current) => current.filter((entry) => entry?.outputKey !== outputKey));
      await loadProjectionState({ excludedOutputKeys: [outputKey] });
    } catch (error) {
      showToast({ title: 'Stop failed', message: error?.message || 'Could not stop projection.', variant: 'error' });
    } finally {
      setStoppingOutputKey(null);
    }
  };

  const detectionBanner = triggerSource !== 'manual' && Array.isArray(detectedDisplays) && detectedDisplays.length > 0;

  const dark = darkMode;

  return (
    <div className="flex h-[560px] max-h-full min-h-0 flex-col overflow-hidden rounded-b-2xl">
      {/* Scrollable body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-4">

        {/* Detection banner */}
        {detectionBanner && (
          <div className={cn(
            'flex items-start gap-3 rounded-xl border px-4 py-3',
            dark ? 'border-blue-600/40 bg-blue-500/10' : 'border-blue-200 bg-blue-50'
          )}>
            <Monitor className={cn('mt-0.5 h-4 w-4 shrink-0', dark ? 'text-blue-300' : 'text-blue-600')} />
            <div>
              <p className={cn('text-sm font-semibold', dark ? 'text-blue-100' : 'text-blue-900')}>
                {detectedDisplays.length > 1 ? `${detectedDisplays.length} External Displays Found` : 'External Display Found'}
              </p>
              <p className={cn('mt-0.5 text-xs leading-relaxed', dark ? 'text-blue-200/80' : 'text-blue-700')}>
                {detectedDisplays.length > 1
                  ? 'Pick what to show and choose a destination for each.'
                  : 'Pick what to show, then select the detected display as the destination.'}
              </p>
            </div>
          </div>
        )}

        {/* Two-column layout: Output picker + Destination picker */}
        <div className="grid grid-cols-2 gap-3">
          {/* ── Output column ── */}
          <div className={cn('overflow-hidden rounded-xl border', dark ? 'border-gray-700 bg-gray-800/60' : 'border-gray-200 bg-white')}>
            <div className="max-h-80 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
              <div className={cn(
                'sticky top-0 z-10 flex items-center gap-1.5 border-b px-3 py-2.5',
                dark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
              )}>
                <Projector className={cn('h-3.5 w-3.5', dark ? 'text-blue-300' : 'text-blue-600')} />
                <span className={cn('text-xs font-semibold tracking-wide uppercase', dark ? 'text-gray-300' : 'text-gray-500')}>Output</span>
                {activeProjection && (
                  <span className={cn('ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-medium', dark ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700')}>
                    Live
                  </span>
                )}
              </div>

              <div className="space-y-1.5 px-3 pb-3 pt-2 pr-1.5">
                {outputOptions.map((option) => {
                  const isSelected = option.value === selectedOutput;
                  const projection = activeProjections.find((entry) => entry.outputKey === option.value);
                  const Icon = outputIcon(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSelectedOutput(option.value)}
                      className={cn(
                        'w-full rounded-lg border px-2.5 py-2 text-left transition-all duration-150',
                        dark
                          ? 'border-gray-700 bg-gray-900/40 hover:border-blue-500/50 hover:bg-gray-900/70'
                          : 'border-gray-200 bg-gray-50/80 hover:border-blue-300 hover:bg-blue-50/50',
                        isSelected && (dark
                          ? 'border-blue-400/70 bg-blue-500/15 ring-1 ring-blue-400/30'
                          : 'border-blue-400 bg-blue-50 ring-1 ring-blue-200/80')
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={cn('h-3.5 w-3.5 shrink-0', isSelected
                          ? (dark ? 'text-blue-300' : 'text-blue-600')
                          : (dark ? 'text-gray-500' : 'text-gray-400')
                        )} />
                        <span className={cn('flex-1 truncate text-xs font-semibold', dark ? 'text-gray-100' : 'text-gray-800')}>
                          {option.label}
                        </span>
                        {isSelected && <CheckCircle2 className={cn('h-3.5 w-3.5 shrink-0', dark ? 'text-blue-300' : 'text-blue-500')} />}
                      </div>
                      <p className={cn('mt-0.5 truncate pl-5.5 text-[10px]', dark ? 'text-gray-500' : 'text-gray-400')}>
                        {projection ? `Live → ${projectionTargetLabel(projection)}` : outputHint(option.value)}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Destination column ── */}
          <div className={cn('overflow-hidden rounded-xl border', dark ? 'border-gray-700 bg-gray-800/60' : 'border-gray-200 bg-white')}>
            <div className="max-h-80 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
              <div className={cn(
                'sticky top-0 z-10 flex items-center gap-1.5 border-b px-3 py-2.5',
                dark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
              )}>
                <Monitor className={cn('h-3.5 w-3.5', dark ? 'text-purple-300' : 'text-purple-600')} />
                <span className={cn('text-xs font-semibold tracking-wide uppercase', dark ? 'text-gray-300' : 'text-gray-500')}>Destination</span>
              </div>

              <div className="space-y-1.5 px-3 pb-3 pt-2 pr-1.5">
                {targetOptions.map((option) => {
                  const isSelected = option.value === selectedTarget;
                  const occupant = activeProjections.find((entry) => projectionTargetValue(entry) === option.value);
                  const selectedOutputOwnsTarget = occupant?.outputKey === selectedOutput;
                  const Icon = option.icon || Monitor;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSelectedTarget(option.value)}
                      className={cn(
                        'w-full rounded-lg border px-2.5 py-2 text-left transition-all duration-150',
                        dark
                          ? 'border-gray-700 bg-gray-900/40 hover:border-purple-500/50 hover:bg-gray-900/70'
                          : 'border-gray-200 bg-gray-50/80 hover:border-purple-300 hover:bg-purple-50/50',
                        isSelected && (dark
                          ? 'border-purple-400/70 bg-purple-500/15 ring-1 ring-purple-400/30'
                          : 'border-purple-400 bg-purple-50 ring-1 ring-purple-200/80')
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={cn('h-3.5 w-3.5 shrink-0', isSelected
                          ? (dark ? 'text-purple-300' : 'text-purple-600')
                          : (dark ? 'text-gray-500' : 'text-gray-400')
                        )} />
                        <span className={cn('flex-1 truncate text-xs font-semibold', dark ? 'text-gray-100' : 'text-gray-800')}>
                          {option.label}
                        </span>
                        {isSelected && <CheckCircle2 className={cn('h-3.5 w-3.5 shrink-0', dark ? 'text-purple-300' : 'text-purple-500')} />}
                      </div>
                      <p className={cn('mt-0.5 pl-5.5 text-[10px]', dark ? 'text-gray-500' : 'text-gray-400')}>
                        {option.sub}
                      </p>
                      {occupant && (
                        <div className={cn(
                          'mt-1.5 flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px]',
                          selectedOutputOwnsTarget
                            ? (dark ? 'bg-green-500/15 text-green-300' : 'bg-green-50 text-green-700')
                            : (dark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700')
                        )}>
                          {selectedOutputOwnsTarget
                            ? <CheckCircle2 className="h-3 w-3 shrink-0" />
                            : <AlertTriangle className="h-3 w-3 shrink-0" />}
                          <span className="truncate">
                            {selectedOutputOwnsTarget ? 'Currently showing this' : `In use: ${formatOutputLabel(occupant.outputKey)}`}
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Conflict warning */}
            {targetOccupant && (
              <div className={cn('mx-3 mb-3 mt-2 rounded-lg px-2.5 py-2 text-[11px] leading-relaxed', dark ? 'bg-amber-500/10 text-amber-200' : 'bg-amber-50 text-amber-700')}>
                <AlertTriangle className="mb-0.5 mr-1 inline h-3 w-3" />
                Replacing {formatOutputLabel(targetOccupant.outputKey)} with {formatOutputLabel(selectedOutput)}.
              </div>
            )}
          </div>
        </div>

        {/* Active projections strip */}
        {activeProjections.length > 0 && (
          <div className={cn('rounded-xl border p-3 space-y-1.5', dark ? 'border-gray-700 bg-gray-800/40' : 'border-gray-200 bg-gray-50')}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                <span className={cn('text-xs font-semibold tracking-wide uppercase', dark ? 'text-gray-400' : 'text-gray-500')}>
                  Live
                </span>
                {loadingState && <span className={cn('text-[10px]', dark ? 'text-gray-500' : 'text-gray-400')}>Refreshing…</span>}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activeProjections.map((entry) => {
                const isSelected = entry.outputKey === selectedOutput;
                const isStoppingThis = stoppingOutputKey === entry.outputKey;
                return (
                  <div
                    key={`${entry.outputKey}-${entry.windowId || entry.displayId || entry.targetType}`}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors',
                      dark
                        ? (isSelected ? 'border-green-500/40 bg-green-500/15 text-green-100' : 'border-gray-700 bg-gray-900/50 text-gray-300')
                        : (isSelected ? 'border-green-300 bg-green-50 text-green-900 ring-1 ring-green-200' : 'border-gray-200 bg-white text-gray-700')
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedOutput(entry.outputKey)}
                      className="flex items-center gap-1.5 text-left"
                    >
                      <ScreenShare className="h-3.5 w-3.5 shrink-0" />
                      <span className="font-medium">{formatOutputLabel(entry.outputKey)}</span>
                      <span className={cn('text-[10px]', dark ? 'text-gray-500' : 'text-gray-400')}>
                        → {projectionTargetLabel(entry)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStopProjection(entry.outputKey)}
                      disabled={isProjecting || isStopping}
                      className={cn(
                        'ml-1 flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors disabled:opacity-40',
                        dark ? 'text-red-400 hover:bg-red-500/20 hover:text-red-300' : 'text-red-600 hover:bg-red-50 hover:text-red-700'
                      )}
                    >
                      {isStoppingThis ? 'Stopping…' : <><Power className="h-2.5 w-2.5" /> Off</>}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeProjections.length === 0 && !loadingState && (
          <div className={cn('rounded-xl border border-dashed px-4 py-3 text-center text-xs', dark ? 'border-gray-700 text-gray-500' : 'border-gray-300 text-gray-400')}>
            Nothing is projecting yet
          </div>
        )}

        {/* Integration callout */}
        <div className={cn('flex items-center gap-3 rounded-xl border px-3.5 py-3', dark ? 'border-cyan-700/40 bg-cyan-500/8' : 'border-cyan-200 bg-cyan-50')}>
          <Network className={cn('h-4 w-4 shrink-0', dark ? 'text-cyan-300' : 'text-cyan-600')} />
          <div className="flex-1 min-w-0">
            <p className={cn('text-sm font-semibold', dark ? 'text-cyan-100' : 'text-cyan-900')}>Using OBS, vMix, or Wirecast?</p>
            <p className={cn('text-xs', dark ? 'text-cyan-300/70' : 'text-cyan-700')}>Use a browser source for production software.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenIntegrationGuide?.()}
            className={cn(
              'shrink-0',
              dark ? 'bg-transparent border-cyan-500/50 text-cyan-100 hover:bg-cyan-500/20 hover:border-cyan-400' : 'border-cyan-300 text-cyan-800 hover:bg-cyan-100'
            )}
          >
            Integration Guide
          </Button>
        </div>
      </div>

      {/* Footer */}
      <div className={cn(
        'flex flex-shrink-0 items-center justify-between gap-3 rounded-b-2xl border-t px-5 py-6',
        dark ? 'border-gray-700 bg-gray-800/60' : 'border-gray-200 bg-gray-50'
      )}>
        <Button
          variant="outline"
          size="lg"
          onClick={() => onClose?.({ dismissed: true })}
          className={dark ? 'bg-transparent border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white hover:border-gray-500' : ''}
        >
          Close
        </Button>

        <div className="flex items-center gap-2">
          {activeProjection && (
            <Button
              variant="destructive"
              size="lg"
              onClick={() => handleStopProjection(selectedOutput)}
              disabled={isStopping || isProjecting}
              className={cn('gap-1.5', dark ? 'bg-red-600 hover:bg-red-700 text-white border-0' : '')}
            >
              <Power className="h-3.5 w-3.5" />
              {stoppingOutputKey === selectedOutput ? 'Stopping…' : 'Turn Off'}
            </Button>
          )}
          {showProjectAction && (
            <Button
              size="lg"
              onClick={handleProject}
              disabled={isProjecting || isStopping}
              className={cn('gap-1.5', dark ? 'bg-blue-600 hover:bg-blue-700 text-white border-0' : 'bg-blue-600 hover:bg-blue-700 text-white')}
            >
              <Projector className="h-3.5 w-3.5" />
              {projectActionLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectOutputModal;
