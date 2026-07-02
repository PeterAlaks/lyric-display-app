const useFullscreenModeState = ({ settings, applySettings }) => {
  const fullScreenModeChecked = Boolean(settings.fullScreenMode);
  const lyricsPositionValue = settings.lyricsPosition ?? 'lower';
  const fullScreenBackgroundTypeValue = settings.fullScreenBackgroundType ?? 'color';
  const fullScreenBackgroundColorValue = settings.fullScreenBackgroundColor ?? '#000000';
  const fullScreenBackgroundPaintValue = settings.fullScreenBackgroundPaint;
  const fullScreenRestorePosition = settings.fullScreenRestorePosition ?? null;
  const backgroundDisabledTooltip = 'Cannot use background setting in full screen mode.';

  const handleLyricsPositionChange = (val) => {
    applySettings({ lyricsPosition: val });
  };

  const handleFullScreenToggle = (checked) => {
    if (checked) {
      const restorePosition = fullScreenRestorePosition ?? lyricsPositionValue;
      applySettings({
        fullScreenMode: true,
        lyricsPosition: 'center',
        fullScreenRestorePosition: restorePosition,
        fullScreenRestoreFontSize: settings.fontSize,
        fullScreenRestoreMaxLinesEnabled: settings.maxLinesEnabled,
        fullScreenRestoreMaxLines: settings.maxLines,
        fullScreenRestoreLetterSpacing: settings.letterSpacing,
        fullScreenRestoreLineSpacing: settings.lineSpacing,
        fullScreenRestoreXMargin: settings.xMargin,
        fullScreenRestoreYMargin: settings.yMargin,
        fullScreenRestoreFontColor: settings.fontColor,
        fullScreenRestoreTranslationLineColor: settings.translationLineColor,
        fullScreenRestoreTranslationFontSizeMode: settings.translationFontSizeMode,
        fullScreenRestoreTranslationFontSize: settings.translationFontSize,
        fontSize: settings.fullScreenFontSize ?? settings.fontSize,
        maxLinesEnabled: settings.fullScreenMaxLinesEnabled ?? settings.maxLinesEnabled,
        maxLines: settings.fullScreenMaxLines ?? settings.maxLines,
        letterSpacing: settings.fullScreenLetterSpacing ?? settings.letterSpacing,
        lineSpacing: settings.fullScreenLineSpacing ?? settings.lineSpacing,
        xMargin: settings.fullScreenXMargin ?? settings.xMargin,
        yMargin: settings.fullScreenYMargin ?? settings.yMargin,
        fontColor: settings.fullScreenFontColor ?? settings.fontColor,
        translationLineColor: settings.fullScreenTranslationLineColor ?? settings.translationLineColor,
        translationFontSizeMode: settings.fullScreenTranslationFontSizeMode ?? settings.translationFontSizeMode,
        translationFontSize: settings.fullScreenTranslationFontSize ?? settings.translationFontSize,
      });
      return;
    }

    const restorePosition = fullScreenRestorePosition ?? lyricsPositionValue ?? 'lower';
    applySettings({
      fullScreenMode: false,
      lyricsPosition: restorePosition || 'lower',
      fullScreenRestorePosition: null,
      fullScreenFontSize: settings.fontSize,
      fullScreenMaxLinesEnabled: settings.maxLinesEnabled,
      fullScreenMaxLines: settings.maxLines,
      fullScreenLetterSpacing: settings.letterSpacing,
      fullScreenLineSpacing: settings.lineSpacing,
      fullScreenXMargin: settings.xMargin,
      fullScreenYMargin: settings.yMargin,
      fullScreenFontColor: settings.fontColor,
      fullScreenTranslationLineColor: settings.translationLineColor,
      fullScreenTranslationFontSizeMode: settings.translationFontSizeMode,
      fullScreenTranslationFontSize: settings.translationFontSize,
      fontSize: settings.fullScreenRestoreFontSize ?? settings.fontSize,
      maxLinesEnabled: settings.fullScreenRestoreMaxLinesEnabled ?? settings.maxLinesEnabled,
      maxLines: settings.fullScreenRestoreMaxLines ?? settings.maxLines,
      letterSpacing: settings.fullScreenRestoreLetterSpacing ?? settings.letterSpacing,
      lineSpacing: settings.fullScreenRestoreLineSpacing ?? settings.lineSpacing,
      xMargin: settings.fullScreenRestoreXMargin ?? settings.xMargin,
      yMargin: settings.fullScreenRestoreYMargin ?? settings.yMargin,
      fontColor: settings.fullScreenRestoreFontColor ?? settings.fontColor,
      translationLineColor: settings.fullScreenRestoreTranslationLineColor ?? settings.translationLineColor,
      translationFontSizeMode: settings.fullScreenRestoreTranslationFontSizeMode ?? settings.translationFontSizeMode,
      translationFontSize: settings.fullScreenRestoreTranslationFontSize ?? settings.translationFontSize,
    });
  };

  const handleFullScreenBackgroundTypeChange = (val) => {
    const updates = {
      fullScreenBackgroundType: val,
      fullScreenBackgroundColor: (val === 'color' && !settings.fullScreenBackgroundColor) ? '#000000' : settings.fullScreenBackgroundColor,
    };
    applySettings(updates);
  };

  const handleFullScreenPaintChange = (value) => {
    applySettings({
      fullScreenBackgroundPaint: value,
      ...(value?.type === 'solid' ? { fullScreenBackgroundColor: value.color } : {}),
    });
  };

  return {
    fullScreenModeChecked,
    lyricsPositionValue,
    fullScreenBackgroundTypeValue,
    fullScreenBackgroundColorValue,
    fullScreenBackgroundPaintValue,
    fullScreenRestorePosition,
    backgroundDisabledTooltip,
    handleLyricsPositionChange,
    handleFullScreenToggle,
    handleFullScreenBackgroundTypeChange,
    handleFullScreenPaintChange
  };
};

export default useFullscreenModeState;
