const LOOPBACK_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0:0:0:0:0:0:0:1',
]);

const normalizeLoopbackCandidate = (value) => {
  if (!value || typeof value !== 'string') return '';
  return value.trim().toLowerCase().replace(/^\[(.*)\]$/, '$1').replace(/^::ffff:/, '');
};

const isLoopbackRequest = (req) => {
  const candidates = [
    req.ip,
    req.socket?.remoteAddress,
    req.connection?.remoteAddress,
  ];

  return candidates.some((candidate) => LOOPBACK_HOSTS.has(normalizeLoopbackCandidate(candidate)));
};

export const localhostOnly = (req, res, next) => {
  if (isLoopbackRequest(req)) return next();
  return res.status(403).json({ error: 'Local access only' });
};
