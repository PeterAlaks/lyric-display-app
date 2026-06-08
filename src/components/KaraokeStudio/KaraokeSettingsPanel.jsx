import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Palette, SlidersHorizontal } from 'lucide-react';

const Field = ({ label, children }) => (
  <label className="block space-y-2">
    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</span>
    {children}
  </label>
);

export default function KaraokeSettingsPanel({
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
      <div className="border-b border-gray-200 px-6 py-5 dark:border-gray-800">
        <h2 className="text-sm font-semibold text-gray-950 dark:text-gray-100">Karaoke Settings</h2>
      </div>

      <div className="space-y-7 px-6 pb-8 pt-6">
        <section className="space-y-4 rounded-md border border-gray-200 p-4 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Sync</h3>
          <Field label="Global Offset (ms)">
            <Input
              type="number"
              step="10"
              value={project.offsetMs}
              onChange={(event) => patchProject({ offsetMs: Number(event.target.value) || 0 })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              onClick={() => patchProject({ offsetMs: project.offsetMs - 100 })}
            >
              -100 ms
            </button>
            <button
              type="button"
              className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              onClick={() => patchProject({ offsetMs: project.offsetMs + 100 })}
            >
              +100 ms
            </button>
          </div>
        </section>

        <section className="space-y-4 rounded-md border border-gray-200 p-4 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Visuals</h3>
          <Field label="Video Style Preset">
            <Select value={project.styleSource} onValueChange={(styleSource) => patchProject({ styleSource })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="karaoke">Karaoke Video</SelectItem>
                {outputIds.map((outputId) => (
                  <SelectItem key={outputId} value={outputId}>
                    {outputId.replace('output', 'Output ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {project.styleSource === 'karaoke' && (
            <Button type="button" variant="outline" className="w-full justify-start" onClick={onOpenStyleEditor}>
              <Palette className="h-4 w-4" />
              Edit Karaoke Video Style
            </Button>
          )}
          <Field label="No-Lyric Behavior">
            <Select value={project.gapBehavior} onValueChange={(gapBehavior) => patchProject({ gapBehavior })}>
              <SelectTrigger>
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
              />
            </Field>
          )}
        </section>

        <section className="space-y-4 rounded-md border border-gray-200 p-4 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Export</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Width">
              <Input
                type="number"
                min="320"
                value={project.exportSettings.width}
                onChange={(event) => patchExport({ width: Number(event.target.value) || 1920 })}
              />
            </Field>
            <Field label="Height">
              <Input
                type="number"
                min="180"
                value={project.exportSettings.height}
                onChange={(event) => patchExport({ height: Number(event.target.value) || 1080 })}
              />
            </Field>
            <Field label="FPS">
              <Input
                type="number"
                min="1"
                max="120"
                value={project.exportSettings.fps}
                onChange={(event) => patchExport({ fps: Number(event.target.value) || 30 })}
              />
            </Field>
            <Field label="Outro (ms)">
              <Input
                type="number"
                min="0"
                step="500"
                value={project.exportSettings.outroPaddingMs}
                onChange={(event) => patchExport({ outroPaddingMs: Math.max(0, Number(event.target.value) || 0) })}
              />
            </Field>
          </div>
          <button
            type="button"
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-gray-950 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-950 dark:hover:bg-white"
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
