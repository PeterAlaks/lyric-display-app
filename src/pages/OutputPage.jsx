import React, { useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  useCustomOutputIds,
  useLyricsState,
  useOutputEnabled,
  useOutputSettings,
  useOutputState,
} from '../hooks/useStoreSelectors';
import useSocket from '../hooks/useSocket';
import { getLineOutputText } from '../utils/parseLyrics';
import { combineOutputTexts } from '../utils/scripture';
import LyricVisualFrame from '../components/output/LyricVisualFrame';

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
  const { lyrics, selectedLine, selectedLines } = useLyricsState();
  const { isOutputOn } = useOutputState();

  // A multi-line selection (e.g. several scripture verses) shows every
  // selected line at once; scripture references collapse to a single one at
  // the bottom via combineOutputTexts.
  const multiSelection = Array.isArray(selectedLines) && selectedLines.length > 1
    ? selectedLines.filter((index) => Number.isInteger(index) && index >= 0 && index < lyrics.length)
    : null;
  const isMultiLine = Boolean(multiSelection && multiSelection.length > 1);
  const currentLine = isMultiLine ? null : lyrics[selectedLine];
  const line = isMultiLine
    ? combineOutputTexts(multiSelection.map((index) => getLineOutputText(lyrics[index])))
    : (getLineOutputText(currentLine) || '');

  useEffect(() => {
    const modeStyle = isProjectionMode
      ? 'background: #000000 !important'
      : 'background: transparent !important';
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');

    if (html) html.setAttribute('style', modeStyle);
    if (body) body.setAttribute('style', modeStyle);
    if (root) root.setAttribute('style', modeStyle);

    return () => {
      if (html) html.removeAttribute('style');
      if (body) body.removeAttribute('style');
      if (root) root.removeAttribute('style');
    };
  }, [isProjectionMode]);

  const isOutputActive = Boolean(outputSettings)
    && (isPreviewMode || Boolean(isOutputOn && (outputEnabled !== false)));

  const handleAutosizeChange = useCallback(({ adjustedFontSize, autosizerActive }) => {
    updateOutputSettings({ autosizerActive });

    if (!isPreviewMode && emitOutputMetrics && isConnected && isAuthenticated) {
      try {
        emitOutputMetrics(outputId, {
          adjustedFontSize,
          autosizerActive,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          timestamp: Date.now(),
        });
      } catch { }
    }
  }, [
    emitOutputMetrics,
    isAuthenticated,
    isConnected,
    isPreviewMode,
    outputId,
    updateOutputSettings,
  ]);

  return (
    <LyricVisualFrame
      line={line}
      currentLine={currentLine}
      settings={outputSettings}
      visible={Boolean(isOutputActive && line)}
      active={isOutputActive}
      previewMode={isPreviewMode}
      frameKey={isMultiLine ? `multi-${multiSelection.join('-')}` : (selectedLine ?? 'none')}
      label={label}
      isProjectionMode={isProjectionMode}
      showProjectionExitHint={showProjectionExitHint}
      className="relative w-screen h-screen overflow-hidden"
      onAutosizeChange={handleAutosizeChange}
      idlePlaceholderText={isPreviewMode ? 'Waiting for lyrics...' : null}
    />
  );
};

export default OutputPage;
