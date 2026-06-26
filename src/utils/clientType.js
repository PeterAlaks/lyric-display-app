const CLIENT_TYPE_ALIASES = new Map([
  ['web', 'web'],
  ['mobile', 'mobile'],
  ['obsdock', 'obsDock'],
  ['obs-dock', 'obsDock'],
  ['obs_dock', 'obsDock'],
]);

const getHashSearchParams = () => {
  if (typeof window === 'undefined') return null;
  const hash = window.location?.hash || '';
  const queryIndex = hash.indexOf('?');
  if (queryIndex < 0) return null;
  return new URLSearchParams(hash.slice(queryIndex + 1));
};

export const getUrlParam = (name) => {
  if (typeof window === 'undefined') return null;

  const mainParams = new URLSearchParams(window.location?.search || '');
  const direct = mainParams.get(name);
  if (direct) return direct;

  const hashParams = getHashSearchParams();
  return hashParams?.get(name) || null;
};

export const getCurrentRoutePath = () => {
  if (typeof window === 'undefined') return '';

  const hash = window.location?.hash || '';
  if (hash.startsWith('#/')) {
    return hash.slice(1).split('?')[0] || '/';
  }

  return window.location?.pathname || '/';
};

export const normalizeRequestedClientType = (value) => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return CLIENT_TYPE_ALIASES.get(normalized) || null;
};

export const getRequestedControllerClientType = () => (
  normalizeRequestedClientType(getUrlParam('clientType')) ||
  normalizeRequestedClientType(getUrlParam('client')) ||
  (getCurrentRoutePath().replace(/\/+$/, '') === '/obs-dock' ? 'obsDock' : null)
);

export const requiresJoinCode = (clientType) => (
  clientType === 'web' ||
  clientType === 'mobile' ||
  clientType === 'obsDock'
);
