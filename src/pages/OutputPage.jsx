import React, { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  useLyricsState,
  useOutputEnabled,
  useOutputSettings,
  useOutputState,
} from '../hooks/useStoreSelectors';
import useSocket from '../hooks/useSocket';
import useOutputRouteAvailability from '../hooks/useOutputRouteAvailability';
import { getLineOutputText, shouldShowSongCredits } from '../utils/parseLyrics';
import { formatSongCreditLines } from '../../shared/lyricsParsing/songMetadata.js';
import { sanitizeNumberInput } from '../utils/numberInput';
import LyricVisualFrame from '../components/output/LyricVisualFrame';
import {
  getTransitionVariants,
  normalizeTransitionDuration,
} from '../../shared/transitionSettings.js';

const SONG_CREDITS_POSITION_CLASSES = {
  'bottom-left': 'bottom-0 left-0 text-left',
  'bottom-center': 'bottom-0 inset-x-0 text-center',
  'bottom-right': 'bottom-0 right-0 text-right',
  'top-left': 'top-0 left-0 text-left',
  'top-center': 'top-0 inset-x-0 text-center',
  'top-right': 'top-0 right-0 text-right',
};

function SongCreditsOverlay({ lines, settings }) {
  const position = SONG_CREDITS_POSITION_CLASSES[settings?.songCreditsPosition]
    ? settings.songCreditsPosition
    : 'bottom-left';
  const fontSize = sanitizeNumberInput(settings?.songCreditsFontSize, 22, { min: 10, max: 72 });

  return (
    <div
      className={`pointer-events-none absolute z-30 max-w-[90%] ${SONG_CREDITS_POSITION_CLASSES[position]}`}
      style={{
        margin: `${sanitizeNumberInput(settings?.yMargin, 2, { min: 0, max: 20 })}rem ${sanitizeNumberInput(settings?.xMargin, 3.5, { min: 0, max: 20 })}rem`,
        color: settings?.songCreditsColor || '#FFFFFF',
        opacity: sanitizeNumberInput(settings?.songCreditsOpacity, 85, { min: 0, max: 100 }) / 100,
        fontFamily: 'Inter, "Segoe UI", system-ui, sans-serif',
        fontSize: `${fontSize}px`,
        lineHeight: 1.35,
        textShadow: '0 1px 3px rgba(0, 0, 0, 0.85)',
      }}
      data-song-credits
    >
      {lines.map((creditLine, index) => (
        <div key={index} className={index === 0 ? 'font-semibold' : 'font-normal'}>{creditLine}</div>
      ))}
    </div>
  );
}

/**
 * What a lyric output draws, driven only by the store. The output window feeds it over its
 * socket; the control window's previews render it directly at a chosen screen size.
 *
 * @param {Object} props
 * @param {string} props.outputId - Store settings key (e.g. 'output1', 'output2', a custom output).
 * @param {boolean} [props.preview] - Previews always show the current line, even while outputs are off.
 */
export function OutputFrame({
  outputId,
  preview = false,
  isProjectionMode = false,
  showProjectionExitHint = false,
  onAutosizeChange,
  className = 'relative h-full w-full overflow-hidden',
}) {
  const label = outputId.charAt(0).toUpperCase() + outputId.slice(1);
  const { settings: outputSettings } = useOutputSettings(outputId);
  const outputEnabled = useOutputEnabled(outputId);
  const { lyrics, selectedLine, songMetadata } = useLyricsState();
  const { isOutputOn } = useOutputState();

  const currentLine = lyrics[selectedLine];
  const line = getLineOutputText(currentLine) || '';
  const songCreditLines = shouldShowSongCredits({
    mode: outputSettings?.songCreditsMode,
    lyrics,
    selectedLine,
  }) ? formatSongCreditLines(songMetadata) : [];

  const isOutputActive = Boolean(outputSettings)
    && (preview || Boolean(isOutputOn && (outputEnabled !== false)));
  const outputTransitionVariants = getTransitionVariants(outputSettings?.outputVisibilityTransitionAnimation);
  const outputTransitionSeconds = normalizeTransitionDuration(
    outputSettings?.outputVisibilityTransitionDuration,
    300
  ) / 1000;
  const keepFullScreenBackgroundVisible = Boolean(
    outputSettings?.fullScreenMode && outputSettings?.alwaysShowBackground
  );
  const effectiveOutputTransitionVariants = outputTransitionVariants || {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  return (
    <div
      className={className}
      style={{ background: isProjectionMode ? '#000000' : 'transparent' }}
    >
      {keepFullScreenBackgroundVisible && (
        <LyricVisualFrame
          line=""
          settings={outputSettings}
          visible={false}
          active
          previewMode={preview}
          label={label}
          isProjectionMode={isProjectionMode}
          className="absolute inset-0 h-full w-full overflow-hidden"
          renderFullScreenElementLayer={false}
          retainBackgroundLayerWhenInactive
        />
      )}
      <motion.div
        className="absolute inset-0"
        aria-hidden={!isOutputActive}
        variants={effectiveOutputTransitionVariants}
        initial={isOutputActive ? 'visible' : 'hidden'}
        animate={isOutputActive ? 'visible' : 'hidden'}
        transition={{
          duration: outputTransitionVariants ? outputTransitionSeconds : 0,
          ease: [0.25, 0.46, 0.45, 0.94],
        }}
        style={{ pointerEvents: isOutputActive ? 'auto' : 'none' }}
      >
        <LyricVisualFrame
          line={line}
          currentLine={currentLine}
          settings={outputSettings}
          visible={Boolean(line)}
          active={isOutputActive}
          previewMode={preview}
          frameKey={selectedLine ?? 'none'}
          label={label}
          isProjectionMode={isProjectionMode}
          showProjectionExitHint={showProjectionExitHint}
          className="relative h-full w-full overflow-hidden"
          onAutosizeChange={onAutosizeChange}
          renderBackgroundLayer={!keepFullScreenBackgroundVisible}
          retainBackgroundLayerWhenInactive
          retainContentWhenInactive
        />
        {songCreditLines.length > 0 && (
          <SongCreditsOverlay lines={songCreditLines} settings={outputSettings} />
        )}
      </motion.div>
    </div>
  );
}

/**
 * Output window route: connects to the backend, reports metrics, and renders the OutputFrame.
 *
 * @param {Object} props
 * @param {string} props.outputId - The output identifier (e.g. 'output1', 'output2').
 *   Used as the socket role, store settings key, and log label.
 */
const OutputPage = ({ outputId }) => {
  const location = useLocation();

  const isDefaultOutput = outputId === 'output1' || outputId === 'output2';
  const { available: isOutputAvailable } = useOutputRouteAvailability(outputId);
  const searchParams = new URLSearchParams(location.search);
  const isPreviewMode = searchParams.get('preview') === 'true';
  const isProjectionMode = ['1', 'true'].includes((searchParams.get('projection') || '').toLowerCase());
  const showProjectionExitHint = ['1', 'true'].includes((searchParams.get('escapeHint') || '').toLowerCase());

  const { isConnected, isAuthenticated, emitOutputMetrics } = useSocket(outputId, {
    enabled: isOutputAvailable,
    preview: isPreviewMode,
  });
  const { settings: outputSettings, updateSettings: updateOutputSettings } = useOutputSettings(outputId);
  const adjustedFontSizeRef = useRef(null);

  const publishOutputMetrics = useCallback((metrics = {}) => {
    if (!isPreviewMode && emitOutputMetrics && isConnected && isAuthenticated) {
      try {
        emitOutputMetrics(outputId, {
          adjustedFontSize: adjustedFontSizeRef.current,
          autosizerActive: Boolean(outputSettings?.autosizerActive),
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          timestamp: Date.now(),
          ...metrics,
        });
      } catch { }
    }
  }, [emitOutputMetrics, isAuthenticated, isConnected, isPreviewMode, outputId, outputSettings?.autosizerActive]);

  const handleAutosizeChange = useCallback(({ adjustedFontSize, autosizerActive }) => {
    adjustedFontSizeRef.current = adjustedFontSize;
    updateOutputSettings({ autosizerActive });
    publishOutputMetrics({ adjustedFontSize, autosizerActive });
  }, [
    publishOutputMetrics,
    updateOutputSettings,
  ]);

  useEffect(() => {
    if (isPreviewMode || !isConnected || !isAuthenticated) return undefined;
    publishOutputMetrics();
    const interval = window.setInterval(publishOutputMetrics, 5000);
    return () => window.clearInterval(interval);
  }, [isAuthenticated, isConnected, isPreviewMode, publishOutputMetrics]);

  if (!isDefaultOutput && !isOutputAvailable) {
    return (
      <div
        className="h-screen w-screen overflow-hidden"
        style={{ background: isProjectionMode ? '#000000' : 'transparent' }}
        aria-hidden="true"
      />
    );
  }

  return (
    <OutputFrame
      outputId={outputId}
      preview={isPreviewMode}
      isProjectionMode={isProjectionMode}
      showProjectionExitHint={showProjectionExitHint}
      onAutosizeChange={handleAutosizeChange}
      className="relative h-screen w-screen overflow-hidden"
    />
  );
};

export default OutputPage;
