import { useEffect, useState } from 'react';
import {
  isDefaultOutputId,
  isRoutableOutputId,
  normalizeCustomOutputRouteIds,
} from '../../shared/outputRegistry.js';
import useLyricsStore from '../context/LyricsStore';
import { resolveBackendUrl } from '../utils/network';
import { logDebug } from '../utils/logger';

const REGISTRY_POLL_INTERVAL_MS = 1500;

const arraysEqual = (left, right) => (
  left.length === right.length && left.every((value, index) => value === right[index])
);

const getRegistryOutputs = (payload) => {
  if (!payload || !Array.isArray(payload.outputs)) return null;
  return Array.from(new Set(payload.outputs.filter((outputId) => isRoutableOutputId(outputId))));
};

const applyCustomOutputs = (outputs) => {
  const customOutputs = normalizeCustomOutputRouteIds(outputs);
  const store = useLyricsStore.getState();
  const current = normalizeCustomOutputRouteIds(store.customOutputIds);
  if (!arraysEqual(current, customOutputs)) {
    store.setCustomOutputs(customOutputs);
  }
};

export default function useOutputRouteAvailability(outputId) {
  const defaultOutput = isDefaultOutputId(outputId);
  const [status, setStatus] = useState(() => ({
    verified: defaultOutput,
    available: defaultOutput,
  }));

  useEffect(() => {
    if (defaultOutput) {
      setStatus((current) => (
        current.verified && current.available
          ? current
          : { verified: true, available: true }
      ));
      return undefined;
    }

    let active = true;
    let pollTimer = null;
    let requestController = null;
    let registryGeneration = 0;

    const applyRegistry = (outputs) => {
      if (!active) return;
      applyCustomOutputs(outputs);
      const available = outputs.includes(outputId);
      setStatus((current) => (
        current.verified && current.available === available
          ? current
          : { verified: true, available }
      ));
    };

    const pollRegistry = async () => {
      requestController?.abort();
      requestController = new AbortController();
      const requestGeneration = registryGeneration;

      try {
        const response = await fetch(resolveBackendUrl('/api/outputs'), {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal: requestController.signal,
        });
        if (!response.ok) throw new Error(`Output registry request failed (${response.status})`);

        const outputs = getRegistryOutputs(await response.json());
        if (!outputs) throw new Error('Output registry response was invalid');
        if (requestGeneration !== registryGeneration) return;
        applyRegistry(outputs);
      } catch (error) {
        if (error?.name !== 'AbortError') {
          logDebug(`Could not verify ${outputId} availability:`, error);
        }
      } finally {
        if (active) {
          pollTimer = window.setTimeout(pollRegistry, REGISTRY_POLL_INTERVAL_MS);
        }
      }
    };

    const handleRegistryUpdate = (event) => {
      const outputs = getRegistryOutputs(event?.detail);
      if (outputs) {
        registryGeneration += 1;
        applyRegistry(outputs);
      }
    };

    const handleRouteUnavailable = (event) => {
      if (event?.detail?.output !== outputId) return;
      registryGeneration += 1;
      const store = useLyricsStore.getState();
      store.removeCustomOutput?.(outputId);
      setStatus({ verified: true, available: false });
    };

    window.addEventListener('output-registry-updated', handleRegistryUpdate);
    window.addEventListener('output-route-unavailable', handleRouteUnavailable);
    pollRegistry();

    return () => {
      active = false;
      if (pollTimer) window.clearTimeout(pollTimer);
      requestController?.abort();
      window.removeEventListener('output-registry-updated', handleRegistryUpdate);
      window.removeEventListener('output-route-unavailable', handleRouteUnavailable);
      logDebug(`Stopped output registry watcher for ${outputId}`);
    };
  }, [defaultOutput, outputId]);

  return status;
}
