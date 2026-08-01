export function getWindowPreloadRole(route = '/') {
  const normalized = String(route || '/');
  const routePath = normalized.split('?')[0].replace(/\/+$/, '') || '/';
  if (routePath === '/lyric-video-export-frame') return 'none';
  if (
    /^\/output\d+$/.test(routePath)
    || routePath === '/stage'
    || routePath === '/time'
    || routePath === '/lyric-video-live-output'
  ) {
    return 'passive';
  }
  return 'control';
}

export function isTimeDisplayRoute(route = '/') {
  const normalized = String(route || '/');
  const routePath = normalized.split('?')[0].replace(/\/+$/, '') || '/';
  return routePath === '/time';
}

export function resolveWindowBackgroundColor(route = '/', {
  projection = false,
  backgroundColor,
  development = false,
} = {}) {
  if (projection) return '#000000';
  if (typeof backgroundColor === 'string' && backgroundColor.trim()) return backgroundColor;

  // Output preview windows render transparent web content over the native
  // BrowserWindow surface. Keep that surface black from window creation so it
  // cannot expose Electron's light default before or behind the output page.
  if (getWindowPreloadRole(route) === 'passive') return '#000000';

  return development ? '#ffffff' : '#f9fafb';
}

export function shouldDisableBackgroundThrottling(route = '/', { projection = false } = {}) {
  return Boolean(projection) || isTimeDisplayRoute(route);
}
