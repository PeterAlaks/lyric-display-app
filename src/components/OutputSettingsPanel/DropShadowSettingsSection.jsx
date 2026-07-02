import { Contrast, MoveHorizontal, MoveVertical, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tooltip } from '@/components/ui/tooltip';
import { ColorPicker } from '@/components/ui/color-picker';
import { AdvancedCollapse, AdvancedToggle } from '../OutputSettingsShared';
import { sanitizeIntegerInput } from '../../utils/numberInput';

const SettingRow = ({ icon: Icon, label, tooltip, children, rightClassName = 'flex items-center gap-2 justify-end', darkMode }) => (
  <div className="flex items-center justify-between gap-4">
    <Tooltip content={tooltip} side="right">
      <div className="flex items-center gap-2 min-w-[140px]">
        {Icon ? <Icon className={`h-3.5 w-3.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} /> : null}
        <label className={`text-[13px] leading-5 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{label}</label>
      </div>
    </Tooltip>
    <div className={rightClassName}>{children}</div>
  </div>
);

const DropShadowSettingsSection = ({
  darkMode,
  dropShadowAdvancedExpanded,
  dropShadowBlur,
  dropShadowOffsetX,
  dropShadowOffsetY,
  setDropShadowAdvancedExpanded,
  settings,
  update,
}) => (
  <div>
    <SettingRow
      icon={Contrast}
      label="Drop Shadow"
      tooltip="Add shadow behind text for depth (0-10 opacity)"
      rightClassName="flex items-center gap-2 justify-end w-full"
      darkMode={darkMode}
    >
      <Tooltip content={dropShadowAdvancedExpanded ? 'Hide advanced settings' : 'Show advanced settings'} side="top">
        <AdvancedToggle
          expanded={dropShadowAdvancedExpanded}
          onToggle={() => setDropShadowAdvancedExpanded(!dropShadowAdvancedExpanded)}
          darkMode={darkMode}
          ariaLabel="Toggle drop shadow advanced settings"
        />
      </Tooltip>
      <ColorPicker
        value={settings.dropShadowColor}
        onChange={(val) => update('dropShadowColor', val)}
        darkMode={darkMode}
        className={darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}
      />
      <Input
        type="number"
        value={settings.dropShadowOpacity}
        onChange={(e) => update(
          'dropShadowOpacity',
          sanitizeIntegerInput(e.target.value, settings.dropShadowOpacity ?? 0, { min: 0, max: 10 })
        )}
        min="0"
        max="10"
        className={`w-20 ${darkMode
          ? 'bg-gray-700 border-gray-600 text-gray-200'
          : 'bg-white border-gray-300'
          }`}
      />
    </SettingRow>

    <AdvancedCollapse expanded={dropShadowAdvancedExpanded}>
      <div className="flex items-center justify-between w-full">
        <Tooltip content="Horizontal shadow offset in pixels (negative = left, positive = right)" side="top">
          <div className="flex items-center gap-2">
            <MoveHorizontal className={`h-3.5 w-3.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
            <Input
              type="number"
              value={dropShadowOffsetX}
              onChange={(e) => update(
                'dropShadowOffsetX',
                sanitizeIntegerInput(e.target.value, settings.dropShadowOffsetX ?? 0, { min: -50, max: 50 })
              )}
              min="-50"
              max="50"
              className={`w-16 ${darkMode
                ? 'bg-gray-700 border-gray-600 text-gray-200'
                : 'bg-white border-gray-300'
                }`}
            />
          </div>
        </Tooltip>

        <Tooltip content="Vertical shadow offset in pixels (negative = up, positive = down)" side="top">
          <div className="flex items-center gap-2">
            <MoveVertical className={`h-3.5 w-3.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
            <Input
              type="number"
              value={dropShadowOffsetY}
              onChange={(e) => update(
                'dropShadowOffsetY',
                sanitizeIntegerInput(e.target.value, settings.dropShadowOffsetY ?? 8, { min: -50, max: 50 })
              )}
              min="-50"
              max="50"
              className={`w-16 ${darkMode
                ? 'bg-gray-700 border-gray-600 text-gray-200'
                : 'bg-white border-gray-300'
                }`}
            />
          </div>
        </Tooltip>

        <Tooltip content="Shadow blur radius in pixels (0 = sharp, higher = softer)" side="top">
          <div className="flex items-center gap-2">
            <Sparkles className={`h-3.5 w-3.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
            <Input
              type="number"
              value={dropShadowBlur}
              onChange={(e) => update(
                'dropShadowBlur',
                sanitizeIntegerInput(e.target.value, settings.dropShadowBlur ?? 10, { min: 0, max: 50 })
              )}
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
    </AdvancedCollapse>
  </div>
);

export default DropShadowSettingsSection;
