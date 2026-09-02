export const DEFAULT_BACKEND_PORT = 4000;
export const MIN_BACKEND_PORT = 1024;
export const MAX_BACKEND_PORT = 65535;

const parseIntegerPort = (value) => {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : null;
  }

  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) {
    return null;
  }

  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) ? parsed : null;
};

export const isValidBackendPort = (value) => {
  const port = parseIntegerPort(value);
  return port !== null && port >= MIN_BACKEND_PORT && port <= MAX_BACKEND_PORT;
};

export const normalizeBackendPort = (value, fallback = DEFAULT_BACKEND_PORT) => (
  isValidBackendPort(value) ? parseIntegerPort(value) : fallback
);

export const resolveRuntimeBackendPort = ({
  isPackaged,
  configuredPort,
  environmentPort,
} = {}) => normalizeBackendPort(
  isPackaged ? configuredPort : environmentPort,
  DEFAULT_BACKEND_PORT
);
