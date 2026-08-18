export const DEFAULT_OUTPUT_IDS = ['output1', 'output2'];
export const MAX_CUSTOM_OUTPUTS = 4;

const DEFAULT_OUTPUT_ID_SET = new Set(DEFAULT_OUTPUT_IDS);

export function getCustomOutputRouteIds(maxCustomOutputs = MAX_CUSTOM_OUTPUTS) {
  return Array.from({ length: maxCustomOutputs }, (_, index) => `output${index + 3}`);
}

export function getAllRoutableOutputIds(maxCustomOutputs = MAX_CUSTOM_OUTPUTS) {
  return [...DEFAULT_OUTPUT_IDS, ...getCustomOutputRouteIds(maxCustomOutputs)];
}

export function isDefaultOutputId(outputId) {
  return DEFAULT_OUTPUT_ID_SET.has(outputId);
}

export function isCustomOutputRouteId(outputId, maxCustomOutputs = MAX_CUSTOM_OUTPUTS) {
  return typeof outputId === 'string'
    && getCustomOutputRouteIds(maxCustomOutputs).includes(outputId);
}

export function isRoutableOutputId(outputId, maxCustomOutputs = MAX_CUSTOM_OUTPUTS) {
  return isDefaultOutputId(outputId) || isCustomOutputRouteId(outputId, maxCustomOutputs);
}

export function normalizeCustomOutputRouteIds(outputIds, maxCustomOutputs = MAX_CUSTOM_OUTPUTS) {
  if (!Array.isArray(outputIds)) return [];

  const allowed = new Set(getCustomOutputRouteIds(maxCustomOutputs));
  return Array.from(new Set(outputIds.filter((outputId) => allowed.has(outputId))))
    .sort((left, right) => Number(left.slice('output'.length)) - Number(right.slice('output'.length)));
}
