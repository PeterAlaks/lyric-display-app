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

export function shouldDisableBackgroundThrottling(route = '/', { projection = false } = {}) {
  return Boolean(projection) || isTimeDisplayRoute(route);
}
