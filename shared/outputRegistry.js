export const DEFAULT_OUTPUT_IDS = ['output1', 'output2'];
export const MAX_CUSTOM_OUTPUTS = 4;

export function getCustomOutputRouteIds(maxCustomOutputs = MAX_CUSTOM_OUTPUTS) {
  return Array.from({ length: maxCustomOutputs }, (_, index) => `output${index + 3}`);
}

export function getAllRoutableOutputIds(maxCustomOutputs = MAX_CUSTOM_OUTPUTS) {
  return [...DEFAULT_OUTPUT_IDS, ...getCustomOutputRouteIds(maxCustomOutputs)];
}
