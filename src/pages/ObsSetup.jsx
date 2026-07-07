import React from 'react';
import { CheckCircle2, Copy, ExternalLink, Monitor, Network, PlugZap, RefreshCcw, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { resolveBackendOrigin, resolveBackendUrl } from '@/utils/network';
import { createSourceUrl, DEFAULT_SOURCE_SIZE, formatSourceName } from '@/integrations/sourceUrls';
import { ObsWebSocketClient } from '@/integrations/obs/obsWebSocketClient';
import { createOrUpdateObsBrowserSource } from '@/integrations/obs/createObsBrowserSource';
import { useDarkModeState } from '@/hooks/useStoreSelectors';
import useModal from '@/hooks/useModal';

const PROFILE_KEY = 'lyricdisplay_obs_source_creator_v1';
const TRANSFORM_MODE_OPTIONS = [
  { value: 'stretch', label: 'Stretch to canvas' },
  { value: 'fit', label: 'Fit inside canvas' },
  { value: 'fill', label: 'Fill canvas' },
  { value: 'width', label: 'Scale to width' },
  { value: 'height', label: 'Scale to height' },
  { value: 'none', label: 'Do not change transform' },
];
const obsInputClass = 'h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500';
const obsSelectTriggerClass = 'bg-white border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200';
const obsSelectContentClass = 'bg-white border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200';
const obsPanelClass = 'rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700/70 dark:bg-gray-800/45';
const obsSurfaceClass = 'rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-700/70 dark:bg-gray-900/35';
const obsToggleSurfaceClass = 'flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700/70 dark:bg-gray-900/25';

const readProfile = () => {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
  } catch {
    return {};
  }
};

const writeProfile = (profile) => {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage failures.
  }
};

const isLocalHost = (hostname = '') => {
  const normalized = hostname.toLowerCase();
  return normalized === 'localhost' || normalized === '::1' || normalized.startsWith('127.');
};

const getCurrentHttpOrigin = () => {
  if (typeof window === 'undefined') return '';
  const origin = window.location?.origin || '';
  return origin.startsWith('http') ? origin : '';
};

const getCurrentLanOrigin = () => {
  const currentOrigin = getCurrentHttpOrigin();
  if (!currentOrigin) return '';
  try {
    const current = new URL(currentOrigin);
    return isLocalHost(current.hostname) ? '' : currentOrigin;
  } catch {
    return '';
  }
};

const getInitialSourceBaseUrl = (metadata) => {
  const currentOrigin = getCurrentHttpOrigin();
  if (currentOrigin) {
    try {
      const current = new URL(currentOrigin);
      if (import.meta.env.MODE === 'development') return currentOrigin;
      if (!isLocalHost(current.hostname)) return currentOrigin;
    } catch {
      // Fall through to metadata.
    }
  }

  return metadata?.baseUrls?.local || resolveBackendOrigin();
};

const replaceUrlPort = (value, port) => {
  if (!value) return '';
  try {
    const url = new URL(value);
    url.port = String(port);
    return url.origin;
  } catch {
    return '';
  }
};

const getDevFrontendBaseUrl = (metadata, kind) => {
  const currentOrigin = getCurrentHttpOrigin();
  if (kind === 'local') {
    try {
      const current = new URL(currentOrigin);
      if (isLocalHost(current.hostname)) return currentOrigin;
    } catch {
      // Fall through to localhost.
    }
    return 'http://localhost:5173';
  }

  const currentLanOrigin = getCurrentLanOrigin();
  if (currentLanOrigin) return currentLanOrigin;
  return replaceUrlPort(metadata?.baseUrls?.network, 5173);
};

function Field({ label, children, hint, disabled = false }) {
  return (
    <label className={`block ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{hint}</span>}
    </label>
  );
}

function HelpButton({ darkMode, showModal }) {
  return (
    <button
      onClick={() => {
        showModal({
          title: 'OBS WebSocket Help',
          headerDescription: 'Steps to connect LyricDisplay to OBS',
          component: 'ObsWebSocketHelp',
          variant: 'info',
          size: 'large',
          dismissLabel: 'Got it'
        });
      }}
      className={`p-1.5 rounded-lg transition-colors ${darkMode
        ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
        : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
        }`}
      title="OBS WebSocket Help"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </button>
  );
}

function StatusBox({ status, port }) {
  if (!status?.message) return null;

  const styles = {
    success: 'border-green-200 bg-green-50 text-green-800 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300',
    error: 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300',
    info: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300',
  };

  const Icon = status.type === 'success' ? CheckCircle2 : status.type === 'error' ? ShieldAlert : PlugZap;
  const portLabel = port ? String(port) : 'configured port';

  return (
    <div className={`flex items-start gap-2 rounded-md border p-3 text-sm ${styles[status.type] || styles.info}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <div>{status.message}</div>
        {status.showObsHelp && (
          <div className="mt-2 space-y-1 text-xs leading-relaxed">
            <div>In OBS, open <strong>Tools</strong> then <strong>WebSocket Server Settings</strong>.</div>
            <div>Enable the WebSocket server, confirm the port is <strong>{portLabel}</strong>, and copy the server password here if authentication is enabled.</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ObsSetup() {
  const { darkMode } = useDarkModeState();
  const { showModal } = useModal();
  const savedProfile = React.useMemo(readProfile, []);
  const [metadata, setMetadata] = React.useState(null);
  const [metadataError, setMetadataError] = React.useState('');
  const [obsHost, setObsHost] = React.useState(savedProfile.host || '127.0.0.1');
  const [obsPort, setObsPort] = React.useState(savedProfile.port || 4455);
  const [password, setPassword] = React.useState('');
  const [sources, setSources] = React.useState([]);
  const [scenes, setScenes] = React.useState([]);
  const [selectedScene, setSelectedScene] = React.useState(savedProfile.sceneName || '');
  const [selectedOutput, setSelectedOutput] = React.useState(savedProfile.outputId || 'output1');
  const [mode, setMode] = React.useState(savedProfile.mode || 'transparent');
  const [width, setWidth] = React.useState(savedProfile.width || DEFAULT_SOURCE_SIZE.width);
  const [height, setHeight] = React.useState(savedProfile.height || DEFAULT_SOURCE_SIZE.height);
  const [fps, setFps] = React.useState(savedProfile.fps || DEFAULT_SOURCE_SIZE.fps);
  const [useObsBaseResolution, setUseObsBaseResolution] = React.useState(savedProfile.useObsBaseResolution ?? savedProfile.fitToCanvas ?? true);
  const [obsBaseResolution, setObsBaseResolution] = React.useState(savedProfile.obsBaseResolution || null);
  const [transformMode, setTransformMode] = React.useState(savedProfile.transformMode || 'stretch');
  const [lockSource, setLockSource] = React.useState(savedProfile.lockSource ?? true);
  const [sourceBaseUrl, setSourceBaseUrl] = React.useState(savedProfile.sourceBaseUrl || '');
  const [sourceName, setSourceName] = React.useState(savedProfile.sourceName || formatSourceName(savedProfile.outputId || 'output1'));
  const [status, setStatus] = React.useState({ type: 'info', message: '' });
  const [isLoadingMetadata, setIsLoadingMetadata] = React.useState(true);
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);
  const [isObsConnected, setIsObsConnected] = React.useState(false);
  const clientRef = React.useRef(null);

  const switchBaseClasses = `!h-8 !w-16 !border-0 shadow-sm transition-colors ${darkMode
    ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
    : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
    }`;
  const switchThumbClass = '!h-6 !w-7 data-[state=checked]:!translate-x-8 data-[state=unchecked]:!translate-x-1';
  const getSwitchProps = (disabled = false) => ({
    className: `${switchBaseClasses} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`,
    thumbClassName: switchThumbClass,
  });

  const selectedSource = React.useMemo(
    () => sources.find((source) => source.id === selectedOutput),
    [sources, selectedOutput]
  );

  const sourceUrl = React.useMemo(
    () => createSourceUrl({ baseUrl: sourceBaseUrl || resolveBackendOrigin(), outputId: selectedOutput, mode }),
    [sourceBaseUrl, selectedOutput, mode]
  );

  const effectiveWidth = useObsBaseResolution
    ? Number(obsBaseResolution?.width) || Number(width) || DEFAULT_SOURCE_SIZE.width
    : Number(width) || DEFAULT_SOURCE_SIZE.width;
  const effectiveHeight = useObsBaseResolution
    ? Number(obsBaseResolution?.height) || Number(height) || DEFAULT_SOURCE_SIZE.height
    : Number(height) || DEFAULT_SOURCE_SIZE.height;

  const isNetworkSetup = React.useMemo(() => {
    try {
      const source = new URL(sourceBaseUrl);
      return !isLocalHost(source.hostname);
    } catch {
      return false;
    }
  }, [sourceBaseUrl]);

  const loadMetadata = React.useCallback(async () => {
    setIsLoadingMetadata(true);
    setMetadataError('');
    try {
      const response = await fetch(resolveBackendUrl('/api/integrations/sources'));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Failed to load integration metadata.');

      setMetadata(data);
      setSources(data.sources || []);
      setSelectedOutput((current) => (data.sources || []).some((source) => source.id === current)
        ? current
        : data.sources?.[0]?.id || 'output1');
      setSourceBaseUrl((current) => (
        import.meta.env.MODE === 'development'
          ? getInitialSourceBaseUrl(data)
          : getCurrentLanOrigin() || current || getInitialSourceBaseUrl(data)
      ));
    } catch (error) {
      setMetadataError(error.message || 'Failed to load LyricDisplay source metadata.');
    } finally {
      setIsLoadingMetadata(false);
    }
  }, []);

  React.useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  React.useEffect(() => {
    if (!savedProfile.sourceName) {
      setSourceName(formatSourceName(selectedOutput));
    }
  }, [savedProfile.sourceName, selectedOutput]);

  const handleOutputChange = React.useCallback((outputId) => {
    const defaultNames = sources.map((source) => formatSourceName(source.id));
    const shouldRefreshName = !sourceName || defaultNames.includes(sourceName);
    setSelectedOutput(outputId);
    if (shouldRefreshName) {
      setSourceName(formatSourceName(outputId));
    }
  }, [sourceName, sources]);

  React.useEffect(() => {
    if (!selectedSource) return;
    if (!savedProfile.width) setWidth(selectedSource.defaultWidth || DEFAULT_SOURCE_SIZE.width);
    if (!savedProfile.height) setHeight(selectedSource.defaultHeight || DEFAULT_SOURCE_SIZE.height);
    if (!savedProfile.fps) setFps(selectedSource.fps || DEFAULT_SOURCE_SIZE.fps);
  }, [savedProfile.fps, savedProfile.height, savedProfile.width, selectedSource]);

  React.useEffect(() => {
    if (!useObsBaseResolution || !obsBaseResolution?.width || !obsBaseResolution?.height) return;
    setWidth(obsBaseResolution.width);
    setHeight(obsBaseResolution.height);
  }, [obsBaseResolution, useObsBaseResolution]);

  const saveCurrentProfile = React.useCallback((overrides = {}) => {
    writeProfile({
      host: obsHost,
      port: Number(obsPort) || 4455,
      sceneName: selectedScene,
      outputId: selectedOutput,
      mode,
      width: Number(width) || DEFAULT_SOURCE_SIZE.width,
      height: Number(height) || DEFAULT_SOURCE_SIZE.height,
      fps: Number(fps) || DEFAULT_SOURCE_SIZE.fps,
      useObsBaseResolution,
      obsBaseResolution,
      transformMode,
      lockSource,
      sourceBaseUrl,
      sourceName,
      ...overrides,
    });
  }, [fps, height, lockSource, mode, obsBaseResolution, obsHost, obsPort, selectedOutput, selectedScene, sourceBaseUrl, sourceName, transformMode, useObsBaseResolution, width]);

  React.useEffect(() => {
    saveCurrentProfile();
  }, [saveCurrentProfile]);

  const connectToObs = React.useCallback(async () => {
    setIsConnecting(true);
    setIsObsConnected(false);
    setStatus({ type: 'info', message: `Connecting to OBS at ${obsHost}:${obsPort}...` });

    clientRef.current?.disconnect();
    const client = new ObsWebSocketClient({
      host: obsHost,
      port: Number(obsPort) || 4455,
      password,
    });

    try {
      await client.connect();
      const [sceneResult, videoSettings] = await Promise.all([
        client.getSceneList(),
        client.getVideoSettings(),
      ]);

      const nextScenes = sceneResult.scenes || [];
      setScenes(nextScenes);
      const nextScene = selectedScene && nextScenes.some((scene) => scene.sceneName === selectedScene)
        ? selectedScene
        : sceneResult.currentProgramSceneName || nextScenes[0]?.sceneName || '';
      setSelectedScene(nextScene);

      const nextBaseResolution = {
        width: Number(videoSettings.baseWidth) || DEFAULT_SOURCE_SIZE.width,
        height: Number(videoSettings.baseHeight) || DEFAULT_SOURCE_SIZE.height,
      };
      setObsBaseResolution(nextBaseResolution);
      if (useObsBaseResolution || !savedProfile.width) setWidth(nextBaseResolution.width);
      if (useObsBaseResolution || !savedProfile.height) setHeight(nextBaseResolution.height);

      clientRef.current = client;
      setIsObsConnected(true);
      saveCurrentProfile({ sceneName: nextScene, obsBaseResolution: nextBaseResolution });
      setStatus({ type: 'success', message: `Connected to OBS. Base resolution: ${nextBaseResolution.width} x ${nextBaseResolution.height}.` });
    } catch (error) {
      client.disconnect();
      setIsObsConnected(false);
      setStatus({
        type: 'error',
        message: error.message || 'Failed to connect to OBS.',
        showObsHelp: true,
      });
    } finally {
      setIsConnecting(false);
    }
  }, [obsHost, obsPort, password, saveCurrentProfile, savedProfile.height, savedProfile.width, selectedScene, useObsBaseResolution]);

  const createSource = React.useCallback(async () => {
    const client = clientRef.current;
    if (!client) {
      setStatus({ type: 'error', message: 'Connect to OBS before creating a source.' });
      return;
    }
    if (!selectedScene) {
      setStatus({ type: 'error', message: 'Select an OBS scene first.' });
      return;
    }

    setIsCreating(true);
    setStatus({ type: 'info', message: `Creating ${sourceName} in ${selectedScene}...` });

    try {
      const result = await createOrUpdateObsBrowserSource({
        client,
        sceneName: selectedScene,
        sourceName,
        sourceUrl,
        width: effectiveWidth,
        height: effectiveHeight,
        fps: Number(fps) || DEFAULT_SOURCE_SIZE.fps,
        transparent: mode === 'transparent',
        transformMode,
        lockSource,
      });

      saveCurrentProfile();
      setStatus({
        type: 'success',
        message: result.action === 'updated'
          ? `Updated existing OBS source "${sourceName}".`
          : result.action === 'updated-and-added'
            ? `Updated "${sourceName}" and added it to "${selectedScene}".`
          : `Created OBS source "${sourceName}".`,
      });
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Failed to create OBS source.' });
    } finally {
      setIsCreating(false);
    }
  }, [effectiveHeight, effectiveWidth, fps, lockSource, mode, saveCurrentProfile, selectedScene, sourceName, sourceUrl, transformMode]);

  const copySourceUrl = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(sourceUrl);
      setStatus({ type: 'success', message: 'Source URL copied.' });
    } catch {
      setStatus({ type: 'error', message: 'Could not copy the source URL.' });
    }
  }, [sourceUrl]);

  const openSourceUrl = React.useCallback(() => {
    window.open(sourceUrl, '_blank', 'noopener,noreferrer');
  }, [sourceUrl]);

  const useLocalBaseUrl = () => setSourceBaseUrl(
    import.meta.env.MODE === 'development'
      ? getDevFrontendBaseUrl(metadata, 'local')
      : metadata?.baseUrls?.local || 'http://127.0.0.1:4000'
  );
  const useNetworkBaseUrl = () => {
    const networkBaseUrl = import.meta.env.MODE === 'development'
      ? getDevFrontendBaseUrl(metadata, 'network')
      : metadata?.baseUrls?.network;
    if (networkBaseUrl) setSourceBaseUrl(networkBaseUrl);
  };

  return (
    <div className="h-full min-h-screen overflow-y-auto bg-[#f8fafc] pb-4 text-gray-950 dark:bg-gray-900 dark:text-gray-100">
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-4 pb-6 pt-5 sm:px-6">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-4 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-semibold">OBS Source Creator</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Create or update a LyricDisplay Browser Source in OBS.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={loadMetadata} disabled={isLoadingMetadata}>
            <RefreshCcw className="h-4 w-4" />
            Refresh Outputs
          </Button>
        </header>

        {metadataError && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {metadataError}
          </div>
        )}

        <div className="grid flex-1 items-start gap-4 pb-4 lg:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)]">
          <section className={`mb-4 lg:mb-0 ${obsPanelClass}`}>
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <PlugZap className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                <h2 className="text-base font-semibold">OBS Connection</h2>
              </div>
              <HelpButton darkMode={darkMode} showModal={showModal} />
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
              <Field
                label="OBS Host"
                hint={isNetworkSetup ? 'For network setup, keep this as 127.0.0.1 when this page is open on the OBS computer.' : null}
              >
                <input
                  value={obsHost}
                  onChange={(event) => setObsHost(event.target.value)}
                  className={obsInputClass}
                />
              </Field>
              <Field label="Port">
                <input
                  type="number"
                  min="1"
                  max="65535"
                  value={obsPort}
                  onChange={(event) => setObsPort(event.target.value)}
                  className={obsInputClass}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Password" hint="Leave blank if OBS WebSocket authentication is disabled. The password is not stored.">
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className={obsInputClass}
                  />
                </Field>
              </div>
            </div>

            <div className={`mt-4 space-y-3 ${obsSurfaceClass}`}>
              <Field label="Source Base URL" hint="Use LAN for an OBS computer on the network. Use Local when OBS is on this computer.">
                <input
                  value={sourceBaseUrl}
                  onChange={(event) => setSourceBaseUrl(event.target.value)}
                  className={obsInputClass}
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={useLocalBaseUrl}>Use Local</Button>
                <Button variant="outline" onClick={useNetworkBaseUrl} disabled={!metadata?.baseUrls?.network}>Use LAN</Button>
              </div>
            </div>

            <Button className="mt-4 w-full" onClick={connectToObs} disabled={isConnecting}>
              <Monitor className="h-4 w-4" />
              {isConnecting ? 'Connecting...' : 'Connect to OBS'}
            </Button>

            <div className="mt-4">
              <StatusBox status={status} port={obsPort} />
            </div>

            <div className={`mt-4 text-sm ${obsSurfaceClass}`}>
              <div className="mb-2 flex items-center gap-2 font-semibold">
                <Network className="h-4 w-4" />
                {isNetworkSetup ? 'Network Setup' : 'Same Computer Setup'}
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                {isNetworkSetup
                  ? 'This page is using a LAN LyricDisplay URL for the OBS Browser Source. OBS WebSocket should stay local to this computer.'
                  : 'This page is using a local LyricDisplay URL for the OBS Browser Source.'}
              </p>
            </div>
          </section>

          <section className={`relative mb-4 lg:mb-0 ${obsPanelClass}`}>
            <div className="mb-4 flex items-center gap-2">
              <ExternalLink className="h-5 w-5 text-blue-600 dark:text-blue-300" />
              <h2 className="text-base font-semibold">Source Settings</h2>
            </div>

            {!isObsConnected && (
              <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                Connect to OBS before configuring or creating a source.
              </div>
            )}

            <fieldset disabled={!isObsConnected} className={!isObsConnected ? 'opacity-50' : ''}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="LyricDisplay Output">
                <Select value={selectedOutput} onValueChange={handleOutputChange}>
                  <SelectTrigger className={obsSelectTriggerClass}>
                    <SelectValue placeholder="Select output" />
                  </SelectTrigger>
                  <SelectContent className={obsSelectContentClass}>
                    {sources.map((source) => (
                      <SelectItem key={source.id} value={source.id}>{source.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="OBS Scene">
                <Select value={selectedScene} onValueChange={setSelectedScene} disabled={scenes.length === 0}>
                  <SelectTrigger className={obsSelectTriggerClass}>
                    <SelectValue placeholder={scenes.length ? 'Select scene' : 'Connect first'} />
                  </SelectTrigger>
                  <SelectContent className={obsSelectContentClass}>
                    {scenes.map((scene) => (
                      <SelectItem key={scene.sceneName} value={scene.sceneName}>{scene.sceneName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Source Name">
                <input
                  value={sourceName}
                  onChange={(event) => setSourceName(event.target.value)}
                  className={obsInputClass}
                />
              </Field>

              <Field label="Mode">
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger className={obsSelectTriggerClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={obsSelectContentClass}>
                    <SelectItem value="transparent">Transparent Overlay</SelectItem>
                    <SelectItem value="projection">Projection Black Background</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <div className={`${obsToggleSurfaceClass} sm:col-span-2`}>
                <div>
                  <span className="text-sm font-medium">Use OBS Base Resolution</span>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {obsBaseResolution?.width && obsBaseResolution?.height
                      ? `${obsBaseResolution.width} x ${obsBaseResolution.height}`
                      : 'Connect to OBS to read the base canvas size.'}
                  </div>
                </div>
                <Switch checked={useObsBaseResolution} onCheckedChange={setUseObsBaseResolution} {...getSwitchProps(false)} />
              </div>

              <Field label="Width" disabled={useObsBaseResolution}>
                <input
                  type="number"
                  min="320"
                  max="7680"
                  value={width}
                  onChange={(event) => setWidth(event.target.value)}
                  disabled={useObsBaseResolution}
                  className={obsInputClass}
                />
              </Field>

              <Field label="Height" disabled={useObsBaseResolution}>
                <input
                  type="number"
                  min="240"
                  max="4320"
                  value={height}
                  onChange={(event) => setHeight(event.target.value)}
                  disabled={useObsBaseResolution}
                  className={obsInputClass}
                />
              </Field>

              <Field label="FPS">
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={fps}
                  onChange={(event) => setFps(event.target.value)}
                  className={obsInputClass}
                />
              </Field>

              <Field label="OBS Transform">
                <Select value={transformMode} onValueChange={setTransformMode}>
                  <SelectTrigger className={obsSelectTriggerClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={obsSelectContentClass}>
                    {TRANSFORM_MODE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <div className={obsToggleSurfaceClass}>
                <span className="text-sm font-medium">Lock new source</span>
                <Switch checked={lockSource} onCheckedChange={setLockSource} {...getSwitchProps(false)} />
              </div>

              <div className={`${obsSurfaceClass} text-xs text-gray-600 dark:text-gray-400 sm:col-span-2`}>
                Source size used for OBS: <span className="font-mono text-gray-900 dark:text-gray-100">{effectiveWidth} x {effectiveHeight}</span>
              </div>
            </div>

            <div className={`mt-4 ${obsSurfaceClass}`}>
              <div className="mb-1 text-xs font-semibold text-gray-600 dark:text-gray-300">Browser Source URL</div>
              <div className="break-all font-mono text-xs text-blue-700 dark:text-blue-300">{sourceUrl}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={copySourceUrl}>
                  <Copy className="h-4 w-4" />
                  Copy URL
                </Button>
                <Button variant="outline" size="sm" onClick={openSourceUrl}>
                  <ExternalLink className="h-4 w-4" />
                  Open Preview
                </Button>
              </div>
            </div>

            <Button className="mt-4 w-full" onClick={createSource} disabled={isCreating || !isObsConnected || !selectedScene || !sourceName}>
              <CheckCircle2 className="h-4 w-4" />
              {isCreating ? 'Creating...' : 'Create or Update OBS Source'}
            </Button>
            </fieldset>
          </section>
        </div>
      </div>
    </div>
  );
}
