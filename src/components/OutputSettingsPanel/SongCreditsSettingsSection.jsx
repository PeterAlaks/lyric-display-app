import { useState } from 'react';
import { Copyright } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip } from '@/components/ui/tooltip';
import { ColorPicker } from '@/components/ui/color-picker';
import { AdvancedCollapse, AdvancedToggle, SettingRow } from '../OutputSettingsShared';
import { sanitizeIntegerInput } from '../../utils/numberInput';
import { DEFAULT_SONG_CREDITS_SETTINGS } from '../../context/lyricsStore/outputSlice';

const MODE_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'first', label: 'First line' },
  { value: 'last', label: 'Last line' },
  { value: 'first-last', label: 'First & last' },
  { value: 'always', label: 'Every line' },
];

const POSITION_OPTIONS = [
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'bottom-center', label: 'Bottom centre' },
  { value: 'bottom-right', label: 'Bottom right' },
  { value: 'top-left', label: 'Top left' },
  { value: 'top-center', label: 'Top centre' },
  { value: 'top-right', label: 'Top right' },
];

const SongCreditsSettingsSection = ({ darkMode, settings, update }) => {
  const [expanded, setExpanded] = useState(false);
  const mode = settings.songCreditsMode ?? DEFAULT_SONG_CREDITS_SETTINGS.songCreditsMode;
  const disabled = mode === 'off';
  const fieldClass = darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300';
  const subLabelClass = `text-[13px] leading-5 whitespace-nowrap ${darkMode ? 'text-gray-200' : 'text-gray-700'} ${disabled ? 'opacity-50' : ''}`;
  const fontSize = settings.songCreditsFontSize ?? DEFAULT_SONG_CREDITS_SETTINGS.songCreditsFontSize;
  const opacity = settings.songCreditsOpacity ?? DEFAULT_SONG_CREDITS_SETTINGS.songCreditsOpacity;

  return (
    <div data-output-setting-group data-expanded={expanded}>
      <SettingRow
        icon={Copyright}
        label="Song Credits"
        tooltip="Show the song title, writers, copyright, and CCLI numbers (add your CCLI licence number in Preferences > General)"
        rightClassName="flex items-center gap-2 justify-end w-full"
        darkMode={darkMode}
      >
        <Tooltip content={expanded ? 'Hide credit styling' : 'Show credit styling'} side="top">
          <AdvancedToggle
            expanded={expanded}
            onToggle={() => setExpanded(!expanded)}
            darkMode={darkMode}
            ariaLabel="Toggle song credit styling"
          />
        </Tooltip>
        <Select value={mode} onValueChange={(value) => update('songCreditsMode', value)}>
          <SelectTrigger className={`w-35 ${fieldClass}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={fieldClass}>
            {MODE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>

      <AdvancedCollapse expanded={expanded} openMarginTop={0}>
        <div className="space-y-2">
          <div className="flex items-center justify-between" data-output-setting-subrow>
            <label className={subLabelClass}>Position</label>
            <Select
              value={settings.songCreditsPosition ?? DEFAULT_SONG_CREDITS_SETTINGS.songCreditsPosition}
              onValueChange={(value) => update('songCreditsPosition', value)}
              disabled={disabled}
            >
              <SelectTrigger className={`w-35 ${fieldClass}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={fieldClass}>
                {POSITION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between" data-output-setting-subrow>
            <label className={subLabelClass}>Text Size (px)</label>
            <Input
              type="number"
              min="10"
              max="72"
              value={fontSize}
              disabled={disabled}
              onChange={(event) => update('songCreditsFontSize', sanitizeIntegerInput(event.target.value, fontSize, { min: 10, max: 72 }))}
              className={`w-24 ${fieldClass}`}
            />
          </div>
          <div className="flex items-center justify-between" data-output-setting-subrow>
            <label className={subLabelClass}>Colour</label>
            <ColorPicker
              value={settings.songCreditsColor ?? DEFAULT_SONG_CREDITS_SETTINGS.songCreditsColor}
              onChange={(value) => update('songCreditsColor', value)}
              darkMode={darkMode}
              className={fieldClass}
            />
          </div>
          <div className="flex items-center justify-between" data-output-setting-subrow>
            <label className={subLabelClass}>Opacity (%)</label>
            <Input
              type="number"
              min="10"
              max="100"
              step="5"
              value={opacity}
              disabled={disabled}
              onChange={(event) => update('songCreditsOpacity', sanitizeIntegerInput(event.target.value, opacity, { min: 10, max: 100 }))}
              className={`w-24 ${fieldClass}`}
            />
          </div>
        </div>
      </AdvancedCollapse>
    </div>
  );
};

export default SongCreditsSettingsSection;
