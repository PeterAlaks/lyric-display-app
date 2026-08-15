export const RUNTIME_PROFILE_ENV = 'LYRICDISPLAY_RUNTIME_PROFILE';
export const USER_DATA_DIR_ENV = 'LYRICDISPLAY_USER_DATA_DIR';
export const PRODUCTION_RUNTIME_PROFILE = 'production';
export const DEVELOPMENT_RUNTIME_PROFILE = 'development';

export function normalizeRuntimeProfile(profile) {
  return profile === DEVELOPMENT_RUNTIME_PROFILE
    ? DEVELOPMENT_RUNTIME_PROFILE
    : PRODUCTION_RUNTIME_PROFILE;
}

export function getRuntimeProfile(env = process.env) {
  return normalizeRuntimeProfile(env?.[RUNTIME_PROFILE_ENV]);
}

export function getProfiledName(baseName, profile = getRuntimeProfile()) {
  const normalizedName = String(baseName || '').trim();
  if (!normalizedName) return '';
  return normalizeRuntimeProfile(profile) === DEVELOPMENT_RUNTIME_PROFILE
    ? `${normalizedName}-Dev`
    : normalizedName;
}
