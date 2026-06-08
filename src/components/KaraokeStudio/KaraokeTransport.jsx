import React from 'react';
import { Pause, Play, RotateCcw, SkipBack, SkipForward, Upload, Volume2 } from 'lucide-react';
import { Button } from '../ui/button';

const formatClock = (ms) => {
  const safeMs = Math.max(0, Number(ms) || 0);
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export default function KaraokeTransport({
  audio,
  currentTimeMs,
  durationMs,
  isPlaying,
  onAttachAudio,
  onPlayPause,
  onSeek,
  volume,
  onVolumeChange,
}) {
  const safeDuration = Math.max(0, Number(durationMs) || 0);
  const canPlay = Boolean(audio?.sourceUrl || audio?.objectUrl);

  return (
    <div className="flex-shrink-0 border-t border-gray-200 bg-white px-6 pb-5 pt-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
            {audio?.fileName || 'No audio attached'}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {audio?.mimeType || 'MP3, WAV, M4A, AAC'}
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onAttachAudio}>
          <Upload className="h-4 w-4" />
          Attach Audio
        </Button>
      </div>

      <div className="grid grid-cols-[72px_minmax(0,1fr)_72px] items-center gap-4">
        <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{formatClock(currentTimeMs)}</span>
        <input
          type="range"
          min="0"
          max={safeDuration || 0}
          step="10"
          value={Math.min(currentTimeMs || 0, safeDuration || 0)}
          onChange={(event) => onSeek?.(Number(event.target.value))}
          disabled={!canPlay || !safeDuration}
          className="h-2 w-full accent-emerald-600"
        />
        <span className="text-right font-mono text-xs text-gray-500 dark:text-gray-400">{formatClock(safeDuration)}</span>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(event) => onVolumeChange?.(Number(event.target.value))}
            className="h-2 w-32 accent-emerald-600"
          />
          <span className="w-9 text-xs tabular-nums text-gray-500 dark:text-gray-400">{Math.round(volume * 100)}%</span>
        </div>
        <div className="flex items-center justify-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={!canPlay}
            onClick={() => onSeek?.(Math.max(0, currentTimeMs - 5000))}
            aria-label="Seek back 5 seconds"
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="default"
            size="icon"
            disabled={!canPlay}
            onClick={onPlayPause}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="h-11 w-11 rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={!canPlay}
            onClick={() => onSeek?.(Math.min(safeDuration, currentTimeMs + 5000))}
            aria-label="Seek forward 5 seconds"
          >
            <SkipForward className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={!canPlay}
            onClick={() => onSeek?.(0)}
            aria-label="Restart"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
        <div />
      </div>
    </div>
  );
}
