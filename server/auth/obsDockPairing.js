const PAIRING_TOKEN_TTL_MS = 2 * 60 * 1000;
const pairingTokens = new Map();

const normalizeToken = (value) => (typeof value === 'string' ? value.trim() : '');

export function registerObsDockPairingToken(token) {
  const normalized = normalizeToken(token);
  if (normalized.length < 32) return false;

  pairingTokens.set(normalized, Date.now() + PAIRING_TOKEN_TTL_MS);
  return true;
}

export function consumeObsDockPairingToken(token) {
  const normalized = normalizeToken(token);
  if (!normalized) return false;

  const expiresAt = pairingTokens.get(normalized);
  pairingTokens.delete(normalized);

  if (!expiresAt || Date.now() > expiresAt) {
    return false;
  }

  return true;
}

export function pruneObsDockPairingTokens(now = Date.now()) {
  pairingTokens.forEach((expiresAt, token) => {
    if (now > expiresAt) {
      pairingTokens.delete(token);
    }
  });
}
