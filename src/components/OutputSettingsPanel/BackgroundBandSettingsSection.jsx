import { ArrowUpDown, Rows3 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip } from '@/components/ui/tooltip';
import { AdvancedCollapse } from '../OutputSettingsShared';
import { sanitizeIntegerInput } from '../../utils/numberInput';

const BackgroundBandSettingsSection = ({
  applySettings,
  backgroundAdvancedExpanded,
  backgroundBandCustomLines,
  backgroundBandHeightMode,
  backgroundBandLockedToMaxLines,
  backgroundBandVerticalPadding,
  darkMode,
  fullScreenModeChecked,
  handleBackgroundHeightModeChange,
  handleCustomLinesChange,
  maxLinesEnabled,
  maxLinesValue,
  settings,
  update,
}) => (
  <AdvancedCollapse expanded={backgroundAdvancedExpanded && !fullScreenModeChecked}>
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-2">
        <label className={`text-[13px] leading-5 whitespace-nowrap ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
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
          <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}>
            <SelectItem value="adaptive">Adaptive</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {backgroundBandHeightMode === 'custom' && (
        <Tooltip content={
          !maxLinesEnabled
            ? 'Number of lines for band height'
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
              aria-label={maxLinesEnabled ? (backgroundBandLockedToMaxLines ? 'Unlock from max lines' : 'Lock to max lines') : undefined}
            >
              <Rows3 className={`h-3.5 w-3.5 ${backgroundBandLockedToMaxLines && maxLinesEnabled
                ? 'text-white'
                : darkMode ? 'text-gray-400' : 'text-gray-500'
                }`}
              />
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

      <Tooltip content="Vertical padding for background band (in pixels)" side="top">
        <div className="flex items-center gap-2">
          <ArrowUpDown className={`h-3.5 w-3.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
          <Input
            type="number"
            value={backgroundBandVerticalPadding}
            onChange={(e) => update(
              'backgroundBandVerticalPadding',
              sanitizeIntegerInput(
                e.target.value,
                settings.backgroundBandVerticalPadding ?? 20,
                { min: 0, max: 100 }
              )
            )}
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
  </AdvancedCollapse>
);

export default BackgroundBandSettingsSection;
