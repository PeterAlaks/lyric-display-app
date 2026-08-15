import http from 'http';
import { DEFAULT_OUTPUT_IDS } from '../../shared/outputRegistry.js';

const VALID_RESOLUTIONS = new Set(['720p', '1080p', '4k', 'custom']);
const VALID_FRAMERATES = new Set([15, 24, 25, 30, 50, 60]);
const MIN_CUSTOM_WIDTH = 320;
const MAX_CUSTOM_WIDTH = 7680;
const MIN_CUSTOM_HEIGHT = 240;
const MAX_CUSTOM_HEIGHT = 4320;
const MAX_SOURCE_NAME_LENGTH = 96;

function normalizeOutputList(outputs = []) {
  if (!Array.isArray(outputs)) return [];
  return outputs
    .filter((id) => typeof id === 'string')
    .filter((id) => id.startsWith('output'))
    .filter((id) => id !== 'output1' && id !== 'output2');
}

function normalizeOutputKey(outputKey) {
  const key = String(outputKey || '').trim();
  if (key === 'stage') return key;
  if (/^output\d+$/i.test(key)) return key.toLowerCase();
  return null;
}

function clampNumber(value, fallback, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

function normalizeResolution(value) {
  return VALID_RESOLUTIONS.has(value) ? value : '1080p';
}

function normalizeFramerate(value) {
  const numeric = Number(value);
  return VALID_FRAMERATES.has(numeric) ? numeric : 30;
}

function normalizeSourceName(value, fallback) {
  const trimmed = String(value || '').replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, MAX_SOURCE_NAME_LENGTH);
}

function formatOutputLabel(outputKey) {
  if (outputKey === 'stage') return 'Stage';
  const match = /^output(\d+)$/i.exec(String(outputKey));
  if (match) return `Output ${match[1]}`;
  return String(outputKey);
}

function getOutputDefaults(outputKey) {
  const label = formatOutputLabel(outputKey);
  return {
    enabled: false,
    resolution: '1080p',
    customWidth: 1920,
    customHeight: 1080,
    framerate: 30,
    sourceName: `LyricDisplay ${label}`,
  };
}

function normalizeOutputConfig(outputKey, config = {}) {
  const defaults = getOutputDefaults(outputKey);
  const safeConfig = (config && typeof config === 'object') ? config : {};
  const resolution = normalizeResolution(safeConfig.resolution || defaults.resolution);

  return {
    enabled: Boolean(safeConfig.enabled),
    resolution,
    customWidth: clampNumber(
      safeConfig.customWidth,
      defaults.customWidth,
      MIN_CUSTOM_WIDTH,
      MAX_CUSTOM_WIDTH
    ),
    customHeight: clampNumber(
      safeConfig.customHeight,
      defaults.customHeight,
      MIN_CUSTOM_HEIGHT,
      MAX_CUSTOM_HEIGHT
    ),
    framerate: normalizeFramerate(safeConfig.framerate ?? defaults.framerate),
    sourceName: normalizeSourceName(safeConfig.sourceName, defaults.sourceName),
  };
}

function createOutputSettingsManager({ ndiStore, backendHost, backendPort }) {
  function ensureOutputSettings(outputKey) {
    const defaults = getOutputDefaults(outputKey);
    const current = ndiStore.get(`outputs.${outputKey}`);
    const safeCurrent = (current && typeof current === 'object') ? current : {};
    const merged = normalizeOutputConfig(outputKey, { ...defaults, ...safeCurrent });
    const needsWrite = Object.keys(defaults).some((key) => safeCurrent[key] === undefined) ||
      Object.keys(merged).some((key) => merged[key] !== safeCurrent[key]);

    if (needsWrite) {
      ndiStore.set(`outputs.${outputKey}`, merged);
    }

    return merged;
  }

  function getOutputSettings(outputKey, companionConnected) {
    const settings = ensureOutputSettings(outputKey);
    return {
      settings,
      companionConnected,
      isBroadcasting: settings?.enabled && companionConnected,
    };
  }

  function fetchOutputRegistry(timeoutMs = 1500) {
    const url = `http://${backendHost}:${backendPort}/api/outputs`;
    return new Promise((resolve) => {
      http.get(url, { timeout: timeoutMs }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode !== 200) return resolve(null);
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(null);
          }
        });
      }).on('error', () => resolve(null))
        .on('timeout', function () { this.destroy(); resolve(null); });
    });
  }

  async function syncOutputsFromRegistry() {
    const registry = await fetchOutputRegistry();
    const customOutputs = normalizeOutputList(registry?.outputs || []);
    if (customOutputs.length === 0) return;

    const registered = new Set([...DEFAULT_OUTPUT_IDS, ...customOutputs]);

    for (const outputKey of registered) {
      ensureOutputSettings(outputKey);
    }

    const storedOutputs = ndiStore.get('outputs') || {};
    for (const key of Object.keys(storedOutputs)) {
      if (!key.startsWith('output')) continue;
      if (key === 'output1' || key === 'output2') continue;
      if (!registered.has(key)) {
        ndiStore.set(`outputs.${key}.enabled`, false);
      }
    }
  }

  return {
    normalizeOutputList,
    normalizeOutputKey,
    normalizeOutputConfig,
    ensureOutputSettings,
    getOutputSettings,
    syncOutputsFromRegistry,
  };
}

export {
  normalizeOutputList,
  normalizeOutputKey,
  normalizeOutputConfig,
  formatOutputLabel,
  getOutputDefaults,
  createOutputSettingsManager,
};
