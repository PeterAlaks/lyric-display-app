import { Download, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

const NdiPreferencesSection = ({
  companionRunning,
  companionStarting,
  companionReady,
  companionBootstrapError,
  darkMode,
  downloadProgress,
  handleNdiAutoLaunchToggle,
  handleNdiCancelDownload,
  handleNdiDownload,
  handleNdiUpdate,
  inputClass,
  isDownloading,
  labelClass,
  mutedClass,
  ndiAutoLaunch,
  ndiStatus,
  ndiTelemetry,
  ndiUpdateInfo,
  ndiUpdating,
  preferenceFieldLabelClass,
}) => {
  const stats = ndiTelemetry?.stats || null;
  const health = ndiTelemetry?.health || null;
  const formatMetric = (value, digits = 1) => (
    typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '--'
  );
  const telemetryAgeSeconds = ndiTelemetry?.updatedAt
    ? Math.max(0, Math.floor((Date.now() - ndiTelemetry.updatedAt) / 1000))
    : null;

  return (
    <div className="space-y-6">
      <p className={`text-sm ${mutedClass}`}>
        The NDI companion broadcasts your lyric outputs as NDI video sources, allowing integration with OBS, vMix, and other NDI-compatible software.
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${ndiStatus.installed
          ? darkMode ? 'bg-green-900/40 text-green-400' : 'bg-green-100 text-green-700'
          : darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${ndiStatus.installed ? 'bg-green-400' : 'bg-gray-400'}`} />
          {ndiStatus.installed ? 'Installed' : 'Not Installed'}
        </span>
        {ndiStatus.installed && ndiStatus.version && (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${darkMode
            ? 'bg-gray-700 text-gray-300'
            : 'bg-gray-100 text-gray-600'
            }`}
          >
            v{ndiStatus.version}
          </span>
        )}
        {ndiStatus.installed && (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${companionRunning
            ? darkMode ? 'bg-blue-900/40 text-blue-400' : 'bg-blue-100 text-blue-700'
            : darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${companionRunning ? 'bg-blue-400 animate-pulse' : 'bg-gray-400'}`} />
            {companionStarting ? 'Starting' : companionRunning ? 'Running' : 'Stopped'}
          </span>
        )}
        {ndiStatus.installed && companionRunning && (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${companionReady
            ? darkMode ? 'bg-green-900/40 text-green-400' : 'bg-green-100 text-green-700'
            : darkMode ? 'bg-amber-900/40 text-amber-300' : 'bg-amber-100 text-amber-700'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${companionReady ? 'bg-green-400' : 'bg-amber-400'}`} />
            {companionReady ? 'Ready' : 'Syncing'}
          </span>
        )}
      </div>

      {ndiStatus.installed && companionBootstrapError && (
        <div className={`rounded-lg border p-3 text-xs ${darkMode ? 'border-amber-600/30 bg-amber-900/20 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          {companionBootstrapError}
        </div>
      )}

      {ndiStatus.installed && companionRunning && (
        <div className={`rounded-lg border p-3 ${darkMode ? 'border-gray-700 bg-gray-800/40' : 'border-gray-200 bg-gray-50'}`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className={`text-xs font-medium ${labelClass}`}>Runtime Telemetry</p>
            {telemetryAgeSeconds !== null && (
              <span className={`text-[11px] ${mutedClass}`}>
                Updated {telemetryAgeSeconds}s ago
              </span>
            )}
          </div>
          {stats ? (
            <div className={`grid grid-cols-2 md:grid-cols-4 gap-2 text-xs ${mutedClass}`}>
              <div>
                <p className={labelClass}>Render FPS</p>
                <p>{formatMetric(stats.render_fps)}</p>
              </div>
              <div>
                <p className={labelClass}>Send FPS</p>
                <p>{formatMetric(stats.send_fps)}</p>
              </div>
              <div>
                <p className={labelClass}>Dropped Frames</p>
                <p>{typeof stats.dropped_frames === 'number' ? stats.dropped_frames : '--'}</p>
              </div>
              <div>
                <p className={labelClass}>Send Failures</p>
                <p>{typeof stats.ndi_send_failures === 'number' ? stats.ndi_send_failures : '--'}</p>
              </div>
              <div>
                <p className={labelClass}>Avg Frame (ms)</p>
                <p>{formatMetric(stats.avg_frame_ms, 2)}</p>
              </div>
              <div>
                <p className={labelClass}>P95 Frame (ms)</p>
                <p>{formatMetric(stats.p95_frame_ms, 2)}</p>
              </div>
              <div>
                <p className={labelClass}>Backend</p>
                <p>{health?.ndi_backend || '--'}</p>
              </div>
              <div>
                <p className={labelClass}>Warnings</p>
                <p>{Array.isArray(health?.warning_flags) && health.warning_flags.length > 0 ? health.warning_flags.join(', ') : 'none'}</p>
              </div>
            </div>
          ) : (
            <p className={`text-xs ${mutedClass}`}>Waiting for telemetry data from companion...</p>
          )}
        </div>
      )}

      {ndiStatus.installed && ndiUpdateInfo?.updateAvailable && (
        <div className={`flex items-start gap-3 p-3 rounded-lg ${darkMode ? 'bg-blue-900/20 border border-blue-600/30' : 'bg-blue-50 border border-blue-200'}`}>
          <Download className={`w-4 h-4 mt-0.5 shrink-0 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${darkMode ? 'text-blue-300' : 'text-blue-800'}`}>
              Update available: v{ndiUpdateInfo.latestVersion}
            </p>
            <p className={`text-xs mt-0.5 ${darkMode ? 'text-blue-400/80' : 'text-blue-600'}`}>
              You have v{ndiUpdateInfo.currentVersion}
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleNdiUpdate}
            disabled={ndiUpdating || isDownloading}
            className={`shrink-0 ${darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
          >
            {ndiUpdating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              'Update'
            )}
          </Button>
        </div>
      )}

      {(ndiUpdating || isDownloading) && downloadProgress && (
        <div className="space-y-2">
          <div className={`w-full h-2 rounded-full overflow-hidden ${darkMode ? 'bg-gray-600' : 'bg-gray-200'}`}>
            <div
              className={`h-full rounded-full transition-all duration-300 ${downloadProgress.status === 'extracting' ? 'bg-amber-500' : 'bg-blue-500'}`}
              style={{ width: `${downloadProgress.percent || 0}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <p className={`text-xs ${mutedClass}`}>
              {downloadProgress.status === 'extracting'
                ? `Extracting... ${downloadProgress.percent || 0}%`
                : `Downloading... ${downloadProgress.percent || 0}%`}
            </p>
            {downloadProgress.status !== 'extracting' && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleNdiCancelDownload}
                className={`h-6 px-2 text-xs ${darkMode ? 'text-gray-400 hover:bg-red-900/20 hover:text-red-500' : 'text-gray-500 hover:bg-red-50 hover:text-red-600'}`}
              >
                <X className="w-3 h-3 mr-1" />
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}

      {!ndiStatus.installed ? (
        <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
          <div className="space-y-4">
            <p className={`text-sm ${labelClass}`}>
              Download the NDI companion to enable video broadcasting from your lyric outputs.
            </p>

            <Button
              onClick={handleNdiDownload}
              disabled={isDownloading}
              className={`w-full ${darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Download NDI Companion
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className={preferenceFieldLabelClass}>Install Location</label>
            <Input
              value={ndiStatus.installPath || ''}
              readOnly
              className={`${inputClass} opacity-70 cursor-default`}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className={`text-sm font-medium ${labelClass}`}>Start with LyricDisplay</label>
              <p className={`text-xs ${mutedClass}`}>Launch NDI companion when LyricDisplay opens</p>
            </div>
            <Switch
              checked={ndiAutoLaunch}
              onCheckedChange={handleNdiAutoLaunchToggle}
              className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
                ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
                : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
                }`}
              thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
            />
          </div>
        </div>
      )}

      <div className={`pt-4 mt-2 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <p className={`text-[11px] leading-relaxed ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          NDI is a registered trademark of Vizrt NDI AB. This application is not affiliated with or endorsed by Vizrt NDI AB. Learn more at{' '}
          <a
            href="https://ndi.video"
            target="_blank"
            rel="noopener noreferrer"
            className={`underline hover:no-underline ${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-600'}`}
          >
            ndi.video
          </a>.
        </p>
      </div>
    </div>
  );
};

export default NdiPreferencesSection;
