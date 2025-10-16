import React from 'react';
import { useDarkModeState, useOutput1Settings, useOutput2Settings } from '../hooks/useStoreSelectors';
import { useControlSocket } from '../context/ControlSocketProvider';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import useToast from '../hooks/useToast';
import useAuth from '../hooks/useAuth';
import { resolveBackendUrl } from '../utils/network';
import { logWarn } from '../utils/logger';
import { Type, Paintbrush, Contrast, TextCursorInput, TextQuote, Square, Frame, Move, Italic, Underline, Bold, CaseUpper, AlignVerticalSpaceAround, Maximize2 } from 'lucide-react';

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
    : 'max-h-0 opacity-0 -translate-y-2 pointer-events-none';

  const previousFullScreenModeRef = React.useRef(fullScreenModeChecked);
  const previousLyricsPositionRef = React.useRef(lyricsPositionValue);

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

  return (
    <div className="space-y-4">
      <h3 className={`text-sm font-medium uppercase tracking-wide ${darkMode ? 'text-gray-400' : 'text-gray-500'
        }`}>
        {outputKey.toUpperCase()} SETTINGS
      </h3>

      {/* Lyrics Position */}
      <div className="flex items-center justify-between gap-4">
        <LabelWithIcon icon={AlignVerticalSpaceAround} text="Lyrics Position" />
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
        <LabelWithIcon icon={Type} text="Font Style" />
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
        <LabelWithIcon icon={TextQuote} text="Emphasis" />
        <div className="flex gap-2 flex-wrap">
          <Button
            size="icon"
            variant={settings.bold ? 'default' : 'outline'}
            onClick={() => update('bold', !settings.bold)}
            title="Bold"
            className={!settings.bold && darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : ''}
          >
            <Bold className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant={settings.italic ? 'default' : 'outline'}
            onClick={() => update('italic', !settings.italic)}
            title="Italic"
            className={!settings.italic && darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : ''}
          >
            <Italic className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant={settings.underline ? 'default' : 'outline'}
            onClick={() => update('underline', !settings.underline)}
            title="Underline"
            className={!settings.underline && darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : ''}
          >
            <Underline className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant={settings.allCaps ? 'default' : 'outline'}
            onClick={() => update('allCaps', !settings.allCaps)}
            title="All Caps"
            className={!settings.allCaps && darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : ''}
          >
            <CaseUpper className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Font Size */}
      <div className="flex items-center justify-between gap-4">
        <LabelWithIcon icon={TextCursorInput} text="Font Size" />
        <Input
          type="number"
          value={settings.fontSize}
          onChange={(e) => update('fontSize', parseInt(e.target.value))}
          min="24"
          max="100"
          className={`w-24 ${darkMode
            ? 'bg-gray-700 border-gray-600 text-gray-200'
            : 'bg-white border-gray-300'
            }`}
        />
      </div>

      {/* Font Color */}
      <div className="flex items-center justify-between gap-4">
        <LabelWithIcon icon={Paintbrush} text="Font Colour" />
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

      {/* Text Border */}
      <div className="flex items-center justify-between gap-4">
        <LabelWithIcon icon={Frame} text="Text Border" />
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
        <LabelWithIcon icon={Contrast} text="Drop Shadow" />
        <div className="flex gap-2 items-center">
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

      {/* Background */}
      <div className="flex items-center justify-between gap-4">
        <LabelWithIcon icon={Square} text="Background" />
        <div className="flex items-center gap-2 justify-end w-full">
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

      {/* X and Y Margins */}
      <div className="flex items-center justify-between gap-4">
        <LabelWithIcon icon={Move} text="X & Y Margins" />
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
        <LabelWithIcon icon={Maximize2} text="Full Screen Mode" />
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

      <div
        className={`overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-out ${fullScreenOptionsWrapperClass}`}
        aria-hidden={!fullScreenModeChecked}
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
