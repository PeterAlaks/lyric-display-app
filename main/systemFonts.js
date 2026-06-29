let cachedFonts = null;
let cachedFontsPromise = null;
let prewarmPromise = null;
let fontLoadRequestId = 0;

const FONT_LOAD_TIMEOUT_MS = 8000;

const normalizeFonts = (fonts) => Array.from(
  new Set(
    (fonts || [])
      .map((font) => (typeof font === 'string' ? font.replace(/["']/g, '').trim() : ''))
      .filter(Boolean)
  )
).sort((a, b) => a.localeCompare(b));

const withTimeout = (promise, timeoutMs, message) => {
  let timeoutId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
};

const scanSystemFonts = async () => {
  const fontList = await import('font-list');
  const getFonts = fontList.getFonts || fontList.default?.getFonts;
  if (typeof getFonts !== 'function') {
    throw new Error('font-list getFonts not available');
  }
  return getFonts({ disableQuoting: true });
};

export const loadSystemFonts = async ({ force = false } = {}) => {
  if (!force && Array.isArray(cachedFonts)) return cachedFonts;
  if (!force && cachedFontsPromise) return cachedFontsPromise;

  const requestId = ++fontLoadRequestId;
  const scanPromise = scanSystemFonts()
    .then((fonts) => {
      const normalizedFonts = normalizeFonts(fonts);
      if (requestId === fontLoadRequestId || !Array.isArray(cachedFonts)) {
        cachedFonts = normalizedFonts;
      }
      console.log(`[SystemFonts] Loaded ${normalizedFonts.length} system fonts`);
      return normalizedFonts;
    });

  const pendingPromise = withTimeout(
    scanPromise,
    FONT_LOAD_TIMEOUT_MS,
    `System font scan timed out after ${FONT_LOAD_TIMEOUT_MS}ms`
  )
    .then((fonts) => {
      if (Array.isArray(fonts)) return fonts;
      return Array.isArray(cachedFonts) ? cachedFonts : [];
    })
    .catch((error) => {
      console.warn('[SystemFonts] Font scan unavailable:', error?.message || error);
      if (Array.isArray(cachedFonts)) return cachedFonts;
      throw error;
    })
    .finally(() => {
      if (cachedFontsPromise === pendingPromise) {
        cachedFontsPromise = null;
      }
    });

  cachedFontsPromise = pendingPromise;
  return pendingPromise;
};

export const preloadSystemFonts = () => {
  if (Array.isArray(cachedFonts)) return Promise.resolve(cachedFonts);
  if (prewarmPromise) return prewarmPromise;
  if (cachedFontsPromise) {
    prewarmPromise = cachedFontsPromise
      .catch(() => [])
      .finally(() => {
        prewarmPromise = null;
      });
    return prewarmPromise;
  }
  if (!prewarmPromise) {
    prewarmPromise = loadSystemFonts()
      .catch(() => [])
      .finally(() => {
        prewarmPromise = null;
      });
  }
  return prewarmPromise;
};

export const getCachedFonts = () => cachedFonts || [];
