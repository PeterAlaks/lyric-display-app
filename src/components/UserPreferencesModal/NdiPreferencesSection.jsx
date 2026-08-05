import { useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, Copy, Download, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import useIsPackagedApp from '../../hooks/useIsPackagedApp';

const CopyErrorButton = ({ darkMode, text }) => {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef(null);

  useEffect(() => () => {
    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current);
    }
  }, []);

  const handleCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current);
      }
      resetTimerRef.current = window.setTimeout(() => {
        setCopied(false);
        resetTimerRef.current = null;
      }, 1800);
    } catch (error) {
      console.warn('Failed to copy NDI error message:', error);
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${copied
        ? (darkMode ? 'bg-green-500/15 text-green-300 focus-visible:ring-green-400/60' : 'bg-green-100 text-green-700 focus-visible:ring-green-500/50')
        : (darkMode ? 'text-current/70 hover:bg-white/10 hover:text-current focus-visible:ring-white/40' : 'text-current/65 hover:bg-black/5 hover:text-current focus-visible:ring-black/30')
        }`}
      title={copied ? 'Error copied' : 'Copy error message'}
      aria-label={copied ? 'NDI error message copied' : 'Copy NDI error message'}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </button>
  );
};

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
  handleNdiInstallFromZip,
  handleNdiUpdate,
  inputClass,
  isDownloading,
  labelClass,
  mutedClass,
  ndiAutoLaunch,
  ndiStatus,
  ndiLastError,
  ndiTelemetry,
  ndiUpdateInfo,
  ndiUpdating,
  onOpenTelemetry,
  preferenceFieldLabelClass,
}) => {
  const isPackagedApp = useIsPackagedApp();
  const telemetryWarnings = Array.isArray(ndiTelemetry?.health?.warning_flags)
    ? ndiTelemetry.health.warning_flags.length
    : 0;
  const ndiLastErrorMessage = typeof ndiLastError === 'string'
    ? ndiLastError
    : (ndiLastError?.error || ndiLastError?.message || 'Unknown NDI Companion error');
  const ndiLastErrorMetadata = typeof ndiLastError === 'object' && ndiLastError
    ? [ndiLastError.stage, ndiLastError.code, ndiLastError.host].filter(Boolean).join(' · ')
    : '';
  const ndiLastErrorCopyText = [ndiLastErrorMessage, ndiLastErrorMetadata].filter(Boolean).join('\n');

  return (
    <div className="space-y-6">
      <p className={`text-sm ${mutedClass}`}>
        The NDI companion broadcasts your lyric outputs as NDI video sources, allowing integration with OBS, vMix, and other NDI-compatible software.
      </p>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
        <span className={`inline-flex items-center gap-1.5 font-medium ${ndiStatus.installed
          ? darkMode ? 'text-green-400' : 'text-green-700'
          : mutedClass
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${ndiStatus.installed ? 'bg-green-400' : 'bg-gray-400'}`} />
          {ndiStatus.installed ? 'Installed' : 'Not Installed'}
        </span>
        {ndiStatus.installed && ndiStatus.version && (
          <span className={`border-l pl-3 font-medium ${darkMode ? 'border-gray-700' : 'border-gray-200'} ${labelClass}`}>
            Version v{ndiStatus.version}
          </span>
        )}
        {ndiStatus.installed && (
          <span className={`inline-flex items-center gap-1.5 border-l pl-3 font-medium ${darkMode ? 'border-gray-700' : 'border-gray-200'} ${companionRunning
              ? darkMode ? 'text-blue-400' : 'text-blue-700'
              : mutedClass
              }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${companionRunning ? 'bg-blue-400 animate-pulse' : 'bg-gray-400'}`} />
            {companionStarting ? 'Starting' : companionRunning ? 'Running' : 'Stopped'}
          </span>
        )}
        {ndiStatus.installed && companionRunning && (
          <span className={`inline-flex items-center gap-1.5 border-l pl-3 font-medium ${darkMode ? 'border-gray-700' : 'border-gray-200'} ${companionReady
              ? darkMode ? 'text-green-400' : 'text-green-700'
              : darkMode ? 'text-amber-300' : 'text-amber-700'
              }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${companionReady ? 'bg-green-400' : 'bg-amber-400'}`} />
            {companionReady ? 'Ready' : 'Syncing'}
          </span>
        )}
      </div>

      {ndiStatus.installed && companionBootstrapError && (
        <div className={`relative rounded-lg border p-3 pr-11 text-xs ${darkMode ? 'border-amber-600/30 bg-amber-900/20 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          {companionBootstrapError}
          <CopyErrorButton darkMode={darkMode} text={String(companionBootstrapError)} />
        </div>
      )}

      {ndiLastError && (
        <div className={`relative rounded-lg border p-3 pr-11 text-xs ${darkMode ? 'border-red-600/30 bg-red-900/20 text-red-200' : 'border-red-200 bg-red-50 text-red-800'}`}>
          <p className="font-medium">The last NDI Companion operation failed.</p>
          <p className="mt-1 break-words">{ndiLastErrorMessage}</p>
          {ndiLastErrorMetadata && (
            <p className={`mt-1.5 ${darkMode ? 'text-red-300/75' : 'text-red-700/75'}`}>
              {ndiLastErrorMetadata}
            </p>
          )}
          <CopyErrorButton darkMode={darkMode} text={ndiLastErrorCopyText} />
        </div>
      )}

      {ndiStatus.installed && (
        <button
          type="button"
          onClick={onOpenTelemetry}
          className={`-mx-3 flex w-[calc(100%+1.5rem)] items-center gap-4 rounded-lg px-3 py-2.5 text-left transition-colors ${darkMode ? 'hover:bg-gray-700/60' : 'hover:bg-gray-100'}`}
          aria-label="View NDI runtime telemetry"
        >
          <div className="min-w-0 flex-1">
            <span className={`text-sm font-medium ${labelClass}`}>Runtime Telemetry</span>
            <p className={`text-xs ${mutedClass}`}>View render timing, frame delivery, and NDI health</p>
          </div>
          <span className={`shrink-0 text-xs ${mutedClass}`}>
            {!companionRunning ? 'Stopped' : telemetryWarnings > 0 ? `${telemetryWarnings} warning${telemetryWarnings === 1 ? '' : 's'}` : 'View'}
          </span>
          <ChevronRight className={`h-4 w-4 shrink-0 ${mutedClass}`} />
        </button>
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
              {{
                downloading: 'Downloading',
                copying: 'Preparing local ZIP',
                verifying: 'Verifying integrity',
                extracting: 'Extracting',
              }[downloadProgress.status] || 'Preparing'}... {downloadProgress.percent || 0}%
            </p>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleNdiCancelDownload}
              className={`h-6 px-2 text-xs ${darkMode ? 'text-gray-400 hover:bg-red-900/20 hover:text-red-500' : 'text-gray-500 hover:bg-red-50 hover:text-red-600'}`}
            >
              <X className="w-3 h-3 mr-1" />
              Cancel
            </Button>
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
            {isPackagedApp && (
              <p className={`text-[10px] leading-snug ${mutedClass}`}>
                Microsoft Store builds may map this logical AppData path to Windows-managed private package storage.
              </p>
            )}
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

      {isPackagedApp && (
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleNdiInstallFromZip}
            disabled={isDownloading || ndiUpdating}
            className="w-full"
          >
            {ndiStatus.installed ? 'Install or update from downloaded ZIP' : 'Install from downloaded ZIP'}
          </Button>
          <p className={`text-xs ${mutedClass}`}>
            Select the latest official platform ZIP from the LyricDisplay NDI GitHub release.
          </p>
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
