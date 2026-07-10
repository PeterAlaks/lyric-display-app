export const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
export const isOutputClientType = (type) => typeof type === 'string' && type.startsWith('output');
export const isOutputDiscoveryClientType = (type) => type === 'output-discovery';
export const isValidLineIndex = (index, lineCount) => {
  if (index === null) return true;
  return Number.isInteger(index)
    && index >= 0
    && Number.isInteger(lineCount)
    && index < lineCount;
};

export const getPrimaryOutputInstance = (instances = []) => {
  return instances.reduce((largest, current) => {
    if (!largest) return current;
    const largestArea = (largest.viewportWidth || 0) * (largest.viewportHeight || 0);
    const currentArea = (current.viewportWidth || 0) * (current.viewportHeight || 0);
    return currentArea > largestArea ? current : largest;
  }, null);
};
