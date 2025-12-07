import { useMemo } from 'react';

const useFullscreenModeState = ({ settings, applySettings }) => {
  const fullScreenModeChecked = Boolean(settings.fullScreenMode);
  const lyricsPositionValue = settings.lyricsPosition ?? 'lower';
  const fullScreenBackgroundTypeValue = settings.fullScreenBackgroundType ?? 'color';
  const fullScreenBackgroundColorValue = settings.fullScreenBackgroundColor ?? '#000000';
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
      });
      return;
    }

    const restorePosition = fullScreenRestorePosition ?? lyricsPositionValue ?? 'lower';
    applySettings({
      fullScreenMode: false,
      lyricsPosition: restorePosition || 'lower',
      fullScreenRestorePosition: null,
    });
  };

  const handleFullScreenBackgroundTypeChange = (val) => {
    const updates = {
      fullScreenBackgroundType: val,
      fullScreenBackgroundColor: (val === 'color' && !settings.fullScreenBackgroundColor) ? '#000000' : settings.fullScreenBackgroundColor,
    };
    applySettings(updates);
  };

  const handleFullScreenColorChange = (value) => {
    applySettings({ fullScreenBackgroundColor: value });
  };

  const fullScreenOptionsWrapperClass = useMemo(() => (
    fullScreenModeChecked
      ? 'max-h-40 opacity-100 translate-y-0 pointer-events-auto mt-2'
      : 'max-h-0 opacity-0 -translate-y-2 pointer-events-none m-0 p-0'
  ), [fullScreenModeChecked]);

  return {
    fullScreenModeChecked,
    lyricsPositionValue,
    fullScreenBackgroundTypeValue,
    fullScreenBackgroundColorValue,
    fullScreenRestorePosition,
    backgroundDisabledTooltip,
    fullScreenOptionsWrapperClass,
    handleLyricsPositionChange,
    handleFullScreenToggle,
    handleFullScreenBackgroundTypeChange,
    handleFullScreenColorChange
  };
};

export default useFullscreenModeState;