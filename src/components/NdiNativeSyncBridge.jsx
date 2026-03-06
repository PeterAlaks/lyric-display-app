import { useEffect, useRef, useState } from 'react';
import { shallow } from 'zustand/shallow';
import useLyricsStore from '../context/LyricsStore';

const OUTPUT_KEYS = ['output1', 'output2', 'stage'];

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildGlobalContentPayload(state) {
  return {
    lyrics: Array.isArray(state.lyrics) ? state.lyrics : [],
    lyricsTimestamps: Array.isArray(state.lyricsTimestamps) ? state.lyricsTimestamps : [],
    lyricsFileName: state.lyricsFileName || '',
    lyricsSections: Array.isArray(state.lyricsSections) ? state.lyricsSections : [],
    lineToSection: state.lineToSection && typeof state.lineToSection === 'object' ? state.lineToSection : {}
  };
}

function buildOutputContentPayload(state, outputKey) {
  const lyrics = Array.isArray(state.lyrics) ? state.lyrics : [];
  const selectedLine = typeof state.selectedLine === 'number' ? state.selectedLine : null;
  const currentLine = selectedLine !== null && selectedLine >= 0 && selectedLine < lyrics.length
    ? lyrics[selectedLine]
    : '';
  const previousLine = selectedLine !== null && selectedLine > 0 && selectedLine - 1 < lyrics.length
    ? lyrics[selectedLine - 1]
    : '';
  const nextLine = selectedLine !== null && selectedLine + 1 >= 0 && selectedLine + 1 < lyrics.length
    ? lyrics[selectedLine + 1]
    : '';

  const perOutputEnabled = outputKey === 'output1'
    ? !!state.output1Enabled
    : outputKey === 'output2'
      ? !!state.output2Enabled
      : !!state.stageEnabled;

  return {
    selectedLine,
    currentLine,
    previousLine,
    nextLine,
    visible: !!state.isOutputOn && perOutputEnabled,
    outputEnabled: perOutputEnabled
  };
}

function buildSceneStylePayload(outputKey, settings = {}) {
  const {
    autosizerActive,
    primaryViewportWidth,
    primaryViewportHeight,
    allInstances,
    instanceCount,
    fullScreenBackgroundMedia,
    fullScreenBackgroundMediaName,
    transitionAnimation,
    transitionSpeed,
    ...rest
  } = settings;

  if (outputKey === 'stage') {
    return {
      ...rest,
      transitionAnimation: transitionAnimation || 'slide',
      transitionSpeed: toNumber(transitionSpeed, 300)
    };
  }

  return {
    ...rest,
    transitionAnimation: transitionAnimation || 'none',
    transitionSpeed: toNumber(transitionSpeed, 150)
  };
}

function buildMediaPayload(outputKey, settings = {}) {
  if (outputKey === 'stage') {
    return {
      mode: 'color',
      backgroundColor: settings.backgroundColor || '#000000'
    };
  }

  const fullScreenMode = !!settings.fullScreenMode;
  const backgroundType = settings.fullScreenBackgroundType || 'color';

  return {
    mode: fullScreenMode ? backgroundType : 'none',
    backgroundColor: settings.fullScreenBackgroundColor || settings.backgroundColor || '#000000',
    media: settings.fullScreenBackgroundMedia || null,
    mediaName: settings.fullScreenBackgroundMediaName || '',
    alwaysShowBackground: !!settings.alwaysShowBackground,
    band: {
      color: settings.backgroundColor || '#000000',
      opacity: toNumber(settings.backgroundOpacity, 0)
    }
  };
}

function buildTransitionPayload(settings = {}) {
  return {
    type: settings.transitionAnimation || 'none',
    durationMs: toNumber(settings.transitionSpeed, 150)
  };
}

function serialize(payload) {
  try {
    return JSON.stringify(payload);
  } catch {
    return '';
  }
}

export default function NdiNativeSyncBridge() {
  const isDesktopApp = useLyricsStore((state) => state.isDesktopApp);
  const state = useLyricsStore((store) => ({
    lyrics: store.lyrics,
    lyricsTimestamps: store.lyricsTimestamps,
    lyricsSections: store.lyricsSections,
    lineToSection: store.lineToSection,
    selectedLine: store.selectedLine,
    lyricsFileName: store.lyricsFileName,
    isOutputOn: store.isOutputOn,
    output1Enabled: store.output1Enabled,
    output2Enabled: store.output2Enabled,
    stageEnabled: store.stageEnabled,
    output1Settings: store.output1Settings,
    output2Settings: store.output2Settings,
    stageSettings: store.stageSettings
  }), shallow);

  const [companionRunning, setCompanionRunning] = useState(false);
  const lastGlobalContentRef = useRef('');
  const lastOutputContentRef = useRef(new Map());
  const lastSceneStyleRef = useRef(new Map());
  const lastMediaRef = useRef(new Map());
  const lastTransitionRef = useRef(new Map());

  useEffect(() => {
    if (!isDesktopApp || !window.electronAPI?.ndi) {
      return undefined;
    }

    let disposed = false;
    let statusInterval = null;
    const ndi = window.electronAPI.ndi;

    const syncStatus = async () => {
      try {
        const status = await ndi.getCompanionStatus?.();
        if (!disposed && typeof status?.running === 'boolean') {
          setCompanionRunning(status.running);
        }
      } catch {
      }
    };

    syncStatus();
    statusInterval = setInterval(syncStatus, 3000);

    const cleanupCompanionStatus = ndi.onCompanionStatus?.((status) => {
      if (typeof status?.running === 'boolean') {
        setCompanionRunning(status.running);
      }
    });

    return () => {
      disposed = true;
      if (statusInterval) {
        clearInterval(statusInterval);
      }
      if (cleanupCompanionStatus) {
        cleanupCompanionStatus();
      }
    };
  }, [isDesktopApp]);

  useEffect(() => {
    if (!isDesktopApp || !companionRunning || !window.electronAPI?.ndi) {
      return undefined;
    }

    const timer = setTimeout(async () => {
      const payload = buildGlobalContentPayload(state);
      const serialized = serialize(payload);

      if (serialized === lastGlobalContentRef.current) {
        return;
      }

      lastGlobalContentRef.current = serialized;

      try {
        await window.electronAPI.ndi.setContent('global', payload);
      } catch {
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [
    isDesktopApp,
    companionRunning,
    state.lyrics,
    state.lyricsTimestamps,
    state.lyricsSections,
    state.lineToSection,
    state.lyricsFileName
  ]);

  useEffect(() => {
    if (!isDesktopApp || !companionRunning || !window.electronAPI?.ndi) {
      return undefined;
    }

    const timer = setTimeout(async () => {
      for (const outputKey of OUTPUT_KEYS) {
        const payload = buildOutputContentPayload(state, outputKey);
        const serialized = serialize(payload);
        const previous = lastOutputContentRef.current.get(outputKey);
        if (serialized === previous) {
          continue;
        }

        lastOutputContentRef.current.set(outputKey, serialized);

        try {
          await window.electronAPI.ndi.setContent(outputKey, payload);
        } catch {
        }
      }
    }, 60);

    return () => clearTimeout(timer);
  }, [
    isDesktopApp,
    companionRunning,
    state.selectedLine,
    state.isOutputOn,
    state.output1Enabled,
    state.output2Enabled,
    state.stageEnabled,
    state.lyrics
  ]);

  useEffect(() => {
    if (!isDesktopApp || !companionRunning || !window.electronAPI?.ndi) {
      return undefined;
    }

    const timer = setTimeout(async () => {
      const settingsByOutput = {
        output1: state.output1Settings,
        output2: state.output2Settings,
        stage: state.stageSettings
      };

      for (const outputKey of OUTPUT_KEYS) {
        const settings = settingsByOutput[outputKey];
        const sceneStyle = buildSceneStylePayload(outputKey, settings);
        const media = buildMediaPayload(outputKey, settings);
        const transition = buildTransitionPayload(settings);

        const sceneSerialized = serialize(sceneStyle);
        const mediaSerialized = serialize(media);
        const transitionSerialized = serialize(transition);

        if (lastSceneStyleRef.current.get(outputKey) !== sceneSerialized) {
          lastSceneStyleRef.current.set(outputKey, sceneSerialized);
          try {
            await window.electronAPI.ndi.setSceneStyle(outputKey, sceneStyle);
          } catch {
          }
        }

        if (lastMediaRef.current.get(outputKey) !== mediaSerialized) {
          lastMediaRef.current.set(outputKey, mediaSerialized);
          try {
            await window.electronAPI.ndi.setMedia(outputKey, media);
          } catch {
          }
        }

        if (lastTransitionRef.current.get(outputKey) !== transitionSerialized) {
          lastTransitionRef.current.set(outputKey, transitionSerialized);
          try {
            await window.electronAPI.ndi.setTransition(outputKey, transition);
          } catch {
          }
        }
      }
    }, 140);

    return () => clearTimeout(timer);
  }, [
    isDesktopApp,
    companionRunning,
    state.output1Settings,
    state.output2Settings,
    state.stageSettings
  ]);

  return null;
}
