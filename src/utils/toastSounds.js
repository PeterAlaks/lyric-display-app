const SOUND_URLS = {
  error: new URL('../assets/toast-sounds/error.mp3', import.meta.url).href,
  info: new URL('../assets/toast-sounds/info.mp3', import.meta.url).href,
  success: new URL('../assets/toast-sounds/success.mp3', import.meta.url).href,
  warn: new URL('../assets/toast-sounds/warn.mp3', import.meta.url).href,
};

const players = new Map();
// Empty means the system default device. Streaming setups usually capture that device,
// so operators can send chimes to headphones instead.
let outputDeviceId = '';

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

async function routePlayer(player) {
  if (typeof player?.setSinkId !== 'function' || (player.sinkId || '') === outputDeviceId) return;
  try {
    await player.setSinkId(outputDeviceId);
  } catch {
    // The device was unplugged or is unavailable; fall back to the default device.
    try { await player.setSinkId(''); } catch { /* keep the current device */ }
  }
}

export function setToastSoundOutputDevice(deviceId) {
  outputDeviceId = typeof deviceId === 'string' ? deviceId.trim() : '';
  players.forEach((player) => { routePlayer(player); });
}

export async function listToastSoundOutputDevices() {
  try {
    const devices = await globalThis.navigator?.mediaDevices?.enumerateDevices?.();
    return (Array.isArray(devices) ? devices : [])
      .filter((device) => device.kind === 'audiooutput' && device.deviceId && device.deviceId !== 'default')
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Audio output ${index + 1}`,
      }));
  } catch {
    return [];
  }
}

export function playToastSound(variant = 'info') {
  const player = getPlayer(normalizeVariant(variant));
  if (!player) return;

  const play = () => {
    try {
      player.currentTime = 0;
      const playPromise = player.play();
      playPromise?.catch?.(() => {});
    } catch {
      // Toasts must remain usable if audio playback is unavailable or blocked.
    }
  };

  if (typeof player.setSinkId === 'function' && (player.sinkId || '') !== outputDeviceId) {
    routePlayer(player).then(play, play);
    return;
  }
  play();
}
