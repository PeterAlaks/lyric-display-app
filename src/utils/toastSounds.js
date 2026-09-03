const SOUND_URLS = {
  error: new URL('../assets/toast-sounds/error.mp3', import.meta.url).href,
  info: new URL('../assets/toast-sounds/info.mp3', import.meta.url).href,
  success: new URL('../assets/toast-sounds/success.mp3', import.meta.url).href,
  warn: new URL('../assets/toast-sounds/warn.mp3', import.meta.url).href,
};

const players = new Map();

function normalizeVariant(variant) {
  const normalized = typeof variant === 'string' ? variant.trim().toLowerCase() : '';
  if (normalized === 'warning') return 'warn';
  return Object.hasOwn(SOUND_URLS, normalized) ? normalized : 'info';
}

function getPlayer(variant) {
  const cachedPlayer = players.get(variant);
  if (cachedPlayer) return cachedPlayer;
  if (typeof globalThis.Audio !== 'function') return null;

  try {
    const player = new globalThis.Audio(SOUND_URLS[variant]);
    player.preload = 'auto';
    player.addEventListener?.('error', () => players.delete(variant), { once: true });
    players.set(variant, player);
    return player;
  } catch {
    return null;
  }
}

export function playToastSound(variant = 'info') {
  const player = getPlayer(normalizeVariant(variant));
  if (!player) return;

  try {
    player.currentTime = 0;
    const playPromise = player.play();
    playPromise?.catch?.(() => {});
  } catch {
    // Toasts must remain usable if audio playback is unavailable or blocked.
  }
}
