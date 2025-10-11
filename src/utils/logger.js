const isVerbose = Boolean(import.meta.env.DEV || import.meta.env.MODE === 'development' || import.meta.env.VITE_ENABLE_VERBOSE_LOGS === 'true');

export const logDebug = (...args) => {
  if (isVerbose) {
    console.debug(...args);
  }
};

export const logInfo = (...args) => {
  if (isVerbose) {
    console.info(...args);
  }
};

export const logWarn = (...args) => {
  console.warn(...args);
};

export const logError = (...args) => {
  console.error(...args);
};
