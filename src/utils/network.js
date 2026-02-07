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

const toLoopbackOrigin = (origin, port, forceIPv4Loopback = false) => {
  if (!origin) return '';
  try {
    const url = new URL(origin);
    if (!isLocalHostname(url.hostname)) {
      return normalizeOrigin(origin);
    }

    if (forceIPv4Loopback) {
      const protocol = url.protocol || 'http:';
      const portValue = url.port || `${port}`;
      const portSuffix = isDefaultPortForProtocol(protocol, portValue) ? '' : `:${portValue}`;
      return normalizeOrigin(`${protocol}//127.0.0.1${portSuffix}`);
    }

    if (url.hostname.startsWith('127.')) {
      return normalizeOrigin(origin);
    }

    if (url.hostname === 'localhost') {
      return normalizeOrigin(origin);
    }

    const protocol = url.protocol || 'http:';
    const portValue = url.port || `${port}`;
    const portSuffix = isDefaultPortForProtocol(protocol, portValue) ? '' : `:${portValue}`;
    return normalizeOrigin(`${protocol}//127.0.0.1${portSuffix}`);
  } catch (error) {
    return normalizeOrigin(origin);
  }
};

export const resolveBackendOrigin = (port = defaultPort) => {
  const envUrl = (import.meta.env.VITE_SOCKET_SERVER_URL ?? '').trim();
  const envOrigin = envUrl ? normalizeOrigin(envUrl) : '';
  const envHost = parseHostname(envOrigin);
  const envIsLocal = isLocalHostname(envHost);

  const inBrowser = typeof window !== 'undefined';
  const hasElectronBridge = inBrowser && !!window.electronAPI;

  if (envOrigin && !envIsLocal) {
    return envOrigin;
  }

  const browserOrigin = getBrowserOrigin();
  const browserHost = parseHostname(browserOrigin);
  const browserIsLocal = isLocalHostname(browserHost);

  if (hasElectronBridge) {
    if (browserOrigin) {
      const browserUrl = new URL(browserOrigin);
      const browserPort = browserUrl.port;

      if (browserPort === '5173') {
        return `${browserUrl.protocol}//${browserUrl.hostname}:${port}`;
      }

      if (browserHost.startsWith('127.')) {
        return browserOrigin;
      }

      if (browserHost === 'localhost') {
        return browserOrigin;
      }

      if (browserIsLocal) {
        return browserOrigin;
      }
    }

    return `http://127.0.0.1:${port}`;
  }


  if (browserOrigin) {
    const browserUrl = new URL(browserOrigin);
    const browserPort = browserUrl.port;

    // In dev mode with Vite proxy, use the same origin (port 5173)
    // Vite will proxy /api and /socket.io requests to the backend
    if (browserPort === '5173') {
      // For non-Electron clients (mobile/web) in dev mode, use the browser origin
      // This allows Vite's proxy to handle the requests
      if (import.meta.env.DEV) {
        console.log('[Network] Using Vite proxy for backend connection:', browserOrigin);
      }
      return browserOrigin;
    }

    if (!browserIsLocal) {
      return browserOrigin;
    }

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
