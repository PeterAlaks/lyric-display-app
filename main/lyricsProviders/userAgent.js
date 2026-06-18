import electron from 'electron';

const { app } = electron || {};

const APP_NAME = 'LyricDisplay';
const APP_WEBSITE = 'https://lyricdisplay.app';

const getAppVersion = () => {
  try {
    const version = app?.getVersion?.();
    if (version && String(version).trim()) {
      return String(version).trim();
    }
  } catch {
    // Ignore and use fallback values.
  }

  const fallback = process.env.npm_package_version || process.env.APP_VERSION;
  if (fallback && String(fallback).trim()) {
    return String(fallback).trim();
  }

  return 'unknown';
};

export const APP_VERSION = getAppVersion();
export const LYRICS_PROVIDER_USER_AGENT = `${APP_NAME}/${APP_VERSION} (+${APP_WEBSITE})`;
