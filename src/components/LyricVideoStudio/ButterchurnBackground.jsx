import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import butterchurn from 'butterchurn';
import {
  BUTTERCHURN_QUALITY_LEVELS,
  normalizeLyricVideoVisualizer,
} from '../../../shared/lyricVideoVisualizer.js';
import {
  getButterchurnPreset,
  resolveButterchurnPresetId,
} from '../../utils/butterchurnPresets.js';

const AUDIO_SAMPLE_COUNT = 1024;
const MAX_PREVIEW_WIDTH = 1280;
const decodedAudioCache = new Map();

const QUALITY_OPTIONS = {
  [BUTTERCHURN_QUALITY_LEVELS.DRAFT]: {
    textureRatio: 0.5,
    meshWidth: 32,
    meshHeight: 24,
  },
  [BUTTERCHURN_QUALITY_LEVELS.BALANCED]: {
    textureRatio: 0.75,
    meshWidth: 48,
    meshHeight: 36,
  },
  [BUTTERCHURN_QUALITY_LEVELS.HIGH]: {
    textureRatio: 1,
    meshWidth: 64,
    meshHeight: 48,
  },
};

const getAudioContextConstructor = () => window.AudioContext || window.webkitAudioContext;

const decodeAudioSource = async (source) => {
  if (!source) return null;
  if (decodedAudioCache.has(source)) return decodedAudioCache.get(source);

  const decodePromise = (async () => {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Visualizer audio could not be read (${response.status}).`);
    }

    const AudioContextConstructor = getAudioContextConstructor();
    if (!AudioContextConstructor) {
      throw new Error('Web Audio is unavailable on this system.');
    }

    const context = new AudioContextConstructor();
    try {
      const encodedAudio = await response.arrayBuffer();
      return await context.decodeAudioData(encodedAudio);
    } finally {
      await context.close().catch(() => { });
    }
  })();

  decodedAudioCache.set(source, decodePromise);
  decodePromise.catch(() => {
    if (decodedAudioCache.get(source) === decodePromise) {
      decodedAudioCache.delete(source);
    }
  });

  if (decodedAudioCache.size > 3) {
    const oldestKey = decodedAudioCache.keys().next().value;
    if (oldestKey !== source) decodedAudioCache.delete(oldestKey);
  }

  return decodePromise;
};

const hasWebGl2 = () => {
  const probe = document.createElement('canvas');
  const context = probe.getContext('webgl2');
  if (!context) return false;
  context.getExtension('WEBGL_lose_context')?.loseContext();
  return true;
};

const createVisualizer = ({ canvas, width, height, quality, seed }) => {
  const qualityOptions = QUALITY_OPTIONS[quality] || QUALITY_OPTIONS.balanced;
  const originalMathRandom = Math.random;
  const originalWindowRand = window.rand;
  const originalWindowRandInt = window.randint;

  try {
    // Butterchurn 3 renders WebGL into an OffscreenCanvas and normally copies it
    // into a 2D canvas every frame. Chromium can retain those 2D copies under a
    // sustained preview. A bitmap renderer consumes each transferred frame and
    // releases the previous one instead of building native-memory pressure.
    const fallbackOutputCanvas = document.createElement('canvas');
    const visualizer = butterchurn.createVisualizer(null, fallbackOutputCanvas, {
      width,
      height,
      pixelRatio: 1,
      textureRatio: qualityOptions.textureRatio,
      meshWidth: qualityOptions.meshWidth,
      meshHeight: qualityOptions.meshHeight,
      deterministic: true,
      seed,
      onlyUseWASM: true,
    });

    let presentFrame = () => { };
    const internalCanvas = visualizer.internalCanvas;
    const canTransferBitmap = typeof internalCanvas?.transferToImageBitmap === 'function';
    const bitmapRenderer = canTransferBitmap ? canvas.getContext('bitmaprenderer') : null;
    if (bitmapRenderer) {
      visualizer.outputGl = null;
      presentFrame = () => {
        const frame = internalCanvas.transferToImageBitmap();
        bitmapRenderer.transferFromImageBitmap(frame);
      };
    } else {
      visualizer.setCanvas(canvas);
    }

    return {
      visualizer,
      presentFrame,
      randomContext: {
        mathRandom: Math.random,
        windowRand: window.rand,
        windowRandInt: window.randint,
      },
    };
  } finally {
    // Butterchurn's deterministic beta replaces these globals. Its renderers keep
    // their seeded RNG references, so restore the application globals immediately.
    Math.random = originalMathRandom;
    window.rand = originalWindowRand;
    window.randint = originalWindowRandInt;
  }
};

const runWithRandomContext = (randomContext, operation) => {
  const originalMathRandom = Math.random;
  const originalWindowRand = window.rand;
  const originalWindowRandInt = window.randint;
  Math.random = randomContext.mathRandom;
  window.rand = randomContext.windowRand;
  window.randint = randomContext.windowRandInt;

  try {
    const result = operation();
    if (result && typeof result.finally === 'function') {
      return result.finally(() => {
        Math.random = originalMathRandom;
        window.rand = originalWindowRand;
        window.randint = originalWindowRandInt;
      });
    }
    Math.random = originalMathRandom;
    window.rand = originalWindowRand;
    window.randint = originalWindowRandInt;
    return result;
  } catch (error) {
    Math.random = originalMathRandom;
    window.rand = originalWindowRand;
    window.randint = originalWindowRandInt;
    throw error;
  }
};

const installFixedFrameClock = (visualizer) => {
  const renderer = visualizer?.renderer;
  if (!renderer) return;

  // Butterchurn normally estimates FPS from wall-clock render cadence. Export
  // renders faster than real time, so use the supplied frame duration directly.
  renderer.calcTimeAndFPS = (elapsedTime) => {
    const safeElapsedTime = Math.max(1 / 240, Math.min(1, Number(elapsedTime) || (1 / 30)));
    renderer.fps = 1 / safeElapsedTime;
    if (renderer.frameNum > 0) {
      renderer.time += safeElapsedTime;
    }

    if (!renderer.blending) return;
    if (renderer.blendDuration <= 0) {
      renderer.blendProgress = 1;
      renderer.blending = false;
      return;
    }

    renderer.blendProgress = (renderer.time - renderer.blendStartTime) / renderer.blendDuration;
    if (renderer.blendProgress >= 1) {
      renderer.blendProgress = 1;
      renderer.blending = false;
    }
  };
};

const createAudioLevelBuffers = () => ({
  timeByteArray: new Uint8Array(AUDIO_SAMPLE_COUNT),
  timeByteArrayL: new Uint8Array(AUDIO_SAMPLE_COUNT),
  timeByteArrayR: new Uint8Array(AUDIO_SAMPLE_COUNT),
});

const sampleToByte = (sample, sensitivity) => (
  Math.round(128 + (Math.max(-1, Math.min(1, sample * sensitivity)) * 127))
);

const fillAudioLevels = ({ audioBuffer, audioTimeMs, sensitivity, levels }) => {
  levels.timeByteArray.fill(128);
  levels.timeByteArrayL.fill(128);
  levels.timeByteArrayR.fill(128);
  if (!audioBuffer || audioTimeMs < 0 || audioTimeMs > audioBuffer.duration * 1000) return levels;

  const left = audioBuffer.getChannelData(0);
  const right = audioBuffer.numberOfChannels > 1
    ? audioBuffer.getChannelData(1)
    : left;
  const centerSample = Math.round((audioTimeMs / 1000) * audioBuffer.sampleRate);
  const startSample = centerSample - Math.floor(AUDIO_SAMPLE_COUNT / 2);

  for (let index = 0; index < AUDIO_SAMPLE_COUNT; index += 1) {
    const sourceIndex = startSample + index;
    if (sourceIndex < 0 || sourceIndex >= audioBuffer.length) continue;
    const leftSample = left[sourceIndex] || 0;
    const rightSample = right[sourceIndex] || 0;
    levels.timeByteArrayL[index] = sampleToByte(leftSample, sensitivity);
    levels.timeByteArrayR[index] = sampleToByte(rightSample, sensitivity);
    levels.timeByteArray[index] = sampleToByte((leftSample + rightSample) / 2, sensitivity);
  }

  return levels;
};

const normalizeRenderDimensions = ({ width, height, preview }) => {
  const safeWidth = Math.max(320, Math.round(Number(width) || 1920));
  const safeHeight = Math.max(180, Math.round(Number(height) || 1080));
  if (!preview || safeWidth <= MAX_PREVIEW_WIDTH) {
    return { width: safeWidth, height: safeHeight };
  }

  const scale = MAX_PREVIEW_WIDTH / safeWidth;
  return {
    width: MAX_PREVIEW_WIDTH,
    height: Math.max(180, Math.round(safeHeight * scale)),
  };
};

const ButterchurnBackground = forwardRef(function ButterchurnBackground({
  enabled = false,
  visualizer: visualizerSettings,
  audioSource = '',
  currentTimeMs = 0,
  audioStartTimeMs = 0,
  width = 1920,
  height = 1080,
  fps = 30,
  preview = false,
  responsive = false,
  manual = false,
  realtime = false,
  showStatus = false,
  statusScale = 1,
  onReady,
  onError,
  className = 'absolute inset-0',
}, forwardedRef) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const controllerRef = useRef(null);
  const readyPromiseRef = useRef(Promise.resolve(false));
  const initializationErrorRef = useRef(null);
  const operationQueueRef = useRef(Promise.resolve());
  const buildVersionRef = useRef(0);
  const autoRenderActiveRef = useRef(false);
  const pendingAutoRenderRef = useRef(null);
  const callbackRef = useRef({ onReady, onError });
  const [status, setStatus] = useState(enabled ? 'loading' : 'idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [responsiveDimensions, setResponsiveDimensions] = useState(() => ({
    width: typeof window === 'undefined' ? 1920 : Math.max(320, window.innerWidth),
    height: typeof window === 'undefined' ? 1080 : Math.max(180, window.innerHeight),
  }));

  const normalized = normalizeLyricVideoVisualizer(visualizerSettings);
  const resolvedPresetId = resolveButterchurnPresetId(normalized);
  const renderDimensions = normalizeRenderDimensions({
    width: responsive ? responsiveDimensions.width : width,
    height: responsive ? responsiveDimensions.height : height,
    preview,
  });
  const safeFps = Math.max(1, Math.min(120, Number(fps) || 30));
  const safeStatusScale = Math.max(0.05, Math.min(1, Number(statusScale) || 1));

  useEffect(() => {
    callbackRef.current = { onReady, onError };
  }, [onError, onReady]);

  useLayoutEffect(() => {
    if (!enabled || !responsive) return undefined;
    const node = containerRef.current;
    if (!node) return undefined;

    const updateDimensions = () => {
      const rect = node.getBoundingClientRect();
      const nextWidth = Math.max(320, Math.round(rect.width || window.innerWidth || 1920));
      const nextHeight = Math.max(180, Math.round(rect.height || window.innerHeight || 1080));
      setResponsiveDimensions((current) => (
        current.width === nextWidth && current.height === nextHeight
          ? current
          : { width: nextWidth, height: nextHeight }
      ));
    };

    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, responsive]);

  useEffect(() => {
    if (!enabled) {
      buildVersionRef.current += 1;
      controllerRef.current?.visualizer?.loseGLContext?.();
      controllerRef.current = null;
      pendingAutoRenderRef.current = null;
      readyPromiseRef.current = Promise.resolve(false);
      initializationErrorRef.current = null;
      setStatus('idle');
      setErrorMessage('');
      return undefined;
    }

    const buildVersion = buildVersionRef.current + 1;
    buildVersionRef.current = buildVersion;
    initializationErrorRef.current = null;
    setStatus('loading');
    setErrorMessage('');

    const initialize = async () => {
      if (!hasWebGl2()) {
        throw new Error('MilkDrop backgrounds require WebGL2. Enable hardware acceleration or choose Colour or Media.');
      }

      const audioBuffer = await decodeAudioSource(audioSource);
      if (buildVersionRef.current !== buildVersion) return false;

      const canvas = canvasRef.current;
      if (!canvas) return false;
      canvas.width = renderDimensions.width;
      canvas.height = renderDimensions.height;

      controllerRef.current?.visualizer?.loseGLContext?.();
      const nextController = createVisualizer({
        canvas,
        width: renderDimensions.width,
        height: renderDimensions.height,
        quality: normalized.quality,
        seed: normalized.seed,
      });
      installFixedFrameClock(nextController.visualizer);
      await runWithRandomContext(
        nextController.randomContext,
        () => nextController.visualizer.loadPreset(getButterchurnPreset(resolvedPresetId), 0)
      );

      if (buildVersionRef.current !== buildVersion) {
        nextController.visualizer.loseGLContext?.();
        return false;
      }

      controllerRef.current = {
        ...nextController,
        audioBuffer,
        audioLevels: createAudioLevelBuffers(),
        lastTimelineTimeMs: null,
      };

      const initialTimelineTimeMs = Math.max(0, Number(currentTimeMs) || 0);
      const initialAudioLevels = fillAudioLevels({
        audioBuffer,
        audioTimeMs: initialTimelineTimeMs - Math.max(0, Number(audioStartTimeMs) || 0),
        sensitivity: normalized.sensitivity,
        levels: controllerRef.current.audioLevels,
      });
      runWithRandomContext(
        nextController.randomContext,
        () => nextController.visualizer.render({ audioLevels: initialAudioLevels, elapsedTime: 1 / safeFps })
      );
      nextController.presentFrame();
      controllerRef.current.lastTimelineTimeMs = initialTimelineTimeMs;
      setStatus('ready');
      initializationErrorRef.current = null;
      callbackRef.current.onReady?.();
      return true;
    };

    const readyPromise = initialize().catch((error) => {
      if (buildVersionRef.current !== buildVersion) return false;
      const message = error?.message || 'The MilkDrop background could not be initialized.';
      const initializationError = error instanceof Error ? error : new Error(message);
      controllerRef.current?.visualizer?.loseGLContext?.();
      controllerRef.current = null;
      initializationErrorRef.current = initializationError;
      setStatus('error');
      setErrorMessage(message);
      console.error('[Visualizer] MilkDrop background initialization failed:', initializationError);
      callbackRef.current.onError?.(initializationError);
      return false;
    });
    readyPromiseRef.current = readyPromise;

    return () => {
      if (buildVersionRef.current === buildVersion) {
        buildVersionRef.current += 1;
      }
    };
  }, [
    audioSource,
    enabled,
    resolvedPresetId,
    normalized.quality,
    normalized.seed,
    renderDimensions.height,
    renderDimensions.width,
    safeFps,
  ]);

  useEffect(() => () => {
    buildVersionRef.current += 1;
    pendingAutoRenderRef.current = null;
    controllerRef.current?.visualizer?.loseGLContext?.();
    controllerRef.current = null;
  }, []);

  const waitUntilReady = async () => {
    const ready = await readyPromiseRef.current;
    if (initializationErrorRef.current) throw initializationErrorRef.current;
    return ready;
  };

  const resetController = async () => {
    if (!enabled) return false;
    await readyPromiseRef.current;
    const current = controllerRef.current;
    const canvas = canvasRef.current;
    if (!current || !canvas) return false;

    current.visualizer?.loseGLContext?.();
    const nextController = createVisualizer({
      canvas,
      width: renderDimensions.width,
      height: renderDimensions.height,
      quality: normalized.quality,
      seed: normalized.seed,
    });
    installFixedFrameClock(nextController.visualizer);
    await runWithRandomContext(
      nextController.randomContext,
      () => nextController.visualizer.loadPreset(getButterchurnPreset(resolvedPresetId), 0)
    );
    controllerRef.current = {
      ...nextController,
      audioBuffer: current.audioBuffer,
      audioLevels: createAudioLevelBuffers(),
      lastTimelineTimeMs: null,
    };
    return true;
  };

  const renderFrameInternal = async ({
    timelineTimeMs = currentTimeMs,
    elapsedTime = 1 / safeFps,
    resetOnDiscontinuity = false,
  } = {}) => {
    if (!enabled) return false;
    await readyPromiseRef.current;

    let controller = controllerRef.current;
    if (!controller) return false;
    const safeTimelineTimeMs = Math.max(0, Number(timelineTimeMs) || 0);
    const previousTimeMs = controller.lastTimelineTimeMs;
    const discontinuity = previousTimeMs !== null && (
      safeTimelineTimeMs < previousTimeMs - 50
      || safeTimelineTimeMs - previousTimeMs > 750
    );

    if (resetOnDiscontinuity && discontinuity) {
      await resetController();
      controller = controllerRef.current;
      if (!controller) return false;
    }

    const audioLevels = fillAudioLevels({
      audioBuffer: controller.audioBuffer,
      audioTimeMs: safeTimelineTimeMs - Math.max(0, Number(audioStartTimeMs) || 0),
      sensitivity: normalized.sensitivity,
      levels: controller.audioLevels,
    });
    runWithRandomContext(
      controller.randomContext,
      () => controller.visualizer.render({
        audioLevels,
        elapsedTime: Math.max(1 / 240, Math.min(1, Number(elapsedTime) || (1 / safeFps))),
      })
    );
    controller.presentFrame();
    controller.lastTimelineTimeMs = safeTimelineTimeMs;
    return true;
  };

  const enqueueOperation = (operation) => {
    const nextOperation = operationQueueRef.current
      .catch(() => { })
      .then(operation);
    operationQueueRef.current = nextOperation;
    return nextOperation;
  };

  const reset = () => enqueueOperation(resetController);
  const renderFrame = (options) => enqueueOperation(() => renderFrameInternal(options));

  useImperativeHandle(forwardedRef, () => ({
    isReady: () => status === 'ready' && Boolean(controllerRef.current),
    waitUntilReady,
    reset,
    renderFrame,
  }));

  useLayoutEffect(() => {
    if (!enabled || manual || realtime) return;
    const controller = controllerRef.current;
    const previousTimeMs = controller?.lastTimelineTimeMs;
    const safeCurrentTimeMs = Math.max(0, Number(currentTimeMs) || 0);
    const signedTimelineDeltaMs = previousTimeMs === null || previousTimeMs === undefined
      ? 1000 / safeFps
      : safeCurrentTimeMs - previousTimeMs;
    const targetFrameDurationMs = 1000 / safeFps;
    if (signedTimelineDeltaMs > 0 && signedTimelineDeltaMs < targetFrameDurationMs * 0.8) return;
    const timelineDeltaMs = signedTimelineDeltaMs > 0
      ? signedTimelineDeltaMs
      : targetFrameDurationMs;

    pendingAutoRenderRef.current = {
      timelineTimeMs: currentTimeMs,
      elapsedTime: Math.max(1 / safeFps, Math.min(0.25, timelineDeltaMs / 1000)),
      resetOnDiscontinuity: true,
    };

    if (autoRenderActiveRef.current) return;
    autoRenderActiveRef.current = true;
    void (async () => {
      try {
        await readyPromiseRef.current;
        while (pendingAutoRenderRef.current) {
          const pendingFrame = pendingAutoRenderRef.current;
          pendingAutoRenderRef.current = null;
          await enqueueOperation(() => renderFrameInternal(pendingFrame));
        }
      } catch { }
      finally {
        autoRenderActiveRef.current = false;
      }
    })();
  }, [
    currentTimeMs,
    enabled,
    manual,
    normalized.sensitivity,
    realtime,
    safeFps,
  ]);

  useEffect(() => {
    if (!enabled || manual || !realtime) return undefined;

    let frameId = null;
    let startedAt = null;
    let previousFrameAt = null;
    let stopped = false;

    const tick = (now) => {
      if (stopped) return;
      if (startedAt === null) startedAt = now;
      const elapsedTime = previousFrameAt === null
        ? 1 / safeFps
        : Math.max(1 / 240, Math.min(0.25, (now - previousFrameAt) / 1000));
      const targetFrameDurationMs = 1000 / safeFps;

      if (previousFrameAt === null || now - previousFrameAt >= targetFrameDurationMs * 0.8) {
        previousFrameAt = now;
        pendingAutoRenderRef.current = {
          timelineTimeMs: now - startedAt,
          elapsedTime,
          resetOnDiscontinuity: false,
        };

        if (!autoRenderActiveRef.current) {
          autoRenderActiveRef.current = true;
          void (async () => {
            try {
              await readyPromiseRef.current;
              while (pendingAutoRenderRef.current && !stopped) {
                const pendingFrame = pendingAutoRenderRef.current;
                pendingAutoRenderRef.current = null;
                await enqueueOperation(() => renderFrameInternal(pendingFrame));
              }
            } catch { }
            finally {
              autoRenderActiveRef.current = false;
            }
          })();
        }
      }

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => {
      stopped = true;
      pendingAutoRenderRef.current = null;
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, [enabled, manual, normalized.sensitivity, realtime, safeFps]);

  if (!enabled) return null;

  return (
    <div ref={containerRef} aria-hidden="true" className={`${className} overflow-hidden bg-black`}>
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        style={{ display: 'block' }}
      />
      <div
        className="pointer-events-none absolute inset-0 bg-black"
        style={{ opacity: normalized.dimming / 100 }}
      />
      {showStatus && status !== 'ready' && (
        <div
          className="pointer-events-none absolute inset-x-0 z-10 text-center text-white/90"
          style={{
            bottom: `${16 / safeStatusScale}px`,
            padding: `${8 / safeStatusScale}px ${16 / safeStatusScale}px`,
            fontSize: `${12 / safeStatusScale}px`,
            lineHeight: 1.4,
            background: 'rgba(0, 0, 0, 0.72)',
          }}
        >
          {status === 'error' ? errorMessage : 'Preparing MilkDrop background…'}
        </div>
      )}
    </div>
  );
});

export default ButterchurnBackground;
