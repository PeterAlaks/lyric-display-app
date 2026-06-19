import React from 'react';
import { Check, Copy, ExternalLink, Loader2, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';

const fallbackInfo = {
  isDev: import.meta.env.MODE === 'development',
  dockFileUrl: import.meta.env.MODE === 'development'
    ? 'file:///D:/path/to/lyric-display-app/obs-dock.html?mode=dev'
    : 'file:///C:/Program Files/LyricDisplay/obs-dock.html',
  headlessCommand: import.meta.env.MODE === 'development'
    ? 'npm run electron-dev:headless'
    : 'LyricDisplay.exe --headless --obs-dock',
};

function CopyField({ label, value, darkMode }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value || '');
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = value || '';
        textarea.setAttribute('readonly', 'readonly');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch (error) {
      console.warn('Failed to copy LyricDisplay Dock value:', error);
    }
  };

  return (
    <div className={`rounded-lg border p-3 ${darkMode ? 'border-gray-700 bg-gray-950' : 'border-gray-200 bg-gray-50'}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className={`text-xs font-semibold uppercase tracking-wide ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          {label}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <code className={`block break-all rounded border px-2 py-2 text-xs ${darkMode ? 'border-gray-800 bg-gray-900 text-blue-200' : 'border-gray-200 bg-white text-blue-700'}`}>
        {value}
      </code>
    </div>
  );
}

export default function ObsDockInfoModal({ darkMode }) {
  const [info, setInfo] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const result = await window.electronAPI?.obsDock?.getInfo?.();
        if (active) setInfo(result?.success === false ? fallbackInfo : (result || fallbackInfo));
      } catch (error) {
        console.warn('Failed to load LyricDisplay Dock setup info:', error);
        if (active) setInfo(fallbackInfo);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[220px] items-center justify-center">
        <Loader2 className={`h-6 w-6 animate-spin ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
      </div>
    );
  }

  const modeLabel = info?.isDev ? 'Development' : 'Production';

  return (
    <div className="max-h-full overflow-y-auto px-6 py-5">
      <div className="space-y-5">
        <div className={`rounded-lg border p-4 ${darkMode ? 'border-blue-500/30 bg-blue-950/20' : 'border-blue-200 bg-blue-50'}`}>
          <div className="flex items-start gap-3">
            <Monitor className={`mt-0.5 h-5 w-5 ${darkMode ? 'text-blue-300' : 'text-blue-600'}`} />
            <div>
              <div className={`text-sm font-semibold ${darkMode ? 'text-blue-100' : 'text-blue-900'}`}>
                LyricDisplay Dock Mode: {modeLabel}
              </div>
              <p className={`mt-1 text-sm ${darkMode ? 'text-blue-100/80' : 'text-blue-900/75'}`}>
                Add only the local HTML file below as an OBS Custom Browser Dock. After you click the button inside that dock, LyricDisplay Dock loads the controller in the same dock.
              </p>
            </div>
          </div>
        </div>

        <CopyField label="LyricDisplay Dock URL" value={info?.dockFileUrl} darkMode={darkMode} />
        <CopyField label={info?.isDev ? 'Dev Headless Command' : 'Headless Command'} value={info?.headlessCommand} darkMode={darkMode} />

        <div className={`rounded-lg border p-4 text-sm ${darkMode ? 'border-gray-700 bg-gray-900 text-gray-200' : 'border-gray-200 bg-white text-gray-700'}`}>
          <div className={`mb-2 font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>Setup Steps</div>
          <ol className="list-decimal space-y-2 pl-5">
            {info?.isDev ? (
              <>
                <li>Run the dev headless command from the repo root.</li>
                <li>In OBS, open Docks, then Custom Browser Docks.</li>
                <li>Paste the LyricDisplay Dock URL above.</li>
                <li>Click Start LyricDisplay Dock in the loaded dock page. The controller opens in that same dock.</li>
              </>
            ) : (
              <>
                <li>Enable LyricDisplay Dock Background Mode if you want LyricDisplay to start headless when you sign in.</li>
                <li>Use Launch Headless Mode when you want to switch the current session into headless mode.</li>
                <li>In OBS, open Docks, then Custom Browser Docks.</li>
                <li>Paste the LyricDisplay Dock URL above.</li>
                <li>Click Start LyricDisplay Dock in the loaded dock page. The controller opens in that same dock.</li>
              </>
            )}
          </ol>
        </div>

        <div className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${darkMode ? 'border-gray-700 bg-gray-950 text-gray-400' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
          <ExternalLink className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Use one LyricDisplay Dock entry in OBS only. The local file is the dock home page, and it navigates itself to the controller after LyricDisplay is running in headless mode.
          </p>
        </div>
      </div>
    </div>
  );
}
