export const corsMiddleware = (req, res, next) => {
  const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
  const origin = req.get('origin');
  const isAllowedLocalOrigin = (() => {
    if (!origin || origin === 'null') return true;
    try {
      const url = new URL(origin);
      return url.protocol === 'http:' && (
        url.hostname === 'localhost' ||
        url.hostname === '127.0.0.1' ||
        url.hostname === '::1'
      );
    } catch {
      return false;
    }
  })();

  if (isDev) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  } else if (isAllowedLocalOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin || 'null');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
};
