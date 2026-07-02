import { ScreenShare } from 'lucide-react';
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

const FULLSCREEN_ELEMENT_NUMBER_CLASS = 'w-[60px]';

const FullscreenSettingsSection = ({
  darkMode,
  fullScreenAdvancedExpanded,
  setFullScreenAdvancedExpanded,
  fullScreenModeChecked,
  handleFullScreenToggleWithExpand,
  fullScreenAdvancedRef,
  fullScreenAdvancedVisible,
  fullScreenControlsDisabled,
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
}) => (
  <div>
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <Tooltip content="Enable full screen display with custom background settings" side="right">
          <LabelWithIcon icon={ScreenShare} text="Full Screen Mode" darkMode={darkMode} />
        </Tooltip>
        <Tooltip content={fullScreenAdvancedExpanded ? 'Hide advanced settings' : 'Show advanced settings'} side="top">
          <AdvancedToggle
            expanded={fullScreenAdvancedExpanded}
            onToggle={() => setFullScreenAdvancedExpanded(!fullScreenAdvancedExpanded)}
            darkMode={darkMode}
            ariaLabel="Toggle full screen advanced settings"
          />
        </Tooltip>
      </div>
      <div className="flex items-center gap-3 justify-end w-full">
        <span className={`text-[13px] leading-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          {fullScreenModeChecked ? 'Enabled' : 'Disabled'}
        </span>
        <Switch
          checked={fullScreenModeChecked}
          onCheckedChange={handleFullScreenToggleWithExpand}
          aria-label="Toggle full screen mode"
          className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
            ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
            : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
            }`}
          thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
        />
      </div>
    </div>

    <AdvancedCollapse
      ref={fullScreenAdvancedRef}
      expanded={fullScreenAdvancedVisible}
    >
      <div className={`flex items-center gap-3 justify-between w-full pt-2 ${fullScreenControlsDisabled ? 'opacity-60 pointer-events-none' : ''}`}>
        <Select
          value={fullScreenBackgroundTypeValue}
          onValueChange={handleFullScreenBackgroundTypeChange}
          disabled={fullScreenControlsDisabled}
        >
          <SelectTrigger
            disabled={fullScreenControlsDisabled}
            className={`w-[200px] ${darkMode
              ? 'bg-gray-700 border-gray-600 text-gray-200'
              : 'bg-white border-gray-300'
              } ${fullScreenControlsDisabled ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}>
            <SelectItem value="color">Colour</SelectItem>
            <SelectItem value="media">Image / Video</SelectItem>
          </SelectContent>
        </Select>

        {fullScreenBackgroundTypeValue === 'color' ? (
          <PaintPicker
            value={fullScreenBackgroundPaintValue}
            fallbackColor={fullScreenBackgroundColorValue}
            onChange={handleFullScreenPaintChange}
            darkMode={darkMode}
            disabled={fullScreenControlsDisabled}
            className={`ml-auto ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'} ${fullScreenControlsDisabled ? 'opacity-70 cursor-not-allowed' : ''}`}
          />
        ) : (
          <div className="flex items-center gap-2 ml-auto min-w-0 max-w-full">
            <Button
              variant="outline"
              onClick={openMediaLibrary}
              disabled={fullScreenControlsDisabled}
              className={`h-9 px-4 shrink-0 text-xs font-semibold ${darkMode ? 'bg-gray-700 border-gray-500 text-gray-100 hover:bg-gray-600 hover:text-white hover:border-gray-400' : ''} ${fullScreenControlsDisabled ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {hasBackgroundMedia ? 'Change Media' : 'Choose Media'}
            </Button>
          </div>
        )}
      </div>

      {fullScreenBackgroundTypeValue === 'media' && hasBackgroundMedia && (
        <div className={`flex justify-start pt-2 ${fullScreenControlsDisabled ? 'opacity-60 pointer-events-none' : ''}`}>
          <span
            className={`max-w-full truncate text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}
            title={uploadedMediaName}
          >
            <strong className={darkMode ? 'text-gray-300' : 'text-gray-700'}>Loaded media:</strong> {uploadedMediaName}
          </span>
        </div>
      )}

      <div className="py-3">
        <div className={`border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`} />
      </div>

      <div className={`flex items-center justify-between w-full pt-3 ${fullScreenControlsDisabled ? 'opacity-60 pointer-events-none' : ''}`}>
        <Tooltip content="Show fullscreen background even when the output is toggled off" side="right">
          <label className={`text-[13px] leading-5 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Always Show Background</label>
        </Tooltip>
        <Switch
          checked={Boolean(settings.alwaysShowBackground)}
          onCheckedChange={(checked) => update('alwaysShowBackground', checked)}
          disabled={fullScreenControlsDisabled}
          aria-label="Toggle always show background"
          className={`!h-6 !w-12 !border-0 shadow-sm transition-colors disabled:opacity-100 ${darkMode
            ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
            : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
            }`}
          thumbClassName="!h-4 !w-5 data-[state=checked]:!translate-x-6 data-[state=unchecked]:!translate-x-1"
        />
      </div>

      <div className={`flex items-center justify-between w-full pt-3 ${fullScreenControlsDisabled ? 'opacity-60 pointer-events-none' : ''}`}>
        <Tooltip content="Add an image element over the full screen background and under the lyrics" side="right">
          <label className={`text-[13px] leading-5 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Add Image/Element Overlay</label>
        </Tooltip>
        <div className="flex items-center gap-3">
          {settings.fullScreenElementEnabled && (
            <Button
              type="button"
              variant="outline"
              onClick={() => openFullScreenElementMediaLibrary()}
              disabled={fullScreenControlsDisabled}
              className={`h-8 px-3 text-xs font-semibold ${darkMode ? 'bg-gray-700 border-gray-500 text-gray-100 hover:bg-gray-600 hover:text-white hover:border-gray-400' : ''}`}
            >
              {hasFullScreenElementMedia ? 'Change Media' : 'Choose Media'}
            </Button>
          )}
          <Switch
            checked={Boolean(settings.fullScreenElementEnabled)}
            onCheckedChange={handleFullScreenElementToggle}
            disabled={fullScreenControlsDisabled}
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
        <div className={`space-y-3 pt-3 ${fullScreenControlsDisabled ? 'opacity-60 pointer-events-none' : ''}`}>
          {hasFullScreenElementMedia && (
            <div className="flex justify-start">
              <span
                className={`max-w-full truncate text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}
                title={fullScreenElementMediaName}
              >
                <strong className={darkMode ? 'text-gray-300' : 'text-gray-700'}>Loaded media:</strong> {fullScreenElementMediaName}
              </span>
            </div>
          )}

          {hasFullScreenElementMedia && (
            <div className="py-3">
              <div className={`border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`} />
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <label className={`min-w-[140px] shrink-0 text-[13px] leading-5 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Position</label>
              <Select
                value={settings.fullScreenElementPosition ?? 'center'}
                onValueChange={(val) => update('fullScreenElementPosition', val)}
                disabled={fullScreenControlsDisabled}
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

            <div className="grid grid-cols-3 gap-3">
              <div className="flex min-w-0 items-center justify-between gap-2">
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

              <div className="flex min-w-0 items-center justify-between gap-2">
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

              <div className="flex min-w-0 items-center justify-between gap-2">
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

            <div className="flex items-center justify-between gap-4">
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
