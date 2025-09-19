const parsePort = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const defaultPort = parsePort(import.meta.env.VITE_SERVER_PORT) ?? 4000;

const isLocalHostname = (hostname = '') => {
  const normalized = hostname.toLowerCase();
  if (!normalized) return false;
  if (normalized === 'localhost') return true;
  if (normalized === '::1' || normalized === '[::1]') return true;
  if (normalized === '0.0.0.0') return true;
  if (normalized.startsWith('127.')) return true;
  return false;
};

const parseHostname = (value) => {
  if (!value) return '';
  try {
    return new URL(value).hostname;
  } catch (error) {
    return '';
  }
};

const normalizeOrigin = (origin) => {
  if (!origin) return '';
  return origin.endsWith('/') ? origin.slice(0, -1) : origin;
};

const getBrowserOrigin = () => {
  if (typeof window === 'undefined') return '';
  const origin = window.location?.origin;
  if (typeof origin !== 'string' || !origin.startsWith('http')) {
    return '';
  }
  return normalizeOrigin(origin);
};

const isDefaultPortForProtocol = (protocol = 'http:', portValue = '') => {
  if (!portValue) return false;
  const parsed = Number.parseInt(portValue, 10);
  if (!Number.isFinite(parsed)) return false;
  if (protocol === 'https:' && parsed === 443) return true;
  if (protocol === 'http:' && parsed === 80) return true;
  return false;
};

export const resolveBackendOrigin = (port = defaultPort) => {
  const envUrl = (import.meta.env.VITE_SOCKET_SERVER_URL ?? '').trim();
  const envOrigin = envUrl ? normalizeOrigin(envUrl) : '';
  const envHost = parseHostname(envOrigin);
  const envIsLocal = isLocalHostname(envHost);

  if (envOrigin && !envIsLocal) {
    return envOrigin;
  }

  const inBrowser = typeof window !== 'undefined';
  const browserOrigin = getBrowserOrigin();
  const browserHost = parseHostname(browserOrigin);
  const browserIsLocal = isLocalHostname(browserHost);

  if (inBrowser && window?.electronAPI) {
    if (envOrigin) return envOrigin;
    return `http://127.0.0.1:${port}`;
  }

  if (inBrowser) {
    if (browserOrigin && !browserIsLocal) {
      if (envOrigin && envIsLocal) {
        try {
          const browserUrl = new URL(browserOrigin);
          const envUrlObj = new URL(envOrigin || `http://localhost:${port}`);
          const targetProtocol = envUrlObj.protocol || browserUrl.protocol || 'http:';
          const targetPort = envUrlObj.port || `${port}`;
          const currentPort = browserUrl.port;

          if (!currentPort || currentPort !== targetPort) {
            const portSuffix = isDefaultPortForProtocol(targetProtocol, targetPort) ? '' : `:${targetPort}`;
            return normalizeOrigin(`${targetProtocol}//${browserUrl.hostname}${portSuffix}`);
          }
        } catch (error) {
          if (import.meta.env.DEV) {
            console.warn('[network] Failed to derive backend origin from browser host:', error);
          }
        }
      }
      return browserOrigin;
    }

    if (envOrigin) {
      return envOrigin;
    }
  }

  if (envOrigin) {
    return envOrigin;
  }

  if (browserOrigin) {
    return browserOrigin;
  }

  if (import.meta.env.DEV || import.meta.env.MODE === 'development') {
    return `http://localhost:${port}`;
  }

  return `http://127.0.0.1:${port}`;
};

export const resolveBackendUrl = (path = '/', port = defaultPort) => {
  const origin = resolveBackendOrigin(port);
  if (!path) return origin;
  const normalizedOrigin = normalizeOrigin(origin);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedOrigin}${normalizedPath}`;
};
