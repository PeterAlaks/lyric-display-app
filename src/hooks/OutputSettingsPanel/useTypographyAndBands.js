import { useMemo, useCallback, useEffect } from 'react';
import { sanitizeIntegerInput } from '../../utils/numberInput';

const useTypographyAndBands = ({ settings, applySettings }) => {
  const translationFontSizeMode = settings.translationFontSizeMode ?? 'bound';
  const translationFontSize = settings.translationFontSize ?? settings.fontSize ?? 48;
  const currentFontSize = settings.fontSize ?? 48;
  const translationLineColor = settings.translationLineColor ?? '#FBBF24';

  const dropShadowOffsetX = settings.dropShadowOffsetX ?? 0;
  const dropShadowOffsetY = settings.dropShadowOffsetY ?? 8;
  const dropShadowBlur = settings.dropShadowBlur ?? 10;

  const backgroundBandVerticalPadding = settings.backgroundBandVerticalPadding ?? 20;
  const backgroundBandHeightMode = settings.backgroundBandHeightMode ?? 'adaptive';
  const backgroundBandLockedToMaxLines = settings.backgroundBandLockedToMaxLines ?? false;
  const maxLinesValue = settings.maxLines ?? 3;
  const maxLinesEnabled = settings.maxLinesEnabled ?? false;

  const getDefaultCustomHeight = useCallback(() => {
    if (maxLinesEnabled) {
      return maxLinesValue;
    }
    return 3;
  }, [maxLinesEnabled, maxLinesValue]);

  const backgroundBandCustomLines = useMemo(() => (
    backgroundBandLockedToMaxLines && maxLinesEnabled
      ? maxLinesValue
      : (settings.backgroundBandCustomLines ?? getDefaultCustomHeight())
  ), [backgroundBandLockedToMaxLines, maxLinesEnabled, maxLinesValue, settings.backgroundBandCustomLines, getDefaultCustomHeight]);

  const handleBackgroundHeightModeChange = (mode) => {
    const updates = {
      backgroundBandHeightMode: mode,
      backgroundBandCustomLines: (mode === 'custom' && !settings.backgroundBandCustomLines)
        ? getDefaultCustomHeight()
        : settings.backgroundBandCustomLines,
    };
    applySettings(updates);
  };

  const handleCustomLinesChange = (value) => {
    const fallback = settings.backgroundBandCustomLines ?? getDefaultCustomHeight();
    const numValue = sanitizeIntegerInput(value, fallback, { min: 1 });

    if (maxLinesEnabled && numValue > maxLinesValue) {
      applySettings({ backgroundBandCustomLines: maxLinesValue });
      return;
    }

    applySettings({ backgroundBandCustomLines: numValue });
  };

  const handleTranslationFontSizeModeChange = (mode) => {
    const updates = {
      translationFontSizeMode: mode,
      translationFontSize: (mode === 'custom') ? currentFontSize : settings.translationFontSize,
    };
    applySettings(updates);
  };

  const handleTranslationFontSizeChange = (value) => {
    const numValue = sanitizeIntegerInput(
      value,
      translationFontSize ?? currentFontSize,
      { min: 12, max: currentFontSize, clampMin: false }
    );

    if (numValue > currentFontSize) {
      applySettings({ translationFontSize: currentFontSize });
      return;
    }

    applySettings({ translationFontSize: numValue });
  };

  useEffect(() => {
    if (translationFontSizeMode === 'custom' && translationFontSize > currentFontSize) {
      applySettings({ translationFontSize: currentFontSize });
    }
  }, [applySettings, currentFontSize, translationFontSize, translationFontSizeMode]);

  useEffect(() => {
    if (maxLinesEnabled && backgroundBandHeightMode === 'custom' && backgroundBandCustomLines > maxLinesValue) {
      applySettings({ backgroundBandCustomLines: maxLinesValue });
    }
  }, [applySettings, backgroundBandCustomLines, backgroundBandHeightMode, maxLinesEnabled, maxLinesValue]);

  return {
    translationFontSizeMode,
    translationFontSize,
    currentFontSize,
    translationLineColor,
    dropShadowOffsetX,
    dropShadowOffsetY,
    dropShadowBlur,
    backgroundBandVerticalPadding,
    backgroundBandHeightMode,
    backgroundBandLockedToMaxLines,
    maxLinesValue,
    maxLinesEnabled,
    backgroundBandCustomLines,
    handleBackgroundHeightModeChange,
    handleCustomLinesChange,
    handleTranslationFontSizeModeChange,
    handleTranslationFontSizeChange
  };
};

export default useTypographyAndBands;