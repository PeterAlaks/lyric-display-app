import http from 'http';
import { DEFAULT_OUTPUT_IDS } from '../../shared/outputRegistry.js';

function normalizeOutputList(outputs = []) {
  if (!Array.isArray(outputs)) return [];
  return outputs
    .filter((id) => typeof id === 'string')
    .filter((id) => id.startsWith('output'))
    .filter((id) => id !== 'output1' && id !== 'output2');
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

function createOutputSettingsManager({ ndiStore, backendHost, backendPort }) {
  function ensureOutputSettings(outputKey) {
    const defaults = getOutputDefaults(outputKey);
    const current = ndiStore.get(`outputs.${outputKey}`);
    const safeCurrent = (current && typeof current === 'object') ? current : {};
    const merged = { ...defaults, ...safeCurrent };
    const needsWrite = Object.keys(defaults).some((key) => safeCurrent[key] === undefined);

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
    ensureOutputSettings,
    getOutputSettings,
    syncOutputsFromRegistry,
  };
}

export {
  normalizeOutputList,
  formatOutputLabel,
  getOutputDefaults,
  createOutputSettingsManager,
};
