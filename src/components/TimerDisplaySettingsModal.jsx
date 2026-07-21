import React from 'react';
import { Clock3, LayoutPanelTop } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { getTimerToggleProps } from '../utils/timerUtils';

const SettingRow = ({ title, description, children, disabled = false, mutedText }) => (
  <div className={`flex items-center justify-between gap-5 py-2.5 ${disabled ? 'opacity-50' : ''}`}>
    <div className="min-w-0">
      <p className="text-xs font-medium text-gray-900 dark:text-gray-100">{title}</p>
      {description && <p className={`mt-0.5 text-[10px] leading-relaxed ${mutedText}`}>{description}</p>}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

const TimerDisplaySettingsModal = ({ displaySettings, onDraftChange, darkMode = false }) => {
  const [settings, setSettings] = React.useState(() => ({ ...displaySettings }));
  const settingsRef = React.useRef(settings);
  const mutedText = darkMode ? 'text-gray-400' : 'text-gray-500';
  const cardClass = darkMode ? 'border-gray-800 bg-gray-950/35' : 'border-gray-200 bg-gray-50/70';
  const dividerClass = darkMode ? 'divide-gray-800' : 'divide-gray-200';
  const selectTriggerClass = darkMode
    ? 'bg-gray-800 border-gray-700 text-gray-100 text-xs'
    : 'bg-white border-gray-300 text-xs';
  const selectContentClass = darkMode
    ? 'bg-gray-800 border-gray-700 text-gray-100'
    : 'bg-white border-gray-300';
  const switchProps = getTimerToggleProps(darkMode);

  const update = React.useCallback((partial) => {
    const nextSettings = { ...settingsRef.current, ...partial };
    settingsRef.current = nextSettings;
    setSettings(nextSettings);
    onDraftChange?.(nextSettings);
  }, [onDraftChange]);

  const showSecondaryText = settings.showSecondaryText !== false;

  return (
    <div className="grid gap-4 text-gray-900 md:grid-cols-2 dark:text-gray-100">
      <section className={`h-full rounded-xl border px-4 py-2 ${cardClass}`}>
        <div className="flex items-center gap-2 border-b border-inherit py-2.5">
          <LayoutPanelTop className="h-4 w-4 text-blue-500" />
          <div>
            <h3 className="text-xs font-semibold">Timer information</h3>
            <p className={`mt-0.5 text-[10px] ${mutedText}`}>Keep the projected output focused on what operators need.</p>
          </div>
        </div>
        <div className={`divide-y ${dividerClass}`}>
          <div className="space-y-2 py-3">
            <label className="text-xs font-medium">Timer format</label>
            <Select value={settings.format} onValueChange={(value) => update({ format: value })}>
              <SelectTrigger className={selectTriggerClass}><SelectValue /></SelectTrigger>
              <SelectContent className={selectContentClass}>
                <SelectItem value="auto">M:SS / H:MM:SS</SelectItem>
                <SelectItem value="mmss">MM:SS</SelectItem>
                <SelectItem value="hhmmss">H:MM:SS</SelectItem>
                <SelectItem value="minutes">Minutes</SelectItem>
                <SelectItem value="verbose">Verbose</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <SettingRow title="Progress bar" description="Show elapsed progress beneath the timer." mutedText={mutedText}>
            <Switch checked={Boolean(settings.showProgress)} onCheckedChange={(checked) => update({ showProgress: checked })} {...switchProps} />
          </SettingRow>
          <SettingRow title="Secondary text" description="Show the timer label and schedule position." mutedText={mutedText}>
            <Switch checked={showSecondaryText} onCheckedChange={(checked) => update({ showSecondaryText: checked })} {...switchProps} />
          </SettingRow>
        </div>
      </section>

      <section className={`h-full rounded-xl border px-4 py-2 ${cardClass}`}>
        <div className="flex items-center gap-2 border-b border-inherit py-2.5">
          <Clock3 className="h-4 w-4 text-blue-500" />
          <div>
            <h3 className="text-xs font-semibold">Global clock</h3>
            <p className={`mt-0.5 text-[10px] ${mutedText}`}>Configure the clock shown below the timer.</p>
          </div>
        </div>
        <div className={`divide-y ${dividerClass}`}>
          <SettingRow title="Show global time" disabled={!showSecondaryText} mutedText={mutedText}>
            <Switch checked={Boolean(settings.showGlobalClock)} onCheckedChange={(checked) => update({ showGlobalClock: checked })} disabled={!showSecondaryText} {...getTimerToggleProps(darkMode, !showSecondaryText)} />
          </SettingRow>
          <SettingRow title="12-hour clock" disabled={!showSecondaryText || !settings.showGlobalClock} mutedText={mutedText}>
            <Switch checked={Boolean(settings.clockHour12)} onCheckedChange={(checked) => update({ clockHour12: checked })} disabled={!showSecondaryText || !settings.showGlobalClock} {...getTimerToggleProps(darkMode, !showSecondaryText || !settings.showGlobalClock)} />
          </SettingRow>
          <SettingRow title="Show seconds" disabled={!showSecondaryText || !settings.showGlobalClock} mutedText={mutedText}>
            <Switch checked={Boolean(settings.clockShowSeconds)} onCheckedChange={(checked) => update({ clockShowSeconds: checked })} disabled={!showSecondaryText || !settings.showGlobalClock} {...getTimerToggleProps(darkMode, !showSecondaryText || !settings.showGlobalClock)} />
          </SettingRow>
          <SettingRow title="Show AM/PM" disabled={!showSecondaryText || !settings.showGlobalClock || !settings.clockHour12} mutedText={mutedText}>
            <Switch checked={Boolean(settings.clockShowPeriod)} onCheckedChange={(checked) => update({ clockShowPeriod: checked })} disabled={!showSecondaryText || !settings.showGlobalClock || !settings.clockHour12} {...getTimerToggleProps(darkMode, !showSecondaryText || !settings.showGlobalClock || !settings.clockHour12)} />
          </SettingRow>
        </div>
      </section>
    </div>
  );
};

export default TimerDisplaySettingsModal;
