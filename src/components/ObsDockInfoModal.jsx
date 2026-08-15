import React from 'react';
import { Check, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const fallbackInfo = {
  isDev: import.meta.env.MODE === 'development',
  dockFilePath: import.meta.env.MODE === 'development'
    ? 'D:\\path\\to\\lyric-display-app\\obs-dock.html'
    : 'C:\\Program Files\\LyricDisplay\\obs-dock.html',
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

  const cardClass = darkMode
    ? 'border-gray-700/80 bg-gray-900/65 shadow-sm shadow-black/10'
    : 'border-gray-200 bg-gray-50';
  const codeClass = darkMode
    ? 'border-gray-700/70 bg-gray-800/80 text-blue-200'
    : 'border-gray-200 bg-white text-blue-700';
  const copyButtonClass = darkMode
    ? 'border-gray-600 bg-gray-800/80 text-gray-100 hover:border-gray-500 hover:bg-gray-700 hover:text-white'
    : '';

  return (
    <div className={`rounded-lg border p-3 ${cardClass}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className={`text-xs font-semibold uppercase tracking-wide ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          {label}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleCopy} className={copyButtonClass}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <code className={`block break-all rounded border px-2 py-2 text-xs ${codeClass}`}>
        {value}
      </code>
    </div>
  );
}

function CopyDisplayField({ label, displayValue, copyValue, darkMode, hint }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      const value = copyValue || displayValue || '';
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = value;
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

  const cardClass = darkMode
    ? 'border-gray-700/80 bg-gray-900/65 shadow-sm shadow-black/10'
    : 'border-gray-200 bg-gray-50';
  const codeClass = darkMode
    ? 'border-gray-700/70 bg-gray-800/80 text-blue-200'
    : 'border-gray-200 bg-white text-blue-700';
  const copyButtonClass = darkMode
    ? 'border-gray-600 bg-gray-800/80 text-gray-100 hover:border-gray-500 hover:bg-gray-700 hover:text-white'
    : '';

  return (
    <div className={`rounded-lg border p-3 ${cardClass}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className={`text-xs font-semibold uppercase tracking-wide ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          {label}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleCopy} className={copyButtonClass}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <code className={`block break-all rounded border px-2 py-2 text-xs ${codeClass}`}>
        {displayValue}
      </code>
      {hint && (
        <p className={`mt-2 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          {hint}
        </p>
      )}
    </div>
  );
}

function formatReadableUrl(value) {
  if (!value) return '';
  try {
    return decodeURI(value);
  } catch {
    return value;
  }
}

function BetaBadge({ darkMode }) {
  return (
    <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none ${darkMode ? 'border-blue-400/40 bg-blue-500/15 text-blue-200' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
      Beta
    </span>
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

  const dockFileUrl = info?.dockFileUrl || info?.dockFilePath || '';
  const dockFileDisplay = formatReadableUrl(dockFileUrl);
  const commandLabel = info?.isDev ? 'Development Command' : 'Dock Mode Command';
  const isWindowsPlatform = /win/i.test(`${navigator.platform || ''} ${navigator.userAgent || ''}`);
  const productionStartStep = isWindowsPlatform
    ? 'If Dock Mode is not already running, start LyricDisplay Dock Mode from the Start menu or switch from the desktop app.'
    : 'If Dock Mode is not already running, open LyricDisplay and switch from the desktop app.';

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className={`text-sm font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>LyricDisplay Dock</span>
        <BetaBadge darkMode={darkMode} />
      </div>
      <CopyDisplayField
        label="LyricDisplay Dock URL"
        displayValue={dockFileDisplay}
        copyValue={dockFileUrl}
        darkMode={darkMode}
        hint="Use this exact address for the OBS Custom Browser Dock."
      />
      <CopyField label={commandLabel} value={info?.headlessCommand} darkMode={darkMode} />

      <div className={`rounded-lg border p-4 text-sm ${darkMode ? 'border-gray-700/80 bg-gray-900/65 text-gray-200 shadow-sm shadow-black/10' : 'border-gray-200 bg-white text-gray-700'}`}>
        <div className={`mb-2 font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>Setup Steps</div>
        <ol className="list-decimal space-y-2 pl-5">
          {info?.isDev ? (
            <>
              <li>Stop the normal development session if it is running.</li>
              <li>Run the development command shown above.</li>
              <li>In OBS, open Docks, then Custom Browser Docks.</li>
              <li>Paste the LyricDisplay Dock URL above.</li>
              <li>Click Open Controller after the dock page says Dock Mode is ready.</li>
            </>
          ) : (
            <>
              <li>In OBS, open Docks, then Custom Browser Docks.</li>
              <li>Paste the LyricDisplay Dock URL above.</li>
              <li>{productionStartStep}</li>
              <li>Click Open Controller after the dock page says LyricDisplay is ready.</li>
              <li>Enable Start at Sign-In if you want LyricDisplay Dock to be ready automatically after signing in.</li>
            </>
          )}
        </ol>
      </div>

      <div className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${darkMode ? 'border-blue-400/20 bg-blue-500/10 text-blue-100' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
        <ExternalLink className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Use one LyricDisplay Dock entry in OBS. The setup page stays as the home page and opens the controller only after LyricDisplay is ready.
        </p>
      </div>
    </div>
  );
}
