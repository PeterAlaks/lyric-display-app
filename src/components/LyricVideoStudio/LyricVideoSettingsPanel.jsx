import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Palette, SlidersHorizontal } from 'lucide-react';

const inputClassName = 'h-9 rounded-full border-gray-200 bg-white text-sm dark:border-gray-700/70 dark:bg-gray-800/90 dark:text-gray-100';
const selectTriggerClassName = 'h-9 rounded-full border-gray-200 bg-white text-sm dark:border-gray-700/70 dark:bg-gray-800/90 dark:text-gray-100';
const ghostButtonClassName = 'rounded-full text-gray-600 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-blue-500/10 dark:hover:text-blue-300';

const Field = ({ label, children }) => (
  <label className="block space-y-2">
    <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</span>
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

  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-gray-900">
      <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
        <h2 className="text-sm font-semibold text-gray-950 dark:text-gray-100">Studio Settings</h2>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-500">Sync, style, and export setup.</p>
      </div>

      <div className="space-y-7 px-5 pb-8 pt-5">
        <section className="space-y-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Sync</h3>
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
              <SelectContent>
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
              <SelectContent>
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
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Export</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Width">
              <Input
                type="number"
                min="320"
                value={project.exportSettings.width}
                onChange={(event) => patchExport({ width: Number(event.target.value) || 1920 })}
                className={inputClassName}
              />
            </Field>
            <Field label="Height">
              <Input
                type="number"
                min="180"
                value={project.exportSettings.height}
                onChange={(event) => patchExport({ height: Number(event.target.value) || 1080 })}
                className={inputClassName}
              />
            </Field>
            <Field label="FPS">
              <Input
                type="number"
                min="1"
                max="120"
                value={project.exportSettings.fps}
                onChange={(event) => patchExport({ fps: Number(event.target.value) || 30 })}
                className={inputClassName}
              />
            </Field>
            <Field label="Outro (ms)">
              <Input
                type="number"
                min="0"
                step="500"
                value={project.exportSettings.outroPaddingMs}
                onChange={(event) => patchExport({ outroPaddingMs: Math.max(0, Number(event.target.value) || 0) })}
                className={inputClassName}
              />
            </Field>
          </div>
          <button
            type="button"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-400 to-purple-600 px-4 text-sm font-semibold text-white transition-all duration-200 hover:from-blue-500 hover:to-purple-700"
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
