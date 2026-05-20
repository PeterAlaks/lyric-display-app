import { BetweenVerticalEnd, Frame, ListIndentIncrease } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tooltip } from '@/components/ui/tooltip';
import { ColorPicker } from '@/components/ui/color-picker';
import { Slider } from '@/components/ui/slider';
import { LabelWithIcon, blurInputOnEnter } from '../OutputSettingsShared';
import { sanitizeIntegerInput } from '../../utils/numberInput';

const clampNumber = (value, min, max) => {
  const parsed = parseFloat(value);
  if (Number.isNaN(parsed)) return null;
  return Math.min(max, Math.max(min, parsed));
};

const TypographySpacingSection = ({ darkMode, settings, update }) => (
  <>
    <div className="flex items-center justify-between gap-4">
      <Tooltip content="Adjust letter spacing (-5 to 20 pixels)" side="right">
        <LabelWithIcon icon={BetweenVerticalEnd} text="Letter Spacing" darkMode={darkMode} />
      </Tooltip>
      <div className="flex items-center gap-2">
        <Slider
          min={-5}
          max={20}
          step={0.5}
          value={[settings.letterSpacing ?? 0]}
          onValueChange={([val]) => update('letterSpacing', val)}
          className="w-24"
        />
        <Input
          type="number"
          value={settings.letterSpacing ?? 0}
          onChange={(e) => {
            const value = clampNumber(e.target.value, -5, 20);
            if (value !== null) update('letterSpacing', value);
          }}
          onKeyDown={blurInputOnEnter}
          min="-5"
          max="20"
          step="0.5"
          className={`w-20 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}
        />
      </div>
    </div>

    <div className="flex items-center justify-between gap-4">
      <Tooltip content="Adjust line spacing (0.8 to 3.0)" side="right">
        <LabelWithIcon icon={ListIndentIncrease} text="Line Spacing" darkMode={darkMode} />
      </Tooltip>
      <div className="flex items-center gap-2">
        <Slider
          min={0.8}
          max={3}
          step={0.01}
          value={[settings.lineSpacing ?? 1]}
          onValueChange={([val]) => update('lineSpacing', val)}
          className="w-24"
        />
        <Input
          type="number"
          value={settings.lineSpacing ?? 1}
          onChange={(e) => {
            const value = clampNumber(e.target.value, 0.8, 3);
            if (value !== null) update('lineSpacing', value);
          }}
          onKeyDown={blurInputOnEnter}
          min="0.8"
          max="3"
          step="0.1"
          className={`w-20 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}
        />
      </div>
    </div>

    <div className="flex items-center justify-between gap-4">
      <Tooltip content="Add an outline around text for better visibility (0-10px)" side="right">
        <LabelWithIcon icon={Frame} text="Text Border" darkMode={darkMode} />
      </Tooltip>
      <div className="flex gap-2 items-center">
        <ColorPicker
          value={settings.borderColor ?? '#000000'}
          onChange={(val) => update('borderColor', val)}
          darkMode={darkMode}
          className={darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}
        />
        <Input
          type="number"
          value={settings.borderSize ?? 0}
          onChange={(e) => update(
            'borderSize',
            sanitizeIntegerInput(e.target.value, settings.borderSize ?? 0, { min: 0, max: 10 })
          )}
          min="0"
          max="10"
          className={`w-20 ${darkMode
            ? 'bg-gray-700 border-gray-600 text-gray-200'
            : 'bg-white border-gray-300'
            }`}
        />
      </div>
    </div>
  </>
);

export default TypographySpacingSection;
