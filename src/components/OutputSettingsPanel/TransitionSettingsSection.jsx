import { ArrowRightLeft, Shuffle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tooltip } from '@/components/ui/tooltip';
import { AdvancedCollapse, AdvancedToggle, SettingRow } from '../OutputSettingsShared';
import { sanitizeIntegerInput, sanitizeNumberInput } from '../../utils/numberInput';
import { getEmphasisToggleStateClassName } from '../../utils/emphasisToggleStyles.js';
import { LYRIC_TRANSITION_ANIMATION_OPTIONS } from '../../../shared/transitionSettings.js';
import {
  KINETIC_INTENSITY_OPTIONS,
  KINETIC_LOOP_HOLD_LIMITS,
  KINETIC_PRESET_IDS,
  KINETIC_PRESETS,
  KINETIC_TRANSITION,
  KINETIC_VARIATION_OPTIONS,
  normalizeKineticSettings,
} from '../../../shared/kineticTypography.js';

const KINETIC_SEED_LIMIT = 0x7fffffff;

const KineticSettings = ({ darkMode, fieldClass, contentClass, labelClass, settings, update }) => {
  const kinetic = normalizeKineticSettings(settings);

  const togglePreset = (presetId) => {
    const enabled = kinetic.pool.includes(presetId)
      ? kinetic.pool.filter((id) => id !== presetId)
      : [...kinetic.pool, presetId];
    if (enabled.length === 0) return;
    // Store "all presets" as an empty pool so presets added later are included automatically.
    update(
      'kineticPresetPool',
      enabled.length === KINETIC_PRESET_IDS.length ? [] : KINETIC_PRESET_IDS.filter((id) => enabled.includes(id))
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3" data-output-setting-subrow>
        <Tooltip content="Per song part keeps one look for each section, so every chorus animates the same way" side="right">
          <label className={labelClass}>Variation</label>
        </Tooltip>
        <Select value={kinetic.variation} onValueChange={(value) => update('kineticVariation', value)}>
          <SelectTrigger className={`w-35 ${fieldClass}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={contentClass}>
            {KINETIC_VARIATION_OPTIONS.map(({ value, label }) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-3" data-output-setting-subrow>
        <Tooltip content="How far words travel and how long lines take to settle" side="right">
          <label className={labelClass}>Intensity</label>
        </Tooltip>
        <Select value={kinetic.intensity} onValueChange={(value) => update('kineticIntensity', value)}>
          <SelectTrigger className={`w-35 ${fieldClass}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={contentClass}>
            {KINETIC_INTENSITY_OPTIONS.map(({ value, label }) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-3" data-output-setting-subrow>
        <Tooltip content="Slowly drift or float the line while it stays on screen" side="right">
          <label className={labelClass}>Hold Motion</label>
        </Tooltip>
        <Switch
          checked={kinetic.holdMotion}
          onCheckedChange={(checked) => update('kineticHoldMotion', checked)}
          aria-label="Toggle kinetic hold motion"
          size="small"
          variant="control"
        />
      </div>

      <div className="flex items-center justify-between gap-3" data-output-setting-subrow>
        <Tooltip content="Keep replaying the line's animation for as long as it stays on screen" side="right">
          <label className={labelClass}>Replay While Live</label>
        </Tooltip>
        <Switch
          checked={kinetic.loop}
          onCheckedChange={(checked) => update('kineticLoop', checked)}
          aria-label="Toggle replaying kinetic animation while the line is live"
          size="small"
          variant="control"
        />
      </div>

      {kinetic.loop && (
        <div className="flex items-center justify-between gap-3" data-output-setting-subrow>
          <Tooltip content="How long the line rests on screen before it plays again" side="right">
            <label className={labelClass}>Replay Every (s)</label>
          </Tooltip>
          <Input
            type="number"
            min={KINETIC_LOOP_HOLD_LIMITS.min / 1000}
            max={KINETIC_LOOP_HOLD_LIMITS.max / 1000}
            step="0.5"
            value={(settings.kineticLoopHoldMs ?? kinetic.loopHoldMs) / 1000}
            onChange={(e) => update(
              'kineticLoopHoldMs',
              Math.round(sanitizeNumberInput(
                e.target.value,
                kinetic.loopHoldMs / 1000,
                {
                  min: KINETIC_LOOP_HOLD_LIMITS.min / 1000,
                  max: KINETIC_LOOP_HOLD_LIMITS.max / 1000,
                  clampMin: false,
                }
              ) * 1000)
            )}
            className={`w-24 ${fieldClass}`}
          />
        </div>
      )}

      <div className="space-y-2" data-output-setting-subrow>
        <div className="flex items-center justify-between gap-3">
          <Tooltip content="Effects the output picks from. Keep at least one selected." side="right">
            <label className={labelClass}>Effects</label>
          </Tooltip>
          <Tooltip content="Deal a new set of looks for every song" side="top">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => update('kineticSeed', Math.floor(Math.random() * KINETIC_SEED_LIMIT))}
              className={`h-6 gap-1 rounded px-2 text-[11px] font-normal leading-none [&_svg]:size-3! ${getEmphasisToggleStateClassName(false, darkMode)}`}
            >
              <Shuffle />
              Shuffle
            </Button>
          </Tooltip>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {KINETIC_PRESETS.map(({ id, label }) => {
            const active = kinetic.pool.includes(id);
            return (
              <Button
                key={id}
                type="button"
                variant="outline"
                size="sm"
                aria-pressed={active}
                onClick={() => togglePreset(id)}
                className={`h-6 rounded px-2 text-[11px] font-normal leading-none ${getEmphasisToggleStateClassName(active, darkMode)}`}
              >
                {label}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const TransitionSettingsSection = ({
  darkMode,
  setTransitionAdvancedExpanded,
  settings,
  transitionAdvancedExpanded,
  update,
}) => {
  const transitionAnimation = settings.transitionAnimation ?? 'none';
  const isKinetic = transitionAnimation === KINETIC_TRANSITION;
  const fieldClass = darkMode
    ? 'bg-gray-700 border-gray-600 text-gray-200'
    : 'bg-white border-gray-300';
  const labelClass = `text-[13px] leading-5 whitespace-nowrap ${darkMode ? 'text-gray-200' : 'text-gray-700'}`;

  return (
    <div data-output-setting-group data-expanded={transitionAdvancedExpanded}>
      <SettingRow
        icon={ArrowRightLeft}
        label="Transition Style"
        tooltip="Choose animation style when lyrics change on display. Kinetic animates each word or letter."
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
          value={transitionAnimation}
          onValueChange={(val) => {
            update('transitionAnimation', val);
            if (val === KINETIC_TRANSITION) setTransitionAdvancedExpanded(true);
          }}
        >
          <SelectTrigger className={`w-35 ${fieldClass}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}>
            {LYRIC_TRANSITION_ANIMATION_OPTIONS.map(({ value, label }) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>

      <AdvancedCollapse expanded={transitionAdvancedExpanded} openMarginTop={0}>
        {isKinetic ? (
          <KineticSettings
            darkMode={darkMode}
            fieldClass={fieldClass}
            contentClass={darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}
            labelClass={labelClass}
            settings={settings}
            update={update}
          />
        ) : (
          <div className="flex items-center justify-between" data-output-setting-subrow>
            <label className={`${labelClass} ${transitionAnimation === 'none' ? 'opacity-50' : ''}`}>
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
              disabled={transitionAnimation === 'none'}
              className={`w-24 ${fieldClass} ${transitionAnimation === 'none' ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          </div>
        )}
      </AdvancedCollapse>
    </div>
  );
};

export default TransitionSettingsSection;
