import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DEFAULT_APPEARANCE_TRANSITIONS,
  MAX_TRANSITION_DURATION_MS,
  MIN_TRANSITION_DURATION_MS,
  TRANSITION_ANIMATION_OPTIONS,
} from '../../../shared/transitionSettings.js';

const TRANSITION_FIELDS = [
  {
    title: 'Timer and clock',
    description: 'When the Time Display switches between the global clock and an active timer.',
    animationKey: 'timerStateTransitionAnimation',
    durationKey: 'timerStateTransitionDuration',
  },
  {
    title: 'Full-screen background',
    description: 'When an output changes from one full-screen image or video background to another.',
    animationKey: 'backgroundMediaTransitionAnimation',
    durationKey: 'backgroundMediaTransitionDuration',
  },
  {
    title: 'Output visibility',
    description: 'When all outputs or an individual output is turned on or off.',
    animationKey: 'outputVisibilityTransitionAnimation',
    durationKey: 'outputVisibilityTransitionDuration',
  },
];

const DisplayTransitionsPreferencesPage = ({
  getNumberPreferenceInputProps,
  inputClass,
  labelClass,
  mutedClass,
  onBack,
  preferences,
  selectContentClass,
  updatePreference,
}) => (
  <div>
    <div className="mb-5 flex min-w-0 items-center gap-2">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={onBack}
        aria-label="Back from Display Transitions"
        className="h-7 w-7 shrink-0"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
      </Button>
      <div className="min-w-0">
        <h3 className={`truncate text-base font-semibold ${labelClass}`}>Display Transitions</h3>
        <p className={`text-[11px] ${mutedClass}`}>Choose None for an instant change</p>
      </div>
    </div>

    <div className="space-y-5">
      {TRANSITION_FIELDS.map((field) => {
        const animation = preferences.appearance?.[field.animationKey]
          ?? DEFAULT_APPEARANCE_TRANSITIONS[field.animationKey];
        const durationDisabled = animation === 'none';

        return (
          <div key={field.animationKey} className="space-y-3">
            <div>
              <label className={`text-sm font-medium ${labelClass}`}>{field.title}</label>
              <p className={`mt-0.5 text-xs ${mutedClass}`}>{field.description}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
              <label className="space-y-1.5">
                <span className={`block text-xs font-medium ${labelClass}`}>Animation</span>
                <Select
                  value={animation}
                  onValueChange={(value) => updatePreference('appearance', field.animationKey, value)}
                >
                  <SelectTrigger
                    aria-label={`${field.title} animation`}
                    className={inputClass}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    {TRANSITION_ANIMATION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className={`space-y-1.5 ${durationDisabled ? 'opacity-50' : ''}`}>
                <span className={`block text-xs font-medium ${labelClass}`}>Duration (ms)</span>
                <Input
                  type="number"
                  min={MIN_TRANSITION_DURATION_MS}
                  max={MAX_TRANSITION_DURATION_MS}
                  step="50"
                  disabled={durationDisabled}
                  aria-label={`${field.title} duration in milliseconds`}
                  {...getNumberPreferenceInputProps('appearance', field.durationKey, {
                    min: MIN_TRANSITION_DURATION_MS,
                    max: MAX_TRANSITION_DURATION_MS,
                    fallbackValue: DEFAULT_APPEARANCE_TRANSITIONS[field.durationKey],
                  })}
                  className={inputClass}
                />
              </label>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

export default DisplayTransitionsPreferencesPage;
