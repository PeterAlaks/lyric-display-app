import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Palette, SlidersHorizontal } from 'lucide-react';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';
import AlwaysInfoButton from './AlwaysInfoButton';

const inputClassName = 'h-9 rounded-md border-gray-300 bg-white !text-xs text-gray-900 md:!text-xs focus-visible:border-blue-500/40 focus-visible:ring-blue-500/15 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder:text-gray-400 dark:focus-visible:border-blue-500/50 dark:focus-visible:ring-blue-500/20';
const textareaClassName = 'min-h-[72px] rounded-md border-gray-300 bg-white !text-xs text-gray-900 md:!text-xs focus-visible:border-blue-500/40 focus-visible:ring-blue-500/15 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder:text-gray-400 dark:focus-visible:border-blue-500/50 dark:focus-visible:ring-blue-500/20';
const selectTriggerClassName = 'h-9 rounded-md border-gray-300 bg-white px-3 !text-xs text-gray-900 md:!text-xs focus:ring-1 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200';
const selectContentClassName = 'rounded-md border-gray-300 bg-white text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200';
const ghostButtonClassName = 'rounded-full text-gray-600 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-blue-500/10 dark:hover:text-blue-300';

const clampInteger = (value, fallback, min, max) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
};

const Field = ({ label, children }) => (
  <label className="flex min-w-0 flex-col gap-1.5">
    <span className="text-[11px] font-medium uppercase leading-4 tracking-wide text-gray-500 dark:text-gray-400">{label}</span>
    {children}
  </label>
);

export default function LyricVideoSettingsPanel({
  project,
  outputIds,
  onProjectChange,
  onOpenStyleEditor,
  onOpenExport,
}) {
  const patchProject = (updates) => onProjectChange?.((current) => ({ ...current, ...updates }));
  const patchExport = (updates) => onProjectChange?.((current) => ({
    ...current,
    exportSettings: {
      ...current.exportSettings,
      ...updates,
    },
  }));
  const patchIntro = (updates) => onProjectChange?.((current) => ({
    ...current,
    intro: {
      ...(current.intro || current.openingScreen || {}),
      ...updates,
    },
  }));
  const intro = project.intro || project.openingScreen || {};

  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-gray-900">
      <div className="flex h-16 shrink-0 items-center border-b border-gray-200 px-5 dark:border-gray-800">
        <h2 className="text-sm font-semibold text-gray-950 dark:text-gray-100">Studio Settings</h2>
      </div>

      <div className="space-y-7 px-5 pb-8 pt-5">
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Sync</h3>
            <AlwaysInfoButton
              side="left"
              ariaLabel="Sync offset help"
              content="Positive values show lyrics a little earlier. Negative values hold them back if the words are arriving too soon."
            />
          </div>
          <Field label="Global Offset (ms)">
            <Input
              type="number"
              step="10"
              value={project.offsetMs}
              onChange={(event) => patchProject({ offsetMs: Number(event.target.value) || 0 })}
              className={inputClassName}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="rounded-full px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
              onClick={() => patchProject({ offsetMs: project.offsetMs - 100 })}
            >
              -100 ms
            </button>
            <button
              type="button"
              className="rounded-full px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
              onClick={() => patchProject({ offsetMs: project.offsetMs + 100 })}
            >
              +100 ms
            </button>
          </div>
        </section>

        <section className="space-y-4 border-t border-gray-100 pt-5 dark:border-gray-800">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Visuals</h3>
          <Field label="Style Source">
            <Select value={project.styleSource} onValueChange={(styleSource) => patchProject({ styleSource })}>
              <SelectTrigger className={selectTriggerClassName}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={selectContentClassName}>
                <SelectItem value="lyricVideo">Lyric Video</SelectItem>
                {outputIds.map((outputId) => (
                  <SelectItem key={outputId} value={outputId}>
                    {outputId.replace('output', 'Output ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {project.styleSource === 'lyricVideo' && (
            <Button type="button" variant="ghost" className={`w-full justify-start ${ghostButtonClassName}`} onClick={onOpenStyleEditor}>
              <Palette className="h-4 w-4" />
              Edit Lyric Video Style
            </Button>
          )}
          <Field label="No-Lyric Behavior">
            <Select value={project.gapBehavior} onValueChange={(gapBehavior) => patchProject({ gapBehavior })}>
              <SelectTrigger className={selectTriggerClassName}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={selectContentClassName}>
                <SelectItem value="background-only">Background only</SelectItem>
                <SelectItem value="blank">Blank</SelectItem>
                <SelectItem value="show-title">Show title</SelectItem>
                <SelectItem value="keep-previous-line">Keep previous line</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {project.gapBehavior !== 'keep-previous-line' && (
            <Field label="Clear After (ms)">
              <Input
                type="number"
                min="0"
                step="100"
                value={project.clearAfterMs}
                onChange={(event) => patchProject({ clearAfterMs: Math.max(0, Number(event.target.value) || 0) })}
                className={inputClassName}
              />
            </Field>
          )}
        </section>

        <section className="space-y-4 border-t border-gray-100 pt-5 dark:border-gray-800">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Intro</h3>
            </div>
            <Switch
              checked={Boolean(intro.enabled)}
              onCheckedChange={(enabled) => patchIntro({ enabled })}
              aria-label="Enable intro"
              className="data-[state=checked]:bg-blue-600"
            />
          </div>
          {intro.enabled && (
            <div className="space-y-3">
              <Field label="Title">
                <Input
                  type="text"
                  value={intro.title || ''}
                  placeholder={project.name || 'Untitled Video 1'}
                  maxLength={120}
                  onChange={(event) => patchIntro({ title: event.target.value.slice(0, 120) })}
                  className={inputClassName}
                />
              </Field>
              <Field label="Subtitle">
                <Input
                  type="text"
                  value={intro.subtitle || ''}
                  maxLength={160}
                  onChange={(event) => patchIntro({ subtitle: event.target.value.slice(0, 160) })}
                  className={inputClassName}
                />
              </Field>
              <Field label="Details">
                <Textarea
                  value={intro.details || ''}
                  maxLength={400}
                  onChange={(event) => patchIntro({ details: event.target.value.slice(0, 400) })}
                  className={textareaClassName}
                />
              </Field>
              <Field label="Duration (ms)">
                <Input
                  type="number"
                  min="500"
                  step="250"
                  value={intro.durationMs ?? 3000}
                  onChange={(event) => patchIntro({ durationMs: clampInteger(event.target.value, 3000, 500, 30000) })}
                  className={inputClassName}
                />
              </Field>
            </div>
          )}
        </section>

        <section className="space-y-4 border-t border-gray-100 pt-5 dark:border-gray-800">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Export</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Width">
              <Input
                type="number"
                min="320"
                value={project.exportSettings.width}
                onChange={(event) => patchExport({ width: clampInteger(event.target.value, 1920, 320, 7680) })}
                className={inputClassName}
              />
            </Field>
            <Field label="Height">
              <Input
                type="number"
                min="180"
                value={project.exportSettings.height}
                onChange={(event) => patchExport({ height: clampInteger(event.target.value, 1080, 180, 4320) })}
                className={inputClassName}
              />
            </Field>
            <Field label="FPS">
              <Input
                type="number"
                min="1"
                max="120"
                value={project.exportSettings.fps}
                onChange={(event) => patchExport({ fps: clampInteger(event.target.value, 30, 1, 120) })}
                className={inputClassName}
              />
            </Field>
            <Field label="Outro (ms)">
              <Input
                type="number"
                min="0"
                step="500"
                value={project.exportSettings.outroPaddingMs}
                onChange={(event) => patchExport({ outroPaddingMs: clampInteger(event.target.value, 0, 0, 300000) })}
                className={inputClassName}
              />
            </Field>
          </div>
          <button
            type="button"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-linear-to-r from-blue-400 to-purple-600 px-4 text-sm font-semibold text-white transition-all duration-200 hover:from-blue-500 hover:to-purple-700"
            onClick={onOpenExport}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Export Settings
          </button>
        </section>
      </div>
    </div>
  );
}
