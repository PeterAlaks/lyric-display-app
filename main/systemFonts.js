let cachedFonts = null;
let cachedFontsPromise = null;
let prewarmPromise = null;

const normalizeFonts = (fonts) => Array.from(
  new Set(
    (fonts || [])
      .map((font) => (typeof font === 'string' ? font.replace(/["']/g, '').trim() : ''))
      .filter(Boolean)
  )
).sort((a, b) => a.localeCompare(b));

export const loadSystemFonts = async () => {
  if (cachedFonts && Array.isArray(cachedFonts)) return cachedFonts;
  if (cachedFontsPromise) return cachedFontsPromise;

  cachedFontsPromise = (async () => {
    try {
      const fontList = await import('font-list');
      const getFonts = fontList.getFonts || fontList.default?.getFonts;
      if (typeof getFonts !== 'function') {
        throw new Error('font-list getFonts not available');
      }
      const fonts = await getFonts({ disableQuoting: true });
      cachedFonts = normalizeFonts(fonts);
      return cachedFonts;
    } catch (error) {
      console.error('[SystemFonts] Error loading system fonts:', error);
      cachedFonts = [];
      return cachedFonts;
    } finally {
      cachedFontsPromise = null;
    }
  })();

  return cachedFontsPromise;
};

export const preloadSystemFonts = () => {
  if (prewarmPromise) return prewarmPromise;
  prewarmPromise = loadSystemFonts().catch(() => { /* logged inside loadSystemFonts */ });
  return prewarmPromise;
};

export const getCachedFonts = () => cachedFonts || [];