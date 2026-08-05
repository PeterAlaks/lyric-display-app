import React, { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  useCustomOutputIds,
  useLyricsState,
  useOutputEnabled,
  useOutputSettings,
  useOutputState,
} from '../hooks/useStoreSelectors';
import useSocket from '../hooks/useSocket';
import { getLineOutputText } from '../utils/parseLyrics';
import LyricVisualFrame from '../components/output/LyricVisualFrame';
import {
  getTransitionVariants,
  normalizeTransitionDuration,
} from '../../shared/transitionSettings.js';

/**
 * Generic output page component. Renders lyrics with full styling support.
 *
 * @param {Object} props
 * @param {string} props.outputId - The output identifier (e.g. 'output1', 'output2').
 *   Used as the socket role, store settings key, and log label.
 */
const OutputPage = ({ outputId }) => {
  const label = outputId.charAt(0).toUpperCase() + outputId.slice(1);
  const location = useLocation();

  const isDefaultOutput = outputId === 'output1' || outputId === 'output2';
  const customOutputIds = useCustomOutputIds();
  const isOutputAvailable = isDefaultOutput || customOutputIds.includes(outputId);
  const discoveryEnabled = !isDefaultOutput && !isOutputAvailable;
  const searchParams = new URLSearchParams(location.search);
  const isPreviewMode = searchParams.get('preview') === 'true';
  const isProjectionMode = ['1', 'true'].includes((searchParams.get('projection') || '').toLowerCase());
  const showProjectionExitHint = ['1', 'true'].includes((searchParams.get('escapeHint') || '').toLowerCase());

  useSocket('output-discovery', {
    enabled: discoveryEnabled,
  });

  const { isConnected, isAuthenticated, emitOutputMetrics } = useSocket(outputId, {
    enabled: isOutputAvailable,
    preview: isPreviewMode,
  });
  const { settings: outputSettings, updateSettings: updateOutputSettings } = useOutputSettings(outputId);
  const outputEnabled = useOutputEnabled(outputId);
  const { lyrics, selectedLine } = useLyricsState();
  const { isOutputOn } = useOutputState();
  const adjustedFontSizeRef = useRef(null);

  const currentLine = lyrics[selectedLine];
  const line = getLineOutputText(currentLine) || '';

  const isOutputActive = Boolean(outputSettings)
    && (isPreviewMode || Boolean(isOutputOn && (outputEnabled !== false)));
  const outputTransitionVariants = getTransitionVariants(outputSettings?.outputVisibilityTransitionAnimation);
  const outputTransitionSeconds = normalizeTransitionDuration(
    outputSettings?.outputVisibilityTransitionDuration,
    300
  ) / 1000;
  const effectiveOutputTransitionVariants = outputTransitionVariants || {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

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

  return (
    <div
      className="relative h-screen w-screen overflow-hidden"
      style={{ background: isProjectionMode ? '#000000' : 'transparent' }}
    >
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
          visible={Boolean(isOutputActive && line)}
          active={isOutputActive}
          previewMode={isPreviewMode}
          frameKey={selectedLine ?? 'none'}
          label={label}
          isProjectionMode={isProjectionMode}
          showProjectionExitHint={showProjectionExitHint}
          className="relative h-full w-full overflow-hidden"
          onAutosizeChange={handleAutosizeChange}
          retainBackgroundLayerWhenInactive
        />
      </motion.div>
    </div>
  );
};

export default OutputPage;
