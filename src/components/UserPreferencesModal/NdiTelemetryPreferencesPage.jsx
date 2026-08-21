import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const formatMetric = (value, digits = 1) => (
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '--'
);

const NdiTelemetryPreferencesPage = ({
  companionRunning,
  darkMode,
  labelClass,
  mutedClass,
  ndiTelemetry,
  onBack,
}) => {
  const stats = ndiTelemetry?.stats || null;
  const health = ndiTelemetry?.health || null;
  const telemetryAgeSeconds = ndiTelemetry?.updatedAt
    ? Math.max(0, Math.floor((Date.now() - ndiTelemetry.updatedAt) / 1000))
    : null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onBack}
            aria-label="Back to NDI preferences"
            className="h-7 w-7 shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
          <div className="min-w-0">
            <h3 className={`truncate text-base font-semibold ${labelClass}`}>Runtime Telemetry</h3>
            <p className={`text-[11px] ${mutedClass}`}>
              NDI render and send performance
            </p>
          </div>
        </div>
        <span className={`shrink-0 text-[11px] ${mutedClass}`}>
          {companionRunning
            ? (telemetryAgeSeconds === null ? 'Waiting for data' : `Updated ${telemetryAgeSeconds}s ago`)
            : 'Companion stopped'}
        </span>
      </div>

      <div className={`overflow-hidden rounded-lg border ${darkMode ? 'border-gray-700 bg-gray-800/40' : 'border-gray-200 bg-white'}`}>
        {stats ? (
          <div className={`grid grid-cols-2 gap-px text-xs md:grid-cols-4 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
            {[
              ['Render FPS', formatMetric(stats.render_fps)],
              ['Send FPS', formatMetric(stats.send_fps)],
              ['Sent Frames', typeof stats.sent_frames === 'number' ? stats.sent_frames : '--'],
              ['Dropped Frames', typeof stats.dropped_frames === 'number' ? stats.dropped_frames : '--'],
              ['Repeated Frames', typeof stats.repeated_frames === 'number' ? stats.repeated_frames : '--'],
              ['Coalesced Frames', typeof stats.coalesced_frames === 'number' ? stats.coalesced_frames : '--'],
              ['Send Failures', typeof stats.ndi_send_failures === 'number' ? stats.ndi_send_failures : '--'],
              ['Connected Receivers', typeof stats.connected_receivers === 'number' ? stats.connected_receivers : '--'],
              ['Program Tally', typeof stats.program_tally_sources === 'number' ? stats.program_tally_sources : '--'],
              ['Preview Tally', typeof stats.preview_tally_sources === 'number' ? stats.preview_tally_sources : '--'],
              ['Avg Frame (ms)', formatMetric(stats.avg_frame_ms, 2)],
              ['P95 Frame (ms)', formatMetric(stats.p95_frame_ms, 2)],
              ['Avg Send (ms)', formatMetric(stats.avg_send_ms, 2)],
              ['P95 Send (ms)', formatMetric(stats.p95_send_ms, 2)],
              ['Send Jitter (ms)', formatMetric(stats.avg_send_jitter_ms, 2)],
              ['Backend', health?.ndi_backend || '--'],
              ['NDI SDK', health?.ndi_sdk_version || '--'],
              [
                'Warnings',
                Array.isArray(health?.warning_flags) && health.warning_flags.length > 0
                  ? health.warning_flags.join(', ')
                  : 'none',
              ],
            ].map(([label, value]) => (
              <div key={label} className={`min-w-0 px-3 py-2.5 ${darkMode ? 'bg-gray-800/80' : 'bg-white'}`}>
                <p className={`font-medium ${labelClass}`}>{label}</p>
                <p className={`mt-0.5 wrap-break-word ${mutedClass}`}>{value}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className={`px-4 py-8 text-center text-xs ${mutedClass}`}>
            {companionRunning
              ? 'Waiting for telemetry data from the companion...'
              : 'Start the NDI companion to view runtime telemetry.'}
          </p>
        )}
      </div>
    </div>
  );
};

export default NdiTelemetryPreferencesPage;
