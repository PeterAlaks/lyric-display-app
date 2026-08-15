export const OUTPUT_METRICS_FRESH_MS = 15000;
export const NDI_TELEMETRY_FRESH_MS = 15000;
export const NDI_FRAME_FRESH_MS = 10000;

const outputLabel = (outputId) => {
  const match = /^output(\d+)$/i.exec(String(outputId || ''));
  return match ? `Output ${match[1]}` : String(outputId || 'Output');
};

const joinLabels = (outputIds) => outputIds.map(outputLabel).join(', ');

export const getEnabledOutputIds = (storeState = {}) => (
  ['output1', 'output2', ...(Array.isArray(storeState.customOutputIds) ? storeState.customOutputIds : [])]
    .filter((outputId, index, list) => list.indexOf(outputId) === index)
    .filter((outputId) => storeState[`${outputId}Enabled`] !== false)
);

export const evaluateOutputReadiness = ({ storeState = {}, now = Date.now() } = {}) => {
  const enabledOutputs = getEnabledOutputIds(storeState);
  const missing = [];
  const stale = [];
  const healthy = [];

  for (const outputId of enabledOutputs) {
    const settings = storeState[`${outputId}Settings`] || {};
    const instances = Array.isArray(settings.allInstances) ? settings.allInstances : [];
    if (instances.length === 0 || Number(settings.instanceCount || 0) === 0) {
      missing.push(outputId);
      continue;
    }

    const hasFreshInstance = instances.some((instance) => (
      Number.isFinite(instance?.lastUpdate)
      && now - instance.lastUpdate >= 0
      && now - instance.lastUpdate <= OUTPUT_METRICS_FRESH_MS
    ));
    if (hasFreshInstance) healthy.push(outputId);
    else stale.push(outputId);
  }

  if (enabledOutputs.length === 0) {
    return {
      id: 'outputs',
      label: 'Enabled Outputs',
      status: 'warn',
      detail: 'No lyric outputs are enabled',
    };
  }

  if (missing.length > 0 || stale.length > 0) {
    const issues = [];
    if (missing.length > 0) issues.push(`${joinLabels(missing)} not connected`);
    if (stale.length > 0) issues.push(`${joinLabels(stale)} stopped reporting render health`);
    return {
      id: 'outputs',
      label: 'Enabled Outputs',
      status: 'fail',
      detail: issues.join('; '),
    };
  }

  return {
    id: 'outputs',
    label: 'Enabled Outputs',
    status: 'pass',
    detail: `${healthy.length}/${enabledOutputs.length} enabled output${enabledOutputs.length === 1 ? '' : 's'} reporting fresh render health`,
  };
};

export const evaluateProjectionReadiness = ({ projection, storeState = {} } = {}) => {
  if (!projection?.success) {
    return {
      id: 'displays',
      label: 'Projection Windows',
      status: 'warn',
      detail: projection?.error || 'Projection state is unavailable',
    };
  }

  const projections = Array.isArray(projection.projections) ? projection.projections : [];
  const displays = Array.isArray(projection.displays) ? projection.displays : [];
  if (projections.length === 0) {
    return {
      id: 'displays',
      label: 'Projection Windows',
      status: 'warn',
      detail: `${displays.length} display${displays.length === 1 ? '' : 's'} detected; no projection window is active`,
    };
  }

  const displayIds = new Set(displays.map((display) => String(display?.id)));
  const missingDisplays = projections.filter((item) => (
    item?.displayId === null
    || item?.displayId === undefined
    || !displayIds.has(String(item.displayId))
  ));
  if (missingDisplays.length > 0) {
    return {
      id: 'displays',
      label: 'Projection Windows',
      status: 'fail',
      detail: `${missingDisplays.length}/${projections.length} projection window${projections.length === 1 ? '' : 's'} no longer map to an available display`,
    };
  }

  const disabled = projections
    .map((item) => item?.outputKey)
    .filter((outputId) => outputId && storeState[`${outputId}Enabled`] === false);
  if (disabled.length > 0) {
    return {
      id: 'displays',
      label: 'Projection Windows',
      status: 'warn',
      detail: `${joinLabels(disabled)} projected but individually disabled`,
    };
  }

  return {
    id: 'displays',
    label: 'Projection Windows',
    status: 'pass',
    detail: `${projections.length} projection window${projections.length === 1 ? '' : 's'} mapped across ${displays.length} available display${displays.length === 1 ? '' : 's'}`,
  };
};

export const evaluateNdiReadiness = ({
  companionStatus,
  outputSettings = {},
  telemetry,
  now = Date.now(),
} = {}) => {
  const enabledOutputs = Object.entries(outputSettings)
    .filter(([, result]) => result?.settings?.enabled === true)
    .map(([outputId]) => outputId);

  if (enabledOutputs.length === 0) {
    return {
      id: 'ndi',
      label: 'NDI Routes',
      status: 'pass',
      detail: 'No NDI output routes are enabled',
    };
  }

  if (!companionStatus?.running || !companionStatus?.ready) {
    const state = companionStatus?.starting
      ? 'starting'
      : companionStatus?.running
        ? 'running but not ready'
        : 'not running';
    return {
      id: 'ndi',
      label: 'NDI Routes',
      status: 'fail',
      detail: `${joinLabels(enabledOutputs)} require NDI, but the companion is ${state}`,
    };
  }

  const telemetryAge = Number.isFinite(telemetry?.updatedAt) ? now - telemetry.updatedAt : Infinity;
  if (telemetryAge < 0 || telemetryAge > NDI_TELEMETRY_FRESH_MS) {
    return {
      id: 'ndi',
      label: 'NDI Routes',
      status: 'fail',
      detail: `${joinLabels(enabledOutputs)} enabled, but NDI health telemetry is stale`,
    };
  }

  const perOutput = telemetry?.stats?.perOutput || {};
  const unhealthy = enabledOutputs.filter((outputId) => {
    const stats = perOutput[outputId];
    if (!stats?.senderReady || !stats?.pageLoaded) return true;
    if (!Number.isFinite(stats.lastPaintTs)) return true;
    const frameAge = now - stats.lastPaintTs;
    return frameAge < 0 || frameAge > NDI_FRAME_FRESH_MS;
  });

  if (unhealthy.length > 0) {
    return {
      id: 'ndi',
      label: 'NDI Routes',
      status: 'fail',
      detail: `${joinLabels(unhealthy)} not reporting fresh NDI frames`,
    };
  }

  return {
    id: 'ndi',
    label: 'NDI Routes',
    status: 'pass',
    detail: `${enabledOutputs.length} enabled NDI route${enabledOutputs.length === 1 ? '' : 's'} ready and sending fresh frames`,
  };
};
