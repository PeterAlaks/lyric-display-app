import { useEffect, useState } from 'react';
import { AlertTriangle, FileText, Info, Loader2, Monitor, Play, RefreshCw, RotateCcw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { setDebugLogging } from '../../utils/logger';
import { confirmAndLaunchHeadlessMode, createLyricDisplayDockSetupActions } from '../../utils/lyricDisplayDock';

const AdvancedPreferencesSection = ({
  commitNumberPreference,
  darkMode,
  formatSecurityDate,
  getNumberInputValue,
  handleNumberInputKeyDown,
  handleResetCategory,
  handleRotateSecurityTokenKey,
  inputClass,
  labelClass,
  loadSecurityStatus,
  mutedClass,
  preferenceFieldLabelClass,
  preferences,
  securityLoading,
  securityRotating,
  securityStatus,
  setNumberInputDraft,
  showModal,
  showToast,
  updatePreference,
}) => {
  const isDevMode = import.meta.env.MODE === 'development';
  const [obsDockStartup, setObsDockStartup] = useState(null);
  const [obsDockStartupSaving, setObsDockStartupSaving] = useState(false);

  const loadObsDockStartup = async () => {
    if (!window.electronAPI?.obsDockStartup?.get) return;
    const status = await window.electronAPI.obsDockStartup.get();
    setObsDockStartup(status);
  };

  useEffect(() => {
    loadObsDockStartup().catch((error) => {
      console.warn('Failed to load LyricDisplay Dock startup status:', error);
    });
  }, []);

  const handleObsDockStartupToggle = async (checked) => {
    if (!window.electronAPI?.obsDockStartup?.set) return;

    setObsDockStartupSaving(true);
    try {
      const status = await window.electronAPI.obsDockStartup.set(checked);
      setObsDockStartup(status);
      showToast?.({
        title: checked ? 'Dock Mode Will Start at Sign-In' : 'Dock Mode Sign-In Start Disabled',
        message: checked
          ? 'LyricDisplay Dock will be ready after you sign in, without opening the desktop window.'
          : 'LyricDisplay Dock will no longer start automatically when you sign in.',
        variant: status?.success === false ? 'error' : 'success',
      });
    } catch (error) {
      showToast?.({
        title: 'Startup Setting Failed',
        message: error.message || 'Could not update Start at Sign-In for LyricDisplay Dock.',
        variant: 'error',
      });
    } finally {
      setObsDockStartupSaving(false);
    }
  };

  const handleLaunchHeadlessMode = () => confirmAndLaunchHeadlessMode({ showModal, showToast });

  const openObsDockInfo = () => {
    showModal?.({
      title: 'LyricDisplay Dock Setup',
      headerDescription: 'Copy the OBS dock URL and review Dock Mode startup options',
      component: 'ObsDockInfo',
      variant: 'info',
      size: 'lg',
      scrollBehavior: 'scroll',
      actions: isDevMode
        ? [{ label: 'Close', variant: 'outline' }]
        : createLyricDisplayDockSetupActions(handleLaunchHeadlessMode),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <AlertTriangle className={`w-4 h-4 ${mutedClass}`} />
          <span className={`text-sm font-medium ${labelClass}`}>
            Advanced Settings
          </span>
        </div>
        <p className={`mt-1 text-xs ${mutedClass}`}>
          These settings are for advanced users. Changing them may affect application stability.
        </p>
      </div>

    <div className={`p-4 rounded-lg border ${darkMode ? 'border-gray-700 bg-gray-800/60' : 'border-gray-200 bg-gray-50'}`}>
      <div className="mb-4 flex items-start gap-3">
        <Monitor className={`mt-0.5 w-4 h-4 ${darkMode ? 'text-blue-300' : 'text-blue-600'}`} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <label className={`text-sm font-medium ${labelClass}`}>LyricDisplay Dock</label>
            <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none ${darkMode ? 'border-blue-400/40 bg-blue-500/15 text-blue-200' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
              Beta
            </span>
          </div>
          <p className={`mt-1 text-xs ${mutedClass}`}>
            Control LyricDisplay from an OBS dock while it runs quietly in the background.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {!isDevMode && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <label className={`text-sm font-medium ${labelClass}`}>Start at Sign In</label>
              <p className={`mt-1 text-xs ${mutedClass}`}>
                Make LyricDisplay Dock ready automatically after you sign in.
              </p>
              {obsDockStartup?.success === false && (
                <p className={`mt-2 text-xs ${darkMode ? 'text-red-300' : 'text-red-600'}`}>
                  {obsDockStartup.error || 'Startup registration is not available on this system.'}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {obsDockStartupSaving && <Loader2 className={`h-4 w-4 animate-spin ${mutedClass}`} />}
              <Switch
                checked={obsDockStartup?.enabled ?? false}
                disabled={obsDockStartupSaving || obsDockStartup?.supported === false}
                onCheckedChange={handleObsDockStartupToggle}
                className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
                  ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
                  : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
                  }`}
                thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
              />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          {!isDevMode && (
            <Button
              type="button"
              variant="outline"
              onClick={handleLaunchHeadlessMode}
              className={darkMode ? 'border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700' : ''}
            >
              <Play className="w-4 h-4 mr-2" />
              Switch to Dock
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={openObsDockInfo}
            className={darkMode ? 'border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700' : ''}
          >
            <Info className="w-4 h-4 mr-2" />
            Setup
          </Button>
        </div>
        {isDevMode && (
          <p className={`text-xs ${mutedClass}`}>
            In development, start Dock Mode with npm run electron-dev:headless from the app folder.
          </p>
        )}
      </div>
    </div>

    <div className={`p-4 rounded-lg border ${darkMode ? 'border-gray-700 bg-gray-800/60' : 'border-gray-200 bg-gray-50'}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className={`w-4 h-4 ${!securityStatus || securityStatus.error || !securityStatus.exists ? (darkMode ? 'text-gray-400' : 'text-gray-500') : securityStatus.needsRotation ? (darkMode ? 'text-yellow-300' : 'text-yellow-600') : (darkMode ? 'text-green-300' : 'text-green-600')}`} />
            <label className={`text-sm font-medium ${labelClass}`}>Security Token Key</label>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${!securityStatus || securityStatus.error || !securityStatus.exists
              ? darkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-700'
              : securityStatus.needsRotation
              ? darkMode ? 'bg-yellow-500/15 text-yellow-200' : 'bg-yellow-100 text-yellow-700'
              : darkMode ? 'bg-green-500/15 text-green-200' : 'bg-green-100 text-green-700'
              }`}
            >
              {securityLoading ? 'Checking' : !securityStatus || securityStatus.error || !securityStatus.exists ? 'Unknown' : securityStatus.needsRotation ? 'Rotation due' : 'Healthy'}
            </span>
          </div>
          <p className={`mt-1 text-xs ${mutedClass}`}>
            Used by this app to sign local authentication tokens. Stale keys rotate automatically on startup.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadSecurityStatus}
          disabled={securityLoading || securityRotating}
          className={darkMode ? 'border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700' : ''}
        >
          {securityLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Refresh
        </Button>
      </div>

      <div className={`mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 ${mutedClass}`}>
        <div>
          <p className={`font-medium ${labelClass}`}>Last rotated</p>
          <p>{formatSecurityDate(securityStatus?.lastRotated)}</p>
        </div>
        <div>
          <p className={`font-medium ${labelClass}`}>Age</p>
          <p>
            {Number.isFinite(securityStatus?.daysSinceRotation)
              ? `${securityStatus.daysSinceRotation} days of ${securityStatus.rotationMaxAgeDays || 180}`
              : 'Not available'}
          </p>
        </div>
        <div>
          <p className={`font-medium ${labelClass}`}>Grace period</p>
          <p>{securityStatus?.graceActive ? `Active until ${formatSecurityDate(securityStatus.previousSecretExpiry)}` : 'Inactive'}</p>
        </div>
        <div>
          <p className={`font-medium ${labelClass}`}>Storage</p>
          <p>{securityStatus?.storageBackend || 'Not available'}</p>
        </div>
      </div>

      {securityStatus?.error && (
        <p className={`mt-3 text-xs ${darkMode ? 'text-red-300' : 'text-red-600'}`}>
          {securityStatus.error}
        </p>
      )}

      <Button
        variant="outline"
        onClick={handleRotateSecurityTokenKey}
        disabled={securityLoading || securityRotating}
        className={darkMode ? 'mt-4 w-full border-yellow-600/60 bg-yellow-950/30 text-yellow-100 hover:bg-yellow-900/40' : 'mt-4 w-full border-yellow-300 bg-yellow-50 text-yellow-800 hover:bg-yellow-100'}
      >
        {securityRotating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />}
        Rotate and Restart App
      </Button>
    </div>

    <div className={`p-4 rounded-lg border ${darkMode ? 'border-gray-700 bg-gray-800/60' : 'border-gray-200 bg-gray-50'}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileText className={`w-4 h-4 ${darkMode ? 'text-blue-300' : 'text-blue-600'}`} />
            <label className={`text-sm font-medium ${labelClass}`}>Operator Action Log</label>
          </div>
          <p className={`mt-1 text-xs ${mutedClass}`}>
            Review recent line, setlist, output, stage, safety, and remote controller actions.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => showModal?.({
            title: 'Operator Action Log',
            headerDescription: 'Review recent live-control actions and export a text copy',
            component: 'OperatorActionLog',
            variant: 'info',
            size: 'lg',
            customLayout: true,
            actions: [{ label: 'Close', variant: 'outline' }],
          })}
          className={darkMode ? 'border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700' : ''}
        >
          View Log
        </Button>
      </div>
    </div>

    <div className="flex items-center justify-between">
      <div>
        <label className={`text-sm font-medium ${labelClass}`}>Debug Logging</label>
        <p className={`text-xs ${mutedClass}`}>Enable verbose logging for troubleshooting</p>
      </div>
      <Switch
        checked={preferences.advanced?.enableDebugLogging ?? false}
        onCheckedChange={(checked) => {
          updatePreference('advanced', 'enableDebugLogging', checked);
          setDebugLogging(checked);
        }}
        className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
          ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
          : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
          }`}
        thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
      />
    </div>

    <div className="flex items-center justify-between">
      <div>
        <label className={`text-sm font-medium ${labelClass}`}>Disable Hardware Acceleration</label>
        <p className={`text-xs ${mutedClass}`}>Force rendering on the CPU instead of the GPU (requires restart)</p>
      </div>
      <Switch
        checked={preferences.advanced?.disableHardwareAcceleration ?? false}
        onCheckedChange={(checked) => {
          updatePreference('advanced', 'disableHardwareAcceleration', checked);
          showToast({
            title: 'Restart Required',
            message: 'Changes to hardware acceleration require restarting the app.',
            variant: 'info',
            actions: [
              {
                label: 'Restart',
                onClick: () => {
                  if (window.electronAPI?.restartApp) {
                    window.electronAPI.restartApp();
                  }
                }
              }
            ]
          });
        }}
        className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
          ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
          : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
          }`}
        thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
      />
    </div>

    <div className="space-y-2">
      <label className={preferenceFieldLabelClass}>Connection Timeout (ms)</label>
      <Input
        type="number"
        min="5000"
        max="60000"
        step="1000"
        value={getNumberInputValue('advanced', 'connectionTimeout', 10000)}
        onChange={(e) => setNumberInputDraft('advanced', 'connectionTimeout', e.target.value)}
        onBlur={() => commitNumberPreference('advanced', 'connectionTimeout', {
          min: 5000,
          max: 60000,
          fallbackValue: 10000,
          parse: 'int',
        })}
        onKeyDown={handleNumberInputKeyDown}
        className={inputClass}
      />
    </div>

    <div className="space-y-2">
      <label className={preferenceFieldLabelClass}>Heartbeat Interval (ms)</label>
      <Input
        type="number"
        min="10000"
        max="120000"
        step="5000"
        value={getNumberInputValue('advanced', 'heartbeatInterval', 30000)}
        onChange={(e) => setNumberInputDraft('advanced', 'heartbeatInterval', e.target.value)}
        onBlur={() => commitNumberPreference('advanced', 'heartbeatInterval', {
          min: 10000,
          max: 120000,
          fallbackValue: 30000,
          parse: 'int',
        })}
        onKeyDown={handleNumberInputKeyDown}
        className={inputClass}
      />
    </div>

    <div className="space-y-2">
      <label className={preferenceFieldLabelClass}>Max Connection Attempts</label>
      <Input
        type="number"
        min="3"
        max="20"
        value={getNumberInputValue('advanced', 'maxConnectionAttempts', 10)}
        onChange={(e) => setNumberInputDraft('advanced', 'maxConnectionAttempts', e.target.value)}
        onBlur={() => commitNumberPreference('advanced', 'maxConnectionAttempts', {
          min: 3,
          max: 20,
          fallbackValue: 10,
          parse: 'int',
        })}
        onKeyDown={handleNumberInputKeyDown}
        className={inputClass}
      />
    </div>

    <Button
      variant="outline"
      onClick={() => handleResetCategory('advanced')}
      className={darkMode ? 'w-full bg-gray-800 border-gray-600 hover:bg-gray-700 text-gray-300' : 'w-full'}
    >
      <RotateCcw className="w-4 h-4 mr-2" />
      Reset Advanced Settings to Defaults
    </Button>
  </div>
  );
};

export default AdvancedPreferencesSection;
