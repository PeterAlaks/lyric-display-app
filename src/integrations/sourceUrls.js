import { resolveBackendOrigin } from '@/utils/network';

const trimTrailingSlash = (value = '') => String(value).replace(/\/+$/, '');

const isDevelopmentRouter = () => import.meta.env.MODE === 'development';

export const DEFAULT_SOURCE_SIZE = {
  width: 1920,
  height: 1080,
  fps: 30,
};

export function createRoutePath(route, { hash = !isDevelopmentRouter() } = {}) {
  const normalizedRoute = String(route || '/').startsWith('/') ? String(route || '/') : `/${route}`;
  return hash ? `/#${normalizedRoute}` : normalizedRoute;
}

export function createRouteUrl({ baseUrl, route, hash = !isDevelopmentRouter() }) {
  const origin = trimTrailingSlash(baseUrl || resolveBackendOrigin());
  return `${origin}${createRoutePath(route, { hash })}`;
}

export function createSourcePath({ outputId, mode = 'transparent', preview = false, hash = !isDevelopmentRouter() }) {
  const safeOutputId = outputId || 'output1';
  const params = new URLSearchParams();

  if (mode === 'projection') {
    params.set('projection', 'true');
  }
  if (preview && safeOutputId.startsWith('output')) {
    params.set('preview', 'true');
  }

  const query = params.toString();
  const route = `/${safeOutputId}${query ? `?${query}` : ''}`;
  return createRoutePath(route, { hash });
}

export function createSourceUrl({ baseUrl, outputId, mode = 'transparent', preview = false, hash = !isDevelopmentRouter() }) {
  const origin = trimTrailingSlash(baseUrl || resolveBackendOrigin());
  return `${origin}${createSourcePath({ outputId, mode, preview, hash })}`;
}

export function formatOutputLabel(outputId = '') {
  if (outputId === 'stage') return 'Stage Display';
  if (outputId === 'time') return 'Timer Display';

  const match = /^output(\d+)$/i.exec(outputId);
  if (match) return `Output ${match[1]}`;

  return outputId || 'Output';
}

export function formatSourceName(outputId = 'output1') {
  return `LyricDisplay ${formatOutputLabel(outputId)}`;
}

export function getTransparentBrowserCss() {
  return 'body { background-color: rgba(0, 0, 0, 0); margin: 0; overflow: hidden; }';
}
