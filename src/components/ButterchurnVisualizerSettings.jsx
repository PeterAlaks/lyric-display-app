import React from 'react';
import { Dices } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import ButterchurnPresetSelect from './ButterchurnPresetSelect';
import {
  BUTTERCHURN_PRESET_MODES,
  BUTTERCHURN_QUALITY_LEVELS,
  LYRIC_VIDEO_BACKGROUND_SOURCES,
  normalizeLyricVideoVisualizer,
} from '../../shared/lyricVideoVisualizer.js';

const Field = ({ label, children }) => (
  <label className="flex min-w-0 flex-col gap-1.5">
    <span className="text-[11px] font-medium uppercase leading-4 tracking-wide text-gray-500 dark:text-gray-400">
      {label}
    </span>
    {children}
  </label>
);

const Section = ({ title, description, darkMode, children, bordered }) => (
  <section className={bordered
    ? `min-w-0 rounded-xl border p-4 ${darkMode ? 'border-gray-700 bg-gray-800/45' : 'border-gray-200 bg-gray-50/70'}`
    : 'min-w-0'
  }>
    {title && (
      <div className="mb-4">
        <h3 className={`text-sm font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{title}</h3>
        {description && (
          <p className={`mt-1 text-xs leading-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{description}</p>
        )}
      </div>
    )}
    <div className="space-y-4">{children}</div>
  </section>
);

export default function ButterchurnVisualizerSettings({
  value,
  onChange,
  darkMode = false,
  showAudioNote = false,
  layout = 'single',
}) {
  const normalizedValue = normalizeLyricVideoVisualizer({
    ...value,
    source: LYRIC_VIDEO_BACKGROUND_SOURCES.BUTTERCHURN,
  });
  const [visualizer, setVisualizer] = React.useState(() => normalizedValue);

  React.useEffect(() => {
    setVisualizer(normalizedValue);
  }, [
    normalizedValue.dimming,
    normalizedValue.presetId,
    normalizedValue.presetMode,
    normalizedValue.quality,
    normalizedValue.seed,
    normalizedValue.sensitivity,
    normalizedValue.source,
  ]);

  const inputClassName = darkMode
    ? 'h-9 border-gray-600 bg-gray-700 text-gray-100'
    : 'h-9 border-gray-300 bg-white text-gray-900';
  const selectClassName = darkMode
    ? 'h-9 border-gray-600 bg-gray-700 text-gray-100'
    : 'h-9 border-gray-300 bg-white text-gray-900';
  const selectContentClassName = darkMode
    ? 'border-gray-600 bg-gray-700 text-gray-100'
    : 'border-gray-300 bg-white text-gray-900';
  const twoColumn = layout === 'two-column';

  const patch = (updates) => {
    const next = normalizeLyricVideoVisualizer({
      ...visualizer,
      ...updates,
      source: LYRIC_VIDEO_BACKGROUND_SOURCES.BUTTERCHURN,
    });
    setVisualizer(next);
    onChange?.(next);
  };

  const presetControls = (
    <Section
      title={twoColumn ? 'Preset' : undefined}
      description={twoColumn ? 'Choose one visual style or use a repeatable random selection.' : undefined}
      darkMode={darkMode}
      bordered={twoColumn}
    >
      <Field label="Preset Selection">
        <Select value={visualizer.presetMode} onValueChange={(presetMode) => patch({ presetMode })}>
          <SelectTrigger className={selectClassName}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={selectContentClassName}>
            <SelectItem value={BUTTERCHURN_PRESET_MODES.SINGLE}>Specific preset</SelectItem>
            <SelectItem value={BUTTERCHURN_PRESET_MODES.RANDOM}>Random preset</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {visualizer.presetMode === BUTTERCHURN_PRESET_MODES.SINGLE && (
        <Field label="Preset">
          <ButterchurnPresetSelect
            value={visualizer.presetId}
            onChange={(presetId) => patch({ presetId })}
            darkMode={darkMode}
          />
        </Field>
      )}

      {visualizer.presetMode === BUTTERCHURN_PRESET_MODES.RANDOM && (
        <div className={`rounded-lg border p-3 text-xs leading-5 ${darkMode ? 'border-gray-700 bg-gray-800/70 text-gray-300' : 'border-gray-200 bg-white text-gray-600'}`}>
          The seed chooses one preset from all four groups. The same seed always gives you the same preset.
        </div>
      )}
    </Section>
  );

  const tuningControls = (
    <Section
      title={twoColumn ? 'Motion & Rendering' : undefined}
      description={twoColumn ? 'Tune audio response, visibility, and rendering performance.' : undefined}
      darkMode={darkMode}
      bordered={twoColumn}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Sensitivity">
          <Input
            type="number"
            min="0.25"
            max="3"
            step="0.05"
            value={visualizer.sensitivity}
            onChange={(event) => patch({ sensitivity: Number(event.target.value) || 1 })}
            className={inputClassName}
          />
        </Field>
        <Field label="Dim (%)">
          <Input
            type="number"
            min="0"
            max="90"
            step="5"
            value={visualizer.dimming}
            onChange={(event) => patch({ dimming: Number(event.target.value) || 0 })}
            className={inputClassName}
          />
        </Field>
      </div>

      <Field label="Render Quality">
        <Select value={visualizer.quality} onValueChange={(quality) => patch({ quality })}>
          <SelectTrigger className={selectClassName}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={selectContentClassName}>
            <SelectItem value={BUTTERCHURN_QUALITY_LEVELS.DRAFT}>Draft</SelectItem>
            <SelectItem value={BUTTERCHURN_QUALITY_LEVELS.BALANCED}>Balanced</SelectItem>
            <SelectItem value={BUTTERCHURN_QUALITY_LEVELS.HIGH}>High</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label="Visual Seed">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min="1"
            max="2147483647"
            step="1"
            value={visualizer.seed}
            onChange={(event) => patch({ seed: Number(event.target.value) || 1 })}
            className={inputClassName}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Shuffle visual seed"
            title="Shuffle visual seed"
            onClick={() => patch({ seed: Math.floor(Math.random() * 2_147_483_646) + 1 })}
            className={darkMode ? 'border-gray-600 bg-gray-700 text-gray-100 hover:bg-gray-600' : ''}
          >
            <Dices className="h-4 w-4" />
          </Button>
        </div>
      </Field>

      {showAudioNote && (
        <p className={`text-xs leading-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Visuals animate continuously without audio. Lyric Video Studio also reacts to its attached song.
        </p>
      )}
    </Section>
  );

  return twoColumn ? (
    <div className="grid min-w-0 gap-5 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      {presetControls}
      {tuningControls}
    </div>
  ) : (
    <div className="space-y-4">
      {presetControls}
      {tuningControls}
    </div>
  );
}
