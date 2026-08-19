import React from 'react';
import { ScreenShare, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip } from '@/components/ui/tooltip';
import { PaintPicker } from '@/components/ui/paint-picker';
import { AdvancedCollapse, AdvancedToggle, LabelWithIcon } from '../OutputSettingsShared';
import { sanitizeIntegerInput, sanitizeNumberInput } from '../../utils/numberInput';

const FULLSCREEN_ELEMENT_POSITIONS = [
  ['top-left', 'Top Left'],
  ['top-center', 'Top Centre'],
  ['top-right', 'Top Right'],
  ['center-left', 'Centre Left'],
  ['center', 'Centre'],
  ['center-right', 'Centre Right'],
  ['bottom-left', 'Bottom Left'],
  ['bottom-center', 'Bottom Centre'],
  ['bottom-right', 'Bottom Right'],
];

const FULLSCREEN_ELEMENT_NUMBER_CLASS = 'w-[68px] shrink-0';

const FullscreenBackgroundOpacityInput = ({ darkMode, settings, update }) => {
  const currentOpacity = settings.fullScreenBackgroundOpacity ?? 10;
  const [opacityInput, setOpacityInput] = React.useState(() => String(currentOpacity));

  React.useEffect(() => {
    const currentNumeric = Number.parseFloat(opacityInput);
    if (Number.isFinite(currentNumeric) && currentNumeric === currentOpacity) return;
    setOpacityInput(String(currentOpacity));
  }, [currentOpacity, opacityInput]);

  const handleChange = (value) => {
    setOpacityInput(value);
    const parsed = sanitizeNumberInput(value, currentOpacity, {
      min: 0,
      max: 10,
      clampMin: false,
    });
    if (Number.isFinite(parsed) && parsed !== currentOpacity) {
      update('fullScreenBackgroundOpacity', parsed);
    }
  };

  const handleBlur = () => {
    const parsed = sanitizeNumberInput(opacityInput, currentOpacity, { min: 0, max: 10 });
    setOpacityInput(String(parsed));
    update('fullScreenBackgroundOpacity', parsed);
  };

  return (
    <Tooltip content="Full screen background opacity (0–10)" side="top">
      <Input
        type="number"
        value={opacityInput}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={handleBlur}
        min="0"
        max="10"
        step="0.1"
        inputMode="decimal"
        aria-label="Full screen background opacity"
        className={`w-16 shrink-0 ${darkMode
          ? 'bg-gray-700 border-gray-600 text-gray-200'
          : 'bg-white border-gray-300'
        }`}
      />
    </Tooltip>
  );
};

const FullscreenSettingsSection = ({
  darkMode,
  fullScreenAdvancedExpanded,
  setFullScreenAdvancedExpanded,
  fullScreenBackgroundTypeValue,
  handleFullScreenBackgroundTypeChange,
  fullScreenBackgroundColorValue,
  fullScreenBackgroundPaintValue,
  handleFullScreenPaintChange,
  openMediaLibrary,
  hasBackgroundMedia,
  uploadedMediaName,
  settings,
  update,
  openFullScreenElementMediaLibrary,
  hasFullScreenElementMedia,
  fullScreenElementMediaName,
  handleFullScreenElementToggle,
  openVisualizerSettings,
}) => (
  <div data-output-setting-group data-expanded={fullScreenAdvancedExpanded}>
    <div className="flex w-full items-center justify-between gap-4" data-output-setting-row>
      <Tooltip content="Configure full screen background and overlay settings" side="right">
        <LabelWithIcon icon={ScreenShare} text="Full Screen Mode" darkMode={darkMode} />
      </Tooltip>
      <Tooltip content={fullScreenAdvancedExpanded ? 'Hide settings' : 'Show settings'} side="top">
        <AdvancedToggle
          expanded={fullScreenAdvancedExpanded}
          onToggle={() => setFullScreenAdvancedExpanded(!fullScreenAdvancedExpanded)}
          darkMode={darkMode}
          ariaLabel="Toggle full screen advanced settings"
        />
      </Tooltip>
    </div>

    <AdvancedCollapse
      expanded={fullScreenAdvancedExpanded}
      openMarginTop={0}
    >
      <div className="grid grid-cols-[minmax(8.5rem,1fr)_4rem_auto] items-center gap-2" data-output-setting-subrow>
        <Select
          value={fullScreenBackgroundTypeValue}
          onValueChange={handleFullScreenBackgroundTypeChange}
        >
          <SelectTrigger
            className={`w-full ${darkMode
              ? 'bg-gray-700 border-gray-600 text-gray-200'
              : 'bg-white border-gray-300'
              }`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}>
            <SelectItem value="color">Colour</SelectItem>
            <SelectItem value="media">Image / Video</SelectItem>
            <SelectItem value="visualizer">Visualizer</SelectItem>
          </SelectContent>
        </Select>

        <FullscreenBackgroundOpacityInput
          darkMode={darkMode}
          settings={settings}
          update={update}
        />

        {fullScreenBackgroundTypeValue === 'color' ? (
          <PaintPicker
            value={fullScreenBackgroundPaintValue}
            fallbackColor={fullScreenBackgroundColorValue}
            onChange={handleFullScreenPaintChange}
            darkMode={darkMode}
            className={darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}
          />
        ) : fullScreenBackgroundTypeValue === 'media' ? (
          <div className="flex min-w-0 items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={openMediaLibrary}
              className={`h-9 px-4 shrink-0 text-xs font-semibold ${darkMode ? 'bg-gray-700 border-gray-500 text-gray-100 hover:bg-gray-600 hover:text-white hover:border-gray-400' : ''}`}
            >
              {hasBackgroundMedia ? 'Change Media' : 'Choose Media'}
            </Button>
          </div>
        ) : (
          <Tooltip content="Configure visualizer" side="top">
            <Button
              variant="outline"
              onClick={openVisualizerSettings}
              aria-label="Configure visualizer"
              className={`h-9 shrink-0 gap-2 px-4 text-xs font-semibold ${darkMode ? 'bg-gray-700 border-gray-500 text-gray-100 hover:bg-gray-600 hover:text-white hover:border-gray-400' : ''}`}
            >
              <Settings2 className="h-4 w-4" />
              Configure
            </Button>
          </Tooltip>
        )}
      </div>

      {fullScreenBackgroundTypeValue === 'media' && hasBackgroundMedia && (
        <div className="flex justify-start px-3 pb-1 pt-0.5">
          <span
            className={`max-w-full truncate text-[11px] ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}
            title={uploadedMediaName}
          >
            <strong className={darkMode ? 'text-gray-300' : 'text-gray-700'}>Loaded media:</strong> {uploadedMediaName}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between" data-output-setting-subrow>
        <Tooltip content="Show fullscreen background even when the output is toggled off" side="right">
          <label className={`text-[13px] leading-5 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Always Show Background</label>
        </Tooltip>
        <Switch
          checked={Boolean(settings.alwaysShowBackground)}
          onCheckedChange={(checked) => update('alwaysShowBackground', checked)}
          aria-label="Toggle always show background"
          className={`!h-6 !w-12 !border-0 shadow-sm transition-colors disabled:opacity-100 ${darkMode
            ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
            : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
            }`}
          thumbClassName="!h-4 !w-5 data-[state=checked]:!translate-x-6 data-[state=unchecked]:!translate-x-1"
        />
      </div>

      <div className="flex items-center justify-between" data-output-setting-subrow>
        <Tooltip content="Add an image element over the full screen background and under the lyrics" side="right">
          <label className={`text-[13px] leading-5 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Add Image/Element Overlay</label>
        </Tooltip>
        <div className="flex items-center gap-3">
          {settings.fullScreenElementEnabled && (
            <Button
              type="button"
              variant="outline"
              onClick={() => openFullScreenElementMediaLibrary()}
              className={`h-8 px-3 text-xs font-semibold ${darkMode ? 'bg-gray-700 border-gray-500 text-gray-100 hover:bg-gray-600 hover:text-white hover:border-gray-400' : ''}`}
            >
              {hasFullScreenElementMedia ? 'Change Media' : 'Choose Media'}
            </Button>
          )}
          <Switch
            checked={Boolean(settings.fullScreenElementEnabled)}
            onCheckedChange={handleFullScreenElementToggle}
            aria-label="Toggle full screen image element"
            className={`!h-6 !w-12 !border-0 shadow-sm transition-colors disabled:opacity-100 ${darkMode
              ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
              : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
              }`}
            thumbClassName="!h-4 !w-5 data-[state=checked]:!translate-x-6 data-[state=unchecked]:!translate-x-1"
          />
        </div>
      </div>

      {settings.fullScreenElementEnabled && (
        <div className="space-y-2 pt-2">
          {hasFullScreenElementMedia && (
            <div className="flex justify-start px-3 pb-1 pt-0.5">
              <span
                className={`max-w-full truncate text-[11px] ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}
                title={fullScreenElementMediaName}
              >
                <strong className={darkMode ? 'text-gray-300' : 'text-gray-700'}>Loaded media:</strong> {fullScreenElementMediaName}
              </span>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4" data-output-setting-subrow>
              <label className={`min-w-[140px] shrink-0 text-[13px] leading-5 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Position</label>
              <Select
                value={settings.fullScreenElementPosition ?? 'center'}
                onValueChange={(val) => update('fullScreenElementPosition', val)}
              >
                <SelectTrigger
                  className={`w-full min-w-0 ${darkMode
                    ? 'bg-gray-700 border-gray-600 text-gray-200'
                    : 'bg-white border-gray-300'
                    }`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}>
                  {FULLSCREEN_ELEMENT_POSITIONS.map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-2" data-output-setting-subrow>
              <div className="flex min-w-0 items-center justify-between gap-1.5">
                <label className={`text-[13px] leading-5 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Scale</label>
                <Input
                  type="number"
                  value={settings.fullScreenElementScale ?? 25}
                  onChange={(e) => update(
                    'fullScreenElementScale',
                    sanitizeNumberInput(e.target.value, settings.fullScreenElementScale ?? 25, { min: 1, max: 100 })
                  )}
                  min="1"
                  max="100"
                  step="1"
                  className={`${FULLSCREEN_ELEMENT_NUMBER_CLASS} ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}
                />
              </div>

              <div className="flex min-w-0 items-center justify-between gap-1.5">
                <label className={`text-[13px] leading-5 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Opacity</label>
                <Input
                  type="number"
                  value={settings.fullScreenElementOpacity ?? 2.5}
                  onChange={(e) => update(
                    'fullScreenElementOpacity',
                    sanitizeNumberInput(e.target.value, settings.fullScreenElementOpacity ?? 2.5, { min: 1, max: 10 })
                  )}
                  min="1"
                  max="10"
                  step="0.1"
                  inputMode="decimal"
                  className={`${FULLSCREEN_ELEMENT_NUMBER_CLASS} ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}
                />
              </div>

              <div className="flex min-w-0 items-center justify-between gap-1.5">
                <label className={`text-[13px] leading-5 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Blur</label>
                <Input
                  type="number"
                  value={settings.fullScreenElementBlur ?? 0}
                  onChange={(e) => update(
                    'fullScreenElementBlur',
                    sanitizeNumberInput(e.target.value, settings.fullScreenElementBlur ?? 0, { min: 0, max: 100 })
                  )}
                  min="0"
                  max="100"
                  step="0.5"
                  className={`${FULLSCREEN_ELEMENT_NUMBER_CLASS} ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4" data-output-setting-subrow>
              <label className={`min-w-[140px] shrink-0 text-[13px] leading-5 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>X & Y Margins</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={settings.fullScreenElementPaddingX ?? 0}
                  onChange={(e) => update(
                    'fullScreenElementPaddingX',
                    sanitizeIntegerInput(e.target.value, settings.fullScreenElementPaddingX ?? 0, { min: 0, max: 500 })
                  )}
                  min="0"
                  max="500"
                  aria-label="Image element X margin"
                  className={`${FULLSCREEN_ELEMENT_NUMBER_CLASS} ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}
                />
                <Input
                  type="number"
                  value={settings.fullScreenElementPaddingY ?? 0}
                  onChange={(e) => update(
                    'fullScreenElementPaddingY',
                    sanitizeIntegerInput(e.target.value, settings.fullScreenElementPaddingY ?? 0, { min: 0, max: 500 })
                  )}
                  min="0"
                  max="500"
                  aria-label="Image element Y margin"
                  className={`${FULLSCREEN_ELEMENT_NUMBER_CLASS} ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </AdvancedCollapse>

  </div>
);

export default FullscreenSettingsSection;
