import { ArrowRightLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip } from '@/components/ui/tooltip';
import { AdvancedCollapse, AdvancedToggle } from '../OutputSettingsShared';
import { sanitizeIntegerInput } from '../../utils/numberInput';

const SettingRow = ({ icon: Icon, label, tooltip, children, rightClassName = 'flex items-center gap-2 justify-end', darkMode }) => (
  <div className="flex items-center justify-between gap-4" data-output-setting-row>
    <Tooltip content={tooltip} side="right">
      <div className="flex items-center gap-2 min-w-[140px]" data-output-setting-label>
        {Icon ? (
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full" data-output-setting-icon>
            <Icon className={`h-3.5 w-3.5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} />
          </span>
        ) : null}
        <label className={`text-[13px] leading-5 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{label}</label>
      </div>
    </Tooltip>
    <div className={rightClassName}>{children}</div>
  </div>
);

const TransitionSettingsSection = ({
  darkMode,
  setTransitionAdvancedExpanded,
  settings,
  transitionAdvancedExpanded,
  update,
}) => (
  <div data-output-setting-group data-expanded={transitionAdvancedExpanded}>
    <SettingRow
      icon={ArrowRightLeft}
      label="Transition Style"
      tooltip="Choose animation style when lyrics change on display"
      rightClassName="flex items-center gap-2 justify-end w-full"
      darkMode={darkMode}
    >
      <Tooltip content={transitionAdvancedExpanded ? 'Hide advanced settings' : 'Show advanced settings'} side="top">
        <AdvancedToggle
          expanded={transitionAdvancedExpanded}
          onToggle={() => setTransitionAdvancedExpanded(!transitionAdvancedExpanded)}
          darkMode={darkMode}
          ariaLabel="Toggle transition advanced settings"
        />
      </Tooltip>
      <Select
        value={settings.transitionAnimation ?? 'none'}
        onValueChange={(val) => update('transitionAnimation', val)}
      >
        <SelectTrigger
          className={`w-[140px] ${darkMode
            ? 'bg-gray-700 border-gray-600 text-gray-200'
            : 'bg-white border-gray-300'
            }`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}>
          <SelectItem value="none">None</SelectItem>
          <SelectItem value="fade">Fade</SelectItem>
          <SelectItem value="scale">Scale</SelectItem>
          <SelectItem value="slide">Slide</SelectItem>
          <SelectItem value="blur">Blur</SelectItem>
        </SelectContent>
      </Select>
    </SettingRow>

    <AdvancedCollapse expanded={transitionAdvancedExpanded} openMarginTop={0}>
      <div className="flex items-center justify-between" data-output-setting-subrow>
        <label className={`text-[13px] leading-5 whitespace-nowrap ${darkMode ? 'text-gray-200' : 'text-gray-700'} ${(settings.transitionAnimation ?? 'none') === 'none' ? 'opacity-50' : ''}`}>
          Transition Speed (ms)
        </label>
        <Input
          type="number"
          value={settings.transitionSpeed ?? 150}
          onChange={(e) => update(
            'transitionSpeed',
            sanitizeIntegerInput(
              e.target.value,
              settings.transitionSpeed ?? 150,
              { min: 100, max: 2000, clampMin: false }
            )
          )}
          min="100"
          max="2000"
          step="50"
          disabled={(settings.transitionAnimation ?? 'none') === 'none'}
          className={`w-24 ${darkMode
            ? 'bg-gray-700 border-gray-600 text-gray-200'
            : 'bg-white border-gray-300'
          } ${(settings.transitionAnimation ?? 'none') === 'none' ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
      </div>
    </AdvancedCollapse>
  </div>
);

export default TransitionSettingsSection;
