import React from 'react';
import { useDarkModeState, useOutput1Settings, useOutput2Settings } from '../hooks/useStoreSelectors';
import { useControlSocket } from '../context/ControlSocketProvider';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from '@/components/ui/tooltip';
import useToast from '../hooks/useToast';
import useModal from '../hooks/useModal';
import useAuth from '../hooks/useAuth';
import { resolveBackendUrl } from '../utils/network';
import { logWarn } from '../utils/logger';
import { Type, Paintbrush, Contrast, TextCursorInput, TextQuote, Square, Frame, Move, Italic, Underline, Bold, CaseUpper, AlignVerticalSpaceAround, ScreenShare, ListStart, ChevronDown, ChevronUp, ArrowUpDown, Rows3, MoveHorizontal, MoveVertical, Sparkles, Languages } from 'lucide-react';

const fontOptions = [
  'Arial', 'Calibri', 'Bebas Neue', 'Fira Sans', 'GarnetCapitals', 'Inter', 'Lato', 'Montserrat',
  'Noto Sans', 'Open Sans', 'Poppins', 'Roboto', 'Work Sans'
];

const MAX_MEDIA_SIZE_BYTES = 200 * 1024 * 1024;

const detectClientType = () => {
  if (typeof window === 'undefined') return 'web';
  if (window.electronAPI) return 'desktop';
  if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '')) {
    return 'mobile';
  }
  return 'web';
};

const OutputSettingsPanel = ({ outputKey }) => {
  const { darkMode } = useDarkModeState();
  const { emitStyleUpdate } = useControlSocket();
  const { showToast } = useToast();
  const { showModal } = useModal();
  const { ensureValidToken } = useAuth();
  const fileInputRef = React.useRef(null);
  const clientTypeRef = React.useRef(detectClientType());

  const { settings, updateSettings } =
    outputKey === 'output1' ? useOutput1Settings() : useOutput2Settings();

  React.useEffect(() => {
    const validateMedia = async () => {
      if (!settings.fullScreenMode || !settings.fullScreenBackgroundMedia?.url) return;

      const mediaUrl = resolveBackendUrl(settings.fullScreenBackgroundMedia.url);
      try {
        const response = await fetch(mediaUrl, { method: 'HEAD' });
        if (!response.ok) {
          logWarn(`${outputKey}: Background media not found, clearing reference`);
          applySettings({
            fullScreenBackgroundMedia: null,
            fullScreenBackgroundMediaName: '',
          });
        }
      } catch (error) {
        logWarn(`${outputKey}: Could not validate background media:`, error.message);
      }
    };

    if (settings.fullScreenMode) {
      validateMedia();
    }
  }, [settings.fullScreenMode, settings.fullScreenBackgroundMedia?.url]);

  const applySettings = React.useCallback((partial) => {
    const newSettings = { ...settings, ...partial };
    updateSettings(partial);
    emitStyleUpdate(outputKey, newSettings);
  }, [settings, updateSettings, emitStyleUpdate, outputKey]);

  const update = React.useCallback((key, value) => {
    applySettings({ [key]: value });
  }, [applySettings]);

  const LabelWithIcon = ({ icon: Icon, text }) => (
    <div className="flex items-center gap-2 min-w-[140px]">
      <Icon className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
      <label className={`text-sm ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{text}</label>
    </div>
  );

  const handleLyricsPositionChange = (val) => {
    update('lyricsPosition', val);
  };

  const handleFullScreenToggle = (checked) => {
    if (checked) {
      const restorePosition = fullScreenRestorePosition ?? lyricsPositionValue;
      applySettings({
        fullScreenMode: true,
        lyricsPosition: 'center',
        fullScreenRestorePosition: restorePosition,
      });
    } else {
      const restorePosition = fullScreenRestorePosition ?? lyricsPositionValue ?? 'lower';
      applySettings({
        fullScreenMode: false,
        lyricsPosition: restorePosition || 'lower',
        fullScreenRestorePosition: null,
      });
    }
  };

  const handleFullScreenBackgroundTypeChange = (val) => {
    const updates = {
      fullScreenBackgroundType: val,
    };
    if (val === 'color' && !settings.fullScreenBackgroundColor) {
      updates.fullScreenBackgroundColor = '#000000';
    }
    applySettings(updates);
  };

  const handleFullScreenColorChange = (e) => {
    applySettings({ fullScreenBackgroundColor: e.target.value });
  };

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleMediaSelection = async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!(file.type.startsWith('image/') || file.type.startsWith('video/'))) {
      showToast({
        title: 'Unsupported file',
        message: 'Please choose an image or video.',
        variant: 'error',
      });
      resetFileInput();
      return;
    }

    if (file.size > MAX_MEDIA_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      showToast({
        title: 'File too large',
        message: `Files must be ${Math.round(MAX_MEDIA_SIZE_BYTES / (1024 * 1024))}MB or smaller. Selected file is ${sizeMB}MB.`,
        variant: 'error',
      });
      resetFileInput();
      return;
    }

    try {
      const token = await ensureValidToken(clientTypeRef.current);
      const uploadUrl = resolveBackendUrl('/api/media/backgrounds');
      const formData = new FormData();
      formData.append('background', file);
      formData.append('outputKey', outputKey);

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = 'Upload failed';
        try {
          const errorBody = await response.json();
          if (errorBody?.error) errorMessage = errorBody.error;
        } catch { }
        throw new Error(errorMessage);
      }

      const payload = await response.json();

      applySettings({
        fullScreenBackgroundMedia: {
          url: payload.url,
          mimeType: payload.mimeType ?? file.type,
          name: payload.originalName ?? file.name,
          size: payload.size ?? file.size,
          uploadedAt: payload.uploadedAt ?? Date.now(),
        },
        fullScreenBackgroundMediaName: payload.originalName ?? file.name,
      });

      showToast({
        title: 'Background ready',
        message: `${payload.originalName ?? file.name} uploaded successfully.`,
        variant: 'success',
      });
    } catch (error) {
      showToast({
        title: 'Upload failed',
        message: error?.message || 'Could not upload the media file.',
        variant: 'error',
      });
    } finally {
      resetFileInput();
    }
  };

  const triggerFileDialog = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const fullScreenModeChecked = Boolean(settings.fullScreenMode);
  const selectTriggerDisabledClasses = fullScreenModeChecked ? 'opacity-60 pointer-events-none' : '';
  const lyricsPositionValue = settings.lyricsPosition ?? 'lower';
  const fullScreenBackgroundTypeValue = settings.fullScreenBackgroundType ?? 'color';
  const fullScreenBackgroundColorValue = settings.fullScreenBackgroundColor ?? '#000000';
  const fullScreenRestorePosition = settings.fullScreenRestorePosition ?? null;
  const fullScreenDisabledTooltip = 'Lyrics Position must be centre in full screen mode.';
  const backgroundDisabledTooltip = 'Cannot use background setting in full screen mode.';
  const backgroundMedia = settings.fullScreenBackgroundMedia;
  const hasBackgroundMedia = Boolean(backgroundMedia && (backgroundMedia.url || backgroundMedia.dataUrl));
  const uploadedMediaName = settings.fullScreenBackgroundMediaName || backgroundMedia?.name || '';
  const fullScreenOptionsWrapperClass = fullScreenModeChecked
    ? 'max-h-40 opacity-100 translate-y-0 pointer-events-auto mt-2'
    : 'max-h-0 opacity-0 -translate-y-2 pointer-events-none m-0 p-0';

  const previousFullScreenModeRef = React.useRef(fullScreenModeChecked);
  const previousLyricsPositionRef = React.useRef(lyricsPositionValue);

  const getSessionStorageKey = (key) => `${outputKey}_${key}`;

  const [fontSizeAdvancedExpanded, setFontSizeAdvancedExpanded] = React.useState(() => {
    const stored = sessionStorage.getItem(getSessionStorageKey('fontSizeAdvancedExpanded'));
    return stored === 'true';
  });

  const [fontColorAdvancedExpanded, setFontColorAdvancedExpanded] = React.useState(() => {
    const stored = sessionStorage.getItem(getSessionStorageKey('fontColorAdvancedExpanded'));
    return stored === 'true';
  });

  const [dropShadowAdvancedExpanded, setDropShadowAdvancedExpanded] = React.useState(() => {
    const stored = sessionStorage.getItem(getSessionStorageKey('dropShadowAdvancedExpanded'));
    return stored === 'true';
  });

  const [backgroundAdvancedExpanded, setBackgroundAdvancedExpanded] = React.useState(() => {
    const stored = sessionStorage.getItem(getSessionStorageKey('backgroundAdvancedExpanded'));
    return stored === 'true';
  });

  React.useEffect(() => {
    sessionStorage.setItem(getSessionStorageKey('fontSizeAdvancedExpanded'), fontSizeAdvancedExpanded);
  }, [fontSizeAdvancedExpanded, outputKey]);

  React.useEffect(() => {
    sessionStorage.setItem(getSessionStorageKey('fontColorAdvancedExpanded'), fontColorAdvancedExpanded);
  }, [fontColorAdvancedExpanded, outputKey]);

  React.useEffect(() => {
    sessionStorage.setItem(getSessionStorageKey('dropShadowAdvancedExpanded'), dropShadowAdvancedExpanded);
  }, [dropShadowAdvancedExpanded, outputKey]);

  React.useEffect(() => {
    sessionStorage.setItem(getSessionStorageKey('backgroundAdvancedExpanded'), backgroundAdvancedExpanded);
  }, [backgroundAdvancedExpanded, outputKey]);

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

  const getDefaultCustomHeight = () => {
    if (maxLinesEnabled) {
      return maxLinesValue;
    }
    return 3;
  };

  const backgroundBandCustomLines = backgroundBandLockedToMaxLines && maxLinesEnabled
    ? maxLinesValue
    : (settings.backgroundBandCustomLines ?? getDefaultCustomHeight());

  const handleBackgroundHeightModeChange = (mode) => {
    const updates = { backgroundBandHeightMode: mode };

    if (mode === 'custom' && !settings.backgroundBandCustomLines) {
      updates.backgroundBandCustomLines = getDefaultCustomHeight();
    }

    applySettings(updates);
  };

  const handleCustomLinesChange = (value) => {
    const numValue = parseInt(value, 10);

    if (maxLinesEnabled && numValue > maxLinesValue) {
      applySettings({ backgroundBandCustomLines: maxLinesValue });
      return;
    }

    applySettings({ backgroundBandCustomLines: numValue });
  };

  const handleTranslationFontSizeModeChange = (mode) => {
    const updates = { translationFontSizeMode: mode };

    if (mode === 'custom') {
      updates.translationFontSize = currentFontSize;
    }

    applySettings(updates);
  };

  const handleTranslationFontSizeChange = (value) => {
    const numValue = parseInt(value, 10);

    if (numValue > currentFontSize) {
      applySettings({ translationFontSize: currentFontSize });
      return;
    }

    applySettings({ translationFontSize: numValue });
  };

  React.useEffect(() => {
    if (!previousFullScreenModeRef.current && fullScreenModeChecked) {
      if (!settings.fullScreenRestorePosition) {
        const inferredRestore = previousLyricsPositionRef.current ?? lyricsPositionValue ?? 'lower';
        applySettings({ fullScreenRestorePosition: inferredRestore });
      }
    }
    previousFullScreenModeRef.current = fullScreenModeChecked;
    previousLyricsPositionRef.current = lyricsPositionValue;
  }, [fullScreenModeChecked, lyricsPositionValue, settings.fullScreenRestorePosition, applySettings]);

  React.useEffect(() => {
    if (maxLinesEnabled && backgroundBandHeightMode === 'custom' && backgroundBandCustomLines > maxLinesValue) {
      applySettings({ backgroundBandCustomLines: maxLinesValue });
    }
  }, [maxLinesValue, maxLinesEnabled, backgroundBandHeightMode, backgroundBandCustomLines, applySettings]);

  React.useEffect(() => {
    if (translationFontSizeMode === 'custom' && translationFontSize > currentFontSize) {
      applySettings({ translationFontSize: currentFontSize });
    }
  }, [currentFontSize, translationFontSizeMode, translationFontSize, applySettings]);

  React.useEffect(() => {
    if (backgroundBandLockedToMaxLines && maxLinesEnabled && backgroundBandHeightMode === 'custom') {

      if (settings.backgroundBandCustomLines !== maxLinesValue) {
        applySettings({ backgroundBandCustomLines: maxLinesValue });
      }
    }
  }, [maxLinesValue, backgroundBandLockedToMaxLines, maxLinesEnabled, backgroundBandHeightMode]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-sm font-medium uppercase tracking-wide ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          {outputKey.toUpperCase()} SETTINGS
        </h3>

        {/* Help trigger button */}
        <button
          onClick={() => {
            showModal({
              title: 'Output Settings Help',
              headerDescription: 'Customize every aspect of your lyric display appearance',
              component: 'OutputSettingsHelp',
              variant: 'info',
              size: 'large',
              dismissLabel: 'Got it'
            });
          }}
          className={`p-1.5 rounded-lg transition-colors ${darkMode
            ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
            : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
            }`}
          title="Output Settings Help"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>

      {/* Lyrics Position */}
      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Choose where lyrics appear vertically on screen (centre is enforced in full screen mode)" side="right">
          <LabelWithIcon icon={AlignVerticalSpaceAround} text="Lyrics Position" />
        </Tooltip>
        <div className="w-full">
          <Select
            value={lyricsPositionValue}
            onValueChange={handleLyricsPositionChange}
            disabled={fullScreenModeChecked}
          >
            <SelectTrigger
              className={`w-full ${fullScreenModeChecked ? 'cursor-not-allowed' : ''} ${darkMode
                ? 'bg-gray-700 border-gray-600 text-gray-200'
                : 'bg-white border-gray-300'
                } ${selectTriggerDisabledClasses}`}
              title={fullScreenModeChecked ? fullScreenDisabledTooltip : undefined}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}>
              <SelectItem value="upper">Upper Third</SelectItem>
              <SelectItem value="center">Centre</SelectItem>
              <SelectItem value="lower">Lower Third</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Font Picker */}
      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Select font family for lyric display" side="right">
          <LabelWithIcon icon={Type} text="Font Style" />
        </Tooltip>
        <Select value={settings.fontStyle} onValueChange={(val) => update('fontStyle', val)}>
          <SelectTrigger className={`w-full ${darkMode
            ? 'bg-gray-700 border-gray-600 text-gray-200'
            : 'bg-white border-gray-300'
            }`}>
            <SelectValue placeholder="Select font" />
          </SelectTrigger>
          <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}>
            {fontOptions.map((font) => (
              <SelectItem
                key={font}
                value={font}
                style={{ fontFamily: font }}
                className={darkMode ? 'text-gray-200 hover:bg-gray-600' : ''}
              >
                {font}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Bold / Italic / Underline / All Caps */}
      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Apply text styling: bold, italic, underline, or all caps" side="right">
          <LabelWithIcon icon={TextQuote} text="Emphasis" />
        </Tooltip>
        <div className="flex gap-2 flex-wrap">
          <Tooltip content="Make text bold" side="top">
            <Button
              size="icon"
              variant={settings.bold ? 'default' : 'outline'}
              onClick={() => update('bold', !settings.bold)}
              title="Bold"
              className={!settings.bold && darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : ''}
            >
              <Bold className="w-4 h-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Make text italic" side="top">
            <Button
              size="icon"
              variant={settings.italic ? 'default' : 'outline'}
              onClick={() => update('italic', !settings.italic)}
              title="Italic"
              className={!settings.italic && darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : ''}
            >
              <Italic className="w-4 h-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Underline text" side="top">
            <Button
              size="icon"
              variant={settings.underline ? 'default' : 'outline'}
              onClick={() => update('underline', !settings.underline)}
              title="Underline"
              className={!settings.underline && darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : ''}
            >
              <Underline className="w-4 h-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Convert text to uppercase" side="top">
            <Button
              size="icon"
              variant={settings.allCaps ? 'default' : 'outline'}
              onClick={() => update('allCaps', !settings.allCaps)}
              title="All Caps"
              className={!settings.allCaps && darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : ''}
            >
              <CaseUpper className="w-4 h-4" />
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Font Size */}
      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Adjust text size in pixels (24-100)" side="right">
          <LabelWithIcon icon={TextCursorInput} text="Font Size" />
        </Tooltip>
        <div className="flex items-center gap-2 justify-end w-full">
          <Tooltip content={fontSizeAdvancedExpanded ? "Hide advanced settings" : "Show advanced settings"} side="top">
            <button
              onClick={() => setFontSizeAdvancedExpanded(!fontSizeAdvancedExpanded)}
              className={`p-1 rounded transition-colors ${darkMode
                ? 'hover:bg-gray-700 text-gray-400'
                : 'hover:bg-gray-100 text-gray-500'
                }`}
              aria-label="Toggle font size advanced settings"
            >
              {fontSizeAdvancedExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </Tooltip>
          {(() => {
            const baseFont = Number.isFinite(settings.fontSize) ? settings.fontSize : 24;
            const instanceCount = settings.instanceCount || 0;
            const hasMultipleInstances = instanceCount > 1;
            const allInstances = settings.allInstances || [];

            let anyInstanceResizing = false;
            let primaryAdjustedSize = null;

            if (settings.maxLinesEnabled && instanceCount > 0) {
              if (hasMultipleInstances && allInstances.length > 0) {
                anyInstanceResizing = allInstances.some(inst => inst.autosizerActive === true);
                const primaryInstance = allInstances.reduce((largest, current) => {
                  if (!largest) return current;
                  const largestArea = (largest.viewportWidth || 0) * (largest.viewportHeight || 0);
                  const currentArea = (current.viewportWidth || 0) * (current.viewportHeight || 0);
                  return currentArea > largestArea ? current : largest;
                }, null);
                primaryAdjustedSize = primaryInstance?.adjustedFontSize ?? null;
              } else if (allInstances.length > 0) {
                const singleInstance = allInstances[0];
                anyInstanceResizing = Boolean(singleInstance?.autosizerActive);
                primaryAdjustedSize = singleInstance?.adjustedFontSize ?? null;
              } else if (settings.autosizerActive) {
                anyInstanceResizing = true;
                primaryAdjustedSize = null;
              }
            }

            const primaryInstanceResizing = anyInstanceResizing && primaryAdjustedSize !== null && primaryAdjustedSize !== baseFont;
            const displayFontSize = primaryInstanceResizing ? primaryAdjustedSize : baseFont;

            const primaryViewport = settings.primaryViewportWidth && settings.primaryViewportHeight
              ? `${settings.primaryViewportWidth}×${settings.primaryViewportHeight}`
              : null;

            let inputDisplayValue = displayFontSize;
            if (hasMultipleInstances && anyInstanceResizing && allInstances.length > 0) {
              const primaryValue = displayFontSize;
              const otherResizingInstance = allInstances.find(inst =>
                inst.autosizerActive === true &&
                inst.adjustedFontSize !== primaryValue
              );

              if (otherResizingInstance) {
                const otherValue = otherResizingInstance.adjustedFontSize ?? baseFont;
                inputDisplayValue = allInstances.length > 2
                  ? `${primaryValue}, ${otherValue}…`
                  : `${primaryValue}, ${otherValue}`;
              } else if (allInstances.length > 1) {
                inputDisplayValue = `${primaryValue}…`;
              }
            }

            let tooltipText = '';
            if (anyInstanceResizing) {
              if (hasMultipleInstances) {
                tooltipText = `Auto-resizing active on ${instanceCount} displays\n\nPrimary (${primaryViewport}): ${displayFontSize}px`;
                if (allInstances.length > 0) {
                  allInstances.forEach((inst, idx) => {
                    const viewport = `${inst.viewportWidth}×${inst.viewportHeight}`;
                    const size = inst.adjustedFontSize ?? baseFont;
                    tooltipText += `\nDisplay ${idx + 1} (${viewport}): ${size}px`;
                  });
                }
                tooltipText += `\n\nPreferred size: ${settings.fontSize}px`;
              } else {
                tooltipText = `Auto-resizing active: ${displayFontSize}px (preferred: ${settings.fontSize}px)`;
              }
            } else {
              tooltipText = 'Set the preferred font size in pixels';
            }

            const innerClassBase = `${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`;

            return (
              <div className={`flex items-center ${anyInstanceResizing ? 'gap-2' : ''}`} aria-live={anyInstanceResizing ? 'polite' : undefined}>
                {anyInstanceResizing && (
                  <span
                    className="inline-flex items-center justify-center"
                    title={tooltipText}
                    aria-hidden="true"
                  >
                    {/* Sparkles icon */}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
                      <defs>
                        <linearGradient id="spark-grad" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#60A5FA" />
                          <stop offset="100%" stopColor="#8B5CF6" />
                        </linearGradient>
                      </defs>
                      <path d="M12 2l2.2 4.8L19 9l-4.8 2.2L12 16l-2.2-4.8L5 9l4.8-2.2L12 2zm7 11l1.1 2.4L23 16l-2.4 1.1L19 19l-1.1-2.4L15 16l2.4-1.1L19 13zM3 13l1.1 2.4L6 16l-2.4 1.1L3 19l-1.1-2.4L0 16l2.4-1.1L3 13z" fill="url(#spark-grad)" />
                    </svg>
                  </span>
                )}
                <div className="relative flex-1">
                  {hasMultipleInstances && anyInstanceResizing && primaryInstanceResizing ? (
                    <div
                      className={`w-24 h-9 px-3 flex items-center justify-start text-sm rounded-md border cursor-not-allowed ${darkMode
                        ? 'bg-gray-700 border-gray-600 text-gray-500'
                        : 'bg-gray-50 border-gray-300 text-gray-500'
                        }`}
                      style={{ fontWeight: 400 }}
                      title={tooltipText}
                    >
                      {inputDisplayValue}
                    </div>
                  ) : (
                    <Input
                      type="number"
                      value={Number.isFinite(displayFontSize) ? displayFontSize : 24}
                      onChange={(e) => {
                        const next = parseInt(e.target.value, 10);
                        if (!Number.isNaN(next)) update('fontSize', next);
                      }}
                      min="24"
                      max="100"
                      disabled={primaryInstanceResizing}
                      className={`w-24 ${innerClassBase} ${primaryInstanceResizing ? 'opacity-80 cursor-not-allowed' : ''}`}
                      title={tooltipText}
                    />
                  )}
                </div>
              </div>
            );
          })()}
          <Tooltip content="Enable adaptive text fitting with max lines limit" side="top">
            <Button
              size="icon"
              variant={settings.maxLinesEnabled ? 'default' : 'outline'}
              onClick={() => update('maxLinesEnabled', !settings.maxLinesEnabled)}
              title="Max Lines"
              className={!settings.maxLinesEnabled && darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : ''}
            >
              <ListStart className="w-4 h-4" />
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Font Size Advanced Settings Row */}
      <div
        className={`overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-out ${fontSizeAdvancedExpanded
          ? 'max-h-48 opacity-100 translate-y-0 pointer-events-auto mt-1'
          : 'max-h-0 opacity-0 -translate-y-2 pointer-events-none m-0 p-0'
          }`}
        aria-hidden={!fontSizeAdvancedExpanded}
        style={{ marginTop: fontSizeAdvancedExpanded ? undefined : 0 }}
      >
        {/* Translation Font Size Row */}
        <div className="flex items-center justify-between w-full mb-4">
          {/* Translation Mode */}
          <div className="flex items-center gap-2">
            <label className={`text-sm whitespace-nowrap ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
              Translation Size
            </label>
            <Select
              value={translationFontSizeMode}
              onValueChange={handleTranslationFontSizeModeChange}
            >
              <SelectTrigger
                className={`w-[120px] ${darkMode
                  ? 'bg-gray-700 border-gray-600 text-gray-200'
                  : 'bg-white border-gray-300'
                  }`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}>
                <SelectItem value="bound">Bound</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Translation Custom Size */}
          {translationFontSizeMode === 'custom' && (
            <Tooltip content={`Translation font size (max: ${currentFontSize}px)`} side="top">
              <div className="flex items-center gap-2">
                <Languages className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                <Input
                  type="number"
                  value={translationFontSize}
                  onChange={(e) => handleTranslationFontSizeChange(e.target.value)}
                  min="12"
                  max={currentFontSize}
                  className={`w-16 ${darkMode
                    ? 'bg-gray-700 border-gray-600 text-gray-200'
                    : 'bg-white border-gray-300'
                    }`}
                />
              </div>
            </Tooltip>
          )}
        </div>

        {/* Max Lines Settings Row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <label className={`text-sm ${darkMode ? 'text-gray-200' : 'text-gray-700'} ${!maxLinesEnabled ? 'opacity-50' : ''}`}>
              Max Lines
            </label>
            <Input
              type="number"
              value={settings.maxLines ?? 3}
              onChange={(e) => update('maxLines', parseInt(e.target.value))}
              min="1"
              max="10"
              disabled={!maxLinesEnabled}
              className={`w-16 ${darkMode
                ? 'bg-gray-700 border-gray-600 text-gray-200'
                : 'bg-white border-gray-300'
                } ${!maxLinesEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className={`text-sm ${darkMode ? 'text-gray-200' : 'text-gray-700'} ${!maxLinesEnabled ? 'opacity-50' : ''}`}>
              Min Font Size
            </label>
            <Input
              type="number"
              value={settings.minFontSize ?? 24}
              onChange={(e) => update('minFontSize', parseInt(e.target.value))}
              min="12"
              max="100"
              disabled={!maxLinesEnabled}
              className={`w-16 ${darkMode
                ? 'bg-gray-700 border-gray-600 text-gray-200'
                : 'bg-white border-gray-300'
                } ${!maxLinesEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          </div>
        </div>
      </div>

      {/* Font Color */}
      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Choose the color of your lyrics text" side="right">
          <LabelWithIcon icon={Paintbrush} text="Font Colour" />
        </Tooltip>
        <div className="flex items-center gap-2 justify-end w-full">
          <Tooltip content={fontColorAdvancedExpanded ? "Hide advanced settings" : "Show advanced settings"} side="top">
            <button
              onClick={() => setFontColorAdvancedExpanded(!fontColorAdvancedExpanded)}
              className={`p-1 rounded transition-colors ${darkMode
                ? 'hover:bg-gray-700 text-gray-400'
                : 'hover:bg-gray-100 text-gray-500'
                }`}
              aria-label="Toggle font color advanced settings"
            >
              {fontColorAdvancedExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </Tooltip>
          <Input
            type="color"
            value={settings.fontColor}
            onChange={(e) => update('fontColor', e.target.value)}
            className={`h-9 w-12 p-1 ${darkMode
              ? 'bg-gray-700 border-gray-600'
              : 'bg-white border-gray-300'
              }`}
          />
        </div>
      </div>

      {/* Font Color Advanced Settings Row */}
      <div
        className={`overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-out ${fontColorAdvancedExpanded
          ? 'max-h-20 opacity-100 translate-y-0 pointer-events-auto mt-1'
          : 'max-h-0 opacity-0 -translate-y-2 pointer-events-none m-0 p-0'
          }`}
        aria-hidden={!fontColorAdvancedExpanded}
        style={{ marginTop: fontColorAdvancedExpanded ? undefined : 0 }}
      >
        <div className="flex items-center justify-between w-full">
          <label className={`text-sm whitespace-nowrap ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
            Translation Colour
          </label>
          <Input
            type="color"
            value={translationLineColor}
            onChange={(e) => update('translationLineColor', e.target.value)}
            className={`h-9 w-12 p-1 ${darkMode
              ? 'bg-gray-700 border-gray-600'
              : 'bg-white border-gray-300'
              }`}
          />
        </div>
      </div>

      {/* Text Border */}
      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Add an outline around text for better visibility (0-10px)" side="right">
          <LabelWithIcon icon={Frame} text="Text Border" />
        </Tooltip>
        <div className="flex gap-2 items-center">
          <Input
            type="color"
            value={settings.borderColor ?? '#000000'}
            onChange={(e) => update('borderColor', e.target.value)}
            className={`h-9 w-12 p-1 ${darkMode
              ? 'bg-gray-700 border-gray-600'
              : 'bg-white border-gray-300'
              }`}
          />
          <Input
            type="number"
            value={settings.borderSize ?? 0}
            onChange={(e) => update('borderSize', parseInt(e.target.value, 10))}
            min="0"
            max="10"
            className={`w-20 ${darkMode
              ? 'bg-gray-700 border-gray-600 text-gray-200'
              : 'bg-white border-gray-300'
              }`}
          />
        </div>
      </div>

      {/* Drop Shadow */}
      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Add shadow behind text for depth (0-10 opacity)" side="right">
          <LabelWithIcon icon={Contrast} text="Drop Shadow" />
        </Tooltip>
        <div className="flex items-center gap-2 justify-end w-full">
          <Tooltip content={dropShadowAdvancedExpanded ? "Hide advanced settings" : "Show advanced settings"} side="top">
            <button
              onClick={() => setDropShadowAdvancedExpanded(!dropShadowAdvancedExpanded)}
              className={`p-1 rounded transition-colors ${darkMode
                ? 'hover:bg-gray-700 text-gray-400'
                : 'hover:bg-gray-100 text-gray-500'
                }`}
              aria-label="Toggle drop shadow advanced settings"
            >
              {dropShadowAdvancedExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </Tooltip>
          <Input
            type="color"
            value={settings.dropShadowColor}
            onChange={(e) => update('dropShadowColor', e.target.value)}
            className={`h-9 w-12 p-1 ${darkMode
              ? 'bg-gray-700 border-gray-600'
              : 'bg-white border-gray-300'
              }`}
          />
          <Input
            type="number"
            value={settings.dropShadowOpacity}
            onChange={(e) => update('dropShadowOpacity', parseInt(e.target.value))}
            min="0"
            max="10"
            className={`w-20 ${darkMode
              ? 'bg-gray-700 border-gray-600 text-gray-200'
              : 'bg-white border-gray-300'
              }`}
          />
        </div>
      </div>

      {/* Drop Shadow Advanced Settings Row */}
      <div
        className={`overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-out ${dropShadowAdvancedExpanded
          ? 'max-h-32 opacity-100 translate-y-0 pointer-events-auto mt-1'
          : 'max-h-0 opacity-0 -translate-y-2 pointer-events-none m-0 p-0'
          }`}
        aria-hidden={!dropShadowAdvancedExpanded}
        style={{ marginTop: dropShadowAdvancedExpanded ? undefined : 0 }}
      >
        <div className="flex items-center justify-between w-full">
          {/* Horizontal Offset (X) */}
          <Tooltip content="Horizontal shadow offset in pixels (negative = left, positive = right)" side="top">
            <div className="flex items-center gap-2">
              <MoveHorizontal className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
              <Input
                type="number"
                value={dropShadowOffsetX}
                onChange={(e) => update('dropShadowOffsetX', parseInt(e.target.value, 10))}
                min="-50"
                max="50"
                className={`w-16 ${darkMode
                  ? 'bg-gray-700 border-gray-600 text-gray-200'
                  : 'bg-white border-gray-300'
                  }`}
              />
            </div>
          </Tooltip>

          {/* Vertical Offset (Y) */}
          <Tooltip content="Vertical shadow offset in pixels (negative = up, positive = down)" side="top">
            <div className="flex items-center gap-2">
              <MoveVertical className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
              <Input
                type="number"
                value={dropShadowOffsetY}
                onChange={(e) => update('dropShadowOffsetY', parseInt(e.target.value, 10))}
                min="-50"
                max="50"
                className={`w-16 ${darkMode
                  ? 'bg-gray-700 border-gray-600 text-gray-200'
                  : 'bg-white border-gray-300'
                  }`}
              />
            </div>
          </Tooltip>

          {/* Blur Radius */}
          <Tooltip content="Shadow blur radius in pixels (0 = sharp, higher = softer)" side="top">
            <div className="flex items-center gap-2">
              <Sparkles className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
              <Input
                type="number"
                value={dropShadowBlur}
                onChange={(e) => update('dropShadowBlur', parseInt(e.target.value, 10))}
                min="0"
                max="50"
                className={`w-16 ${darkMode
                  ? 'bg-gray-700 border-gray-600 text-gray-200'
                  : 'bg-white border-gray-300'
                  }`}
              />
            </div>
          </Tooltip>
        </div>
      </div>

      {/* Background */}
      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Set background band with custom color and opacity behind lyrics" side="right">
          <LabelWithIcon icon={Square} text="Background" />
        </Tooltip>
        <div className="flex items-center gap-2 justify-end w-full">
          <Tooltip content={backgroundAdvancedExpanded ? "Hide advanced settings" : "Show advanced settings"} side="top">
            <button
              onClick={() => setBackgroundAdvancedExpanded(!backgroundAdvancedExpanded)}
              disabled={fullScreenModeChecked}
              className={`p-1 rounded transition-colors ${darkMode
                ? 'hover:bg-gray-700 text-gray-400'
                : 'hover:bg-gray-100 text-gray-500'
                } ${fullScreenModeChecked ? 'opacity-60 cursor-not-allowed' : ''}`}
              aria-label="Toggle background advanced settings"
            >
              {backgroundAdvancedExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </Tooltip>
          <Input
            type="color"
            value={settings.backgroundColor}
            onChange={(e) => update('backgroundColor', e.target.value)}
            disabled={fullScreenModeChecked}
            className={`h-9 w-12 p-1 ${darkMode
              ? 'bg-gray-700 border-gray-600'
              : 'bg-white border-gray-300'
              } ${fullScreenModeChecked ? 'opacity-60 cursor-not-allowed' : ''}`}
            title={fullScreenModeChecked ? backgroundDisabledTooltip : undefined}
          />
          <Input
            type="number"
            value={settings.backgroundOpacity ?? 0}
            onChange={(e) => update('backgroundOpacity', parseInt(e.target.value))}
            min="0"
            max="10"
            disabled={fullScreenModeChecked}
            className={`w-20 ${darkMode
              ? 'bg-gray-700 border-gray-600 text-gray-200'
              : 'bg-white border-gray-300'
              } ${fullScreenModeChecked ? 'opacity-60 cursor-not-allowed' : ''}`}
            title={fullScreenModeChecked ? backgroundDisabledTooltip : undefined}
          />
        </div>
      </div>

      {/* Background Advanced Settings Row */}
      <div
        className={`overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-out ${backgroundAdvancedExpanded && !fullScreenModeChecked
          ? 'max-h-32 opacity-100 translate-y-0 pointer-events-auto mt-1'
          : 'max-h-0 opacity-0 -translate-y-2 pointer-events-none m-0 p-0'
          }`}
        aria-hidden={!backgroundAdvancedExpanded || fullScreenModeChecked}
        style={{ marginTop: (backgroundAdvancedExpanded && !fullScreenModeChecked) ? undefined : 0 }}
      >
        <div className="flex items-center justify-between w-full">
          {/* Height Mode */}
          <div className="flex items-center gap-2">
            <label className={`text-sm whitespace-nowrap ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
              Mode
            </label>
            <Select
              value={backgroundBandHeightMode}
              onValueChange={handleBackgroundHeightModeChange}
            >
              <SelectTrigger
                className={`w-[110px] ${darkMode
                  ? 'bg-gray-700 border-gray-600 text-gray-200'
                  : 'bg-white border-gray-300'
                  }`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}>
                <SelectItem value="adaptive">Adaptive</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom Lines */}
          {backgroundBandHeightMode === 'custom' && (
            <Tooltip content={
              !maxLinesEnabled
                ? "Number of lines for band height"
                : backgroundBandLockedToMaxLines
                  ? `Locked to Max Lines (${maxLinesValue}). Click to unlock`
                  : `Click to lock to Max Lines (${maxLinesValue})`
            } side="top">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (maxLinesEnabled) {
                      applySettings({
                        backgroundBandLockedToMaxLines: !backgroundBandLockedToMaxLines,
                        backgroundBandCustomLines: !backgroundBandLockedToMaxLines ? maxLinesValue : backgroundBandCustomLines
                      });
                    }
                  }}
                  disabled={!maxLinesEnabled}
                  className={`p-1 rounded transition-all ${maxLinesEnabled
                    ? `cursor-pointer ${backgroundBandLockedToMaxLines
                      ? darkMode
                        ? 'bg-blue-600 hover:bg-blue-700'
                        : 'bg-blue-500 hover:bg-blue-600'
                      : darkMode
                        ? 'hover:bg-gray-700'
                        : 'hover:bg-gray-200'
                    }`
                    : 'cursor-default opacity-50'
                    }`}
                  aria-label={maxLinesEnabled ? (backgroundBandLockedToMaxLines ? "Unlock from max lines" : "Lock to max lines") : undefined}
                >
                  <Rows3 className={`w-4 h-4 ${backgroundBandLockedToMaxLines && maxLinesEnabled
                    ? 'text-white'
                    : darkMode ? 'text-gray-400' : 'text-gray-500'
                    }`} />
                </button>
                <Input
                  type="number"
                  value={backgroundBandCustomLines}
                  onChange={(e) => handleCustomLinesChange(e.target.value)}
                  min="1"
                  max={maxLinesEnabled ? maxLinesValue : 10}
                  disabled={backgroundBandLockedToMaxLines && maxLinesEnabled}
                  className={`w-16 ${darkMode
                    ? 'bg-gray-700 border-gray-600 text-gray-200'
                    : 'bg-white border-gray-300'
                    } ${backgroundBandLockedToMaxLines && maxLinesEnabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
              </div>
            </Tooltip>
          )}

          {/* Vertical Padding */}
          <Tooltip content="Vertical padding for background band (in pixels)" side="top">
            <div className="flex items-center gap-2">
              <ArrowUpDown className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
              <Input
                type="number"
                value={backgroundBandVerticalPadding}
                onChange={(e) => update('backgroundBandVerticalPadding', parseInt(e.target.value, 10))}
                min="0"
                max="100"
                className={`w-16 ${darkMode
                  ? 'bg-gray-700 border-gray-600 text-gray-200'
                  : 'bg-white border-gray-300'
                  }`}
              />
            </div>
          </Tooltip>
        </div>
      </div>

      {/* X and Y Margins */}
      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Adjust horizontal and vertical positioning offset" side="right">
          <LabelWithIcon icon={Move} text="X & Y Margins" />
        </Tooltip>
        <div className="flex gap-2 items-center">
          <Input
            type="number"
            value={settings.xMargin}
            onChange={(e) => update('xMargin', parseFloat(e.target.value))}
            className={`w-20 ${darkMode
              ? 'bg-gray-700 border-gray-600 text-gray-200'
              : 'bg-white border-gray-300'
              }`}
          />
          <Input
            type="number"
            value={settings.yMargin}
            onChange={(e) => update('yMargin', parseFloat(e.target.value))}
            className={`w-20 ${darkMode
              ? 'bg-gray-700 border-gray-600 text-gray-200'
              : 'bg-white border-gray-300'
              }`}
          />
        </div>
      </div>

      {/* Full Screen Mode */}
      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Enable full screen display with custom background settings" side="right">
          <LabelWithIcon icon={ScreenShare} text="Full Screen Mode" />
        </Tooltip>
        <div className="flex items-center gap-3 justify-end w-full">
          <Switch
            checked={fullScreenModeChecked}
            onCheckedChange={handleFullScreenToggle}
            aria-label="Toggle full screen mode"
            className={`!h-8 !w-16 !border-0 shadow-sm transition-colors ${darkMode
              ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
              : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
              }`}
            thumbClassName="!h-6 !w-7 data-[state=checked]:!translate-x-8 data-[state=unchecked]:!translate-x-1"
          />
          <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {fullScreenModeChecked ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </div>

      {/* Fullscreen Mode Settings Row */}
      <div
        className={`overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-out ${fullScreenOptionsWrapperClass}`}
        aria-hidden={!fullScreenModeChecked}
        style={{ marginTop: fullScreenModeChecked ? undefined : 0 }}
      >
        <div className="flex items-center gap-3 justify-between w-full pt-2">
          <Select
            value={fullScreenBackgroundTypeValue}
            onValueChange={handleFullScreenBackgroundTypeChange}
          >
            <SelectTrigger
              className={`w-[200px] ${darkMode
                ? 'bg-gray-700 border-gray-600 text-gray-200'
                : 'bg-white border-gray-300'
                }`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}>
              <SelectItem value="color">Colour</SelectItem>
              <SelectItem value="media">Image / Video</SelectItem>
            </SelectContent>
          </Select>

          {fullScreenBackgroundTypeValue === 'color' ? (
            <Input
              type="color"
              value={fullScreenBackgroundColorValue}
              onChange={handleFullScreenColorChange}
              className={`ml-auto h-9 w-12 p-1 ${darkMode
                ? 'bg-gray-700 border-gray-600'
                : 'bg-white border-gray-300'
                }`}
            />
          ) : (
            <div className="flex items-center gap-2 ml-auto">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={handleMediaSelection}
              />
              <Button
                variant="outline"
                onClick={triggerFileDialog}
                className={`h-9 px-4 ${darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : ''}`}
              >
                {hasBackgroundMedia ? 'File Added' : 'Add File'}
              </Button>
              {hasBackgroundMedia && (
                <span
                  className={`text-sm max-w-[220px] truncate inline-block ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}
                  title={uploadedMediaName}
                >
                  {uploadedMediaName}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OutputSettingsPanel;